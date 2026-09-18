# RaceGame 技术架构 V2.0

## 1. 架构分层与依赖方向

```text
Cocos Creator 3.8.8 (Client)
        │ HTTPS (REST API) / WSS (SignalR)
        ▼
RaceGame.Api ───── SignalR Hub
        │
        ▼
RaceGame.Application (IGameDbContext 抽象)
        │
   ┌────┴──────────────────────────┐
   ▼                               ▼
RaceGame.Domain            RaceGame.Infrastructure
(纯业务实体与枚举)            (EF Core / PostgreSQL / Redis)
                                   │
RaceGame.Worker ───────────────────┤
(IHostedService 状态机推进)         │
                                   ▼
RaceGame.Admin ──────────── PostgreSQL 16 / Redis 7
```

- **目标依赖原则**：
  - `Domain` 是核心，严禁依赖 EF Core、ASP.NET Core、Redis 或客户端类型；
  - `Application` 编排业务用例，通过 `IGameDbContext` 等抽象接口访问持久化与基础设施；
  - `Infrastructure` 提供具体技术实现（EF Core、PostgreSQL、Redis 分布式锁与 Pub/Sub）；
  - `Api` 暴露 REST 控制器与 SignalR Hub，保持轻量薄层；
  - `Worker` 作为 BackgroundService 运行，时间驱动轮次状态流转与补偿；
  - `Admin` 独立提供运营与审计支撑能力。

---

## 2. 权威边界与零信任模型

- **Client（表现层）**：负责 UI 交互、720×1280 竖屏 HUD 布局、骨骼与粒子动画播放。**零权威**：绝不参与赛果计算、赔率决定、钱包扣款或奖励发放。
- **Server（权威源）**：所有状态流转、下注截止判定、赔率锁定、赛果推演与资金变动均由服务端权威计算并落库。
- **时钟基准**：全系统严格使用 **UTC 时间** (`TIMESTAMPTZ`)，严禁使用本地时间进行轮次判定；客户端通过 `/api/race/time` 对齐服务端时钟基准。

---

## 3. 比赛轮次生命周期（状态机模型）

轮次状态必须显式、单向、不可逆流转，数据库部分唯一索引保证同一时间仅存在**一个**活动轮次：

```mermaid
stateDiagram-v2
    [*] --> Betting: Worker创建新轮次 (锁定6匹马与基础赔率)
    
    Betting --> Preparing: 倒计时截止 且 下注数 > 0\n(生成加密安全盐 & 锁定赛果种子)
    Betting --> Finished: 倒计时截止 且 无任何下注\n(无注轮次快速跳过)
    
    Preparing --> Racing: 准备时间结束 (广播开赛动画)
    Racing --> Settlement: 比赛耗时结束 (进入结算状态)
    
    Settlement --> Finished: 结算完成 (完成派彩、流水审计、任务/成就推进)
    
    Finished --> Betting: 轮次间隔结束 (创建下一轮)
```

- **无注轮次优化**：当进入截止时间且 `BetCount == 0` 时，直接置为 `Finished` 跳过演出，节约服务端与客户端算力。
- **单向演进保证**：状态字段为持久化整数枚举，禁止随意逆向赋值。

---

## 4. 下注与钱包并发扣款事务设计

为防止并发透支、网络重试导致的重复扣款及撞 Key 攻击，系统采用**请求指纹 + PostgreSQL 行级排他锁 + 锁定赔率 + 事务内双写流水**架构：

```mermaid
sequenceDiagram
    autonumber
    actor Player as 玩家客户端
    participant API as RaceGame.Api
    participant App as BettingService
    participant DB as PostgreSQL 16 (AppDbContext)

    Player->>API: POST /api/race/bet (RoundId, HorseNo, Amount, IdempotencyKey)
    API->>App: PlaceAsync(playerId, request)
    App->>DB: BeginTransactionAsync (IsolationLevel.ReadCommitted)
    
    App->>DB: 查询 BetOrders (IdempotencyKey)
    alt 幂等键已存在
        App->>App: 校验 PlayerId 与 RequestHash (SHA256指纹)
        alt 指纹匹配 (网络重试)
            App-->>Player: 返回已有订单详情与当前余额 (幂等重放)
        else 指纹不匹配 (恶意或误用)
            App-->>Player: 抛出 409 IDEMPOTENCY_REQUEST_MISMATCH
        end
    end

    App->>DB: 查询 RaceRounds 并校验状态 (State == Betting 且 now < BettingEndAt)
    
    App->>DB: SELECT * FROM wallets WHERE player_id = @id FOR UPDATE (行级悲观锁)
    Note over App,DB: 同一玩家并发下注/消费在此严格排队串行化
    
    App->>App: 校验余额 (wallet.Balance >= Amount)
    App->>App: 二次校验轮次截止时间 (防止排队等待期间跨过下注截止线)
    App->>DB: 校验/插入 RaceBetSelections (同一轮次单玩家仅限选择单匹马)

    App->>App: 锁定当前马匹赔率 (LockedOdds) 并计算预估收益与抽水
    App->>DB: 扣减余额 wallet.Balance -= Amount, Version++
    App->>DB: 插入 wallet_transactions 扣款流水 (Type=BET_ORDER, IdempotencyKey)
    App->>DB: 插入 bet_orders (LockedOdds, RequestHash, Status=1)
    App->>DB: 累加轮次统计 round.BetCount++, round.TotalBetAmount += Amount
    
    App->>DB: CommitAsync()
    App-->>API: PlaceBetResponse
    API-->>Player: 200 OK { code: 0, data: { orderNo, balance, ... } }
```

---

## 5. Worker 分布式推进与确定性赛果生成

`RaceWorker` 采用 Redis 分布式锁避免集群多实例重复推进，并在关键状态切换时运用 Provably Fair 思想：

```mermaid
sequenceDiagram
    autonumber
    participant Worker as RaceWorker (后台服务)
    participant Redis as Redis 7 (分布式锁/缓存)
    participant DB as PostgreSQL 16
    participant Engine as RaceEngine (确定性算法)
    participant Pub as SignalR Hub & Redis Pub/Sub

    loop 每 500ms 轮询一次
        Worker->>Redis: AcquireLockAsync("lock:race:advance", token, 10s)
        alt 未抢到锁
            Worker->>Worker: 延时后进入下一轮循环
        else 成功获得锁
            Worker->>Worker: 启动 RenewLockLoopAsync (每3秒自动续租)
            Worker->>DB: 查询最新轮次及状态
            
            alt 下注截止 (State: Betting -> Preparing)
                Worker->>Worker: 生成 32 字节密码学安全随机盐 (RandomNumberGenerator)
                Worker->>Engine: Generate(round, secretSalt)
                Note over Engine: 种子推导: roundNo:roundId:version:secretSalt<br/>确定性模拟 1~6 名次与黑马判定
                Worker->>DB: 写入 CommitSeedHash (开赛前公开承诺哈希) 与 马匹动画参数
                Worker->>DB: SaveChangesAsync()
                Worker->>Pub: 广播 RacePreparing 事件
            else 比赛结束 (State: Racing -> Settlement)
                Worker->>DB: 标记 State = Settlement
                Worker->>DB: 触发 SettlementService.SettleAsync(roundId, winnerHorseNo)
                Note over DB: 在同一事务中批量更新注单、派发中奖钱包奖励、<br/>写入奖励流水、推进每日任务与成就进度
                Worker->>DB: 标记 State = Finished, 公开 SecretSalt
                Worker->>Pub: 广播 RaceSettled 事件
            end

            Worker->>Redis: ReleaseLockAsync (Lua 脚本安全校验 token 后删除)
        end
    end
```

---

## 6. SignalR 实时广播、时钟同步与弱网补偿

```mermaid
sequenceDiagram
    autonumber
    actor Client as Cocos 客户端
    participant API as REST API 控制器
    participant Hub as SignalR (RaceHub)
    participant Redis as Redis Pub/Sub
    participant Worker as RaceWorker

    Client->>API: GET /api/race/time
    API-->>Client: { serverTime: UTC }
    Client->>Client: 计算本地与服务端时钟偏移量 (serverOffsetMs)

    Client->>Hub: 连接 /hubs/race (JWT 认证)
    Client->>Hub: JoinRound(roundId) 加入房间组

    Worker->>Hub: 赛况事件广播 (RacePreparing / RaceStarted / RaceSettled)
    Worker->>Redis: Publish("race:events", eventJson) (多实例转发)
    Hub-->>Client: 实时接收推送 -> 触发客户端骨骼与粒子动画加速渲染

    Note over Client,Hub: 若遇网络抖动导致 WebSocket 连接断开
    Client->>Client: 检测到断线重连 (OnReconnected)
    Client->>API: 主动请求 GET /api/race/current (状态补偿)
    API-->>Client: 返回当前真实轮次状态、各马匹当前进度与玩家已下注单
    Client->>Client: 重新对齐倒计时并平滑校准赛马位置
```

---

## 7. 生产环境安全与配置规范

生产环境必须遵循“零代码硬编码，全外部注入”原则：

```bash
# 环境变量或容器 Secret 注入清单
ConnectionStrings__Default="Host=pg;Port=5432;Database=racegame;Username=...;Password=..."
Redis__Connection="redis:6379"
Redis__Password="<StrongRedisPassword>"
Jwt__Key="<AtLeast256BitsCryptographicKey>"
Jwt__Issuer="RaceGame"
Jwt__Audience="RaceGame"
Cors__AllowedOrigins__0="https://game.yourdomain.com"
```

- **安全审计红线**：
  1. 仓库内 `appsettings.Production.json` 绝不存放明文密码与有效密钥；
  2. 禁用 `AllowAnyOrigin` CORS 规则，严格限定正式域名与 Credentials；
  3. `dev-login` 与 Swagger 仅限本地/测试环境（Development / Staging）可用，禁止暴露到公网生产环境；
  4. 登录密码必须通过高强度 PBKDF2/Argon2 等哈希算法校验，连续失败 5 次自动锁定 10 分钟。

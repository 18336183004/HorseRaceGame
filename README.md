# 《西部边境赛马会》HorseRaceGame V2.0

> **基于 Cocos Creator 3.8.8 + ASP.NET Core (.NET 10) + PostgreSQL 16 + Redis 7 构建的高性能、可验证公平的实时赛马与竞技游戏系统。**

---

## 一、 系统架构总览

本工程采用典型的分层领域驱动设计（DDD）架构，服务端由核心业务领域、用例编排、基础设施、高可用状态机 Worker、客户端 API 以及现代化 SaaS 运营后台组成；客户端基于 Cocos Creator 3.8.8 研发，采用纯表现层架构，严格执行“服务端权威、客户端仅渲染”的设计原则。

```
                              ┌────────────────────────┐
                              │  Cocos Creator Client  │ (TypeScript 表现层)
                              │  (HUD/赛道/大厅/商城)   │
                              └───────────┬────────────┘
                                          │ HTTP / SignalR WebSocket
                                          ▼
┌─────────────────────────────── RaceGame.Api ────────────────────────────────┐
│  • JWT 认证与防重放会话       • RESTful 业务接口        • SignalR 广播 Hub  │
│  • 接口 RateLimiter 限流     • 异常全局统一处理        • 幂等指纹拦截器    │
└─────────────────────────────────────┬───────────────────────────────────────┘
                                      │
┌─────────────────────────── RaceGame.Application ────────────────────────────┐
│  • RaceEngine (确定性算法)   • BettingService (注单)   • SettlementService  │
│  • ShopService (防重购)      • TaskService (每日任务)  • ReferralService    │
└──────────────────┬─────────────────────────────────────┬────────────────────┘
                   │                                     │
┌──────────────────▼───────────┐      ┌──────────────────▼────────────────────┐
│      RaceGame.Domain         │      │       RaceGame.Infrastructure         │
│  • 50+ 领域持久化实体模型     │      │  • EF Core 10 / Npgsql 连接池         │
│  • 稳定业务常量代码集中库    │      │  • Redis 分布式互斥锁与数据缓存        │
│  • 状态机流转枚举与业务规则  │      │  • Argon2/PBKDF2 安全凭据散列         │
└──────────────────────────────┘      └──────────────────┬────────────────────┘
                                                         │
                                      ┌──────────────────▼────────────────────┐
                                      │   PostgreSQL 16   /   Redis 7         │
                                      └──────────────────▲────────────────────┘
                                                         │
┌─────────────────────────── RaceGame.Worker ────────────┴────────────────────┐
│  • Redis 租约互斥锁状态机驱动器                                             │
│  • 驱动轮次严格流转: Betting → Closed → Preparing → Racing → Settle → Done  │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────────────── RaceGame.Admin ─────────────────────────────────┐
│  • 现代 SaaS 仪表盘 (Chart.js 动态走势、结算圆环图、营业额双柱对比)         │
│  • 玩家档案、注单流水、马匹编目、系统轮次状态与审计日志检索                │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 二、 目录结构说明

```text
HorseRaceGame.git/
├── Client/                         # Cocos Creator 3.8.8 客户端源码
│   ├── assets/
│   │   ├── scenes/                 # 主场景文件 (Main.scene 等)
│   │   └── scripts/                # TypeScript 核心脚本
│   │       ├── ApiClient.ts        # HTTP 网络客户端 (自动刷新 Token、统一异常)
│   │       ├── ApiTypes.ts         # 前后端 Wire 接口强类型契约
│   │       ├── ClientConfig.ts     # 客户端全局环境配置
│   │       ├── GameApp.ts          # 大厅/玩法/商城/背包/HUD 视觉与交互控制
│   │       ├── SignalRClient.ts    # 轻量 SignalR WebSocket 长连接客户端
│   │       ├── WestTheme.ts        # 西部视觉系统、高反差调色板与物理图元渲染器
│   │       └── ...
│   └── extensions/                 # Cocos MCP 桥接插件扩展
├── Server/                         # .NET 10 服务端解决方案
│   ├── RaceGame.Domain/            # 领域层：实体模型, 枚举, 业务常量 (无第三方依赖)
│   ├── RaceGame.Application/       # 应用层：业务用例, 状态流转, 结算, 引擎, 规则
│   ├── RaceGame.Infrastructure/    # 基础设施：EF Core, PostgreSQL 映射, Redis 客户端
│   ├── RaceGame.Worker/            # 后台任务：跨实例分布式锁状态机轮巡推进服务
│   ├── RaceGame.Api/               # 客户端 API：REST 接口, 认证校验, SignalR Hub
│   └── RaceGame.Admin/             # 运营管理后台：SaaS MVC 架构, Chart.js 可视化大屏
├── Database/                       # 数据库持久化脚本
│   └── DeployInit/                 # 增量数据库脚本 (001_initial.sql ~ 009_arcade_quinella_mode.sql, all_in_one_init.sql)
├── Tests/                          # 自动化测试工程
│   └── RaceGame.Application.Tests/ # xUnit 单元测试套件 (包含 86 个严密业务用例)
├── Tools/                          # 工具与自动化脚本
│   └── cocos-mcp/                  # Cocos 编辑器/浏览器预览 MCP 桥接调试服务
├── Docs/                           # 完备的技术、架构、产品规范与运维文档
├── deploy/                         # Docker Compose 生产与测试一键部署拓扑
├── RaceGame.sln                    # Visual Studio / dotnet 统一解决方案文件
└── README.md                       # 项目主说明文档
```

---

## 三、 环境依赖与准备

| 组件名称 | 推荐版本 | 说明 |
| :--- | :--- | :--- |
| **.NET SDK** | `10.0.x` | 服务端统一开发与构建环境（C# 10 支持） |
| **Node.js** | `18.x` ~ `22.x` | 客户端编译检查、前端构建与 Tools/MCP 运行 |
| **PostgreSQL** | `16.x` | 主关系型数据库（支持 `NUMERIC` 高精度资金与强唯一键约束） |
| **Redis** | `7.x` | 分布式互斥锁、轮次状态缓存与高频消息推送 |
| **Cocos Creator** | `3.8.8` | 客户端游戏引擎（原生支持 720×1280 竖屏适配） |

---

## 四、 本地快速启动指南

### 步骤 1：初始化数据库与缓存

1. 确保本地 PostgreSQL（端口 `5432`）与 Redis（端口 `6379`）正常运行；
2. 在 PostgreSQL 中创建名为 `racegame` 的数据库（或按需指定库名）；
3. 可直接执行汇总初始化脚本（推荐）：
   ```bash
   psql -U postgres -d racegame -f Database/DeployInit/all_in_one_init.sql
   ```
   或依次执行增量迁移脚本 `001_initial.sql` ~ `009_arcade_quinella_mode.sql`。

> [!TIP]
> 默认管理后台账号：`admin`，默认密码：`Admin@123456`。

### 步骤 2：启动服务端应用

可在不同的命令行终端窗口中分别启动三大后端服务：

```bash
# 1. 启动客户端 API 服务 (监听端口 5080)
dotnet run --project Server/RaceGame.Api/RaceGame.Api.csproj

# 2. 启动状态机驱动 Worker 进程 (监听 Redis 锁并推进轮次生命周期)
dotnet run --project Server/RaceGame.Worker/RaceGame.Worker.csproj

# 3. 启动 SaaS 运营管理后台 (监听端口 5082)
dotnet run --project Server/RaceGame.Admin/RaceGame.Admin.csproj
```

启动成功后：
- **客户端 API Swagger 文档**：`http://localhost:5080/swagger`（仅限开发环境）
- **运营管理后台入口**：`http://localhost:5082`（使用默认管理员账号登录）

### 步骤 3：启动客户端

1. 使用 **Cocos Creator 3.8.8** 打开 `Client/` 目录；
2. 双击打开 `assets/scenes/Main.scene` 场景；
3. 点击编辑器顶部“运行预览”或使用浏览器打开（默认预览地址 `http://localhost:7456`）；
4. 客户端将自动连接 `http://localhost:5080` 的 API 与 SignalR 服务，开始同步实时赛况。

---

## 五、 Docker 容器化一键部署

本工程在 `deploy/` 目录下提供了完整的容器编排方案：

1. 复制环境变量模板：
   ```bash
   cd deploy
   cp .env.example .env
   # 根据实际生产环境修改 .env 中的数据库密码与 JWT 密钥
   ```
2. 启动全量容器链（PostgreSQL → Redis → Api → Worker → Admin）：
   ```bash
   docker compose up -d --build
   ```
3. 查看服务运行状态与日志：
   ```bash
   docker compose ps
   docker compose logs -f api worker
   ```

---

## 六、 核心业务机制与安全保障

### 1. 赛马 7 阶段状态机
系统以数据库持久化记录为唯一权威源，Redis 仅作为多实例调度互斥锁：
- **`Betting` (1)**：开启投注，倒计时广播，接受玩家单选押注；
- **`Closed` (2)**：截止下注，锁定所有注单赔率与注额；
- **`Preparing` (3)**：开闸准备，确定本期出场参数与黑马标记；
- **`Racing` (4)**：比赛开跑，马匹按动态缩放时间进行冲线，广播赛况进度；
- **`Settlement` (5)**：同事务结算所有注单、派发奖金、发放角色升级奖励并扣除手续费；
- **`Finished` (6)**：轮次归档，播报全服中奖动态，开启下一轮准备；
- **`Cancelled` (7)**：异常熔断时触发，同事务全额原路退款。

### 2. 街机经典黄金赛马 15 组连赢（二连碰 Quinella）并轨体系
- 对标经典街机黄金赛马机台（Bilibili `BV1sNMYzqE58`）与设计原型 `1.png`，在保持 6 匹马基础生态不变的同时，引入**独赢（WIN）**与**街机连赢（QUINELLA）**双玩法：
  - **预测规则**：预测获得当期第 1 名（冠军）与第 2 名（亚军）的 2 匹马，次序不限；
  - **15 组三角矩阵**：5 行 × 5 列阶梯三角结构（行 1~5，列 6, 5, 4, 3, 2），完整覆盖 $C(6, 2) = 15$ 组组合；
  - **双色识别条**：每个矩阵单元格顶部采用两匹马的对应代表色条（1白/2黑/3红/4蓝/5黄/6绿），一目了然；
  - **独立锁定赔率**：基于 Harville 联合概率模型推导，兼具热门低倍与冷门高倍（最高可达上百倍）。

### 3. 可验证公平（Provably Fair）与确定性种子
赛果绝非前端或临时随机产生，而是采用确定性哈希算法：
$$\text{Seed} = \text{SHA256}(\text{RoundNo} : \text{RoundId} : \text{AlgorithmVersion} : \text{SecretSalt})$$
- 结合各马匹历史胜率快照与综合实力评分进行加权抽签；
- 赛后公布种子哈希与盐值，允许全网第三方随时独立复算验证。

### 4. 动态完赛时间缩放算法
- 完赛时间严格根据当前轮次配置的 `RaceDurationSeconds`（如 15s / 30s / 60s）自适应计算：
  - 头马在约 90% 赛程处冲线；
  - 各名次马匹按阶梯递增并在比赛结束前 0.1s 均完成冲线；
  - 完赛先后顺序与最终名次严格保序一致。

### 5. 商城唯一资产防重购与展示控制
- 针对角色（`CHARACTER`）与装扮（`COSMETIC`），服务端严格限制单次购买数量为 1；
- 扣费前强校验玩家资产所有权，已拥有直接拒绝扣费并返回 `ALREADY_OWNED`；
- 前端商城根据玩家资产清单动态显示 **“✓ 已拥有”** 标签并禁用购买交互。

### 6. 结算驱动角色升级同事务发奖
- 结算时检测出战角色是否跨越新等级（`targetLevel > previousLevel`）；
- 同一持久化数据库事务中读取 `character_level_configs` 配置，自动补发金币及物品道具，并写入带有唯一幂等键的审计日志。

### 7. 并发与资金安全机制
- **资金高精度**：所有涉及金币、注额、赔率与手续费的字段在 C# 中均采用 `decimal`，在 PostgreSQL 中采用 `NUMERIC(18,4)`，杜绝浮点精度丢失；
- **死锁消除**：涉及多玩家行级锁操作（如邀请推荐奖励划转）时，必须按玩家 ID 升序依次获取锁（`Math.Min` / `Math.Max`）；
- **幂等防护**：所有下注、商城扣费、任务领奖与结算流水均由唯一的 `IdempotencyKey` 与数据库唯一索引强约束兜底。

---

## 七、 测试与代码质量验证

本项目拥有完备的自动化测试体系，严格保证每次变更的稳定性：

### 1. 服务端单元测试
涵盖并发扣款、幂等冲突、自适应冲线时间、连胜成就重置、密码安全、结算规则以及 15 组连赢赔率推导测试：
```bash
dotnet test Tests/RaceGame.Application.Tests/RaceGame.Application.Tests.csproj
```
**测试结果**：`86 passed, 0 failed, 0 skipped`。

### 2. 客户端静态类型检查
严格限制类型收窄，杜绝任何 `any` 侵入：
```bash
cd Client
npm run typecheck
```
**检查结果**：`tsc --noEmit` 退出码 0，无任何类型错误。

### 3. 全局解决方案构建
```bash
dotnet build RaceGame.sln
```
**构建结果**：`0 个警告，0 个错误`。

---

## 八、 相关技术与规范文档入口

- **街机连赢全新规则规范**：[Docs/02_Requirements/ARCADE_QUINELLA_RULES.md](file:///d:/project/HorseRaceGame.git/Docs/02_Requirements/ARCADE_QUINELLA_RULES.md)
- **连赢 API 与通信协议规范**：[Docs/05_API/QUINELLA_API_SPEC.md](file:///d:/project/HorseRaceGame.git/Docs/05_API/QUINELLA_API_SPEC.md)
- **产品规格与圣经**：[Docs/00_Product/PRODUCT_BIBLE_V2.0.md](file:///d:/project/HorseRaceGame.git/Docs/00_Product/PRODUCT_BIBLE_V2.0.md)
- **系统架构设计说明**：[Docs/01_Architecture/ARCHITECTURE_V2.0.md](file:///d:/project/HorseRaceGame.git/Docs/01_Architecture/ARCHITECTURE_V2.0.md)
- **数据结构与迁移契约**：[Docs/04_Data/DATA_CONTRACT_V2.0.md](file:///d:/project/HorseRaceGame.git/Docs/04_Data/DATA_CONTRACT_V2.0.md)
- **RESTful 与实时 API 契约**：[Docs/05_API/API_CONTRACT_V2.0.md](file:///d:/project/HorseRaceGame.git/Docs/05_API/API_CONTRACT_V2.0.md)
- **快速运维指南手册**：[Docs/06_Operations/QUICKSTART_GUIDE.md](file:///d:/project/HorseRaceGame.git/Docs/06_Operations/QUICKSTART_GUIDE.md)
- **发布与应急运行手册**：[Docs/06_Operations/RELEASE_RUNBOOK_V2.0.md](file:///d:/project/HorseRaceGame.git/Docs/06_Operations/RELEASE_RUNBOOK_V2.0.md)
- **客户端场景与节点规范**：[Docs/08_Client/SCENE_NODE_STRUCTURE.md](file:///d:/project/HorseRaceGame.git/Docs/08_Client/SCENE_NODE_STRUCTURE.md)
- **工程编码与安全准则**：[Docs/PROJECT_STANDARDS.md](file:///d:/project/HorseRaceGame.git/Docs/PROJECT_STANDARDS.md)

# 《西部边境赛马会》本地开发与运维操作快速指南

本指南旨在为研发工程师、测试工程师与运维管理人员提供系统的环境准备、本地联调、服务管理、参数调优与故障排障指引。

---

## 一、 开发与测试环境准备

### 1.1 依赖安装清单
- **.NET 10 SDK**：请确保执行 `dotnet --version` 输出以 `10.0` 开头；
- **Node.js (LTS 18+)**：执行 `node -v` 与 `npm -v` 验证正常；
- **PostgreSQL 16**：确保本地已安装并运行监听 `5432` 端口；
- **Redis 7**：确保本地已启动并监听 `6379` 端口；
- **Cocos Creator 3.8.8**：官方版本，用于打开并调试客户端项目。

### 1.2 数据库初始化
进入 PostgreSQL 客户端（如 `psql` 或 Navicat / DBeaver），新建数据库 `racegame`。
可选择**一键导入汇总脚本**，或**按版本迁移增量执行**：

**方式一：一键完整初始化（推荐新环境）**：
```bash
psql -U postgres -d racegame -f Database/DeployInit/all_in_one_init.sql
```

**方式二：按版本逐步迁移执行**：
```bash
psql -U postgres -d racegame -f Database/DeployInit/001_initial.sql
psql -U postgres -d racegame -f Database/DeployInit/002_upgrade_existing_schema.sql
psql -U postgres -d racegame -f Database/DeployInit/003_seed_default_race_rules.sql
psql -U postgres -d racegame -f Database/DeployInit/004_add_game_domain_logs.sql
psql -U postgres -d racegame -f Database/DeployInit/005_add_active_round_partial_index.sql
psql -U postgres -d racegame -f Database/DeployInit/006_v2_hardening.sql
psql -U postgres -d racegame -f Database/DeployInit/007_expand_daily_tasks.sql
psql -U postgres -d racegame -f Database/DeployInit/008_v2_1_features.sql
psql -U postgres -d racegame -f Database/DeployInit/009_arcade_quinella_mode.sql
```

### 1.3 默认账号一览
- **管理后台默认超级管理员**：
  - 用户名：`admin`
  - 密　码：`Admin@123456`
- **预设测试玩家**：
  - 账号：`test_player_1` ~ `test_player_6`（密码同账号或通过开发环境免密接口测试）。

---

## 二、 服务端三大核心服务启动与调试

### 2.1 启动客户端业务 API (`RaceGame.Api`)
```bash
dotnet run --project Server/RaceGame.Api/RaceGame.Api.csproj
```
- **服务监听端口**：默认 `http://localhost:5080`（或随系统自动分配）；
- **Swagger 调试页面**：`http://localhost:5080/swagger`；
- **核心职能**：接受用户鉴权、下注请求、商城购买、每日任务交互，并通过 SignalR `RaceHub` 进行全服实时广播。

### 2.2 启动常驻状态机调度器 (`RaceGame.Worker`)
```bash
dotnet run --project Server/RaceGame.Worker/RaceGame.Worker.csproj
```
- **核心职能**：通过 Redis 分布式租约锁（`lock:race:advance`）防重抢占，按照数据库状态机时序驱动比赛轮次：
  `Betting`（投注中） ➔ `Closed`（已封盘） ➔ `Preparing`（备战出闸） ➔ `Racing`（赛马开跑） ➔ `Settlement`（结算派发） ➔ `Finished`（归档并开启新一轮）。

### 2.3 启动 SaaS 运营管理后台 (`RaceGame.Admin`)
```bash
dotnet run --project Server/RaceGame.Admin/RaceGame.Admin.csproj
```
- **后台访问地址**：`http://localhost:5082`；
- **核心职能**：提供现代 SaaS 仪表盘、全平台资金流水统计、马匹图鉴管理、轮次状态审计与日志排查。

---

## 三、 客户端运行与联调

1. 打开 **Cocos Creator 3.8.8**，选择 `导入项目` 并定位到本工程的 `Client/` 目录；
2. 在资源管理器中双击 `assets/scenes/Main.scene` 打开主场景；
3. 检查 `Client/assets/scripts/ClientConfig.ts`：
   - 默认请求基础地址为 `http://localhost:5080`（或对应本地 API 端口）；
4. 点击顶部工具栏的 **运行预览** 按钮（或快捷键 `Ctrl+P`），系统将在浏览器中打开 `http://localhost:7456` 启动游戏；
5. **Cocos MCP 调试**：
   - 运行 `Tools/cocos-mcp/` 下的桥接脚本，可在开发环境中实时读取场景节点树并触发属性联动。

---

## 四、 运营管理后台核心功能使用说明

### 4.1 核心仪表盘 (Dashboard)
- **指标卡片**：实时汇总注册玩家总数、今日活跃、总比赛场次、全服下注总额与今日流水；
- **营业额双柱状图**：对比各时段下注与中奖划拨规模；
- **系统结算率圆环图**：实时呈现结算完成率与正常归档比例；
- **近 7 天平台走势**：展示流水健康度曲线；
- **名驹热榜**：前 6 匹高胜率、高出场赛马实时统计。

### 4.2 赛马图鉴管理 (Horses)
- 访问 `/Horses` 查看所有已编目赛马；
- 点击 **编辑**：可调整马匹中文/英文名称、头像/立绘资源路径、出场权重及概率；
- 点击 **启用/停用**：被停用的马匹将立即从下一轮比赛的候选抽取池中剔除，但已完赛的历史注单不受影响。

### 4.3 比赛轮次与注单追溯 (Rounds & Bets)
- 访问 `/Rounds` 查看全服历史比赛轮次、种子摘要、开奖结果与黑马标记；
- 访问 `/Bets` 查看全服注单，支持按轮次、玩家追踪锁定的固定赔率、派奖金额与手续费留存。

### 4.4 日志检索与排障 (Logs)
- 访问 `/Logs` 支持同时检索文件日志（按日期轮转的物理日志）与数据库业务审计日志；
- 支持按 `roundId` 或 `playerId` 快速定位异常注单或结算报错。

---

## 五、 常见问题排查速查手册 (FAQ)

### Q1：为什么比赛轮次停在 `Betting` 或不自动推进？
- **排查点 1**：检查 `RaceGame.Worker` 是否已正常启动并在控制台输出轮次调度心跳日志；
- **排查点 2**：检查 Redis 实例是否正常运行，Worker 需要获取 `lock:race:advance` 互斥锁才能执行状态机流转；
- **排查点 3**：检查当前轮次截止时间是否已到达系统当前 UTC 时间。

### Q2：客户端打开后提示网络断开或无法接收比赛倒计时？
- **排查点 1**：检查 `RaceGame.Api` 进程是否存活，端口是否与 `ClientConfig.ts` 一致；
- **排查点 2**：检查浏览器 F12 网络面板，确认 WebSocket 对 `http://localhost:5080/hubs/race` 的连接请求是否成功（返回 101 Switching Protocols）；
- **排查点 3**：若返回 401，说明当前测试用户的 Token 已过期，尝试重新登录或清除 localStorage 重启会话。

### Q3：执行 `dotnet test` 遇到数据库连接失败？
- 单元测试工程 `Tests/RaceGame.Application.Tests` 采用的是轻量级纯逻辑断言与状态机单元测试，不依赖外部实际物理数据库即可全部通过（77/77 Passed）。若自行编写了集成测试，请确认数据库连接字符串配置正确。

### Q4：如何调整比赛时长（例如从 30 秒改为 60 秒）？
- 在数据库表 `race_rule_configs` 中修改字段 `race_duration_seconds`；
- 修改后由 `RaceRuleConfigCache` 自动刷新或重启服务生效。新一轮比赛生成时，`RaceEngine` 会自适应基于新时长动态调整各马匹的冲线时间。

# EF Core / PostgreSQL Schema Contract

本项目 V1.4 不允许 API 启动时自动执行数据库迁移。

## 数据库连接

`Host=localhost;Port=5432;Database=postgres;Username=postgres;Password=root`

## 手动初始化顺序

1. `Database/DeployInit/001_initial.sql`
2. `Database/DeployInit/002_upgrade_existing_schema.sql`
3. `Database/DeployInit/003_seed_default_race_rules.sql`
4. `Database/DeployInit/004_add_game_domain_logs.sql`
5. `Database/DeployInit/005_add_active_round_partial_index.sql`
6. `Database/DeployInit/006_v2_hardening.sql`
7. `Database/DeployInit/007_expand_daily_tasks.sql`

## EF Core 规则

- `Server/RaceGame.Infrastructure/Persistence/AppDbContext.cs` 是 C# 实体映射契约。
- 三份 SQL 是数据库初始化/升级执行脚本。
- SQL 字段使用 PostgreSQL snake_case；EF Core 通过实体属性映射到对应字段。
- 金额统一 `NUMERIC(20,2)`，赔率/概率按实体中的 `HasPrecision` 映射。
- JSON 字段统一 PostgreSQL `JSONB`。
- 钱包余额变更事务必须使用 `WalletConcurrency.LockAsync()` 获取 `SELECT ... FOR UPDATE` 行锁。
- 本版本没有调用 `Database.Migrate()`，避免程序启动时未经人工批准修改数据库。

## V1.4 新增一致性字段

- `race_rounds.post_race_interval_seconds`
- `race_rule_configs.post_race_interval_seconds`

默认值：75 秒，使正常轮次形成 `180 + 15 + 30 + 75 = 300 秒` 的约 5 分钟周期。


## V1.5 业务日志表

- `race_logs`：仅比赛/轮次级事件和 JSON 快照。
- `horse_logs`：仅单匹马事件和 JSON 快照。
- `character_logs`：仅玩家角色资产事件和 JSON 快照。

三类日志必须保持分域，不得将角色、马匹和比赛记录混写到一个通用日志表。业务主表仍负责当前状态，日志表用于历史追溯和后台查询。

## V2.0 增量

- 脚本 006 为 `bet_orders.request_hash` 与 `shop_orders.request_hash` 增加请求指纹字段。
- 脚本 007 扩充 `daily_tasks` 为完整的 9 个每日任务（比赛场数 3/10/20、胜场 1/3/5、负场 1/3/5），完全对齐 PRD 6.10 规范。
- 数据库初始化与升级脚本统一维护在 `Database/DeployInit`（包含 001~007 脚本）。
- `AppDbContext` 的 BetOrder/ShopOrder 映射必须包含 `RequestHash`，其他实体不得映射该字段。
- 为高频轮询和排序列补齐复合索引：`player_relief_grants(status, grant_at)`、`bet_orders(round_id, status)`、`player_stats(win_rate DESC, total_rounds_won DESC)`、`wallet_transactions(player_id, id DESC)`。

## V2.1 原型对标增量

- 脚本 008 `008_v2_1_features.sql`：
  - 新增 `achievement_definitions`（功勋/成就定义表）与 `player_achievements`（玩家成就进度与领奖表，强约束幂等键）。
  - `players` 新增 `invite_code VARCHAR(16) UNIQUE` 与 `referred_by_player_id BIGINT REFERENCES players(id)`。
  - 新增 `player_referral_rewards`（邀请奖励与返佣记录表）。
  - `race_rounds` 新增 `weather VARCHAR(32)`（天气：SUNNY/RAINY/CLOUDY）与 `track_type VARCHAR(32)`（赛道材质：TURF/DIRT/SAND）。
  - `horse_catalogs` 新增 `preferred_track VARCHAR(32)` 与 `preferred_weather VARCHAR(32)`，供自适应加权。


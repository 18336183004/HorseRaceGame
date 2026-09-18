# Database DeployInit (部署初始化快照)

本目录为 Docker / 部署初始化（`deploy/docker-compose.yml` 挂载目录）所使用的 SQL 初始化快照。

- **当前状态**：包含 001~016 完整 SQL 初始化与升级脚本。
  - `001_initial.sql`：基础核心表架构（玩家、钱包、轮次、赛马、管理员等）。
  - `002_upgrade_existing_schema.sql`：增量兼容补列、商城、装扮、任务领奖与审计日志表。
  - `003_seed_default_race_rules.sql`：丰富种子数据（12匹赛马、5位骑手、11件装扮、8类道具、14款商品、9项任务、5篇公告、8场历史赛果与账单流水）。
  - `004_add_game_domain_logs.sql`：分域日志表（比赛、马匹、角色日志）。
  - `005_add_active_round_partial_index.sql`：单活动轮次部分唯一索引硬性防并发。
  - `006_v2_hardening.sql`：V2.0 幂等指纹 `request_hash` 与历史默认凭据注销。
  - `007_expand_daily_tasks.sql`：完整 9 项每日任务对齐（场次 3/10/20、胜场 1/3/5、负场 1/3/5）。
  - `008_v2_1_features.sql`：V2.1 社交邀请裂变返佣、成就勋章系统与赛场天气偏好。
  - `009_arcade_quinella_mode.sql`：经典街机连赢（Quinella 15组矩阵组合）玩法支持（`bet_orders` 扩展 `play_type`/`second_horse_no`/`combination`，`race_rounds` 扩展 `second_horse_no`/`quinella_odds_snapshot_json` 及复合索引）。
  - `010_remove_selection_conflict.sql`：规则决策放开选马限制（将 `race_bet_selections` 唯一约束由 `(player_id, round_id)` 升级为 `(player_id, round_id, horse_no)`，允许多马投注与跨玩法同投）。
  - `011_p0_business_and_referral_enhancements.sql`：命中连胜 (Hit Streak) 与盈利胜局 (Net Profit Win) 细分、下级负盈利返佣 (0.2% + 规费比例) 与未结佣金提炼支持。
  - `012_pari_mutuel_maintenance_and_fairness.sql`：浮动彩池 (Pari-Mutuel) 稀释因子、停服维护时间窗口、退款关联流水与千分之10~百分之2规费阶梯。
  - `013_gameplay_expansion_and_parameters.sql`：模式一专属马房与出赛分红、全服超级大奖池、局内冲刺加倍、Photo Finish绝杀与动态台本解说。
  - `014_wallet_frozen_balance.sql`：钱包冻结资金 `frozen_balance` 字段支撑拍卖竞价原子锁资。
  - `015_ranch_mode_core_schema.sql`：模式三西部纯血马房养成（五维与潜能、装备槽、投喂/训练/考核/巡回赛/繁育/拍卖/契约表与装备种子数据）。
  - `016_dynamic_race_and_horse_configs.sql`：动态赛事与马匹配置扩展（赛场环境、解说/荐马模板、马房幼驹/饲料/训练/护理目录），并为 `race_rule_configs` 增加动态赔率、Photo Finish 概率、场次马数、评分权重、资格赛门槛、系统回收等 14 个配置列。
- **一键合并脚本**：
  - `all_in_one_init.sql`：已将 001~016 全部脚本顺序合并为统一的幂等单文件，支持客户端/工具（Navicat、DBeaver、pgAdmin 或 psql）一键导入，已在 PostgreSQL 实机通过全量与重复执行测试验证。
- **架构事实源（Source of Truth）**：作为数据库初始化的唯一定义源，单步按 001~016 顺序执行，或直接一键执行 `all_in_one_init.sql`。
- **生产发布说明**：后续切到正式生产环境前，可按需生成剔除测试玩家和固定管理员凭据的独立发布镜像。

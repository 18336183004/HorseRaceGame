# RaceGame 数据与迁移合同 V2.0

## 1. 迁移顺序

`001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010 → 011`

- `001~005`：基线结构与规则种子；
- `006_v2_hardening.sql`：幂等请求指纹与安全加固；
- `007_expand_daily_tasks.sql`：补齐 PRD 6.10 规定的 9 个完整每日任务（场次 3/10/20、胜场 1/3/5、负场 1/3/5）；
- `008_v2_1_features.sql`：社交邀请裂变返佣、成就勋章系统与赛场天气偏好；
- `009_arcade_quinella_mode.sql`：经典街机连赢（Quinella 15组矩阵组合）玩法数据扩展与复合索引；
- `010_remove_selection_conflict.sql`：放开下注限制，升级 `race_bet_selections` 唯一约束为 `(player_id, round_id, horse_no)`；
- `011_p0_business_and_referral_enhancements.sql`：战绩命中连胜与净盈利胜局细分、下级负盈利返佣 (0.2% + 手续费率) 与佣金主动提炼支持。

已发布迁移不得修改，只能追加新迁移。

## 2. 核心一致性

- `race_rounds`：轮次事实源（含冠亚军马号与连赢赔率快照）；
- `race_horses`：当轮 6 马快照；
- `race_bet_selections`：玩家每轮选马明细（支持同轮多马投注与跨玩法组合）；
- `bet_orders`：每笔下注及锁定赔率（支持 WIN 独赢与 QUINELLA 连赢）；
- `wallets`：当前余额；
- `wallet_transactions`：不可变流水；
- `race_settlement_runs`：结算执行审计；
- `bet_order_settlement_logs`：订单结算快照（含 `WIN` 与 `WIN_JACKPOT` 爆机标识）。

## 3. 新增幂等请求指纹

V2.0 为下注和商城订单增加 `request_hash`。同一幂等键重试必须携带同一业务参数；参数不同直接拒绝，防止客户端错误复用幂等键导致错误订单被静默接受。

## 4. 备份与恢复

生产部署前必须验证：

1. PostgreSQL 全库备份；
2. 恢复到临时实例；
3. 执行最新迁移；
4. API 只读健康检查；
5. 抽样验证钱包流水、订单、轮次和结算。

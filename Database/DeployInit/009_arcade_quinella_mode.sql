-- ============================================================================
-- Migration: 009_arcade_quinella_mode.sql
-- Description: 经典街机黄金赛马（二连碰/连赢 Quinella 15组矩阵组合）玩法支持：
--              1. bet_orders 扩展 play_type (WIN/QUINELLA), second_horse_no, combination
--              2. race_rounds 扩展 second_horse_no (亚军马号), quinella_odds_snapshot_json (15组组合赔率快照)
--              3. 针对新玩法添加复合索引与数据约束
-- ============================================================================

-- 1. 扩展投注订单表：增加玩法类型、第二匹马号与组合代码
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS play_type VARCHAR(32) NOT NULL DEFAULT 'WIN';
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS second_horse_no INT;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS combination VARCHAR(16);

-- 复合索引提升轮次结算与玩法统计性能
CREATE INDEX IF NOT EXISTS idx_bet_orders_round_play_type ON bet_orders(round_id, play_type);
CREATE INDEX IF NOT EXISTS idx_bet_orders_combination ON bet_orders(combination) WHERE combination IS NOT NULL;

-- 2. 扩展比赛轮次表：增加亚军马号与 15 组连赢赔率快照
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS second_horse_no INT;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS quinella_odds_snapshot_json JSONB;

-- 3. 历史数据补齐：原有订单默认为单马独赢 WIN
UPDATE bet_orders 
SET play_type = 'WIN' 
WHERE play_type IS NULL OR play_type = '';

COMMENT ON COLUMN bet_orders.play_type IS '玩法类型：WIN (单马独赢) / QUINELLA (街机连赢组合)';
COMMENT ON COLUMN bet_orders.second_horse_no IS '连赢模式下第二匹马号 (1~6)';
COMMENT ON COLUMN bet_orders.combination IS '连赢标准组合键 (例如: 1-2, 2-4, 5-6)';
COMMENT ON COLUMN race_rounds.second_horse_no IS '本轮获得第 2 名的赛马编号 (1~6)';
COMMENT ON COLUMN race_rounds.quinella_odds_snapshot_json IS '本轮 15 组连赢组合赔率快照 JSONB';

-- ============================================================================
-- Migration: 010_remove_selection_conflict.sql
-- Description: 规则决策放开下注限制：
--              1. 玩家在同一轮次中允许对多匹马或多个连赢组合进行投注
--              2. 将 race_bet_selections 唯一约束由 (player_id, round_id) 
--                 升级为 (player_id, round_id, horse_no)，允许多马投注记录
-- ============================================================================

ALTER TABLE race_bet_selections DROP CONSTRAINT IF EXISTS uq_race_bet_selections;
ALTER TABLE race_bet_selections ADD CONSTRAINT uq_race_bet_selections UNIQUE (player_id, round_id, horse_no);

COMMENT ON TABLE race_bet_selections IS '玩家每轮选马记录表：同一轮允许多马投注，记录玩家选马明细。';

-- ============================================================================
-- Migration: 011_p0_business_and_referral_enhancements.sql
-- Description: P0 交互闭环与五大业务决策落地支持：
--              1. player_stats 细分命中连胜 (Hit Streak) 与盈利胜局 (Net Profit Win)
--              2. player_referral_rewards 增加下级负盈利抽成、未结佣金与主动提炼支持
-- ============================================================================

-- 1. player_stats 战绩表扩展细分字段
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS total_net_profit_wins BIGINT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_hit_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS max_hit_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_profit_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS max_profit_streak INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN player_stats.total_net_profit_wins IS '盈利胜局总数：整轮所有注单净收益总额 > 总投注额的局数';
COMMENT ON COLUMN player_stats.current_hit_streak IS '当前命中连胜次数：只要任意单中奖即持续递增，不中则清零';
COMMENT ON COLUMN player_stats.max_hit_streak IS '历史最高命中连胜纪录';
COMMENT ON COLUMN player_stats.current_profit_streak IS '当前净盈利连胜次数：当局净收益 > 投注额时递增，否则清零';
COMMENT ON COLUMN player_stats.max_profit_streak IS '历史最高净盈利连胜纪录';

-- 2. player_referral_rewards 社交返佣表扩展
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS round_id BIGINT REFERENCES race_rounds(id) ON DELETE SET NULL;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS net_loss_amount NUMERIC(20, 2) NOT NULL DEFAULT 0;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(10, 6) NOT NULL DEFAULT 0;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS claim_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_player_referral_rewards_claim ON player_referral_rewards(referrer_player_id, status) WHERE status = 'UNCLAIMED';

COMMENT ON COLUMN player_referral_rewards.round_id IS '产生返佣的比赛轮次 ID';
COMMENT ON COLUMN player_referral_rewards.net_loss_amount IS '下级玩家在当轮产生的净亏损金额（负盈利基数）';
COMMENT ON COLUMN player_referral_rewards.commission_rate IS '本次返佣综合比例（固定 0.2% + 当轮手续费率）';
COMMENT ON COLUMN player_referral_rewards.claimed_at IS '推荐人主动提炼领取佣金的时间';
COMMENT ON COLUMN player_referral_rewards.claim_transaction_id IS '领取佣金时对应的钱包充值流水 ID';

-- ============================================================================
-- Migration: 013_gameplay_expansion_and_parameters.sql
-- Description: 赛马玩法拓展与关键控制节点参数数据库化驱动：
--              1. race_rule_configs 扩展关键节点控制参数（Photo Finish慢动作、全服奖池、局内冲刺加倍、解说与早报开关等）
--              2. 新增全服超级累积大奖池表 jackpot_pools 与爆奖历史表 jackpot_drop_logs
--              3. 新增玩家专属马房表 player_horse_stables 与出赛分红表 horse_dividends
--              4. bet_orders 扩展第三马号、局内冲刺加倍标记与追加金额
--              5. race_rounds 扩展鼻尖绝杀标记、时间差、动态解说台本与爆奖标记
--              6. 插入/更新默认规则配置与初始全服奖池种子数据 (100,000.00 COIN)
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. race_rule_configs 扩展关键控制节点参数（全部由数据库配置驱动，便于后续无缝微调）
-- ----------------------------------------------------------------------------
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS photo_finish_threshold_seconds NUMERIC(6, 4) NOT NULL DEFAULT 0.1800;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_pool_code VARCHAR(32) NOT NULL DEFAULT 'MEGA_COIN_POOL';
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_contribution_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0150;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_seed_amount NUMERIC(18, 2) NOT NULL DEFAULT 100000.00;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_winner_share_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.7000;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_rain_share_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.3000;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_rain_min_bet_amount NUMERIC(18, 2) NOT NULL DEFAULT 50.00;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS photo_finish_lead_seconds NUMERIC(4, 2) NOT NULL DEFAULT 3.00;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS jackpot_min_trigger_odds NUMERIC(10, 2) NOT NULL DEFAULT 500.00;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS in_play_window_start_second INT NOT NULL DEFAULT 15;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS in_play_window_duration_seconds INT NOT NULL DEFAULT 3;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS in_play_boost_profit_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.5000;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS is_commentary_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS is_tipster_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS is_ready_skip_enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS ready_skip_remaining_seconds INT NOT NULL DEFAULT 10;

COMMENT ON COLUMN race_rule_configs.photo_finish_threshold_seconds IS '冲线冠亚军微差绝杀阈值（秒，小于等于该值触发 Photo Finish 慢动作）';
COMMENT ON COLUMN race_rule_configs.jackpot_pool_code IS '关联的全服累积大奖池代码标识';
COMMENT ON COLUMN race_rule_configs.jackpot_contribution_rate IS '每笔有效下注注入全服累积大奖池的抽水比例（如 0.0150 代表 1.5%）';
COMMENT ON COLUMN race_rule_configs.jackpot_seed_amount IS '全服大奖池保底种子启动金额';
COMMENT ON COLUMN race_rule_configs.jackpot_winner_share_rate IS '大奖爆出时中奖者瓜分比例（如 0.7000 代表 70%）';
COMMENT ON COLUMN race_rule_configs.jackpot_rain_share_rate IS '大奖爆出时全服在线下注玩家普天同庆平分比例（如 0.3000 代表 30%）';
COMMENT ON COLUMN race_rule_configs.jackpot_rain_min_bet_amount IS '参与全服超级大奖彩金雨分红的当轮最低累计投注金额门槛（默认 50.00 币）';
COMMENT ON COLUMN race_rule_configs.photo_finish_lead_seconds IS '冲线微距绝杀 Photo Finish 慢动作提前触发的提前量（秒，默认 3.0 秒）';
COMMENT ON COLUMN race_rule_configs.jackpot_min_trigger_odds IS '触发冷门爆大奖的最低组合锁定赔率门槛（如 500.00）';
COMMENT ON COLUMN race_rule_configs.in_play_window_start_second IS '比赛中途开放冲刺加倍追投的起始秒数（第 15 秒）';
COMMENT ON COLUMN race_rule_configs.in_play_window_duration_seconds IS '比赛中途冲刺加倍追投的有效时间窗口长度（秒，默认 3 秒）';
COMMENT ON COLUMN race_rule_configs.in_play_boost_profit_rate IS '冲刺加倍注单获胜后额外加赠的净利润比例（默认 0.5000 即 +50%）';
COMMENT ON COLUMN race_rule_configs.is_commentary_enabled IS '是否启用比赛过程中的动态解说字幕与语音广播';
COMMENT ON COLUMN race_rule_configs.is_tipster_enabled IS '是否在下注期开启赛前情报观察室与专家推荐早报';
COMMENT ON COLUMN race_rule_configs.is_ready_skip_enabled IS '是否开启全员准备完毕提前开赛机制';
COMMENT ON COLUMN race_rule_configs.ready_skip_remaining_seconds IS '提前开赛机制触发后倒计时缩减至的剩余秒数（默认 10 秒）';

-- ----------------------------------------------------------------------------
-- 2. 新增全服超级累积大奖池表 jackpot_pools 与大奖爆奖记录表 jackpot_drop_logs
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS jackpot_pools (
    id BIGSERIAL PRIMARY KEY,
    pool_code VARCHAR(32) NOT NULL UNIQUE,
    current_amount NUMERIC(18, 2) NOT NULL DEFAULT 100000.00,
    seed_amount NUMERIC(18, 2) NOT NULL DEFAULT 100000.00,
    tax_rate NUMERIC(6, 4) NOT NULL DEFAULT 0.0150,
    total_paid_out NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    last_dropped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON TABLE jackpot_pools IS '全服累积超级大奖池';
COMMENT ON COLUMN jackpot_pools.pool_code IS '奖池代码标识';
COMMENT ON COLUMN jackpot_pools.current_amount IS '当前奖池实时累积金币总额';
COMMENT ON COLUMN jackpot_pools.seed_amount IS '奖池保底金额';
COMMENT ON COLUMN jackpot_pools.tax_rate IS '投注额注入奖池比例';
COMMENT ON COLUMN jackpot_pools.total_paid_out IS '历史上累计已发放的大奖总额';

CREATE TABLE IF NOT EXISTS jackpot_drop_logs (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id),
    pool_code VARCHAR(32) NOT NULL,
    total_drop_amount NUMERIC(18, 2) NOT NULL,
    winner_share_amount NUMERIC(18, 2) NOT NULL,
    rain_share_amount NUMERIC(18, 2) NOT NULL,
    trigger_reason VARCHAR(64) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jackpot_drop_logs_round_id ON jackpot_drop_logs(round_id);

-- ----------------------------------------------------------------------------
-- 3. 新增玩家专属马房表 player_horse_stables 与出赛分红明细表 horse_dividends
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS player_horse_stables (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id),
    horse_catalog_id BIGINT NOT NULL REFERENCES horse_catalogs(id),
    custom_name VARCHAR(64),
    condition_level INT NOT NULL DEFAULT 100,
    care_count_today INT NOT NULL DEFAULT 0,
    total_career_races INT NOT NULL DEFAULT 0,
    total_career_wins INT NOT NULL DEFAULT 0,
    accumulated_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    adopted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_player_horse UNIQUE (player_id, horse_catalog_id)
);

COMMENT ON TABLE player_horse_stables IS '玩家专属马房认领与养成状态表';

CREATE TABLE IF NOT EXISTS horse_dividends (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id),
    horse_catalog_id BIGINT NOT NULL REFERENCES horse_catalogs(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    dividend_amount NUMERIC(18, 2) NOT NULL,
    claimed BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_horse_dividends_player_claimed ON horse_dividends(player_id, claimed);

-- ----------------------------------------------------------------------------
-- 4. 扩展注单表 bet_orders（支持三选注式、局内冲刺加倍追投）
-- ----------------------------------------------------------------------------
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS third_horse_no INT DEFAULT NULL;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS is_double_down BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS double_down_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN bet_orders.third_horse_no IS '三重彩或三连碰模式下的第三匹马号';
COMMENT ON COLUMN bet_orders.is_double_down IS '是否在开赛第 15 秒触发冲刺加倍追投';
COMMENT ON COLUMN bet_orders.double_down_amount IS '冲刺加倍追投追加扣除的金额';

-- ----------------------------------------------------------------------------
-- 5. 扩展比赛轮次表 race_rounds（鼻尖绝杀判定、动态解说台本与爆奖状态）
-- ----------------------------------------------------------------------------
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS is_photo_finish BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS photo_finish_gap_seconds NUMERIC(6, 4) DEFAULT NULL;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS commentary_script_json JSONB DEFAULT NULL;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS jackpot_dropped BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS jackpot_drop_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN race_rounds.is_photo_finish IS '本轮冲线是否触发了冠亚军鼻尖微距绝杀 (Photo Finish)';
COMMENT ON COLUMN race_rounds.photo_finish_gap_seconds IS '第一名与第二名完赛时间差（秒）';
COMMENT ON COLUMN race_rounds.commentary_script_json IS '服务端生成的本轮结构化赛况解说台本文本 JSONB';
COMMENT ON COLUMN race_rounds.jackpot_dropped IS '本轮是否触发了全服超级大爆奖';
COMMENT ON COLUMN race_rounds.jackpot_drop_amount IS '本轮爆出的全服超级大奖总金额';

-- ----------------------------------------------------------------------------
-- 6. 初始种子数据注入与规则参数对齐
-- ----------------------------------------------------------------------------
-- 6.1 初始化全服超级大奖池种子记录（如果不存在则插入，存在则保证代码一致）
INSERT INTO jackpot_pools (pool_code, current_amount, seed_amount, tax_rate, total_paid_out, updated_at)
VALUES ('MEGA_COIN_POOL', 100000.00, 100000.00, 0.0150, 0.00, NOW())
ON CONFLICT (pool_code) DO NOTHING;

-- 6.2 同步更新默认规则配置中的关键节点控制参数
UPDATE race_rule_configs
SET photo_finish_threshold_seconds = 0.1800,
    jackpot_pool_code = 'MEGA_COIN_POOL',
    jackpot_contribution_rate = 0.0150,
    jackpot_seed_amount = 100000.00,
    jackpot_winner_share_rate = 0.7000,
    jackpot_rain_share_rate = 0.3000,
    jackpot_rain_min_bet_amount = 50.00,
    photo_finish_lead_seconds = 3.00,
    jackpot_min_trigger_odds = 500.00,
    in_play_window_start_second = 15,
    in_play_window_duration_seconds = 3,
    in_play_boost_profit_rate = 0.5000,
    is_commentary_enabled = TRUE,
    is_tipster_enabled = TRUE,
    is_ready_skip_enabled = TRUE,
    ready_skip_remaining_seconds = 10,
    updated_at = NOW()
WHERE config_code IN ('default', 'DEFAULT_RULES');

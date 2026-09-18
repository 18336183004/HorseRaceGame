-- ============================================================================
-- Migration: 008_v2_1_features.sql
-- Description: V2.1 原型深度对标升级：
--              1. 功勋/成就系统 (achievement_definitions, player_achievements)
--              2. 社交邀请与裂变返佣 (invite_code, referred_by, player_referral_rewards)
--              3. 赛场环境与马匹偏好 (weather, track_type, preferred_track, preferred_weather)
-- ============================================================================

-- 1. 成就定义表
CREATE TABLE IF NOT EXISTS achievement_definitions (
    id BIGSERIAL PRIMARY KEY,
    achievement_code VARCHAR(64) NOT NULL,
    category VARCHAR(32) NOT NULL DEFAULT 'CAREER',
    title_zh VARCHAR(128) NOT NULL,
    title_en VARCHAR(128) NOT NULL,
    description_zh VARCHAR(256) NOT NULL,
    description_en VARCHAR(256) NOT NULL,
    icon_asset VARCHAR(256),
    badge_name VARCHAR(64),
    target_value BIGINT NOT NULL DEFAULT 1,
    reward_type VARCHAR(32) NOT NULL DEFAULT 'COIN',
    reward_payload JSONB NOT NULL DEFAULT '{}'::JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_achievement_definitions_code UNIQUE (achievement_code)
);

-- 2. 玩家成就进度表
CREATE TABLE IF NOT EXISTS player_achievements (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    achievement_id BIGINT NOT NULL REFERENCES achievement_definitions(id) ON DELETE CASCADE,
    current_progress BIGINT NOT NULL DEFAULT 0,
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    is_claimed BOOLEAN NOT NULL DEFAULT FALSE,
    claimed_at TIMESTAMPTZ,
    wallet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_achievements_player_achievement UNIQUE (player_id, achievement_id),
    CONSTRAINT uq_player_achievements_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_player_achievements_player ON player_achievements(player_id);

-- 3. 玩家邀请码与推荐人
ALTER TABLE players ADD COLUMN IF NOT EXISTS invite_code VARCHAR(16);
ALTER TABLE players ADD COLUMN IF NOT EXISTS referred_by_player_id BIGINT REFERENCES players(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_players_invite_code ON players(invite_code);

-- 为已有玩家补齐默认邀请码
UPDATE players 
SET invite_code = 'RG' || LPAD(id::text, 6, '0') 
WHERE invite_code IS NULL;

-- 4. 邀请奖励与返佣表
CREATE TABLE IF NOT EXISTS player_referral_rewards (
    id BIGSERIAL PRIMARY KEY,
    referrer_player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    invited_player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    reward_type VARCHAR(32) NOT NULL DEFAULT 'STARTER_INVITE',
    amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    status VARCHAR(32) NOT NULL DEFAULT 'GRANTED',
    wallet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_referral_rewards_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_player_referral_rewards_referrer ON player_referral_rewards(referrer_player_id, created_at DESC);

-- 5. 轮次天气与赛道环境
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS weather VARCHAR(32) DEFAULT 'SUNNY';
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS track_type VARCHAR(32) DEFAULT 'TURF';

-- 6. 马匹环境偏好
ALTER TABLE horse_catalogs ADD COLUMN IF NOT EXISTS preferred_track VARCHAR(32) DEFAULT 'TURF';
ALTER TABLE horse_catalogs ADD COLUMN IF NOT EXISTS preferred_weather VARCHAR(32) DEFAULT 'SUNNY';

-- 更新预置马匹偏好
UPDATE horse_catalogs SET preferred_track = 'TURF', preferred_weather = 'SUNNY' WHERE id IN (1, 4, 7, 10);
UPDATE horse_catalogs SET preferred_track = 'DIRT', preferred_weather = 'RAINY' WHERE id IN (2, 5, 9, 12);
UPDATE horse_catalogs SET preferred_track = 'SAND', preferred_weather = 'CLOUDY' WHERE id IN (3, 6, 8, 11);

-- 7. 预置 10 个核心成就 (对标 1.png Feat 页面)
INSERT INTO achievement_definitions (
    achievement_code, category, title_zh, title_en, description_zh, description_en,
    badge_name, target_value, reward_type, reward_payload, sort_order, is_enabled
) VALUES
    ('ACHV_CAREER_1', 'CAREER', '初试锋芒', 'First Gallop', '累计参与结算 1 场赛马。', 'Participate in and settle 1 race.', '新手马蹄', 1, 'COIN', '{"amount":100}'::JSONB, 10, TRUE),
    ('ACHV_CAREER_10', 'CAREER', '赛道常客', 'Track Regular', '累计参与结算 10 场赛马。', 'Participate in and settle 10 races.', '青铜骑标', 10, 'COIN', '{"amount":300}'::JSONB, 20, TRUE),
    ('ACHV_CAREER_50', 'CAREER', '百步穿杨', 'Seasoned Jockey', '累计参与结算 50 场赛马。', 'Participate in and settle 50 races.', '白银马鞍', 50, 'COIN', '{"amount":1000}'::JSONB, 30, TRUE),
    ('ACHV_CAREER_100', 'CAREER', '百战名骑', 'Century Champion', '累计参与结算 100 场赛马。', 'Participate in and settle 100 races.', '黄金马鞭', 100, 'COIN', '{"amount":2500}'::JSONB, 40, TRUE),
    ('ACHV_WIN_1', 'WIN', '首开得胜', 'First Victory', '首次在比赛中押中冠军马匹。', 'Win your first race bet.', '胜利马蹄', 1, 'COIN', '{"amount":200}'::JSONB, 50, TRUE),
    ('ACHV_WIN_10', 'WIN', '凯旋骑士', 'Triumphant Rider', '累计押中 10 次冠军马匹。', 'Win 10 race bets.', '荣耀勋章', 10, 'COIN', '{"amount":800}'::JSONB, 60, TRUE),
    ('ACHV_WIN_50', 'WIN', '传奇伯乐', 'Legendary Selector', '累计押中 50 次冠军马匹。', 'Win 50 race bets.', '传奇桂冠', 50, 'COIN', '{"amount":3000}'::JSONB, 70, TRUE),
    ('ACHV_BLACK_HORSE_1', 'BLACK_HORSE', '独具慧眼', 'Eagle Eye', '首次命中大赔率黑马并夺冠。', 'Hit a winning black horse.', '黑曜石勋章', 1, 'COIN', '{"amount":500}'::JSONB, 80, TRUE),
    ('ACHV_BLACK_HORSE_3', 'BLACK_HORSE', '黑马克星', 'Dark Horse Master', '累计 3 次命中大赔率黑马夺冠。', 'Hit winning black horses 3 times.', '暗夜征服者', 3, 'COIN', '{"amount":1500}'::JSONB, 90, TRUE),
    ('ACHV_STREAK_3', 'STREAK', '连胜王者', 'Winning Streak', '连续 3 轮押中冠军马匹。', 'Win 3 race bets consecutively.', '炽烈三连胜', 3, 'COIN', '{"amount":1000}'::JSONB, 100, TRUE)
ON CONFLICT (achievement_code) DO UPDATE SET
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    badge_name = EXCLUDED.badge_name,
    target_value = EXCLUDED.target_value,
    reward_type = EXCLUDED.reward_type,
    reward_payload = EXCLUDED.reward_payload,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    updated_at = NOW();

COMMENT ON TABLE achievement_definitions IS '功勋/成就定义表：对标 1.png Feat 页面。';
COMMENT ON TABLE player_achievements IS '玩家成就达成进度与领奖表。';
COMMENT ON TABLE player_referral_rewards IS '好友邀请与社交裂变返佣表。';

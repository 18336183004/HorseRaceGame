-- =========================================================
-- RaceGame V1.5：比赛 / 马匹 / 角色分域日志
-- =========================================================
-- 设计原则：
-- 1. race_logs 只保存比赛级事件与轮次快照。
-- 2. horse_logs 只保存单匹马生命周期事件。
-- 3. character_logs 只保存玩家角色资产变化。
-- 4. 明细使用 JSONB 保存当时输入/输出快照，当前状态仍以业务表为准。
-- 5. 不修改已经发布的 001/002/003，直接执行本迁移即可。
-- =========================================================

CREATE TABLE IF NOT EXISTS race_logs (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    round_no VARCHAR(32) NOT NULL,
    event_type VARCHAR(64) NOT NULL,
    state INT NOT NULL,
    execution_status VARCHAR(32) NOT NULL,
    request_id VARCHAR(128),
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_race_logs_event_type_not_blank CHECK (BTRIM(event_type) <> ''),
    CONSTRAINT ck_race_logs_execution_status_not_blank CHECK (BTRIM(execution_status) <> '')
);

CREATE INDEX IF NOT EXISTS idx_race_logs_round_created_at
    ON race_logs(round_id, created_at);

CREATE INDEX IF NOT EXISTS idx_race_logs_event_created_at
    ON race_logs(event_type, created_at);

CREATE TABLE IF NOT EXISTS horse_logs (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    race_horse_id BIGINT REFERENCES race_horses(id) ON DELETE SET NULL,
    horse_template_id BIGINT NOT NULL REFERENCES horse_catalogs(id) ON DELETE RESTRICT,
    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    event_type VARCHAR(64) NOT NULL,
    execution_status VARCHAR(32) NOT NULL,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_horse_logs_event_type_not_blank CHECK (BTRIM(event_type) <> ''),
    CONSTRAINT ck_horse_logs_execution_status_not_blank CHECK (BTRIM(execution_status) <> '')
);

CREATE INDEX IF NOT EXISTS idx_horse_logs_round_horse_created_at
    ON horse_logs(round_id, horse_no, created_at);

CREATE INDEX IF NOT EXISTS idx_horse_logs_template_created_at
    ON horse_logs(horse_template_id, created_at);

CREATE TABLE IF NOT EXISTS character_logs (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    character_id BIGINT NOT NULL REFERENCES character_catalogs(id) ON DELETE RESTRICT,
    player_character_id BIGINT REFERENCES player_characters(id) ON DELETE SET NULL,
    event_type VARCHAR(64) NOT NULL,
    execution_status VARCHAR(32) NOT NULL,
    payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_character_logs_event_type_not_blank CHECK (BTRIM(event_type) <> ''),
    CONSTRAINT ck_character_logs_execution_status_not_blank CHECK (BTRIM(execution_status) <> '')
);

CREATE INDEX IF NOT EXISTS idx_character_logs_player_created_at
    ON character_logs(player_id, created_at);

CREATE INDEX IF NOT EXISTS idx_character_logs_character_created_at
    ON character_logs(character_id, created_at);

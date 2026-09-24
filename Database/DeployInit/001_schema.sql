-- ============================================================================
-- Migration: 001_schema.sql
-- Description: RaceGame 全量 74 表结构定义、主外键引用、枚举约束与全量业务索引
-- 整合原 001~016 所有 DDL，无历史增量 ALTER TABLE 补丁，开箱即用
-- ============================================================================

-- 目标数据库：postgres（PostgreSQL 默认维护数据库）
-- 本脚本不会 CREATE DATABASE，也不会要求数据库名为 racegame。
-- 请在 PostgreSQL 的 postgres 数据库中按 001 -> 002 -> 003 顺序执行。

-- RaceGame baseline initialization schema
--
-- 说明：
-- 1. 本脚本按“新的初始化基线”整理，兼顾当前代码已使用的表名/核心字段。
-- 2. 已补充 PRD / 实施方案中明确需要持久化、但原脚本缺失的配置、商城订单、任务领奖、装扮、权限与审计相关表。
-- 3. 对于已经被其他环境共享的数据库，不建议直接覆盖历史；应拆分为后续增量迁移。这里按当前用户要求刷新初始化脚本。

BEGIN;

-- =========================================================
-- 账号、玩家与认证
-- =========================================================

CREATE TABLE IF NOT EXISTS players (
    id BIGSERIAL PRIMARY KEY,
    account_id VARCHAR(64) NOT NULL,
    account_normalized VARCHAR(64) NOT NULL,
    nickname VARCHAR(64) NOT NULL DEFAULT 'Player',
    avatar_asset VARCHAR(256),
    locale VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    exp BIGINT NOT NULL DEFAULT 0 CHECK (exp >= 0),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    invite_code VARCHAR(16) UNIQUE,
    referred_by_player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_players_account_id UNIQUE (account_id),
    CONSTRAINT uq_players_account_normalized UNIQUE (account_normalized),
    CONSTRAINT ck_players_account_id_not_blank CHECK (BTRIM(account_id) <> ''),
    CONSTRAINT ck_players_account_normalized_not_blank CHECK (BTRIM(account_normalized) <> ''),
    CONSTRAINT ck_players_nickname_not_blank CHECK (BTRIM(nickname) <> '')
);

CREATE TABLE IF NOT EXISTS player_credentials (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    password_hash VARCHAR(512) NOT NULL,
    password_algorithm VARCHAR(32) NOT NULL,
    password_version INT NOT NULL DEFAULT 1 CHECK (password_version >= 1),
    failed_login_count INT NOT NULL DEFAULT 0 CHECK (failed_login_count >= 0),
    locked_until TIMESTAMPTZ,
    last_password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_credentials_player_id UNIQUE (player_id),
    CONSTRAINT ck_player_credentials_password_hash_not_blank CHECK (BTRIM(password_hash) <> ''),
    CONSTRAINT ck_player_credentials_password_algorithm_not_blank CHECK (BTRIM(password_algorithm) <> '')
);

CREATE TABLE IF NOT EXISTS player_sessions (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(256) NOT NULL,
    access_token_jti VARCHAR(128),
    client_platform VARCHAR(32) NOT NULL,
    client_version VARCHAR(32),
    device_id VARCHAR(128),
    client_ip VARCHAR(64),
    user_agent VARCHAR(512),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(64),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
    CONSTRAINT uq_player_sessions_access_token_jti UNIQUE (access_token_jti),
    CONSTRAINT ck_player_sessions_client_platform_not_blank CHECK (BTRIM(client_platform) <> ''),
    CONSTRAINT ck_player_sessions_expiry CHECK (expires_at > issued_at)
);

CREATE TABLE IF NOT EXISTS player_settings (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    language VARCHAR(16) NOT NULL DEFAULT 'zh-CN',
    time_zone VARCHAR(64) NOT NULL DEFAULT 'Europe/London',
    allow_push_notice BOOLEAN NOT NULL DEFAULT TRUE,
    allow_result_animation BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_settings_player_id UNIQUE (player_id)
);

CREATE TABLE IF NOT EXISTS player_auth_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
    account_normalized VARCHAR(64),
    action_type VARCHAR(32) NOT NULL,
    outcome VARCHAR(32) NOT NULL,
    failure_code VARCHAR(64),
    request_id VARCHAR(128),
    client_ip VARCHAR(64),
    user_agent VARCHAR(512),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_player_auth_audit_logs_action_type_not_blank CHECK (BTRIM(action_type) <> ''),
    CONSTRAINT ck_player_auth_audit_logs_outcome_not_blank CHECK (BTRIM(outcome) <> '')
);

-- =========================================================
-- 钱包、流水与运营调账
-- =========================================================

CREATE TABLE IF NOT EXISTS wallets (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    balance NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    frozen_balance NUMERIC(20,2) NOT NULL DEFAULT 0.00 CHECK (frozen_balance >= 0),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallets_player_id UNIQUE (player_id)
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    transaction_type VARCHAR(32) NOT NULL,
    amount NUMERIC(20,2) NOT NULL,
    balance_before NUMERIC(20,2) NOT NULL CHECK (balance_before >= 0),
    balance_after NUMERIC(20,2) NOT NULL CHECK (balance_after >= 0),
    fee_rate NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (fee_rate >= 0 AND fee_rate <= 1),
    fee_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    reference_type VARCHAR(32),
    reference_id VARCHAR(128),
    request_id VARCHAR(128),
    operator_admin_user_id BIGINT,
    idempotency_key VARCHAR(128),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallet_transactions_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_wallet_transactions_transaction_type_not_blank CHECK (BTRIM(transaction_type) <> '')
);

-- =========================================================
-- 后台管理、权限与审计
-- =========================================================

CREATE TABLE IF NOT EXISTS admin_users (
    id BIGSERIAL PRIMARY KEY,
    username VARCHAR(64) NOT NULL,
    username_normalized VARCHAR(64) NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    password_algorithm VARCHAR(32) NOT NULL,
    password_version INT NOT NULL DEFAULT 1 CHECK (password_version >= 1),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_users_username UNIQUE (username),
    CONSTRAINT uq_admin_users_username_normalized UNIQUE (username_normalized),
    CONSTRAINT ck_admin_users_username_not_blank CHECK (BTRIM(username) <> ''),
    CONSTRAINT ck_admin_users_username_normalized_not_blank CHECK (BTRIM(username_normalized) <> '')
);

CREATE TABLE IF NOT EXISTS admin_roles (
    id BIGSERIAL PRIMARY KEY,
    role_code VARCHAR(64) NOT NULL,
    role_name VARCHAR(64) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_roles_role_code UNIQUE (role_code),
    CONSTRAINT ck_admin_roles_role_code_not_blank CHECK (BTRIM(role_code) <> ''),
    CONSTRAINT ck_admin_roles_role_name_not_blank CHECK (BTRIM(role_name) <> '')
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    permission_code VARCHAR(128) NOT NULL,
    permission_name VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_permissions_permission_code UNIQUE (permission_code),
    CONSTRAINT ck_admin_permissions_permission_code_not_blank CHECK (BTRIM(permission_code) <> ''),
    CONSTRAINT ck_admin_permissions_permission_name_not_blank CHECK (BTRIM(permission_name) <> ''),
    CONSTRAINT ck_admin_permissions_resource_type_not_blank CHECK (BTRIM(resource_type) <> ''),
    CONSTRAINT ck_admin_permissions_action_type_not_blank CHECK (BTRIM(action_type) <> '')
);

CREATE TABLE IF NOT EXISTS admin_user_roles (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    admin_role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_user_roles UNIQUE (admin_user_id, admin_role_id)
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id BIGSERIAL PRIMARY KEY,
    admin_role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    admin_permission_id BIGINT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_role_permissions UNIQUE (admin_role_id, admin_permission_id)
);

CREATE TABLE IF NOT EXISTS admin_sessions (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(256) NOT NULL,
    access_token_jti VARCHAR(128),
    client_ip VARCHAR(64),
    user_agent VARCHAR(512),
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    revoked_at TIMESTAMPTZ,
    revoke_reason VARCHAR(64),
    last_seen_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_admin_sessions_refresh_token_hash UNIQUE (refresh_token_hash),
    CONSTRAINT uq_admin_sessions_access_token_jti UNIQUE (access_token_jti),
    CONSTRAINT ck_admin_sessions_expiry CHECK (expires_at > issued_at)
);

CREATE TABLE IF NOT EXISTS admin_audit_logs (
    id BIGSERIAL PRIMARY KEY,
    admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    action_type VARCHAR(64) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    resource_id VARCHAR(128),
    request_id VARCHAR(128),
    reason TEXT,
    before_json JSONB,
    after_json JSONB,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_admin_audit_logs_action_type_not_blank CHECK (BTRIM(action_type) <> ''),
    CONSTRAINT ck_admin_audit_logs_resource_type_not_blank CHECK (BTRIM(resource_type) <> '')
);


-- =========================================================
-- 规则配置与长期主数据
-- =========================================================

CREATE TABLE IF NOT EXISTS race_rule_configs (
    id BIGSERIAL PRIMARY KEY,
    config_code VARCHAR(64) NOT NULL,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    min_bet_amount NUMERIC(20,2) NOT NULL DEFAULT 2 CHECK (min_bet_amount >= 0),
    initial_wallet_balance NUMERIC(20,2) NOT NULL DEFAULT 1000 CHECK (initial_wallet_balance >= 0),
    relief_wait_seconds INT NOT NULL DEFAULT 7200 CHECK (relief_wait_seconds > 0),
    relief_daily_limit INT NOT NULL DEFAULT 5 CHECK (relief_daily_limit >= 0),
    betting_duration_seconds INT NOT NULL DEFAULT 180 CHECK (betting_duration_seconds > 0),
    prepare_duration_seconds INT NOT NULL DEFAULT 15 CHECK (prepare_duration_seconds >= 0),
    race_duration_seconds INT NOT NULL DEFAULT 30 CHECK (race_duration_seconds > 0),
    post_race_interval_seconds INT NOT NULL DEFAULT 75 CHECK (post_race_interval_seconds >= 0),
    odds_algorithm_version VARCHAR(32),
    result_algorithm_version VARCHAR(32),
    black_horse_algorithm_version VARCHAR(32),
    rounding_version VARCHAR(32),
    fee_schedule_json JSONB,
    config_payload_json JSONB,
    effective_start_at TIMESTAMPTZ,
    effective_end_at TIMESTAMPTZ,
    rule_name VARCHAR(128) NOT NULL DEFAULT '标准规则',
    max_bet_amount NUMERIC(20,2) NOT NULL DEFAULT 50000.00,
    payout_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.8500,
    payout_quinella_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.8600,
    payout_place_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.8800,
    payout_exacta_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.8400,
    black_horse_boost_multiplier NUMERIC(5,2) NOT NULL DEFAULT 2.00,
    photo_finish_probability NUMERIC(5,4) NOT NULL DEFAULT 0.3500,
    horse_count_per_round INT NOT NULL DEFAULT 6,
    score_weights_json JSONB NOT NULL DEFAULT '{"rank1":6,"rank2":5,"rank3":4,"rank4":3,"rank5":2,"rank6":1,"winRate":6}'::JSONB,
    stable_dividend_schedule_json JSONB NOT NULL DEFAULT '{"1":200.00,"2":100.00,"3":50.00}'::JSONB,
    play_type_odds_coefficients_json JSONB NOT NULL DEFAULT '{"PLACE":{"factor":0.40,"min":1.15,"max":4.50},"QUINELLAPLACE":{"factor":0.22,"min":1.50,"max":150.0},"EXACTA":{"factor":0.65,"min":3.0,"max":500.0},"TRIO":{"factor":0.15,"min":4.0,"max":1000.0},"TRIFECTA":{"factor":0.50,"min":6.0,"max":2000.0},"TIERCE":{"factor":0.50,"min":6.0,"max":2000.0}}'::JSONB,
    qualification_trial_benchmark NUMERIC(6,3) NOT NULL DEFAULT 24.500,
    qualification_trial_base_time NUMERIC(6,3) NOT NULL DEFAULT 25.800,
    qualification_license_fee NUMERIC(18,2) NOT NULL DEFAULT 200.00,
    qualification_cooldown_hours INT NOT NULL DEFAULT 4,
    system_buyback_config_json JSONB NOT NULL DEFAULT '{"basePrices":{"WILD":150.00,"PLAINS_TB":400.00,"ROYAL":1200.00,"MYTHIC":3500.00},"levelBonus":25.00,"winBonus":100.00,"purseRate":0.05}'::JSONB,
    max_round_payout_liability NUMERIC(20,2) NOT NULL DEFAULT 500000.00,
    referral_commission_rate NUMERIC(10,6) NOT NULL DEFAULT 0.005000,
    maintenance_start_at TIMESTAMPTZ,
    maintenance_end_at TIMESTAMPTZ,
    is_maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    maintenance_notice_minutes INT NOT NULL DEFAULT 30,
    maintenance_reason VARCHAR(256),
    photo_finish_threshold_seconds NUMERIC(6,4) NOT NULL DEFAULT 0.1800,
    jackpot_pool_code VARCHAR(32) NOT NULL DEFAULT 'MEGA_COIN_POOL',
    jackpot_contribution_rate NUMERIC(6,4) NOT NULL DEFAULT 0.0150,
    jackpot_seed_amount NUMERIC(18,2) NOT NULL DEFAULT 100000.00,
    jackpot_winner_share_rate NUMERIC(6,4) NOT NULL DEFAULT 0.7000,
    jackpot_rain_share_rate NUMERIC(6,4) NOT NULL DEFAULT 0.3000,
    jackpot_rain_min_bet_amount NUMERIC(18,2) NOT NULL DEFAULT 50.00,
    photo_finish_lead_seconds NUMERIC(4,2) NOT NULL DEFAULT 3.00,
    jackpot_min_trigger_odds NUMERIC(10,2) NOT NULL DEFAULT 500.00,
    in_play_window_start_second INT NOT NULL DEFAULT 15,
    in_play_window_duration_seconds INT NOT NULL DEFAULT 3,
    in_play_boost_profit_rate NUMERIC(6,4) NOT NULL DEFAULT 0.5000,
    is_commentary_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_tipster_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_ready_skip_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    ready_skip_remaining_seconds INT NOT NULL DEFAULT 10,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_race_rule_configs_code_version UNIQUE (config_code, version),
    CONSTRAINT ck_race_rule_configs_code_not_blank CHECK (BTRIM(config_code) <> ''),
    CONSTRAINT ck_race_rule_configs_effective_window CHECK (effective_end_at IS NULL OR effective_start_at IS NULL OR effective_end_at > effective_start_at)
);

CREATE TABLE IF NOT EXISTS horse_catalogs (
    id BIGSERIAL PRIMARY KEY,
    horse_code VARCHAR(64) NOT NULL,
    name_zh VARCHAR(128) NOT NULL,
    name_en VARCHAR(128),
    description_zh TEXT,
    description_en TEXT,
    avatar_asset VARCHAR(256),
    portrait_asset VARCHAR(256),
    metadata_json JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    total_races BIGINT NOT NULL DEFAULT 0 CHECK (total_races >= 0),
    win_count BIGINT NOT NULL DEFAULT 0 CHECK (win_count >= 0),
    win_rate NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (win_rate >= 0 AND win_rate <= 1),
    rank_1_count BIGINT NOT NULL DEFAULT 0 CHECK (rank_1_count >= 0),
    rank_2_count BIGINT NOT NULL DEFAULT 0 CHECK (rank_2_count >= 0),
    rank_3_count BIGINT NOT NULL DEFAULT 0 CHECK (rank_3_count >= 0),
    rank_4_count BIGINT NOT NULL DEFAULT 0 CHECK (rank_4_count >= 0),
    rank_5_count BIGINT NOT NULL DEFAULT 0 CHECK (rank_5_count >= 0),
    rank_6_count BIGINT NOT NULL DEFAULT 0 CHECK (rank_6_count >= 0),
    rank_1_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_1_probability >= 0 AND rank_1_probability <= 1),
    rank_2_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_2_probability >= 0 AND rank_2_probability <= 1),
    rank_3_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_3_probability >= 0 AND rank_3_probability <= 1),
    rank_4_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_4_probability >= 0 AND rank_4_probability <= 1),
    rank_5_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_5_probability >= 0 AND rank_5_probability <= 1),
    rank_6_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_6_probability >= 0 AND rank_6_probability <= 1),
    preferred_track VARCHAR(32) DEFAULT 'TURF',
    preferred_weather VARCHAR(32) DEFAULT 'SUNNY',
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_horse_catalogs_horse_code UNIQUE (horse_code),
    CONSTRAINT ck_horse_catalogs_horse_code_not_blank CHECK (BTRIM(horse_code) <> ''),
    CONSTRAINT ck_horse_catalogs_name_zh_not_blank CHECK (BTRIM(name_zh) <> ''),
    CONSTRAINT ck_horse_catalogs_win_count_lte_total_races CHECK (win_count <= total_races)
);

CREATE TABLE IF NOT EXISTS character_catalogs (
    id BIGSERIAL PRIMARY KEY,
    character_code VARCHAR(64) NOT NULL,
    name_zh VARCHAR(128) NOT NULL,
    name_en VARCHAR(128),
    description_zh TEXT,
    description_en TEXT,
    avatar_asset VARCHAR(256),
    portrait_asset VARCHAR(256),
    metadata_json JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_character_catalogs_character_code UNIQUE (character_code),
    CONSTRAINT ck_character_catalogs_character_code_not_blank CHECK (BTRIM(character_code) <> ''),
    CONSTRAINT ck_character_catalogs_name_zh_not_blank CHECK (BTRIM(name_zh) <> '')
);

CREATE TABLE IF NOT EXISTS cosmetic_catalogs (
    id BIGSERIAL PRIMARY KEY,
    cosmetic_code VARCHAR(64) NOT NULL,
    slot_type VARCHAR(32) NOT NULL,
    name_zh VARCHAR(128) NOT NULL,
    name_en VARCHAR(128),
    description_zh TEXT,
    description_en TEXT,
    icon_asset VARCHAR(256),
    preview_asset VARCHAR(256),
    metadata_json JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_cosmetic_catalogs_cosmetic_code UNIQUE (cosmetic_code),
    CONSTRAINT ck_cosmetic_catalogs_cosmetic_code_not_blank CHECK (BTRIM(cosmetic_code) <> ''),
    CONSTRAINT ck_cosmetic_catalogs_slot_type_not_blank CHECK (BTRIM(slot_type) <> ''),
    CONSTRAINT ck_cosmetic_catalogs_name_zh_not_blank CHECK (BTRIM(name_zh) <> '')
);

CREATE TABLE IF NOT EXISTS character_level_configs (
    id BIGSERIAL PRIMARY KEY,
    character_id BIGINT NOT NULL REFERENCES character_catalogs(id) ON DELETE CASCADE,
    level INT NOT NULL CHECK (level >= 1),
    required_exp BIGINT NOT NULL DEFAULT 0 CHECK (required_exp >= 0),
    reward_type VARCHAR(32),
    reward_payload JSONB,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_character_level_configs UNIQUE (character_id, level)
);

CREATE TABLE IF NOT EXISTS item_catalogs (
    id BIGSERIAL PRIMARY KEY,
    item_code VARCHAR(64) NOT NULL,
    item_type VARCHAR(32) NOT NULL,
    name_zh VARCHAR(128) NOT NULL,
    name_en VARCHAR(128),
    description_zh TEXT,
    description_en TEXT,
    icon_asset VARCHAR(256),
    metadata_json JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    stackable BOOLEAN NOT NULL DEFAULT TRUE,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_item_catalogs_item_code UNIQUE (item_code),
    CONSTRAINT ck_item_catalogs_item_code_not_blank CHECK (BTRIM(item_code) <> ''),
    CONSTRAINT ck_item_catalogs_item_type_not_blank CHECK (BTRIM(item_type) <> ''),
    CONSTRAINT ck_item_catalogs_name_zh_not_blank CHECK (BTRIM(name_zh) <> '')
);

CREATE TABLE IF NOT EXISTS player_characters (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    character_id BIGINT NOT NULL REFERENCES character_catalogs(id),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    exp BIGINT NOT NULL DEFAULT 0 CHECK (exp >= 0),
    is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
    obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    equipped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_characters UNIQUE (player_id, character_id)
);

CREATE TABLE IF NOT EXISTS player_cosmetics (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    cosmetic_id BIGINT NOT NULL REFERENCES cosmetic_catalogs(id),
    slot_type VARCHAR(32) NOT NULL,
    is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
    obtained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    equipped_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_cosmetics UNIQUE (player_id, cosmetic_id),
    CONSTRAINT ck_player_cosmetics_slot_type_not_blank CHECK (BTRIM(slot_type) <> '')
);

CREATE TABLE IF NOT EXISTS player_items (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES item_catalogs(id),
    quantity BIGINT NOT NULL DEFAULT 0 CHECK (quantity >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_items UNIQUE (player_id, item_id)
);

CREATE TABLE IF NOT EXISTS player_item_transactions (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES item_catalogs(id),
    change_type VARCHAR(32) NOT NULL,
    quantity_change BIGINT NOT NULL,
    quantity_before BIGINT NOT NULL CHECK (quantity_before >= 0),
    quantity_after BIGINT NOT NULL CHECK (quantity_after >= 0),
    reference_type VARCHAR(32),
    reference_id VARCHAR(128),
    idempotency_key VARCHAR(128),
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_item_transactions_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_player_item_transactions_change_type_not_blank CHECK (BTRIM(change_type) <> '')
);

-- =========================================================
-- 公告、商城与任务
-- =========================================================

CREATE TABLE IF NOT EXISTS notices (
    id BIGSERIAL PRIMARY KEY,
    notice_code VARCHAR(64) NOT NULL,
    title_zh VARCHAR(256) NOT NULL,
    title_en VARCHAR(256),
    content_zh TEXT NOT NULL,
    content_en TEXT,
    notice_type VARCHAR(32) NOT NULL,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    sort_order INT NOT NULL DEFAULT 0,
    is_forced BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    published_at TIMESTAMPTZ,
    start_at TIMESTAMPTZ,
    end_at TIMESTAMPTZ,
    target_payload_json JSONB,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_notices_notice_code UNIQUE (notice_code),
    CONSTRAINT ck_notices_notice_code_not_blank CHECK (BTRIM(notice_code) <> ''),
    CONSTRAINT ck_notices_title_zh_not_blank CHECK (BTRIM(title_zh) <> ''),
    CONSTRAINT ck_notices_content_zh_not_blank CHECK (BTRIM(content_zh) <> ''),
    CONSTRAINT ck_notices_notice_type_not_blank CHECK (BTRIM(notice_type) <> ''),
    CONSTRAINT ck_notices_active_window CHECK (end_at IS NULL OR start_at IS NULL OR end_at > start_at)
);

CREATE TABLE IF NOT EXISTS player_notice_reads (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    notice_id BIGINT NOT NULL REFERENCES notices(id) ON DELETE CASCADE,
    read_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    dismissed_version INT,
    acknowledged_at TIMESTAMPTZ,
    CONSTRAINT uq_player_notice_reads UNIQUE (player_id, notice_id)
);

CREATE TABLE IF NOT EXISTS shop_products (
    id BIGSERIAL PRIMARY KEY,
    product_code VARCHAR(64) NOT NULL,
    product_type VARCHAR(32) NOT NULL,
    currency_type VARCHAR(32) NOT NULL,
    title_zh VARCHAR(128) NOT NULL,
    title_en VARCHAR(128),
    description_zh TEXT,
    description_en TEXT,
    price_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (price_amount >= 0),
    cash_sku_code VARCHAR(128),
    purchase_limit_daily INT,
    purchase_limit_lifetime INT,
    character_id BIGINT REFERENCES character_catalogs(id),
    cosmetic_id BIGINT REFERENCES cosmetic_catalogs(id),
    item_id BIGINT REFERENCES item_catalogs(id),
    reward_payload JSONB,
    metadata_json JSONB,
    cover_asset VARCHAR(256),
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    effective_start_at TIMESTAMPTZ,
    effective_end_at TIMESTAMPTZ,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shop_products_product_code UNIQUE (product_code),
    CONSTRAINT ck_shop_products_product_code_not_blank CHECK (BTRIM(product_code) <> ''),
    CONSTRAINT ck_shop_products_product_type_not_blank CHECK (BTRIM(product_type) <> ''),
    CONSTRAINT ck_shop_products_currency_type_not_blank CHECK (BTRIM(currency_type) <> ''),
    CONSTRAINT ck_shop_products_title_zh_not_blank CHECK (BTRIM(title_zh) <> ''),
    CONSTRAINT ck_shop_products_effective_window CHECK (effective_end_at IS NULL OR effective_start_at IS NULL OR effective_end_at > effective_start_at)
);

CREATE TABLE IF NOT EXISTS shop_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES shop_products(id),
    product_code_snapshot VARCHAR(64) NOT NULL,
    product_type_snapshot VARCHAR(32) NOT NULL,
    currency_type_snapshot VARCHAR(32) NOT NULL,
    title_zh_snapshot VARCHAR(128) NOT NULL,
    title_en_snapshot VARCHAR(128),
    quantity INT NOT NULL DEFAULT 1 CHECK (quantity > 0),
    unit_price_amount NUMERIC(20,2) NOT NULL CHECK (unit_price_amount >= 0),
    total_price_amount NUMERIC(20,2) NOT NULL CHECK (total_price_amount >= 0),
    status VARCHAR(32) NOT NULL,
    failure_code VARCHAR(64),
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64),
    payment_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    request_payload_json JSONB,
    result_payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_shop_orders_order_no UNIQUE (order_no),
    CONSTRAINT uq_shop_orders_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_shop_orders_status_not_blank CHECK (BTRIM(status) <> '')
);

CREATE TABLE IF NOT EXISTS shop_order_deliveries (
    id BIGSERIAL PRIMARY KEY,
    shop_order_id BIGINT NOT NULL REFERENCES shop_orders(id) ON DELETE CASCADE,
    delivery_type VARCHAR(32) NOT NULL,
    delivery_status VARCHAR(32) NOT NULL,
    item_transaction_id BIGINT REFERENCES player_item_transactions(id) ON DELETE SET NULL,
    wallet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    player_character_id BIGINT REFERENCES player_characters(id) ON DELETE SET NULL,
    player_cosmetic_id BIGINT REFERENCES player_cosmetics(id) ON DELETE SET NULL,
    payload_json JSONB,
    failure_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_shop_order_deliveries_delivery_type_not_blank CHECK (BTRIM(delivery_type) <> ''),
    CONSTRAINT ck_shop_order_deliveries_delivery_status_not_blank CHECK (BTRIM(delivery_status) <> '')
);

CREATE TABLE IF NOT EXISTS daily_task_definitions (
    id BIGSERIAL PRIMARY KEY,
    task_code VARCHAR(64) NOT NULL,
    task_type VARCHAR(32) NOT NULL,
    title_zh VARCHAR(128) NOT NULL,
    title_en VARCHAR(128),
    description_zh TEXT,
    description_en TEXT,
    target_value INT NOT NULL CHECK (target_value > 0),
    condition_payload_json JSONB,
    reward_type VARCHAR(32) NOT NULL,
    reward_payload JSONB,
    version INT NOT NULL DEFAULT 1 CHECK (version >= 1),
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INT NOT NULL DEFAULT 0,
    effective_start_at TIMESTAMPTZ,
    effective_end_at TIMESTAMPTZ,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_task_definitions_task_code UNIQUE (task_code),
    CONSTRAINT ck_daily_task_definitions_task_code_not_blank CHECK (BTRIM(task_code) <> ''),
    CONSTRAINT ck_daily_task_definitions_task_type_not_blank CHECK (BTRIM(task_type) <> ''),
    CONSTRAINT ck_daily_task_definitions_title_zh_not_blank CHECK (BTRIM(title_zh) <> ''),
    CONSTRAINT ck_daily_task_definitions_reward_type_not_blank CHECK (BTRIM(reward_type) <> ''),
    CONSTRAINT ck_daily_task_definitions_effective_window CHECK (effective_end_at IS NULL OR effective_start_at IS NULL OR effective_end_at > effective_start_at)
);

CREATE TABLE IF NOT EXISTS player_daily_tasks (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    task_definition_id BIGINT NOT NULL REFERENCES daily_task_definitions(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    progress INT NOT NULL DEFAULT 0 CHECK (progress >= 0),
    is_completed BOOLEAN NOT NULL DEFAULT FALSE,
    completed_at TIMESTAMPTZ,
    claimed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_daily_tasks UNIQUE (player_id, task_definition_id, business_date)
);

CREATE TABLE IF NOT EXISTS daily_task_claims (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    player_daily_task_id BIGINT NOT NULL REFERENCES player_daily_tasks(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    claim_status VARCHAR(32) NOT NULL,
    reward_type_snapshot VARCHAR(32) NOT NULL,
    reward_payload_snapshot JSONB,
    wallet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    item_transaction_id BIGINT REFERENCES player_item_transactions(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    failure_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_daily_task_claims_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_daily_task_claims_claim_status_not_blank CHECK (BTRIM(claim_status) <> ''),
    CONSTRAINT ck_daily_task_claims_reward_type_snapshot_not_blank CHECK (BTRIM(reward_type_snapshot) <> '')
);

-- =========================================================
-- 统计、补偿与运营申请
-- =========================================================

CREATE TABLE IF NOT EXISTS player_stats (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    total_rounds_participated BIGINT NOT NULL DEFAULT 0 CHECK (total_rounds_participated >= 0),
    total_rounds_won BIGINT NOT NULL DEFAULT 0 CHECK (total_rounds_won >= 0),
    win_rate NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (win_rate >= 0 AND win_rate <= 1),
    total_bet_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_bet_amount >= 0),
    total_gross_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_gross_reward >= 0),
    total_fee_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_fee_amount >= 0),
    total_net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_net_reward >= 0),
    total_net_profit_wins BIGINT NOT NULL DEFAULT 0,
    current_hit_streak INT NOT NULL DEFAULT 0,
    max_hit_streak INT NOT NULL DEFAULT 0,
    current_profit_streak INT NOT NULL DEFAULT 0,
    max_profit_streak INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_stats_player_id UNIQUE (player_id),
    CONSTRAINT ck_player_stats_wins_lte_participated CHECK (total_rounds_won <= total_rounds_participated)
);

CREATE TABLE IF NOT EXISTS player_relief_grants (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    business_date DATE NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    grant_at TIMESTAMPTZ NOT NULL,
    amount NUMERIC(20,2) NOT NULL DEFAULT 1000 CHECK (amount > 0),
    status VARCHAR(32) NOT NULL,
    trigger_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    granted_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    attempt_count INT NOT NULL DEFAULT 0 CHECK (attempt_count >= 0),
    last_attempt_at TIMESTAMPTZ,
    failure_reason TEXT,
    idempotency_key VARCHAR(128) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_relief_grants_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_player_relief_grants_status_not_blank CHECK (BTRIM(status) <> ''),
    CONSTRAINT ck_player_relief_grants_schedule_window CHECK (grant_at >= scheduled_at)
);

CREATE TABLE IF NOT EXISTS wallet_adjustment_requests (
    id BIGSERIAL PRIMARY KEY,
    request_no VARCHAR(64) NOT NULL,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
    requested_by_admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    executed_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    adjustment_type VARCHAR(32) NOT NULL,
    adjustment_amount NUMERIC(20,2) NOT NULL CHECK (adjustment_amount <> 0),
    balance_before NUMERIC(20,2),
    balance_after NUMERIC(20,2),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL,
    executed_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    request_metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_wallet_adjustment_requests_request_no UNIQUE (request_no),
    CONSTRAINT uq_wallet_adjustment_requests_idempotency_key UNIQUE (idempotency_key),
    CONSTRAINT ck_wallet_adjustment_requests_adjustment_type_not_blank CHECK (BTRIM(adjustment_type) <> ''),
    CONSTRAINT ck_wallet_adjustment_requests_reason_not_blank CHECK (BTRIM(reason) <> ''),
    CONSTRAINT ck_wallet_adjustment_requests_status_not_blank CHECK (BTRIM(status) <> '')
);

CREATE TABLE IF NOT EXISTS wallet_adjustment_approvals (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES wallet_adjustment_requests(id) ON DELETE CASCADE,
    admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    decision VARCHAR(32) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_wallet_adjustment_approvals_decision_not_blank CHECK (BTRIM(decision) <> '')
);

-- =========================================================
-- 轮次、赛果、下注与结算
-- =========================================================

CREATE TABLE IF NOT EXISTS race_rounds (
    id BIGSERIAL PRIMARY KEY,
    round_no VARCHAR(32) NOT NULL,
    state INT NOT NULL,
    betting_start_at TIMESTAMPTZ NOT NULL,
    betting_end_at TIMESTAMPTZ NOT NULL,
    prepare_start_at TIMESTAMPTZ,
    race_start_at TIMESTAMPTZ,
    race_end_at TIMESTAMPTZ,
    settlement_at TIMESTAMPTZ,
    cancelled_at TIMESTAMPTZ,
    cancel_reason TEXT,
    winner_horse_no INT CHECK (winner_horse_no BETWEEN 1 AND 6),
    second_horse_no INT,
    third_horse_no INT,
    is_photo_finish BOOLEAN NOT NULL DEFAULT FALSE,
    photo_finish_gap_seconds NUMERIC(6, 4) DEFAULT NULL,
    payout_pool_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00,
    dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000,
    jackpot_dropped BOOLEAN NOT NULL DEFAULT FALSE,
    jackpot_drop_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    weather VARCHAR(32) DEFAULT 'SUNNY',
    track_type VARCHAR(32) DEFAULT 'TURF',
    bet_count INT NOT NULL DEFAULT 0 CHECK (bet_count >= 0),
    total_bet_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_bet_amount >= 0),
    betting_duration_seconds INT NOT NULL DEFAULT 180 CHECK (betting_duration_seconds > 0),
    prepare_duration_seconds INT NOT NULL DEFAULT 15 CHECK (prepare_duration_seconds >= 0),
    race_duration_seconds INT NOT NULL DEFAULT 30 CHECK (race_duration_seconds > 0),
    post_race_interval_seconds INT NOT NULL DEFAULT 75 CHECK (post_race_interval_seconds >= 0),
    odds_algorithm_version VARCHAR(32),
    result_algorithm_version VARCHAR(32),
    black_horse_algorithm_version VARCHAR(32),
    settlement_version VARCHAR(32),
    result_seed VARCHAR(256),
    result_seed_commitment VARCHAR(256),
    selected_horse_snapshot_json JSONB,
    odds_snapshot_json JSONB,
    black_horse_snapshot_json JSONB,
    quinella_odds_snapshot_json JSONB,
    commentary_script_json JSONB DEFAULT NULL,
    result_json JSONB,
    round_rule_snapshot_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_race_rounds_round_no UNIQUE (round_no),
    CONSTRAINT ck_race_rounds_round_no_not_blank CHECK (BTRIM(round_no) <> ''),
    CONSTRAINT ck_race_rounds_betting_window CHECK (betting_end_at > betting_start_at)
);

CREATE TABLE IF NOT EXISTS race_horses (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    horse_template_id BIGINT NOT NULL REFERENCES horse_catalogs(id),
    horse_name_zh_snapshot VARCHAR(128),
    horse_name_en_snapshot VARCHAR(128),
    avatar_asset_snapshot VARCHAR(256),
    portrait_asset_snapshot VARCHAR(256),
    odds NUMERIC(10,6) NOT NULL CHECK (odds >= 0),
    total_races_snapshot BIGINT NOT NULL DEFAULT 0 CHECK (total_races_snapshot >= 0),
    win_count_snapshot BIGINT NOT NULL DEFAULT 0 CHECK (win_count_snapshot >= 0),
    win_rate_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (win_rate_snapshot >= 0 AND win_rate_snapshot <= 1),
    rank_1_probability_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_1_probability_snapshot >= 0 AND rank_1_probability_snapshot <= 1),
    rank_2_probability_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_2_probability_snapshot >= 0 AND rank_2_probability_snapshot <= 1),
    rank_3_probability_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_3_probability_snapshot >= 0 AND rank_3_probability_snapshot <= 1),
    rank_4_probability_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_4_probability_snapshot >= 0 AND rank_4_probability_snapshot <= 1),
    rank_5_probability_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_5_probability_snapshot >= 0 AND rank_5_probability_snapshot <= 1),
    rank_6_probability_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_6_probability_snapshot >= 0 AND rank_6_probability_snapshot <= 1),
    is_black_horse_candidate BOOLEAN NOT NULL DEFAULT FALSE,
    black_horse_hit_count INT NOT NULL DEFAULT 0 CHECK (black_horse_hit_count >= 0),
    is_black_horse BOOLEAN NOT NULL DEFAULT FALSE,
    final_rank INT CHECK (final_rank BETWEEN 1 AND 6),
    finish_time NUMERIC(10,4),
    animation_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_race_horses_round_horse_no UNIQUE (round_id, horse_no),
    CONSTRAINT uq_race_horses_round_horse_template_id UNIQUE (round_id, horse_template_id)
);

CREATE TABLE IF NOT EXISTS race_bet_selections (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_race_bet_selections UNIQUE (player_id, round_id, horse_no)
);

CREATE TABLE IF NOT EXISTS bet_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(64) NOT NULL,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    play_type VARCHAR(32) NOT NULL DEFAULT 'WIN',
    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    second_horse_no INT,
    third_horse_no INT DEFAULT NULL,
    combination VARCHAR(16),
    bet_amount NUMERIC(20,2) NOT NULL CHECK (bet_amount >= 2),
    locked_odds NUMERIC(10,6) NOT NULL CHECK (locked_odds >= 0),
    potential_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (potential_reward >= 0),
    gross_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (gross_reward >= 0),
    fee_rate NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (fee_rate >= 0 AND fee_rate <= 1),
    fee_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (net_reward >= 0),
    is_double_down BOOLEAN NOT NULL DEFAULT FALSE,
    double_down_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000,
    rounding_version VARCHAR(32),
    status INT NOT NULL DEFAULT 1,
    status_reason VARCHAR(128),
    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64),
    refund_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    bet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    reward_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    fee_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bet_orders_order_no UNIQUE (order_no),
    CONSTRAINT uq_bet_orders_idempotency_key UNIQUE (idempotency_key)
);

CREATE TABLE IF NOT EXISTS race_round_state_logs (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    from_state INT,
    to_state INT NOT NULL,
    trigger_source VARCHAR(32) NOT NULL,
    execution_status VARCHAR(32) NOT NULL,
    request_id VARCHAR(128),
    error_message TEXT,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_race_round_state_logs_trigger_source_not_blank CHECK (BTRIM(trigger_source) <> ''),
    CONSTRAINT ck_race_round_state_logs_execution_status_not_blank CHECK (BTRIM(execution_status) <> '')
);

CREATE TABLE IF NOT EXISTS race_settlement_runs (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    run_status VARCHAR(32) NOT NULL,
    run_reason VARCHAR(128),
    execution_key VARCHAR(128),
    orders_scanned_count INT NOT NULL DEFAULT 0 CHECK (orders_scanned_count >= 0),
    orders_settled_count INT NOT NULL DEFAULT 0 CHECK (orders_settled_count >= 0),
    failed_order_count INT NOT NULL DEFAULT 0 CHECK (failed_order_count >= 0),
    metadata_json JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CONSTRAINT uq_race_settlement_runs_execution_key UNIQUE (execution_key),
    CONSTRAINT ck_race_settlement_runs_run_status_not_blank CHECK (BTRIM(run_status) <> '')
);

CREATE TABLE IF NOT EXISTS bet_order_settlement_logs (
    id BIGSERIAL PRIMARY KEY,
    bet_order_id BIGINT NOT NULL REFERENCES bet_orders(id) ON DELETE CASCADE,
    settlement_run_id BIGINT REFERENCES race_settlement_runs(id) ON DELETE SET NULL,
    result_status VARCHAR(32) NOT NULL,
    gross_reward_snapshot NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (gross_reward_snapshot >= 0),
    fee_rate_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (fee_rate_snapshot >= 0 AND fee_rate_snapshot <= 1),
    fee_amount_snapshot NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (fee_amount_snapshot >= 0),
    net_reward_snapshot NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (net_reward_snapshot >= 0),
    reward_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    fee_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT ck_bet_order_settlement_logs_result_status_not_blank CHECK (BTRIM(result_status) <> '')
);

CREATE TABLE IF NOT EXISTS job_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name VARCHAR(128) NOT NULL,
    job_key VARCHAR(128),
    scope_key VARCHAR(128),
    run_status VARCHAR(32) NOT NULL,
    owner_instance VARCHAR(128),
    attempt_no INT NOT NULL DEFAULT 1 CHECK (attempt_no >= 1),
    error_message TEXT,
    metadata_json JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ,
    CONSTRAINT uq_job_execution_logs_job_key UNIQUE (job_key),
    CONSTRAINT ck_job_execution_logs_job_name_not_blank CHECK (BTRIM(job_name) <> ''),
    CONSTRAINT ck_job_execution_logs_run_status_not_blank CHECK (BTRIM(run_status) <> '')
);

-- =========================================================
-- 索引
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_players_is_active_created_at
    ON players(is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_sessions_player_active
    ON player_sessions(player_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_player_auth_audit_logs_account_created_at
    ON player_auth_audit_logs(account_normalized, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_auth_audit_logs_player_created_at
    ON player_auth_audit_logs(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_player_created_at
    ON wallet_transactions(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_player_id_desc
    ON wallet_transactions(player_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
    ON wallet_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at
    ON admin_audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_resource
    ON admin_audit_logs(resource_type, resource_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_sessions_admin_active
    ON admin_sessions(admin_user_id, revoked_at, expires_at);

CREATE INDEX IF NOT EXISTS idx_race_rule_configs_active_window
    ON race_rule_configs(is_active, is_published, effective_start_at, effective_end_at);

CREATE INDEX IF NOT EXISTS idx_horse_catalogs_enabled_sort_order
    ON horse_catalogs(is_enabled, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_character_catalogs_enabled_sort_order
    ON character_catalogs(is_enabled, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_cosmetic_catalogs_enabled_slot_sort_order
    ON cosmetic_catalogs(is_enabled, slot_type, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_item_catalogs_enabled_sort_order
    ON item_catalogs(is_enabled, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_player_characters_player_equipped
    ON player_characters(player_id, is_equipped);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_characters_one_equipped
    ON player_characters(player_id)
    WHERE is_equipped = TRUE;

CREATE INDEX IF NOT EXISTS idx_player_cosmetics_player_slot_equipped
    ON player_cosmetics(player_id, slot_type, is_equipped);

CREATE UNIQUE INDEX IF NOT EXISTS ux_player_cosmetics_one_equipped_per_slot
    ON player_cosmetics(player_id, slot_type)
    WHERE is_equipped = TRUE;

CREATE INDEX IF NOT EXISTS idx_player_items_player_updated_at
    ON player_items(player_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_item_transactions_player_created_at
    ON player_item_transactions(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notices_published_window
    ON notices(is_published, start_at, end_at, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_player_notice_reads_player_read_at
    ON player_notice_reads(player_id, read_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_products_enabled_window
    ON shop_products(is_enabled, is_visible, effective_start_at, effective_end_at, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_shop_orders_player_created_at
    ON shop_orders(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_orders_status_created_at
    ON shop_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_order_deliveries_order_created_at
    ON shop_order_deliveries(shop_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_daily_task_definitions_enabled_window
    ON daily_task_definitions(is_enabled, effective_start_at, effective_end_at, sort_order, id);

CREATE INDEX IF NOT EXISTS idx_player_daily_tasks_player_date
    ON player_daily_tasks(player_id, business_date);

CREATE INDEX IF NOT EXISTS idx_daily_task_claims_player_date
    ON daily_task_claims(player_id, business_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_relief_grants_player_date_status
    ON player_relief_grants(player_id, business_date, status);

CREATE INDEX IF NOT EXISTS idx_player_relief_grants_status_grant_at
    ON player_relief_grants(status, grant_at);

CREATE INDEX IF NOT EXISTS idx_player_stats_win_rate
    ON player_stats(win_rate DESC, total_rounds_won DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_adjustment_requests_player_status_created_at
    ON wallet_adjustment_requests(player_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_race_rounds_state
    ON race_rounds(state);

CREATE INDEX IF NOT EXISTS idx_race_rounds_betting_end_at
    ON race_rounds(betting_end_at);

CREATE INDEX IF NOT EXISTS idx_race_horses_round_id
    ON race_horses(round_id);

CREATE INDEX IF NOT EXISTS idx_race_horses_round_final_rank
    ON race_horses(round_id, final_rank);

CREATE INDEX IF NOT EXISTS idx_bet_orders_player_created_at
    ON bet_orders(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_orders_round_id
    ON bet_orders(round_id);

CREATE INDEX IF NOT EXISTS idx_bet_orders_round_status
    ON bet_orders(round_id, status);

CREATE INDEX IF NOT EXISTS idx_bet_orders_status_created_at
    ON bet_orders(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_race_round_state_logs_round_created_at
    ON race_round_state_logs(round_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_race_settlement_runs_round_started_at
    ON race_settlement_runs(round_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_order_settlement_logs_order_created_at
    ON bet_order_settlement_logs(bet_order_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_job_execution_logs_job_started_at
    ON job_execution_logs(job_name, started_at DESC);

-- =========================================================
-- 表说明与关键字段说明
-- =========================================================

COMMENT ON TABLE players IS '玩家主表：保存账号、昵称、语言、等级与启用状态。';
COMMENT ON COLUMN players.account_normalized IS '账号规范化结果，用于唯一索引与防止大小写/空白差异造成重复账号。';
COMMENT ON COLUMN players.avatar_asset IS '玩家头像或展示资源引用。';

COMMENT ON TABLE player_credentials IS '玩家凭据表：只保存安全哈希后的密码与登录失败控制字段。';
COMMENT ON COLUMN player_credentials.password_algorithm IS '密码哈希算法，例如 Argon2id / PBKDF2。';
COMMENT ON COLUMN player_credentials.password_version IS '改密后递增，用于使历史会话失效。';

COMMENT ON TABLE player_sessions IS '玩家刷新会话表：支持可撤销登录会话。';
COMMENT ON COLUMN player_sessions.refresh_token_hash IS '刷新令牌哈希，数据库不保存明文刷新令牌。';
COMMENT ON COLUMN player_sessions.access_token_jti IS '访问令牌唯一标识，可用于吊销与追踪。';

COMMENT ON TABLE player_settings IS '玩家偏好设置：语言、时区与展示开关。';
COMMENT ON COLUMN player_settings.time_zone IS '用于玩家展示与伦敦自然日类业务边界。';

COMMENT ON TABLE player_auth_audit_logs IS '玩家认证审计日志：注册、登录、改密、刷新等结果审计。';

COMMENT ON TABLE wallets IS '玩家钱包表：保存当前虚拟币余额与并发版本号。';
COMMENT ON COLUMN wallets.version IS '钱包乐观并发版本号。';

COMMENT ON TABLE wallet_transactions IS '钱包流水表：所有余额变动必须落库到此表。';
COMMENT ON COLUMN wallet_transactions.transaction_type IS '初始化赠送、下注扣款、比赛奖励、手续费、破产补偿、商城消费、任务奖励、运营调账等。';
COMMENT ON COLUMN wallet_transactions.idempotency_key IS '幂等键，确保可重试的钱包操作不会重复入账。';
COMMENT ON COLUMN wallet_transactions.reference_type IS '关联业务对象类型，例如 bet_order / shop_order / daily_task_claim / relief_grant。';
COMMENT ON COLUMN wallet_transactions.reference_id IS '关联业务对象主键或业务编号。';

COMMENT ON TABLE admin_users IS '后台管理员账户表。';
COMMENT ON TABLE admin_roles IS '后台角色表。';
COMMENT ON TABLE admin_permissions IS '后台权限点表：用于最小权限控制。';
COMMENT ON TABLE admin_user_roles IS '管理员与角色关联表。';
COMMENT ON TABLE admin_role_permissions IS '角色与权限点关联表。';
COMMENT ON TABLE admin_sessions IS '管理员登录会话表。';
COMMENT ON TABLE admin_audit_logs IS '后台操作审计日志，记录配置/运营类变更前后值。';

COMMENT ON TABLE race_rule_configs IS '赛马业务规则配置表：存储阶段时长、补偿规则、算法版本与费用配置。';
COMMENT ON COLUMN race_rule_configs.fee_schedule_json IS '手续费区间与费率快照。';
COMMENT ON COLUMN race_rule_configs.config_payload_json IS '尚未稳定结构的扩展配置。';

COMMENT ON TABLE horse_catalogs IS '长期马匹主数据表：后台维护，前台读取已启用数据。';
COMMENT ON COLUMN horse_catalogs.total_races IS '该马历史总出场次数。';
COMMENT ON COLUMN horse_catalogs.win_count IS '该马获得第一名次数。';
COMMENT ON COLUMN horse_catalogs.rank_1_probability IS '该马历史第一名概率快照字段。';

COMMENT ON TABLE character_catalogs IS '角色主数据表。';
COMMENT ON TABLE cosmetic_catalogs IS '装扮主数据表：与角色、物品分离，便于拥有与装备管理。';
COMMENT ON COLUMN cosmetic_catalogs.slot_type IS '装扮槽位，例如 head / body / accessory。';
COMMENT ON TABLE character_level_configs IS '角色等级与升级奖励配置表。';
COMMENT ON TABLE item_catalogs IS '物品主数据表。';
COMMENT ON TABLE player_characters IS '玩家已拥有角色表。';
COMMENT ON COLUMN player_characters.is_equipped IS '是否为当前展示角色；通过唯一部分索引确保每位玩家最多一条。';
COMMENT ON TABLE player_cosmetics IS '玩家已拥有装扮表。';
COMMENT ON COLUMN player_cosmetics.slot_type IS '持久化槽位，便于数据库约束同槽位只能装备一个。';
COMMENT ON TABLE player_items IS '玩家物品库存表。';
COMMENT ON TABLE player_item_transactions IS '物品流水表：记录物品获得、消耗、发货与运营调整。';

COMMENT ON TABLE notices IS '公告表：支持版本、发布状态、强制阅读和时间窗口。';
COMMENT ON COLUMN notices.target_payload_json IS '公告受众规则扩展字段，例如平台、语言或分群条件。';
COMMENT ON TABLE player_notice_reads IS '玩家公告已读/关闭记录。';

COMMENT ON TABLE shop_products IS '商城商品主数据表：支持金币商品与现金商品结构预留。';
COMMENT ON COLUMN shop_products.cash_sku_code IS '现金商品外部 SKU 或商店商品编码预留字段。';
COMMENT ON TABLE shop_orders IS '商城订单表：持久化购买请求、价格快照、幂等键与支付结果。';
COMMENT ON COLUMN shop_orders.product_code_snapshot IS '下单时的商品编码快照，防止主数据编辑影响历史订单。';
COMMENT ON COLUMN shop_orders.payment_transaction_id IS '商城支付对应的钱包流水。';
COMMENT ON TABLE shop_order_deliveries IS '商城履约记录表：记录角色/装扮/物品发放结果。';

COMMENT ON TABLE daily_task_definitions IS '每日任务定义表：任务条件、奖励、上下架与展示信息由后台配置。';
COMMENT ON COLUMN daily_task_definitions.condition_payload_json IS '任务条件扩展定义，例如比赛场数、胜场、负场目标。';
COMMENT ON TABLE player_daily_tasks IS '玩家每日任务进度表。';
COMMENT ON TABLE daily_task_claims IS '每日任务领奖表：持久化领奖幂等、奖励快照与关联流水。';

COMMENT ON TABLE player_stats IS '玩家累计统计表：用于个人胜率榜与用户摘要。';
COMMENT ON TABLE player_relief_grants IS '破产补偿任务表：记录触发、等待、发放与失败重试。';
COMMENT ON COLUMN player_relief_grants.business_date IS '按 Europe/London 计算的业务日期，用于每日最多 5 次补偿限制。';

COMMENT ON TABLE wallet_adjustment_requests IS '运营调账申请/执行表：承载原因、状态、审批与幂等控制。';
COMMENT ON TABLE wallet_adjustment_approvals IS '运营调账审批记录表。';

COMMENT ON TABLE race_rounds IS '轮次主表：保存阶段时间、状态、算法版本、快照与最终结果。';
COMMENT ON COLUMN race_rounds.state IS '轮次状态整数值，已进入持久化协议，不应重排或复用。';
COMMENT ON COLUMN race_rounds.selected_horse_snapshot_json IS '本轮 6 匹上场马匹的来源与抽取快照。';
COMMENT ON COLUMN race_rounds.odds_snapshot_json IS '本轮赔率计算输入与输出快照。';
COMMENT ON COLUMN race_rounds.black_horse_snapshot_json IS '黑马权重与触发过程快照。';
COMMENT ON COLUMN race_rounds.result_json IS '完整排名、动画参数和其他赛果细节。';
COMMENT ON COLUMN race_rounds.result_seed_commitment IS '可复核随机种子承诺值或哈希。';

COMMENT ON TABLE race_horses IS '轮次参赛马快照表：保存当轮马号、赔率、历史统计快照与最终排名。';
COMMENT ON COLUMN race_horses.horse_template_id IS '关联长期马匹主数据。';
COMMENT ON COLUMN race_horses.win_count_snapshot IS '轮次创建时的历史第一名次数快照。';
COMMENT ON COLUMN race_horses.animation_json IS '客户端用于表现比赛动画的服务端参数。';

COMMENT ON TABLE race_bet_selections IS '玩家每轮选马记录表：同一轮只能选一匹马，但可追加多笔下注。';
COMMENT ON TABLE bet_orders IS '下注订单表：持久化下注、赔率锁定、奖励快照与幂等键。';
COMMENT ON COLUMN bet_orders.potential_reward IS '兼容旧语义字段；新逻辑应优先使用 gross_reward / fee_amount / net_reward。';
COMMENT ON COLUMN bet_orders.bet_transaction_id IS '下注扣款钱包流水。';
COMMENT ON COLUMN bet_orders.reward_transaction_id IS '派奖钱包流水。';
COMMENT ON COLUMN bet_orders.fee_transaction_id IS '手续费钱包流水。';

COMMENT ON TABLE race_round_state_logs IS '轮次状态迁移审计日志。';
COMMENT ON TABLE race_settlement_runs IS '轮次结算执行记录：支持重试与故障追踪。';
COMMENT ON TABLE bet_order_settlement_logs IS '订单级结算日志：便于对账、排错与详情页追溯。';
COMMENT ON TABLE job_execution_logs IS '后台任务执行日志：记录 Worker 任务运行、重试与失败信息。';



-- ============================================================================
-- 日志与追踪扩展表 (004)
-- ============================================================================
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

-- ============================================================================
-- 成就与推广奖励表 (008, 011)
-- ============================================================================
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

CREATE UNIQUE INDEX IF NOT EXISTS idx_players_invite_code ON players(invite_code);

CREATE TABLE IF NOT EXISTS player_referral_rewards (
    id BIGSERIAL PRIMARY KEY,
    referrer_player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    invited_player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    round_id BIGINT REFERENCES race_rounds(id) ON DELETE SET NULL,
    reward_type VARCHAR(32) NOT NULL DEFAULT 'STARTER_INVITE',
    net_loss_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    commission_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,
    amount NUMERIC(20, 2) NOT NULL DEFAULT 0,
    claimed_at TIMESTAMPTZ,
    claim_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'GRANTED',
    wallet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    idempotency_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_player_referral_rewards_idempotency UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_player_referral_rewards_referrer ON player_referral_rewards(referrer_player_id, created_at DESC);

COMMENT ON TABLE achievement_definitions IS '功勋/成就定义表：对标 1.png Feat 页面。';

COMMENT ON TABLE player_achievements IS '玩家成就达成进度与领奖表。';

COMMENT ON TABLE player_referral_rewards IS '好友邀请与社交裂变返佣表。';

-- ============================================================================
-- 大奖池与专属马房 (013)
-- ============================================================================
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

COMMENT ON COLUMN bet_orders.third_horse_no IS '三重彩或三连碰模式下的第三匹马号';

COMMENT ON COLUMN bet_orders.is_double_down IS '是否在开赛第 15 秒触发冲刺加倍追投';

COMMENT ON COLUMN bet_orders.double_down_amount IS '冲刺加倍追投追加扣除的金额';

COMMENT ON COLUMN race_rounds.is_photo_finish IS '本轮冲线是否触发了冠亚军鼻尖微距绝杀 (Photo Finish)';

COMMENT ON COLUMN race_rounds.photo_finish_gap_seconds IS '第一名与第二名完赛时间差（秒）';

COMMENT ON COLUMN race_rounds.commentary_script_json IS '服务端生成的本轮结构化赛况解说台本文本 JSONB';

COMMENT ON COLUMN race_rounds.jackpot_dropped IS '本轮是否触发了全服超级大爆奖';

COMMENT ON COLUMN race_rounds.jackpot_drop_amount IS '本轮爆出的全服超级大奖总金额';

-- ============================================================================
-- 牧场系统基础字典与配置 (016)
-- ============================================================================
CREATE TABLE IF NOT EXISTS race_environments (
    id BIGSERIAL PRIMARY KEY,
    environment_type VARCHAR(16) NOT NULL CHECK (environment_type IN ('WEATHER', 'TRACK')),
    code VARCHAR(32) NOT NULL UNIQUE,
    name_zh VARCHAR(48) NOT NULL,
    name_en VARCHAR(48) NOT NULL,
    description_zh VARCHAR(256) NULL,
    description_en VARCHAR(256) NULL,
    adaptation_bonus_rate NUMERIC(6, 4) NOT NULL DEFAULT 1.0800, -- 偏好匹配时的表现力加成倍率 (如 1.08 代表 +8%)
    selection_weight INT NOT NULL DEFAULT 100,                     -- 随机生成的权重
    visual_theme_key VARCHAR(64) NULL,                             -- 前端表现层对应的主题色/光照标识
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_commentary_templates (
    id BIGSERIAL PRIMARY KEY,
    phase VARCHAR(16) NOT NULL CHECK (phase IN ('START', 'TURN', 'STRETCH', 'FINISH')),
    weather_condition VARCHAR(32) NULL,                            -- 可选匹配特定天气 (如 RAINY, CLOUDY, 或 NULL 代表通用)
    is_photo_finish BOOLEAN NOT NULL DEFAULT FALSE,                -- 是否仅用于冲线微差绝杀
    trigger_second INT NOT NULL DEFAULT 1,
    text_zh VARCHAR(256) NOT NULL,
    text_en VARCHAR(256) NOT NULL,
    sound_cue VARCHAR(64) NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_tipster_templates (
    id BIGSERIAL PRIMARY KEY,
    match_condition VARCHAR(32) NOT NULL CHECK (match_condition IN ('BOTH', 'TRACK_ONLY', 'WEATHER_ONLY', 'DEFAULT')),
    min_stars INT NOT NULL DEFAULT 3,
    max_stars INT NOT NULL DEFAULT 5,
    analysis_zh VARCHAR(256) NOT NULL,
    analysis_en VARCHAR(256) NOT NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_foal_tiers (
    id BIGSERIAL PRIMARY KEY,
    tier_code VARCHAR(24) NOT NULL UNIQUE CHECK (tier_code IN ('WILD', 'PLAINS_TB', 'ROYAL', 'MYTHIC')),
    tier_name_zh VARCHAR(48) NOT NULL,
    tier_name_en VARCHAR(48) NOT NULL,
    adopt_price NUMERIC(18, 2) NOT NULL,
    min_potential NUMERIC(6, 2) NOT NULL,
    max_potential NUMERIC(6, 2) NOT NULL,
    base_speed NUMERIC(6, 2) NOT NULL,
    base_stamina NUMERIC(6, 2) NOT NULL,
    base_burst NUMERIC(6, 2) NOT NULL,
    base_agility NUMERIC(6, 2) NOT NULL,
    base_temperament NUMERIC(6, 2) NOT NULL,
    description_zh VARCHAR(256) NOT NULL,
    description_en VARCHAR(256) NOT NULL,
    random_names_json JSONB NOT NULL DEFAULT '[]'::JSONB,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_feed_catalogs (
    id BIGSERIAL PRIMARY KEY,
    feed_code VARCHAR(32) NOT NULL UNIQUE,
    feed_name_zh VARCHAR(48) NOT NULL,
    feed_name_en VARCHAR(48) NOT NULL,
    feed_category VARCHAR(16) NOT NULL DEFAULT 'ROUGHAGE' CHECK (feed_category IN ('ROUGHAGE', 'CONCENTRATE')),
    coin_cost NUMERIC(18, 2) NOT NULL,
    hunger_fill INT NOT NULL DEFAULT 30,
    exp_gain INT NOT NULL DEFAULT 50,
    condition_bonus INT NOT NULL DEFAULT 0,
    burst_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    temperament_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    description_zh VARCHAR(256) NOT NULL,
    description_en VARCHAR(256) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_training_catalogs (
    id BIGSERIAL PRIMARY KEY,
    training_type VARCHAR(32) NOT NULL UNIQUE,
    training_name_zh VARCHAR(48) NOT NULL,
    training_name_en VARCHAR(48) NOT NULL,
    coin_cost NUMERIC(18, 2) NOT NULL,
    energy_cost INT NOT NULL DEFAULT 25,
    exp_gain INT NOT NULL DEFAULT 100,
    hoof_wear_delta INT NOT NULL DEFAULT 8,
    condition_loss INT NOT NULL DEFAULT 5,
    speed_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    stamina_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    burst_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    agility_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    temperament_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    description_zh VARCHAR(256) NOT NULL,
    description_en VARCHAR(256) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_care_catalogs (
    id BIGSERIAL PRIMARY KEY,
    care_type VARCHAR(32) NOT NULL UNIQUE,
    care_name_zh VARCHAR(48) NOT NULL,
    care_name_en VARCHAR(48) NOT NULL,
    coin_cost NUMERIC(18, 2) NOT NULL,
    cooldown_hours INT NOT NULL DEFAULT 0,
    intimacy_bonus INT NOT NULL DEFAULT 0,
    condition_bonus INT NOT NULL DEFAULT 0,
    health_bonus INT NOT NULL DEFAULT 0,
    energy_bonus INT NOT NULL DEFAULT 0,
    hoof_wear_relief INT NOT NULL DEFAULT 0,
    clears_illness BOOLEAN NOT NULL DEFAULT FALSE,
    clears_injury BOOLEAN NOT NULL DEFAULT FALSE,
    description_zh VARCHAR(256) NOT NULL,
    description_en VARCHAR(256) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 牧场核心业务实体 (015)
-- ============================================================================
CREATE TABLE IF NOT EXISTS ranch_horses (
    id BIGSERIAL PRIMARY KEY,
    owner_player_id BIGINT NOT NULL REFERENCES players(id),
    horse_code VARCHAR(32) NOT NULL UNIQUE,
    custom_name VARCHAR(32) NOT NULL,
    gender VARCHAR(8) NOT NULL CHECK (gender IN ('STALLION', 'MARE')),
    growth_stage VARCHAR(16) NOT NULL CHECK (growth_stage IN ('FOAL', 'JUVENILE', 'MATURE', 'PRO_RACER')),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    current_exp INT NOT NULL DEFAULT 0 CHECK (current_exp >= 0),
    max_exp INT NOT NULL DEFAULT 100,
    pedigree_tier VARCHAR(24) NOT NULL CHECK (pedigree_tier IN ('WILD', 'PLAINS_TB', 'ROYAL', 'MYTHIC')),
    sire_id BIGINT REFERENCES ranch_horses(id),
    dam_id BIGINT REFERENCES ranch_horses(id),
    generation INT NOT NULL DEFAULT 1,
    coat_color VARCHAR(16) NOT NULL DEFAULT 'BAY',
    running_style VARCHAR(16) NOT NULL DEFAULT 'STALKER',
    
    -- 五维能力与潜能 (CHECK 范围约束)
    speed_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (speed_stat >= 0 AND speed_stat <= 120),
    speed_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (speed_potential >= speed_stat),
    stamina_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (stamina_stat >= 0 AND stamina_stat <= 120),
    stamina_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (stamina_potential >= stamina_stat),
    burst_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (burst_stat >= 0 AND burst_stat <= 120),
    burst_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (burst_potential >= burst_stat),
    agility_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (agility_stat >= 0 AND agility_stat <= 120),
    agility_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (agility_potential >= agility_stat),
    temperament_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (temperament_stat >= 0 AND temperament_stat <= 120),
    temperament_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (temperament_potential >= temperament_stat),
    
    -- 生理状态与指标
    hunger_level INT NOT NULL DEFAULT 0 CHECK (hunger_level >= 0 AND hunger_level <= 100),
    stamina_energy INT NOT NULL DEFAULT 100 CHECK (stamina_energy >= 0 AND stamina_energy <= 100),
    condition_level INT NOT NULL DEFAULT 100 CHECK (condition_level >= 0 AND condition_level <= 100),
    hoof_wear INT NOT NULL DEFAULT 0 CHECK (hoof_wear >= 0 AND hoof_wear <= 100),
    intimacy_level INT NOT NULL DEFAULT 10 CHECK (intimacy_level >= 0 AND intimacy_level <= 100),
    health_points INT NOT NULL DEFAULT 100 CHECK (health_points >= 0 AND health_points <= 100),
    
    -- 装备槽位挂载
    saddle_item_id BIGINT NULL,
    stirrup_item_id BIGINT NULL,
    horseshoe_item_id BIGINT NULL,
    
    -- 资质与竞技履历
    is_licensed_racer BOOLEAN NOT NULL DEFAULT FALSE,
    qualification_time NUMERIC(6, 3) NULL,
    license_cert_code VARCHAR(48) NULL UNIQUE,
    total_career_races INT NOT NULL DEFAULT 0,
    total_career_wins INT NOT NULL DEFAULT 0,
    accumulated_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    season_points INT NOT NULL DEFAULT 0,
    
    -- 繁育与生理冷却
    is_pregnant BOOLEAN NOT NULL DEFAULT FALSE,
    breeding_cooldown_until TIMESTAMPTZ NULL,
    last_digested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 状态锁
    sub_status VARCHAR(24) NOT NULL DEFAULT 'IDLE' CHECK (sub_status IN ('IDLE', 'IN_RACE', 'AUCTION_LOCKED', 'TRANSFER_LOCKED', 'PREGNANT', 'RESTING', 'INJURED', 'SICK', 'RETIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ranch_horses_owner ON ranch_horses(owner_player_id);

CREATE INDEX IF NOT EXISTS idx_ranch_horses_pro_pts ON ranch_horses(is_licensed_racer, season_points DESC);

CREATE TABLE IF NOT EXISTS ranch_equipment_items (
    id BIGSERIAL PRIMARY KEY,
    item_code VARCHAR(32) NOT NULL UNIQUE,
    item_name VARCHAR(48) NOT NULL,
    slot_category VARCHAR(16) NOT NULL CHECK (slot_category IN ('SADDLE', 'STIRRUP', 'HORSESHOE')),
    weight_kg NUMERIC(4, 2) NOT NULL DEFAULT 2.00,
    speed_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    stamina_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    burst_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    agility_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    turf_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    dirt_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    muddy_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    max_durability INT NOT NULL DEFAULT 100,
    price_coin NUMERIC(18, 2) NOT NULL DEFAULT 200.00,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS ranch_horse_equipment (
    id BIGSERIAL PRIMARY KEY,
    owner_player_id BIGINT NOT NULL REFERENCES players(id),
    equipment_item_id BIGINT NOT NULL REFERENCES ranch_equipment_items(id),
    equipped_horse_id BIGINT REFERENCES ranch_horses(id),
    current_durability INT NOT NULL,
    is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_feed_logs (
    id BIGSERIAL PRIMARY KEY,
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    feed_code VARCHAR(32) NOT NULL,
    coin_cost NUMERIC(18, 2) NOT NULL,
    exp_gained INT NOT NULL,
    hunger_before INT NOT NULL,
    hunger_after INT NOT NULL,
    condition_before INT NOT NULL,
    condition_after INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_training_logs (
    id BIGSERIAL PRIMARY KEY,
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    training_type VARCHAR(32) NOT NULL,
    stamina_energy_cost INT NOT NULL,
    coin_cost NUMERIC(18, 2) NOT NULL,
    exp_gained INT NOT NULL,
    speed_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    stamina_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    burst_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    agility_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    temperament_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    hoof_wear_delta INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_qualification_trials (
    id BIGSERIAL PRIMARY KEY,
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    trial_time_seconds NUMERIC(6, 3) NOT NULL,
    standard_benchmark NUMERIC(6, 3) NOT NULL DEFAULT 24.500,
    is_passed BOOLEAN NOT NULL,
    fee_charged NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_races (
    id BIGSERIAL PRIMARY KEY,
    race_code VARCHAR(32) NOT NULL UNIQUE,
    race_title VARCHAR(64) NOT NULL,
    race_class VARCHAR(16) NOT NULL CHECK (race_class IN ('MAIDEN', 'G3', 'G2', 'G1')),
    track_surface VARCHAR(16) NOT NULL CHECK (track_surface IN ('TURF', 'DIRT', 'MUDDY')),
    distance_meters INT NOT NULL CHECK (distance_meters >= 800),
    entry_fee NUMERIC(18, 2) NOT NULL,
    gross_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    commission_fee NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    net_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    min_entrants INT NOT NULL DEFAULT 6,
    max_entrants INT NOT NULL DEFAULT 8,
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'REGISTRATION', 'LOCKED', 'MATCHED', 'RUNNING', 'FINISHED', 'SETTLED', 'CANCELLED')),
    registration_start_at TIMESTAMPTZ NOT NULL,
    registration_end_at TIMESTAMPTZ NOT NULL,
    race_started_at TIMESTAMPTZ NULL,
    settled_at TIMESTAMPTZ NULL
);

CREATE TABLE IF NOT EXISTS ranch_race_entries (
    id BIGSERIAL PRIMARY KEY,
    race_id BIGINT NOT NULL REFERENCES ranch_races(id),
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    gate_number INT NULL,
    final_rank INT NULL,
    finish_time_microseconds BIGINT NULL,
    prize_awarded NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    points_awarded INT NOT NULL DEFAULT 0,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, horse_id)
);

CREATE TABLE IF NOT EXISTS ranch_breeding_records (
    id BIGSERIAL PRIMARY KEY,
    dam_horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    sire_horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    dam_owner_id BIGINT NOT NULL REFERENCES players(id),
    sire_owner_id BIGINT NOT NULL REFERENCES players(id),
    stud_fee NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    bred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ NOT NULL,
    is_inbred BOOLEAN NOT NULL DEFAULT FALSE,
    prenatal_score INT NOT NULL DEFAULT 100,
    trimester1_done BOOLEAN NOT NULL DEFAULT FALSE,
    trimester2_done BOOLEAN NOT NULL DEFAULT FALSE,
    trimester3_done BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'GESTATION' CHECK (status IN ('GESTATION', 'FOALED', 'ABORTED')),
    offspring_horse_id BIGINT REFERENCES ranch_horses(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_auctions (
    id BIGSERIAL PRIMARY KEY,
    seller_player_id BIGINT NOT NULL REFERENCES players(id),
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    start_bid_price NUMERIC(18, 2) NOT NULL,
    current_bid_price NUMERIC(18, 2) NOT NULL,
    buyout_price NUMERIC(18, 2) NULL,
    min_increment NUMERIC(18, 2) NOT NULL DEFAULT 50.00,
    highest_bidder_id BIGINT REFERENCES players(id),
    extended_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ NULL,
    commission_fee NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BUYOUT_PENDING', 'SOLD', 'EXPIRED', 'CANCELLED', 'SETTLED'))
);

CREATE TABLE IF NOT EXISTS ranch_auction_bids (
    id BIGSERIAL PRIMARY KEY,
    auction_id BIGINT NOT NULL REFERENCES ranch_auctions(id),
    bidder_player_id BIGINT NOT NULL REFERENCES players(id),
    bid_amount NUMERIC(18, 2) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ranch_p2p_transfers (
    id BIGSERIAL PRIMARY KEY,
    seller_player_id BIGINT NOT NULL REFERENCES players(id),
    buyer_player_id BIGINT NOT NULL REFERENCES players(id),
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    agreed_price NUMERIC(18, 2) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'BUYER_PENDING' CHECK (status IN ('BUYER_PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS background_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(48) NOT NULL,
    business_id VARCHAR(64) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    last_error TEXT NULL,
    executed_at TIMESTAMPTZ NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_schedule ON background_jobs(status, scheduled_at);


-- ============================================================================
-- 复合业务索引与运行加速
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_race_rounds_active
    ON race_rounds(state, betting_end_at)
    WHERE state IN (1, 2, 3);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_player_created_at
    ON wallet_transactions (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_orders_player_created_at
    ON bet_orders (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_orders_player_created_at
    ON shop_orders (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bet_orders_round_play_type
    ON bet_orders(round_id, play_type);

CREATE INDEX IF NOT EXISTS idx_bet_orders_combination
    ON bet_orders(combination) WHERE combination IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_bet_orders_user_round_play
    ON bet_orders(player_id, round_id, play_type);

CREATE INDEX IF NOT EXISTS idx_player_referral_rewards_referrer
    ON player_referral_rewards(referrer_player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_referral_rewards_claim
    ON player_referral_rewards(referrer_player_id, status)
    WHERE status = 'UNCLAIMED';

COMMIT;


-- ============================================================================
-- RaceGame 数据库一键全量初始化脚本 (All-In-One Unified Baseline)
-- 生成策略：顺序合并 001~008 迁移与种子数据，具备完全幂等性 (IF NOT EXISTS / ON CONFLICT)
-- 执行说明：可以在全新的 postgres 数据库或已存在旧表的数据库中一键执行本脚本。
-- ============================================================================

BEGIN;

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 001_initial.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 目标数据库：postgres（PostgreSQL 默认维护数据库）
-- 本脚本不会 CREATE DATABASE，也不会要求数据库名为 racegame。
-- 请在 PostgreSQL 的 postgres 数据库中按 001 -> 002 -> 003 顺序执行。

-- RaceGame baseline initialization schema
--
-- 说明：
-- 1. 本脚本按“新的初始化基线”整理，兼顾当前代码已使用的表名/核心字段。
-- 2. 已补充 PRD / 实施方案中明确需要持久化、但原脚本缺失的配置、商城订单、任务领奖、装扮、权限与审计相关表。
-- 3. 对于已经被其他环境共享的数据库，不建议直接覆盖历史；应拆分为后续增量迁移。这里按当前用户要求刷新初始化脚本。

-- BEGIN; (managed by outer transaction)

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
    quinella_odds_snapshot_json JSONB,
    black_horse_snapshot_json JSONB,
    result_json JSONB,
    round_rule_snapshot_json JSONB,
    second_horse_no INT CHECK (second_horse_no IS NULL OR (second_horse_no BETWEEN 1 AND 6)),
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
    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    play_type VARCHAR(32) NOT NULL DEFAULT 'WIN',
    second_horse_no INT CHECK (second_horse_no IS NULL OR (second_horse_no BETWEEN 1 AND 6)),
    combination VARCHAR(16),
    bet_amount NUMERIC(20,2) NOT NULL CHECK (bet_amount >= 2),
    locked_odds NUMERIC(10,6) NOT NULL CHECK (locked_odds >= 0),
    potential_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (potential_reward >= 0),
    gross_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (gross_reward >= 0),
    fee_rate NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (fee_rate >= 0 AND fee_rate <= 1),
    fee_amount NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
    net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (net_reward >= 0),
    rounding_version VARCHAR(32),
    status INT NOT NULL DEFAULT 1,
    status_reason VARCHAR(128),
    idempotency_key VARCHAR(128) NOT NULL,
    bet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    reward_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    fee_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    settled_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_bet_orders_order_no UNIQUE (order_no),
    CONSTRAINT uq_bet_orders_idempotency_key UNIQUE (idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_bet_orders_round_play_type ON bet_orders(round_id, play_type);
CREATE INDEX IF NOT EXISTS idx_bet_orders_combination ON bet_orders(combination) WHERE combination IS NOT NULL;

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

COMMENT ON TABLE race_bet_selections IS '玩家每轮选马记录表：同一轮允许多马投注，记录玩家选马明细。';
COMMENT ON TABLE bet_orders IS '下注订单表：持久化下注、赔率锁定、奖励快照与幂等键。';
COMMENT ON COLUMN bet_orders.potential_reward IS '兼容旧语义字段；新逻辑应优先使用 gross_reward / fee_amount / net_reward。';
COMMENT ON COLUMN bet_orders.bet_transaction_id IS '下注扣款钱包流水。';
COMMENT ON COLUMN bet_orders.reward_transaction_id IS '派奖钱包流水。';
COMMENT ON COLUMN bet_orders.fee_transaction_id IS '手续费钱包流水。';

COMMENT ON TABLE race_round_state_logs IS '轮次状态迁移审计日志。';
COMMENT ON TABLE race_settlement_runs IS '轮次结算执行记录：支持重试与故障追踪。';
COMMENT ON TABLE bet_order_settlement_logs IS '订单级结算日志：便于对账、排错与详情页追溯。';
COMMENT ON TABLE job_execution_logs IS '后台任务执行日志：记录 Worker 任务运行、重试与失败信息。';

-- COMMIT; (managed by outer transaction)

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 002_upgrade_existing_schema.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 目标数据库：postgres（PostgreSQL 默认维护数据库）
-- 本脚本不会 CREATE DATABASE，也不会要求数据库名为 racegame。
-- 请在 PostgreSQL 的 postgres 数据库中按 001 -> 002 -> 003 顺序执行。

-- RaceGame incremental upgrade from the original 001_initial.sql
--
-- 目标：
-- 1. 兼容已经执行过旧版 001_initial.sql 的数据库。
-- 2. 补齐当前初始化基线中的新增字段、新表、索引与说明。
-- 3. 尽量采用非破坏性 ALTER / CREATE IF NOT EXISTS，避免覆盖既有数据。

-- BEGIN; (managed by outer transaction)

-- =========================================================
-- 已有表补列
-- =========================================================

ALTER TABLE players
    ADD COLUMN IF NOT EXISTS avatar_asset VARCHAR(256),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE player_sessions
    ADD COLUMN IF NOT EXISTS device_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS client_ip VARCHAR(64),
    ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512);

ALTER TABLE player_settings
    ADD COLUMN IF NOT EXISTS allow_push_notice BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS allow_result_animation BOOLEAN NOT NULL DEFAULT TRUE;

ALTER TABLE wallets
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE wallet_transactions
    ADD COLUMN IF NOT EXISTS request_id VARCHAR(128),
    ADD COLUMN IF NOT EXISTS operator_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL;

ALTER TABLE admin_users
    ADD COLUMN IF NOT EXISTS password_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_password_changed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

ALTER TABLE admin_roles
    ADD COLUMN IF NOT EXISTS description TEXT;

ALTER TABLE admin_sessions
    ADD COLUMN IF NOT EXISTS client_ip VARCHAR(64),
    ADD COLUMN IF NOT EXISTS user_agent VARCHAR(512);

ALTER TABLE admin_audit_logs
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS metadata_json JSONB;

ALTER TABLE horse_catalogs
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE character_catalogs
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE item_catalogs
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

ALTER TABLE player_characters
    ADD COLUMN IF NOT EXISTS equipped_at TIMESTAMPTZ;

ALTER TABLE shop_products
    ADD COLUMN IF NOT EXISTS title_zh VARCHAR(128) NOT NULL DEFAULT '未命名商品',
    ADD COLUMN IF NOT EXISTS title_en VARCHAR(128),
    ADD COLUMN IF NOT EXISTS description_zh TEXT,
    ADD COLUMN IF NOT EXISTS description_en TEXT,
    ADD COLUMN IF NOT EXISTS cash_sku_code VARCHAR(128),
    ADD COLUMN IF NOT EXISTS purchase_limit_daily INT,
    ADD COLUMN IF NOT EXISTS purchase_limit_lifetime INT,
    ADD COLUMN IF NOT EXISTS cover_asset VARCHAR(256),
    ADD COLUMN IF NOT EXISTS is_visible BOOLEAN NOT NULL DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS effective_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS effective_end_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE daily_task_definitions
    ADD COLUMN IF NOT EXISTS title_zh VARCHAR(128) NOT NULL DEFAULT '未命名任务',
    ADD COLUMN IF NOT EXISTS title_en VARCHAR(128),
    ADD COLUMN IF NOT EXISTS description_zh TEXT,
    ADD COLUMN IF NOT EXISTS description_en TEXT,
    ADD COLUMN IF NOT EXISTS condition_payload_json JSONB,
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS effective_start_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS effective_end_at TIMESTAMPTZ;

ALTER TABLE player_daily_tasks
    ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;

ALTER TABLE notices
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS target_payload_json JSONB;

ALTER TABLE player_notice_reads
    ADD COLUMN IF NOT EXISTS acknowledged_at TIMESTAMPTZ;

ALTER TABLE player_relief_grants
    ADD COLUMN IF NOT EXISTS trigger_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS attempt_count INT NOT NULL DEFAULT 0,
    ADD COLUMN IF NOT EXISTS last_attempt_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS failure_reason TEXT;

ALTER TABLE race_rounds
    ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
    ADD COLUMN IF NOT EXISTS cancel_reason TEXT,
    ADD COLUMN IF NOT EXISTS betting_duration_seconds INT NOT NULL DEFAULT 180,
    ADD COLUMN IF NOT EXISTS prepare_duration_seconds INT NOT NULL DEFAULT 15,
    ADD COLUMN IF NOT EXISTS race_duration_seconds INT NOT NULL DEFAULT 30,
    ADD COLUMN IF NOT EXISTS post_race_interval_seconds INT NOT NULL DEFAULT 75,
    ADD COLUMN IF NOT EXISTS settlement_version VARCHAR(32),
    ADD COLUMN IF NOT EXISTS result_seed_commitment VARCHAR(256),
    ADD COLUMN IF NOT EXISTS selected_horse_snapshot_json JSONB,
    ADD COLUMN IF NOT EXISTS round_rule_snapshot_json JSONB;

ALTER TABLE race_horses
    ADD COLUMN IF NOT EXISTS horse_name_zh_snapshot VARCHAR(128),
    ADD COLUMN IF NOT EXISTS horse_name_en_snapshot VARCHAR(128),
    ADD COLUMN IF NOT EXISTS avatar_asset_snapshot VARCHAR(256),
    ADD COLUMN IF NOT EXISTS portrait_asset_snapshot VARCHAR(256),
    ADD COLUMN IF NOT EXISTS win_count_snapshot BIGINT NOT NULL DEFAULT 0;

ALTER TABLE race_bet_selections
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE bet_orders
    ADD COLUMN IF NOT EXISTS status_reason VARCHAR(128),
    ADD COLUMN IF NOT EXISTS bet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS reward_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS fee_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- =========================================================
-- 新增表
-- =========================================================

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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_permissions (
    id BIGSERIAL PRIMARY KEY,
    permission_code VARCHAR(128) UNIQUE NOT NULL,
    permission_name VARCHAR(128) NOT NULL,
    resource_type VARCHAR(64) NOT NULL,
    action_type VARCHAR(32) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_role_permissions (
    id BIGSERIAL PRIMARY KEY,
    admin_role_id BIGINT NOT NULL REFERENCES admin_roles(id) ON DELETE CASCADE,
    admin_permission_id BIGINT NOT NULL REFERENCES admin_permissions(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (admin_role_id, admin_permission_id)
);

CREATE TABLE IF NOT EXISTS race_rule_configs (
    id BIGSERIAL PRIMARY KEY,
    config_code VARCHAR(64) NOT NULL,
    version INT NOT NULL DEFAULT 1,
    is_active BOOLEAN NOT NULL DEFAULT FALSE,
    is_published BOOLEAN NOT NULL DEFAULT FALSE,
    min_bet_amount NUMERIC(20,2) NOT NULL DEFAULT 2,
    initial_wallet_balance NUMERIC(20,2) NOT NULL DEFAULT 1000,
    relief_wait_seconds INT NOT NULL DEFAULT 7200,
    relief_daily_limit INT NOT NULL DEFAULT 5,
    betting_duration_seconds INT NOT NULL DEFAULT 180,
    prepare_duration_seconds INT NOT NULL DEFAULT 15,
    race_duration_seconds INT NOT NULL DEFAULT 30,
    post_race_interval_seconds INT NOT NULL DEFAULT 75,
    odds_algorithm_version VARCHAR(32),
    result_algorithm_version VARCHAR(32),
    black_horse_algorithm_version VARCHAR(32),
    rounding_version VARCHAR(32),
    fee_schedule_json JSONB,
    config_payload_json JSONB,
    effective_start_at TIMESTAMPTZ,
    effective_end_at TIMESTAMPTZ,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    updated_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (config_code, version)
);

CREATE TABLE IF NOT EXISTS cosmetic_catalogs (
    id BIGSERIAL PRIMARY KEY,
    cosmetic_code VARCHAR(64) UNIQUE NOT NULL,
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    UNIQUE (player_id, cosmetic_id)
);

ALTER TABLE shop_products
    ADD COLUMN IF NOT EXISTS cosmetic_id BIGINT REFERENCES cosmetic_catalogs(id);

CREATE TABLE IF NOT EXISTS player_item_transactions (
    id BIGSERIAL PRIMARY KEY,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    item_id BIGINT NOT NULL REFERENCES item_catalogs(id),
    change_type VARCHAR(32) NOT NULL,
    quantity_change BIGINT NOT NULL,
    quantity_before BIGINT NOT NULL,
    quantity_after BIGINT NOT NULL,
    reference_type VARCHAR(32),
    reference_id VARCHAR(128),
    idempotency_key VARCHAR(128) UNIQUE,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS shop_orders (
    id BIGSERIAL PRIMARY KEY,
    order_no VARCHAR(64) UNIQUE NOT NULL,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE CASCADE,
    product_id BIGINT NOT NULL REFERENCES shop_products(id),
    product_code_snapshot VARCHAR(64) NOT NULL,
    product_type_snapshot VARCHAR(32) NOT NULL,
    currency_type_snapshot VARCHAR(32) NOT NULL,
    title_zh_snapshot VARCHAR(128) NOT NULL,
    title_en_snapshot VARCHAR(128),
    quantity INT NOT NULL DEFAULT 1,
    unit_price_amount NUMERIC(20,2) NOT NULL,
    total_price_amount NUMERIC(20,2) NOT NULL,
    status VARCHAR(32) NOT NULL,
    failure_code VARCHAR(64),
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    payment_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    request_payload_json JSONB,
    result_payload_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    failure_code VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_adjustment_requests (
    id BIGSERIAL PRIMARY KEY,
    request_no VARCHAR(64) UNIQUE NOT NULL,
    player_id BIGINT NOT NULL REFERENCES players(id) ON DELETE RESTRICT,
    requested_by_admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    executed_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,
    adjustment_type VARCHAR(32) NOT NULL,
    adjustment_amount NUMERIC(20,2) NOT NULL,
    balance_before NUMERIC(20,2),
    balance_after NUMERIC(20,2),
    reason TEXT NOT NULL,
    status VARCHAR(32) NOT NULL,
    idempotency_key VARCHAR(128) UNIQUE NOT NULL,
    executed_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    request_metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ,
    executed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS wallet_adjustment_approvals (
    id BIGSERIAL PRIMARY KEY,
    request_id BIGINT NOT NULL REFERENCES wallet_adjustment_requests(id) ON DELETE CASCADE,
    admin_user_id BIGINT NOT NULL REFERENCES admin_users(id) ON DELETE RESTRICT,
    decision VARCHAR(32) NOT NULL,
    reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
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
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS race_settlement_runs (
    id BIGSERIAL PRIMARY KEY,
    round_id BIGINT NOT NULL REFERENCES race_rounds(id) ON DELETE CASCADE,
    run_status VARCHAR(32) NOT NULL,
    run_reason VARCHAR(128),
    execution_key VARCHAR(128) UNIQUE,
    orders_scanned_count INT NOT NULL DEFAULT 0,
    orders_settled_count INT NOT NULL DEFAULT 0,
    failed_order_count INT NOT NULL DEFAULT 0,
    metadata_json JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS bet_order_settlement_logs (
    id BIGSERIAL PRIMARY KEY,
    bet_order_id BIGINT NOT NULL REFERENCES bet_orders(id) ON DELETE CASCADE,
    settlement_run_id BIGINT REFERENCES race_settlement_runs(id) ON DELETE SET NULL,
    result_status VARCHAR(32) NOT NULL,
    gross_reward_snapshot NUMERIC(20,2) NOT NULL DEFAULT 0,
    fee_rate_snapshot NUMERIC(10,6) NOT NULL DEFAULT 0,
    fee_amount_snapshot NUMERIC(20,2) NOT NULL DEFAULT 0,
    net_reward_snapshot NUMERIC(20,2) NOT NULL DEFAULT 0,
    reward_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    fee_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    metadata_json JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS job_execution_logs (
    id BIGSERIAL PRIMARY KEY,
    job_name VARCHAR(128) NOT NULL,
    job_key VARCHAR(128) UNIQUE,
    scope_key VARCHAR(128),
    run_status VARCHAR(32) NOT NULL,
    owner_instance VARCHAR(128),
    attempt_no INT NOT NULL DEFAULT 1,
    error_message TEXT,
    metadata_json JSONB,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- =========================================================
-- 索引
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_players_is_active_created_at
    ON players(is_active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_auth_audit_logs_account_created_at
    ON player_auth_audit_logs(account_normalized, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_auth_audit_logs_player_created_at
    ON player_auth_audit_logs(player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_reference
    ON wallet_transactions(reference_type, reference_id);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_player_id_desc
    ON wallet_transactions(player_id, id DESC);

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

CREATE INDEX IF NOT EXISTS idx_daily_task_claims_player_date
    ON daily_task_claims(player_id, business_date, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_player_relief_grants_status_grant_at
    ON player_relief_grants(status, grant_at);

CREATE INDEX IF NOT EXISTS idx_player_stats_win_rate
    ON player_stats(win_rate DESC, total_rounds_won DESC);

CREATE INDEX IF NOT EXISTS idx_wallet_adjustment_requests_player_status_created_at
    ON wallet_adjustment_requests(player_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_race_rounds_betting_end_at
    ON race_rounds(betting_end_at);

CREATE INDEX IF NOT EXISTS idx_race_horses_round_final_rank
    ON race_horses(round_id, final_rank);

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
-- 表与字段说明
-- =========================================================

COMMENT ON TABLE player_auth_audit_logs IS '玩家认证审计日志：注册、登录、改密、刷新等结果审计。';
COMMENT ON TABLE admin_permissions IS '后台权限点表：用于最小权限控制。';
COMMENT ON TABLE admin_role_permissions IS '后台角色与权限点关联表。';
COMMENT ON TABLE race_rule_configs IS '赛马业务规则配置表：阶段时长、补偿规则、算法版本与费用配置。';
COMMENT ON TABLE cosmetic_catalogs IS '装扮主数据表。';
COMMENT ON TABLE player_cosmetics IS '玩家装扮拥有与装备表。';
COMMENT ON TABLE player_item_transactions IS '物品流水表：记录物品获得、消耗、发货与运营调整。';
COMMENT ON TABLE shop_orders IS '商城订单表：持久化购买请求、价格快照、幂等键与支付结果。';
COMMENT ON TABLE shop_order_deliveries IS '商城履约记录表：记录角色/装扮/物品发放结果。';
COMMENT ON TABLE daily_task_claims IS '每日任务领奖表：持久化领奖幂等、奖励快照与关联流水。';
COMMENT ON TABLE wallet_adjustment_requests IS '运营调账申请/执行表。';
COMMENT ON TABLE wallet_adjustment_approvals IS '运营调账审批记录表。';
COMMENT ON TABLE race_round_state_logs IS '轮次状态迁移审计日志。';
COMMENT ON TABLE race_settlement_runs IS '轮次结算执行记录：支持重试与故障追踪。';
COMMENT ON TABLE bet_order_settlement_logs IS '订单级结算日志：便于对账、排错与详情页追溯。';
COMMENT ON TABLE job_execution_logs IS '后台任务执行日志：记录 Worker 任务运行、重试与失败信息。';

COMMENT ON COLUMN wallet_transactions.operator_admin_user_id IS '触发该钱包变动的后台管理员。';
COMMENT ON COLUMN race_rounds.selected_horse_snapshot_json IS '本轮 6 匹上场马匹的来源与抽取快照。';
COMMENT ON COLUMN race_rounds.round_rule_snapshot_json IS '本轮实际使用的业务规则快照。';
COMMENT ON COLUMN shop_orders.product_code_snapshot IS '下单时的商品编码快照，防止主数据编辑影响历史订单。';
COMMENT ON COLUMN daily_task_claims.reward_payload_snapshot IS '领奖时固化的奖励快照。';

-- COMMIT; (managed by outer transaction)

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 003_seed_default_race_rules.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- 目标数据库：postgres（PostgreSQL 默认维护数据库）
-- 本脚本不会 CREATE DATABASE，也不会要求数据库名为 racegame。
-- 请在 PostgreSQL 的 postgres 数据库中按 001 -> 002 -> 003 顺序执行。

-- ============================================================================
-- RaceGame 综合开发与业务流程验证种子数据 (V2.0 强化版)
-- ============================================================================
--
-- 本脚本为开发、测试与 Docker 一键部署提供丰富完整的初始数据支持：
-- 1. 赛马规则配置（标准默认规则与快速测试规则）
-- 2. 12 匹赛马主数据（涵盖起步冲刺、均衡、长途耐力、后程爆发、黑马各流派，概率归一化，支持多样化赛场）
-- 3. 5 大骑手与驯马师角色（覆盖 COMMON / RARE / EPIC 多种稀有度）
-- 4. 角色 1~10 级完整成长等级与梯度升级奖励（金币、徽章、心得秘籍、稀有收藏）
-- 5. 11 款全槽位装扮（头部 HEAD、服装 OUTFIT、配饰 ACCESSORY、马鞭 WHIP）
-- 6. 8 类道具资产（比赛券、训练徽章、特级胡萝卜、精力药水、初/高级骑术心得、幸运马蹄铁、冠军大礼盒）
-- 7. 14 款多品类金币商城商品（道具消耗品、永久角色、全槽位装扮、批量特惠包及占位现金SKU）
-- 8. 完整的 9 项 PRD 每日任务（场次 3/10/20、胜场 1/3/5、负场 1/3/5）
-- 9. 5 篇涵盖系统公告、版本升级、规则解读、马场图鉴与公平安全承诺的公告
-- 10. 1 个开发登录测试账号 (testplayer01) 与 9 个竞技天梯榜单玩家（即时呈现真实竞争榜单）
-- 11. 8 场完整的历史已结算赛果轮次与 48 匹次马匹对局记录（即时驱动客户端近期赛果 HUD 与名次走势）
-- 12. 测试玩家关联的真实历史下注单、结算快照与全套钱包审计流水（即时驱动钱包账单页与下注记录）
-- 13. 本地开发管理员账号与管理权限体系
-- 14. 严谨的事务级数据完整性自动校验断言
--
-- 全部语句支持幂等执行（ON CONFLICT DO UPDATE / DO NOTHING），重复导入不会冲掉玩家已有动态状态。
-- ============================================================================

-- BEGIN; (managed by outer transaction)

-- =========================================================
-- 1. 赛马规则配置 (race_rule_configs)
-- =========================================================

INSERT INTO race_rule_configs (
    config_code,
    version,
    is_active,
    is_published,
    min_bet_amount,
    initial_wallet_balance,
    relief_wait_seconds,
    relief_daily_limit,
    betting_duration_seconds,
    prepare_duration_seconds,
    race_duration_seconds,
    post_race_interval_seconds,
    odds_algorithm_version,
    result_algorithm_version,
    black_horse_algorithm_version,
    rounding_version,
    fee_schedule_json,
    config_payload_json,
    created_at,
    updated_at)
VALUES
    (
        'default',
        1,
        TRUE,
        TRUE,
        2.00,
        1000.00,
        7200,
        5,
        180,
        15,
        30,
        75,
        'odds:v1',
        'result:v1',
        'blackhorse:v1',
        'money:v1',
        '[
            {"maximumGrossReward": 10000, "rate": 0.0005},
            {"maximumGrossReward": 50000, "rate": 0.001},
            {"maximumGrossReward": 100000, "rate": 0.005},
            {"maximumGrossReward": null, "rate": 0.01}
        ]'::JSONB,
        '{"seedPurpose":"standard-production-baseline","environment":"all"}'::JSONB,
        NOW(),
        NOW()
    ),
    (
        'fast_dev',
        1,
        FALSE,
        FALSE,
        2.00,
        5000.00,
        300,
        10,
        20,
        5,
        10,
        10,
        'odds:v1',
        'result:v1',
        'blackhorse:v1',
        'money:v1',
        '[
            {"maximumGrossReward": null, "rate": 0.001}
        ]'::JSONB,
        '{"seedPurpose":"rapid-automated-testing","cycleSeconds":45}'::JSONB,
        NOW(),
        NOW()
    )
ON CONFLICT (config_code, version) DO UPDATE SET
    min_bet_amount = EXCLUDED.min_bet_amount,
    initial_wallet_balance = EXCLUDED.initial_wallet_balance,
    relief_wait_seconds = EXCLUDED.relief_wait_seconds,
    relief_daily_limit = EXCLUDED.relief_daily_limit,
    betting_duration_seconds = EXCLUDED.betting_duration_seconds,
    prepare_duration_seconds = EXCLUDED.prepare_duration_seconds,
    race_duration_seconds = EXCLUDED.race_duration_seconds,
    post_race_interval_seconds = EXCLUDED.post_race_interval_seconds,
    fee_schedule_json = EXCLUDED.fee_schedule_json,
    config_payload_json = EXCLUDED.config_payload_json,
    updated_at = NOW();

-- =========================================================
-- 2. 十二匹赛马主数据 (horse_catalogs)
-- =========================================================
-- 保持原有 6 匹马参数与概率不变，新增 6 匹不同风格特点的赛马。
-- 每匹马的名次统计总和为 100，概率总和为 1.000000。
-- 当马匹池扩充至 12 匹时，每轮比赛由服务端随机抽取 6 匹参赛，保证赛况丰富多变。

INSERT INTO horse_catalogs (
    horse_code,
    name_zh,
    name_en,
    description_zh,
    description_en,
    avatar_asset,
    portrait_asset,
    metadata_json,
    sort_order,
    is_enabled,
    total_races,
    win_count,
    win_rate,
    rank_1_count,
    rank_2_count,
    rank_3_count,
    rank_4_count,
    rank_5_count,
    rank_6_count,
    rank_1_probability,
    rank_2_probability,
    rank_3_probability,
    rank_4_probability,
    rank_5_probability,
    rank_6_probability,
    created_at,
    updated_at)
VALUES
    -- 1. 赤焰流星 (起步冲刺型基准马)
    ('HORSE_RED_COMET', '赤焰流星', 'Red Comet', '起步和冲刺能力突出，爆发力惊人，作为高胜率基准马。', 'Strong start and sprint; the high-win-rate baseline horse.', 'assets/horses/red_comet/avatar.png', 'assets/horses/red_comet/portrait.png', '{"color":"red","style":"sprinter","stamina":88,"speed":95,"temperament":"spirited","trackPreference":"turf"}'::JSONB, 10, TRUE, 100, 25, 0.250000, 25, 21, 18, 15, 12, 9, 0.250000, 0.210000, 0.180000, 0.150000, 0.120000, 0.090000, NOW(), NOW()),
    -- 2. 蓝潮 (均衡稳定型)
    ('HORSE_BLUE_TIDE', '蓝潮', 'Blue Tide', '表现均衡沉稳，耐力充沛，适合作为中坚稳定型赛马。', 'A balanced and stable race horse with steady stamina.', 'assets/horses/blue_tide/avatar.png', 'assets/horses/blue_tide/portrait.png', '{"color":"blue","style":"balanced","stamina":90,"speed":89,"temperament":"calm","trackPreference":"all"}'::JSONB, 20, TRUE, 100, 21, 0.210000, 21, 18, 15, 12, 9, 25, 0.210000, 0.180000, 0.150000, 0.120000, 0.090000, 0.250000, NOW(), NOW()),
    -- 3. 金色箭矢 (中段加速型)
    ('HORSE_GOLDEN_ARROW', '金色箭矢', 'Golden Arrow', '中段弯道加速明显，具备很强的追击与终点竞争能力。', 'Strong mid-race acceleration and highly competitive form.', 'assets/horses/golden_arrow/avatar.png', 'assets/horses/golden_arrow/portrait.png', '{"color":"gold","style":"accelerator","stamina":85,"speed":92,"temperament":"focused","trackPreference":"dry"}'::JSONB, 30, TRUE, 100, 18, 0.180000, 18, 15, 12, 9, 25, 21, 0.180000, 0.150000, 0.120000, 0.090000, 0.250000, 0.210000, NOW(), NOW()),
    -- 4. 翠风 (后半程长途耐力型)
    ('HORSE_GREEN_WIND', '翠风', 'Green Wind', '后程发力强劲，耐力绵长，在长途冲刺中常常逆势反超。', 'Reliable stamina with an exceptional closing burst in long distances.', 'assets/horses/green_wind/avatar.png', 'assets/horses/green_wind/portrait.png', '{"color":"green","style":"stayer","stamina":96,"speed":84,"temperament":"steady","trackPreference":"turf"}'::JSONB, 40, TRUE, 100, 15, 0.150000, 15, 12, 9, 25, 21, 18, 0.150000, 0.120000, 0.090000, 0.250000, 0.210000, 0.180000, NOW(), NOW()),
    -- 5. 紫电 (强波动高赔率型)
    ('HORSE_PURPLE_FLASH', '紫电', 'Purple Flash', '灵动敏捷但状态波动较大，经常在中低概率区间制造惊喜。', 'Volatile form for validating medium and low probability odds.', 'assets/horses/purple_flash/avatar.png', 'assets/horses/purple_flash/portrait.png', '{"color":"purple","style":"volatile","stamina":82,"speed":94,"temperament":"unpredictable","trackPreference":"firm"}'::JSONB, 50, TRUE, 100, 12, 0.120000, 12, 9, 25, 21, 18, 15, 0.120000, 0.090000, 0.250000, 0.210000, 0.180000, 0.150000, NOW(), NOW()),
    -- 6. 银月 (经典黑马型)
    ('HORSE_SILVER_MOON', '银月', 'Silver Moon', '胜率较低但屡创奇迹，是赛场上最受瞩目的传奇黑马候选。', 'Lowest first-place probability and prime candidate for dark-horse upsets.', 'assets/horses/silver_moon/avatar.png', 'assets/horses/silver_moon/portrait.png', '{"color":"silver","style":"dark-horse","stamina":87,"speed":88,"temperament":"proud","trackPreference":"soft"}'::JSONB, 60, TRUE, 100, 9, 0.090000, 9, 25, 21, 18, 15, 12, 0.090000, 0.250000, 0.210000, 0.180000, 0.150000, 0.120000, NOW(), NOW()),
    -- 7. 暴风疾行 (突击型顶尖选手)
    ('HORSE_STORM_RUNNER', '暴风疾行', 'Storm Runner', '雷霆万钧的起跑专家，擅长领放跑法，拥有极高的前列名次概率。', 'Aggressive front-runner with fierce starting speed and strong podium rate.', 'assets/horses/storm_runner/avatar.png', 'assets/horses/storm_runner/portrait.png', '{"color":"navy","style":"sprinter","stamina":89,"speed":96,"temperament":"aggressive","trackPreference":"wet"}'::JSONB, 70, TRUE, 100, 23, 0.230000, 23, 20, 18, 16, 13, 10, 0.230000, 0.200000, 0.180000, 0.160000, 0.130000, 0.100000, NOW(), NOW()),
    -- 8. 暗影猎手 (潜伏追击型)
    ('HORSE_SHADOW_HUNTER', '暗影猎手', 'Shadow Hunter', '擅长在马群中伺机而动，直道冲刺阶段以凌厉切线超越对手。', 'Tactical stalker that drafts behind leaders and makes devastating moves.', 'assets/horses/shadow_hunter/avatar.png', 'assets/horses/shadow_hunter/portrait.png', '{"color":"black","style":"stalker","stamina":91,"speed":91,"temperament":"cunning","trackPreference":"all"}'::JSONB, 80, TRUE, 100, 19, 0.190000, 19, 17, 16, 18, 16, 14, 0.190000, 0.170000, 0.160000, 0.180000, 0.160000, 0.140000, NOW(), NOW()),
    -- 9. 极光之星 (高雅全能型)
    ('HORSE_AURORA_STAR', '极光之星', 'Aurora Star', '步伐优雅舒展，适应各种场地条件，前三名达成率极高。', 'Graceful stride and versatile pacing with a high top-three hit rate.', 'assets/horses/aurora_star/avatar.png', 'assets/horses/aurora_star/portrait.png', '{"color":"cyan","style":"balanced","stamina":89,"speed":90,"temperament":"noble","trackPreference":"turf"}'::JSONB, 90, TRUE, 100, 16, 0.160000, 16, 18, 19, 17, 15, 15, 0.160000, 0.180000, 0.190000, 0.170000, 0.150000, 0.150000, NOW(), NOW()),
    -- 10. 烈阳战将 (坚毅长途型)
    ('HORSE_BLAZING_SUN', '烈阳战将', 'Blazing Sun', '骨骼精壮，不畏长程恶战，末段加速韧性十足。', 'High endurance runner that shines in prolonged battles and tough stamina runs.', 'assets/horses/blazing_sun/avatar.png', 'assets/horses/blazing_sun/portrait.png', '{"color":"orange","style":"stayer","stamina":98,"speed":83,"temperament":"tenacious","trackPreference":"firm"}'::JSONB, 100, TRUE, 100, 14, 0.140000, 14, 15, 17, 19, 18, 17, 0.140000, 0.150000, 0.170000, 0.190000, 0.180000, 0.170000, NOW(), NOW()),
    -- 11. 惊雷破空 (狂飙冲锋型)
    ('HORSE_THUNDER_BOLT', '惊雷破空', 'Thunderbolt', '瞬时爆发力冠绝马群，状态绝佳时不可阻挡，赔率回报诱人。', 'Explosive burst speed with erratic race lines, providing attractive odds returns.', 'assets/horses/thunder_bolt/avatar.png', 'assets/horses/thunder_bolt/portrait.png', '{"color":"yellow","style":"volatile","stamina":80,"speed":97,"temperament":"wild","trackPreference":"dry"}'::JSONB, 110, TRUE, 100, 11, 0.110000, 11, 14, 15, 16, 22, 22, 0.110000, 0.140000, 0.150000, 0.160000, 0.220000, 0.220000, NOW(), NOW()),
    -- 12. 翡翠之梦 (深藏不露冷门马)
    ('HORSE_EMERALD_DREAM', '翡翠之梦', 'Emerald Dream', '平时默默无闻，遇湿滑草地能爆发出超常战力，提供最高赔率体验。', 'Quiet outsider that unleashes surprising speed on heavy tracks for huge dividends.', 'assets/horses/emerald_dream/avatar.png', 'assets/horses/emerald_dream/portrait.png', '{"color":"emerald","style":"dark-horse","stamina":86,"speed":87,"temperament":"mysterious","trackPreference":"heavy"}'::JSONB, 120, TRUE, 100, 8, 0.080000, 8, 12, 14, 16, 24, 26, 0.080000, 0.120000, 0.140000, 0.160000, 0.240000, 0.260000, NOW(), NOW())
ON CONFLICT (horse_code) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    avatar_asset = EXCLUDED.avatar_asset,
    portrait_asset = EXCLUDED.portrait_asset,
    metadata_json = EXCLUDED.metadata_json,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    total_races = EXCLUDED.total_races,
    win_count = EXCLUDED.win_count,
    win_rate = EXCLUDED.win_rate,
    rank_1_count = EXCLUDED.rank_1_count,
    rank_2_count = EXCLUDED.rank_2_count,
    rank_3_count = EXCLUDED.rank_3_count,
    rank_4_count = EXCLUDED.rank_4_count,
    rank_5_count = EXCLUDED.rank_5_count,
    rank_6_count = EXCLUDED.rank_6_count,
    rank_1_probability = EXCLUDED.rank_1_probability,
    rank_2_probability = EXCLUDED.rank_2_probability,
    rank_3_probability = EXCLUDED.rank_3_probability,
    rank_4_probability = EXCLUDED.rank_4_probability,
    rank_5_probability = EXCLUDED.rank_5_probability,
    rank_6_probability = EXCLUDED.rank_6_probability,
    updated_at = NOW();

-- =========================================================
-- 3. 角色主数据 (character_catalogs)
-- =========================================================

INSERT INTO character_catalogs (
    character_code,
    name_zh,
    name_en,
    description_zh,
    description_en,
    avatar_asset,
    portrait_asset,
    metadata_json,
    sort_order,
    is_enabled,
    is_default,
    created_at,
    updated_at)
VALUES
    ('CHARACTER_ROOKIE_JOCKEY', '见习骑手', 'Rookie Jockey', '怀揣梦想的初入赛场新手，为所有玩家默认拥有的基础角色。', 'The default starter character for all registered players.', 'assets/characters/rookie_jockey/avatar.png', 'assets/characters/rookie_jockey/portrait.png', '{"rarity":"COMMON","title":"初出茅庐","motto":"每一次起跑都是新希望"}'::JSONB, 10, TRUE, TRUE, NOW(), NOW()),
    ('CHARACTER_STAR_TRAINER', '明星驯马师', 'Star Trainer', '精通马匹调教的知名导师，可通过金币商城解锁。', 'A renowned trainer purchasable from the coin shop.', 'assets/characters/star_trainer/avatar.png', 'assets/characters/star_trainer/portrait.png', '{"rarity":"RARE","title":"伯乐再世","motto":"好马需要懂得倾听的伙伴"}'::JSONB, 20, TRUE, FALSE, NOW(), NOW()),
    ('CHARACTER_ELITE_JOCKEY', '精英巡回骑手', 'Elite Circuit Jockey', '身经百战的职业巡回赛王者，技术扎实，赛场风度翩翩。', 'A seasoned professional circuit rider with unmatched technical finesse.', 'assets/characters/elite_jockey/avatar.png', 'assets/characters/elite_jockey/portrait.png', '{"rarity":"RARE","title":"弯道主宰","motto":"胜利在最后一个弯道决出"}'::JSONB, 30, TRUE, FALSE, NOW(), NOW()),
    ('CHARACTER_ROYAL_KNIGHT', '皇家近卫骑手', 'Royal Knight Rider', '传承古典骑乘艺术的贵族近卫，佩戴纯金勋章，仪态威严。', 'Master of classical horsemanship from the royal equestrian guard.', 'assets/characters/royal_knight/avatar.png', 'assets/characters/royal_knight/portrait.png', '{"rarity":"EPIC","title":"荣耀之盾","motto":"荣誉高于一切"}'::JSONB, 40, TRUE, FALSE, NOW(), NOW()),
    ('CHARACTER_SPEED_QUEEN', '疾风女骑师', 'Wind Whisperer', '与赛马心灵相通的天才女骑师，以灵巧轻盈的驾驭闻名全服。', 'A prodigy jockey renowned for seamless communication with race horses.', 'assets/characters/speed_queen/avatar.png', 'assets/characters/speed_queen/portrait.png', '{"rarity":"EPIC","title":"追风之翼","motto":"我和风融为一体"}'::JSONB, 50, TRUE, FALSE, NOW(), NOW())
ON CONFLICT (character_code) DO UPDATE SET
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    avatar_asset = EXCLUDED.avatar_asset,
    portrait_asset = EXCLUDED.portrait_asset,
    metadata_json = EXCLUDED.metadata_json,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- =========================================================
-- 4. 道具与物品主数据 (item_catalogs)
-- =========================================================

INSERT INTO item_catalogs (
    item_code,
    item_type,
    name_zh,
    name_en,
    description_zh,
    description_en,
    icon_asset,
    metadata_json,
    sort_order,
    is_enabled,
    stackable,
    created_at,
    updated_at)
VALUES
    ('ITEM_RACE_TICKET', 'CONSUMABLE', '比赛券', 'Race Ticket', '参与特定赛事或免除入场券费用的常用道具。', 'Standard voucher used for entering select featured events.', 'assets/items/race_ticket.png', '{"rarity":"COMMON","usable":true}'::JSONB, 10, TRUE, TRUE, NOW(), NOW()),
    ('ITEM_TRAINING_BADGE', 'MATERIAL', '训练徽章', 'Training Badge', '马场日常训练获得的荣耀证明，用于角色成长与工坊兑换。', 'Proof of daily stable training; used for progression and redemption.', 'assets/items/training_badge.png', '{"rarity":"UNCOMMON","usable":false}'::JSONB, 20, TRUE, TRUE, NOW(), NOW()),
    ('ITEM_CARROT_CRUNCH', 'CONSUMABLE', '特级胡萝卜脆片', 'Premium Carrot Crunch', '马匹喜爱的顶级天然零食，马场互动道具。', 'Top-quality stable treat favored by all thoroughbreds.', 'assets/items/carrot_crunch.png', '{"rarity":"COMMON","usable":true}'::JSONB, 30, TRUE, TRUE, NOW(), NOW()),
    ('ITEM_ENERGY_DRINK', 'CONSUMABLE', '骑手精力药剂', 'Jockey Energy Drink', '高纯度电解质功能饮品，迅速恢复骑手疲劳值。', 'High-grade electrolyte drink that restores stamina quickly.', 'assets/items/energy_drink.png', '{"rarity":"COMMON","usable":true}'::JSONB, 40, TRUE, TRUE, NOW(), NOW()),
    ('ITEM_EXP_SCROLL_S', 'CONSUMABLE', '初级骑术心得', 'Apprentice Riding Notes', '记录基础步伐与控缰要领的笔记，使用可为当前角色增加 100 点经验。', 'Practical tips on gait and reins; grants 100 character EXP.', 'assets/items/exp_scroll_s.png', '{"rarity":"UNCOMMON","expValue":100,"usable":true}'::JSONB, 50, TRUE, TRUE, NOW(), NOW()),
    ('ITEM_EXP_SCROLL_M', 'CONSUMABLE', '资深骑术典籍', 'Master Riding Treatise', '名师亲撰的赛道走线与终点冲刺指南，使用可增加 500 点经验。', 'In-depth tactical guide by master jockeys; grants 500 character EXP.', 'assets/items/exp_scroll_m.png', '{"rarity":"RARE","expValue":500,"usable":true}'::JSONB, 60, TRUE, TRUE, NOW(), NOW()),
    ('ITEM_LUCKY_HORSESHOE', 'COLLECTIBLE', '镀金幸运马蹄铁', 'Gilded Lucky Horseshoe', '传奇冠军马退役佩戴的幸运蹄铁纪念品，极具珍藏价值。', 'Commemorative horseshoe from a legend; coveted collectible item.', 'assets/items/lucky_horseshoe.png', '{"rarity":"EPIC","usable":false}'::JSONB, 70, TRUE, FALSE, NOW(), NOW()),
    ('ITEM_CHAMPION_GIFTBOX', 'BUNDLE', '冠军荣耀大礼盒', 'Champion Glory Gift Box', '赛事冠军专属嘉奖礼包，开启可获取大量金币与珍贵道具。', 'Exclusive award bundle containing generous coins and select items.', 'assets/items/champion_giftbox.png', '{"rarity":"EPIC","usable":true}'::JSONB, 80, TRUE, TRUE, NOW(), NOW())
ON CONFLICT (item_code) DO UPDATE SET
    item_type = EXCLUDED.item_type,
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    icon_asset = EXCLUDED.icon_asset,
    metadata_json = EXCLUDED.metadata_json,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    stackable = EXCLUDED.stackable,
    updated_at = NOW();

-- =========================================================
-- 5. 全槽位装扮主数据 (cosmetic_catalogs)
-- =========================================================

INSERT INTO cosmetic_catalogs (
    cosmetic_code,
    slot_type,
    name_zh,
    name_en,
    description_zh,
    description_en,
    icon_asset,
    preview_asset,
    metadata_json,
    sort_order,
    is_enabled,
    is_default,
    created_at,
    updated_at)
VALUES
    -- 头部 HEAD
    ('COSMETIC_CAP_CLASSIC', 'HEAD', '经典骑手帽', 'Classic Jockey Cap', '轻便耐磨的传统骑手帽，简约大方。', 'Durable and traditional jockey cap.', 'assets/cosmetics/classic_cap/icon.png', 'assets/cosmetics/classic_cap/preview.png', '{"rarity":"COMMON"}'::JSONB, 10, TRUE, TRUE, NOW(), NOW()),
    ('COSMETIC_CAP_GOLD', 'HEAD', '黄金骑手帽', 'Golden Jockey Cap', '镶嵌金丝花纹的高级定制赛帽，流光溢彩。', 'Custom gold-threaded cap for tournament champions.', 'assets/cosmetics/golden_cap/icon.png', 'assets/cosmetics/golden_cap/preview.png', '{"rarity":"RARE"}'::JSONB, 20, TRUE, FALSE, NOW(), NOW()),
    ('COSMETIC_GOGGLE_TURBO', 'HEAD', '极速风镜', 'Turbo Speed Goggles', '防风防尘的专业流线型护目镜，提升视觉焦点。', 'Aerodynamic tinted goggles built for muddy tracks.', 'assets/cosmetics/turbo_goggles/icon.png', 'assets/cosmetics/turbo_goggles/preview.png', '{"rarity":"UNCOMMON"}'::JSONB, 30, TRUE, FALSE, NOW(), NOW()),
    ('COSMETIC_CROWN_ROYAL', 'HEAD', '皇家月桂冠', 'Royal Laurel Crown', '金叶编织而成的荣誉之冠，唯有顶尖骑手配享。', 'Ceremonial crown woven from golden laurel leaves.', 'assets/cosmetics/royal_crown/icon.png', 'assets/cosmetics/royal_crown/preview.png', '{"rarity":"EPIC"}'::JSONB, 40, TRUE, FALSE, NOW(), NOW()),
    -- 服装 OUTFIT
    ('COSMETIC_SUIT_CLASSIC', 'OUTFIT', '标准骑手服', 'Standard Riding Suit', '透气吸汗的常规训练骑行服。', 'Standard breathable training outfit for daily gallops.', 'assets/cosmetics/suit_classic/icon.png', 'assets/cosmetics/suit_classic/preview.png', '{"rarity":"COMMON"}'::JSONB, 50, TRUE, TRUE, NOW(), NOW()),
    ('COSMETIC_SUIT_ROYAL', 'OUTFIT', '皇家定制礼服', 'Royal Tailored Attire', '挺拔修身的双排扣贵族骑士盛装。', 'Elegantly tailored double-breasted formal riding coat.', 'assets/cosmetics/suit_royal/icon.png', 'assets/cosmetics/suit_royal/preview.png', '{"rarity":"RARE"}'::JSONB, 60, TRUE, FALSE, NOW(), NOW()),
    ('COSMETIC_SUIT_CHAMPION', 'OUTFIT', '冠军巡礼战袍', 'Champion Parade Outfit', '缀满金色刺绣与胜利星标的专属赛服。', 'Grand gala racing uniform adorned with victory laurels.', 'assets/cosmetics/suit_champion/icon.png', 'assets/cosmetics/suit_champion/preview.png', '{"rarity":"EPIC"}'::JSONB, 70, TRUE, FALSE, NOW(), NOW()),
    -- 配饰 ACCESSORY
    ('COSMETIC_BADGE_HONOR', 'ACCESSORY', '荣誉骑师勋章', 'Jockey Honor Medal', '佩戴于胸前的珐琅镀银荣誉徽章。', 'Enamel silver badge pinned proudly to the lapel.', 'assets/cosmetics/badge_honor/icon.png', 'assets/cosmetics/badge_honor/preview.png', '{"rarity":"UNCOMMON"}'::JSONB, 80, TRUE, FALSE, NOW(), NOW()),
    ('COSMETIC_WATCH_POCKET', 'ACCESSORY', '复古镀金怀表', 'Vintage Pocket Watch', '分秒精准的机械发条怀表，记录终点毫厘之差。', 'Precision gold pocket watch counting milliseconds.', 'assets/cosmetics/watch_pocket/icon.png', 'assets/cosmetics/watch_pocket/preview.png', '{"rarity":"RARE"}'::JSONB, 90, TRUE, FALSE, NOW(), NOW()),
    -- 马鞭 WHIP
    ('COSMETIC_WHIP_LEATHER', 'WHIP', '经典皮质短鞭', 'Classic Leather Crop', '手感极佳的手工编织真皮训练短鞭。', 'Hand-stitched leather whip with comfortable grip.', 'assets/cosmetics/whip_leather/icon.png', 'assets/cosmetics/whip_leather/preview.png', '{"rarity":"COMMON"}'::JSONB, 100, TRUE, TRUE, NOW(), NOW()),
    ('COSMETIC_WHIP_DRAGON', 'WHIP', '龙纹金柄马鞭', 'Dragon Gilded Whip', '手柄铸有精致游龙浮雕的传说级神兵马鞭。', 'Legendary whip with intricately sculpted dragon hilt.', 'assets/cosmetics/whip_dragon/icon.png', 'assets/cosmetics/whip_dragon/preview.png', '{"rarity":"EPIC"}'::JSONB, 110, TRUE, FALSE, NOW(), NOW())
ON CONFLICT (cosmetic_code) DO UPDATE SET
    slot_type = EXCLUDED.slot_type,
    name_zh = EXCLUDED.name_zh,
    name_en = EXCLUDED.name_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    icon_asset = EXCLUDED.icon_asset,
    preview_asset = EXCLUDED.preview_asset,
    metadata_json = EXCLUDED.metadata_json,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    is_default = EXCLUDED.is_default,
    updated_at = NOW();

-- =========================================================
-- 6. 角色 1~10 级成长与奖励配置 (character_level_configs)
-- =========================================================

INSERT INTO character_level_configs (
    character_id,
    level,
    required_exp,
    reward_type,
    reward_payload,
    created_at,
    updated_at)
SELECT
    character.id,
    level_data.level,
    level_data.required_exp,
    level_data.reward_type,
    level_data.reward_payload,
    NOW(),
    NOW()
FROM character_catalogs AS character
CROSS JOIN (
    VALUES
        (1,  0::BIGINT,    NULL::VARCHAR(32),    NULL::JSONB),
        (2,  100::BIGINT,  'COIN'::VARCHAR(32),  '{"amount":100}'::JSONB),
        (3,  250::BIGINT,  'ITEM'::VARCHAR(32),  '{"itemCode":"ITEM_TRAINING_BADGE","quantity":1}'::JSONB),
        (4,  500::BIGINT,  'COIN'::VARCHAR(32),  '{"amount":250}'::JSONB),
        (5,  900::BIGINT,  'ITEM'::VARCHAR(32),  '{"itemCode":"ITEM_RACE_TICKET","quantity":2}'::JSONB),
        (6,  1400::BIGINT, 'COIN'::VARCHAR(32),  '{"amount":500}'::JSONB),
        (7,  2000::BIGINT, 'ITEM'::VARCHAR(32),  '{"itemCode":"ITEM_EXP_SCROLL_S","quantity":2}'::JSONB),
        (8,  2800::BIGINT, 'COIN'::VARCHAR(32),  '{"amount":1000}'::JSONB),
        (9,  3800::BIGINT, 'ITEM'::VARCHAR(32),  '{"itemCode":"ITEM_LUCKY_HORSESHOE","quantity":1}'::JSONB),
        (10, 5000::BIGINT, 'COIN'::VARCHAR(32),  '{"amount":2000}'::JSONB)
) AS level_data(level, required_exp, reward_type, reward_payload)
ON CONFLICT (character_id, level) DO UPDATE SET
    required_exp = EXCLUDED.required_exp,
    reward_type = EXCLUDED.reward_type,
    reward_payload = EXCLUDED.reward_payload,
    updated_at = NOW();

-- =========================================================
-- 7. 金币商城丰富货架商品 (shop_products)
-- =========================================================
-- 覆盖消耗道具、特惠礼包、永久角色与多部位装扮，价格梯度合理，包含每日/终身限购控制。

-- 7.1 道具商品
INSERT INTO shop_products (
    product_code, product_type, currency_type, title_zh, title_en,
    description_zh, description_en, price_amount, purchase_limit_daily, purchase_limit_lifetime,
    item_id, cover_asset, sort_order, is_enabled, is_visible, version, metadata_json, created_at, updated_at)
SELECT
    p.code, 'ITEM', 'COIN', p.name_zh, p.name_en,
    p.desc_zh, p.desc_en, p.price, p.limit_daily, p.limit_life::INT,
    item.id, p.cover, p.sort, TRUE, TRUE, 1, p.meta::JSONB, NOW(), NOW()
FROM item_catalogs AS item
JOIN (
    VALUES
        ('SHOP_RACE_TICKET', 'ITEM_RACE_TICKET', '单张比赛券', 'Single Race Ticket', '单次赛事入场凭证，随时体验激烈竞速。', 'Single entry voucher for quick race action.', 50.00, 10, NULL::INT, 'assets/shop/race_ticket.png', 10, '{"category":"CONSUMABLE"}'),
        ('SHOP_RACE_TICKET_PACK', 'ITEM_RACE_TICKET', '比赛券特惠包(5张)', 'Race Ticket 5-Pack', '内含 5 张比赛券，适合深度体验赛马竞猜的玩家。', 'Bundle containing 5 race tickets at discount.', 220.00, 2, NULL::INT, 'assets/shop/race_ticket_pack.png', 20, '{"category":"CONSUMABLE","discount":"12%"}'),
        ('SHOP_CARROT_BOX', 'ITEM_CARROT_CRUNCH', '特级胡萝卜礼盒', 'Carrot Crunch Box', '精选胡萝卜脆片补给，马场互动必备。', 'Fresh carrot snack box loved by thoroughbreds.', 80.00, 5, NULL::INT, 'assets/shop/carrot_box.png', 30, '{"category":"MATERIAL"}'),
        ('SHOP_EXP_SCROLL', 'ITEM_EXP_SCROLL_S', '初级骑术心得', 'Riding Insights Note', '阅读后立即为出战角色注入 100 点升级经验。', 'Grants 100 EXP immediately upon purchase.', 120.00, 3, NULL::INT, 'assets/shop/exp_scroll.png', 40, '{"category":"GROWTH"}'),
        ('SHOP_CHAMPION_GIFTBOX', 'ITEM_CHAMPION_GIFTBOX', '冠军荣耀大礼盒', 'Champion Glory Box', '超值豪华补给，包含大量金币与珍稀马场道具。', 'Grand treasure box packed with coins and perks.', 600.00, 1, NULL::INT, 'assets/shop/champion_giftbox.png', 50, '{"category":"BUNDLE","featured":true}')
) AS p(code, item_code, name_zh, name_en, desc_zh, desc_en, price, limit_daily, limit_life, cover, sort, meta)
  ON p.item_code = item.item_code
ON CONFLICT (product_code) DO UPDATE SET
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    price_amount = EXCLUDED.price_amount,
    purchase_limit_daily = EXCLUDED.purchase_limit_daily,
    purchase_limit_lifetime = EXCLUDED.purchase_limit_lifetime,
    item_id = EXCLUDED.item_id,
    cover_asset = EXCLUDED.cover_asset,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    is_visible = EXCLUDED.is_visible,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = NOW();

-- 7.2 角色商品
INSERT INTO shop_products (
    product_code, product_type, currency_type, title_zh, title_en,
    description_zh, description_en, price_amount, purchase_limit_daily, purchase_limit_lifetime,
    character_id, cover_asset, sort_order, is_enabled, is_visible, version, metadata_json, created_at, updated_at)
SELECT
    p.code, 'CHARACTER', 'COIN', p.name_zh, p.name_en,
    p.desc_zh, p.desc_en, p.price, NULL, 1,
    c.id, p.cover, p.sort, TRUE, TRUE, 1, p.meta::JSONB, NOW(), NOW()
FROM character_catalogs AS c
JOIN (
    VALUES
        ('SHOP_STAR_TRAINER', 'CHARACTER_STAR_TRAINER', '明星驯马师', 'Star Trainer', '永久解锁明星驯马师角色，彰显专业风范。', 'Permanently unlocks Star Trainer character.', 500.00, 'assets/shop/star_trainer.png', 100, '{"rarity":"RARE"}'),
        ('SHOP_ELITE_JOCKEY', 'CHARACTER_ELITE_JOCKEY', '精英巡回骑手', 'Elite Circuit Jockey', '职业巡回赛明星，具备极佳的赛场辨识度。', 'Permanently unlocks Elite Jockey character.', 800.00, 'assets/shop/elite_jockey.png', 110, '{"rarity":"RARE"}'),
        ('SHOP_SPEED_QUEEN', 'CHARACTER_SPEED_QUEEN', '疾风女骑师', 'Wind Whisperer', '高人气天才骑手，华丽优雅与惊人速度的代名词。', 'Permanently unlocks Wind Whisperer character.', 1200.00, 'assets/shop/speed_queen.png', 120, '{"rarity":"EPIC","featured":true}')
) AS p(code, char_code, name_zh, name_en, desc_zh, desc_en, price, cover, sort, meta)
  ON p.char_code = c.character_code
ON CONFLICT (product_code) DO UPDATE SET
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    price_amount = EXCLUDED.price_amount,
    purchase_limit_lifetime = EXCLUDED.purchase_limit_lifetime,
    character_id = EXCLUDED.character_id,
    cover_asset = EXCLUDED.cover_asset,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    is_visible = EXCLUDED.is_visible,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = NOW();

-- 7.3 装扮商品
INSERT INTO shop_products (
    product_code, product_type, currency_type, title_zh, title_en,
    description_zh, description_en, price_amount, purchase_limit_daily, purchase_limit_lifetime,
    cosmetic_id, cover_asset, sort_order, is_enabled, is_visible, version, metadata_json, created_at, updated_at)
SELECT
    p.code, 'COSMETIC', 'COIN', p.name_zh, p.name_en,
    p.desc_zh, p.desc_en, p.price, NULL, 1,
    cos.id, p.cover, p.sort, TRUE, TRUE, 1, p.meta::JSONB, NOW(), NOW()
FROM cosmetic_catalogs AS cos
JOIN (
    VALUES
        ('SHOP_GOLD_CAP', 'COSMETIC_CAP_GOLD', '黄金骑手帽', 'Golden Jockey Cap', '尊贵华丽的纯金镶边赛帽。', 'Permanent gilded jockey cap for head slot.', 250.00, 'assets/shop/golden_cap.png', 200, '{"slot":"HEAD"}'),
        ('SHOP_GOGGLE_TURBO', 'COSMETIC_GOGGLE_TURBO', '极速风镜', 'Turbo Speed Goggles', '动感十足的彩色防风镜。', 'Aerodynamic colorful goggles for head slot.', 180.00, 'assets/shop/turbo_goggles.png', 210, '{"slot":"HEAD"}'),
        ('SHOP_SUIT_ROYAL', 'COSMETIC_SUIT_ROYAL', '皇家定制礼服', 'Royal Ceremonial Suit', '皇家贵族骑士制服，剪裁典雅庄重。', 'Prestigious royal ceremonial racing outfit.', 450.00, 'assets/shop/suit_royal.png', 220, '{"slot":"OUTFIT"}'),
        ('SHOP_BADGE_HONOR', 'COSMETIC_BADGE_HONOR', '荣誉骑师勋章', 'Jockey Honor Medal', '见证无数荣誉的闪耀胸针配饰。', 'Gleaming medal pinned to racing jacket.', 300.00, 'assets/shop/badge_honor.png', 230, '{"slot":"ACCESSORY"}'),
        ('SHOP_WHIP_DRAGON', 'COSMETIC_WHIP_DRAGON', '龙纹金柄马鞭', 'Dragon Gilded Whip', '流光溢彩的传世马鞭，手柄雕龙细致入微。', 'Masterwork golden whip with carved dragon handle.', 680.00, 'assets/shop/whip_dragon.png', 240, '{"slot":"WHIP"}')
) AS p(code, cos_code, name_zh, name_en, desc_zh, desc_en, price, cover, sort, meta)
  ON p.cos_code = cos.cosmetic_code
ON CONFLICT (product_code) DO UPDATE SET
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    price_amount = EXCLUDED.price_amount,
    purchase_limit_lifetime = EXCLUDED.purchase_limit_lifetime,
    cosmetic_id = EXCLUDED.cosmetic_id,
    cover_asset = EXCLUDED.cover_asset,
    sort_order = EXCLUDED.sort_order,
    is_enabled = EXCLUDED.is_enabled,
    is_visible = EXCLUDED.is_visible,
    metadata_json = EXCLUDED.metadata_json,
    updated_at = NOW();

-- 7.4 现金商品占位 (仅用于结构兼容，当前版本不开放)
INSERT INTO shop_products (
    product_code, product_type, currency_type, title_zh, title_en,
    description_zh, description_en, price_amount, cash_sku_code, cover_asset,
    sort_order, is_enabled, is_visible, version, metadata_json, created_at, updated_at)
VALUES (
    'SHOP_CASH_RESERVED',
    'BUNDLE',
    'CASH',
    '现金商品占位',
    'Reserved Cash Product',
    '当前版本未开放现金充值，仅保留运营配置数据契约。',
    'Disabled in the current version; retained for schema validation.',
    6.00,
    'racegame.cash.reserved.dev',
    'assets/shop/cash_reserved.png',
    1000,
    FALSE,
    FALSE,
    1,
    '{"testCase":"unsupported-currency-hidden"}'::JSONB,
    NOW(),
    NOW())
ON CONFLICT (product_code) DO UPDATE SET
    is_enabled = FALSE,
    is_visible = FALSE,
    updated_at = NOW();

-- =========================================================
-- 8. 每日任务定义 (daily_task_definitions)
-- =========================================================
-- 严格对齐 PRD 6.10 规范的 9 项日常任务体系

INSERT INTO daily_task_definitions (
    task_code, task_type, title_zh, title_en, description_zh, description_en,
    target_value, condition_payload_json, reward_type, reward_payload, version,
    is_enabled, sort_order, created_at, updated_at)
VALUES
    -- 1. 比赛场数任务 (3, 10, 20)
    ('DAILY_RACE_COUNT_1', 'RACE_COUNT', '完成1场比赛', 'Complete 1 Race', '参与并完成任意一场比赛。', 'Participate in and complete one race.', 1, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":100}'::JSONB, 1, TRUE, 5, NOW(), NOW()),
    ('DAILY_RACE_COUNT_3', 'RACE_COUNT', '累计完成3场比赛', 'Complete 3 Races', '当天累计参与并结算3场比赛。', 'Participate in and settle 3 races during the business day.', 3, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":150}'::JSONB, 1, TRUE, 10, NOW(), NOW()),
    ('DAILY_RACE_COUNT_10', 'RACE_COUNT', '累计完成10场比赛', 'Complete 10 Races', '当天累计参与并结算10场比赛。', 'Participate in and settle 10 races during the business day.', 10, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":400}'::JSONB, 1, TRUE, 20, NOW(), NOW()),
    ('DAILY_RACE_COUNT_20', 'RACE_COUNT', '累计完成20场比赛', 'Complete 20 Races', '当天累计参与并结算20场比赛。', 'Participate in and settle 20 races during the business day.', 20, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":1000}'::JSONB, 1, TRUE, 30, NOW(), NOW()),
    -- 2. 比赛胜场任务 (1, 3, 5)
    ('DAILY_RACE_WIN_1', 'RACE_WIN', '赢得1场比赛', 'Win 1 Race', '当天在任意一场已结算比赛中获胜。', 'Win any settled race during the business day.', 1, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":200}'::JSONB, 1, TRUE, 40, NOW(), NOW()),
    ('DAILY_RACE_WIN_3', 'RACE_WIN', '累计赢得3场比赛', 'Win 3 Races', '当天累计在3场已结算比赛中获胜。', 'Win 3 settled races during the business day.', 3, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":500}'::JSONB, 1, TRUE, 50, NOW(), NOW()),
    ('DAILY_RACE_WIN_5', 'RACE_WIN', '累计赢得5场比赛', 'Win 5 Races', '当天累计在5场已结算比赛中获胜。', 'Win 5 settled races during the business day.', 5, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":1200}'::JSONB, 1, TRUE, 60, NOW(), NOW()),
    -- 3. 比赛负场任务 (1, 3, 5)
    ('DAILY_RACE_LOSS_1', 'RACE_LOSS', '完成1场未获胜比赛', 'Complete 1 Losing Race', '当天参与一场已结算但未获胜的比赛。', 'Complete one settled race without winning during the business day.', 1, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":80}'::JSONB, 1, TRUE, 70, NOW(), NOW()),
    ('DAILY_RACE_LOSS_3', 'RACE_LOSS', '累计3场未获胜比赛', 'Complete 3 Losing Races', '当天累计参与3场已结算但未获胜的比赛。', 'Complete 3 settled races without winning during the business day.', 3, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":200}'::JSONB, 1, TRUE, 80, NOW(), NOW()),
    ('DAILY_RACE_LOSS_5', 'RACE_LOSS', '累计5场未获胜比赛', 'Complete 5 Losing Races', '当天累计参与5场已结算但未获胜的比赛。', 'Complete 5 settled races without winning during the business day.', 5, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":400}'::JSONB, 1, TRUE, 90, NOW(), NOW())
ON CONFLICT (task_code) DO UPDATE SET
    task_type = EXCLUDED.task_type,
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    target_value = EXCLUDED.target_value,
    condition_payload_json = EXCLUDED.condition_payload_json,
    reward_type = EXCLUDED.reward_type,
    reward_payload = EXCLUDED.reward_payload,
    version = EXCLUDED.version,
    is_enabled = EXCLUDED.is_enabled,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- =========================================================
-- 9. 公告内容 (notices)
-- =========================================================

INSERT INTO notices (
    notice_code, title_zh, title_en, content_zh, content_en, notice_type,
    version, sort_order, is_forced, is_published, published_at, target_payload_json,
    created_at, updated_at)
VALUES
    ('NOTICE_WELCOME_DEV', '欢迎来到 HorseRaceGame', 'Welcome to HorseRaceGame', '欢迎体验次时代 3D 赛马竞技！全天候不间断轮次开赛，包含赛道竞速、马场图鉴与实时竞猜。', 'Welcome to HorseRaceGame! Experience continuous 3D racing rounds, stable management, and fair odds.', 'SYSTEM', 1, 10, TRUE, TRUE, NOW(), '{"platforms":["DEV","WEB","MOBILE"]}'::JSONB, NOW(), NOW()),
    ('NOTICE_RULES_V1', '赛马竞猜规则指南', 'Race Betting Rules', '每轮固定六匹马参赛。下注仅在下注阶段开放（默认180秒），比赛结算以服务端锁定赔率和赛果为准。', 'Each round features 6 horses. Bets are locked during betting phase and settled strictly by server authority.', 'RULE', 1, 20, FALSE, TRUE, NOW(), '{"localeFallback":"zh-CN"}'::JSONB, NOW(), NOW()),
    ('NOTICE_V2_UPDATE', 'V2.0 版本升级公告', 'V2.0 Version Update Notice', '全新升级：钱包账单流水查询、马场图鉴马匹多维度统计、以及全新的安全幂等防重试机制。', 'New in V2.0: Detailed wallet transaction logs, expanded stable profiles, and hardened idempotency protection.', 'SYSTEM', 1, 30, FALSE, TRUE, NOW(), '{"tag":"UPDATE"}'::JSONB, NOW(), NOW()),
    ('NOTICE_STABLE_GUIDE', '马场与马匹流派全解', 'Stable & Horse Style Guide', '马匹分为冲刺型、稳定均衡型、长途耐力型与黑马型等。了解马匹胜率与特点将助您做出最佳下注决断。', 'Horses possess unique styles including sprinters, stayers, balanced, and dark horses. Study the stable to win!', 'GUIDE', 1, 40, FALSE, TRUE, NOW(), '{"tag":"GUIDE"}'::JSONB, NOW(), NOW()),
    ('NOTICE_FAIR_PLAY', '公平竞技与安全承诺', 'Fair Play & Audit Guarantee', '本系统所有赛果均由服务端确定性算法生成并具备不可篡改审计日志，保障全体玩家公平透明。', 'All race outcomes are generated via deterministic server logic with verifiable audit logs for ultimate fairness.', 'SECURITY', 1, 50, FALSE, TRUE, NOW(), '{"tag":"SECURITY"}'::JSONB, NOW(), NOW())
ON CONFLICT (notice_code) DO UPDATE SET
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    content_zh = EXCLUDED.content_zh,
    content_en = EXCLUDED.content_en,
    notice_type = EXCLUDED.notice_type,
    version = EXCLUDED.version,
    sort_order = EXCLUDED.sort_order,
    is_forced = EXCLUDED.is_forced,
    is_published = EXCLUDED.is_published,
    published_at = EXCLUDED.published_at,
    target_payload_json = EXCLUDED.target_payload_json,
    updated_at = NOW();

-- =========================================================
-- 10. 玩家体系与排行榜数据 (players, stats, wallets)
-- =========================================================
-- 包含 1 个本地测试玩家 (testplayer01) 与 9 个竞技天梯高水平活跃玩家，
-- 确保 /api/leaderboards/players (要求总局数>=5) 立即呈现真实、生动的 Top 10 天梯榜单。

INSERT INTO players (
    account_id, account_normalized, nickname, avatar_asset, locale,
    level, exp, is_active, created_at, updated_at)
VALUES
    ('testplayer01',   'TESTPLAYER01',   '本地测试玩家',   'assets/players/test/avatar.png',   'zh-CN', 3,  350,   TRUE, NOW() - INTERVAL '10 days', NOW()),
    ('player_kexuan',  'PLAYER_KEXUAN',  '凯旋之歌',       'assets/players/avatars/p01.png',   'zh-CN', 12, 6200,  TRUE, NOW() - INTERVAL '30 days', NOW()),
    ('player_fengbao', 'PLAYER_FENGBAO', '风暴追逐者',     'assets/players/avatars/p02.png',   'zh-CN', 10, 4800,  TRUE, NOW() - INTERVAL '25 days', NOW()),
    ('player_chiyan',  'PLAYER_CHIYAN',  '赤焰使者',       'assets/players/avatars/p03.png',   'zh-CN', 9,  3900,  TRUE, NOW() - INTERVAL '20 days', NOW()),
    ('player_yinyue',  'PLAYER_YINYUE',  '银月骑士',       'assets/players/avatars/p04.png',   'zh-CN', 8,  3100,  TRUE, NOW() - INTERVAL '18 days', NOW()),
    ('player_jifeng',  'PLAYER_JIFENG',  '疾风无影',       'assets/players/avatars/p05.png',   'zh-CN', 7,  2400,  TRUE, NOW() - INTERVAL '15 days', NOW()),
    ('player_xinghai', 'PLAYER_XINGHAI', '星海漫步',       'assets/players/avatars/p06.png',   'zh-CN', 6,  1800,  TRUE, NOW() - INTERVAL '12 days', NOW()),
    ('player_boju',    'PLAYER_BOJU',    '马场大亨',       'assets/players/avatars/p07.png',   'zh-CN', 11, 5400,  TRUE, NOW() - INTERVAL '28 days', NOW()),
    ('player_lucky',   'PLAYER_LUCKY',   '幸运七星',       'assets/players/avatars/p08.png',   'zh-CN', 5,  1200,  TRUE, NOW() - INTERVAL '8 days',  NOW()),
    ('player_heima',   'PLAYER_HEIMA',   '黑马猎手',       'assets/players/avatars/p09.png',   'zh-CN', 7,  2300,  TRUE, NOW() - INTERVAL '14 days', NOW())
ON CONFLICT (account_normalized) DO UPDATE SET
    nickname = EXCLUDED.nickname,
    avatar_asset = EXCLUDED.avatar_asset,
    level = EXCLUDED.level,
    exp = EXCLUDED.exp,
    is_active = TRUE,
    updated_at = NOW();

-- 玩家设置
INSERT INTO player_settings (
    player_id, language, time_zone, allow_push_notice, allow_result_animation, created_at, updated_at)
SELECT
    p.id, 'zh-CN', 'Europe/London', TRUE, TRUE, NOW(), NOW()
FROM players AS p
ON CONFLICT (player_id) DO NOTHING;

-- 玩家战绩统计（支撑 /api/leaderboards/players 真实胜率排序）
INSERT INTO player_stats (
    player_id, total_rounds_participated, total_rounds_won, win_rate,
    total_bet_amount, total_gross_reward, total_fee_amount, total_net_reward, updated_at)
SELECT
    p.id, d.rounds, d.wins, d.rate, d.bet_amt, d.gross_amt, d.fee_amt, d.net_amt, NOW()
FROM players AS p
JOIN (
    VALUES
        ('TESTPLAYER01',   4,   2,  0.500000, 450.00,   625.00,   0.31,  624.69),
        ('PLAYER_KEXUAN',  120, 35, 0.291667, 24000.00, 42500.00, 21.25, 18478.75),
        ('PLAYER_FENGBAO', 98,  26, 0.265306, 19600.00, 31900.00, 15.95, 12284.05),
        ('PLAYER_YINYUE',  76,  18, 0.236842, 15200.00, 23600.00, 11.80, 8388.20),
        ('PLAYER_CHIYAN',  85,  20, 0.235294, 17000.00, 26100.00, 13.05, 9086.95),
        ('PLAYER_JIFENG',  62,  14, 0.225806, 12400.00, 18000.00, 9.00,  5591.00),
        ('PLAYER_XINGHAI', 50,  11, 0.220000, 10000.00, 14200.00, 7.10,  4192.90),
        ('PLAYER_BOJU',    110, 23, 0.209091, 22000.00, 32500.00, 16.25, 10483.75),
        ('PLAYER_LUCKY',   42,  8,  0.190476, 8400.00,  11200.00, 5.60,  2794.40),
        ('PLAYER_HEIMA',   68,  12, 0.176471, 13600.00, 17500.00, 8.75,  3891.25)
) AS d(acc, rounds, wins, rate, bet_amt, gross_amt, fee_amt, net_amt)
  ON p.account_normalized = d.acc
ON CONFLICT (player_id) DO UPDATE SET
    total_rounds_participated = EXCLUDED.total_rounds_participated,
    total_rounds_won = EXCLUDED.total_rounds_won,
    win_rate = EXCLUDED.win_rate,
    total_bet_amount = EXCLUDED.total_bet_amount,
    total_gross_reward = EXCLUDED.total_gross_reward,
    total_fee_amount = EXCLUDED.total_fee_amount,
    total_net_reward = EXCLUDED.total_net_reward,
    updated_at = NOW();

-- 玩家钱包（testplayer01 初始 5000，加上历史胜负和签到后为 5174.69）
INSERT INTO wallets (player_id, balance, version, created_at, updated_at)
SELECT
    p.id, d.bal, 0, NOW(), NOW()
FROM players AS p
JOIN (
    VALUES
        ('TESTPLAYER01',   5174.69),
        ('PLAYER_KEXUAN',  18478.75),
        ('PLAYER_FENGBAO', 12284.05),
        ('PLAYER_YINYUE',  8388.20),
        ('PLAYER_CHIYAN',  9086.95),
        ('PLAYER_JIFENG',  5591.00),
        ('PLAYER_XINGHAI', 4192.90),
        ('PLAYER_BOJU',    10483.75),
        ('PLAYER_LUCKY',   2794.40),
        ('PLAYER_HEIMA',   3891.25)
) AS d(acc, bal) ON p.account_normalized = d.acc
ON CONFLICT (player_id) DO NOTHING;

-- 初始注资流水记录
INSERT INTO wallet_transactions (
    player_id, transaction_type, amount, balance_before, balance_after,
    reference_type, reference_id, idempotency_key, metadata_json, created_at)
SELECT
    p.id, 'INIT_GRANT', w.balance, 0.00, w.balance, 'SYSTEM', p.id::TEXT,
    'seed:init:' || p.account_normalized, '{"note":"seed initial grant"}'::JSONB, NOW() - INTERVAL '10 days'
FROM players AS p
JOIN wallets AS w ON w.player_id = p.id
ON CONFLICT (idempotency_key) DO NOTHING;

-- 玩家默认角色装配
INSERT INTO player_characters (
    player_id, character_id, level, exp, is_equipped, obtained_at, equipped_at, updated_at)
SELECT
    p.id, c.id, 1, 0, TRUE, NOW(), NOW(), NOW()
FROM players AS p
CROSS JOIN character_catalogs AS c
WHERE c.character_code = 'CHARACTER_ROOKIE_JOCKEY'
ON CONFLICT (player_id, character_id) DO NOTHING;

-- 测试玩家额外拥有的装扮与道具资产（便于调试背包与装扮页面）
INSERT INTO player_cosmetics (
    player_id, cosmetic_id, slot_type, is_equipped, obtained_at, equipped_at, updated_at)
SELECT
    p.id, cos.id, cos.slot_type, TRUE, NOW(), NOW(), NOW()
FROM players AS p
CROSS JOIN cosmetic_catalogs AS cos
WHERE p.account_normalized = 'TESTPLAYER01'
  AND cos.cosmetic_code IN ('COSMETIC_CAP_CLASSIC', 'COSMETIC_SUIT_CLASSIC', 'COSMETIC_WHIP_LEATHER')
ON CONFLICT (player_id, cosmetic_id) DO NOTHING;

INSERT INTO player_items (player_id, item_id, quantity, created_at, updated_at)
SELECT
    p.id, item.id, d.qty, NOW(), NOW()
FROM players AS p
CROSS JOIN item_catalogs AS item
JOIN (
    VALUES
        ('ITEM_RACE_TICKET', 5),
        ('ITEM_TRAINING_BADGE', 8),
        ('ITEM_CARROT_CRUNCH', 12),
        ('ITEM_EXP_SCROLL_S', 2)
) AS d(code, qty) ON d.code = item.item_code
WHERE p.account_normalized = 'TESTPLAYER01'
ON CONFLICT (player_id, item_id) DO UPDATE SET
    quantity = EXCLUDED.quantity,
    updated_at = NOW();

-- 测试玩家每日任务领奖前置状态
INSERT INTO player_daily_tasks (
    player_id, task_definition_id, business_date, progress, is_completed, completed_at, claimed_at, updated_at)
SELECT
    p.id, t.id, (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::DATE, 1, TRUE, NOW() - INTERVAL '1 hour', NULL, NOW()
FROM players AS p
JOIN daily_task_definitions AS t ON t.task_code = 'DAILY_RACE_COUNT_1'
WHERE p.account_normalized = 'TESTPLAYER01'
ON CONFLICT (player_id, task_definition_id, business_date) DO NOTHING;

INSERT INTO player_daily_tasks (
    player_id, task_definition_id, business_date, progress, is_completed, completed_at, claimed_at, updated_at)
SELECT
    p.id, t.id, (CURRENT_TIMESTAMP AT TIME ZONE 'Europe/London')::DATE, 2, FALSE, NULL, NULL, NOW()
FROM players AS p
JOIN daily_task_definitions AS t ON t.task_code = 'DAILY_RACE_COUNT_3'
WHERE p.account_normalized = 'TESTPLAYER01'
ON CONFLICT (player_id, task_definition_id, business_date) DO NOTHING;

-- =========================================================
-- 11. 八场历史已结算赛果轮次 (race_rounds, race_horses)
-- =========================================================
-- 为前端 /api/race/history?limit=8 与赛果回放、名次走势图提供立即可见的真实历史赛果数据。
-- 状态固定为 6 (RaceState.Finished)，各轮冠军分别为：1号、3号、2号、4号、1号、6号、2号、5号。

DO $$
DECLARE
    r_no VARCHAR(32);
    r_id BIGINT;
    r_start TIMESTAMPTZ;
    r_winner INT;
    h_ids BIGINT[];
    h_names VARCHAR(128)[];
    round_idx INT;
    winners INT[] := ARRAY[1, 3, 2, 4, 1, 6, 2, 5];
BEGIN
    SELECT ARRAY_AGG(id ORDER BY sort_order, id), ARRAY_AGG(name_zh ORDER BY sort_order, id)
    INTO h_ids, h_names
    FROM horse_catalogs
    WHERE is_enabled
    LIMIT 6;

    FOR round_idx IN 1..8 LOOP
        r_no := '2026091012000' || round_idx;
        r_start := NOW() - ((9 - round_idx) * 15 || ' minutes')::INTERVAL;
        r_winner := winners[round_idx];

        INSERT INTO race_rounds (
            round_no, state, betting_start_at, betting_end_at, prepare_start_at,
            race_start_at, race_end_at, settlement_at, winner_horse_no, bet_count,
            total_bet_amount, betting_duration_seconds, prepare_duration_seconds,
            race_duration_seconds, post_race_interval_seconds, odds_algorithm_version,
            result_algorithm_version, black_horse_algorithm_version, settlement_version,
            result_seed, result_seed_commitment, selected_horse_snapshot_json,
            odds_snapshot_json, round_rule_snapshot_json, created_at, updated_at)
        VALUES (
            r_no, 6, r_start, r_start + INTERVAL '180 seconds', r_start + INTERVAL '180 seconds',
            r_start + INTERVAL '195 seconds', r_start + INTERVAL '225 seconds', r_start + INTERVAL '230 seconds',
            r_winner, 12, 1850.00, 180, 15, 30, 75, 'odds:v1', 'result:v1', 'blackhorse:v1', 'settlement:v1',
            'seed:hist:' || r_no, 'commit:hist:' || r_no,
            jsonb_build_array(
                jsonb_build_object('horseNo', 1, 'name', h_names[1]),
                jsonb_build_object('horseNo', 2, 'name', h_names[2]),
                jsonb_build_object('horseNo', 3, 'name', h_names[3]),
                jsonb_build_object('horseNo', 4, 'name', h_names[4]),
                jsonb_build_object('horseNo', 5, 'name', h_names[5]),
                jsonb_build_object('horseNo', 6, 'name', h_names[6])
            ),
            jsonb_build_array(
                jsonb_build_object('horseNo', 1, 'odds', 3.80),
                jsonb_build_object('horseNo', 2, 'odds', 4.50),
                jsonb_build_object('horseNo', 3, 'odds', 5.20),
                jsonb_build_object('horseNo', 4, 'odds', 6.50),
                jsonb_build_object('horseNo', 5, 'odds', 8.00),
                jsonb_build_object('horseNo', 6, 'odds', 11.50)
            ),
            '{"seedPurpose":"historical-race-archive"}'::JSONB,
            r_start, r_start + INTERVAL '230 seconds'
        )
        ON CONFLICT (round_no) DO UPDATE SET
            state = 6,
            winner_horse_no = EXCLUDED.winner_horse_no,
            updated_at = NOW()
        RETURNING id INTO r_id;

        -- 插入当轮参赛马匹（1~6 号名次闭环，确保冠军与 r_winner 完全一致）
        INSERT INTO race_horses (
            round_id, horse_no, horse_template_id, horse_name_zh_snapshot,
            odds, final_rank, finish_time, total_races_snapshot, win_count_snapshot,
            win_rate_snapshot, rank_1_probability_snapshot, created_at)
        VALUES
            (r_id, 1, h_ids[1], h_names[1], 3.80, CASE WHEN r_winner=1 THEN 1 ELSE CASE WHEN r_winner=2 THEN 2 WHEN r_winner=3 THEN 2 ELSE 3 END END, 28.5200, 100, 25, 0.250000, 0.250000, r_start),
            (r_id, 2, h_ids[2], h_names[2], 4.50, CASE WHEN r_winner=2 THEN 1 ELSE CASE WHEN r_winner=1 THEN 2 WHEN r_winner=3 THEN 3 ELSE 2 END END, 28.8400, 100, 21, 0.210000, 0.210000, r_start),
            (r_id, 3, h_ids[3], h_names[3], 5.20, CASE WHEN r_winner=3 THEN 1 ELSE CASE WHEN r_winner=4 THEN 2 WHEN r_winner=2 THEN 3 ELSE 4 END END, 29.1100, 100, 18, 0.180000, 0.180000, r_start),
            (r_id, 4, h_ids[4], h_names[4], 6.50, CASE WHEN r_winner=4 THEN 1 ELSE CASE WHEN r_winner=5 THEN 2 WHEN r_winner=6 THEN 2 ELSE 4 END END, 29.4500, 100, 15, 0.150000, 0.150000, r_start),
            (r_id, 5, h_ids[5], h_names[5], 8.00, CASE WHEN r_winner=5 THEN 1 ELSE CASE WHEN r_winner=6 THEN 3 ELSE 5 END END, 29.8900, 100, 12, 0.120000, 0.120000, r_start),
            (r_id, 6, h_ids[6], h_names[6], 11.50, CASE WHEN r_winner=6 THEN 1 ELSE 6 END, 30.2100, 100, 9, 0.090000, 0.090000, r_start)
        ON CONFLICT (round_id, horse_no) DO NOTHING;

        -- 插入当轮结算记录与状态流转审计
        INSERT INTO race_settlement_runs (
            round_id, run_status, run_reason, execution_key, orders_scanned_count,
            orders_settled_count, failed_order_count, started_at, finished_at)
        VALUES (
            r_id, 'SUCCESS', 'REGULAR_SETTLEMENT', 'exec:seed:' || r_no,
            12, 12, 0, r_start + INTERVAL '228 seconds', r_start + INTERVAL '230 seconds'
        )
        ON CONFLICT (execution_key) DO NOTHING;

        INSERT INTO race_round_state_logs (
            round_id, from_state, to_state, trigger_source, execution_status, created_at)
        VALUES
            (r_id, 1, 3, 'WORKER_TIMER', 'SUCCESS', r_start + INTERVAL '180 seconds'),
            (r_id, 3, 4, 'WORKER_TIMER', 'SUCCESS', r_start + INTERVAL '195 seconds'),
            (r_id, 4, 6, 'WORKER_SETTLE', 'SUCCESS', r_start + INTERVAL '230 seconds')
        ON CONFLICT DO NOTHING;

    END LOOP;
END
$$;

-- =========================================================
-- 12. 测试玩家历史下注订单与账单流水 (bet_orders, wallet_transactions)
-- =========================================================
-- 在第 1、3、5、7 轮为 testplayer01 生成 4 笔已结算的下注单：
-- 第1轮: 下注 100 金币买 1 号马（胜，赔率3.80，奖金 380.00，手续费 0.19，净收益 379.81）
-- 第3轮: 下注 200 金币买 1 号马（负，本轮冠军为2号马，扣除 200.00）
-- 第5轮: 下注 50 金币买 1 号马（胜，赔率4.90，奖金 245.00，手续费 0.12，净收益 244.88）
-- 第7轮: 下注 100 金币买 3 号马（负，本轮冠军为2号马，扣除 100.00）
-- 支撑 V2.0 新增的“钱包账单流水”与“我的下注记录”页面实时查看。

DO $$
DECLARE
    v_player_id BIGINT;
    r1_id BIGINT;
    r3_id BIGINT;
    r5_id BIGINT;
    r7_id BIGINT;
    tx_bet1 BIGINT;
    tx_pay1 BIGINT;
    tx_bet3 BIGINT;
    tx_bet5 BIGINT;
    tx_pay5 BIGINT;
    tx_bet7 BIGINT;
BEGIN
    SELECT id INTO v_player_id FROM players WHERE account_normalized = 'TESTPLAYER01';
    SELECT id INTO r1_id FROM race_rounds WHERE round_no = '20260910120001';
    SELECT id INTO r3_id FROM race_rounds WHERE round_no = '20260910120003';
    SELECT id INTO r5_id FROM race_rounds WHERE round_no = '20260910120005';
    SELECT id INTO r7_id FROM race_rounds WHERE round_no = '20260910120007';

    IF v_player_id IS NOT NULL AND r1_id IS NOT NULL THEN

        -- 流水 1: 下注扣款 100 (5000 -> 4900)
        INSERT INTO wallet_transactions (
            player_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, idempotency_key, created_at)
        VALUES (
            v_player_id, 'BET_DEDUCT', -100.00, 5000.00, 4900.00,
            'BET_ORDER', 'BET_SEED_001', 'seed:tx:bet1', NOW() - INTERVAL '115 minutes'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO tx_bet1;

        -- 流水 2: 派奖 379.81 (4900 -> 5279.81)
        INSERT INTO wallet_transactions (
            player_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, idempotency_key, created_at)
        VALUES (
            v_player_id, 'BET_PAYOUT', 379.81, 4900.00, 5279.81,
            'BET_ORDER', 'BET_SEED_001', 'seed:tx:pay1', NOW() - INTERVAL '111 minutes'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO tx_pay1;

        -- 订单 1: 获胜
        INSERT INTO bet_orders (
            order_no, player_id, round_id, horse_no, bet_amount, locked_odds,
            potential_reward, gross_reward, fee_rate, fee_amount, net_reward,
            rounding_version, status, status_reason, idempotency_key,
            bet_transaction_id, reward_transaction_id, created_at, settled_at)
        VALUES (
            'BET_SEED_001', v_player_id, r1_id, 1, 100.00, 3.80,
            380.00, 380.00, 0.000500, 0.19, 379.81,
            'money:v1', 2, 'WIN', 'seed:order:001',
            tx_bet1, tx_pay1, NOW() - INTERVAL '115 minutes', NOW() - INTERVAL '111 minutes'
        )
        ON CONFLICT (order_no) DO NOTHING;

        -- 流水 3: 下注扣款 200 (5279.81 -> 5079.81)
        INSERT INTO wallet_transactions (
            player_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, idempotency_key, created_at)
        VALUES (
            v_player_id, 'BET_DEDUCT', -200.00, 5279.81, 5079.81,
            'BET_ORDER', 'BET_SEED_002', 'seed:tx:bet3', NOW() - INTERVAL '85 minutes'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO tx_bet3;

        -- 订单 2: 未中奖
        INSERT INTO bet_orders (
            order_no, player_id, round_id, horse_no, bet_amount, locked_odds,
            potential_reward, gross_reward, fee_rate, fee_amount, net_reward,
            rounding_version, status, status_reason, idempotency_key,
            bet_transaction_id, reward_transaction_id, created_at, settled_at)
        VALUES (
            'BET_SEED_002', v_player_id, r3_id, 1, 200.00, 3.80,
            760.00, 0.00, 0.00, 0.00, 0.00,
            'money:v1', 3, 'LOSE', 'seed:order:002',
            tx_bet3, NULL, NOW() - INTERVAL '85 minutes', NOW() - INTERVAL '81 minutes'
        )
        ON CONFLICT (order_no) DO NOTHING;

        -- 流水 4: 下注扣款 50 (5079.81 -> 5029.81)
        INSERT INTO wallet_transactions (
            player_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, idempotency_key, created_at)
        VALUES (
            v_player_id, 'BET_DEDUCT', -50.00, 5079.81, 5029.81,
            'BET_ORDER', 'BET_SEED_003', 'seed:tx:bet5', NOW() - INTERVAL '55 minutes'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO tx_bet5;

        -- 流水 5: 派奖 244.88 (5029.81 -> 5274.69)
        INSERT INTO wallet_transactions (
            player_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, idempotency_key, created_at)
        VALUES (
            v_player_id, 'BET_PAYOUT', 244.88, 5029.81, 5274.69,
            'BET_ORDER', 'BET_SEED_003', 'seed:tx:pay5', NOW() - INTERVAL '51 minutes'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO tx_pay5;

        -- 订单 3: 获胜
        INSERT INTO bet_orders (
            order_no, player_id, round_id, horse_no, bet_amount, locked_odds,
            potential_reward, gross_reward, fee_rate, fee_amount, net_reward,
            rounding_version, status, status_reason, idempotency_key,
            bet_transaction_id, reward_transaction_id, created_at, settled_at)
        VALUES (
            'BET_SEED_003', v_player_id, r5_id, 1, 50.00, 4.90,
            245.00, 245.00, 0.000500, 0.12, 244.88,
            'money:v1', 2, 'WIN', 'seed:order:003',
            tx_bet5, tx_pay5, NOW() - INTERVAL '55 minutes', NOW() - INTERVAL '51 minutes'
        )
        ON CONFLICT (order_no) DO NOTHING;

        -- 流水 6: 下注扣款 100 (5274.69 -> 5174.69)
        INSERT INTO wallet_transactions (
            player_id, transaction_type, amount, balance_before, balance_after,
            reference_type, reference_id, idempotency_key, created_at)
        VALUES (
            v_player_id, 'BET_DEDUCT', -100.00, 5274.69, 5174.69,
            'BET_ORDER', 'BET_SEED_004', 'seed:tx:bet7', NOW() - INTERVAL '25 minutes'
        )
        ON CONFLICT (idempotency_key) DO NOTHING
        RETURNING id INTO tx_bet7;

        -- 订单 4: 未中奖
        INSERT INTO bet_orders (
            order_no, player_id, round_id, horse_no, bet_amount, locked_odds,
            potential_reward, gross_reward, fee_rate, fee_amount, net_reward,
            rounding_version, status, status_reason, idempotency_key,
            bet_transaction_id, reward_transaction_id, created_at, settled_at)
        VALUES (
            'BET_SEED_004', v_player_id, r7_id, 3, 100.00, 5.20,
            520.00, 0.00, 0.00, 0.00, 0.00,
            'money:v1', 3, 'LOSE', 'seed:order:004',
            tx_bet7, NULL, NOW() - INTERVAL '25 minutes', NOW() - INTERVAL '21 minutes'
        )
        ON CONFLICT (order_no) DO NOTHING;

    END IF;
END
$$;

-- =========================================================
-- 13. 本地管理后台管理员与角色权限 (admin_users, admin_roles)
-- =========================================================
-- 用户名：admin
-- 初始密码：RaceGame@2026 (PBKDF2-SHA256-100000 算法)
-- 仅供开发调试验证；在生产迁移 006_v2_hardening.sql 中会自动置为禁用状态。

INSERT INTO admin_users (
    username, username_normalized, password_hash, password_algorithm,
    password_version, is_active, created_at, updated_at)
VALUES (
    'admin', 'ADMIN',
    'S6MV+iLCa4uMf/P4EnYmcw==.gLrU96iIyWvHyVVDfj1sf7mw9/R8aznTSNrUj5RU58Q=',
    'PBKDF2-SHA256-100000', 1, TRUE, NOW(), NOW()
)
ON CONFLICT (username_normalized) DO NOTHING;

INSERT INTO admin_roles (role_code, role_name, description, created_at, updated_at)
VALUES
    ('ROLE_SUPER_ADMIN', '超级管理员', '拥有管理后台全部功能与审计权限', NOW(), NOW()),
    ('ROLE_OPERATOR',    '运营管理员', '拥有活动发布、商城管理与轮次监控权限', NOW(), NOW())
ON CONFLICT (role_code) DO NOTHING;

INSERT INTO admin_user_roles (admin_user_id, admin_role_id, created_at)
SELECT u.id, r.id, NOW()
FROM admin_users AS u
CROSS JOIN admin_roles AS r
WHERE u.username_normalized = 'ADMIN'
  AND r.role_code = 'ROLE_SUPER_ADMIN'
ON CONFLICT (admin_user_id, admin_role_id) DO NOTHING;

-- =========================================================
-- 14. 导入完整性检查断言
-- =========================================================

DO $$
DECLARE
    v_horse_count INT;
    v_product_count INT;
    v_character_count INT;
    v_item_count INT;
    v_cosmetic_count INT;
    v_task_count INT;
    v_player_count INT;
    v_round_count INT;
    v_test_wallet_count INT;
BEGIN
    SELECT COUNT(*) INTO v_horse_count FROM horse_catalogs WHERE is_enabled;
    SELECT COUNT(*) INTO v_product_count FROM shop_products WHERE is_enabled AND is_visible AND currency_type = 'COIN';
    SELECT COUNT(*) INTO v_character_count FROM character_catalogs WHERE is_enabled;
    SELECT COUNT(*) INTO v_item_count FROM item_catalogs WHERE is_enabled;
    SELECT COUNT(*) INTO v_cosmetic_count FROM cosmetic_catalogs WHERE is_enabled;
    SELECT COUNT(*) INTO v_task_count FROM daily_task_definitions WHERE is_enabled;
    SELECT COUNT(*) INTO v_player_count FROM players WHERE is_active;
    SELECT COUNT(*) INTO v_round_count FROM race_rounds WHERE state = 6;
    SELECT COUNT(*) INTO v_test_wallet_count FROM players p JOIN wallets w ON w.player_id = p.id WHERE p.account_normalized = 'TESTPLAYER01';

    IF v_horse_count < 12 THEN
        RAISE EXCEPTION '种子数据校验失败：启用赛马数量不足 12 匹，实际为 %', v_horse_count;
    END IF;

    IF v_product_count < 10 THEN
        RAISE EXCEPTION '种子数据校验失败：可见金币商品数量不足 10 项，实际为 %', v_product_count;
    END IF;

    IF v_character_count < 5 THEN
        RAISE EXCEPTION '种子数据校验失败：启用角色数量不足 5 个，实际为 %', v_character_count;
    END IF;

    IF v_item_count < 8 THEN
        RAISE EXCEPTION '种子数据校验失败：启用道具数量不足 8 种，实际为 %', v_item_count;
    END IF;

    IF v_cosmetic_count < 10 THEN
        RAISE EXCEPTION '种子数据校验失败：启用装扮数量不足 10 件，实际为 %', v_cosmetic_count;
    END IF;

    IF v_task_count < 9 THEN
        RAISE EXCEPTION '种子数据校验失败：日常任务数量不足 9 项，实际为 %', v_task_count;
    END IF;

    IF v_player_count < 10 THEN
        RAISE EXCEPTION '种子数据校验失败：榜单玩家数量不足 10 人，实际为 %', v_player_count;
    END IF;

    IF v_round_count < 8 THEN
        RAISE EXCEPTION '种子数据校验失败：历史完赛轮次数量不足 8 场，实际为 %', v_round_count;
    END IF;

    IF v_test_wallet_count <> 1 THEN
        RAISE EXCEPTION '种子数据校验失败：测试玩家钱包缺失';
    END IF;
END
$$;

-- COMMIT; (managed by outer transaction)

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 004_add_game_domain_logs.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 005_add_active_round_partial_index.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- =========================================================
-- RaceGame V1.5.2：活动轮次部分唯一索引
-- =========================================================
-- 业务规则：
-- 1. 任何时刻最多只能存在一个处于活动状态（下注/关闭/准备/比赛/结算）的轮次。
-- 2. 状态值契约：1: Betting, 2: Closed, 3: Preparing, 4: Racing, 5: Settlement, 6: Finished, 7: Cancelled。
-- 3. 使用部分唯一索引在数据库层面硬性保证同一时刻仅有一个活动轮次，防止 Worker 并发时产生双胞胎轮次。
-- =========================================================

CREATE UNIQUE INDEX IF NOT EXISTS ux_race_rounds_single_active
    ON race_rounds ((1))
    WHERE state IN (1, 2, 3, 4, 5);

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 006_v2_hardening.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- RaceGame V2.0：幂等请求指纹。
-- 不修改历史迁移；旧订单允许 NULL，新订单由应用写入 SHA-256 指纹。
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);
ALTER TABLE shop_orders ADD COLUMN IF NOT EXISTS request_hash VARCHAR(64);

CREATE INDEX IF NOT EXISTS idx_bet_orders_player_created_at
    ON bet_orders (player_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_shop_orders_player_created_at
    ON shop_orders (player_id, created_at DESC);

-- 禁用历史迁移中仅用于本地开发的固定管理员凭据。
UPDATE admin_users
SET is_active = FALSE, updated_at = NOW()
WHERE username_normalized = 'ADMIN';

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 007_expand_daily_tasks.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- ============================================================================
-- Migration: 007_expand_daily_tasks.sql
-- Description: 依据 PRD 6.10 规范，扩充并对齐完整的 9 个每日任务定义
--              比赛场数（3、10、20）、比赛胜场（1、3、5）、比赛负场（1、3、5）
-- ============================================================================

INSERT INTO daily_task_definitions (
    task_code,
    task_type,
    title_zh,
    title_en,
    description_zh,
    description_en,
    target_value,
    condition_payload_json,
    reward_type,
    reward_payload,
    version,
    is_enabled,
    sort_order,
    created_at,
    updated_at
)
VALUES
    -- 1. 比赛场数任务 (3, 10, 20)
    ('DAILY_RACE_COUNT_3', 'RACE_COUNT', '累计完成3场比赛', 'Complete 3 Races', '当天累计参与并结算3场比赛。', 'Participate in and settle 3 races during the business day.', 3, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":150}'::JSONB, 1, TRUE, 10, NOW(), NOW()),
    ('DAILY_RACE_COUNT_10', 'RACE_COUNT', '累计完成10场比赛', 'Complete 10 Races', '当天累计参与并结算10场比赛。', 'Participate in and settle 10 races during the business day.', 10, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":400}'::JSONB, 1, TRUE, 20, NOW(), NOW()),
    ('DAILY_RACE_COUNT_20', 'RACE_COUNT', '累计完成20场比赛', 'Complete 20 Races', '当天累计参与并结算20场比赛。', 'Participate in and settle 20 races during the business day.', 20, '{"metric":"settledRaceCount"}'::JSONB, 'COIN', '{"amount":1000}'::JSONB, 1, TRUE, 30, NOW(), NOW()),

    -- 2. 比赛胜场任务 (1, 3, 5)
    ('DAILY_RACE_WIN_1', 'RACE_WIN', '赢得1场比赛', 'Win 1 Race', '当天在任意一场已结算比赛中获胜。', 'Win any settled race during the business day.', 1, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":200}'::JSONB, 1, TRUE, 40, NOW(), NOW()),
    ('DAILY_RACE_WIN_3', 'RACE_WIN', '累计赢得3场比赛', 'Win 3 Races', '当天累计在3场已结算比赛中获胜。', 'Win 3 settled races during the business day.', 3, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":500}'::JSONB, 1, TRUE, 50, NOW(), NOW()),
    ('DAILY_RACE_WIN_5', 'RACE_WIN', '累计赢得5场比赛', 'Win 5 Races', '当天累计在5场已结算比赛中获胜。', 'Win 5 settled races during the business day.', 5, '{"metric":"settledRaceWinCount"}'::JSONB, 'COIN', '{"amount":1200}'::JSONB, 1, TRUE, 60, NOW(), NOW()),

    -- 3. 比赛负场任务 (1, 3, 5)
    ('DAILY_RACE_LOSS_1', 'RACE_LOSS', '完成1场未获胜比赛', 'Complete 1 Losing Race', '当天参与一场已结算但未获胜的比赛。', 'Complete one settled race without winning during the business day.', 1, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":80}'::JSONB, 1, TRUE, 70, NOW(), NOW()),
    ('DAILY_RACE_LOSS_3', 'RACE_LOSS', '累计3场未获胜比赛', 'Complete 3 Losing Races', '当天累计参与3场已结算但未获胜的比赛。', 'Complete 3 settled races without winning during the business day.', 3, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":200}'::JSONB, 1, TRUE, 80, NOW(), NOW()),
    ('DAILY_RACE_LOSS_5', 'RACE_LOSS', '累计5场未获胜比赛', 'Complete 5 Losing Races', '当天累计参与5场已结算但未获胜的比赛。', 'Complete 5 settled races without winning during the business day.', 5, '{"metric":"settledRaceLossCount"}'::JSONB, 'COIN', '{"amount":400}'::JSONB, 1, TRUE, 90, NOW(), NOW())
ON CONFLICT (task_code) DO UPDATE SET
    task_type = EXCLUDED.task_type,
    title_zh = EXCLUDED.title_zh,
    title_en = EXCLUDED.title_en,
    description_zh = EXCLUDED.description_zh,
    description_en = EXCLUDED.description_en,
    target_value = EXCLUDED.target_value,
    condition_payload_json = EXCLUDED.condition_payload_json,
    reward_type = EXCLUDED.reward_type,
    reward_payload = EXCLUDED.reward_payload,
    version = EXCLUDED.version,
    is_enabled = EXCLUDED.is_enabled,
    sort_order = EXCLUDED.sort_order,
    updated_at = NOW();

-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
-- START OF MODULE: 008_v2_1_features.sql
-- >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>>
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

-- ----------------------------------------------------------------------------
-- 街机经典黄金赛马 15 组连赢（二连碰 Quinella）模式扩展
-- ----------------------------------------------------------------------------
ALTER TABLE bet_orders
    ADD COLUMN IF NOT EXISTS play_type VARCHAR(16) NOT NULL DEFAULT 'WIN',
    ADD COLUMN IF NOT EXISTS second_horse_no SMALLINT NULL,
    ADD COLUMN IF NOT EXISTS combination VARCHAR(16) NULL;

CREATE INDEX IF NOT EXISTS idx_bet_orders_round_play_type
    ON bet_orders(round_id, play_type);

ALTER TABLE race_rounds
    ADD COLUMN IF NOT EXISTS second_horse_no SMALLINT NULL,
    ADD COLUMN IF NOT EXISTS quinella_odds_snapshot_json JSONB NULL;

COMMENT ON COLUMN bet_orders.play_type IS '玩法类型：WIN（单马独赢）、QUINELLA（街机连赢/二连碰）';
COMMENT ON COLUMN bet_orders.second_horse_no IS '连赢第二匹马号（1~6）；独赢玩法为 NULL';
COMMENT ON COLUMN bet_orders.combination IS '连赢标准化组合键（较小马号在前，如 1-2）';

-- ----------------------------------------------------------------------------
-- 010: 规则决策放开选马限制（将 race_bet_selections 唯一约束由 (player_id, round_id) 升级为 (player_id, round_id, horse_no)）
-- ----------------------------------------------------------------------------
ALTER TABLE race_bet_selections DROP CONSTRAINT IF EXISTS uq_race_bet_selections;
ALTER TABLE race_bet_selections ADD CONSTRAINT uq_race_bet_selections UNIQUE (player_id, round_id, horse_no);

-- ----------------------------------------------------------------------------
-- 011: 命中连胜与盈利胜局细分、下级负盈利返佣与未结佣金提炼
-- ----------------------------------------------------------------------------
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS total_net_profit_wins BIGINT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_hit_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS max_hit_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS current_profit_streak INT NOT NULL DEFAULT 0;
ALTER TABLE player_stats ADD COLUMN IF NOT EXISTS max_profit_streak INT NOT NULL DEFAULT 0;

ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS round_id BIGINT REFERENCES race_rounds(id) ON DELETE SET NULL;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS net_loss_amount NUMERIC(20, 2) NOT NULL DEFAULT 0;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS commission_rate NUMERIC(10, 6) NOT NULL DEFAULT 0;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS claimed_at TIMESTAMPTZ;
ALTER TABLE player_referral_rewards ADD COLUMN IF NOT EXISTS claim_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_player_referral_rewards_claim ON player_referral_rewards(referrer_player_id, status) WHERE status = 'UNCLAIMED';

-- ----------------------------------------------------------------------------
-- 012: 浮动彩池稀释赔率、停机维护时间窗口、退款流水与千分之10~百分之2规费阶梯
-- ----------------------------------------------------------------------------
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_start_at TIMESTAMPTZ;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_end_at TIMESTAMPTZ;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS is_maintenance_enabled BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_notice_minutes INT NOT NULL DEFAULT 30;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS maintenance_reason VARCHAR(256);
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS max_round_payout_liability NUMERIC(20, 2) NOT NULL DEFAULT 500000.00;
ALTER TABLE race_rule_configs ADD COLUMN IF NOT EXISTS referral_commission_rate NUMERIC(10, 6) NOT NULL DEFAULT 0.005000;

ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS payout_pool_amount NUMERIC(20, 2) NOT NULL DEFAULT 0.00;
ALTER TABLE race_rounds ADD COLUMN IF NOT EXISTS dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000;

ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS refund_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL;

UPDATE race_rule_configs
SET fee_schedule_json = '[{"maximumGrossReward":10000.00,"rate":0.010},{"maximumGrossReward":50000.00,"rate":0.012},{"maximumGrossReward":100000.00,"rate":0.015},{"maximumGrossReward":null,"rate":0.020}]'::jsonb,
    referral_commission_rate = 0.005000,
    updated_at = NOW()
WHERE config_code IN ('default', 'DEFAULT_RULES');

-- ----------------------------------------------------------------------------
-- 013: 赛马玩法拓展与关键控制节点参数（Photo Finish慢动作、全服大奖池、局内冲刺加倍、专属马房等）
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

ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS third_horse_no INT DEFAULT NULL;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS is_double_down BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE bet_orders ADD COLUMN IF NOT EXISTS double_down_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00;

COMMENT ON COLUMN bet_orders.third_horse_no IS '三重彩或三连碰模式下的第三匹马号';
COMMENT ON COLUMN bet_orders.is_double_down IS '是否在开赛第 15 秒触发冲刺加倍追投';
COMMENT ON COLUMN bet_orders.double_down_amount IS '冲刺加倍追投追加扣除的金额';

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

INSERT INTO jackpot_pools (pool_code, current_amount, seed_amount, tax_rate, total_paid_out, updated_at)
VALUES ('MEGA_COIN_POOL', 100000.00, 100000.00, 0.0150, 0.00, NOW())
ON CONFLICT (pool_code) DO NOTHING;

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

-- ============================================================================
-- 14. wallets 表新增 frozen_balance 字段
-- ============================================================================
ALTER TABLE wallets 
ADD COLUMN IF NOT EXISTS frozen_balance NUMERIC(20, 2) NOT NULL DEFAULT 0.00 CHECK (frozen_balance >= 0);

COMMENT ON COLUMN wallets.frozen_balance IS '拍卖竞价等业务冻结资金，可用余额为 balance';

-- ============================================================================
-- 15. 模式三：西部纯血马房养成、装备、资格审核、巡回赛与交易核心表结构与种子数据
-- ============================================================================

-- 15.1 牧场马匹主表
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

-- 15.2 装备字典与装备实例表
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

-- 15.3 投喂日志表
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

-- 15.4 训练日志表 (含 temperament_delta)
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

-- 15.5 资格审核考核记录表
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

-- 15.6 职业巡回赛事主表与报名单
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

-- 15.7 繁育档案表
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

-- 15.8 拍卖行主表与竞价流水
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

-- 15.9 点对点转让契约表
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

-- 15.10 后台任务作业表
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

-- 15.11 种子数据初始化 (装备字典)
INSERT INTO ranch_equipment_items (item_code, item_name, slot_category, weight_kg, speed_bonus, stamina_bonus, burst_bonus, agility_bonus, turf_modifier, dirt_modifier, muddy_modifier, max_durability, price_coin, is_enabled)
VALUES 
('SAD_STD_01', '标准加利福尼亚轻型鞍', 'SADDLE', 4.00, 0.00, 0.00, 0.00, 0.00, 1.00, 1.00, 1.00, 100, 150.00, TRUE),
('SAD_LEA_02', '手工赛级真皮减负鞍', 'SADDLE', 2.50, 0.80, 0.50, 1.20, 0.50, 1.00, 1.00, 1.00, 80, 350.00, TRUE),
('STP_BRS_01', '黄铜深槽重心稳定镫', 'STIRRUP', 1.20, 0.00, 0.30, 0.00, 1.50, 1.00, 1.00, 1.00, 120, 200.00, TRUE),
('SHU_ALU_01', '铝合金草地轻量蹄铁', 'HORSESHOE', 0.80, 1.00, 0.00, 0.80, 0.00, 1.03, 0.98, 1.00, 50, 180.00, TRUE),
('SHU_CLK_02', '深齿防滑泥地抓地铁', 'HORSESHOE', 1.50, -0.50, 1.00, 0.50, 1.00, 0.98, 1.00, 1.05, 60, 220.00, TRUE)
ON CONFLICT (item_code) DO NOTHING;

-- ============================================================================
-- 16. 比赛环境、赛况解说、专家推荐、玩法系数及牧场养成（幼驹/饲料/训练/医护）字典主数据与配置动态化
-- ============================================================================

-- 16.1 比赛环境配置表 (天气与赛道主数据)
CREATE TABLE IF NOT EXISTS race_environments (
    id BIGSERIAL PRIMARY KEY,
    environment_type VARCHAR(16) NOT NULL CHECK (environment_type IN ('WEATHER', 'TRACK')),
    code VARCHAR(32) NOT NULL UNIQUE,
    name_zh VARCHAR(48) NOT NULL,
    name_en VARCHAR(48) NOT NULL,
    description_zh VARCHAR(256) NULL,
    description_en VARCHAR(256) NULL,
    adaptation_bonus_rate NUMERIC(6, 4) NOT NULL DEFAULT 1.0800,
    selection_weight INT NOT NULL DEFAULT 100,
    visual_theme_key VARCHAR(64) NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16.2 赛况解说台本模板表
CREATE TABLE IF NOT EXISTS race_commentary_templates (
    id BIGSERIAL PRIMARY KEY,
    phase VARCHAR(16) NOT NULL CHECK (phase IN ('START', 'TURN', 'STRETCH', 'FINISH')),
    weather_condition VARCHAR(32) NULL,
    is_photo_finish BOOLEAN NOT NULL DEFAULT FALSE,
    trigger_second INT NOT NULL DEFAULT 1,
    text_zh VARCHAR(256) NOT NULL,
    text_en VARCHAR(256) NOT NULL,
    sound_cue VARCHAR(64) NULL,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 16.3 赛前专家推荐与评语模板表
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

-- 16.4 纯血牧场：幼驹血统档位表
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

-- 16.5 纯血牧场：草料饲料字典表
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

-- 16.6 纯血牧场：专项体能训练字典表
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

-- 16.7 纯血牧场：理疗医护字典表
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

-- 16.8 扩展 race_rule_configs 配置表
ALTER TABLE race_rule_configs
    ADD COLUMN IF NOT EXISTS payout_quinella_ratio NUMERIC(6, 4) NOT NULL DEFAULT 0.8600,
    ADD COLUMN IF NOT EXISTS payout_place_ratio NUMERIC(6, 4) NOT NULL DEFAULT 0.8800,
    ADD COLUMN IF NOT EXISTS payout_exacta_ratio NUMERIC(6, 4) NOT NULL DEFAULT 0.8400,
    ADD COLUMN IF NOT EXISTS black_horse_boost_multiplier NUMERIC(5, 2) NOT NULL DEFAULT 2.00,
    ADD COLUMN IF NOT EXISTS photo_finish_probability NUMERIC(5, 4) NOT NULL DEFAULT 0.3500,
    ADD COLUMN IF NOT EXISTS horse_count_per_round INT NOT NULL DEFAULT 6,
    ADD COLUMN IF NOT EXISTS score_weights_json JSONB NOT NULL DEFAULT '{"rank1":6,"rank2":5,"rank3":4,"rank4":3,"rank5":2,"rank6":1,"winRate":6}'::JSONB,
    ADD COLUMN IF NOT EXISTS stable_dividend_schedule_json JSONB NOT NULL DEFAULT '{"1":200.00,"2":100.00,"3":50.00}'::JSONB,
    ADD COLUMN IF NOT EXISTS play_type_odds_coefficients_json JSONB NOT NULL DEFAULT '{"PLACE":{"factor":0.40,"min":1.15,"max":4.50},"QUINELLAPLACE":{"factor":0.22,"min":1.50,"max":150.0},"EXACTA":{"factor":0.65,"min":3.0,"max":500.0},"TRIO":{"factor":0.15,"min":4.0,"max":1000.0},"TRIFECTA":{"factor":0.50,"min":6.0,"max":2000.0},"TIERCE":{"factor":0.50,"min":6.0,"max":2000.0}}'::JSONB,
    ADD COLUMN IF NOT EXISTS qualification_trial_benchmark NUMERIC(6, 3) NOT NULL DEFAULT 24.500,
    ADD COLUMN IF NOT EXISTS qualification_trial_base_time NUMERIC(6, 3) NOT NULL DEFAULT 25.800,
    ADD COLUMN IF NOT EXISTS qualification_license_fee NUMERIC(18, 2) NOT NULL DEFAULT 200.00,
    ADD COLUMN IF NOT EXISTS qualification_cooldown_hours INT NOT NULL DEFAULT 4,
    ADD COLUMN IF NOT EXISTS system_buyback_config_json JSONB NOT NULL DEFAULT '{"basePrices":{"WILD":150.00,"PLAINS_TB":400.00,"ROYAL":1200.00,"MYTHIC":3500.00},"levelBonus":25.00,"winBonus":100.00,"purseRate":0.05}'::JSONB;

-- 16.9 种子数据初始化
INSERT INTO race_environments (environment_type, code, name_zh, name_en, description_zh, description_en, adaptation_bonus_rate, selection_weight, visual_theme_key)
VALUES
('WEATHER', 'SUNNY', '晴空高照', 'Sunny', '阳光明媚，视野开阔，适合全速冲刺。', 'Bright sunlight, clear visibility, ideal for full-speed sprints.', 1.0800, 50, 'SKY_NOON'),
('WEATHER', 'RAINY', '暴雨倾盆', 'Rainy', '暴雨泥泞，极大考验赛马抓地与耐力。', 'Heavy rain and muddy tracks, demanding superior grip and endurance.', 1.0800, 25, 'SKY_DUSK'),
('WEATHER', 'CLOUDY', '荒野阴云', 'Cloudy', '微风凉爽，湿度适宜，各马匹状态均衡。', 'Cool breeze and overcast skies, optimal conditions for balanced racing.', 1.0800, 25, 'SKY_DAWN'),
('TRACK', 'TURF', '草地跑道', 'Turf', '经典绿茵跑道，摩擦力平稳，适合步伐轻盈之良驹。', 'Classic grass surface, smooth friction for agile gallopers.', 1.0800, 40, 'TURF'),
('TRACK', 'DIRT', '泥地跑道', 'Dirt', '粗粝沙泥赛道，对爆发力与后肢蹬踏力要求极高。', 'Coarse dirt track, challenging stride power and rear propulsion.', 1.0800, 35, 'DIRT'),
('TRACK', 'SAND', '沙漠跑道', 'Sand', '荒野细沙场地，深陷阻力大，强力耐力型赛马主场。', 'Deep sand surface, high resistance, favoring endurance specialists.', 1.0800, 25, 'SAND')
ON CONFLICT (code) DO NOTHING;

INSERT INTO race_commentary_templates (phase, weather_condition, is_photo_finish, trigger_second, text_zh, text_en, sound_cue)
SELECT v.phase, v.weather_condition, v.is_photo_finish, v.trigger_second, v.text_zh, v.text_en, v.sound_cue
FROM (VALUES
('START', 'RAINY', FALSE, 1, '闸门弹开！雨水浸湿了泥泞跑道，马蹄激荡飞沙！各驹如离弦之箭冲出起点！', 'Gates burst open! Rain soaks the muddy track, sand spraying with every stride! The field surges forward!', 'commentary_start'),
('START', 'CLOUDY', FALSE, 1, '闸门弹开！阴云密布，赛道硬朗，是一决胜负的好天气！全员冲刺！', 'Gates burst open! Overcast skies with a firm track, primed for a showdown! All horses charge!', 'commentary_start'),
('START', 'SUNNY', FALSE, 1, '闸门弹开！烈日灼烧荒野，漫天尘沙伴随着号角吹响！各驹激战拉开序幕！', 'Gates burst open! Blazing sun over the dusty frontier as the trumpet sounds! Battle commences!', 'commentary_start'),
('TURN', NULL, FALSE, 15, '转入决胜大弯道！冲刺加倍窗口开启！内道骑师猛烈发力推挤争先！', 'Sweeping into the final turn! In-play boost active! Jockeys attack the inside rail for position!', 'commentary_turn'),
('STRETCH', NULL, FALSE, 25, '进入最后决胜直道！全体起势，各驹爆发全部潜能展开终极火拼！', 'The home stretch! The field unleashes blistering sprints in an all-out battle!', 'commentary_stretch'),
('FINISH', NULL, FALSE, 28, '冲过终点线！领头健驹一马当先锁定胜局！', 'Across the finish line! The leader seals an emphatic victory!', 'commentary_finish'),
('FINISH', NULL, TRUE, 28, '终点线！双方并驾齐驱！鼻尖微差绝杀！谁才是最后的王者？！', 'Neck and neck at the wire! Incredible photo finish! Who took the glory?!', 'commentary_photofinish')
) AS v(phase, weather_condition, is_photo_finish, trigger_second, text_zh, text_en, sound_cue)
WHERE NOT EXISTS (
    SELECT 1 FROM race_commentary_templates t
    WHERE t.phase = v.phase
      AND COALESCE(t.weather_condition, '') = COALESCE(v.weather_condition, '')
      AND t.is_photo_finish = v.is_photo_finish
      AND t.trigger_second = v.trigger_second
);

INSERT INTO race_tipster_templates (match_condition, min_stars, max_stars, analysis_zh, analysis_en)
SELECT v.match_condition, v.min_stars, v.max_stars, v.analysis_zh, v.analysis_en
FROM (VALUES
('BOTH', 5, 5, '天候场地双重偏好契合，绝好调出战！', 'Weather and track preferences match perfectly, primed in peak form!'),
('TRACK_ONLY', 4, 4, '擅长当前场地，过弯机动性极强！', 'Excels on this track surface with superior cornering agility!'),
('WEATHER_ONLY', 4, 4, '适应当前气象环境，步伐轻快稳定！', 'Adapts effortlessly to the climate, maintaining balanced strides!'),
('DEFAULT', 3, 3, '稳扎稳打型悍驹，出闸爆发力不可小觑。', 'A dependable contender whose starting gate burst demands respect.')
) AS v(match_condition, min_stars, max_stars, analysis_zh, analysis_en)
WHERE NOT EXISTS (
    SELECT 1 FROM race_tipster_templates t
    WHERE t.match_condition = v.match_condition
);

INSERT INTO ranch_foal_tiers (tier_code, tier_name_zh, tier_name_en, adopt_price, min_potential, max_potential, base_speed, base_stamina, base_burst, base_agility, base_temperament, description_zh, description_en, random_names_json, sort_order)
VALUES
('WILD', '普罗旺斯混血幼驹', 'Wild Cross Foal', 1000.00, 50.00, 65.00, 38.00, 38.00, 36.00, 36.00, 40.00, '边境常见的耐劳品种，适应力极强，是新手马主的坚实起点。', 'Hardy frontier cross-breed with superb adaptability, an ideal start for new owners.', '["疾风猎手","荒野之火","沙丘游民","铜色飞驹","刺丛快步"]'::JSONB, 1),
('PLAINS_TB', '肯塔基良种幼驹', 'Plains Thoroughbred', 3000.00, 65.00, 78.00, 45.00, 45.00, 44.00, 44.00, 45.00, '骨骼精壮步伐矫健，在起跑爆发与冲刺速度上具备优异天赋。', 'Strong bone structure and athletic stride, gifted in gate burst and top sprint speed.', '["平原箭矢","黄金狂飙","雷霆印第安","落日追击","野风行者"]'::JSONB, 2),
('ROYAL', '阿拉伯纯血良驹', 'Royal Arabian Purebred', 8000.00, 78.00, 90.00, 52.00, 52.00, 50.00, 50.00, 50.00, '优雅体态与惊人肺活量，耐力超群，长途德比赛道的主宰者。', 'Graceful conformation and massive lung capacity, the dominant master of distance derbies.', '["皇家卫士","银鞍骑士","暮色君王","极光贵胄","炽阳冠冕"]'::JSONB, 3),
('MYTHIC', '怀俄明传说神驹', 'Wyoming Mythic Stallion', 20000.00, 90.00, 100.00, 60.00, 60.00, 58.00, 58.00, 55.00, '荒野淬炼的旷世神驹，五维潜能接近甚至达到巅峰极值！', 'A legendary thoroughbred refined by the untamed frontier, reaching peak potential.', '["黑夜幽灵","暴风追逐者","泰坦神雷","不朽征服","诸神黄昏"]'::JSONB, 4)
ON CONFLICT (tier_code) DO NOTHING;

INSERT INTO ranch_feed_catalogs (feed_code, feed_name_zh, feed_name_en, feed_category, coin_cost, hunger_fill, exp_gain, condition_bonus, burst_bonus, temperament_bonus, description_zh, description_en, sort_order)
VALUES
('FEED_TIMOTHY', '优质梯牧草 (粗饲料)', 'Timothy Hay', 'ROUGHAGE', 10.00, 35, 50, 0, 0.00, 0.00, '基础粗纤维，调子维持平稳，促进肠胃健康蠕动。', 'Essential roughage fiber, maintains condition and gut digestion.', 1),
('FEED_ALFALFA', '压缩苜蓿草捆 (粗饲料)', 'Alfalfa Bales', 'ROUGHAGE', 25.00, 40, 120, 5, 0.00, 0.00, '适口性优良，调子微升，满足马匹旺盛食量。', 'High palatability roughage, slightly lifts condition and satisfies appetite.', 2),
('FEED_OATS', '熟化压片燕麦 (精饲料)', 'Steam Flaked Oats', 'CONCENTRATE', 40.00, 25, 200, 0, 0.10, 0.00, '高爆发碳水能量，微升爆发力，连续投喂有积食风险。', 'High energy carbs, boosts burst power, risk of colic if fed repeatedly.', 3),
('FEED_PROTEIN', '复合强化蛋白饼 (精饲料)', 'Protein Feed Cake', 'CONCENTRATE', 80.00, 30, 450, 10, 0.00, 0.20, '顶尖纯血营养配方，绝好调概率+15%，性情与肌肉强化。', 'Premium protein formula, improves mood and temperament.', 4)
ON CONFLICT (feed_code) DO NOTHING;

INSERT INTO ranch_training_catalogs (training_type, training_name_zh, training_name_en, coin_cost, energy_cost, exp_gain, hoof_wear_delta, condition_loss, speed_delta, stamina_delta, burst_delta, agility_delta, temperament_delta, description_zh, description_en, sort_order)
VALUES
('SPRINT', '短程爆发冲刺 (Sprint)', 'Power Sprint', 30.00, 25, 100, 8, 5, 0.80, 0.00, 0.40, 0.00, 0.00, '强化四肢肌腱爆发力，大幅提升直道最高冲刺时速。', 'Builds tendon explosiveness, boosting maximum straightaway sprint speed.', 1),
('LOPE', '环道负重耐力 (Lope)', 'Circuit Lope', 25.00, 25, 100, 6, 4, 0.00, 0.90, 0.00, 0.00, 0.30, '提升持久续航与心肺能力，中后程维持极速不失速。', 'Enhances cardiovascular stamina, sustaining pace through the middle and late race.', 2),
('CORNER', '弯道机动折返 (Corner)', 'Corner Maneuver', 35.00, 25, 120, 10, 5, 0.30, 0.00, 0.00, 1.00, 0.00, '熟悉过弯离心力对抗，大幅减少弯道减速损耗。', 'Drills cornering centrifugal balance, minimizing deceleration on turns.', 3),
('HILL', '坡地越野耐挫 (Hill)', 'Cross-Country Hill', 40.00, 25, 140, 12, 6, 0.00, 0.50, 0.80, 0.00, 0.00, '模拟起伏坡道对抗，全面提升出闸启爆与抗逆性。', 'Simulates incline challenges, boosting gate burst and endurance under pressure.', 4)
ON CONFLICT (training_type) DO NOTHING;

INSERT INTO ranch_care_catalogs (care_type, care_name_zh, care_name_en, coin_cost, cooldown_hours, intimacy_bonus, condition_bonus, health_bonus, energy_bonus, hoof_wear_relief, clears_illness, clears_injury, description_zh, description_en, sort_order)
VALUES
('GROOM', '软毛刷日常梳理', 'Soft Brush Grooming', 5.00, 0, 10, 5, 0, 0, 0, FALSE, FALSE, '亲密度+10，调子+5。清除浮尘，舒缓肌肉，建立信任。', 'Intimacy +10, Condition +5. Relieves muscle tension and establishes trust.', 1),
('HANDWALK', '牵引漫步放松', 'Paddock Hand-walk', 10.00, 2, 0, 0, 0, 15, 0, FALSE, FALSE, '体力精力+15。降低心率疲劳，恢复体力精力（冷却2小时）。', 'Energy +15. Lowers heart rate fatigue and restores vigor (2h cooldown).', 2),
('FARRIER', '钉蹄修整与平整', 'Farrier Reshoeing', 25.00, 0, 0, 0, 10, 0, 40, FALSE, FALSE, '蹄铁磨损-40，健康+10。铲除碎石硬泥，恢复蹄铁力学。', 'Hoof wear -40, Health +10. Replaces worn iron and balances hooves.', 3),
('PROBIOTIC', '益生菌调理冲剂', 'Equine Probiotic Draught', 30.00, 0, 0, 30, 15, 0, 0, TRUE, FALSE, '调子+30，健康+15。专治积食腹痛，解除 SICK 状态。', 'Condition +30, Health +15. Cures colic and clears SICK status.', 4),
('PHYSIOMUD', '理疗推拿与草本泥敷', 'Therapeutic Mud Pack', 50.00, 0, 0, 50, 30, 0, 30, TRUE, TRUE, '调子大幅恢复，清除疲劳与损伤，解除伤病状态。', 'Full wellness recovery, cures injuries and resets health.', 5)
ON CONFLICT (care_type) DO NOTHING;

COMMIT;

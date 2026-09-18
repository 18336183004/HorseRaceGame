-- 目标数据库：postgres（PostgreSQL 默认维护数据库）
-- 本脚本不会 CREATE DATABASE，也不会要求数据库名为 racegame。
-- 请在 PostgreSQL 的 postgres 数据库中按 001 -> 002 -> 003 顺序执行。

-- RaceGame incremental upgrade from the original 001_initial.sql
--
-- 目标：
-- 1. 兼容已经执行过旧版 001_initial.sql 的数据库。
-- 2. 补齐当前初始化基线中的新增字段、新表、索引与说明。
-- 3. 尽量采用非破坏性 ALTER / CREATE IF NOT EXISTS，避免覆盖既有数据。

BEGIN;

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

COMMIT;

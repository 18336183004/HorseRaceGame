import os
import re

def extract_ddl(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    pattern = re.compile(r'((?:CREATE\s+TABLE|CREATE\s+(?:UNIQUE\s+)?INDEX|COMMENT\s+ON)\s+.*?;)', re.DOTALL | re.IGNORECASE)
    matches = pattern.findall(text)
    return '\n\n'.join(m.strip() for m in matches)

def extract_inserts(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    # Find all INSERT INTO blocks
    pattern = re.compile(r'(INSERT\s+INTO\s+.*?;)', re.DOTALL | re.IGNORECASE)
    matches = pattern.findall(text)
    return '\n\n'.join(m.strip() for m in matches)

def build_schema(archive_dir, deploy_dir):
    with open(f'{archive_dir}/001_initial.sql', 'r', encoding='utf-8') as f:
        sql = f.read()

    # Inlines on 001_initial.sql
    # 1. players
    t1 = """    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"""
    r1 = """    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    invite_code VARCHAR(16) UNIQUE,
    referred_by_player_id BIGINT REFERENCES players(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"""
    sql = sql.replace(t1, r1)

    # 2. wallets
    t2 = """    balance NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),"""
    r2 = """    balance NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (balance >= 0),
    frozen_balance NUMERIC(20,2) NOT NULL DEFAULT 0.00 CHECK (frozen_balance >= 0),
    version BIGINT NOT NULL DEFAULT 0 CHECK (version >= 0),"""
    sql = sql.replace(t2, r2)

    # 3. player_stats
    t3 = """    total_net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_net_reward >= 0),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"""
    r3 = """    total_net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (total_net_reward >= 0),
    total_net_profit_wins BIGINT NOT NULL DEFAULT 0,
    current_hit_streak INT NOT NULL DEFAULT 0,
    max_hit_streak INT NOT NULL DEFAULT 0,
    current_profit_streak INT NOT NULL DEFAULT 0,
    max_profit_streak INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),"""
    sql = sql.replace(t3, r3)

    # 4. horse_catalogs
    t4 = """    rank_6_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_6_probability >= 0 AND rank_6_probability <= 1),
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,"""
    r4 = """    rank_6_probability NUMERIC(10,6) NOT NULL DEFAULT 0 CHECK (rank_6_probability >= 0 AND rank_6_probability <= 1),
    preferred_track VARCHAR(32) DEFAULT 'TURF',
    preferred_weather VARCHAR(32) DEFAULT 'SUNNY',
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,"""
    sql = sql.replace(t4, r4)

    # 5. race_rule_configs
    t5 = """    config_payload_json JSONB,
    effective_start_at TIMESTAMPTZ,
    effective_end_at TIMESTAMPTZ,
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,"""
    r5 = """    config_payload_json JSONB,
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
    created_by_admin_user_id BIGINT REFERENCES admin_users(id) ON DELETE SET NULL,"""
    sql = sql.replace(t5, r5)

    # 6. shop_orders
    t6 = """    idempotency_key VARCHAR(128) NOT NULL,
    payment_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,"""
    r6 = """    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64),
    payment_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,"""
    sql = sql.replace(t6, r6)

    # 7. race_rounds
    t7 = """    winner_horse_no INT CHECK (winner_horse_no BETWEEN 1 AND 6),
    bet_count INT NOT NULL DEFAULT 0 CHECK (bet_count >= 0),"""
    r7 = """    winner_horse_no INT CHECK (winner_horse_no BETWEEN 1 AND 6),
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
    bet_count INT NOT NULL DEFAULT 0 CHECK (bet_count >= 0),"""
    sql = sql.replace(t7, r7)

    t7_2 = """    black_horse_snapshot_json JSONB,
    result_json JSONB,"""
    r7_2 = """    black_horse_snapshot_json JSONB,
    quinella_odds_snapshot_json JSONB,
    commentary_script_json JSONB DEFAULT NULL,
    result_json JSONB,"""
    sql = sql.replace(t7_2, r7_2)

    # 8. race_bet_selections
    sql = sql.replace(
        "CONSTRAINT uq_race_bet_selections UNIQUE (player_id, round_id)",
        "CONSTRAINT uq_race_bet_selections UNIQUE (player_id, round_id, horse_no)"
    )

    # 9. bet_orders
    t9 = """    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    bet_amount NUMERIC(20,2) NOT NULL CHECK (bet_amount >= 2),"""
    r9 = """    play_type VARCHAR(32) NOT NULL DEFAULT 'WIN',
    horse_no INT NOT NULL CHECK (horse_no BETWEEN 1 AND 6),
    second_horse_no INT,
    third_horse_no INT DEFAULT NULL,
    combination VARCHAR(16),
    bet_amount NUMERIC(20,2) NOT NULL CHECK (bet_amount >= 2),"""
    sql = sql.replace(t9, r9)

    t9_2 = """    net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (net_reward >= 0),
    rounding_version VARCHAR(32),"""
    r9_2 = """    net_reward NUMERIC(20,2) NOT NULL DEFAULT 0 CHECK (net_reward >= 0),
    is_double_down BOOLEAN NOT NULL DEFAULT FALSE,
    double_down_amount NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    dilution_factor NUMERIC(10, 6) NOT NULL DEFAULT 1.000000,
    rounding_version VARCHAR(32),"""
    sql = sql.replace(t9_2, r9_2)

    t9_3 = """    idempotency_key VARCHAR(128) NOT NULL,
    bet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,"""
    r9_3 = """    idempotency_key VARCHAR(128) NOT NULL,
    request_hash VARCHAR(64),
    refund_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,
    bet_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,"""
    sql = sql.replace(t9_3, r9_3)

    # Strip trailing COMMIT;
    sql = re.sub(r'COMMIT\s*;\s*$', '', sql.strip(), flags=re.MULTILINE)

    # Extract DDLs from subsequent files
    ddl_004 = extract_ddl(f'{archive_dir}/004_add_game_domain_logs.sql')
    ddl_008 = extract_ddl(f'{archive_dir}/008_v2_1_features.sql')
    # Inline 011 additions to player_referral_rewards
    ddl_008 = ddl_008.replace(
        "    reward_type VARCHAR(32) NOT NULL DEFAULT 'STARTER_INVITE',\n    amount NUMERIC(20, 2) NOT NULL DEFAULT 0,",
        "    round_id BIGINT REFERENCES race_rounds(id) ON DELETE SET NULL,\n    reward_type VARCHAR(32) NOT NULL DEFAULT 'STARTER_INVITE',\n    net_loss_amount NUMERIC(20, 2) NOT NULL DEFAULT 0,\n    commission_rate NUMERIC(10, 6) NOT NULL DEFAULT 0,\n    amount NUMERIC(20, 2) NOT NULL DEFAULT 0,\n    claimed_at TIMESTAMPTZ,\n    claim_transaction_id BIGINT REFERENCES wallet_transactions(id) ON DELETE SET NULL,"
    )
    ddl_013 = extract_ddl(f'{archive_dir}/013_gameplay_expansion_and_parameters.sql')
    ddl_015 = extract_ddl(f'{archive_dir}/015_ranch_mode_core_schema.sql')
    ddl_016 = extract_ddl(f'{archive_dir}/016_dynamic_race_and_horse_configs.sql')

    additional_indexes = """
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
"""

    full_schema = f"""-- ============================================================================
-- Migration: 001_schema.sql
-- Description: RaceGame 全量 74 表结构定义、主外键引用、枚举约束与全量业务索引
-- 整合原 001~016 所有 DDL，无历史增量 ALTER TABLE 补丁，开箱即用
-- ============================================================================

{sql}

-- ============================================================================
-- 日志与追踪扩展表 (004)
-- ============================================================================
{ddl_004}

-- ============================================================================
-- 成就与推广奖励表 (008, 011)
-- ============================================================================
{ddl_008}

-- ============================================================================
-- 大奖池与专属马房 (013)
-- ============================================================================
{ddl_013}

-- ============================================================================
-- 牧场系统基础字典与配置 (016)
-- ============================================================================
{ddl_016}

-- ============================================================================
-- 牧场核心业务实体 (015)
-- ============================================================================
{ddl_015}

{additional_indexes}
"""

    with open(f'{deploy_dir}/001_schema.sql', 'w', encoding='utf-8') as f:
        f.write(full_schema)
    print("001_schema.sql generated successfully!")

def build_seed_data(archive_dir, deploy_dir):
    with open(f'{archive_dir}/003_seed_default_race_rules.sql', 'r', encoding='utf-8') as f:
        text_003 = f.read()

    # Slice text_003 into 14 sections
    matches = list(re.finditer(r'-- =+\s*\n-- (\d+)\.\s*(.*?)\n-- =+', text_003))

    sec1_rules = text_003[matches[0].start() : matches[1].start()]
    # Update sec1_rules with updated params
    update_params = """
-- 补充 012/013 运行期核心参数
UPDATE race_rule_configs
SET fee_schedule_json = '[{"maximumGrossReward":10000.00,"rate":0.010},{"maximumGrossReward":50000.00,"rate":0.012},{"maximumGrossReward":100000.00,"rate":0.015},{"maximumGrossReward":null,"rate":0.020}]'::jsonb,
    referral_commission_rate = 0.005000,
    photo_finish_threshold_seconds = 0.1800,
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
"""
    sec1_rules = sec1_rules.strip() + "\n" + update_params.strip() + "\n\n"

    # From 016: race_environments, race_commentary_templates, race_tipster_templates, ranch catalogs
    inserts_016 = extract_inserts(f'{archive_dir}/016_dynamic_race_and_horse_configs.sql')

    # From 015: ranch_equipment_items
    inserts_015 = extract_inserts(f'{archive_dir}/015_ranch_mode_core_schema.sql')

    # From 017: 20 race horses (horse_catalogs) and 40 foals (ranch_horses)
    with open(f'{archive_dir}/017_seed_20_race_horses_and_40_foals.sql', 'r', encoding='utf-8') as f:
        text_017 = f.read()

    idx_start = text_017.find('INSERT INTO horse_catalogs')
    idx_end = text_017.find('ON CONFLICT (horse_code)')
    idx_semi = text_017.find(';', idx_end)
    horses_20_sql = text_017[idx_start : idx_semi + 1]

    idx_foal_start = text_017.find('DO $$')
    idx_foal_end = text_017.rfind('END $$;')
    foals_40_sql = text_017[idx_foal_start : idx_foal_end + len('END $$;')]

    # From 003: characters, items, cosmetics, level configs, shop products
    sec3_to_7 = text_003[matches[2].start() : matches[7].start()]

    # From 007: 9 daily tasks
    inserts_007 = extract_inserts(f'{archive_dir}/007_expand_daily_tasks.sql')

    # From 008: 8 achievements
    inserts_008 = extract_inserts(f'{archive_dir}/008_v2_1_features.sql')

    # From 013: jackpot pool
    inserts_013 = extract_inserts(f'{archive_dir}/013_gameplay_expansion_and_parameters.sql')

    # From 003: notices (sec 9)
    sec9_notices = text_003[matches[8].start() : matches[9].start()]

    # From 003: players (sec 10)
    sec10_players = text_003[matches[9].start() : matches[10].start()]
    sec10_players = sec10_players.replace("'DAILY_RACE_COUNT_1'", "'DAILY_RACE_COUNT_3'")

    # From 003: rounds (sec 11), bets (sec 12), admins (sec 13), validation (sec 14)
    sec11_rounds = text_003[matches[10].start() : matches[11].start()]
    sec12_bets = text_003[matches[11].start() : matches[12].start()]
    sec13_admins = text_003[matches[12].start() : matches[13].start()]
    sec14_check = text_003[matches[13].start() :]

    full_seed = f"""-- ============================================================================
-- Migration: 002_seed_data.sql
-- Description: 系统全量业务种子数据与初始主数据目录
-- 包含：规则配置、10 赛事环境、15 解说模板、8 推荐专家、4 幼驹档位、饲料/训练/医护/装备字典、
--       20 匹顶级赛事马、40 匹西部纯血小马驹、角色与等级进阶、道具商城、
--       9 项每日任务、8 项成就定义、大奖池、初始管理员、开发测试账号与历史赛果
-- ============================================================================

BEGIN;

{sec1_rules}

-- ============================================================================
-- 2. 赛事环境、解说、专家推荐与牧场基础主数据字典 (016)
-- ============================================================================
{inserts_016}

-- ============================================================================
-- 3. 牧场装备商城主数据 (015)
-- ============================================================================
{inserts_015}

-- ============================================================================
-- 4. 二十匹顶级赛事马名录 (horse_catalogs, 017)
-- ============================================================================
{horses_20_sql}

{sec3_to_7}

-- ============================================================================
-- 8. 每日任务全量定义 (daily_task_definitions, 007)
-- ============================================================================
{inserts_007}

-- ============================================================================
-- 9. 成就系统完整名录 (achievement_definitions, 008)
-- ============================================================================
{inserts_008}

-- ============================================================================
-- 10. 全服超级大奖池定义 (jackpot_pools, 013)
-- ============================================================================
{inserts_013}

{sec9_notices}

{sec10_players}

-- ============================================================================
-- 13. 四十只西部纯血牧场小马驹 (ranch_horses, 017)
-- ============================================================================
{foals_40_sql}

{sec11_rounds}

{sec12_bets}

{sec13_admins}

{sec14_check}
"""

    with open(f'{deploy_dir}/002_seed_data.sql', 'w', encoding='utf-8') as f:
        f.write(full_seed)
    print("002_seed_data.sql generated successfully!")

if __name__ == '__main__':
    archive_dir = 'Database/Archive/legacy_migrations'
    deploy_dir = 'Database/DeployInit'
    build_schema(archive_dir, deploy_dir)
    build_seed_data(archive_dir, deploy_dir)

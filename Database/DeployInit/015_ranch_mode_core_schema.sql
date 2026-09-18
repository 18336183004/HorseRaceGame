-- ============================================================================
-- Migration: 015_ranch_mode_core_schema.sql
-- Description: 模式三：西部纯血马房养成、装备、资格审核、巡回赛与交易核心表结构与种子数据
-- ============================================================================

-- 1. 牧场马匹主表
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

-- 2. 装备字典与装备实例表
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

-- 3. 投喂日志表
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

-- 4. 训练日志表
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

-- 5. 资格审核考核记录表
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

-- 6. 职业巡回赛事主表与报名单
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

-- 7. 繁育档案表
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

-- 8. 拍卖行主表与竞价流水
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

-- 9. 点对点转让契约表
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

-- 10. 后台任务作业表
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

-- 11. 种子数据初始化 (装备字典)
INSERT INTO ranch_equipment_items (item_code, item_name, slot_category, weight_kg, speed_bonus, stamina_bonus, burst_bonus, agility_bonus, turf_modifier, dirt_modifier, muddy_modifier, max_durability, price_coin, is_enabled)
VALUES 
('SAD_STD_01', '标准加利福尼亚轻型鞍', 'SADDLE', 4.00, 0.00, 0.00, 0.00, 0.00, 1.00, 1.00, 1.00, 100, 150.00, TRUE),
('SAD_LEA_02', '手工赛级真皮减负鞍', 'SADDLE', 2.50, 0.80, 0.50, 1.20, 0.50, 1.00, 1.00, 1.00, 80, 350.00, TRUE),
('STP_BRS_01', '黄铜深槽重心稳定镫', 'STIRRUP', 1.20, 0.00, 0.30, 0.00, 1.50, 1.00, 1.00, 1.00, 120, 200.00, TRUE),
('SHU_ALU_01', '铝合金草地轻量蹄铁', 'HORSESHOE', 0.80, 1.00, 0.00, 0.80, 0.00, 1.03, 0.98, 1.00, 50, 180.00, TRUE),
('SHU_CLK_02', '深齿防滑泥地抓地铁', 'HORSESHOE', 1.50, -0.50, 1.00, 0.50, 1.00, 0.98, 1.00, 1.05, 60, 220.00, TRUE)
ON CONFLICT (item_code) DO NOTHING;

-- ============================================================================
-- Migration: 016_dynamic_race_and_horse_configs.sql
-- Description: 比赛环境、赛况解说、专家推荐、玩法系数及牧场养成（幼驹/饲料/训练/医护）字典主数据与配置动态化
-- ============================================================================

-- 1. 比赛环境配置表 (天气与赛道主数据)
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

-- 2. 赛况解说台本模板表
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

-- 3. 赛前专家推荐与评语模板表
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

-- 4. 纯血牧场：幼驹血统档位表
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

-- 5. 纯血牧场：草料饲料字典表
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

-- 6. 纯血牧场：专项体能训练字典表
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

-- 7. 纯血牧场：理疗医护字典表
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

-- 8. 扩展 race_rule_configs 配置表
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

-- 9. 种子数据初始化
-- 9.1 比赛环境
INSERT INTO race_environments (environment_type, code, name_zh, name_en, description_zh, description_en, adaptation_bonus_rate, selection_weight, visual_theme_key)
VALUES
('WEATHER', 'SUNNY', '晴空高照', 'Sunny', '阳光明媚，视野开阔，适合全速冲刺。', 'Bright sunlight, clear visibility, ideal for full-speed sprints.', 1.0800, 50, 'SKY_NOON'),
('WEATHER', 'RAINY', '暴雨倾盆', 'Rainy', '暴雨泥泞，极大考验赛马抓地与耐力。', 'Heavy rain and muddy tracks, demanding superior grip and endurance.', 1.0800, 25, 'SKY_DUSK'),
('WEATHER', 'CLOUDY', '荒野阴云', 'Cloudy', '微风凉爽，湿度适宜，各马匹状态均衡。', 'Cool breeze and overcast skies, optimal conditions for balanced racing.', 1.0800, 25, 'SKY_DAWN'),
('TRACK', 'TURF', '草地跑道', 'Turf', '经典绿茵跑道，摩擦力平稳，适合步伐轻盈之良驹。', 'Classic grass surface, smooth friction for agile gallopers.', 1.0800, 40, 'TURF'),
('TRACK', 'DIRT', '泥地跑道', 'Dirt', '粗粝沙泥赛道，对爆发力与后肢蹬踏力要求极高。', 'Coarse dirt track, challenging stride power and rear propulsion.', 1.0800, 35, 'DIRT'),
('TRACK', 'SAND', '沙漠跑道', 'Sand', '荒野细沙场地，深陷阻力大，强力耐力型赛马主场。', 'Deep sand surface, high resistance, favoring endurance specialists.', 1.0800, 25, 'SAND')
ON CONFLICT (code) DO NOTHING;

-- 9.2 解说台本
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

-- 9.3 专家推荐模板
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

-- 9.4 幼驹血统档位
INSERT INTO ranch_foal_tiers (tier_code, tier_name_zh, tier_name_en, adopt_price, min_potential, max_potential, base_speed, base_stamina, base_burst, base_agility, base_temperament, description_zh, description_en, random_names_json, sort_order)
VALUES
('WILD', '普罗旺斯混血幼驹', 'Wild Cross Foal', 1000.00, 50.00, 65.00, 38.00, 38.00, 36.00, 36.00, 40.00, '边境常见的耐劳品种，适应力极强，是新手马主的坚实起点。', 'Hardy frontier cross-breed with superb adaptability, an ideal start for new owners.', '["疾风猎手","荒野之火","沙丘游民","铜色飞驹","刺丛快步"]'::JSONB, 1),
('PLAINS_TB', '肯塔基良种幼驹', 'Plains Thoroughbred', 3000.00, 65.00, 78.00, 45.00, 45.00, 44.00, 44.00, 45.00, '骨骼精壮步伐矫健，在起跑爆发与冲刺速度上具备优异天赋。', 'Strong bone structure and athletic stride, gifted in gate burst and top sprint speed.', '["平原箭矢","黄金狂飙","雷霆印第安","落日追击","野风行者"]'::JSONB, 2),
('ROYAL', '阿拉伯纯血良驹', 'Royal Arabian Purebred', 8000.00, 78.00, 90.00, 52.00, 52.00, 50.00, 50.00, 50.00, '优雅体态与惊人肺活量，耐力超群，长途德比赛道的主宰者。', 'Graceful conformation and massive lung capacity, the dominant master of distance derbies.', '["皇家卫士","银鞍骑士","暮色君王","极光贵胄","炽阳冠冕"]'::JSONB, 3),
('MYTHIC', '怀俄明传说神驹', 'Wyoming Mythic Stallion', 20000.00, 90.00, 100.00, 60.00, 60.00, 58.00, 58.00, 55.00, '荒野淬炼的旷世神驹，五维潜能接近甚至达到巅峰极值！', 'A legendary thoroughbred refined by the untamed frontier, reaching peak potential.', '["黑夜幽灵","暴风追逐者","泰坦神雷","不朽征服","诸神黄昏"]'::JSONB, 4)
ON CONFLICT (tier_code) DO NOTHING;

-- 9.5 草料饲料字典
INSERT INTO ranch_feed_catalogs (feed_code, feed_name_zh, feed_name_en, feed_category, coin_cost, hunger_fill, exp_gain, condition_bonus, burst_bonus, temperament_bonus, description_zh, description_en, sort_order)
VALUES
('FEED_TIMOTHY', '优质梯牧草 (粗饲料)', 'Timothy Hay', 'ROUGHAGE', 10.00, 35, 50, 0, 0.00, 0.00, '基础粗纤维，调子维持平稳，促进肠胃健康蠕动。', 'Essential roughage fiber, maintains condition and gut digestion.', 1),
('FEED_ALFALFA', '压缩苜蓿草捆 (粗饲料)', 'Alfalfa Bales', 'ROUGHAGE', 25.00, 40, 120, 5, 0.00, 0.00, '适口性优良，调子微升，满足马匹旺盛食量。', 'High palatability roughage, slightly lifts condition and satisfies appetite.', 2),
('FEED_OATS', '熟化压片燕麦 (精饲料)', 'Steam Flaked Oats', 'CONCENTRATE', 40.00, 25, 200, 0, 0.10, 0.00, '高爆发碳水能量，微升爆发力，连续投喂有积食风险。', 'High energy carbs, boosts burst power, risk of colic if fed repeatedly.', 3),
('FEED_PROTEIN', '复合强化蛋白饼 (精饲料)', 'Protein Feed Cake', 'CONCENTRATE', 80.00, 30, 450, 10, 0.00, 0.20, '顶尖纯血营养配方，绝好调概率+15%，性情与肌肉强化。', 'Premium protein formula, improves mood and temperament.', 4)
ON CONFLICT (feed_code) DO NOTHING;

-- 9.6 专项体能训练字典
INSERT INTO ranch_training_catalogs (training_type, training_name_zh, training_name_en, coin_cost, energy_cost, exp_gain, hoof_wear_delta, condition_loss, speed_delta, stamina_delta, burst_delta, agility_delta, temperament_delta, description_zh, description_en, sort_order)
VALUES
('SPRINT', '短程爆发冲刺 (Sprint)', 'Power Sprint', 30.00, 25, 100, 8, 5, 0.80, 0.00, 0.40, 0.00, 0.00, '强化四肢肌腱爆发力，大幅提升直道最高冲刺时速。', 'Builds tendon explosiveness, boosting maximum straightaway sprint speed.', 1),
('LOPE', '环道负重耐力 (Lope)', 'Circuit Lope', 25.00, 25, 100, 6, 4, 0.00, 0.90, 0.00, 0.00, 0.30, '提升持久续航与心肺能力，中后程维持极速不失速。', 'Enhances cardiovascular stamina, sustaining pace through the middle and late race.', 2),
('CORNER', '弯道机动折返 (Corner)', 'Corner Maneuver', 35.00, 25, 120, 10, 5, 0.30, 0.00, 0.00, 1.00, 0.00, '熟悉过弯离心力对抗，大幅减少弯道减速损耗。', 'Drills cornering centrifugal balance, minimizing deceleration on turns.', 3),
('HILL', '坡地越野耐挫 (Hill)', 'Cross-Country Hill', 40.00, 25, 140, 12, 6, 0.00, 0.50, 0.80, 0.00, 0.00, '模拟起伏坡道对抗，全面提升出闸启爆与抗逆性。', 'Simulates incline challenges, boosting gate burst and endurance under pressure.', 4)
ON CONFLICT (training_type) DO NOTHING;

-- 9.7 理疗医护字典
INSERT INTO ranch_care_catalogs (care_type, care_name_zh, care_name_en, coin_cost, cooldown_hours, intimacy_bonus, condition_bonus, health_bonus, energy_bonus, hoof_wear_relief, clears_illness, clears_injury, description_zh, description_en, sort_order)
VALUES
('GROOM', '软毛刷日常梳理', 'Soft Brush Grooming', 5.00, 0, 10, 5, 0, 0, 0, FALSE, FALSE, '亲密度+10，调子+5。清除浮尘，舒缓肌肉，建立信任。', 'Intimacy +10, Condition +5. Relieves muscle tension and establishes trust.', 1),
('HANDWALK', '牵引漫步放松', 'Paddock Hand-walk', 10.00, 2, 0, 0, 0, 15, 0, FALSE, FALSE, '体力精力+15。降低心率疲劳，恢复体力精力（冷却2小时）。', 'Energy +15. Lowers heart rate fatigue and restores vigor (2h cooldown).', 2),
('FARRIER', '钉蹄修整与平整', 'Farrier Reshoeing', 25.00, 0, 0, 0, 10, 0, 40, FALSE, FALSE, '蹄铁磨损-40，健康+10。铲除碎石硬泥，恢复蹄铁力学。', 'Hoof wear -40, Health +10. Replaces worn iron and balances hooves.', 3),
('PROBIOTIC', '益生菌调理冲剂', 'Equine Probiotic Draught', 30.00, 0, 0, 30, 15, 0, 0, TRUE, FALSE, '调子+30，健康+15。专治积食腹痛，解除 SICK 状态。', 'Condition +30, Health +15. Cures colic and clears SICK status.', 4),
('PHYSIOMUD', '理疗推拿与草本泥敷', 'Therapeutic Mud Pack', 50.00, 0, 0, 50, 30, 0, 30, TRUE, TRUE, '调子大幅恢复，清除疲劳与损伤，解除伤病状态。', 'Full wellness recovery, cures injuries and resets health.', 5)
ON CONFLICT (care_type) DO NOTHING;

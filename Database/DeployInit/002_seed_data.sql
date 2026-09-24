-- ============================================================================
-- Migration: 002_seed_data.sql
-- Description: 系统全量业务种子数据与初始主数据目录
-- 包含：规则配置、10 赛事环境、15 解说模板、8 推荐专家、4 幼驹档位、饲料/训练/医护/装备字典、
--       20 匹顶级赛事马、40 匹西部纯血小马驹、角色与等级进阶、道具商城、
--       9 项每日任务、8 项成就定义、大奖池、初始管理员、开发测试账号与历史赛果
-- ============================================================================

BEGIN;

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



-- ============================================================================
-- 2. 赛事环境、解说、专家推荐与牧场基础主数据字典 (016)
-- ============================================================================
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

-- ============================================================================
-- 3. 牧场装备商城主数据 (015)
-- ============================================================================
INSERT INTO ranch_equipment_items (item_code, item_name, slot_category, weight_kg, speed_bonus, stamina_bonus, burst_bonus, agility_bonus, turf_modifier, dirt_modifier, muddy_modifier, max_durability, price_coin, is_enabled)
VALUES 
('SAD_STD_01', '标准加利福尼亚轻型鞍', 'SADDLE', 4.00, 0.00, 0.00, 0.00, 0.00, 1.00, 1.00, 1.00, 100, 150.00, TRUE),
('SAD_LEA_02', '手工赛级真皮减负鞍', 'SADDLE', 2.50, 0.80, 0.50, 1.20, 0.50, 1.00, 1.00, 1.00, 80, 350.00, TRUE),
('STP_BRS_01', '黄铜深槽重心稳定镫', 'STIRRUP', 1.20, 0.00, 0.30, 0.00, 1.50, 1.00, 1.00, 1.00, 120, 200.00, TRUE),
('SHU_ALU_01', '铝合金草地轻量蹄铁', 'HORSESHOE', 0.80, 1.00, 0.00, 0.80, 0.00, 1.03, 0.98, 1.00, 50, 180.00, TRUE),
('SHU_CLK_02', '深齿防滑泥地抓地铁', 'HORSESHOE', 1.50, -0.50, 1.00, 0.50, 1.00, 0.98, 1.00, 1.05, 60, 220.00, TRUE)
ON CONFLICT (item_code) DO NOTHING;

-- ============================================================================
-- 4. 二十匹顶级赛事马名录 (horse_catalogs, 017)
-- ============================================================================
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
    updated_at
)
VALUES
    -- 01. 赤焰流星 (起步冲刺型基准马)
    ('HORSE_RED_COMET', '赤焰流星', 'Crimson Meteor', '起步和冲刺能力突出，爆发力惊人，作为高胜率基准马。', 'Strong start and sprint; the high-win-rate baseline horse.', 'assets/textures/horses/H01_CrimsonMeteor_Sprite.png', 'assets/textures/horses/H01_CrimsonMeteor_Showcase.png', '{"color":"red","style":"sprinter","stamina":88,"speed":95,"burst":96,"temperament":"spirited","trackPreference":"turf"}'::JSONB, 10, TRUE, 100, 25, 0.250000, 25, 21, 18, 15, 12, 9, 0.250000, 0.210000, 0.180000, 0.150000, 0.120000, 0.090000, NOW(), NOW()),
    -- 02. 翠风 (后半程长途耐力型)
    ('HORSE_GREEN_WIND', '翠风', 'Emerald Wind', '后程发力强劲，耐力绵长，在长途冲刺中常常逆势反超。', 'Reliable stamina with an exceptional closing burst in long distances.', 'assets/textures/horses/H02_EmeraldWind_Sprite.png', 'assets/textures/horses/H02_EmeraldWind_Showcase.png', '{"color":"green","style":"stayer","stamina":96,"speed":86,"burst":88,"temperament":"steady","trackPreference":"turf"}'::JSONB, 20, TRUE, 100, 21, 0.210000, 21, 18, 15, 12, 16, 18, 0.210000, 0.180000, 0.150000, 0.120000, 0.160000, 0.180000, NOW(), NOW()),
    -- 03. 金色箭矢 (中段弯道加速型)
    ('HORSE_GOLDEN_ARROW', '金色箭矢', 'Golden Arrow', '中段弯道加速明显，具备极强的追击与终点竞争能力。', 'Strong mid-race acceleration and highly competitive closing form.', 'assets/textures/horses/H03_GoldenArrow_Sprite.png', 'assets/textures/horses/H03_GoldenArrow_Showcase.png', '{"color":"gold","style":"accelerator","stamina":87,"speed":92,"burst":90,"temperament":"focused","trackPreference":"dry"}'::JSONB, 30, TRUE, 100, 19, 0.190000, 19, 16, 15, 14, 18, 18, 0.190000, 0.160000, 0.150000, 0.140000, 0.180000, 0.180000, NOW(), NOW()),
    -- 04. 暗影猎手 (伺机切线追击型)
    ('HORSE_SHADOW_HUNTER', '暗影猎手', 'Shadow Hunter', '擅长在马群中伺机而动，直道冲刺阶段以凌厉切线超越对手。', 'Tactical stalker that drafts behind leaders and makes devastating moves.', 'assets/textures/horses/H04_ShadowHunter_Sprite.png', 'assets/textures/horses/H04_ShadowHunter_Showcase.png', '{"color":"black","style":"stalker","stamina":91,"speed":91,"burst":93,"temperament":"cunning","trackPreference":"all"}'::JSONB, 40, TRUE, 100, 18, 0.180000, 18, 17, 16, 17, 16, 16, 0.180000, 0.170000, 0.160000, 0.170000, 0.160000, 0.160000, NOW(), NOW()),
    -- 05. 银月 (传奇冷门黑马型)
    ('HORSE_SILVER_MOON', '银月', 'Silver Moon', '步伐轻盈神秘，屡屡在低赔率逆境中绝地爆发创造奇迹。', 'Lowest expected rank yet prime candidate for sensational upset victories.', 'assets/textures/horses/H05_SilverMoon_Sprite.png', 'assets/textures/horses/H05_SilverMoon_Showcase.png', '{"color":"silver","style":"dark-horse","stamina":88,"speed":89,"burst":94,"temperament":"proud","trackPreference":"soft"}'::JSONB, 50, TRUE, 100, 16, 0.160000, 16, 20, 18, 16, 15, 15, 0.160000, 0.200000, 0.180000, 0.160000, 0.150000, 0.150000, NOW(), NOW()),
    -- 06. 蓝潮 (沉稳均衡稳定型)
    ('HORSE_BLUE_TIDE', '蓝潮', 'Blue Tide', '表现均衡沉稳，耐力充沛，适合作为中坚稳定型赛马。', 'A balanced and reliable race horse with steady stamina and pacing.', 'assets/textures/horses/H06_BlueTide_Sprite.png', 'assets/textures/horses/H06_BlueTide_Showcase.png', '{"color":"blue","style":"balanced","stamina":92,"speed":89,"burst":87,"temperament":"calm","trackPreference":"all"}'::JSONB, 60, TRUE, 100, 15, 0.150000, 15, 18, 17, 16, 17, 17, 0.150000, 0.180000, 0.170000, 0.160000, 0.170000, 0.170000, NOW(), NOW()),
    -- 07. 紫电 (强波动高回报型)
    ('HORSE_PURPLE_FLASH', '紫电', 'Purple Lightning', '灵动敏捷但状态波动较大，经常在中低概率区间制造惊喜。', 'Volatile form providing thrilling finishes and high payout multipliers.', 'assets/textures/horses/H07_PurpleLightning_Sprite.png', 'assets/textures/horses/H07_PurpleLightning_Showcase.png', '{"color":"purple","style":"volatile","stamina":83,"speed":95,"burst":97,"temperament":"unpredictable","trackPreference":"firm"}'::JSONB, 70, TRUE, 100, 14, 0.140000, 14, 12, 22, 19, 18, 15, 0.140000, 0.120000, 0.220000, 0.190000, 0.180000, 0.150000, NOW(), NOW()),
    -- 08. 暴风疾行 (突击型领放专家)
    ('HORSE_STORM_RUNNER', '暴风疾行', 'Storm Run', '雷霆万钧的起跑专家，擅长领放跑法，拥有极高的前列达成率。', 'Aggressive front-runner with fierce starting speed and strong podium rate.', 'assets/textures/horses/H08_StormRun_Sprite.png', 'assets/textures/horses/H08_StormRun_Showcase.png', '{"color":"navy","style":"sprinter","stamina":89,"speed":96,"burst":95,"temperament":"aggressive","trackPreference":"wet"}'::JSONB, 80, TRUE, 100, 13, 0.130000, 13, 22, 19, 17, 15, 14, 0.130000, 0.220000, 0.190000, 0.170000, 0.150000, 0.140000, NOW(), NOW()),
    -- 09. 惊雷破空 (狂飙冲锋猛将)
    ('HORSE_THUNDER_BOLT', '惊雷破空', 'Thunder Break', '瞬时爆发力冠绝马群，状态绝佳时势不可挡。', 'Explosive burst speed with wild race lines, delivering dramatic victories.', 'assets/textures/horses/H09_ThunderBreak_Sprite.png', 'assets/textures/horses/H09_ThunderBreak_Showcase.png', '{"color":"yellow","style":"volatile","stamina":82,"speed":97,"burst":98,"temperament":"wild","trackPreference":"dry"}'::JSONB, 90, TRUE, 100, 12, 0.120000, 12, 15, 16, 18, 20, 19, 0.120000, 0.150000, 0.160000, 0.180000, 0.200000, 0.190000, NOW(), NOW()),
    -- 10. 烈阳战将 (坚毅长途耐力型)
    ('HORSE_BLAZING_SUN', '烈阳战将', 'Sun Warrior', '骨骼精壮，不畏长程恶战，末段加速韧性十足。', 'High endurance runner that shines in prolonged battles and tough stamina runs.', 'assets/textures/horses/H10_SunWarrior_Sprite.png', 'assets/textures/horses/H10_SunWarrior_Showcase.png', '{"color":"orange","style":"stayer","stamina":98,"speed":85,"burst":86,"temperament":"tenacious","trackPreference":"firm"}'::JSONB, 100, TRUE, 100, 11, 0.110000, 11, 15, 17, 19, 20, 18, 0.110000, 0.150000, 0.170000, 0.190000, 0.200000, 0.180000, NOW(), NOW()),
    -- 11. 翡翠之梦 (深藏不露冷门马)
    ('HORSE_EMERALD_DREAM', '翡翠之梦', 'Jade Dream', '平时默默无闻，遇湿滑草地能爆发出超常战力。', 'Quiet outsider that unleashes surprising speed on heavy tracks for huge dividends.', 'assets/textures/horses/H11_JadeDream_Sprite.png', 'assets/textures/horses/H11_JadeDream_Showcase.png', '{"color":"emerald","style":"dark-horse","stamina":86,"speed":88,"burst":91,"temperament":"mysterious","trackPreference":"heavy"}'::JSONB, 110, TRUE, 100, 10, 0.100000, 10, 13, 15, 17, 22, 23, 0.100000, 0.130000, 0.150000, 0.170000, 0.220000, 0.230000, NOW(), NOW()),
    -- 12. 极光之星 (高雅全能王者)
    ('HORSE_AURORA_STAR', '极光之星', 'Aurora Star', '步伐优雅舒展，适应各种场地条件，前三名达成率极高。', 'Graceful stride and versatile pacing with a top-tier podium hit rate.', 'assets/textures/horses/H12_AuroraStar_Sprite.png', 'assets/textures/horses/H12_AuroraStar_Showcase.png', '{"color":"cyan","style":"balanced","stamina":90,"speed":91,"burst":92,"temperament":"noble","trackPreference":"turf"}'::JSONB, 120, TRUE, 100, 9, 0.090000, 9, 18, 20, 18, 18, 17, 0.090000, 0.180000, 0.200000, 0.180000, 0.180000, 0.170000, NOW(), NOW()),
    
    -- 13. 天火之翼 (干燥硬地飞跃先锋)
    ('HORSE_SKY_FIRE', '天火之翼', 'Sky Fire Wing', '来自落基山脉边缘的顶级纯血，在晴朗硬质泥地上具备统治级冲刺极速。', 'Mountain-bred thoroughbred with blazing speed on dry dirt tracks.', 'assets/textures/horses/H13_SkyFire_Sprite.png', 'assets/textures/horses/H13_SkyFire_Showcase.png', '{"color":"amber","style":"sprinter","stamina":87,"speed":96,"burst":95,"temperament":"bold","trackPreference":"dry"}'::JSONB, 130, TRUE, 100, 17, 0.170000, 17, 18, 16, 17, 16, 16, 0.170000, 0.180000, 0.160000, 0.170000, 0.160000, 0.160000, NOW(), NOW()),
    -- 14. 荒原霸主 (深厚平原耐力王者)
    ('HORSE_PLAINS_LORD', '荒原霸主', 'Plains Overlord', '拥有纯正旷野野马血统，心肺容量惊人，末程 400 米拉锯战胜率第一。', 'Untamed wildline bloodline with unmatched stamina in grinding final stretches.', 'assets/textures/horses/H14_PlainsOverlord_Sprite.png', 'assets/textures/horses/H14_PlainsOverlord_Showcase.png', '{"color":"chestnut","style":"stayer","stamina":99,"speed":88,"burst":89,"temperament":"resolute","trackPreference":"all"}'::JSONB, 140, TRUE, 100, 20, 0.200000, 20, 22, 18, 15, 13, 12, 0.200000, 0.220000, 0.180000, 0.150000, 0.130000, 0.120000, NOW(), NOW()),
    -- 15. 白银之光 (直道切线逆袭悍将)
    ('HORSE_SILVER_BEAM', '白银之光', 'Silver Beam', '银白色鬃毛飞扬，擅长中后段借风滑行，最后弯道切内线突围能力拔群。', 'Shimmering silver thoroughbred specializing in inside rail overtaking maneuvers.', 'assets/textures/horses/H15_SilverBeam_Sprite.png', 'assets/textures/horses/H15_SilverBeam_Showcase.png', '{"color":"platinum","style":"stalker","stamina":90,"speed":93,"burst":92,"temperament":"agile","trackPreference":"turf"}'::JSONB, 150, TRUE, 100, 14, 0.140000, 14, 17, 19, 18, 17, 15, 0.140000, 0.170000, 0.190000, 0.180000, 0.170000, 0.150000, NOW(), NOW()),
    -- 16. 黑曜风暴 (深泥湿地突破专家)
    ('HORSE_OBSIDIAN', '黑曜风暴', 'Obsidian Storm', '肌肉密度极高，强劲的后肢蹬踏力使其在烂泥湿地赛道如履平地。', 'Powerful build delivering massive traction and speed on wet mud surfaces.', 'assets/textures/horses/H16_ObsidianStorm_Sprite.png', 'assets/textures/horses/H16_ObsidianStorm_Showcase.png', '{"color":"charcoal","style":"grinder","stamina":94,"speed":89,"burst":93,"temperament":"fearless","trackPreference":"heavy"}'::JSONB, 160, TRUE, 100, 16, 0.160000, 16, 17, 18, 17, 16, 16, 0.160000, 0.170000, 0.180000, 0.170000, 0.160000, 0.160000, NOW(), NOW()),
    -- 17. 月影独行 (高抗压缠斗大师)
    ('HORSE_MOON_WALKER', '月影独行', 'Moon Walker', '性格沉稳冷静，多马并驾齐驱时心率毫不紊乱，擅长狭窄空隙钻击。', 'Calm and collected veteran capable of piercing through packed fields under pressure.', 'assets/textures/horses/H17_MoonWalker_Sprite.png', 'assets/textures/horses/H17_MoonWalker_Showcase.png', '{"color":"slate","style":"battler","stamina":93,"speed":90,"burst":91,"temperament":"focused","trackPreference":"all"}'::JSONB, 170, TRUE, 100, 13, 0.130000, 13, 16, 18, 19, 18, 16, 0.130000, 0.160000, 0.180000, 0.190000, 0.180000, 0.160000, NOW(), NOW()),
    -- 18. 狂怒号角 (冲锋陷阵爆发王)
    ('HORSE_RAGING_HORN', '狂怒号角', 'Raging Horn', '步幅宽大凶悍，一旦起跑占据领放领地便极难被反超。', 'Dominant pace-setter with a massive stride that crushes chasing packs.', 'assets/textures/horses/H18_RagingHorn_Sprite.png', 'assets/textures/horses/H18_RagingHorn_Showcase.png', '{"color":"bronze","style":"sprinter","stamina":86,"speed":97,"burst":98,"temperament":"furious","trackPreference":"sand"}'::JSONB, 180, TRUE, 100, 22, 0.220000, 22, 20, 18, 15, 13, 12, 0.220000, 0.200000, 0.180000, 0.150000, 0.130000, 0.120000, NOW(), NOW()),
    -- 19. 金羽神鹰 (俯冲式中后程全能神驹)
    ('HORSE_GOLDEN_EAGLE', '金羽神鹰', 'Golden Eagle', '黄金血统纯血名宿，在各类赛道均能保持稳定的 2.0+ 赔率胜率。', 'Premium championship winner with eagle-like closing power and rock-solid form.', 'assets/textures/horses/H19_GoldenEagle_Sprite.png', 'assets/textures/horses/H19_GoldenEagle_Showcase.png', '{"color":"gold","style":"closer","stamina":91,"speed":94,"burst":96,"temperament":"royal","trackPreference":"turf"}'::JSONB, 190, TRUE, 100, 18, 0.180000, 18, 19, 17, 16, 15, 15, 0.180000, 0.190000, 0.170000, 0.160000, 0.150000, 0.150000, NOW(), NOW()),
    -- 20. 深渊魅影 (绝境翻盘顶级爆头马)
    ('HORSE_ABYSS_SHADOW', '深渊魅影', 'Abyssal Phantom', '低调内敛但杀伤力巨大，常在看似落后两马位的死局中上演绝杀。', 'Dark-horse masterpiece delivering legendary late-game turnarounds.', 'assets/textures/horses/H20_AbyssalPhantom_Sprite.png', 'assets/textures/horses/H20_AbyssalPhantom_Showcase.png', '{"color":"indigo","style":"dark-horse","stamina":85,"speed":95,"burst":99,"temperament":"lone-wolf","trackPreference":"all"}'::JSONB, 200, TRUE, 100, 8, 0.080000, 8, 14, 16, 18, 22, 22, 0.080000, 0.140000, 0.160000, 0.180000, 0.220000, 0.220000, NOW(), NOW())
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



-- ============================================================================
-- 8. 每日任务全量定义 (daily_task_definitions, 007)
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

-- ============================================================================
-- 9. 成就系统完整名录 (achievement_definitions, 008)
-- ============================================================================
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

-- ============================================================================
-- 10. 全服超级大奖池定义 (jackpot_pools, 013)
-- ============================================================================
INSERT INTO jackpot_pools (pool_code, current_amount, seed_amount, tax_rate, total_paid_out, updated_at)
VALUES ('MEGA_COIN_POOL', 100000.00, 100000.00, 0.0150, 0.00, NOW())
ON CONFLICT (pool_code) DO NOTHING;

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

-- 玩家登录凭据（默认密码: 123456，算法: PBKDF2-SHA256-100000）
INSERT INTO player_credentials (
    player_id, password_hash, password_algorithm, password_version, failed_login_count, locked_until, last_password_changed_at, created_at, updated_at)
SELECT
    p.id, 'eWA331vQByi0kri6QJQfjg==./Ny6yaHAqjtm+KqHWUYVdmHvuUDGHCqA1AP4J3Qe6VI=', 'PBKDF2-SHA256-100000', 1, 0, NULL, NOW(), NOW(), NOW()
FROM players AS p
ON CONFLICT (player_id) DO NOTHING;

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
JOIN daily_task_definitions AS t ON t.task_code = 'DAILY_RACE_COUNT_3'
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



-- ============================================================================
-- 13. 四十只西部纯血牧场小马驹 (ranch_horses, 017)
-- ============================================================================
DO $$
DECLARE
    v_player_id BIGINT;
    v_player2_id BIGINT;
BEGIN
    SELECT id INTO v_player_id FROM players ORDER BY id ASC LIMIT 1;
    IF v_player_id IS NULL THEN
        INSERT INTO players (account_id, account_normalized, nickname, locale, level, exp, is_active, created_at, updated_at)
        VALUES ('system_ranch', 'SYSTEM_RANCH', '西部纯血牧场', 'zh-CN', 10, 5000, TRUE, NOW(), NOW())
        RETURNING id INTO v_player_id;
    END IF;

    SELECT id INTO v_player2_id FROM players WHERE id <> v_player_id ORDER BY id ASC LIMIT 1;
    IF v_player2_id IS NULL THEN
        v_player2_id := v_player_id;
    END IF;

    -- 插入 40 只小马驹（分为四大血统档位：WILD 10只、PLAINS_TB 12只、ROYAL 10只、MYTHIC 8只）
    INSERT INTO ranch_horses (
        owner_player_id,
        horse_code,
        custom_name,
        gender,
        growth_stage,
        level,
        current_exp,
        max_exp,
        pedigree_tier,
        generation,
        coat_color,
        running_style,
        speed_stat,
        speed_potential,
        stamina_stat,
        stamina_potential,
        burst_stat,
        burst_potential,
        agility_stat,
        agility_potential,
        temperament_stat,
        temperament_potential,
        hunger_level,
        stamina_energy,
        condition_level,
        hoof_wear,
        intimacy_level,
        health_points,
        is_licensed_racer,
        sub_status,
        last_digested_at,
        created_at,
        updated_at
    )
    VALUES
        -- 一、WILD 荒原小马驹 (10 只, 偏好野性、机敏)
        (v_player_id, '#FOAL-2026-0001', '荒野微风', 'STALLION', 'FOAL', 1, 15, 100, 'WILD', 1, 'BAY', 'STALKER', 38.50, 68.00, 39.00, 69.00, 37.00, 67.00, 37.50, 66.00, 41.00, 70.00, 5, 100, 95, 0, 20, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0002', '沙原跳羚', 'MARE',     'FOAL', 1, 20, 100, 'WILD', 1, 'CHESTNUT', 'FRONT_RUNNER', 39.20, 69.50, 38.00, 68.00, 38.50, 68.50, 38.00, 67.00, 39.50, 68.00, 10, 95, 92, 2, 25, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0003', '小风滚草', 'STALLION', 'FOAL', 1, 5,  100, 'WILD', 1, 'DUN', 'BATTLER', 37.00, 65.00, 40.50, 70.00, 36.00, 65.00, 39.00, 68.00, 42.00, 71.00, 0, 100, 98, 0, 15, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0004', '斑纹雏雀', 'MARE',     'FOAL', 1, 30, 100, 'WILD', 1, 'ROAN', 'CLOSER', 38.00, 67.00, 37.50, 66.50, 39.00, 69.00, 36.50, 66.00, 40.00, 69.00, 15, 90, 88, 5, 30, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0005', '红岩幼石', 'STALLION', 'FOAL', 1, 10, 100, 'WILD', 1, 'BAY', 'BATTLER', 36.50, 66.00, 41.00, 71.00, 35.50, 64.50, 38.00, 67.00, 43.00, 72.00, 0, 100, 96, 0, 18, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0006', '峡谷风鸣', 'MARE',     'FOAL', 1, 25, 100, 'WILD', 1, 'BLACK', 'STALKER', 39.00, 68.50, 38.50, 68.00, 38.00, 67.50, 37.00, 66.50, 41.50, 70.50, 8, 98, 94, 1, 22, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0007', '晨原甘露', 'MARE',     'FOAL', 1, 40, 100, 'WILD', 1, 'GRAY', 'CLOSER', 37.80, 67.00, 39.20, 69.00, 37.50, 67.00, 38.20, 67.50, 40.80, 70.00, 12, 92, 90, 3, 35, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0008', '金沙砾石', 'STALLION', 'FOAL', 1, 0,  100, 'WILD', 1, 'PALOMINO', 'FRONT_RUNNER', 39.50, 70.00, 37.00, 66.00, 38.80, 69.00, 37.20, 66.80, 39.00, 68.00, 0, 100, 100, 0, 12, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0009', '暮色流火', 'STALLION', 'FOAL', 1, 18, 100, 'WILD', 1, 'CHESTNUT', 'STALKER', 38.80, 68.80, 38.80, 68.80, 37.20, 66.50, 37.80, 67.00, 40.20, 69.50, 6, 96, 95, 2, 28, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0010', '平原小羚', 'MARE',     'FOAL', 1, 35, 100, 'WILD', 1, 'BAY', 'CLOSER', 38.20, 68.00, 38.00, 67.50, 38.20, 68.00, 38.50, 68.50, 41.00, 70.50, 14, 94, 91, 4, 32, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),

        -- 二、PLAINS_TB 怀俄明平原纯血马驹 (12 只, 均衡出众)
        (v_player_id, '#FOAL-2026-0011', '怀俄明晨光', 'STALLION', 'FOAL', 1, 20, 100, 'PLAINS_TB', 1, 'BAY', 'FRONT_RUNNER', 44.00, 78.00, 43.50, 77.50, 43.00, 76.50, 42.00, 75.50, 44.50, 78.50, 5, 100, 96, 0, 25, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0012', '平原骄阳', 'MARE',     'FOAL', 1, 15, 100, 'PLAINS_TB', 1, 'CHESTNUT', 'STALKER', 43.20, 76.80, 45.00, 79.00, 42.50, 76.00, 43.00, 77.00, 45.00, 79.00, 8, 97, 95, 1, 30, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0013', '雪山疾影', 'STALLION', 'FOAL', 1, 45, 100, 'PLAINS_TB', 1, 'GRAY', 'CLOSER', 45.50, 80.00, 42.00, 75.50, 44.80, 79.50, 43.50, 78.00, 43.00, 77.00, 12, 92, 90, 3, 38, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0014', '铜蹄小将', 'STALLION', 'FOAL', 1, 10, 100, 'PLAINS_TB', 1, 'BUCKSKIN', 'BATTLER', 42.50, 76.00, 46.00, 81.00, 41.50, 75.00, 42.00, 75.50, 46.50, 81.50, 0, 100, 99, 0, 20, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0015', '金鬃幼狮', 'MARE',     'FOAL', 1, 30, 100, 'PLAINS_TB', 1, 'PALOMINO', 'FRONT_RUNNER', 44.80, 79.20, 43.00, 77.00, 44.00, 78.50, 42.80, 76.80, 44.00, 78.00, 10, 95, 93, 2, 34, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0016', '飞燕回旋', 'MARE',     'FOAL', 1, 55, 100, 'PLAINS_TB', 1, 'BLACK', 'STALKER', 43.80, 77.50, 44.20, 78.00, 43.00, 77.00, 44.50, 79.00, 44.80, 78.50, 16, 88, 87, 5, 42, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0017', '松林长风', 'STALLION', 'FOAL', 1, 25, 100, 'PLAINS_TB', 1, 'BAY', 'CLOSER', 45.00, 79.50, 43.80, 78.00, 44.20, 78.80, 43.00, 77.20, 43.50, 77.80, 6, 98, 94, 1, 28, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0018', '赤褐之星', 'MARE',     'FOAL', 1, 5,  100, 'PLAINS_TB', 1, 'ROAN', 'BATTLER', 43.00, 76.50, 45.50, 80.20, 42.00, 75.80, 43.20, 77.00, 45.20, 80.00, 0, 100, 100, 0, 16, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0019', '原野逐梦', 'STALLION', 'FOAL', 1, 35, 100, 'PLAINS_TB', 1, 'CHESTNUT', 'STALKER', 44.20, 78.50, 44.00, 78.00, 43.50, 77.60, 43.80, 78.00, 44.00, 78.00, 8, 96, 95, 2, 36, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0020', '踏雪斑斓', 'MARE',     'FOAL', 1, 40, 100, 'PLAINS_TB', 1, 'GRAY', 'FRONT_RUNNER', 45.20, 79.80, 42.80, 76.50, 44.50, 79.00, 43.00, 77.00, 43.80, 78.00, 11, 93, 92, 3, 40, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0021', '疾风暗影', 'STALLION', 'FOAL', 1, 15, 100, 'PLAINS_TB', 1, 'BLACK', 'CLOSER', 45.80, 80.50, 43.00, 77.00, 45.00, 79.80, 43.20, 77.50, 43.00, 77.00, 4, 99, 97, 1, 24, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player_id, '#FOAL-2026-0022', '银沙轻浪', 'MARE',     'FOAL', 1, 28, 100, 'PLAINS_TB', 1, 'PALOMINO', 'STALKER', 43.50, 77.20, 44.80, 79.00, 43.20, 77.00, 44.00, 78.20, 44.50, 78.80, 9, 95, 94, 2, 32, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),

        -- 三、ROYAL 皇家御用殿堂马驹 (10 只, 卓越血统)
        (v_player2_id, '#FOAL-2026-0023', '皇家金冕', 'STALLION', 'FOAL', 1, 30, 100, 'ROYAL', 1, 'PALOMINO', 'FRONT_RUNNER', 49.50, 87.00, 48.00, 86.00, 49.00, 86.80, 48.50, 86.20, 50.00, 88.00, 5, 100, 97, 0, 35, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0024', '平原公爵', 'STALLION', 'FOAL', 1, 20, 100, 'ROYAL', 1, 'BAY', 'STALKER', 48.80, 86.00, 50.50, 89.00, 48.00, 85.50, 49.00, 87.00, 51.00, 89.50, 8, 96, 95, 1, 40, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0025', '紫罗兰玫瑰', 'MARE',   'FOAL', 1, 50, 100, 'ROYAL', 1, 'CHESTNUT', 'CLOSER', 50.20, 88.50, 48.20, 86.50, 50.80, 89.00, 49.50, 87.80, 49.00, 87.00, 12, 90, 89, 4, 48, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0026', '冠羽天翔', 'STALLION', 'FOAL', 1, 15, 100, 'ROYAL', 1, 'GRAY', 'BATTLER', 48.00, 85.00, 51.00, 90.00, 47.50, 84.80, 48.20, 86.00, 52.00, 91.00, 0, 100, 99, 0, 30, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0027', '翡翠王爵', 'STALLION', 'FOAL', 1, 40, 100, 'ROYAL', 1, 'BLACK', 'FRONT_RUNNER', 50.80, 89.00, 48.50, 87.00, 50.00, 88.50, 49.00, 87.50, 49.50, 87.80, 10, 94, 93, 2, 42, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0028', '银翼天使', 'MARE',     'FOAL', 1, 65, 100, 'ROYAL', 1, 'GRAY', 'STALKER', 49.20, 87.50, 49.80, 88.00, 49.00, 87.20, 50.50, 89.20, 50.00, 88.50, 15, 86, 85, 6, 50, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0029', '蓝宝晨曦', 'MARE',     'FOAL', 1, 25, 100, 'ROYAL', 1, 'BAY', 'CLOSER', 50.50, 88.80, 48.80, 87.00, 50.20, 88.60, 49.20, 87.50, 49.20, 87.20, 6, 98, 96, 1, 38, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0030', '帝国闪电', 'STALLION', 'FOAL', 1, 10, 100, 'ROYAL', 1, 'CHESTNUT', 'FRONT_RUNNER', 51.50, 90.00, 47.80, 85.50, 51.20, 89.80, 48.80, 86.80, 49.00, 87.00, 0, 100, 100, 0, 28, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0031', '贵族圆舞', 'MARE',     'FOAL', 1, 35, 100, 'ROYAL', 1, 'PALOMINO', 'STALKER', 49.00, 86.80, 50.20, 88.50, 48.50, 86.20, 49.80, 88.00, 50.50, 89.00, 8, 95, 94, 2, 44, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0032', '极光圣歌', 'MARE',     'FOAL', 1, 45, 100, 'ROYAL', 1, 'ROAN', 'CLOSER', 50.00, 88.20, 49.00, 87.20, 50.50, 89.00, 49.00, 87.00, 49.80, 88.00, 11, 92, 91, 3, 46, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),

        -- 四、MYTHIC 旷世神话幼驹 (8 只, 巅峰神级潜能)
        (v_player2_id, '#FOAL-2026-0033', '远古天火', 'STALLION', 'FOAL', 1, 35, 100, 'MYTHIC', 1, 'CHESTNUT', 'FRONT_RUNNER', 56.50, 97.50, 55.00, 96.00, 57.00, 98.20, 55.50, 96.50, 56.00, 97.00, 5, 100, 98, 0, 45, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0034', '雷霆独角', 'STALLION', 'FOAL', 1, 25, 100, 'MYTHIC', 1, 'BLACK', 'STALKER', 55.80, 96.80, 57.20, 98.50, 56.00, 97.00, 56.50, 97.50, 58.00, 99.50, 8, 97, 96, 1, 50, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0035', '星空引路者', 'MARE',   'FOAL', 1, 60, 100, 'MYTHIC', 1, 'GRAY', 'CLOSER', 57.20, 98.50, 55.50, 96.50, 58.00, 99.20, 57.00, 98.00, 56.50, 97.80, 10, 91, 90, 3, 55, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0036', '不灭赤焰', 'STALLION', 'FOAL', 1, 15, 100, 'MYTHIC', 1, 'BAY', 'BATTLER', 55.00, 96.00, 58.00, 99.50, 55.20, 96.20, 56.00, 97.00, 59.00, 100.00, 0, 100, 100, 0, 40, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0037', '风暴之子', 'STALLION', 'FOAL', 1, 45, 100, 'MYTHIC', 1, 'BLACK', 'FRONT_RUNNER', 58.00, 99.20, 55.80, 97.00, 58.50, 99.80, 56.20, 97.50, 56.80, 98.00, 8, 95, 95, 2, 48, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0038', '创世流光', 'MARE',     'FOAL', 1, 70, 100, 'MYTHIC', 1, 'PALOMINO', 'STALKER', 56.50, 97.80, 57.00, 98.20, 56.80, 98.00, 57.80, 99.00, 57.50, 98.80, 12, 88, 87, 5, 60, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0039', '炽天使之翼', 'MARE',   'FOAL', 1, 30, 100, 'MYTHIC', 1, 'GRAY', 'CLOSER', 57.50, 98.80, 56.00, 97.20, 57.80, 99.00, 56.80, 98.00, 57.00, 98.20, 6, 98, 97, 1, 52, 100, FALSE, 'IDLE', NOW(), NOW(), NOW()),
        (v_player2_id, '#FOAL-2026-0040', '深渊霸王', 'STALLION', 'FOAL', 1, 20, 100, 'MYTHIC', 1, 'BAY', 'BATTLER', 56.00, 97.00, 58.80, 100.00, 55.50, 96.50, 56.80, 98.00, 59.50, 100.00, 0, 100, 100, 0, 42, 100, FALSE, 'IDLE', NOW(), NOW(), NOW())
    ON CONFLICT (horse_code) DO UPDATE SET
        custom_name = EXCLUDED.custom_name,
        gender = EXCLUDED.gender,
        growth_stage = EXCLUDED.growth_stage,
        pedigree_tier = EXCLUDED.pedigree_tier,
        coat_color = EXCLUDED.coat_color,
        running_style = EXCLUDED.running_style,
        speed_stat = EXCLUDED.speed_stat,
        speed_potential = EXCLUDED.speed_potential,
        stamina_stat = EXCLUDED.stamina_stat,
        stamina_potential = EXCLUDED.stamina_potential,
        burst_stat = EXCLUDED.burst_stat,
        burst_potential = EXCLUDED.burst_potential,
        agility_stat = EXCLUDED.agility_stat,
        agility_potential = EXCLUDED.agility_potential,
        temperament_stat = EXCLUDED.temperament_stat,
        temperament_potential = EXCLUDED.temperament_potential,
        hunger_level = EXCLUDED.hunger_level,
        stamina_energy = EXCLUDED.stamina_energy,
        condition_level = EXCLUDED.condition_level,
        hoof_wear = EXCLUDED.hoof_wear,
        intimacy_level = EXCLUDED.intimacy_level,
        health_points = EXCLUDED.health_points,
        sub_status = EXCLUDED.sub_status,
        updated_at = NOW();

END $$;

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

COMMIT;


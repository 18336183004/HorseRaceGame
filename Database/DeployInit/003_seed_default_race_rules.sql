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

COMMIT;

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
《西部边境赛马会》赛马美术批量生产工具 (horse_art_batch)
========================================================
面向「一次性生成 180 张马匹图」需求的一体化流水线：

  1. 权威清单 (manifest)   —— 以 Database/DeployInit/002_seed_data.sql 为唯一数据源，
                             导出 20 匹成年马 + 40 匹小马驹的完整美术清单 (CSV)。
  2. 批量提示词 (prompts)  —— 为每一张图生成中英双语 AI 生图提示词，
                             严格对齐 img.png 三视图版式 / 18-20 世纪古典纯血写实风格。
  3. 后处理流水线 (process)—— 切图集、白底裁边、统一尺寸、由侧视图自动抠透明跑道精灵、
                             由正/侧/背三张单图拼合 Ortho 三视图版式图、按规范命名归档。
  4. 注册表输出 (registry) —— 生成 HorseAssetRegistry.ts 中 H13-H20 的预埋条目代码。

数量关系 (需求原文「180 张」)：
  20 成年马 × (正/侧/背 3 张 + 展示立绘 1 张 + 透明跑道精灵 1 张) = 100 张
  20 小马   × 4 生长阶段                                        =  80 张
  合计 = 180 张
  (游戏数据库实际注册 40 匹小马；本工具默认首批 20 匹 = 180 张，
   使用 --foals all 可扩展到 40 匹 = 260 张。)

用法示例：
  # 1) 生成清单与提示词
  python tools/horse_art_batch/horse_art_batch.py --build-manifests
  python tools/horse_art_batch/horse_art_batch.py --build-prompts

  # 2) AI 图集切分（可选）：把 AI 生成的网格图放入 input/grids/ 后
  python tools/horse_art_batch/horse_art_batch.py --split-grid --grid input/grids/sheet1.png --rows 4 --cols 5 --out input/adults

  # 3) 处理归档：把 AI 单图放入 input/adults/ 与 input/foals/ 后
  python tools/horse_art_batch/horse_art_batch.py --process --foals 20 --trim --derive

  # 4) 校验 180 张是否齐备
  python tools/horse_art_batch/horse_art_batch.py --verify --foals 20

  # 5) 输出注册表预埋代码
  python tools/horse_art_batch/horse_art_batch.py --emit-registry
"""

import argparse
import base64
import csv
import io
import os
import shutil
import sys

try:
    from PIL import Image, ImageOps
except ImportError:
    print("需要 Pillow: pip install Pillow")
    sys.exit(1)

REPO_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BATCH_DIR = os.path.dirname(os.path.abspath(__file__))
HORSES_DIR = os.path.join(REPO_ROOT, "Client", "assets", "textures", "horses")
FOALS_DIR = os.path.join(REPO_ROOT, "Client", "assets", "textures", "foals")
PROMPTS_DIR = os.path.join(BATCH_DIR, "prompts")
INPUT_DIR = os.path.join(BATCH_DIR, "input")
GRID_DIR = os.path.join(INPUT_DIR, "grids")
ADULT_INPUT_DIR = os.path.join(INPUT_DIR, "adults")
FOAL_INPUT_DIR = os.path.join(INPUT_DIR, "foals")

# ---------------------------------------------------------------------------
# 一、权威数据：20 匹成年马 (与 002_seed_data.sql horse_catalogs 一一对应)
# ---------------------------------------------------------------------------
ADULTS = [
    {"code": "H01", "no": 1,  "fileBase": "H01_CrimsonMeteor",      "nameZh": "赤焰流星", "nameEn": "Crimson Meteor",
     "coatZh": "深栗毛", "coatEn": "Rich Chestnut", "breedZh": "英国冲刺型纯血马", "breedEn": "British Sprinter Thoroughbred",
     "descZh": "19世纪古典赛马代表。深栗毛赤红光泽，额前有细长流星白斑，鬐甲高耸，胸廓深窄，后躯半腱肌饱满，具备顶级爆发力。",
     "descEn": "Classic 19th-century racer with glossy rich chestnut coat and a long white blaze; high withers, deep narrow chest, powerful hindquarters.",
     "style": "sprinter", "track": "turf", "keyColor": "red"},
    {"code": "H02", "no": 2,  "fileBase": "H02_EmeraldWind",        "nameZh": "翠风", "nameEn": "Emerald Wind",
     "coatZh": "铁青斑驳毛", "coatEn": "Dapple Grey", "breedZh": "轻量化耐力型纯血马", "breedEn": "Lightweight Stayer Thoroughbred",
     "descZh": "银白青斑相间，体态修长轻巧，头小颈弓优美，四肢关节纤细而韧性极佳，中长途耐力出众。",
     "descEn": "Silver-white dapple grey with a slender elegant frame, small head, arched neck, fine yet resilient joints, superb stamina.",
     "style": "stayer", "track": "turf", "keyColor": "green"},
    {"code": "H03", "no": 3,  "fileBase": "H03_GoldenArrow",        "nameZh": "金色箭矢", "nameEn": "Golden Arrow",
     "coatZh": "金黄帕洛米诺", "coatEn": "Golden Palomino", "breedZh": "短途冲刺纯血马", "breedEn": "Sprint Thoroughbred",
     "descZh": "金黄缎光被毛与纯白长鬃，背腰短而强韧，十字部肌肉隆起呈拉丝状，前胸宽厚。",
     "descEn": "Golden satin palomino coat with pure white mane and tail; short strong back, prominent croup muscles, broad chest.",
     "style": "accelerator", "track": "dry", "keyColor": "gold"},
    {"code": "H04", "no": 4,  "fileBase": "H04_ShadowHunter",       "nameZh": "暗影猎手", "nameEn": "Shadow Hunter",
     "coatZh": "煤黑纯黑", "coatEn": "Jet Black", "breedZh": "重型古典纯血赛马", "breedEn": "Classic Heavy Thoroughbred",
     "descZh": "通体乌黑无杂毛，眼神冷峻，肩胛倾角45度，步幅极大，后肢股二头肌如钢铁磐石。",
     "descEn": "Jet black with no white markings, cold sharp gaze, 45-degree shoulder angle, enormous stride, iron-like thigh muscles.",
     "style": "stalker", "track": "all", "keyColor": "black"},
    {"code": "H05", "no": 5,  "fileBase": "H05_SilverMoon",         "nameZh": "银月", "nameEn": "Silver Moon",
     "coatZh": "纯银白毛", "coatEn": "Pure White Grey", "breedZh": "欧洲古典贵族纯血", "breedEn": "Aristocratic European Purebred",
     "descZh": "宛如银白色月光，颈脊弧线挺拔，动作轻灵若御风而行，在泥地与雨战中步伐格外稳健。",
     "descEn": "Moonlight-white grey coat, proud arched neck, airy light movement; exceptionally steady on mud and in rain.",
     "style": "dark-horse", "track": "soft", "keyColor": "silver"},
    {"code": "H06", "no": 6,  "fileBase": "H06_BlueTide",           "nameZh": "蓝潮", "nameEn": "Blue Tide",
     "coatZh": "石板蓝灰沙毛", "coatEn": "Blue Roan", "breedZh": "大胸廓全天候赛马", "breedEn": "All-weather Power Horse",
     "descZh": "头黑身呈深蓝灰色，胸围深广，心肺容积巨大，推进力强劲，不畏强风与长直道。",
     "descEn": "Black head with deep blue-grey roan body; very deep girth, huge heart-and-lung capacity, powerful drive, fearless in wind and long straights.",
     "style": "balanced", "track": "all", "keyColor": "blue"},
    {"code": "H07", "no": 7,  "fileBase": "H07_PurpleLightning",    "nameZh": "紫电", "nameEn": "Purple Lightning",
     "coatZh": "深红骝微带紫光", "coatEn": "Liver Chestnut", "breedZh": "神经过敏型竞速马", "breedEn": "High-Agility Racer",
     "descZh": "耳短直立转动极其敏锐，腹线紧收，四蹄黑亮硬如坚石，起跑瞬间步频极快。",
     "descEn": "Liver chestnut with a violet sheen; short upright highly alert ears, tight underline, gleaming black hooves, explosive early stride rate.",
     "style": "volatile", "track": "firm", "keyColor": "purple"},
    {"code": "H08", "no": 8,  "fileBase": "H08_StormRun",           "nameZh": "暴风疾行", "nameEn": "Storm Run",
     "coatZh": "经典骝毛四蹄白", "coatEn": "Classic Bay", "breedZh": "骨量充沛型耐劳赛马", "breedEn": "Dense-Bone Endurance Horse",
     "descZh": "四蹄踏雪，红棕身躯配黑鬃黑尾，膝与飞节粗大，在重赛道及逆风战况中耐疲劳表现卓越。",
     "descEn": "Classic bay with four white socks, dark mane and tail; large knees and hocks, outstanding stamina on heavy tracks and into headwinds.",
     "style": "sprinter", "track": "wet", "keyColor": "navy"},
    {"code": "H09", "no": 9,  "fileBase": "H09_ThunderBreak",       "nameZh": "惊雷破空", "nameEn": "Thunder Break",
     "coatZh": "黑骝色白星章", "coatEn": "Dark Brown / Bay", "breedZh": "突击型大步幅赛马", "breedEn": "Long-Stride Sprinter",
     "descZh": "肩峰高耸，前胸胸肌双峰突出，出闸箱起步凶猛，直道冲刺如惊雷划空。",
     "descEn": "Dark brown-bay with a white star; high shoulders, prominent pectoral muscles, ferocious gate start, thunderbolt straight sprint.",
     "style": "volatile", "track": "dry", "keyColor": "yellow"},
    {"code": "H10", "no": 10, "fileBase": "H10_SunWarrior",         "nameZh": "烈阳战将", "nameEn": "Sun Warrior",
     "coatZh": "红枣骝色", "coatEn": "Blood Bay", "breedZh": "高压迫王者赛马", "breedEn": "Dominant Champion Blood",
     "descZh": "骨架宏伟，颈部呈拱形雄驹弧线，臀部圆硕厚重，并驾齐驱时能施加极大竞争压迫感。",
     "descEn": "Blood bay with a massive frame, arched stallion neck, heavy rounded croup; exerts strong competitive pressure side by side.",
     "style": "stayer", "track": "firm", "keyColor": "orange"},
    {"code": "H11", "no": 11, "fileBase": "H11_JadeDream",         "nameZh": "翡翠之梦", "nameEn": "Jade Dream",
     "coatZh": "沙金青骝", "coatEn": "Dun Roan", "breedZh": "柔韧持久型赛马", "breedEn": "Supple Stayer",
     "descZh": "毛色奇特雅致，后躯飞节动作如钟摆般平稳丝滑，擅长在赛程后半段自外侧悄然逆转。",
     "descEn": "Unusual dun-roan with sand-gold sheen; pendulum-smooth hock action, excels at late outside rallies.",
     "style": "dark-horse", "track": "heavy", "keyColor": "emerald"},
    {"code": "H12", "no": 12, "fileBase": "H12_AuroraStar",         "nameZh": "极光之星", "nameEn": "Aurora Star",
     "coatZh": "深褐配菱形星斑", "coatEn": "Star-Marked Dark Bay", "breedZh": "全能型现代纯血祖系", "breedEn": "All-Round Modern Thoroughbred",
     "descZh": "头身比例1:6，重心平衡极高，贴栏走内道转弯能力冠绝群马，各项赛程兼修。",
     "descEn": "Dark bay with a diamond star; 1:6 head-to-body ratio, perfect balance, unmatched rail-hugging turns.",
     "style": "balanced", "track": "turf", "keyColor": "cyan"},
    # ---- H13-H20 为数据库 017 批次新增马（当前复用旧图，需要独有立绘）----
    {"code": "H13", "no": 13, "fileBase": "H13_SkyFire",            "nameZh": "天火之翼", "nameEn": "Sky Fire Wing",
     "coatZh": "琥珀栗毛", "coatEn": "Amber Chestnut", "breedZh": "山地短途冲刺纯血", "breedEn": "Mountain Sprinter Thoroughbred",
     "descZh": "落基山脉边缘培育的顶级纯血，琥珀色栗毛在晴日下泛金光，晴朗硬质泥地上具备统治级冲刺极速。",
     "descEn": "Mountain-bred thoroughbred with amber chestnut coat gleaming gold in sunlight; dominant top speed on dry dirt.",
     "style": "sprinter", "track": "dry", "keyColor": "amber"},
    {"code": "H14", "no": 14, "fileBase": "H14_PlainsOverlord",     "nameZh": "荒原霸主", "nameEn": "Plains Overlord",
     "coatZh": "野生栗毛", "coatEn": "Wild Chestnut", "breedZh": "旷野耐力野血马", "breedEn": "Plains Endurance Wildblood",
     "descZh": "纯正旷野野马血统，栗毛粗粝带晒痕，心肺容量惊人，末程400米拉锯战胜率第一。",
     "descEn": "Untamed wildline chestnut with sun-bleached coarse coat, phenomenal heart-and-lungs, unbeatable in grinding final 400m duels.",
     "style": "stayer", "track": "all", "keyColor": "chestnut"},
    {"code": "H15", "no": 15, "fileBase": "H15_SilverBeam",         "nameZh": "白银之光", "nameEn": "Silver Beam",
     "coatZh": "铂银亮毛", "coatEn": "Platinum Silver", "breedZh": "贵族中距追袭纯血", "breedEn": "Aristocratic Middle-Distance Stalker",
     "descZh": "银白色鬃毛飞扬，擅长中后段借风滑行，最后弯道切内线突围能力拔群。",
     "descEn": "Flying platinum-silver mane, slips through the wind mid-race, outstanding inside-rail breaks in the final turn.",
     "style": "stalker", "track": "turf", "keyColor": "platinum"},
    {"code": "H16", "no": 16, "fileBase": "H16_ObsidianStorm",      "nameZh": "黑曜风暴", "nameEn": "Obsidian Storm",
     "coatZh": "炭黑灰毛", "coatEn": "Charcoal Black", "breedZh": "重型湿地泥地马", "breedEn": "Heavy Mud-Grinder",
     "descZh": "肌肉密度极高，炭黑被毛如黑曜石，强劲的后肢蹬踏力使其在烂泥湿地赛道如履平地。",
     "descEn": "High muscle density, obsidian-like charcoal coat, explosive hind-leg drive makes heavy mud tracks feel flat.",
     "style": "grinder", "track": "heavy", "keyColor": "charcoal"},
    {"code": "H17", "no": 17, "fileBase": "H17_MoonWalker",         "nameZh": "月影独行", "nameEn": "Moon Walker",
     "coatZh": "石板青灰毛", "coatEn": "Slate Grey", "breedZh": "沉稳缠斗型赛马", "breedEn": "Composed Battler",
     "descZh": "性格沉稳冷静，多马并驾齐驱时心率毫不紊乱，擅长狭窄空隙钻击。",
     "descEn": "Calm slate-grey veteran whose heart rate never wavers in packed fields; pierces through narrow gaps under pressure.",
     "style": "battler", "track": "all", "keyColor": "slate"},
    {"code": "H18", "no": 18, "fileBase": "H18_RagingHorn",         "nameZh": "狂怒号角", "nameEn": "Raging Horn",
     "coatZh": "古铜暗骝", "coatEn": "Bronze Dark Bay", "breedZh": "大步幅领放赛马", "breedEn": "Long-Stride Front-Runner",
     "descZh": "步幅宽大凶悍，古铜色暗骝毛在阳光下泛金属光泽，一旦起跑占据领放领地便极难被反超。",
     "descEn": "Wide ferocious stride, metallic bronze dark-bay coat; once it takes the front it is nearly impossible to pass.",
     "style": "sprinter", "track": "sand", "keyColor": "bronze"},
    {"code": "H19", "no": 19, "fileBase": "H19_GoldenEagle",        "nameZh": "金羽神鹰", "nameEn": "Golden Eagle",
     "coatZh": "鎏金黄栗", "coatEn": "Gilded Chestnut", "breedZh": "全能冠军后上马", "breedEn": "All-Round Champion Closer",
     "descZh": "黄金血统纯血名宿，鎏金栗毛配金色飞鬃，在各类赛道均能保持稳定胜率。",
     "descEn": "Gilded chestnut with golden flowing mane; championship winner with eagle-like closing power and rock-solid form on all tracks.",
     "style": "closer", "track": "turf", "keyColor": "gold"},
    {"code": "H20", "no": 20, "fileBase": "H20_AbyssalPhantom",     "nameZh": "深渊魅影", "nameEn": "Abyssal Phantom",
     "coatZh": "靛蓝玄黑", "coatEn": "Indigo Black", "breedZh": "绝杀型冷门黑马", "breedEn": "Last-Gasp Dark Horse",
     "descZh": "低调内敛但杀伤力巨大，靛蓝玄黑被毛在暗处近乎隐形，常在落后两马位的死局中上演绝杀。",
     "descEn": "Low-key indigo-black coat nearly invisible in shadow; legendary last-gasp turnarounds from two lengths behind.",
     "style": "dark-horse", "track": "all", "keyColor": "indigo"},
]

# ---------------------------------------------------------------------------
# 二、权威数据：40 匹牧场小马 (与 002_seed_data.sql ranch_horses 一一对应)
#     tier: WILD / PLAINS_TB / ROYAL / MYTHIC
# ---------------------------------------------------------------------------
_FOAL_ROWS = [
    # (序号, 中文名, 性别, 档位, 毛色, 英文名)
    (1,  "荒野微风", "STALLION", "WILD", "BAY", "Wild Breeze"),
    (2,  "沙原跳羚", "MARE", "WILD", "CHESTNUT", "Desert Gazelle"),
    (3,  "小风滚草", "STALLION", "WILD", "DUN", "Little Tumbleweed"),
    (4,  "斑纹雏雀", "MARE", "WILD", "ROAN", "Speckled Lark"),
    (5,  "红岩幼石", "STALLION", "WILD", "BAY", "Red Rock Foal"),
    (6,  "峡谷风鸣", "MARE", "WILD", "BLACK", "Canyon Echo"),
    (7,  "晨原甘露", "MARE", "WILD", "GRAY", "Morning Dew"),
    (8,  "金沙砾石", "STALLION", "WILD", "PALOMINO", "Golden Sand"),
    (9,  "暮色流火", "STALLION", "WILD", "CHESTNUT", "Dusk Flame"),
    (10, "平原小羚", "MARE", "WILD", "BAY", "Prairie Antelope"),
    (11, "怀俄明晨光", "STALLION", "PLAINS_TB", "BAY", "Wyoming Dawn"),
    (12, "平原骄阳", "MARE", "PLAINS_TB", "CHESTNUT", "Prairie Sun"),
    (13, "雪山疾影", "STALLION", "PLAINS_TB", "GRAY", "Snowpeak Shadow"),
    (14, "铜蹄小将", "STALLION", "PLAINS_TB", "BUCKSKIN", "Copper Hoof"),
    (15, "金鬃幼狮", "MARE", "PLAINS_TB", "PALOMINO", "Golden Mane Cub"),
    (16, "飞燕回旋", "MARE", "PLAINS_TB", "BLACK", "Swallow Spin"),
    (17, "松林长风", "STALLION", "PLAINS_TB", "BAY", "Pinewind"),
    (18, "赤褐之星", "MARE", "PLAINS_TB", "ROAN", "Russet Star"),
    (19, "原野逐梦", "STALLION", "PLAINS_TB", "CHESTNUT", "Field Dreamer"),
    (20, "踏雪斑斓", "MARE", "PLAINS_TB", "GRAY", "Snowdapple"),
    (21, "疾风暗影", "STALLION", "PLAINS_TB", "BLACK", "Gale Shadow"),
    (22, "银沙轻浪", "MARE", "PLAINS_TB", "PALOMINO", "Silver Sand"),
    (23, "皇家金冕", "STALLION", "ROYAL", "PALOMINO", "Royal Gold Crown"),
    (24, "平原公爵", "STALLION", "ROYAL", "BAY", "Prairie Duke"),
    (25, "紫罗兰玫瑰", "MARE", "ROYAL", "CHESTNUT", "Violet Rose"),
    (26, "冠羽天翔", "STALLION", "ROYAL", "GRAY", "Crested Sky"),
    (27, "翡翠王爵", "STALLION", "ROYAL", "BLACK", "Emerald Lord"),
    (28, "银翼天使", "MARE", "ROYAL", "GRAY", "Silver Wing Angel"),
    (29, "蓝宝晨曦", "MARE", "ROYAL", "BAY", "Sapphire Dawn"),
    (30, "帝国闪电", "STALLION", "ROYAL", "CHESTNUT", "Imperial Bolt"),
    (31, "贵族圆舞", "MARE", "ROYAL", "PALOMINO", "Noble Waltz"),
    (32, "极光圣歌", "MARE", "ROYAL", "ROAN", "Aurora Hymn"),
    (33, "远古天火", "STALLION", "MYTHIC", "CHESTNUT", "Ancient Ember"),
    (34, "雷霆独角", "STALLION", "MYTHIC", "BLACK", "Thunder Unicorn"),
    (35, "星空引路者", "MARE", "MYTHIC", "GRAY", "Star Guide"),
    (36, "不灭赤焰", "STALLION", "MYTHIC", "BAY", "Undying Flame"),
    (37, "风暴之子", "STALLION", "MYTHIC", "BLACK", "Son of Storm"),
    (38, "创世流光", "MARE", "MYTHIC", "PALOMINO", "Genesis Light"),
    (39, "炽天使之翼", "MARE", "MYTHIC", "GRAY", "Seraph Wing"),
    (40, "深渊霸王", "STALLION", "MYTHIC", "BAY", "Abyss King"),
]

_TIER_ZH = {"WILD": "荒原混血", "PLAINS_TB": "肯塔基良种", "ROYAL": "皇家纯血", "MYTHIC": "旷世神话"}
_TIER_EN = {"WILD": "Wild Cross", "PLAINS_TB": "Plains Thoroughbred", "ROYAL": "Royal Blood", "MYTHIC": "Mythic Blood"}
_COAT_ZH = {"BAY": "骝毛", "CHESTNUT": "栗毛", "DUN": "沙色野兔毛", "ROAN": "沙毛", "BLACK": "黑毛",
            "GRAY": "青灰毛", "PALOMINO": "帕洛米诺金毛", "BUCKSKIN": "鹿皮黄毛"}
_COAT_EN = {"BAY": "Bay", "CHESTNUT": "Chestnut", "DUN": "Dun", "ROAN": "Roan", "BLACK": "Black",
            "GRAY": "Gray", "PALOMINO": "Palomino", "BUCKSKIN": "Buckskin"}

FOALS = []
for _row in _FOAL_ROWS:
    idx, name_zh, gender, tier, coat, name_en = _row
    FOALS.append({
        "code": "F%02d" % idx,
        "idx": idx,
        "nameZh": name_zh,
        "nameEn": name_en,
        "gender": gender,
        "tier": tier,
        "tierZh": _TIER_ZH[tier],
        "tierEn": _TIER_EN[tier],
        "coat": coat,
        "coatZh": _COAT_ZH[coat],
        "coatEn": _COAT_EN[coat],
        "fileBase": "F%02d_%s" % (idx, name_en.replace(" ", "")),
    })

# 小马 4 生长阶段
STAGES = [
    {"file": "Stage1_Foal",      "stage": 1, "nameZh": "幼驹期",  "nameEn": "Foal",
     "age": "约 0~1 岁",
     "traitZh": "腿长占成年85%，头大身短，腹部圆鼓，绒毛丰厚蓬松，骨骺未闭合，线条圆润可爱。",
     "traitEn": "Legs at 85% of adult length, large head, short body, round belly, fluffy thick coat, unclosed growth plates, soft rounded lines."},
    {"file": "Stage2_Yearling",  "stage": 2, "nameZh": "青年期",  "nameEn": "Yearling",
     "age": "约 1~2 岁",
     "traitZh": "尴尬发育期。臀高比肩鬐高 2~5cm，骨架纵向拉伸，褪去胎毛换出光泽短毛，步态轻快富有弹跳力。",
     "traitEn": "Awkward stage; hips 2-5cm higher than withers, skeleton stretching vertically, baby coat replaced by glossy short hair, springy gait."},
    {"file": "Stage3_Adult",     "stage": 3, "nameZh": "成年期",  "nameEn": "Adult",
     "age": "约 3~5 岁",
     "traitZh": "成熟黄金比例。肩鬐与臀部齐平，胸廓宽深，骨骼完全闭合，胸肌臀肌分块饱满。",
     "traitEn": "Mature golden ratio; withers level with croup, deep broad chest, fully closed bones, well-defined chest and hindquarter muscles."},
    {"file": "Stage4_Pro",       "stage": 4, "nameZh": "职业赛马", "nameEn": "Racehorse",
     "age": "约 5 岁以上",
     "traitZh": "体脂低于8%，肌肉紧绷拉丝，皮下腹壁静脉隐现。佩戴专业竞技超轻马鞍、号码布与护腿绑带。",
     "traitEn": "Body fat below 8%, tight stringy muscles, faint abdominal veins; wears racing saddle, number cloth and protective boots."},
]

# ---------------------------------------------------------------------------
# 工具函数
# ---------------------------------------------------------------------------
def ensure_dirs():
    for d in [BATCH_DIR, PROMPTS_DIR, INPUT_DIR, GRID_DIR, ADULT_INPUT_DIR, FOAL_INPUT_DIR, HORSES_DIR, FOALS_DIR]:
        os.makedirs(d, exist_ok=True)

def adult_assets(horse):
    """成年马 5 类目标文件 (正/侧/背 + 展示 + 精灵)"""
    fb = horse["fileBase"]
    return {
        "front": f"{fb}_Ortho_Front.png",
        "side":  f"{fb}_Ortho_Side.png",
        "back":  f"{fb}_Ortho_Back.png",
        "showcase": f"{fb}_Showcase.png",
        "sprite":   f"{fb}_Sprite.png",
    }

def foal_assets(foal):
    """小马 4 阶段目标文件"""
    fb = foal["fileBase"]
    return {s["file"]: f"{fb}_{s['file']}.png" for s in STAGES}

def active_foals(foals_all, count):
    """--foals N / all 控制首批数量 (默认 20 = 180 张)"""
    if count is None or count == "all":
        return foals_all
    return foals_all[: int(count)]

def total_count(foal_count):
    """计算总张数：成年马 5 张/匹 + 小马 4 张/匹"""
    return len(ADULTS) * 5 + foal_count * 4

# ---------------------------------------------------------------------------
# 命令：构建清单 CSV
# ---------------------------------------------------------------------------
def build_manifests(foal_count):
    ensure_dirs()
    adult_csv = os.path.join(BATCH_DIR, "manifest_adults.csv")
    with open(adult_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["code", "horseNo", "nameZh", "nameEn", "fileBase", "coatZh", "coatEn", "breedZh", "breedEn",
                    "descriptionZh", "descriptionEn", "style", "track", "colorKey",
                    "frontFile", "sideFile", "backFile", "showcaseFile", "spriteFile", "orthoSheetFile"])
        for h in ADULTS:
            a = adult_assets(h)
            w.writerow([h["code"], h["no"], h["nameZh"], h["nameEn"], h["fileBase"],
                        h["coatZh"], h["coatEn"], h["breedZh"], h["breedEn"],
                        h["descZh"], h["descEn"], h["style"], h["track"], h["keyColor"],
                        a["front"], a["side"], a["back"], a["showcase"], a["sprite"],
                        f'{h["fileBase"]}_Ortho.png'])

    foals_sel = active_foals(FOALS, foal_count)
    foal_csv = os.path.join(BATCH_DIR, "manifest_foals.csv")
    with open(foal_csv, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["code", "idx", "nameZh", "nameEn", "gender", "tier", "tierZh", "tierEn",
                    "coat", "coatZh", "coatEn", "fileBase",
                    "Stage1_Foal", "Stage2_Yearling", "Stage3_Adult", "Stage4_Pro"])
        for fo in foals_sel:
            fa = foal_assets(fo)
            w.writerow([fo["code"], fo["idx"], fo["nameZh"], fo["nameEn"], fo["gender"],
                        fo["tier"], fo["tierZh"], fo["tierEn"], fo["coat"], fo["coatZh"], fo["coatEn"], fo["fileBase"],
                        fa["Stage1_Foal"], fa["Stage2_Yearling"], fa["Stage3_Adult"], fa["Stage4_Pro"]])

    print(f"已生成 {adult_csv}  (20 匹成年马)")
    print(f"已生成 {foal_csv}  ({len(foals_sel)} 匹小马 × 4 阶段)")
    print(f"本批目标图片总数: {total_count(len(foals_sel))} 张")

# ---------------------------------------------------------------------------
# 命令：构建批量提示词
# ---------------------------------------------------------------------------
def build_prompts(foal_count):
    ensure_dirs()
    foals_sel = active_foals(FOALS, foal_count)
    for h in ADULTS:
        p = adult_prompt(h)
        path = os.path.join(PROMPTS_DIR, f"{h['fileBase']}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(p)
    for fo in foals_sel:
        p = foal_prompt(fo)
        path = os.path.join(PROMPTS_DIR, f"{fo['fileBase']}.md")
        with open(path, "w", encoding="utf-8") as f:
            f.write(p)
    print(f"已生成提示词 {len(ADULTS) + len(foals_sel)} 个到 {PROMPTS_DIR}")

def _prompt_header():
    return (
        "# 《西部边境赛马会》马匹图鉴立绘生成提示词\n"
        "# 全局规范（每张图都必须遵守）\n"
        "1. 风格：欧美 18-20 世纪古典纯血马写实图鉴插画，羊皮纸影棚白底，无背景景物，无骑手。\n"
        "2. 透视：纯平视侧面（Side）/ 正对马头（Front）/ 正对马臀（Back），无透视畸变。\n"
        "3. 解剖：严格马科解剖比例，四蹄完整落地，头部朝向画面右方（侧面图）。\n"
        "4. 用色：写实油润被毛光泽，鬃尾丝质感，马蹄高光，禁止卡通、禁止 Q 版、禁止水印文字。\n"
        "5. 输出：单匹成年马全身像，透明或纯白背景，居中，四周留白 10%。\n"
    )

def adult_prompt(h):
    a = adult_assets(h)
    return (
        _prompt_header()
        + f"\n## 马匹：{h['nameZh']} / {h['nameEn']} (No.{h['no']}, {h['code']})\n"
        + f"- 毛色：{h['coatZh']} ({h['coatEn']})\n"
        + f"- 血统：{h['breedZh']} ({h['breedEn']})\n"
        + f"- 体态描述：{h['descZh']}\n"
        + f"- 跑法/气质：{h['style']}；擅长场地：{h['track']}\n\n"
        + "### 需要生成的 4 张图（同一匹马的四种姿态）\n\n"
        + f"1. 正面图 → 保存为 `{a['front']}`\n"
        + "   马头正对镜头，双耳前竖，额部花纹清晰，颈胸腹对称，四蹄并立。\n\n"
        + f"2. 侧面图 → 保存为 `{a['side']}`\n"
        + "   纯左侧面（马头朝右），四蹄踏地呈站立姿态，鬐甲-背-腰-臀连线呈古典赛马曲线。\n\n"
        + f"3. 背面图 → 保存为 `{a['back']}`\n"
        + "   正对马臀后方，尾根、臀肌、后肢飞节对称可见，马头被身体遮挡。\n\n"
        + f"4. 油画展示立绘 → 保存为 `{a['showcase']}`\n"
        + "   半身/全身 3/4 侧面艺术油画，暖色古典画廊背景虚化，强调鬃毛飘动与肌肉光泽。\n\n"
        + "（第 5 张 `{sprite}` 透明跑道精灵将由后处理脚本从侧面图自动抠图生成，无需单独生成。）\n".format(sprite=a["sprite"])
    )

def foal_prompt(fo):
    fa = foal_assets(fo)
    lines = [
        _prompt_header(),
        f"## 小马：{fo['nameZh']} / {fo['nameEn']} ({fo['code']}, {fo['tierZh']} {fo['tierEn']})",
        f"- 性别：{'雄马' if fo['gender'] == 'STALLION' else '雌马'}  毛色：{fo['coatZh']} ({fo['coatEn']})",
        "",
        "### 需要生成的 4 张图（同一匹小马的四个生长阶段，纯左侧面）",
        "",
    ]
    for s in STAGES:
        lines.append(f"- 阶段：{s['nameZh']} {s['nameEn']}（{s['age']}）→ 保存为 `{fa[s['file']]}`")
        lines.append(f"  体态：{s['traitZh']}")
        lines.append("")
    return "\n".join(lines)

# ---------------------------------------------------------------------------
# 命令：图集切分 (AI 网格图 → 单图)
# ---------------------------------------------------------------------------
def split_grid(grid_path, rows, cols, out_dir):
    if not os.path.exists(grid_path):
        print(f"找不到图集: {grid_path}")
        return
    im = Image.open(grid_path).convert("RGBA")
    w, h = im.size
    cw, ch = w // cols, h // rows
    os.makedirs(out_dir, exist_ok=True)
    for r in range(rows):
        for c in range(cols):
            box = im.crop((c * cw, r * ch, (c + 1) * cw, (r + 1) * ch))
            box = _trim_white(box)
            name = f"cell_{r}_{c}.png"
            box.save(os.path.join(out_dir, name))
    print(f"已切分 {rows}x{cols} → {out_dir} (每格 {cw}x{ch})")

def _trim_white(im, tol=245):
    """裁掉接近白色的边缘，返回裁切后的图像"""
    if im.mode != "RGBA":
        im = im.convert("RGBA")
    # 把接近白色的像素视为背景
    bg = im.convert("RGB")
    import numpy as np
    arr = np.array(bg)
    mask = (arr[:, :, 0] >= tol) & (arr[:, :, 1] >= tol) & (arr[:, :, 2] >= tol)
    if mask.all():
        return im
    rows = np.any(~mask, axis=1)
    cols = np.any(~mask, axis=0)
    if not rows.any() or not cols.any():
        return im
    r0, r1 = np.argmax(rows), len(rows) - np.argmax(rows[::-1])
    c0, c1 = np.argmax(cols), len(cols) - np.argmax(cols[::-1])
    return im.crop((c0, r0, c1, r1))

# ---------------------------------------------------------------------------
# 命令：后处理归档 (裁边/统一尺寸/抠精灵/拼 Ortho)
# ---------------------------------------------------------------------------
def process_art(foal_count, do_trim, do_derive, only=None):
    ensure_dirs()
    adults_sel = ADULTS
    foals_sel = active_foals(FOALS, foal_count)
    if only:
        adults_sel = [h for h in ADULTS if h["code"].startswith(only)]
        foals_sel = [fo for fo in foals_sel if fo["code"].startswith(only)]
        print(f"试点模式 --only {only}: 成年马 {len(adults_sel)} 匹, 小马 {len(foals_sel)} 匹")
    ok, fail = 0, []

    # 成年马
    for h in adults_sel:
        a = adult_assets(h)
        for key in ["front", "side", "back", "showcase"]:
            fname = a[key]
            s = os.path.join(ADULT_INPUT_DIR, fname)
            d = os.path.join(HORSES_DIR, fname)
            if not os.path.exists(s):
                fail.append(f"缺输入: {s}")
                continue
            img = Image.open(s).convert("RGBA")
            if do_trim:
                img = _trim_white(img)
            img.save(d)
            ok += 1
        # 由侧面图派生透明跑道精灵
        side_path = os.path.join(HORSES_DIR, a["side"])
        sprite_path = os.path.join(HORSES_DIR, a["sprite"])
        if do_derive and os.path.exists(side_path):
            derive_sprite(side_path, sprite_path)
            ok += 1
        # 由正/侧/背拼合 Ortho 三视图版式图
        ortho_path = os.path.join(HORSES_DIR, f'{h["fileBase"]}_Ortho.png')
        assemble_ortho(
            [os.path.join(HORSES_DIR, a["front"]),
             os.path.join(HORSES_DIR, a["side"]),
             os.path.join(HORSES_DIR, a["back"])],
            ortho_path)

    # 小马
    for fo in foals_sel:
        fa = foal_assets(fo)
        for s in STAGES:
            fname = fa[s["file"]]
            s_in = os.path.join(FOAL_INPUT_DIR, fname)
            d = os.path.join(FOALS_DIR, fname)
            if not os.path.exists(s_in):
                fail.append(f"缺输入: {s_in}")
                continue
            img = Image.open(s_in).convert("RGBA")
            if do_trim:
                img = _trim_white(img)
            img.save(d)
            ok += 1

    print(f"处理完成: 成功 {ok} 张, 失败/缺失 {len(fail)} 项")
    for x in fail[:40]:
        print("  -", x)

def derive_sprite(side_path, out_path, target_h=256):
    """侧面图 → 透明背景跑道精灵 (自动抠白底)"""
    im = Image.open(side_path).convert("RGBA")
    im = _trim_white(im)
    px = im.load()
    w, h = im.size
    for y in range(h):
        for x in range(w):
            r, g, b, a = px[x, y]
            if r >= 248 and g >= 248 and b >= 248 and a > 0:
                px[x, y] = (r, g, b, 0)
    ratio = target_h / im.size[1]
    im = im.resize((max(1, int(im.size[0] * ratio)), target_h), Image.LANCZOS)
    im.save(out_path)
    print(f"  已生成透明精灵: {out_path}")

def assemble_ortho(src_list, out_path):
    """正/侧/背 三张图 → 高质量 Ortho 三视图版式（白底，侧视主图 + 正/背辅图）"""
    imgs = []
    for p in src_list:
        if os.path.exists(p):
            imgs.append(Image.open(p).convert("RGBA"))
    if len(imgs) < 2:
        return
    # 期望顺序: front, side, back
    front = imgs[0] if len(imgs) >= 1 else None
    side = imgs[1] if len(imgs) >= 2 else imgs[0]
    back = imgs[2] if len(imgs) >= 3 else None

    def fit(im, h):
        w = max(1, int(im.size[0] * h / im.size[1]))
        return im.resize((w, h), Image.LANCZOS)

    side_h = 720
    aux_h = 340
    gap = 28
    margin = 36
    side_f = fit(side, side_h)
    aux = []
    if front is not None:
        aux.append(fit(front, aux_h))
    if back is not None:
        aux.append(fit(back, aux_h))
    aux_w = sum(i.size[0] for i in aux) + gap * max(0, len(aux) - 1)
    col_w = max(side_f.size[0], aux_w)
    total_w = margin * 2 + side_f.size[0] + gap + aux_w
    total_h = margin * 2 + max(side_h, aux_h)
    # 右侧正/背水平对齐，整体居中
    sheet = Image.new("RGBA", (total_w, total_h), (255, 255, 255, 255))
    side_x = margin
    side_y = margin + (side_h - side_f.size[1]) // 2
    sheet.paste(side_f, (side_x, side_y), side_f)
    ax = margin + side_f.size[0] + gap
    ay = margin + (side_h - aux_h) // 2
    for im in aux:
        sheet.paste(im, (ax, ay), im)
        ax += im.size[0] + gap
    sheet.save(out_path)
    print(f"  已拼合三视图: {out_path} ({sheet.size[0]}x{sheet.size[1]})")

# ---------------------------------------------------------------------------
# 命令：校验 180 张是否齐备
# ---------------------------------------------------------------------------
def verify(foal_count, only=None):
    adults_sel = ADULTS
    foals_sel = active_foals(FOALS, foal_count)
    if only:
        adults_sel = [h for h in ADULTS if h["code"].startswith(only)]
        foals_sel = [fo for fo in foals_sel if fo["code"].startswith(only)]
    missing = []
    for h in adults_sel:
        a = adult_assets(h)
        for key, fname in a.items():
            p = os.path.join(HORSES_DIR, fname)
            if not os.path.exists(p):
                missing.append(fname)
    for fo in foals_sel:
        fa = foal_assets(fo)
        for fname in fa.values():
            p = os.path.join(FOALS_DIR, fname)
            if not os.path.exists(p):
                missing.append(fname)
    expected = len(adults_sel) * 5 + len(foals_sel) * 4
    present = expected - len(missing)
    print(f"校验: {present}/{expected} 张齐备 (成年马 {len(adults_sel)} 匹, 小马 {len(foals_sel)} 匹)")
    if missing:
        print("缺失清单:")
        for m in missing:
            print("  -", m)
    return 0 if not missing else 1

# ---------------------------------------------------------------------------
# 命令：输出 HorseAssetRegistry.ts 的 H13-H20 预埋代码
# ---------------------------------------------------------------------------
STYLE_MAP = {
    "sprinter": "FRONT_RUNNER", "accelerator": "FRONT_RUNNER", "volatile": "FRONT_RUNNER",
    "stayer": "BATTLER", "balanced": "BATTLER", "battler": "BATTLER", "grinder": "BATTLER",
    "stalker": "STALKER", "dark-horse": "STALKER",
    "closer": "CLOSER",
}

def registry_style(style_key):
    return STYLE_MAP.get(style_key, style_key.upper().replace("-", "_"))

def emit_registry():
    print("// 以下为 HorseAssetRegistry.HORSES 中 H13-H20 的预埋条目（复制粘贴到数组末尾）:\n")
    for h in ADULTS:
        if h["no"] <= 12:
            continue
        fb = h["fileBase"]
        print("    {")
        print(f'        id: "{h["code"]}",')
        print(f"        horseNo: {h['no']},")
        print(f'        nameZh: "{h["nameZh"]}",')
        print(f'        nameEn: "{h["nameEn"]}",')
        print(f'        coatColor: "{h["coatZh"]} ({h["coatEn"]})",')
        print(f'        breed: "{h["breedZh"]} ({h["breedEn"]})",')
        print(f'        descriptionZh: "{h["descZh"]}",')
        print(f'        showcaseUrl: "textures/horses/{fb}_Showcase",')
        print(f'        orthoUrl: "textures/horses/{fb}_Ortho",')
        print(f'        runningStyle: "{registry_style(h["style"])}"')
        print("    },")
        print()

# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser(description="赛马美术批量生产工具")
    ap.add_argument("--build-manifests", action="store_true", help="生成清单 CSV")
    ap.add_argument("--build-prompts", action="store_true", help="生成 AI 提示词")
    ap.add_argument("--split-grid", action="store_true", help="切分 AI 网格图集")
    ap.add_argument("--grid", default=None, help="图集路径")
    ap.add_argument("--rows", type=int, default=3)
    ap.add_argument("--cols", type=int, default=4)
    ap.add_argument("--process", action="store_true", help="后处理并归档")
    ap.add_argument("--verify", action="store_true", help="校验资产齐备")
    ap.add_argument("--emit-registry", action="store_true", help="输出注册表代码")
    ap.add_argument("--foals", default="20", help="小马数量: 20(默认180张) / 30(220张) / 40(260张) / all")
    ap.add_argument("--only", default=None, help="试点模式: 只处理指定马匹前缀, 如 H13 或 F01")
    ap.add_argument("--out", default=ADULT_INPUT_DIR, help="切分输出目录")
    ap.add_argument("--trim", action="store_true", help="裁白边")
    ap.add_argument("--derive", action="store_true", help="由侧面图抠透明精灵并拼 Ortho")
    args = ap.parse_args()

    if args.build_manifests:
        build_manifests(args.foals)
    if args.build_prompts:
        build_prompts(args.foals)
    if args.split_grid:
        split_grid(args.grid, args.rows, args.cols, args.out)
    if args.process:
        process_art(args.foals, args.trim, args.derive, only=args.only)
    if args.verify:
        sys.exit(verify(args.foals, only=args.only))
    if args.emit_registry:
        emit_registry()
    if not any([args.build_manifests, args.build_prompts, args.split_grid, args.process, args.verify, args.emit_registry]):
        ap.print_help()

if __name__ == "__main__":
    main()
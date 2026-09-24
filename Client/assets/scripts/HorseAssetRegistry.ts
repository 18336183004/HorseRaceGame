/**
 * 赛马 2D 美术资产与马匹图鉴注册中心 (HorseAssetRegistry)
 * 严格遵循欧美 18-20 世纪古典纯血马写实图鉴标准与生物发育四阶段规范。
 */

export interface HorseProfile {
    id: string;             // 唯一编码，如 H01, H02
    horseNo: number;        // 赛道马号 (1-12)
    nameZh: string;         // 中文名称
    nameEn: string;         // 英文代号
    coatColor: string;      // 毛色 (Chestnut, Bay, Dapple Grey...)
    breed: string;          // 历史原型血统 (18-20世纪纯血马 Thoroughbred)
    descriptionZh: string;  // 解剖学与体态特性描述
    showcaseUrl: string;    // 2D 油画展示图路径
    orthoUrl: string;       // 解剖三视图 (正/侧/背) 路径
    runningStyle: string;   // 推荐跑法 (Front-Runner, Stalker, Closer, Battler)
}

export enum FoalGrowthStage {
    Foal = 1,               // 幼驹期 (0~6个月)
    Yearling = 2,           // 青年期 (1~2岁)
    Adult = 3,              // 成年期 (3~4岁)
    RacingPro = 4,          // 职业赛马期 (4岁+ 竞技巅峰)
}

export interface FoalStageInfo {
    stage: FoalGrowthStage;
    nameZh: string;
    nameEn: string;
    ageDesc: string;
    anatomicalTrait: string;
    showcaseUrl: string;
    orthoUrl: string;
}

export interface HorseActionMeta {
    actionId: string;       // 动作编号 (ACT_01 - ACT_44)
    nameZh: string;         // 动作中文名
    nameEn: string;         // 动作英文标识
    category: "Movement" | "Daily" | "Social" | "Racing";
    durationSec: number;    // 循环或单次播放时长 (秒)
    isLoop: boolean;        // 是否循环
    description: string;    // 骨骼运动解剖要点
}

export class HorseAssetRegistry {
    /** 12 匹核心名驹权威档案矩阵 */
    public static readonly HORSES: HorseProfile[] = [
        {
            id: "H01",
            horseNo: 1,
            nameZh: "赤焰流星",
            nameEn: "Crimson Meteor",
            coatColor: "深栗毛 (Rich Chestnut)",
            breed: "英国冲刺型纯血马 (British Sprinter Thoroughbred)",
            descriptionZh: "19世纪古典赛马代表。深栗毛赤红光泽，额前有细长流星白斑，鬐甲高耸，胸廓深窄，后躯半腱肌饱满，具备顶级爆发力。",
            showcaseUrl: "textures/horses/H01_CrimsonMeteor_Showcase",
            orthoUrl: "textures/horses/H01_CrimsonMeteor_Ortho",
            runningStyle: "CLOSER"
        },
        {
            id: "H02",
            horseNo: 2,
            nameZh: "翠风",
            nameEn: "Emerald Wind",
            coatColor: "铁青斑驳毛 (Dapple Grey)",
            breed: "轻量化耐力型纯血马 (Lightweight Stayer)",
            descriptionZh: "银白青斑相间，体态修长轻巧，头小颈弓优美，四肢关节纤细而韧性极佳，中长途耐力出众。",
            showcaseUrl: "textures/horses/H02_EmeraldWind_Showcase",
            orthoUrl: "textures/horses/H02_EmeraldWind_Ortho",
            runningStyle: "STALKER"
        },
        {
            id: "H03",
            horseNo: 3,
            nameZh: "金色箭矢",
            nameEn: "Golden Arrow",
            coatColor: "金黄帕洛米诺 (Golden Palomino)",
            breed: "短途冲刺纯血马 (Sprint Thoroughbred)",
            descriptionZh: "金黄缎光被毛与纯白长鬃，背腰短而强韧，十字部肌肉隆起呈拉丝状，前胸宽厚。",
            showcaseUrl: "textures/horses/H03_GoldenArrow_Showcase",
            orthoUrl: "textures/horses/H03_GoldenArrow_Ortho",
            runningStyle: "FRONT_RUNNER"
        },
        {
            id: "H04",
            horseNo: 4,
            nameZh: "暗影猎手",
            nameEn: "Shadow Hunter",
            coatColor: "煤黑纯黑 (Jet Black)",
            breed: "重型古典纯血赛马 (Classic Heavy Thoroughbred)",
            descriptionZh: "通体乌黑无杂毛，眼神冷峻，肩胛倾角45度，步幅极大，后肢股二头肌如钢铁磐石。",
            showcaseUrl: "textures/horses/H04_ShadowHunter_Showcase",
            orthoUrl: "textures/horses/H04_ShadowHunter_Ortho",
            runningStyle: "BATTLER"
        },
        {
            id: "H05",
            horseNo: 5,
            nameZh: "银月",
            nameEn: "Silver Moon",
            coatColor: "纯银白毛 (Pure White Grey)",
            breed: "欧洲古典贵族纯血 (Aristocratic Purebred)",
            descriptionZh: "宛如银白色月光，颈脊弧线挺拔，动作轻灵若御风而行，在泥地与雨战中步伐格外稳健。",
            showcaseUrl: "textures/horses/H05_SilverMoon_Showcase",
            orthoUrl: "textures/horses/H05_SilverMoon_Ortho",
            runningStyle: "STALKER"
        },
        {
            id: "H06",
            horseNo: 6,
            nameZh: "蓝潮",
            nameEn: "Blue Tide",
            coatColor: "石板蓝灰沙毛 (Blue Roan)",
            breed: "大胸廓全天候赛马 (All-weather Power Horse)",
            descriptionZh: "头黑身呈深蓝灰色，胸围（Girth）深广，心肺容积巨大，推进力强劲，不畏强风与长直道。",
            showcaseUrl: "textures/horses/H06_BlueTide_Showcase",
            orthoUrl: "textures/horses/H06_BlueTide_Ortho",
            runningStyle: "BATTLER"
        },
        {
            id: "H07",
            horseNo: 7,
            nameZh: "紫电",
            nameEn: "Purple Lightning",
            coatColor: "深红骝微带紫光 (Liver Chestnut)",
            breed: "神经过敏型竞速马 (High-Agility Racer)",
            descriptionZh: "耳短直立转动极其敏锐，腹线紧收，四蹄黑亮硬如坚石，起跑瞬间步频极快。",
            showcaseUrl: "textures/horses/H07_PurpleLightning_Showcase",
            orthoUrl: "textures/horses/H07_PurpleLightning_Ortho",
            runningStyle: "FRONT_RUNNER"
        },
        {
            id: "H08",
            horseNo: 8,
            nameZh: "暴风疾行",
            nameEn: "Storm Run",
            coatColor: "经典骝毛四蹄白 (Classic Bay)",
            breed: "骨量充沛型耐劳赛马 (Dense Bone Endurance)",
            descriptionZh: "四蹄踏雪，红棕身躯配黑鬃黑尾，膝与飞节粗大，在重赛道及逆风战况中耐疲劳表现卓越。",
            showcaseUrl: "textures/horses/H08_StormRun_Showcase",
            orthoUrl: "textures/horses/H08_StormRun_Ortho",
            runningStyle: "BATTLER"
        },
        {
            id: "H09",
            horseNo: 9,
            nameZh: "惊雷破空",
            nameEn: "Thunder Break",
            coatColor: "黑骝色白星章 (Dark Brown/Bay)",
            breed: "突击型大步幅赛马 (Long-stride Sprinter)",
            descriptionZh: "肩峰高耸，前胸胸肌双峰突出，出闸箱起步凶猛，直道冲刺如惊雷划空。",
            showcaseUrl: "textures/horses/H09_ThunderBreak_Showcase",
            orthoUrl: "textures/horses/H09_ThunderBreak_Ortho",
            runningStyle: "CLOSER"
        },
        {
            id: "H10",
            horseNo: 10,
            nameZh: "烈阳战将",
            nameEn: "Sun Warrior",
            coatColor: "红枣骝色 (Blood Bay)",
            breed: "高压迫王者赛马 (Dominant Champion Blood)",
            descriptionZh: "骨架宏伟，颈部呈拱形雄驹弧线，臀部圆硕厚重，并驾齐驱时能施加极大竞争压迫感。",
            showcaseUrl: "textures/horses/H10_SunWarrior_Showcase",
            orthoUrl: "textures/horses/H10_SunWarrior_Ortho",
            runningStyle: "FRONT_RUNNER"
        },
        {
            id: "H11",
            horseNo: 11,
            nameZh: "翡翠之梦",
            nameEn: "Jade Dream",
            coatColor: "沙金青骝 (Dun Roan)",
            breed: "柔韧持久型赛马 (Supple Stayer)",
            descriptionZh: "毛色奇特雅致，后躯飞节动作如钟摆般平稳丝滑，擅长在赛程后半段自外侧悄然逆转。",
            showcaseUrl: "textures/horses/H11_JadeDream_Showcase",
            orthoUrl: "textures/horses/H11_JadeDream_Ortho",
            runningStyle: "CLOSER"
        },
        {
            id: "H12",
            horseNo: 12,
            nameZh: "极光之星",
            nameEn: "Aurora Star",
            coatColor: "深褐配菱形星斑 (Star-Marked Dark Bay)",
            breed: "全能型现代纯血祖系 (All-around Thoroughbred)",
            descriptionZh: "头身比例1:6，重心平衡极高，贴栏走内道转弯能力冠绝群马，各项赛程兼修。",
            showcaseUrl: "textures/horses/H12_AuroraStar_Showcase",
            orthoUrl: "textures/horses/H12_AuroraStar_Ortho",
            runningStyle: "STALKER"
        },
        {
            id: "H13",
            horseNo: 13,
            nameZh: "天火之翼",
            nameEn: "Sky Fire Wing",
            coatColor: "琥珀栗毛 (Amber Chestnut)",
            breed: "山地短途冲刺纯血 (Mountain Sprinter Thoroughbred)",
            descriptionZh: "落基山脉边缘培育的顶级纯血，琥珀色栗毛在晴日下泛金光，晴朗硬质泥地上具备统治级冲刺极速。",
            showcaseUrl: "textures/horses/H13_SkyFire_Showcase",
            orthoUrl: "textures/horses/H13_SkyFire_Ortho",
            runningStyle: "FRONT_RUNNER"
        },
        {
            id: "H14",
            horseNo: 14,
            nameZh: "荒原霸主",
            nameEn: "Plains Overlord",
            coatColor: "野生栗毛 (Wild Chestnut)",
            breed: "旷野耐力野血马 (Plains Endurance Wildblood)",
            descriptionZh: "纯正旷野野马血统，栗毛粗粝带晒痕，心肺容量惊人，末程400米拉锯战胜率第一。",
            showcaseUrl: "textures/horses/H14_PlainsOverlord_Showcase",
            orthoUrl: "textures/horses/H14_PlainsOverlord_Ortho",
            runningStyle: "BATTLER"
        },
        {
            id: "H15",
            horseNo: 15,
            nameZh: "白银之光",
            nameEn: "Silver Beam",
            coatColor: "铂银亮毛 (Platinum Silver)",
            breed: "贵族中距追袭纯血 (Aristocratic Middle-Distance Stalker)",
            descriptionZh: "银白色鬃毛飞扬，擅长中后段借风滑行，最后弯道切内线突围能力拔群。",
            showcaseUrl: "textures/horses/H15_SilverBeam_Showcase",
            orthoUrl: "textures/horses/H15_SilverBeam_Ortho",
            runningStyle: "STALKER"
        },
        {
            id: "H16",
            horseNo: 16,
            nameZh: "黑曜风暴",
            nameEn: "Obsidian Storm",
            coatColor: "炭黑灰毛 (Charcoal Black)",
            breed: "重型湿地泥地马 (Heavy Mud-Grinder)",
            descriptionZh: "肌肉密度极高，炭黑被毛如黑曜石，强劲的后肢蹬踏力使其在烂泥湿地赛道如履平地。",
            showcaseUrl: "textures/horses/H16_ObsidianStorm_Showcase",
            orthoUrl: "textures/horses/H16_ObsidianStorm_Ortho",
            runningStyle: "BATTLER"
        },
        {
            id: "H17",
            horseNo: 17,
            nameZh: "月影独行",
            nameEn: "Moon Walker",
            coatColor: "石板青灰毛 (Slate Grey)",
            breed: "沉稳缠斗型赛马 (Composed Battler)",
            descriptionZh: "性格沉稳冷静，多马并驾齐驱时心率毫不紊乱，擅长狭窄空隙钻击。",
            showcaseUrl: "textures/horses/H17_MoonWalker_Showcase",
            orthoUrl: "textures/horses/H17_MoonWalker_Ortho",
            runningStyle: "BATTLER"
        },
        {
            id: "H18",
            horseNo: 18,
            nameZh: "狂怒号角",
            nameEn: "Raging Horn",
            coatColor: "古铜暗骝 (Bronze Dark Bay)",
            breed: "大步幅领放赛马 (Long-Stride Front-Runner)",
            descriptionZh: "步幅宽大凶悍，古铜色暗骝毛在阳光下泛金属光泽，一旦起跑占据领放领地便极难被反超。",
            showcaseUrl: "textures/horses/H18_RagingHorn_Showcase",
            orthoUrl: "textures/horses/H18_RagingHorn_Ortho",
            runningStyle: "FRONT_RUNNER"
        },
        {
            id: "H19",
            horseNo: 19,
            nameZh: "金羽神鹰",
            nameEn: "Golden Eagle",
            coatColor: "鎏金黄栗 (Gilded Chestnut)",
            breed: "全能冠军后上马 (All-Round Champion Closer)",
            descriptionZh: "黄金血统纯血名宿，鎏金栗毛配金色飞鬃，在各类赛道均能保持稳定胜率。",
            showcaseUrl: "textures/horses/H19_GoldenEagle_Showcase",
            orthoUrl: "textures/horses/H19_GoldenEagle_Ortho",
            runningStyle: "CLOSER"
        },
        {
            id: "H20",
            horseNo: 20,
            nameZh: "深渊魅影",
            nameEn: "Abyssal Phantom",
            coatColor: "靛蓝玄黑 (Indigo Black)",
            breed: "绝杀型冷门黑马 (Last-Gasp Dark Horse)",
            descriptionZh: "低调内敛但杀伤力巨大，靛蓝玄黑被毛在暗处近乎隐形，常在落后两马位的死局中上演绝杀。",
            showcaseUrl: "textures/horses/H20_AbyssalPhantom_Showcase",
            orthoUrl: "textures/horses/H20_AbyssalPhantom_Ortho",
            runningStyle: "STALKER"
        }
    ];

    /** 小马驹 4 阶段成长标准定义（严格对照设计图约0-1岁、1-2岁、3-5岁、5岁以上） */
    public static readonly FOAL_STAGES: FoalStageInfo[] = [
        {
            stage: FoalGrowthStage.Foal,
            nameZh: "幼驹期",
            nameEn: "Foal",
            ageDesc: "约 0~1 岁",
            anatomicalTrait: "腿长占成年85%，头大身短，腹部圆鼓，绒毛丰厚蓬松，骨骺未闭合，线条圆润可爱。",
            showcaseUrl: "textures/foals/F01_WildBreeze_Stage1_Foal",
            orthoUrl: "textures/foals/F01_WildBreeze_Stage1_Foal"
        },
        {
            stage: FoalGrowthStage.Yearling,
            nameZh: "青年期",
            nameEn: "Yearling",
            ageDesc: "约 1~2 岁",
            anatomicalTrait: "尴尬发育期（Awkward Stage）。臀高比肩鬐高 2~5cm，骨架纵向拉伸，褪去胎毛换出光泽短毛，步态轻快富有弹跳力。",
            showcaseUrl: "textures/foals/F01_WildBreeze_Stage2_Yearling",
            orthoUrl: "textures/foals/F01_WildBreeze_Stage2_Yearling"
        },
        {
            stage: FoalGrowthStage.Adult,
            nameZh: "成年期",
            nameEn: "Adult",
            ageDesc: "约 3~5 岁",
            anatomicalTrait: "成熟黄金比例。肩鬐与臀部齐平（标准正方形身材），胸廓宽深，骨骼完全闭合，胸肌臀肌分块饱满，进入最佳配种与体态期。",
            showcaseUrl: "textures/foals/F01_WildBreeze_Stage3_Adult",
            orthoUrl: "textures/foals/F01_WildBreeze_Stage3_Adult"
        },
        {
            stage: FoalGrowthStage.RacingPro,
            nameZh: "职业赛马",
            nameEn: "Racehorse",
            ageDesc: "约 5 岁以上",
            anatomicalTrait: "体脂低于8%，肌肉紧绷拉丝，皮下腹壁静脉隐现。佩戴专业竞技超轻马鞍、号码布与护腿绑带，具备强烈竞技压迫感。",
            showcaseUrl: "textures/foals/F01_WildBreeze_Stage4_Pro",
            orthoUrl: "textures/foals/F01_WildBreeze_Stage4_Pro"
        }
    ];

    /** 四大类 30+ 项标准动作清单 */
    public static readonly ACTIONS: HorseActionMeta[] = [
        // 1. 步态与移动类
        { actionId: "ACT_01", nameZh: "慢步", nameEn: "Walk", category: "Movement", durationSec: 1.2, isLoop: true, description: "四拍步态，四蹄依次落地，最慢平稳步态" },
        { actionId: "ACT_02", nameZh: "快步", nameEn: "Trot", category: "Movement", durationSec: 0.8, isLoop: true, description: "对角双蹄同时落地，富有弹性，背线平稳" },
        { actionId: "ACT_03", nameZh: "跑步", nameEn: "Canter", category: "Movement", durationSec: 0.6, isLoop: true, description: "三拍步态，具有明显的领先腿与颈部前后呼吸摆动" },
        { actionId: "ACT_04", nameZh: "袭步", nameEn: "Gallop", category: "Movement", durationSec: 0.4, isLoop: true, description: "四拍极速奔跑，全身展开拉伸折叠，赛马冲刺核心动作" },
        { actionId: "ACT_05", nameZh: "倒退", nameEn: "Back", category: "Movement", durationSec: 1.0, isLoop: true, description: "对角两肢向后倒退，重心后移" },
        { actionId: "ACT_06", nameZh: "转弯", nameEn: "Turn", category: "Movement", durationSec: 0.8, isLoop: false, description: "身体向内侧倾斜，内侧领先腿内收" },
        { actionId: "ACT_07", nameZh: "侧步", nameEn: "Sidepass", category: "Movement", durationSec: 1.2, isLoop: true, description: "肢体交叉横向移动，马术常用" },
        { actionId: "ACT_08", nameZh: "急停", nameEn: "Sliding_Stop", category: "Movement", durationSec: 0.7, isLoop: false, description: "后肢深踏地面急停，前肢支撑扬沙" },

        // 2. 日常与生理类
        { actionId: "ACT_09", nameZh: "站立", nameEn: "Stand", category: "Daily", durationSec: 2.5, isLoop: true, description: "静止站立，腹部呼吸起伏，耳部转动" },
        { actionId: "ACT_10", nameZh: "卧倒", nameEn: "Lie_Down", category: "Daily", durationSec: 1.8, isLoop: false, description: "前肢折叠跪地，身体侧卧休息" },
        { actionId: "ACT_11", nameZh: "打滚", nameEn: "Roll", category: "Daily", durationSec: 3.0, isLoop: false, description: "躺下左右翻滚摩擦背部，放松清洁" },
        { actionId: "ACT_12", nameZh: "吃草", nameEn: "Graze", category: "Daily", durationSec: 2.0, isLoop: true, description: "低头咀嚼吃草，前肢微叉开" },
        { actionId: "ACT_13", nameZh: "饮水", nameEn: "Drink", category: "Daily", durationSec: 2.2, isLoop: true, description: "低头吞咽饮水，喉部有明显起伏" },
        { actionId: "ACT_14", nameZh: "伸懒腰", nameEn: "Stretch", category: "Daily", durationSec: 1.6, isLoop: false, description: "前肢前伸、背部下压成弓形" },
        { actionId: "ACT_15", nameZh: "蹭痒", nameEn: "Rub_Scratch", category: "Daily", durationSec: 1.5, isLoop: true, description: "用身体或头部蹭栏杆" },
        { actionId: "ACT_16", nameZh: "甩尾", nameEn: "Tail_Swish", category: "Daily", durationSec: 0.8, isLoop: false, description: "马尾从基部发力左右抽甩驱虫" },
        { actionId: "ACT_17", nameZh: "抖身", nameEn: "Shake", category: "Daily", durationSec: 1.2, isLoop: false, description: "全身波浪状剧烈抖落尘土" },
        { actionId: "ACT_18", nameZh: "喷鼻", nameEn: "Snort", category: "Daily", durationSec: 0.6, isLoop: false, description: "鼻孔扩大，深喷出气表达警觉" },
        { actionId: "ACT_19", nameZh: "排泄", nameEn: "Urinate_Def", category: "Daily", durationSec: 2.5, isLoop: false, description: "尾根翘起，后肢外展排泄" },

        // 3. 情绪与社交类
        { actionId: "ACT_20", nameZh: "嘶鸣", nameEn: "Neigh", category: "Social", durationSec: 1.4, isLoop: false, description: "昂首长鸣，下颌张开，呼唤同伴" },
        { actionId: "ACT_21", nameZh: "打响鼻", nameEn: "Snort_Alert", category: "Social", durationSec: 0.7, isLoop: false, description: "双耳竖立，短促喷气警觉" },
        { actionId: "ACT_22", nameZh: "刨地", nameEn: "Paw", category: "Social", durationSec: 1.0, isLoop: true, description: "单前蹄连续刮地，兴奋或急躁" },
        { actionId: "ACT_23", nameZh: "跺脚", nameEn: "Stamp", category: "Social", durationSec: 0.5, isLoop: false, description: "单蹄重力踩踏地面，烦躁驱虫" },
        { actionId: "ACT_24", nameZh: "甩头", nameEn: "Head_Toss", category: "Social", durationSec: 0.8, isLoop: false, description: "头部上下甩动翻飞鬃毛" },
        { actionId: "ACT_25", nameZh: "耳朵后贴", nameEn: "Ears_Pinned", category: "Social", durationSec: 0.4, isLoop: false, description: "双耳平贴颈项，警告威吓" },
        { actionId: "ACT_26", nameZh: "耳朵前转", nameEn: "Ears_Forward", category: "Social", durationSec: 0.3, isLoop: false, description: "双耳朝前集中，好奇注意" },
        { actionId: "ACT_27", nameZh: "龇牙", nameEn: "Baring_Teeth", category: "Social", durationSec: 0.8, isLoop: false, description: "上唇翻起暴露出齿龈，威胁试探" },
        { actionId: "ACT_28", nameZh: "踢", nameEn: "Kick", category: "Social", durationSec: 0.6, isLoop: false, description: "后肢向后上方猛力踹击" },
        { actionId: "ACT_29", nameZh: "尥蹶子", nameEn: "Buck", category: "Social", durationSec: 1.0, isLoop: false, description: "双后肢腾空踢起，身体弯弓" },
        { actionId: "ACT_30", nameZh: "起扬", nameEn: "Rear", category: "Social", durationSec: 1.5, isLoop: false, description: "前肢高高腾空，双后肢直立" },
        { actionId: "ACT_31", nameZh: "咬", nameEn: "Bite", category: "Social", durationSec: 0.6, isLoop: false, description: "探颈快速开合嘴部啃咬" },
        { actionId: "ACT_32", nameZh: "互相理毛", nameEn: "Grooming", category: "Social", durationSec: 2.0, isLoop: true, description: "双马并立啃咬对方颈项增进社交" },
        { actionId: "ACT_33", nameZh: "母马护驹", nameEn: "Maternal_Guard", category: "Social", durationSec: 1.8, isLoop: true, description: "母马身躯横向遮挡守护幼驹" },

        // 4. 骑乘与竞技类
        { actionId: "ACT_34", nameZh: "起跑", nameEn: "Start", category: "Racing", durationSec: 0.8, isLoop: false, description: "闸箱大开，爆发蹬地低重心冲出" },
        { actionId: "ACT_35", nameZh: "加速", nameEn: "Accelerate", category: "Racing", durationSec: 0.6, isLoop: true, description: "步幅逐步伸长，频率加快，身体下压" },
        { actionId: "ACT_36", nameZh: "冲刺", nameEn: "Sprint", category: "Racing", durationSec: 0.35, isLoop: true, description: "超频袭步冲刺，贴地疾驰" },
        { actionId: "ACT_37", nameZh: "并驾齐驱", nameEn: "Head_To_Head", category: "Racing", durationSec: 0.4, isLoop: true, description: "两马紧贴近身撕咬，展现拼搏战意" },
        { actionId: "ACT_38", nameZh: "被超越", nameEn: "Overtaken", category: "Racing", durationSec: 0.5, isLoop: false, description: "被其他马超过瞬间的侧视微仰" },
        { actionId: "ACT_39", nameZh: "冲线", nameEn: "Finish", category: "Racing", durationSec: 0.6, isLoop: false, description: "鼻尖前伸触及终点线的最后一跃" },
        { actionId: "ACT_40", nameZh: "跳跃", nameEn: "Jump", category: "Racing", durationSec: 1.2, isLoop: false, description: "跃起收腿越过障碍" },
        { actionId: "ACT_41", nameZh: "定后肢旋转", nameEn: "Spin", category: "Racing", durationSec: 0.8, isLoop: true, description: "单后腿为轴，前身快速划圆旋回" },
        { actionId: "ACT_42", nameZh: "换腿", nameEn: "Lead_Change", category: "Racing", durationSec: 0.45, isLoop: false, description: "腾空期快速切换左右领先肢" },
        { actionId: "ACT_43", nameZh: "收缩/伸长", nameEn: "Collection_Extension", category: "Racing", durationSec: 0.8, isLoop: false, description: "步频步幅紧密拉伸调节" },
        { actionId: "ACT_44", nameZh: "受惊", nameEn: "Spook", category: "Racing", durationSec: 0.5, isLoop: false, description: "突然受惊急停侧闪" }
    ];

    /** 根据马号 (1-12) 获取名驹信息 */
    public static getHorseByNo(horseNo: number): HorseProfile {
        const idx = Math.max(0, Math.min(this.HORSES.length - 1, (horseNo - 1) % this.HORSES.length));
        return this.HORSES[idx];
    }

    /** 根据中文名匹配名驹信息 */
    public static getHorseByName(nameZh?: string): HorseProfile | null {
        if (!nameZh) return null;
        return this.HORSES.find(h => h.nameZh === nameZh || nameZh.includes(h.nameZh)) || null;
    }

    /** 解析服务端下发的成长阶段字符串为枚举 (FOAL, JUVENILE, MATURE, PRO_RACER) */
    public static parseGrowthStage(stageStr?: string): FoalGrowthStage {
        if (!stageStr) return FoalGrowthStage.Adult;
        const s = stageStr.toUpperCase();
        if (s.includes("FOAL") || s.includes("幼")) return FoalGrowthStage.Foal;
        if (s.includes("JUVENILE") || s.includes("YEARLING") || s.includes("青")) return FoalGrowthStage.Yearling;
        if (s.includes("PRO") || s.includes("RACE") || s.includes("职")) return FoalGrowthStage.RacingPro;
        return FoalGrowthStage.Adult;
    }
}

import { _decorator, Component, Node, Graphics, Color, Vec3, UITransform, Sprite, SpriteFrame, Label, tween } from "cc";
import { FoalGrowthStage } from "./HorseAssetRegistry";
import { HorseSprites } from "./HorseSprites";
import { WestColors } from "./WestTheme";
import { WestAudio } from "./WestAudio";
import { WestHaptics } from "./WestHaptics";
import { WestTypography } from "./WestTypography";

const { ccclass, property } = _decorator;

export interface HorseActionDefinition {
    id: string;
    nameZh: string;
    nameEn: string;
    category: "Movement" | "Daily" | "Social" | "Racing";
    icon: string;
    description: string;
    isLoop: boolean;
    duration: number;
}

/** 模块化解剖铰接骨骼姿态数据 (Articulated Procedural Rig Pose) */
export interface ArticulatedRigPose {
    bodyY: number;
    bodyRot: number;
    neckRot: number;
    headRot: number;
    jawOpen: number;
    earAngle: number;
    foreNearShoulder: number;
    foreNearKnee: number;
    foreFarShoulder: number;
    foreFarKnee: number;
    hindNearHip: number;
    hindNearHock: number;
    hindFarHip: number;
    hindFarHock: number;
}

/**
 * 赛马 2D 写实视觉表现与动力学动作引擎 (HorseVisual2D)
 * 结合 18~20 世纪古典欧美纯血马设计图与四大类 40+ 项姿态规范，
 * 提供真实透明名驹精灵、马号竞技鞍布，以及程序化 2D 骨骼动力学变换
 * （含吃草、卧倒、打滚、起扬、尥蹶子、急停、伸懒腰、各级步态等二次创作动效）。
 */
@ccclass("HorseVisual2D")
export class HorseVisual2D extends Component {
    @property
    public horseNo: number = 1;

    @property
    public isPaddockMode: boolean = false; // 是否为牧场/马厩大舞台互动模式

    @property
    public isFoal: boolean = false;        // 是否为幼驹模式

    @property
    public foalStage: FoalGrowthStage = FoalGrowthStage.Adult; // 幼驹四阶段 (Foal, Yearling, Adult, Pro)

    private horseBodyNode: Node | null = null;
    private shadowNode: Node | null = null;
    private shadowG: Graphics | null = null;
    private saddleNode: Node | null = null;
    private saddleG: Graphics | null = null;

    // 模块化解剖铰接骨骼系统 (Articulated Procedural Anatomical Rig)
    private rigNode: Node | null = null;
    private rigG: Graphics | null = null;
    private currentRigPose: ArticulatedRigPose = {
        bodyY: 0, bodyRot: 0, neckRot: 0, headRot: 0, jawOpen: 0, earAngle: 0,
        foreNearShoulder: 0, foreNearKnee: 0, foreFarShoulder: 0, foreFarKnee: 0,
        hindNearHip: 0, hindNearHock: 0, hindFarHip: 0, hindFarHock: 0,
    };
    private targetRigPose: ArticulatedRigPose = {
        bodyY: 0, bodyRot: 0, neckRot: 0, headRot: 0, jawOpen: 0, earAngle: 0,
        foreNearShoulder: 0, foreNearKnee: 0, foreFarShoulder: 0, foreFarKnee: 0,
        hindNearHip: 0, hindNearHock: 0, hindFarHip: 0, hindFarHock: 0,
    };
    private horseG: Graphics | null = null;
    private spriteNode: Node | null = null;
    private speedLinesNode: Node | null = null;
    private speedLinesG: Graphics | null = null;

    // 8 帧标准奔跑序列与 2D 竞技骑师
    private jockeyNode: Node | null = null;
    private jockeySprite: Sprite | null = null;
    private jockeyG: Graphics | null = null;
    private gallopHorseFrames: SpriteFrame[] = [];
    private gallopJockeyFrames: SpriteFrame[] = [];
    private currentFrameIndex: number = 0;
    private frameTimer: number = 0;
    private isGallopAnimationLoaded: boolean = false;
    private staticSpriteFrame: SpriteFrame | null = null;

    // 物理马尾单摆与冲刺金红双色残影系统
    private tailNode: Node | null = null;
    private tailG: Graphics | null = null;
    private tailAngle: number = 0;
    private ghostNodes: Node[] = [];
    private ghostSprites: Sprite[] = [];
    private readonly ghostHistory: Array<{ x: number; y: number; rot: number; sf: SpriteFrame | null }> = [];

    // 高速奔跑鼻息喷汽系统 (High-Exertion Breath Puff)
    private breathNode: Node | null = null;
    private breathG: Graphics | null = null;
    private breathTimer: number = 0;
    private readonly breathPuffs: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; life: number; maxLife: number }> = [];
    private readonly breathPool: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; life: number; maxLife: number }> = [];

    // 并驾齐驱激烈对抗摩擦电光火花系统 (Head-to-Head Duel Clash Sparks)
    private isDueling: boolean = false;
    private duelNode: Node | null = null;
    private duelG: Graphics | null = null;
    private readonly duelSparks: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; life: number; maxLife: number; color: Color }> = [];
    private readonly duelSparkPool: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number; life: number; maxLife: number; color: Color }> = [];

    // 奔跑鬃毛迎风飘扬飞舞节点 (Wind-Whipped Mane Flutter)
    private maneNode: Node | null = null;
    private maneG: Graphics | null = null;

    // 头顶状态交互气泡节点
    private bubbleNode: Node | null = null;
    private bubbleG: Graphics | null = null;
    private bubbleLabel: Label | null = null;

    // 动作状态与物理参数
    private currentAction: string = "Stand";
    private currentActionNameZh: string = "站立待机";
    private currentActionIcon: string = "🐴";
    private animTime: number = 0;
    private actionTimer: number = 0;
    private actionDuration: number = 9999;
    private isActionLoop: boolean = true;
    private speedFactor: number = 1.0;
    private isSpriteLoaded: boolean = false;
    private viewScale: number = 1.0;

    // 牧场自动漫游动作演化计时器
    private idleCycleTimer: number = 0;
    private nextIdleCycleInterval: number = 7.0;

    /** 四大类全部标准动作库字典定义 */
    public static readonly ACTIONS_CATALOG: Record<string, HorseActionDefinition> = {
        // 一、步态与移动类 (8 项)
        Walk: { id: "Walk", nameZh: "慢步", nameEn: "Walk", category: "Movement", icon: "🚶", description: "四蹄依次落地，最慢平稳步态", isLoop: true, duration: 2.0 },
        Trot: { id: "Trot", nameZh: "快步", nameEn: "Trot", category: "Movement", icon: "🏃", description: "对角双蹄同时落地，富有弹性", isLoop: true, duration: 1.5 },
        Canter: { id: "Canter", nameZh: "跑步", nameEn: "Canter", category: "Movement", icon: "🏇", description: "三拍步态，具有节奏前推", isLoop: true, duration: 1.2 },
        Gallop: { id: "Gallop", nameZh: "袭步", nameEn: "Gallop", category: "Movement", icon: "⚡", description: "极速四拍奔跑，全身展开拉伸", isLoop: true, duration: 1.0 },
        Back: { id: "Back", nameZh: "后退", nameEn: "Back", category: "Movement", icon: "⬅️", description: "向后倒退调整位置", isLoop: true, duration: 1.8 },
        Turn: { id: "Turn", nameZh: "转弯", nameEn: "Turn", category: "Movement", icon: "🔄", description: "向侧向偏航转弯", isLoop: false, duration: 1.5 },
        Sidepass: { id: "Sidepass", nameZh: "侧步", nameEn: "Sidepass", category: "Movement", icon: "↔️", description: "马体侧向横移交叉步", isLoop: true, duration: 2.0 },
        Sliding_Stop: { id: "Sliding_Stop", nameZh: "急停", nameEn: "Sliding stop", category: "Movement", icon: "🛑", description: "后肢深踏地面急停刹车", isLoop: false, duration: 2.2 },

        // 二、日常与生理类 (11 项)
        Stand: { id: "Stand", nameZh: "站立", nameEn: "Stand", category: "Daily", icon: "🐴", description: "静止站立，伴随胸腔轻柔呼吸", isLoop: true, duration: 999 },
        Lie_Down: { id: "Lie_Down", nameZh: "卧倒", nameEn: "Lie down", category: "Daily", icon: "💤", description: "折腿俯身贴地休息", isLoop: true, duration: 3.5 },
        Roll: { id: "Roll", nameZh: "打滚", nameEn: "Roll", category: "Daily", icon: "🔄", description: "躺下左右翻滚放松摩擦", isLoop: false, duration: 3.0 },
        Graze: { id: "Graze", nameZh: "吃草", nameEn: "Graze", category: "Daily", icon: "🌾", description: "低头前伸啃食牧草", isLoop: false, duration: 3.2 },
        Drink: { id: "Drink", nameZh: "饮水", nameEn: "Drink", category: "Daily", icon: "💧", description: "深低头吞咽清水", isLoop: false, duration: 2.8 },
        Stretch: { id: "Stretch", nameZh: "伸懒腰", nameEn: "Stretch", category: "Daily", icon: "🧘", description: "前身深俯伸展，后背反弓", isLoop: false, duration: 2.5 },
        Rub_Scratch: { id: "Rub_Scratch", nameZh: "蹭痒", nameEn: "Rub", category: "Daily", icon: "🪵", description: "靠向围栏侧身蹭痒", isLoop: false, duration: 2.2 },
        Tail_Swish: { id: "Tail_Swish", nameZh: "甩尾", nameEn: "Tail swish", category: "Daily", icon: "🪰", description: "马尾发力左右抽甩驱虫", isLoop: false, duration: 1.8 },
        Shake: { id: "Shake", nameZh: "抖身", nameEn: "Shake", category: "Daily", icon: "💦", description: "全身波浪状剧烈抖动", isLoop: false, duration: 1.6 },
        Snort: { id: "Snort", nameZh: "喷鼻", nameEn: "Snort", category: "Daily", icon: "💨", description: "鼻孔扩大呼气警觉", isLoop: false, duration: 1.2 },
        Urinate_Def: { id: "Urinate_Def", nameZh: "排泄", nameEn: "Urinate", category: "Daily", icon: "🚽", description: "生理代谢与放松", isLoop: false, duration: 2.5 },

        // 三、情绪与社交类 (14 项)
        Neigh: { id: "Neigh", nameZh: "嘶鸣", nameEn: "Neigh", category: "Social", icon: "🎺", description: "仰头长声呼叫同伴", isLoop: false, duration: 2.2 },
        Snort_Alert: { id: "Snort_Alert", nameZh: "打响鼻", nameEn: "Snort Alert", category: "Social", icon: "👃", description: "短促喷气，双耳直竖警觉", isLoop: false, duration: 1.5 },
        Paw: { id: "Paw", nameZh: "刨地", nameEn: "Paw", category: "Social", icon: "🐾", description: "单前蹄节律性刮踏地面", isLoop: false, duration: 2.4 },
        Stamp: { id: "Stamp", nameZh: "跺脚", nameEn: "Stamp", category: "Social", icon: "💥", description: "用力重踏地面表达烦躁", isLoop: false, duration: 1.5 },
        Head_Toss: { id: "Head_Toss", nameZh: "甩头", nameEn: "Head toss", category: "Social", icon: "🙆", description: "头部上下甩动翻飞鬃毛", isLoop: false, duration: 1.8 },
        Ears_Pinned: { id: "Ears_Pinned", nameZh: "耳朵后贴", nameEn: "Ears pinned", category: "Social", icon: "😠", description: "愤怒威吓，防御紧绷", isLoop: false, duration: 2.0 },
        Ears_Forward: { id: "Ears_Forward", nameZh: "耳朵前转", nameEn: "Ears forward", category: "Social", icon: "👀", description: "双耳朝前集中，好奇机敏", isLoop: false, duration: 2.0 },
        Baring_Teeth: { id: "Baring_Teeth", nameZh: "龇牙", nameEn: "Baring teeth", category: "Social", icon: "😬", description: "翻唇露齿威胁试探", isLoop: false, duration: 1.6 },
        Kick: { id: "Kick", nameZh: "踢", nameEn: "Kick", category: "Social", icon: "🥋", description: "后肢向后上方猛力踹击", isLoop: false, duration: 1.6 },
        Buck: { id: "Buck", nameZh: "尥蹶子", nameEn: "Buck", category: "Social", icon: "🤸", description: "双后肢腾空踢起，前体弯弓", isLoop: false, duration: 2.2 },
        Rear: { id: "Rear", nameZh: "起扬", nameEn: "Rear", category: "Social", icon: "⚡", description: "前肢腾空高扬，双后肢立起", isLoop: false, duration: 2.5 },
        Bite: { id: "Bite", nameZh: "咬", nameEn: "Bite", category: "Social", icon: "🦷", description: "探颈快速开合嘴部试探", isLoop: false, duration: 1.4 },
        Grooming: { id: "Grooming", nameZh: "互相理毛", nameEn: "Grooming", category: "Social", icon: "🤝", description: "侧首轻柔啃咬增进社交", isLoop: false, duration: 2.5 },
        Maternal_Guard: { id: "Maternal_Guard", nameZh: "母马护驹", nameEn: "Guard", category: "Social", icon: "🛡️", description: "横向遮挡守护身侧幼驹", isLoop: false, duration: 2.5 },

        // 四、骑乘与竞技类 (11 项)
        Start: { id: "Start", nameZh: "起跑", nameEn: "Start", category: "Racing", icon: "🚦", description: "低重心爆发蹬地冲出", isLoop: false, duration: 1.5 },
        Accelerate: { id: "Accelerate", nameZh: "加速", nameEn: "Accelerate", category: "Racing", icon: "🚀", description: "步幅逐步加大，前倾下压", isLoop: true, duration: 1.2 },
        Sprint: { id: "Sprint", nameZh: "冲刺", nameEn: "Sprint", category: "Racing", icon: "🔥", description: "全力超频袭步贴地狂飙", isLoop: true, duration: 0.8 },
        Head_To_Head: { id: "Head_To_Head", nameZh: "并驾齐驱", nameEn: "Head to head", category: "Racing", icon: "⚔️", description: "两马紧贴近身撕咬拼搏", isLoop: true, duration: 1.5 },
        Overtaken: { id: "Overtaken", nameZh: "被超越", nameEn: "Overtaken", category: "Racing", icon: "👀", description: "被超车瞬间的侧视微仰", isLoop: false, duration: 1.5 },
        Finish: { id: "Finish", nameZh: "冲线", nameEn: "Finish", category: "Racing", icon: "🏁", description: "鼻尖前伸压线的最后一跃", isLoop: false, duration: 1.8 },
        Jump: { id: "Jump", nameZh: "跳跃", nameEn: "Jump", category: "Racing", icon: "🦘", description: "跃起收腿越过障碍", isLoop: false, duration: 2.0 },
        Spin: { id: "Spin", nameZh: "定后肢旋转", nameEn: "Spin", category: "Racing", icon: "🌀", description: "单后腿为轴定点回旋", isLoop: true, duration: 1.8 },
        Lead_Change: { id: "Lead_Change", nameZh: "换腿", nameEn: "Lead change", category: "Racing", icon: "👟", description: "腾空期切换领先肢", isLoop: false, duration: 1.2 },
        Collection_Extension: { id: "Collection_Extension", nameZh: "收缩/伸长", nameEn: "Stretch Pace", category: "Racing", icon: "📏", description: "步频步幅紧密拉伸调节", isLoop: true, duration: 1.6 },
        Spook: { id: "Spook", nameZh: "受惊", nameEn: "Spook", category: "Racing", icon: "😱", description: "突然受惊急停侧闪颤栗", isLoop: false, duration: 1.8 },

        // 五、幼驹萌趣与成长专属类 (3 项)
        Foal_Hop: { id: "Foal_Hop", nameZh: "幼驹欢跳", nameEn: "Foal Hop", category: "Daily", icon: "🐾", description: "四肢长腿轻盈腾跃小跳", isLoop: true, duration: 1.2 },
        Foal_Nuzzle: { id: "Foal_Nuzzle", nameZh: "亲昵蹭头", nameEn: "Foal Nuzzle", category: "Social", icon: "🥰", description: "向母马或骑手探头亲昵磨蹭", isLoop: false, duration: 2.0 },
        Foal_Frolic: { id: "Foal_Frolic", nameZh: "撒欢追逐", nameEn: "Foal Frolic", category: "Daily", icon: "✨", description: "轻快绕圈奔跃撒欢", isLoop: true, duration: 1.5 },
    };

    onLoad() {
        const rootUt = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootUt.setContentSize(120, 90);
        this.setupVisualNodes();
        this.node.on(Node.EventType.TOUCH_END, this.onTapHorse, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onTapHorse, this);
        this.breathPuffs.length = 0;
        this.breathPool.length = 0;
        this.ghostHistory.length = 0;
        this.ghostNodes.length = 0;
        this.ghostSprites.length = 0;
        this.duelSparks.length = 0;
        this.duelSparkPool.length = 0;
    }

    /** 设置并驾齐驱激烈死斗状态 */
    public setDueling(dueling: boolean): void {
        this.isDueling = dueling;
    }

    public getDueling(): boolean {
        return this.isDueling;
    }

    private lastPetTime: number = 0;

    /** 手势抚摸与交互轻触：触发拟真舒适反应、爱心粒子与触感反馈 */
    public petHorse(): void {
        const now = Date.now();
        if (now - this.lastPetTime < 650) {
            return;
        }
        this.lastPetTime = now;

        // 挑选温顺社交或日常亲密动作
        const petPool = ["Grooming", "Rub_Scratch", "Stretch", "Graze", "Neigh", "Ears_Forward"];
        const chosen = petPool[Math.floor(Math.random() * petPool.length)];
        this.setAction(chosen, 1.0);

        // 触感与拟音：胡萝卜清脆咀嚼 / 嘶鸣 / 鼻息
        WestHaptics.tap();
        const isCarrot = Math.random() > 0.45;
        if (isCarrot) {
            WestAudio.playCarrotCrunch("COMMON");
        } else if (chosen === "Neigh") {
            WestAudio.playHorseNeigh("COMMON");
        } else {
            WestAudio.playHorseSnort("COMMON");
        }

        // 生成向上飘散的爱心与亲密度羁绊气泡
        this.spawnAffectionHeart(isCarrot);
    }

    private onTapHorse(): void {
        // 牧场/马房/幼驹/互动模式下允许手势抚摸交互，比赛进行中不干扰视角
        if (this.isPaddockMode || this.isFoal) {
            this.petHorse();
        }
    }

    /** 生成向上飘浮并渐隐的爱心与胡萝卜互动粒子动画 (Affection Heart & Carrot FX) */
    private spawnAffectionHeart(isCarrot = false): void {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        const heartNode = new Node("AffectionHeart");
        heartNode.layer = this.node.layer;
        this.node.addChild(heartNode);
        const offsetX = (Math.random() - 0.5) * 20;
        heartNode.setPosition(offsetX, 32, 0);

        const ut = heartNode.addComponent(UITransform);
        ut.setContentSize(120, 24);

        const lbl = heartNode.addComponent(Label);
        lbl.fontSize = 13;
        lbl.lineHeight = 16;
        lbl.string = isCarrot ? "🥕 嘎嘣脆! +5" : (Math.random() > 0.4 ? "❤️ 亲密+5" : "✨ 鬃毛顺滑+5");
        lbl.color = isCarrot ? new Color(255, 140, 25, 255) : new Color(245, 60, 90, 255);

        heartNode.setScale(0.6, 0.6, 1);

        const targetY = 70 + Math.random() * 15;
        const driftX = offsetX + (Math.random() - 0.5) * 24;

        tween(heartNode)
            .to(0.22, { position: new Vec3(offsetX + (Math.random() - 0.5) * 8, 48, 0), scale: new Vec3(1.25, 1.25, 1) }, { easing: "backOut" })
            .to(0.68, { position: new Vec3(driftX, targetY, 0), scale: new Vec3(0.85, 0.85, 1) }, { easing: "sineOut" })
            .call(() => {
                if (heartNode && heartNode.isValid) {
                    heartNode.destroy();
                }
            })
            .start();
    }

    /** 初始化或重置马匹编号与资料 */
    public setHorseNo(horseNo: number) {
        this.isFoal = false;
        this.horseNo = Math.max(1, Math.min(20, horseNo));
        this.renderRealisticHorseSilhouette();
        this.renderSaddleCloth();
        this.drawProceduralTail();
        this.loadRunningSprite();
    }

    /** 初始化或重置幼驹展示 (支持单参数 stage 或双参数 foalNo, stage) */
    public setFoalStage(stageOrNo: number | FoalGrowthStage, stage?: FoalGrowthStage) {
        this.isFoal = true;
        if (stage !== undefined) {
            this.horseNo = Math.max(1, Math.min(20, stageOrNo as number));
            this.foalStage = stage;
        } else {
            this.foalStage = stageOrNo as FoalGrowthStage;
        }
        if (this.jockeyNode) {
            this.jockeyNode.active = this.foalStage === FoalGrowthStage.RacingPro && !this.isPaddockMode;
        }
        if (this.saddleNode) {
            this.saddleNode.active = this.foalStage === FoalGrowthStage.RacingPro;
        }

        // 依据成长阶段缩放尺寸
        let stageScale = 1.0;
        if (stage === FoalGrowthStage.Foal) stageScale = 0.76;
        else if (stage === FoalGrowthStage.Yearling) stageScale = 0.88;
        else if (stage === FoalGrowthStage.Adult) stageScale = 1.0;
        else if (stage === FoalGrowthStage.RacingPro) stageScale = 1.05;
        this.setDisplayScale(stageScale);

        // 载入纯透明赛马精灵 (杜绝静态方块图纸与照片遮挡)
        if (this.spriteNode && this.spriteNode.isValid) {
            HorseSprites.applyHorseRunningSprite(this.spriteNode, this.horseNo, (sf: SpriteFrame) => {
                if (!this.isValid || !this.spriteNode || !this.spriteNode.isValid) return;
                this.isSpriteLoaded = true;
                this.staticSpriteFrame = sf;
                const sp = this.spriteNode.getComponent(Sprite) || this.spriteNode.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = sf;
                const ut = this.spriteNode.getComponent(UITransform);
                if (ut) {
                    ut.setContentSize(102, 76);
                }
                if (this.horseG) this.horseG.clear();
            });
        }
        this.renderRealisticHorseSilhouette();
        this.renderSaddleCloth();
        this.drawProceduralTail();
        this.updateBubble();
    }

    /** 设置展示缩放比例 (例如牧场大舞台放大 2.5x, 跑道标准 1.0x)，只作用于内部视觉容器，杜绝外部宿主舞台变形 */
    public setDisplayScale(scale: number) {
        this.viewScale = Math.max(0.5, Math.min(3.5, scale));
        if (this.shadowNode && this.shadowNode.isValid) {
            this.shadowNode.setScale(this.viewScale, this.viewScale, 1);
            this.shadowNode.setPosition(0, -14 * this.viewScale, 0);
        }
        const rootUt = this.node.getComponent(UITransform);
        if (rootUt) {
            rootUt.setContentSize(120 * this.viewScale, 90 * this.viewScale);
        }
    }

    /** 设置跑道 2.5D 纵深透视缩放比例 (道次 0: 0.93x ~ 道次 5: 1.07x) */
    public setLaneDepthScale(depthScale: number): void {
        if (!this.isPaddockMode) {
            this.setDisplayScale(depthScale);
        }
    }

    /** 建立可视化节点树结构 */
    private setupVisualNodes() {
        // 1. 地面投射阴影节点 (独立于马体上下起伏，贴地投影)
        this.shadowNode = new Node("GroundShadow");
        this.shadowNode.layer = this.node.layer;
        this.node.addChild(this.shadowNode);
        this.shadowNode.setPosition(0, -16, 0);
        this.shadowNode.addComponent(UITransform).setContentSize(84, 20);
        this.shadowG = this.shadowNode.addComponent(Graphics);
        this.renderShadow(1.0, 95);

        // 1B. 冲刺残影拖尾节点池 (Ghost Afterimages: 极速奔跑金红双层幻影)
        this.ghostNodes = [];
        this.ghostSprites = [];
        for (let i = 0; i < 2; i++) {
            const ghost = new Node(`SprintGhost_${i}`);
            ghost.layer = this.node.layer;
            this.node.addChild(ghost);
            ghost.setPosition(0, 0, 0);
            const gUt = ghost.addComponent(UITransform);
            gUt.setContentSize(102, 76);
            const sp = ghost.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            ghost.active = false;
            this.ghostNodes.push(ghost);
            this.ghostSprites.push(sp);
        }

        // 2. 主身体容器节点（承载骨骼颠簸起伏、俯仰角与伸缩变形）
        this.horseBodyNode = new Node("RealisticBody");
        this.horseBodyNode.layer = this.node.layer;
        this.node.addChild(this.horseBodyNode);
        this.horseBodyNode.setPosition(0, 0, 0);

        const ut = this.horseBodyNode.addComponent(UITransform);
        ut.setContentSize(104, 76);

        // 矢量备用骨架 Graphics
        this.horseG = this.horseBodyNode.addComponent(Graphics);

        // 2B. 物理二次单摆马尾节点 (Procedural Secondary Tail)
        this.tailNode = new Node("ProceduralTail");
        this.tailNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.tailNode);
        this.tailNode.setPosition(-30, 8, 0);
        this.tailNode.addComponent(UITransform).setContentSize(40, 40);
        this.tailG = this.tailNode.addComponent(Graphics);
        this.drawProceduralTail();

        // 2C. 模块化解剖铰接骨骼系统节点 (Articulated Procedural Anatomical Rig)
        this.rigNode = new Node("ArticulatedRig");
        this.rigNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.rigNode);
        this.rigNode.setPosition(0, 0, 0);
        this.rigG = this.rigNode.addComponent(Graphics);
        this.rigNode.active = false;

        // 3. 真实概念图透明精灵节点 (向右奔跑高精油画精灵)
        this.spriteNode = new Node("HorseSprite");
        this.spriteNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.spriteNode);
        this.spriteNode.setPosition(0, 8, 0);
        const sUt = this.spriteNode.addComponent(UITransform);
        sUt.setContentSize(102, 76);

        // 3B. 2D 竞技职业写实骑师节点 (Aero Racing Jockey Rider)
        this.jockeyNode = new Node("JockeyRider");
        this.jockeyNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.jockeyNode);
        this.jockeyNode.setPosition(0, 16, 0);
        const jUt = this.jockeyNode.addComponent(UITransform);
        jUt.setContentSize(52, 42);
        this.jockeyG = this.jockeyNode.addComponent(Graphics);
        this.jockeySprite = this.jockeyNode.addComponent(Sprite);
        this.jockeySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.jockeyNode.active = !this.isPaddockMode && !this.isFoal;

        // 3C. 冲刺破空风阻线条节点 (Speed Lines)
        this.speedLinesNode = new Node("SpeedLines");
        this.speedLinesNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.speedLinesNode);
        this.speedLinesG = this.speedLinesNode.addComponent(Graphics);

        // 3D. 高速奔跑鼻息喷汽节点 (Nostril Steam Breath Puffs)
        this.breathNode = new Node("NostrilBreath");
        this.breathNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.breathNode);
        this.breathNode.setPosition(38, 14, 0);
        this.breathG = this.breathNode.addComponent(Graphics);

        // 3E. 奔跑鬃毛迎风飘扬飞舞节点 (Wind-Whipped Mane Flutter)
        this.maneNode = new Node("ManeFlutter");
        this.maneNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.maneNode);
        this.maneNode.setPosition(14, 18, 0);
        this.maneG = this.maneNode.addComponent(Graphics);

        // 3F. 两马并驾齐驱激烈对抗摩擦电光火花节点 (Duel Clash Friction Sparks)
        this.duelNode = new Node("DuelClashSparks");
        this.duelNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.duelNode);
        this.duelNode.setPosition(0, 0, 0);
        this.duelG = this.duelNode.addComponent(Graphics);

        // 4. 竞技专属鞍布与马号节点 (紧贴马背)
        this.saddleNode = new Node("SaddleCloth");
        this.saddleNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.saddleNode);
        this.saddleNode.setPosition(-6, 10, 0);
        this.saddleNode.addComponent(UITransform).setContentSize(28, 20);
        this.saddleG = this.saddleNode.addComponent(Graphics);

        // 5. 头顶状态与动作交互气泡（仅在牧场/马厩 PaddockMode 下展示互动心情，赛道比赛模式下静默隐藏，保持赛道视觉专注与纯粹）
        this.bubbleNode = new Node("StatusBubble");
        this.bubbleNode.layer = this.node.layer;
        this.node.addChild(this.bubbleNode);
        this.bubbleNode.setPosition(0, 48, 0);
        this.bubbleNode.addComponent(UITransform).setContentSize(130, 26);
        this.bubbleG = this.bubbleNode.addComponent(Graphics);
        this.bubbleNode.active = this.isPaddockMode;

        const lblNode = new Node("BubbleLabel");
        lblNode.layer = this.node.layer;
        this.bubbleNode.addChild(lblNode);
        this.bubbleLabel = lblNode.addComponent(Label);
        this.bubbleLabel.fontFamily = WestTypography.FONT_FAMILY;
        this.bubbleLabel.fontSize = 12.5;
        this.bubbleLabel.lineHeight = 16;
        this.bubbleLabel.spacingX = 0.3;
        this.bubbleLabel.isBold = true;
        this.bubbleLabel.color = WestColors.INK_DARK;

        this.renderSaddleCloth();
        this.renderAeroJockey(false);
        this.loadRunningSprite();
        this.updateBubble();
    }

    /** 绘制高精空气动力学写实西部骑师 (Aero Racing Jockey with Silks, Boots & Whip) */
    private renderAeroJockey(isSprinting = false, whipPhase = 0): void {
        if (!this.jockeyG || !this.jockeyG.isValid) return;
        this.jockeyG.clear();
        const silkColor = this.getJockeySilkColor();

        // 1. 骑师白色紧身赛马裤与大腿折叠 (White Breeches & Legs)
        this.jockeyG.fillColor = new Color(245, 245, 248, 255);
        this.jockeyG.moveTo(-10, 0);
        this.jockeyG.lineTo(-2, 10);
        this.jockeyG.lineTo(6, 4);
        this.jockeyG.lineTo(-2, -3);
        this.jockeyG.close();
        this.jockeyG.fill();

        // 2. 黑色高筒皮质马靴与马镫 (Leather Riding Boots & Stirrup)
        this.jockeyG.fillColor = new Color(28, 20, 16, 255);
        this.jockeyG.roundRect(-5, -6, 8, 6, 2);
        this.jockeyG.fill();
        this.jockeyG.strokeColor = WestColors.BRASS_FRAME;
        this.jockeyG.lineWidth = 1.0;
        this.jockeyG.rect(-6, -7, 10, 2);
        this.jockeyG.stroke();

        // 3. 极速流线型前俯躯干与官方彩衣 (Aero Jockey Silk Torso)
        this.jockeyG.fillColor = silkColor;
        this.jockeyG.moveTo(-4, 8);
        this.jockeyG.lineTo(12, 14);
        this.jockeyG.lineTo(14, 9);
        this.jockeyG.lineTo(2, 4);
        this.jockeyG.close();
        this.jockeyG.fill();

        // 彩衣前胸烫金/白色 V 型徽章或条纹装饰 (Silk Sash Stripe)
        this.jockeyG.strokeColor = HorseVisual2D._tempJockeySash;
        this.jockeyG.lineWidth = 1.6;
        this.jockeyG.moveTo(0, 7);
        this.jockeyG.lineTo(13, 11.5);
        this.jockeyG.stroke();

        // 4. 手臂向前紧握缰绳 (Arms Reaching Forward to Reins)
        this.jockeyG.fillColor = silkColor;
        this.jockeyG.moveTo(8, 12);
        this.jockeyG.lineTo(18, 6);
        this.jockeyG.lineTo(15, 3);
        this.jockeyG.lineTo(6, 9);
        this.jockeyG.close();
        this.jockeyG.fill();

        // 白色赛马手套
        this.jockeyG.fillColor = Color.WHITE;
        this.jockeyG.circle(18, 6, 2.4);
        this.jockeyG.fill();

        // 皮革缰绳 (Leather Reins)
        this.jockeyG.strokeColor = HorseVisual2D._tempJockeyReins;
        this.jockeyG.lineWidth = 1.2;
        this.jockeyG.moveTo(18, 6);
        this.jockeyG.lineTo(28, 8);
        this.jockeyG.stroke();

        // 5. 骑师头盔、防风护目镜与前倾低风阻头部 (Aero Helmet & Goggles)
        const headX = 14;
        const headY = 17;
        // 头部头盔底色 (与彩衣同色)
        this.jockeyG.fillColor = silkColor;
        this.jockeyG.circle(headX, headY, 5.0);
        this.jockeyG.fill();

        // 头盔前缘帽檐 (Visor)
        this.jockeyG.fillColor = HorseVisual2D._tempJockeyVisor;
        this.jockeyG.roundRect(headX + 1, headY - 1, 5, 2.2, 0.8);
        this.jockeyG.fill();

        // 防风护目镜 (Reflective Racing Goggles)
        this.jockeyG.fillColor = HorseVisual2D._tempJockeyGoggles;
        this.jockeyG.roundRect(headX + 0.5, headY - 0.5, 4.2, 3, 1.2);
        this.jockeyG.fill();
        this.jockeyG.strokeColor = HorseVisual2D._tempJockeyGogglesRim;
        this.jockeyG.lineWidth = 0.8;
        this.jockeyG.roundRect(headX + 0.5, headY - 0.5, 4.2, 3, 1.2);
        this.jockeyG.stroke();

        // 6. 冲刺绝杀鞭策手势 (Jockey Whip)
        if (isSprinting) {
            const whipAngle = Math.sin(whipPhase) * 25;
            this.jockeyG.strokeColor = HorseVisual2D._tempJockeyWhip;
            this.jockeyG.lineWidth = 1.4;
            this.jockeyG.moveTo(18, 6);
            const whipEndX = 18 - 14 * Math.cos((whipAngle * Math.PI) / 180);
            const whipEndY = 6 + 14 * Math.sin((whipAngle * Math.PI) / 180);
            this.jockeyG.lineTo(whipEndX, whipEndY);
            this.jockeyG.stroke();

            // 鞭梢极速破空音爆气浪微圆环与金光火花 (Whip Air Snap Shockwave)
            if (whipAngle < -18) {
                this.jockeyG.strokeColor = HorseVisual2D._tempJockeySnapRing;
                this.jockeyG.lineWidth = 1.4;
                this.jockeyG.circle(whipEndX, whipEndY, 3.8);
                this.jockeyG.stroke();
                this.jockeyG.fillColor = HorseVisual2D._tempJockeySnapCore;
                this.jockeyG.circle(whipEndX, whipEndY, 1.6);
                this.jockeyG.fill();
            }
        }
    }

    /** 载入当前马匹的高精透明 2D 跑道精灵与独有 8 帧标准奔跑序列图集 */
    private loadRunningSprite() {
        if (!this.spriteNode || !this.spriteNode.isValid) return;

        if (this.isFoal) {
            this.setFoalStage(this.horseNo, this.foalStage);
            return;
        }

        // 载入真实油画名驹透明跑道精灵 (Hxx_Sprite.png: 317x256 高清油画级写实精灵)
        HorseSprites.applyHorseRunningSprite(this.spriteNode, this.horseNo, (sf: SpriteFrame) => {
            if (!this.isValid || !this.spriteNode || !this.spriteNode.isValid) return;
            this.isSpriteLoaded = true;
            this.staticSpriteFrame = sf;
            const sp = this.spriteNode.getComponent(Sprite) || this.spriteNode.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            sp.spriteFrame = sf;
            const ut = this.spriteNode.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(102, 76);
            }
            if (this.horseG) {
                this.horseG.clear();
            }
        });

        // 载入当前马匹 8 帧标准奔跑序列图集 (1024x128) 与骑师专属彩衣图集 (1024x128)
        HorseSprites.loadHorseGallopAnimation(this.horseNo, (hFrames, jFrames) => {
            if (!this.isValid) return;
            if (hFrames && hFrames.length > 0) {
                this.gallopHorseFrames = hFrames;
                this.gallopJockeyFrames = jFrames;
                this.isGallopAnimationLoaded = true;
            }
        });

        // 激活专业鞍布与高精职业骑师
        if (this.saddleNode) {
            this.saddleNode.active = true;
        }
        if (this.jockeyNode) {
            this.jockeyNode.active = !this.isPaddockMode && !this.isFoal;
        }
        this.renderAeroJockey(false);
    }

    /** 绘制地面动态椭圆投影阴影 */
    private renderShadow(scaleX: number = 1.0, alpha: number = 95) {
        if (!this.shadowG) return;
        this.shadowG.clear();
        this.shadowG.fillColor = new Color(20, 10, 5, Math.max(15, Math.min(130, alpha)));
        const sW = Math.max(12, 28 * scaleX * this.viewScale);
        const sH = Math.max(3.5, 7 * this.viewScale);
        this.shadowG.ellipse(2, 0, sW, sH);
        this.shadowG.fill();

        // 闸位待机刨地动作 (Paw) 时，在前蹄处激荡真实泥沙微尘
        if (this.currentAction === "Paw") {
            const pawPhase = (this.animTime * 9.0) % (Math.PI * 2);
            if (pawPhase > 0.8 && pawPhase < 3.2) {
                const pawDustAlpha = Math.floor(65 * Math.sin(pawPhase - 0.8));
                this.shadowG.fillColor = new Color(165, 125, 80, pawDustAlpha);
                this.shadowG.circle(18 * this.viewScale, 2, 4.5 * this.viewScale);
                this.shadowG.circle(23 * this.viewScale, 4, 3.2 * this.viewScale);
                this.shadowG.fill();
            }
        }
    }

    /** 绘制马背上的专业竞技鞍布与马号数字 */
    private renderSaddleCloth() {
        if (!this.saddleG) return;
        this.saddleG.clear();

        const silkCol = this.getJockeySilkColor();

        // 1. 鞍布主体底色 (Contoured Racing Saddle Cloth)
        this.saddleG.fillColor = silkCol;
        this.saddleG.roundRect(-12, -7, 24, 15, 3);
        this.saddleG.fill();

        // 2. 烫金双层镶边 (Gold Cord Piping)
        this.saddleG.strokeColor = new Color(245, 205, 75, 240);
        this.saddleG.lineWidth = 1.4;
        this.saddleG.roundRect(-12, -7, 24, 15, 3);
        this.saddleG.stroke();

        // 3. 鞍布中央白色圆圈与清晰马号数字 (White Roundel Badge)
        this.saddleG.fillColor = Color.WHITE;
        this.saddleG.circle(0, 0, 5.2);
        this.saddleG.fill();

        this.saddleG.fillColor = WestColors.INK_DARK;
        this.saddleG.circle(0, 0, 2.0);
        this.saddleG.fill();

        // 4. 真皮肚带 (Leather Girth Strap)
        this.saddleG.fillColor = new Color(52, 34, 20, 240);
        this.saddleG.rect(-2, -14, 4, 8);
        this.saddleG.fill();
    }

    /** 更新头顶悬浮状态气泡（仅在牧场大舞台展示） */
    private updateBubble() {
        if (!this.bubbleNode || !this.bubbleNode.isValid) return;
        this.bubbleNode.active = this.isPaddockMode;
        if (!this.isPaddockMode || !this.bubbleG || !this.bubbleLabel) return;
        this.bubbleG.clear();

        const text = `${this.currentActionIcon} ${this.currentActionNameZh}`;
        this.bubbleLabel.string = text;

        const textLen = text.length;
        const bubbleW = Math.max(80, textLen * 11 + 18);
        const bubbleH = 22;

        // 羊皮纸胶囊小气泡底
        this.bubbleG.fillColor = new Color(250, 246, 235, 230);
        this.bubbleG.roundRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 11);
        this.bubbleG.fill();

        this.bubbleG.strokeColor = WestColors.BRASS_FRAME;
        this.bubbleG.lineWidth = 1.2;
        this.bubbleG.roundRect(-bubbleW / 2, -bubbleH / 2, bubbleW, bubbleH, 11);
        this.bubbleG.stroke();

        // 小下三角指示针
        this.bubbleG.fillColor = new Color(250, 246, 235, 230);
        this.bubbleG.moveTo(-3, -bubbleH / 2);
        this.bubbleG.lineTo(0, -bubbleH / 2 - 4);
        this.bubbleG.lineTo(3, -bubbleH / 2);
        this.bubbleG.close();
        this.bubbleG.fill();
    }

    /** 备用写实纯血马剪影 */
    private renderRealisticHorseSilhouette() {
        if (this.isSpriteLoaded || (this.rigNode && this.rigNode.active)) {
            if (this.horseG) this.horseG.clear();
            return;
        }
        const g = this.horseG;
        if (!g) return;
        g.clear();

        const coat = this.getCoatBaseColor();
        g.fillColor = coat;
        g.circle(-10, -1, 12);
        g.fill();
        g.ellipse(2, 0, 15, 10);
        g.fill();
        g.circle(12, 2, 10);
        g.fill();

        g.moveTo(14, 5);
        g.lineTo(22, 17);
        g.lineTo(17, 19);
        g.lineTo(8, 8);
        g.close();
        g.fill();

        g.ellipse(23, 18, 6.5, 4.5);
        g.fill();

        g.fillColor = this.getManeColor();
        g.moveTo(-18, 4);
        g.bezierCurveTo(-26, 0, -30, -11, -24, -18);
        g.bezierCurveTo(-21, -14, -19, -7, -15, -1);
        g.close();
        g.fill();
    }

    /** 切换动作状态与二次创作 2D 骨骼形态 */
    public setAction(actionId: string, speedFactor: number = 1.0, customNameZh?: string) {
        const def = HorseVisual2D.ACTIONS_CATALOG[actionId] || HorseVisual2D.ACTIONS_CATALOG.Stand;
        const targetSpeedFactor = Math.max(0.2, Math.min(3.5, Number(speedFactor) || 1.0));
        if (this.currentAction === def.id && (!customNameZh || this.currentActionNameZh === customNameZh) && Math.abs(this.speedFactor - targetSpeedFactor) < 0.001) {
            return;
        }
        this.currentAction = def.id;
        this.currentActionNameZh = customNameZh || def.nameZh;
        this.currentActionIcon = def.icon;
        this.isActionLoop = def.isLoop;
        this.actionDuration = def.duration;
        this.actionTimer = 0;
        this.speedFactor = targetSpeedFactor;
        this.updateBubble();
    }

    /** 获取当前正在执行的动作标识 */
    public getCurrentAction(): string {
        return this.currentAction;
    }

    /** 依毛色名称解析基准色彩 */
    private getCoatBaseColor(): Color {
        switch (this.horseNo) {
            case 1: return new Color(152, 54, 32, 255);
            case 2: return new Color(188, 196, 202, 255);
            case 3: return new Color(212, 172, 74, 255);
            case 4: return new Color(38, 38, 42, 255);
            case 5: return new Color(238, 240, 245, 255);
            case 6: return new Color(92, 114, 138, 255);
            case 7: return new Color(125, 48, 85, 255);
            case 8: return new Color(118, 75, 48, 255);
            case 9: return new Color(74, 52, 42, 255);
            case 10: return new Color(168, 42, 36, 255);
            case 11: return new Color(175, 160, 115, 255);
            case 12: return new Color(85, 60, 48, 255);
            case 13: return new Color(195, 115, 45, 255);
            case 14: return new Color(158, 74, 40, 255);
            case 15: return new Color(215, 218, 225, 255);
            case 16: return new Color(34, 34, 40, 255);
            case 17: return new Color(120, 130, 140, 255);
            case 18: return new Color(110, 67, 35, 255);
            case 19: return new Color(200, 122, 40, 255);
            case 20: default: return new Color(20, 24, 36, 255);
        }
    }

    private getManeColor(): Color {
        const coat = this.getCoatBaseColor();
        if (coat.r > 200 && coat.g > 200 && coat.b > 200) {
            return new Color(210, 215, 220, 255);
        }
        return new Color(Math.max(15, coat.r - 50), Math.max(15, coat.g - 50), Math.max(15, coat.b - 50), 255);
    }

    private getJockeySilkColor(): Color {
        switch (this.horseNo) {
            case 1: return new Color(185, 38, 26, 255);
            case 2: return new Color(38, 125, 68, 255);
            case 3: return new Color(215, 168, 35, 255);
            case 4: return new Color(35, 35, 45, 255);
            case 5: return new Color(75, 135, 215, 255);
            case 6: return new Color(145, 75, 175, 255);
            case 7: return new Color(225, 95, 40, 255);
            case 8: return new Color(110, 75, 50, 255);
            case 9: return new Color(35, 170, 160, 255);
            case 10: return new Color(205, 55, 105, 255);
            case 11: return new Color(85, 155, 65, 255);
            case 12: return new Color(105, 120, 140, 255);
            case 13: return new Color(230, 130, 30, 255);
            case 14: return new Color(140, 60, 25, 255);
            case 15: return new Color(190, 200, 215, 255);
            case 16: return new Color(45, 45, 55, 255);
            case 17: return new Color(90, 110, 130, 255);
            case 18: return new Color(150, 80, 40, 255);
            case 19: return new Color(220, 160, 20, 255);
            case 20: default: return new Color(30, 35, 65, 255);
        }
    }

    /** 核心逐帧动力学计算：对 40+ 种动作进行 2D 二次创作物理位移与骨骼变形仿真 */
    update(dt: number) {
        if (!this.horseBodyNode || !this.horseBodyNode.isValid) return;

        const effectiveDt = dt * this.speedFactor;
        this.animTime += effectiveDt;
        this.actionTimer += effectiveDt;

        // 牧场/马房待机自动行为循环演化 (Auto Paddock Idle Cycle)
        if (this.isPaddockMode && this.isActionLoop && this.currentAction === "Stand") {
            this.idleCycleTimer += dt;
            if (this.idleCycleTimer >= this.nextIdleCycleInterval) {
                this.idleCycleTimer = 0;
                this.nextIdleCycleInterval = 5.0 + Math.random() * 4.0;
                const naturalPool = ["Graze", "Tail_Swish", "Stretch", "Ears_Forward", "Paw", "Neigh", "Drink", "Snort"];
                const pick = naturalPool[Math.floor(Math.random() * naturalPool.length)];
                this.setAction(pick, 1.0);
            }
        }

        // 赛道闸位待机自动小动作循环 (Race Gate Idle Cycle: 打响鼻/刨地/甩头/甩尾/机警立姿)
        if (!this.isPaddockMode && this.isActionLoop && this.currentAction === "Stand") {
            this.idleCycleTimer += dt;
            if (this.idleCycleTimer >= this.nextIdleCycleInterval) {
                this.idleCycleTimer = 0;
                this.nextIdleCycleInterval = 3.2 + (this.horseNo % 3) * 0.8 + Math.random() * 2.5;
                const gatePool = ["Paw", "Tail_Swish", "Snort_Alert", "Head_Toss", "Ears_Forward"];
                const pick = gatePool[Math.floor(Math.random() * gatePool.length)];
                this.setAction(pick, 1.0);
            }
        }

        // 非循环动作到期后平滑回归待机 (Stand)
        if (!this.isActionLoop && this.actionTimer >= this.actionDuration) {
            this.setAction("Stand", 1.0);
        }

        // 计算当前动作的 2D 动力学位姿
        const pose = this.computeActionPose(this.currentAction, this.animTime);

        // 冲刺与并驾齐驱状态判断
        const isSprinting = this.currentAction === "Sprint" || this.currentAction === "Head_To_Head";
        const isGalloping = isSprinting || this.currentAction === "Gallop" || this.currentAction === "Accelerate" || this.currentAction === "Start" || this.currentAction === "Finish";

        // 判断是否使用生动解剖铰接骨骼系统 (Articulated Procedural Rig)
        // 规则：
        // 1. 在牧场/马房/大舞台模式 (isPaddockMode) 或幼驹模式 (isFoal) 下，除 Gallop 动作可选用 8 帧图集外，所有其它动作 (Stand, Walk, Trot, Canter, Graze, Rear, Buck, Stretch, Paw, Neigh, Foal actions 等) 100% 启用生动解剖铰接骨骼系统！
        // 2. 在普通赛道闸位待机 (Stand, Paw, Snort_Alert) 时，亦启用解剖骨骼生动微动作！
        const shouldUseRig = (this.isPaddockMode && (this.currentAction !== "Gallop" || this.gallopHorseFrames.length === 0)) ||
                             (this.isFoal && (this.currentAction !== "Gallop" || this.gallopHorseFrames.length === 0)) ||
                             (!this.isPaddockMode && (this.currentAction === "Stand" || this.currentAction === "Paw" || this.currentAction === "Snort_Alert"));

        if (shouldUseRig) {
            if (this.spriteNode && this.spriteNode.isValid) {
                this.spriteNode.active = false;
            }
            if (this.horseG) {
                this.horseG.clear();
            }
            if (this.rigNode && this.rigNode.isValid) {
                this.rigNode.active = true;
                this.updateRigPose(effectiveDt);
                this.renderArticulatedRig(this.currentRigPose);
            }
            if (this.jockeyNode && this.jockeyNode.isValid) {
                this.jockeyNode.active = false;
            }
            if (this.saddleNode && this.saddleNode.isValid) {
                this.saddleNode.active = false;
            }
        } else if (isGalloping && this.gallopHorseFrames.length > 0) {
            if (this.rigNode && this.rigNode.isValid) {
                this.rigNode.active = false;
            }
            if (this.horseG) {
                this.horseG.clear();
            }
            if (this.spriteNode && this.spriteNode.isValid) {
                this.spriteNode.active = true;
            }
            if (this.saddleNode && this.saddleNode.isValid) {
                this.saddleNode.active = true;
            }

            // 根据奔跑状态与速度因子动态换算步频 (12 ~ 24 FPS)
            const baseFps = isSprinting ? 22 : (this.currentAction === "Accelerate" ? 18 : (this.currentAction === "Finish" ? 17 : 15));
            const targetFps = Math.max(8, baseFps * this.speedFactor);
            const frameInterval = 1.0 / targetFps;

            this.frameTimer += effectiveDt;
            if (this.frameTimer >= frameInterval) {
                const step = Math.floor(this.frameTimer / frameInterval);
                this.frameTimer %= frameInterval;
                this.currentFrameIndex = (this.currentFrameIndex + step) % this.gallopHorseFrames.length;
            }

            if (this.spriteNode && this.spriteNode.isValid) {
                const sp = this.spriteNode.getComponent(Sprite);
                if (sp) {
                    const frame = this.gallopHorseFrames[this.currentFrameIndex];
                    if (frame && frame.isValid && frame.texture) {
                        sp.spriteFrame = frame;
                    }
                }
            }

            // 同步驱动职业写实骑师 8 帧彩衣序列
            if (this.jockeyNode && this.jockeyNode.isValid) {
                this.jockeyNode.active = !this.isPaddockMode && !this.isFoal;
                if (this.jockeySprite && this.gallopJockeyFrames.length > 0) {
                    const jFrame = this.gallopJockeyFrames[this.currentFrameIndex];
                    if (jFrame && jFrame.isValid && jFrame.texture) {
                        this.jockeySprite.spriteFrame = jFrame;
                        this.jockeyNode.setPosition(0, 8, 0);
                        const jUt = this.jockeyNode.getComponent(UITransform);
                        if (jUt) jUt.setContentSize(102, 76);
                        if (this.jockeyG) this.jockeyG.clear();
                    }
                } else {
                    // 无骑师贴图时降级使用矢量写实骑师俯身推骑
                    this.jockeyNode.setPosition(isSprinting ? 4 : 2, 14.5, 0);
                    this.renderAeroJockey(isSprinting, this.animTime * 22);
                }
            }
        } else {
            // 待机、慢步、快步或日常非奔跑动作（备用回退分支）：
            if (this.spriteNode && this.spriteNode.isValid) {
                this.spriteNode.active = true;
                const sp = this.spriteNode.getComponent(Sprite);
                if (sp) {
                    if (this.gallopHorseFrames && this.gallopHorseFrames.length > 0 && !this.isFoal) {
                        const standFrame = this.gallopHorseFrames[0];
                        if (standFrame && standFrame.isValid && standFrame.texture) {
                            sp.spriteFrame = standFrame;
                        }
                    } else if (this.staticSpriteFrame && this.staticSpriteFrame.isValid && this.staticSpriteFrame.texture) {
                        sp.spriteFrame = this.staticSpriteFrame;
                    }
                }
            }
            if (this.horseG) {
                this.horseG.clear();
            }
            if (this.rigNode && this.rigNode.isValid) {
                this.rigNode.active = false;
            }
            if (this.jockeyNode && this.jockeyNode.isValid) {
                this.jockeyNode.active = !this.isPaddockMode && !this.isFoal;
                if (this.jockeySprite && this.gallopJockeyFrames && this.gallopJockeyFrames.length > 0) {
                    const jStand = this.gallopJockeyFrames[0];
                    if (jStand && jStand.isValid && jStand.texture) {
                        this.jockeySprite.spriteFrame = jStand;
                        this.jockeyNode.setPosition(0, 8, 0);
                        const jUt = this.jockeyNode.getComponent(UITransform);
                        if (jUt) jUt.setContentSize(102, 76);
                        if (this.jockeyG) this.jockeyG.clear();
                    }
                } else if (!this.isPaddockMode && !this.isFoal) {
                    this.jockeyNode.setPosition(0, 16, 0);
                    this.jockeyNode.setRotationFromEuler(0, 0, 0);
                    const jUt = this.jockeyNode.getComponent(UITransform);
                    if (jUt) jUt.setContentSize(52, 42);
                    this.renderAeroJockey(false, 0);
                }
            }
        }

        // 二次物理马尾单摆 (Secondary Tail Harmonic Motion)
        if (this.tailNode && this.tailNode.isValid) {
            let targetTailAngle = 0;
            if (isSprinting) {
                targetTailAngle = -32 + Math.sin(this.animTime * 24) * 15;
            } else if (isGalloping) {
                targetTailAngle = -18 + Math.sin(this.animTime * 16) * 16;
            } else if (this.currentAction === "Walk" || this.currentAction === "Trot") {
                targetTailAngle = -6 + Math.sin(this.animTime * 7) * 9;
            } else {
                targetTailAngle = Math.sin(this.animTime * 2.5) * 5;
            }
            this.tailAngle += (targetTailAngle - this.tailAngle) * (1 - Math.exp(-14 * effectiveDt));
            this.tailNode.setRotationFromEuler(0, 0, this.tailAngle);
        }

        // 探颈绝杀与微俯仰：在冲刺或冲线瞬间，马头与身体前倾向前推进伸展 (Neck Reach / Photo Finish Lunge)
        let thrustX = 0;
        let thrustY = 0;
        if (this.currentAction === "Finish") {
            // 终点毫厘决胜：极限向前探颈 8.5px
            thrustX = 8.5 + Math.sin(this.animTime * 20) * 2.8;
            thrustY = -1.8;
        } else if (isSprinting) {
            thrustX = 4.8 + Math.sin(this.animTime * 18) * 2.2;
            thrustY = -Math.abs(Math.sin(this.animTime * 18)) * 1.2;
        }
        if (this.spriteNode && this.spriteNode.isValid) {
            this.spriteNode.setPosition(thrustX, 4 + thrustY, 0);
        }
        if (this.jockeyNode && this.jockeyNode.isValid) {
            this.jockeyNode.setPosition(this.jockeyNode.position.x + thrustX * 0.4, this.jockeyNode.position.y + thrustY * 0.4, 0);
        }

        // 应用位移、旋转与拉伸挤压 (结合 viewScale 缩放内部身体容器)
        this.horseBodyNode.setPosition(pose.posX * this.viewScale, pose.posY * this.viewScale, 0);
        this.horseBodyNode.setRotationFromEuler(0, 0, pose.rotDeg);
        this.horseBodyNode.setScale(pose.scaleX * this.viewScale, pose.scaleY * this.viewScale, 1);

        // 地面投影动态联动
        this.renderShadow(pose.shadowScale, pose.shadowAlpha);

        // 冲刺/加速风阻线条动态特效
        this.renderSpeedLines();

        // 冲刺与并驾齐驱瞬时残影拖尾 (Ghost Afterimages)
        this.updateSprintGhosts(effectiveDt, isSprinting, pose);

        // 剧烈奔跑鼻腔喷白气 (High-Exertion Breath Puff)
        this.updateBreathEffect(effectiveDt, isSprinting);

        // 鬃毛逆风激荡飘扬流光渲染
        this.renderManeFlutter(effectiveDt, isGalloping, isSprinting);

        // 并驾齐驱激烈死斗电光火花特效 (Head-to-Head Duel Clash Sparks)
        this.updateDuelSparks(effectiveDt);

        // 头顶气泡随马头姿态轻微上下悬浮（仅牧场模式）
        if (this.isPaddockMode && this.bubbleNode && this.bubbleNode.isValid) {
            const bubbleY = (38 + pose.posY * 0.4 + Math.sin(this.animTime * 2.5) * 1.5) * this.viewScale;
            this.bubbleNode.setPosition((pose.posX * 0.3) * this.viewScale, bubbleY, 0);
        }
    }

    private static readonly _reusableSpeedColor = new Color(255, 235, 180, 255);

    /** 绘制冲刺与加速时的 2D 破空疾风光线粒子 */
    private renderSpeedLines() {
        if (!this.speedLinesG) return;
        this.speedLinesG.clear();
        if (this.currentAction !== "Sprint" && this.currentAction !== "Accelerate" && this.currentAction !== "Head_To_Head") {
            return;
        }

        const isSprint = this.currentAction === "Sprint" || this.currentAction === "Head_To_Head";
        const count = isSprint ? 7 : 4;
        const alpha = isSprint ? 200 : 120;
        const seed = Math.sin(this.animTime * 28);

        for (let i = 0; i < count; i++) {
            const lineY = -12 + i * 5.4 + Math.sin(this.animTime * 18 + i * 2) * 2;
            const startX = -44 - (i % 2) * 12 - Math.abs(seed) * 8;
            const len = (isSprint ? 48 : 26) + Math.abs(Math.sin(this.animTime * 14 + i * 3)) * 24;

            const isGold = isSprint && i % 2 === 0;
            HorseVisual2D._reusableSpeedColor.set(
                isGold ? 255 : 235,
                isGold ? 215 : 235,
                isGold ? 80 : 180,
                Math.floor(alpha * (0.6 + 0.4 * Math.random()))
            );
            this.speedLinesG.strokeColor = HorseVisual2D._reusableSpeedColor;
            this.speedLinesG.lineWidth = isSprint ? (isGold ? 2.4 : 1.6) : 1.2;
            this.speedLinesG.moveTo(startX, lineY);
            this.speedLinesG.lineTo(startX - len, lineY + (Math.random() - 0.5) * 1.8);
            this.speedLinesG.stroke();
        }
    }

    private static readonly _tempBreathColor = new Color(255, 255, 255, 255);
    private static readonly _ghostGoldColor = new Color(255, 215, 60, 115);
    private static readonly _ghostCrimsonColor = new Color(240, 75, 45, 65);
    private static readonly _ghostConfigs = [
        { histIdx: 2, offsetPx: -14, color: HorseVisual2D._ghostGoldColor },
        { histIdx: 5, offsetPx: -26, color: HorseVisual2D._ghostCrimsonColor },
    ];
    private static readonly _tempManeDark = new Color(0, 0, 0, 200);
    private static readonly _tempManeLight = new Color(0, 0, 0, 180);
    private static readonly _tempTailDeep = new Color(0, 0, 0, 245);
    private static readonly _tempTailHigh = new Color(0, 0, 0, 120);
    private static readonly _tempJockeySash = new Color(255, 245, 210, 230);
    private static readonly _tempJockeyReins = new Color(62, 38, 22, 220);
    private static readonly _tempJockeyVisor = new Color(20, 20, 25, 240);
    private static readonly _tempJockeyGoggles = new Color(255, 220, 80, 240);
    private static readonly _tempJockeyGogglesRim = new Color(30, 30, 30, 200);
    private static readonly _tempJockeyWhip = new Color(35, 25, 20, 240);
    private static readonly _tempJockeySnapRing = new Color(255, 235, 140, 220);
    private static readonly _tempJockeySnapCore = new Color(255, 250, 200, 230);

    /** 绘制极速奔跑时马匹鼻腔呼出的白汽微团 */
    private updateBreathEffect(dt: number, isSprinting: boolean) {
        if (!this.breathG || !this.breathG.isValid) return;
        this.breathG.clear();

        const isRacingHeavy = isSprinting || this.currentAction === "Finish" || this.currentAction === "Accelerate";

        if (!isRacingHeavy) {
            if (this.breathPuffs.length === 0) return;
        } else {
            this.breathTimer += dt;
            if (this.breathTimer >= 0.28) {
                this.breathTimer = 0;
                // 从鼻孔喷出 2 颗细微白气球
                for (let b = 0; b < 2; b++) {
                    const puff = this.breathPool.pop() || {
                        x: 0,
                        y: 0,
                        vx: 0,
                        vy: 0,
                        r: 0,
                        alpha: 0,
                        life: 0,
                        maxLife: 1,
                    };
                    puff.x = (Math.random() - 0.5) * 2;
                    puff.y = (Math.random() - 0.5) * 2;
                    puff.vx = -42 - Math.random() * 24; // 迎风向后吹散
                    puff.vy = 5 + Math.random() * 8;   // 向上轻飘
                    puff.r = 1.6 + Math.random() * 1.6;
                    puff.alpha = 145;
                    puff.life = 0;
                    puff.maxLife = 0.34 + Math.random() * 0.12;
                    this.breathPuffs.push(puff);
                }
            }
        }

        for (let i = this.breathPuffs.length - 1; i >= 0; i--) {
            const p = this.breathPuffs[i];
            p.life += dt;
            if (p.life >= p.maxLife) {
                this.breathPuffs.splice(i, 1);
                if (this.breathPool.length < 32) this.breathPool.push(p);
                continue;
            }
            p.x += p.vx * dt;
            p.y += p.vy * dt;
            p.r += dt * 3.5; // 白汽膨胀扩散
            const progress = p.life / p.maxLife;
            const a = Math.floor(p.alpha * (1 - progress));
            HorseVisual2D._tempBreathColor.set(245, 248, 255, a);
            this.breathG.fillColor = HorseVisual2D._tempBreathColor;
            this.breathG.circle(p.x, p.y, p.r);
            this.breathG.fill();
        }
    }

    /** 绘制极速奔跑时马匹颈背鬃毛逆风飞舞的拟真二次谐波物理流光 (Wind-Whipped Mane Flutter) */
    private renderManeFlutter(effectiveDt: number, isGalloping: boolean, isSprinting: boolean): void {
        if (!this.maneG || !this.maneG.isValid) return;
        this.maneG.clear();
        if (!isGalloping && !isSprinting && this.currentAction !== "Trot") return;

        const coat = this.getManeColor();
        const speedMultiplier = isSprinting ? 28 : (isGalloping ? 18 : 10);
        const waveAmp = isSprinting ? 4.5 : (isGalloping ? 3.0 : 1.5);
        const strandCount = 5;

        for (let i = 0; i < strandCount; i++) {
            const rootX = -i * 3.8;
            const rootY = -i * 2.2;
            const phase = this.animTime * speedMultiplier + i * 1.2;
            const wave = Math.sin(phase) * waveAmp;
            const tipX = rootX - (10 + i * 2.5) + wave * 0.4;
            const tipY = rootY + (6 - i * 1.2) + wave;

            // 深色底缕发丝
            HorseVisual2D._tempManeDark.set(
                Math.max(10, coat.r - 30),
                Math.max(10, coat.g - 30),
                Math.max(10, coat.b - 30),
                200
            );
            this.maneG.strokeColor = HorseVisual2D._tempManeDark;
            this.maneG.lineWidth = 2.2;
            this.maneG.moveTo(rootX, rootY);
            this.maneG.quadraticCurveTo(rootX - 5, rootY + 5 + wave * 0.5, tipX, tipY);
            this.maneG.stroke();

            // 亮色受光发丝高光
            HorseVisual2D._tempManeLight.set(
                Math.min(255, coat.r + 35),
                Math.min(255, coat.g + 35),
                Math.min(255, coat.b + 35),
                180
            );
            this.maneG.strokeColor = HorseVisual2D._tempManeLight;
            this.maneG.lineWidth = 1.1;
            this.maneG.moveTo(rootX, rootY + 0.8);
            this.maneG.quadraticCurveTo(rootX - 4, rootY + 6 + wave * 0.5, tipX - 1, tipY + 1);
            this.maneG.stroke();
        }
    }

    /** 绘制物理飘逸马尾 (Procedural Multi-Strand Tail) */
    private drawProceduralTail(): void {
        if (!this.tailG) return;
        this.tailG.clear();
        const coat = this.getManeColor();

        // 1. 马尾深色底羽 (Deep Tail Mass)
        HorseVisual2D._tempTailDeep.set(
            Math.max(10, coat.r - 25),
            Math.max(10, coat.g - 25),
            Math.max(10, coat.b - 25),
            245
        );
        this.tailG.fillColor = HorseVisual2D._tempTailDeep;
        this.tailG.moveTo(0, 0);
        this.tailG.bezierCurveTo(-12, 4, -24, -4, -32, -18);
        this.tailG.bezierCurveTo(-22, -16, -10, -8, 0, -5);
        this.tailG.close();
        this.tailG.fill();

        // 2. 马尾主发丝弧线束 (Main Flowing Tresses)
        this.tailG.fillColor = coat;
        this.tailG.moveTo(-1, 1);
        this.tailG.bezierCurveTo(-14, 7, -26, -2, -36, -14);
        this.tailG.bezierCurveTo(-26, -12, -12, -5, -1, -3);
        this.tailG.close();
        this.tailG.fill();

        // 3. 尾梢飘拂毛尖轻描高光 (Silky Hair Tip Highlights)
        HorseVisual2D._tempTailHigh.set(
            Math.min(255, coat.r + 45),
            Math.min(255, coat.g + 45),
            Math.min(255, coat.b + 40),
            120
        );
        this.tailG.strokeColor = HorseVisual2D._tempTailHigh;
        this.tailG.lineWidth = 1.2;
        this.tailG.moveTo(-2, 2);
        this.tailG.bezierCurveTo(-15, 8, -28, 0, -38, -12);
        this.tailG.stroke();

        this.tailG.lineWidth = 0.8;
        this.tailG.moveTo(-3, -2);
        this.tailG.bezierCurveTo(-14, 2, -22, -8, -30, -20);
        this.tailG.stroke();
    }

    /** 驱动冲刺金红双色残影拖尾 (Ghost Afterimages) */
    private updateSprintGhosts(
        dt: number,
        isSprinting: boolean,
        pose: { posX: number; posY: number; rotDeg: number; scaleX: number; scaleY: number }
    ): void {
        if (this.ghostNodes.length === 0) return;

        if (!isSprinting || this.isPaddockMode) {
            for (const g of this.ghostNodes) {
                if (g && g.isValid) g.active = false;
            }
            this.ghostHistory.length = 0;
            return;
        }

        // 记录历史轨迹 (保留最近 8 帧)
        const curFrame = this.spriteNode?.getComponent(Sprite)?.spriteFrame || null;
        this.ghostHistory.unshift({
            x: pose.posX * this.viewScale,
            y: pose.posY * this.viewScale,
            rot: pose.rotDeg,
            sf: curFrame,
        });
        if (this.ghostHistory.length > 8) {
            this.ghostHistory.pop();
        }

        // 2 个残影分别取第 2 帧与第 5 帧历史位姿 (基于静态常量零 GC)
        const ghostConfigs = HorseVisual2D._ghostConfigs;

        for (let i = 0; i < this.ghostNodes.length; i++) {
            const gNode = this.ghostNodes[i];
            const sp = this.ghostSprites[i];
            const cfg = ghostConfigs[i];
            if (!gNode || !gNode.isValid || !sp) continue;

            const hist = this.ghostHistory[cfg.histIdx] || this.ghostHistory[this.ghostHistory.length - 1];
            if (hist && hist.sf) {
                gNode.active = true;
                sp.spriteFrame = hist.sf;
                sp.color = cfg.color;
                gNode.setPosition(hist.x + cfg.offsetPx * this.viewScale, hist.y, 0);
                gNode.setRotationFromEuler(0, 0, hist.rot);
                gNode.setScale(this.viewScale * 0.95, this.viewScale * 0.95, 1);
            } else {
                gNode.active = false;
            }
        }
    }

    /** 更新并驾齐驱激烈死斗摩擦电光火花 */
    private updateDuelSparks(dt: number): void {
        if (!this.duelG || !this.duelG.isValid) return;
        this.duelG.clear();

        if (!this.isDueling) {
            if (this.duelSparks.length === 0) return;
        } else {
            // 每秒爆发 12~16 颗激烈摩擦火花
            const spawnCount = Math.floor(Math.random() * 3);
            for (let s = 0; s < spawnCount; s++) {
                const spark = this.duelSparkPool.pop() || {
                    x: 0,
                    y: 0,
                    vx: 0,
                    vy: 0,
                    r: 0,
                    alpha: 255,
                    life: 0,
                    maxLife: 1,
                    color: new Color(255, 200, 50, 255),
                };
                spark.x = -8 + Math.random() * 24;
                spark.y = -6 + Math.random() * 20;
                spark.vx = -80 + Math.random() * 160;
                spark.vy = 20 + Math.random() * 120;
                spark.r = 1.2 + Math.random() * 2.0;
                spark.life = 0;
                spark.maxLife = 0.18 + Math.random() * 0.16;
                const isWhite = Math.random() > 0.6;
                spark.color.set(isWhite ? 255 : 255, isWhite ? 255 : 185, isWhite ? 240 : 45, 255);
                this.duelSparks.push(spark);
            }
        }

        for (let i = this.duelSparks.length - 1; i >= 0; i--) {
            const sp = this.duelSparks[i];
            sp.life += dt;
            if (sp.life >= sp.maxLife) {
                this.duelSparks.splice(i, 1);
                if (this.duelSparkPool.length < 32) this.duelSparkPool.push(sp);
                continue;
            }
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.vy -= 260 * dt; // 重力微下落
            const fade = 1 - (sp.life / sp.maxLife);
            sp.color.a = Math.floor(255 * fade);
            this.duelG.fillColor = sp.color;
            this.duelG.circle(sp.x, sp.y, sp.r * fade);
            this.duelG.fill();

            // 极速细电光闪烁划痕 (Electric Tension Line)
            if (fade > 0.4 && Math.random() > 0.5) {
                this.duelG.strokeColor = sp.color;
                this.duelG.lineWidth = 1.0;
                this.duelG.moveTo(sp.x, sp.y);
                this.duelG.lineTo(sp.x - sp.vx * 0.04, sp.y - sp.vy * 0.04);
                this.duelG.stroke();
            }
        }
    }

    /** 计算铰接骨骼的目标姿态 (Articulated Rig Kinematic Target Pose) */
    private computeTargetRigPose(action: string, t: number): ArticulatedRigPose {
        const pose: ArticulatedRigPose = {
            bodyY: 0,
            bodyRot: 0,
            neckRot: 0,
            headRot: 0,
            jawOpen: 0,
            earAngle: 0,
            foreNearShoulder: 0,
            foreNearKnee: 0,
            foreFarShoulder: 0,
            foreFarKnee: 0,
            hindNearHip: 0,
            hindNearHock: 0,
            hindFarHip: 0,
            hindFarHock: 0,
        };

        const speed = this.speedFactor;

        switch (action) {
            case "Stand": {
                // 平稳呼吸与静止待机，偶尔转耳
                const breath = Math.sin(t * 1.8) * 0.8;
                pose.bodyY = breath;
                pose.neckRot = Math.sin(t * 1.2) * 1.5;
                pose.earAngle = Math.sin(t * 2.5) * 6;
                pose.hindNearHip = 3;
                pose.hindNearHock = 4;
                break;
            }
            case "Walk": {
                // 4 拍写实慢步 (四蹄依次离地推进，无滑行)
                const wPhase = t * 5.2 * speed;
                pose.bodyY = Math.abs(Math.sin(wPhase * 2)) * 1.5;
                pose.bodyRot = Math.sin(wPhase) * 1.6;
                pose.neckRot = Math.sin(wPhase * 2) * 2.5;
                pose.earAngle = Math.sin(wPhase * 2) * 4;

                const fn = Math.sin(wPhase);
                pose.foreNearShoulder = fn * 24;
                pose.foreNearKnee = fn < 0 ? Math.abs(fn) * 36 : 4;

                const ff = Math.sin(wPhase + Math.PI);
                pose.foreFarShoulder = ff * 24;
                pose.foreFarKnee = ff < 0 ? Math.abs(ff) * 36 : 4;

                const hn = Math.sin(wPhase - Math.PI * 0.5);
                pose.hindNearHip = hn * 20;
                pose.hindNearHock = hn > 0 ? hn * 30 : 5;

                const hf = Math.sin(wPhase + Math.PI * 0.5);
                pose.hindFarHip = hf * 20;
                pose.hindFarHock = hf > 0 ? hf * 30 : 5;
                break;
            }
            case "Trot": {
                // 2 拍对角快步 (腾空期与对角同步)
                const tPhase = t * 8.5 * speed;
                pose.bodyY = Math.abs(Math.sin(tPhase)) * 3.6;
                pose.bodyRot = Math.sin(tPhase) * 2.2;
                pose.neckRot = 4 + Math.sin(tPhase) * 2.0;

                const diag1 = Math.sin(tPhase);
                const diag2 = -diag1;

                pose.foreNearShoulder = diag1 * 28;
                pose.foreNearKnee = diag1 < 0 ? Math.abs(diag1) * 44 : 6;
                pose.hindFarHip = diag1 * 24;
                pose.hindFarHock = diag1 > 0 ? diag1 * 38 : 6;

                pose.foreFarShoulder = diag2 * 28;
                pose.foreFarKnee = diag2 < 0 ? Math.abs(diag2) * 44 : 6;
                pose.hindNearHip = diag2 * 24;
                pose.hindNearHock = diag2 > 0 ? diag2 * 38 : 6;
                break;
            }
            case "Canter": {
                // 3 拍大步跑
                const cPhase = t * 11.0 * speed;
                pose.bodyY = Math.sin(cPhase) * 4.2;
                pose.bodyRot = 4 + Math.sin(cPhase) * 3.0;
                pose.neckRot = 6 + Math.sin(cPhase) * 4.0;
                const cLead = Math.sin(cPhase);
                pose.foreNearShoulder = 15 + cLead * 32;
                pose.foreNearKnee = cLead < 0 ? Math.abs(cLead) * 48 : 8;
                pose.foreFarShoulder = -5 + cLead * 28;
                pose.foreFarKnee = cLead > 0 ? cLead * 42 : 8;
                pose.hindNearHip = -10 + cLead * 30;
                pose.hindNearHock = cLead < 0 ? Math.abs(cLead) * 45 : 10;
                pose.hindFarHip = -18 + cLead * 26;
                pose.hindFarHock = cLead > 0 ? cLead * 40 : 10;
                break;
            }
            case "Graze": {
                // 低头吃草与咀嚼
                pose.bodyY = -5;
                pose.bodyRot = -3;
                pose.neckRot = -42;
                pose.headRot = -20;
                pose.jawOpen = Math.abs(Math.sin(t * 7.5)) * 0.75;
                pose.earAngle = Math.sin(t * 3) * 8;
                pose.foreNearShoulder = 12;
                pose.foreNearKnee = 3;
                pose.foreFarShoulder = -6;
                pose.foreFarKnee = 4;
                pose.hindNearHip = 4;
                pose.hindNearHock = 6;
                break;
            }
            case "Drink": {
                pose.bodyY = -6;
                pose.neckRot = -48;
                pose.headRot = -24;
                pose.jawOpen = Math.abs(Math.sin(t * 5.0)) * 0.45;
                pose.foreNearShoulder = 16;
                pose.foreFarShoulder = -4;
                break;
            }
            case "Rear": {
                // 起扬：双后肢深屈承重，双前肢腾空挥击
                pose.bodyY = 16;
                pose.bodyRot = 44;
                pose.neckRot = 24;
                pose.headRot = 12;
                pose.earAngle = -10;
                pose.hindNearHip = -28;
                pose.hindNearHock = 46;
                pose.hindFarHip = -24;
                pose.hindFarHock = 48;
                pose.foreNearShoulder = 34 + Math.sin(t * 9) * 14;
                pose.foreNearKnee = 50 + Math.cos(t * 9) * 12;
                pose.foreFarShoulder = 30 - Math.sin(t * 9) * 14;
                pose.foreFarKnee = 54 - Math.cos(t * 9) * 12;
                break;
            }
            case "Buck": {
                // 尥蹶子：前体贴地，双后腿高踹腾空
                pose.bodyY = -4;
                pose.bodyRot = -28;
                pose.neckRot = -18;
                pose.headRot = -8;
                pose.foreNearShoulder = -8;
                pose.foreNearKnee = 6;
                pose.foreFarShoulder = -12;
                pose.foreFarKnee = 8;
                const kickPhase = Math.sin(t * 11);
                pose.hindNearHip = 46 + kickPhase * 16;
                pose.hindNearHock = 12;
                pose.hindFarHip = 44 + kickPhase * 14;
                pose.hindFarHock = 14;
                break;
            }
            case "Lie_Down": {
                // 卧倒：四肢折叠贴地
                pose.bodyY = -14;
                pose.bodyRot = -2;
                pose.neckRot = -8;
                pose.headRot = -4;
                pose.foreNearShoulder = 28;
                pose.foreNearKnee = 78;
                pose.foreFarShoulder = 24;
                pose.foreFarKnee = 75;
                pose.hindNearHip = -32;
                pose.hindNearHock = 76;
                pose.hindFarHip = -28;
                pose.hindFarHock = 74;
                break;
            }
            case "Roll": {
                // 打滚：左右翻转四蹄朝天
                const rWave = Math.sin(t * 4.5);
                pose.bodyY = -11;
                pose.bodyRot = rWave * 48;
                pose.neckRot = rWave * 18;
                pose.foreNearShoulder = 45 + rWave * 15;
                pose.foreNearKnee = 36;
                pose.foreFarShoulder = 40 - rWave * 15;
                pose.foreFarKnee = 38;
                pose.hindNearHip = 38 + rWave * 14;
                pose.hindNearHock = 34;
                pose.hindFarHip = 35 - rWave * 14;
                pose.hindFarHock = 36;
                break;
            }
            case "Stretch": {
                // 伸懒腰：前身低伏反弓，前肢伸展
                pose.bodyY = -7;
                pose.bodyRot = -16;
                pose.neckRot = -12;
                pose.headRot = 8;
                pose.foreNearShoulder = 30;
                pose.foreNearKnee = 0;
                pose.foreFarShoulder = 26;
                pose.foreFarKnee = 0;
                pose.hindNearHip = -16;
                pose.hindNearHock = 12;
                break;
            }
            case "Paw": {
                // 单前蹄刨地刮土
                const pWave = Math.sin(t * 8.0);
                pose.bodyY = 0;
                pose.neckRot = -10;
                pose.foreNearShoulder = pWave * 26;
                pose.foreNearKnee = pWave < 0 ? Math.abs(pWave) * 45 : 0;
                pose.foreFarShoulder = 0;
                pose.foreFarKnee = 0;
                break;
            }
            case "Neigh": {
                // 仰头长啸嘶鸣
                pose.bodyY = 3;
                pose.neckRot = 28;
                pose.headRot = 16;
                pose.jawOpen = 0.85;
                pose.earAngle = -12;
                break;
            }
            case "Snort_Alert": {
                // 警觉打响鼻：头高昂、双耳直竖
                pose.bodyY = 2;
                pose.neckRot = 18;
                pose.headRot = 8;
                pose.earAngle = 18;
                pose.jawOpen = 0.25;
                break;
            }
            case "Kick": {
                // 单后肢后踹
                const kWave = Math.sin(t * 9.0);
                pose.bodyRot = -10;
                pose.hindNearHip = 42 + kWave * 16;
                pose.hindNearHock = 8;
                break;
            }
            case "Foal_Hop": {
                // 幼驹欢快腾跃小跳
                const hWave = Math.abs(Math.sin(t * 7.0));
                pose.bodyY = hWave * 7.5;
                pose.bodyRot = Math.sin(t * 7.0) * 6;
                pose.neckRot = 12 + Math.sin(t * 7.0) * 6;
                pose.headRot = 8;
                pose.earAngle = 14;
                pose.foreNearShoulder = 18 + hWave * 20;
                pose.foreNearKnee = hWave * 32;
                pose.foreFarShoulder = 14 + hWave * 20;
                pose.foreFarKnee = hWave * 32;
                pose.hindNearHip = -8 - hWave * 15;
                pose.hindNearHock = hWave * 28;
                pose.hindFarHip = -10 - hWave * 15;
                pose.hindFarHock = hWave * 28;
                break;
            }
            case "Foal_Nuzzle": {
                // 幼驹探头亲昵磨蹭
                pose.bodyY = Math.sin(t * 2.5) * 1.5;
                pose.neckRot = 16 + Math.sin(t * 3.5) * 8;
                pose.headRot = 14 + Math.sin(t * 3.5) * 6;
                pose.earAngle = 16;
                break;
            }
            case "Foal_Frolic": {
                // 幼驹撒欢轻跃旋转
                const fWave = Math.sin(t * 8.5);
                pose.bodyY = Math.abs(fWave) * 4.5;
                pose.bodyRot = fWave * 8;
                pose.neckRot = 10 + Math.sin(t * 8.5) * 6;
                pose.foreNearShoulder = fWave * 24;
                pose.foreNearKnee = fWave < 0 ? Math.abs(fWave) * 40 : 4;
                pose.foreFarShoulder = -fWave * 24;
                pose.foreFarKnee = fWave > 0 ? fWave * 40 : 4;
                pose.hindNearHip = -fWave * 20;
                pose.hindNearHock = fWave < 0 ? Math.abs(fWave) * 35 : 6;
                pose.hindFarHip = fWave * 20;
                pose.hindFarHock = fWave > 0 ? fWave * 35 : 6;
                break;
            }
            default: {
                pose.bodyY = Math.sin(t * 2) * 0.6;
                break;
            }
        }

        return pose;
    }

    /** 平滑插值更新骨骼当前姿态 (CrossFade 融合过渡，杜绝硬切) */
    private updateRigPose(dt: number): void {
        this.targetRigPose = this.computeTargetRigPose(this.currentAction, this.animTime);
        const blend = 1 - Math.exp(-14.0 * Math.max(0.001, Math.min(dt, 0.05)));
        const cur = this.currentRigPose;
        const tgt = this.targetRigPose;

        cur.bodyY += (tgt.bodyY - cur.bodyY) * blend;
        cur.bodyRot += (tgt.bodyRot - cur.bodyRot) * blend;
        cur.neckRot += (tgt.neckRot - cur.neckRot) * blend;
        cur.headRot += (tgt.headRot - cur.headRot) * blend;
        cur.jawOpen += (tgt.jawOpen - cur.jawOpen) * blend;
        cur.earAngle += (tgt.earAngle - cur.earAngle) * blend;
        cur.foreNearShoulder += (tgt.foreNearShoulder - cur.foreNearShoulder) * blend;
        cur.foreNearKnee += (tgt.foreNearKnee - cur.foreNearKnee) * blend;
        cur.foreFarShoulder += (tgt.foreFarShoulder - cur.foreFarShoulder) * blend;
        cur.foreFarKnee += (tgt.foreFarKnee - cur.foreFarKnee) * blend;
        cur.hindNearHip += (tgt.hindNearHip - cur.hindNearHip) * blend;
        cur.hindNearHock += (tgt.hindNearHock - cur.hindNearHock) * blend;
        cur.hindFarHip += (tgt.hindFarHip - cur.hindFarHip) * blend;
        cur.hindFarHock += (tgt.hindFarHock - cur.hindFarHock) * blend;
    }

    /**
     * 绘制模块化高精解剖铰接骨骼系统 (George Stubbs 纯血马古典解剖学规范)
     * 涵盖肌肉流线、高光缎面光泽、背脊与腹部立体阴影、额头流星白章、四蹄白袜踏雪、
     * 柔体多缕马鬃、多层物理马尾、晶莹灵动眼眸、转动双耳与开合下颌。
     */
    private renderArticulatedRig(pose: ArticulatedRigPose): void {
        const g = this.rigG;
        if (!g || !g.isValid) return;
        g.clear();

        const coat = this.getCoatBaseColor();
        const farCoat = new Color(
            Math.max(10, Math.floor(coat.r * 0.72)),
            Math.max(10, Math.floor(coat.g * 0.72)),
            Math.max(10, Math.floor(coat.b * 0.72)),
            255
        );
        const shadowCoat = new Color(
            Math.max(10, Math.floor(coat.r * 0.82)),
            Math.max(10, Math.floor(coat.g * 0.82)),
            Math.max(10, Math.floor(coat.b * 0.82)),
            255
        );
        const silkHighlight = new Color(
            Math.min(255, coat.r + 55),
            Math.min(255, coat.g + 55),
            Math.min(255, coat.b + 50),
            140
        );
        const hoofCol = new Color(32, 26, 22, 255);
        const maneCol = this.getManeColor();
        const maneHighlight = new Color(
            Math.min(255, maneCol.r + 45),
            Math.min(255, maneCol.g + 45),
            Math.min(255, maneCol.b + 40),
            200
        );

        let legLen = 14.5;
        let bodyW = 20;
        let bodyH = 13;
        let headScale = 1.0;
        let croupOffset = 0;
        let hasTack = false;

        if (this.isFoal) {
            if (this.foalStage === FoalGrowthStage.Foal) {
                legLen = 13.5;
                bodyW = 15;
                bodyH = 10;
                headScale = 1.25;
            } else if (this.foalStage === FoalGrowthStage.Yearling) {
                legLen = 14.2;
                bodyW = 18;
                bodyH = 11.5;
                headScale = 1.10;
                croupOffset = 3.5;
            } else if (this.foalStage === FoalGrowthStage.Adult) {
                legLen = 14.5;
                bodyW = 20;
                bodyH = 13;
                headScale = 1.0;
            } else if (this.foalStage === FoalGrowthStage.RacingPro) {
                legLen = 15.0;
                bodyW = 20.5;
                bodyH = 12.5;
                headScale = 0.98;
                hasTack = true;
            }
        } else {
            hasTack = !this.isPaddockMode;
        }

        const bY = pose.bodyY;
        const bRotRad = (pose.bodyRot * Math.PI) / 180;

        // 1. 远景肢体 (Far Legs: Z-Order 最底层)
        const farShoulderX = 14 * Math.cos(bRotRad);
        const farShoulderY = bY + 14 * Math.sin(bRotRad) - 2;
        this.drawArticulatedLeg(
            g,
            farShoulderX,
            farShoulderY,
            pose.foreFarShoulder,
            pose.foreFarKnee,
            legLen,
            farCoat,
            hoofCol,
            false
        );

        const farHipX = -16 * Math.cos(bRotRad);
        const farHipY = bY + croupOffset - 16 * Math.sin(bRotRad);
        this.drawArticulatedLeg(
            g,
            farHipX,
            farHipY,
            pose.hindFarHip,
            pose.hindFarHock,
            legLen * 1.05,
            farCoat,
            hoofCol,
            true
        );

        // 2. 马体主躯干 (Torso / Barrel, Withers, Loin & Croup)
        g.fillColor = coat;
        // 臀肌后躯大椭圆 (Croup & Buttock)
        g.ellipse(-14 * Math.cos(bRotRad), bY + croupOffset, bodyW * 0.68, bodyH * 1.05);
        g.fill();

        // 前躯深胸廓大椭圆 (Thorax & Chest)
        g.ellipse(8 * Math.cos(bRotRad), bY + 3, bodyW * 0.78, bodyH * 1.10);
        g.fill();

        // 中躯腰背与腹腔连体多边形 (Loin & Abdomen)
        g.moveTo(-14 * Math.cos(bRotRad), bY + croupOffset + bodyH * 0.72);
        g.quadraticCurveTo(-2 * Math.cos(bRotRad), bY + 2 + bodyH * 0.68, 8 * Math.cos(bRotRad), bY + 3 + bodyH * 0.78);
        g.lineTo(8 * Math.cos(bRotRad), bY + 3 - bodyH * 0.78);
        g.quadraticCurveTo(-2 * Math.cos(bRotRad), bY + 1 - bodyH * 0.65, -14 * Math.cos(bRotRad), bY + croupOffset - bodyH * 0.65);
        g.close();
        g.fill();

        // 躯干受光缎面丝绸高光 (Silk Sheen Highlights on Withers & Loin)
        g.strokeColor = silkHighlight;
        g.lineWidth = 2.4;
        g.moveTo(-16 * Math.cos(bRotRad), bY + croupOffset + bodyH * 0.66);
        g.quadraticCurveTo(-4 * Math.cos(bRotRad), bY + 2 + bodyH * 0.60, 10 * Math.cos(bRotRad), bY + 3 + bodyH * 0.74);
        g.stroke();

        // 腹底与腹肋立体暗部阴影 (Underbelly Ambient Shadow)
        g.strokeColor = shadowCoat;
        g.lineWidth = 2.8;
        g.moveTo(-12 * Math.cos(bRotRad), bY + croupOffset - bodyH * 0.58);
        g.quadraticCurveTo(-2 * Math.cos(bRotRad), bY + 1 - bodyH * 0.68, 8 * Math.cos(bRotRad), bY + 3 - bodyH * 0.72);
        g.stroke();

        // 肩胛骨肌峰突起高光 (Scapular Ridge)
        g.strokeColor = silkHighlight;
        g.lineWidth = 1.6;
        g.moveTo(6 * Math.cos(bRotRad), bY + 9);
        g.lineTo(12 * Math.cos(bRotRad), bY + 2);
        g.stroke();

        // 3. 近景肢体 (Near Legs: Z-Order 前景)
        const nearHipX = -14 * Math.cos(bRotRad);
        const nearHipY = bY + croupOffset - 14 * Math.sin(bRotRad);
        this.drawArticulatedLeg(
            g,
            nearHipX,
            nearHipY,
            pose.hindNearHip,
            pose.hindNearHock,
            legLen * 1.05,
            coat,
            hoofCol,
            true
        );

        const nearShoulderX = 12 * Math.cos(bRotRad);
        const nearShoulderY = bY + 12 * Math.sin(bRotRad);
        this.drawArticulatedLeg(
            g,
            nearShoulderX,
            nearShoulderY,
            pose.foreNearShoulder,
            pose.foreNearKnee,
            legLen,
            coat,
            hoofCol,
            false
        );

        // 4. 颈项、马头与面部特征 (Neck, Head, Muzzle & Facial Markings)
        const neckBaseX = 14 * Math.cos(bRotRad);
        const neckBaseY = bY + 8 + 14 * Math.sin(bRotRad);
        const neckAngleRad = ((pose.bodyRot + pose.neckRot + 52) * Math.PI) / 180;
        const neckLen = (this.isFoal ? 16 : 22) * headScale;

        const headPollX = neckBaseX + Math.cos(neckAngleRad) * neckLen;
        const headPollY = neckBaseY + Math.sin(neckAngleRad) * neckLen;

        // 优雅弓形马颈肌肉多边形 (Arched Crested Neck)
        g.fillColor = coat;
        g.moveTo(neckBaseX - 3, neckBaseY);
        // 上缘弓形凸弧 (Convex Crest)
        g.quadraticCurveTo(neckBaseX + 6, neckBaseY + neckLen * 0.65, headPollX - 2, headPollY);
        g.lineTo(headPollX + 4, headPollY - 3);
        // 下缘咽喉凹弧 (Throatlatch Concave Curve)
        g.quadraticCurveTo(neckBaseX + 8, neckBaseY + neckLen * 0.35, neckBaseX + 6, neckBaseY - 6);
        g.close();
        g.fill();

        // 颈背肌肉高光
        g.strokeColor = silkHighlight;
        g.lineWidth = 1.8;
        g.moveTo(neckBaseX - 2, neckBaseY + 1);
        g.quadraticCurveTo(neckBaseX + 6, neckBaseY + neckLen * 0.62, headPollX - 2, headPollY - 1);
        g.stroke();

        // 飘逸多缕马鬃 (Multi-Strand Mane Locks)
        const maneLocks = 6;
        for (let m = 0; m < maneLocks; m++) {
            const mFrac = m / (maneLocks - 1);
            const mx = neckBaseX - 2 + (headPollX - neckBaseX) * mFrac;
            const my = neckBaseY + 2 + (headPollY - neckBaseY) * mFrac;
            const wave = Math.sin(this.animTime * 12 + m * 0.9) * 2.4;

            g.strokeColor = maneCol;
            g.lineWidth = 2.2;
            g.moveTo(mx, my);
            g.quadraticCurveTo(mx - 4 + wave * 0.5, my + 4, mx - 8 + wave, my + 6 + wave * 0.5);
            g.stroke();

            // 亮缕丝光
            g.strokeColor = maneHighlight;
            g.lineWidth = 1.0;
            g.moveTo(mx, my + 0.8);
            g.quadraticCurveTo(mx - 3 + wave * 0.5, my + 4.5, mx - 7 + wave, my + 6.8 + wave * 0.5);
            g.stroke();
        }

        // 马头轮廓与下颌肌群 (Head, Masseter Cheek & Muzzle)
        const headAngleRad = ((pose.bodyRot + pose.neckRot + pose.headRot) * Math.PI) / 180;
        const muzzleLen = (this.isFoal ? 13 : 17) * headScale;
        const muzzleX = headPollX + Math.cos(headAngleRad) * muzzleLen;
        const muzzleY = headPollY - Math.sin(headAngleRad) * 4 - (pose.neckRot < -25 ? 5 : 2);

        // 圆润强健的咬肌颊颊骨 (Masseter Cheek Circle)
        g.fillColor = coat;
        g.circle(headPollX, headPollY, 5.4 * headScale);
        g.fill();

        // 额部至吻端侧面楔形多边形 (Forehead to Muzzle Wedge)
        g.moveTo(headPollX - 1, headPollY + 4.2 * headScale);
        g.lineTo(muzzleX, muzzleY + 2.5 * headScale);
        g.lineTo(muzzleX - 1, muzzleY - 3.5 * headScale);
        g.lineTo(headPollX + 1, headPollY - 4.2 * headScale);
        g.close();
        g.fill();

        // 额头流星白章标志 (Forehead Diamond Star / Blaze)
        if (this.horseNo % 2 === 1 || this.horseNo === 4) {
            const starX = headPollX + 2.5 * headScale;
            const starY = headPollY + 2.0 * headScale;
            g.fillColor = new Color(252, 252, 248, 245);
            g.moveTo(starX, starY + 2.2 * headScale);
            g.lineTo(starX + 1.8 * headScale, starY);
            g.lineTo(starX, starY - 2.2 * headScale);
            g.lineTo(starX - 1.8 * headScale, starY);
            g.close();
            g.fill();
        }

        // 柔软吻端鼻唇与鼻孔 (Velvety Muzzle & Nostrils)
        g.fillColor = new Color(38, 26, 20, 245);
        g.circle(muzzleX - 0.8, muzzleY + 0.6 * headScale, 1.4 * headScale);
        g.fill();
        // 鼻孔微红内壁
        g.fillColor = new Color(85, 42, 35, 230);
        g.circle(muzzleX - 0.8, muzzleY + 0.6 * headScale, 0.7 * headScale);
        g.fill();

        // 晶莹灵动纯血马明眸 (Expressive Equine Eye)
        const eyeX = headPollX + 3.2 * headScale;
        const eyeY = headPollY + 1.2 * headScale;
        // 眼窝深色暗影
        g.fillColor = new Color(22, 16, 12, 255);
        g.ellipse(eyeX, eyeY, 2.2 * headScale, 1.4 * headScale);
        g.fill();
        // 琥珀/深褐虹膜
        g.fillColor = new Color(68, 42, 22, 255);
        g.circle(eyeX + 0.2, eyeY, 1.0 * headScale);
        g.fill();
        // 黑色瞳孔
        g.fillColor = Color.BLACK;
        g.circle(eyeX + 0.2, eyeY, 0.6 * headScale);
        g.fill();
        // 灵动光捕高光点 (Catchlight Dot)
        g.fillColor = Color.WHITE;
        g.circle(eyeX + 0.6, eyeY + 0.5, 0.45);
        g.fill();
        // 上眼睑轮廓线
        g.strokeColor = new Color(18, 12, 8, 240);
        g.lineWidth = 0.8;
        g.arc(eyeX, eyeY + 0.2, 2.0 * headScale, 0.2, Math.PI - 0.2, false);
        g.stroke();

        // 灵动双耳 (Mobile Ears)
        const earAngleRad = ((pose.bodyRot + pose.neckRot + pose.earAngle + 85) * Math.PI) / 180;
        const earLen = 7.8 * headScale;
        const earTipX = headPollX + Math.cos(earAngleRad) * earLen;
        const earTipY = headPollY + Math.sin(earAngleRad) * earLen;

        // 远侧耳 (Far Ear)
        g.fillColor = farCoat;
        g.moveTo(headPollX - 3.5, headPollY + 3.5);
        g.lineTo(earTipX - 2.5, earTipY - 1);
        g.lineTo(headPollX, headPollY + 4);
        g.close();
        g.fill();

        // 近侧耳 (Near Ear)
        g.fillColor = coat;
        g.moveTo(headPollX - 2, headPollY + 4.2);
        g.lineTo(earTipX, earTipY);
        g.lineTo(headPollX + 2.5, headPollY + 3.2);
        g.close();
        g.fill();
        // 内耳肉粉色软毛贴片 (Inner Ear Pinkish Fluff)
        g.strokeColor = new Color(225, 180, 170, 200);
        g.lineWidth = 1.0;
        g.moveTo(headPollX - 0.5, headPollY + 4.5);
        g.lineTo(earTipX * 0.85 + headPollX * 0.15, earTipY * 0.85 + headPollY * 0.15);
        g.stroke();

        // 额前额毛 (Forelock Falling Over Forehead)
        g.strokeColor = maneCol;
        g.lineWidth = 1.8;
        g.moveTo(headPollX, headPollY + 4.5);
        g.quadraticCurveTo(headPollX + 2.5, headPollY + 3.5, headPollX + 3.8, headPollY + 1.0);
        g.stroke();

        // 张嘴与下颌骨开合 (Articulated Jaw Movement)
        if (pose.jawOpen > 0.05) {
            const jawDrop = pose.jawOpen * 4.5 * headScale;
            g.fillColor = coat;
            g.moveTo(headPollX + 2, headPollY - 3);
            g.lineTo(muzzleX - 2, muzzleY - 3 - jawDrop);
            g.lineTo(muzzleX + 1, muzzleY - jawDrop);
            g.close();
            g.fill();

            // 口腔内粉红色舌齿
            g.fillColor = new Color(195, 75, 75, 220);
            g.rect(muzzleX - 1.5, muzzleY - 2.2 - jawDrop, 2.5, jawDrop * 0.6);
            g.fill();
        }

        // 5. 竞技马具装备 (Saddlecloth, Bridle when in Racing Pro or Race)
        if (hasTack) {
            this.renderRigRacingTack(g, bRotRad, bY, croupOffset, headPollX, headPollY, muzzleX, muzzleY, headScale);
        }
    }

    /** 绘制附着在解剖骨骼上的高精竞技鞍布、水勒缰绳与马具细节 */
    private renderRigRacingTack(
        g: Graphics,
        bRotRad: number,
        bY: number,
        _croupOffset: number,
        headPollX: number,
        headPollY: number,
        muzzleX: number,
        muzzleY: number,
        headScale: number
    ): void {
        const silkCol = this.getJockeySilkColor();

        // A. 水勒皮质头绪缰绳 (Leather Bridle, Snaffle Bit & Reins)
        g.strokeColor = new Color(48, 30, 18, 240);
        g.lineWidth = 1.2;
        // 额颊带
        g.moveTo(headPollX, headPollY + 3 * headScale);
        g.lineTo(muzzleX - 2, muzzleY + 0.5 * headScale);
        g.stroke();
        // 鼻革带
        g.moveTo(muzzleX - 3, muzzleY + 2 * headScale);
        g.lineTo(muzzleX - 1, muzzleY - 2.5 * headScale);
        g.stroke();
        // 金属马衔铁圈 (Snaffle Bit Ring)
        g.strokeColor = new Color(225, 205, 120, 240);
        g.lineWidth = 1.0;
        g.circle(muzzleX - 1.5, muzzleY - 0.5 * headScale, 1.5 * headScale);
        g.stroke();

        // B. 竞技官方鞍布 (Racing Saddle Pad)
        const saddleX = -4 * Math.cos(bRotRad);
        const saddleY = bY + 5;
        g.fillColor = silkCol;
        g.roundRect(saddleX - 11, saddleY - 6, 22, 13, 3);
        g.fill();

        // 鞍布烫金滚边绳 (Gold Cord Trim)
        g.strokeColor = new Color(245, 215, 65, 240);
        g.lineWidth = 1.2;
        g.roundRect(saddleX - 11, saddleY - 6, 22, 13, 3);
        g.stroke();

        // 鞍布中央白色圆圈与马号
        g.fillColor = Color.WHITE;
        g.circle(saddleX, saddleY, 4.5);
        g.fill();
        g.fillColor = WestColors.INK_DARK;
        g.circle(saddleX, saddleY, 1.8);
        g.fill();

        // 黑色轻量竞技马鞍 (Aero Racing Saddle)
        g.fillColor = new Color(28, 20, 15, 245);
        g.roundRect(saddleX - 6, saddleY + 1, 12, 6, 2);
        g.fill();

        // 鞍腹肚带 (Girth Strap)
        g.fillColor = new Color(42, 28, 16, 240);
        g.rect(saddleX - 2, saddleY - 12, 3.5, 7);
        g.fill();

        // 金属马镫 (Brass Stirrup)
        g.strokeColor = new Color(225, 205, 120, 240);
        g.lineWidth = 1.0;
        g.rect(saddleX - 2.5, saddleY - 8, 4.5, 3.5);
        g.stroke();
    }

    /** 绘制带前膝/飞节与球节解剖铰接的写实四肢 (含肌肉轮廓、关节曲度、白袜白章与金属马蹄铁) */
    private drawArticulatedLeg(
        g: Graphics,
        rootX: number,
        rootY: number,
        angle1Deg: number,
        angle2Deg: number,
        length: number,
        legColor: Color,
        hoofColor: Color,
        isHind: boolean
    ): void {
        const rad1 = ((angle1Deg - 90) * Math.PI) / 180;
        const upperLen = length * 0.52;
        const lowerLen = length * 0.48;

        const jointX = rootX + Math.cos(rad1) * upperLen;
        const jointY = rootY + Math.sin(rad1) * upperLen;

        const rad2 = isHind ? rad1 - (angle2Deg * Math.PI) / 180 : rad1 + (angle2Deg * Math.PI) / 180;
        const hoofX = jointX + Math.cos(rad2) * lowerLen;
        const hoofY = jointY + Math.sin(rad2) * lowerLen;

        // 1. 上肢肌肉轮廓 (Upper Muscular Segment)
        if (isHind) {
            // 后大腿丰满股骨肌群 (Hind Thigh Muscle Contour)
            g.strokeColor = legColor;
            g.lineWidth = 6.2;
            g.moveTo(rootX, rootY);
            g.lineTo(jointX, jointY);
            g.stroke();

            // 大腿后侧弧形肌肉阴影
            g.strokeColor = new Color(Math.max(10, legColor.r - 28), Math.max(10, legColor.g - 28), Math.max(10, legColor.b - 28), 160);
            g.lineWidth = 2.4;
            g.moveTo(rootX - 2.5, rootY - 1);
            g.lineTo(jointX - 1.5, jointY);
            g.stroke();
        } else {
            // 前臂肌肉 (Forearm Scapula & Radius)
            g.strokeColor = legColor;
            g.lineWidth = 4.6;
            g.moveTo(rootX, rootY);
            g.lineTo(jointX, jointY);
            g.stroke();
        }

        // 2. 关节铰接点 (Carpus Flat Knee / Hock Calcaneus)
        g.fillColor = legColor;
        g.circle(jointX, jointY, isHind ? 3.4 : 2.8);
        g.fill();

        // 飞节/前膝后方筋腱转折棱角
        if (isHind) {
            const hockBackX = jointX - Math.sin(rad1) * 2.2;
            const hockBackY = jointY + Math.cos(rad1) * 2.2;
            g.circle(hockBackX, hockBackY, 2.0);
            g.fill();
        }

        // 3. 下肢管骨与球节系部 (Cannon Bone & Pastern)
        g.strokeColor = legColor;
        g.lineWidth = isHind ? 3.5 : 3.0;
        g.moveTo(jointX, jointY);
        g.lineTo(hoofX, hoofY);
        g.stroke();

        // 4. 四蹄白袜标志 (White Sock Marking / 蹄踏雪)
        const hasWhiteSock = (this.horseNo % 3 === 0) || (this.horseNo === 1 && isHind) || (this.horseNo === 5);
        if (hasWhiteSock) {
            const sockStartX = jointX + (hoofX - jointX) * 0.58;
            const sockStartY = jointY + (hoofY - jointY) * 0.58;
            g.strokeColor = new Color(250, 250, 246, 240);
            g.lineWidth = isHind ? 3.4 : 2.9;
            g.moveTo(sockStartX, sockStartY);
            g.lineTo(hoofX, hoofY);
            g.stroke();

            // 蹄冠部淡粉色皮肤环 (Coronary Band)
            g.strokeColor = new Color(245, 205, 195, 200);
            g.lineWidth = 1.0;
            g.moveTo(hoofX - 1.2, hoofY);
            g.lineTo(hoofX + 1.2, hoofY);
            g.stroke();
        }

        // 5. 写实梯形坚硬角质马蹄与银色马蹄铁 (Anatomical Hoof & Horseshoe)
        g.fillColor = hoofColor;
        g.moveTo(hoofX - 2.8, hoofY + 1.4);
        g.lineTo(hoofX + 2.8, hoofY + 1.4);
        g.lineTo(hoofX + 3.2, hoofY - 2.2);
        g.lineTo(hoofX - 2.2, hoofY - 2.2);
        g.close();
        g.fill();

        // 蹄底金属马蹄铁银色反光 (Horseshoe Iron Trim)
        g.strokeColor = new Color(205, 215, 225, 220);
        g.lineWidth = 0.9;
        g.moveTo(hoofX - 2.4, hoofY - 2.2);
        g.lineTo(hoofX + 3.4, hoofY - 2.2);
        g.stroke();
    }

    /**
     * 程序化 2D 动力学姿态计算器 (Procedural Kinetic Pose Evaluator)
     * 根据 40+ 动作进行精细的正弦波、贝塞尔弹性以及物理重心转移计算
     */
    private computeActionPose(action: string, t: number): {
        posX: number;
        posY: number;
        rotDeg: number;
        scaleX: number;
        scaleY: number;
        shadowScale: number;
        shadowAlpha: number;
    } {
        let posX = 0;
        let posY = 0;
        let rotDeg = 0;
        let scaleX = 1.0;
        let scaleY = 1.0;
        let shadowScale = 1.0;
        let shadowAlpha = 85;

        switch (action) {
            // ================= 1. 步态与移动类 =================
            case "Walk": {
                const phase = t * 6.5;
                posY = Math.abs(Math.sin(phase)) * 1.6;
                rotDeg = Math.sin(phase * 0.5) * 1.8;
                posX = Math.sin(phase) * 1.2;
                scaleX = 1.0 + Math.sin(phase) * 0.02;
                scaleY = 1.0 - Math.sin(phase) * 0.02;
                shadowScale = 1.0 - (posY / 1.6) * 0.08;
                break;
            }
            case "Trot": {
                const phase = t * 10.5;
                posY = Math.abs(Math.sin(phase)) * 2.8;
                rotDeg = Math.sin(phase) * 2.2;
                scaleX = 1.0 + Math.sin(phase) * 0.05;
                scaleY = 1.0 - Math.sin(phase) * 0.04;
                shadowScale = 1.0 - (posY / 2.8) * 0.12;
                break;
            }
            case "Canter": {
                const phase = t * 13.5;
                posY = Math.sin(phase) * 3.4;
                rotDeg = 3.2 + Math.sin(phase) * 2.4;
                scaleX = 1.0 + Math.sin(phase) * 0.07;
                scaleY = 1.0 - Math.sin(phase) * 0.05;
                shadowScale = 0.95;
                break;
            }
            case "Gallop":
            case "Accelerate":
            case "Sprint": {
                const freq = action === "Sprint" ? 22.0 : (action === "Gallop" ? 17.5 : 15.0);
                const phase = t * freq;
                // 双腾空期上下大幅起伏 (Double-Suspension Harmonic Bounce)
                posY = Math.sin(phase) * 5.2;
                // 极速向前低重心俯仰倾角 (Forward Aerodynamic Pitch)
                const basePitch = action === "Sprint" ? 5.5 : 4.0;
                rotDeg = basePitch + Math.sin(phase * 0.5) * 3.5;
                // 躯干收缩与向前飞跃伸展 (Dynamic Stride Compression & Extension)
                scaleX = 1.0 + Math.sin(phase) * 0.09;
                scaleY = 1.0 - Math.sin(phase) * 0.07;
                // 踏地瞬间暗影放大加深，腾空瞬间暗影缩小淡化
                shadowScale = 1.0 - (posY / 5.2) * 0.22;
                shadowAlpha = Math.floor(95 - (posY / 5.2) * 35);
                break;
            }
            case "Back": {
                const phase = t * 5.0;
                posY = Math.abs(Math.sin(phase)) * 1.2;
                rotDeg = -3.2;
                posX = -Math.abs(Math.sin(phase * 0.5)) * 3.5;
                scaleX = 0.98;
                break;
            }
            case "Turn": {
                rotDeg = Math.sin(t * 3.5) * 6.5;
                posX = Math.sin(t * 3.5) * 3.0;
                scaleX = 0.96;
                break;
            }
            case "Sidepass": {
                posX = Math.sin(t * 5.5) * 4.0;
                posY = Math.abs(Math.sin(t * 5.5)) * 1.5;
                rotDeg = Math.sin(t * 5.5) * 2.0;
                break;
            }
            case "Sliding_Stop": {
                // 后肢深蹲刹车滑行
                posY = -6.5;
                rotDeg = -9.5;
                posX = 4.5;
                scaleX = 0.95;
                scaleY = 0.90;
                shadowScale = 1.25;
                shadowAlpha = 115;
                break;
            }

            // ================= 2. 日常与生理类 =================
            case "Graze": {
                // 吃草：马头探低贴地咀嚼
                posY = -7.5 + Math.sin(t * 5.5) * 1.2;
                rotDeg = -14.5 + Math.sin(t * 5.5) * 2.0;
                posX = 6.0;
                scaleX = 1.05;
                scaleY = 0.94;
                shadowScale = 1.1;
                break;
            }
            case "Drink": {
                // 饮水：更深幅度低头
                posY = -9.0 + Math.sin(t * 4.0) * 0.8;
                rotDeg = -18.0 + Math.sin(t * 4.0) * 1.5;
                posX = 7.5;
                scaleX = 1.06;
                scaleY = 0.92;
                break;
            }
            case "Lie_Down": {
                // 卧倒：身体下伏贴地
                posY = -13.5;
                rotDeg = -2.0 + Math.sin(t * 1.8) * 0.8;
                scaleX = 1.10;
                scaleY = 0.72;
                shadowScale = 1.35;
                shadowAlpha = 120;
                break;
            }
            case "Roll": {
                // 打滚：贴地左右摇摆翻滚
                posY = -12.5 + Math.abs(Math.sin(t * 4.0)) * 2.0;
                rotDeg = Math.sin(t * 4.0) * 24.0;
                scaleX = 0.92 + Math.cos(t * 4.0) * 0.08;
                scaleY = 0.78;
                break;
            }
            case "Stretch": {
                // 伸懒腰：前身深俯、后背反弓伸长
                posY = -5.5 + Math.sin(t * 3.0) * 1.2;
                rotDeg = -11.0;
                scaleX = 1.14;
                scaleY = 0.88;
                posX = 5.0;
                break;
            }
            case "Rub_Scratch": {
                // 蹭痒：侧身靠栏杆来回摩擦
                posX = Math.sin(t * 6.0) * 4.5;
                rotDeg = Math.sin(t * 6.0) * 3.5;
                break;
            }
            case "Tail_Swish": {
                rotDeg = Math.sin(t * 8.0) * 2.8;
                scaleX = 1.0 + Math.sin(t * 8.0) * 0.04;
                break;
            }
            case "Shake": {
                // 抖身：全身高频微震甩灰
                rotDeg = Math.sin(t * 26.0) * 4.0;
                posX = Math.sin(t * 26.0) * 3.0;
                posY = Math.abs(Math.sin(t * 13.0)) * 1.5;
                break;
            }
            case "Snort":
            case "Snort_Alert": {
                posY = 1.5 + Math.sin(t * 14.0) * 1.5;
                posX = Math.sin(t * 14.0) * 2.2;
                rotDeg = 4.5 + Math.sin(t * 14.0) * 2.5;
                scaleX = 1.02;
                break;
            }
            case "Urinate_Def": {
                posY = -3.0;
                rotDeg = -4.0;
                scaleX = 0.98;
                break;
            }

            // ================= 3. 情绪与社交类 =================
            case "Rear": {
                // 起扬：前身腾空跃起立姿！
                posY = 14.0 + Math.sin(t * 4.5) * 2.5;
                rotDeg = 36.0 + Math.sin(t * 4.5) * 4.0;
                scaleX = 0.94;
                scaleY = 1.08;
                shadowScale = 0.65;
                shadowAlpha = 55;
                break;
            }
            case "Buck": {
                // 尥蹶子：前肢撑地后躯上抛高踹！
                posY = 11.0 + Math.sin(t * 8.0) * 3.5;
                rotDeg = -32.0 + Math.sin(t * 8.0) * 5.5;
                scaleX = 1.06;
                scaleY = 0.96;
                shadowScale = 0.75;
                break;
            }
            case "Neigh":
            case "Head_Toss": {
                // 嘶鸣 / 甩头：马头高扬长嘶
                posY = 4.5 + Math.sin(t * 6.5) * 2.0;
                rotDeg = 22.0 + Math.sin(t * 6.5) * 5.5;
                scaleX = 0.98;
                scaleY = 1.05;
                break;
            }
            case "Paw":
            case "Stamp": {
                // 刨地 / 跺脚
                posY = Math.abs(Math.sin(t * 9.0)) * 2.4;
                rotDeg = Math.sin(t * 9.0) * 3.5;
                posX = Math.sin(t * 9.0) * 2.0;
                break;
            }
            case "Ears_Pinned": {
                rotDeg = -5.0;
                scaleX = 0.96;
                scaleY = 0.98;
                break;
            }
            case "Ears_Forward": {
                rotDeg = 4.0;
                scaleX = 1.02;
                scaleY = 1.02;
                posY = 1.5;
                break;
            }
            case "Bite": {
                posX = 5.5 + Math.sin(t * 9.0) * 3.0;
                rotDeg = -6.0 + Math.sin(t * 9.0) * 4.0;
                break;
            }
            case "Kick": {
                rotDeg = -18.0 + Math.sin(t * 11.0) * 8.0;
                posX = -3.5 + Math.sin(t * 11.0) * 3.5;
                break;
            }
            case "Grooming":
            case "Maternal_Guard": {
                rotDeg = Math.sin(t * 4.0) * 4.5;
                posX = Math.sin(t * 4.0) * 2.5;
                break;
            }

            // ================= 4. 骑乘与竞技类 =================
            case "Start": {
                posY = -3.0;
                rotDeg = 7.0;
                posX = 4.0;
                scaleX = 1.08;
                scaleY = 0.95;
                break;
            }
            case "Finish": {
                // 冲线压线最后一跃
                posY = 3.5;
                rotDeg = 6.0;
                posX = 6.0;
                scaleX = 1.10;
                scaleY = 0.94;
                break;
            }
            case "Jump": {
                const jPhase = (t * 3.0) % Math.PI;
                posY = Math.sin(jPhase) * 16.0;
                rotDeg = Math.cos(jPhase) * 16.0;
                scaleX = 1.05;
                shadowScale = 0.6;
                shadowAlpha = 45;
                break;
            }
            case "Spin": {
                rotDeg = Math.sin(t * 7.0) * 20.0;
                posX = Math.cos(t * 7.0) * 3.5;
                break;
            }
            case "Spook": {
                posY = 7.5 + Math.sin(t * 24.0) * 1.5;
                posX = -6.0;
                rotDeg = 14.0 + Math.sin(t * 24.0) * 2.5;
                scaleX = 0.92;
                shadowScale = 0.8;
                break;
            }

            case "Head_To_Head": {
                // 并驾齐驱激烈对抗：高频极速奔跑，头部压低前探，身体剧烈起伏与小幅对抗微晃
                const phase = t * 19.0;
                posY = Math.sin(phase) * 4.6;
                const basePitch = 6.2;
                rotDeg = basePitch + Math.sin(phase * 0.5) * 3.2 + Math.sin(t * 14.0) * 1.6;
                posX = 4.2 + Math.sin(t * 11.0) * 2.2;
                scaleX = 1.06 + Math.sin(phase) * 0.08;
                scaleY = 0.95 - Math.sin(phase) * 0.06;
                shadowScale = 1.0 - (posY / 4.6) * 0.16;
                shadowAlpha = Math.floor(90 - (posY / 4.6) * 25);
                break;
            }

            case "Stand":
            default: {
                // 轻微温和呼吸待机
                posY = Math.sin(t * 2.5) * 0.9;
                rotDeg = 0;
                scaleX = 1.0 + Math.sin(t * 2.5) * 0.01;
                scaleY = 1.0 - Math.sin(t * 2.5) * 0.01;
                shadowScale = 1.0;
                shadowAlpha = 85;
                break;
            }
        }

        return { posX, posY, rotDeg, scaleX, scaleY, shadowScale, shadowAlpha };
    }
}

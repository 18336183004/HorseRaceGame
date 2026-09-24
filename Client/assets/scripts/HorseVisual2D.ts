import { _decorator, Component, Node, Graphics, Color, Vec3, UITransform, Sprite, SpriteFrame, Label, Layers, tween } from "cc";
import { HorseAssetRegistry, HorseProfile, FoalGrowthStage } from "./HorseAssetRegistry";
import { HorseSprites } from "./HorseSprites";
import { WestColors } from "./WestTheme";
import { WestAudio } from "./WestAudio";
import { WestHaptics } from "./WestHaptics";

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

    private profile: HorseProfile | null = null;
    private horseBodyNode: Node | null = null;
    private shadowNode: Node | null = null;
    private shadowG: Graphics | null = null;
    private saddleNode: Node | null = null;
    private saddleG: Graphics | null = null;
    private horseG: Graphics | null = null;
    private spriteNode: Node | null = null;
    private speedLinesNode: Node | null = null;
    private speedLinesG: Graphics | null = null;

    // 8 帧标准奔跑序列与 2D 竞技骑师
    private jockeyNode: Node | null = null;
    private jockeySprite: Sprite | null = null;
    private gallopHorseFrames: SpriteFrame[] = [];
    private gallopJockeyFrames: SpriteFrame[] = [];
    private currentFrameIndex: number = 0;
    private frameTimer: number = 0;
    private isGallopAnimationLoaded: boolean = false;
    private staticSpriteFrame: SpriteFrame | null = null;

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
        Graze: { id: "Graze", nameZh: "吃草", nameEn: "Graze", category: "Daily", icon: "🌾", description: "低头前伸啃食牧草", isLoop: true, duration: 3.2 },
        Drink: { id: "Drink", nameZh: "饮水", nameEn: "Drink", category: "Daily", icon: "💧", description: "深低头吞咽清水", isLoop: true, duration: 2.8 },
        Stretch: { id: "Stretch", nameZh: "伸懒腰", nameEn: "Stretch", category: "Daily", icon: "🧘", description: "前身深俯伸展，后背反弓", isLoop: false, duration: 2.5 },
        Rub_Scratch: { id: "Rub_Scratch", nameZh: "蹭痒", nameEn: "Rub", category: "Daily", icon: "🪵", description: "靠向围栏侧身蹭痒", isLoop: true, duration: 2.2 },
        Tail_Swish: { id: "Tail_Swish", nameZh: "甩尾", nameEn: "Tail swish", category: "Daily", icon: "🪰", description: "马尾发力左右抽甩驱虫", isLoop: false, duration: 1.8 },
        Shake: { id: "Shake", nameZh: "抖身", nameEn: "Shake", category: "Daily", icon: "💦", description: "全身波浪状剧烈抖动", isLoop: false, duration: 1.6 },
        Snort: { id: "Snort", nameZh: "喷鼻", nameEn: "Snort", category: "Daily", icon: "💨", description: "鼻孔扩大呼气警觉", isLoop: false, duration: 1.2 },
        Urinate_Def: { id: "Urinate_Def", nameZh: "排泄", nameEn: "Urinate", category: "Daily", icon: "🚽", description: "生理代谢与放松", isLoop: false, duration: 2.5 },

        // 三、情绪与社交类 (14 项)
        Neigh: { id: "Neigh", nameZh: "嘶鸣", nameEn: "Neigh", category: "Social", icon: "🎺", description: "仰头长声呼叫同伴", isLoop: false, duration: 2.2 },
        Snort_Alert: { id: "Snort_Alert", nameZh: "打响鼻", nameEn: "Snort Alert", category: "Social", icon: "👃", description: "短促喷气，双耳直竖警觉", isLoop: false, duration: 1.5 },
        Paw: { id: "Paw", nameZh: "刨地", nameEn: "Paw", category: "Social", icon: "🐾", description: "单前蹄节律性刮踏地面", isLoop: true, duration: 2.4 },
        Stamp: { id: "Stamp", nameZh: "跺脚", nameEn: "Stamp", category: "Social", icon: "💥", description: "用力重踏地面表达烦躁", isLoop: false, duration: 1.5 },
        Head_Toss: { id: "Head_Toss", nameZh: "甩头", nameEn: "Head toss", category: "Social", icon: "🙆", description: "头部上下甩动翻飞鬃毛", isLoop: false, duration: 1.8 },
        Ears_Pinned: { id: "Ears_Pinned", nameZh: "耳朵后贴", nameEn: "Ears pinned", category: "Social", icon: "😠", description: "愤怒威吓，防御紧绷", isLoop: true, duration: 2.0 },
        Ears_Forward: { id: "Ears_Forward", nameZh: "耳朵前转", nameEn: "Ears forward", category: "Social", icon: "👀", description: "双耳朝前集中，好奇机敏", isLoop: true, duration: 2.0 },
        Baring_Teeth: { id: "Baring_Teeth", nameZh: "龇牙", nameEn: "Baring teeth", category: "Social", icon: "😬", description: "翻唇露齿威胁试探", isLoop: false, duration: 1.6 },
        Kick: { id: "Kick", nameZh: "踢", nameEn: "Kick", category: "Social", icon: "🥋", description: "后肢向后上方猛力踹击", isLoop: false, duration: 1.6 },
        Buck: { id: "Buck", nameZh: "尥蹶子", nameEn: "Buck", category: "Social", icon: "🤸", description: "双后肢腾空踢起，前体弯弓", isLoop: false, duration: 2.2 },
        Rear: { id: "Rear", nameZh: "起扬", nameEn: "Rear", category: "Social", icon: "⚡", description: "前肢腾空高扬，双后肢立起", isLoop: false, duration: 2.5 },
        Bite: { id: "Bite", nameZh: "咬", nameEn: "Bite", category: "Social", icon: "🦷", description: "探颈快速开合嘴部试探", isLoop: false, duration: 1.4 },
        Grooming: { id: "Grooming", nameZh: "互相理毛", nameEn: "Grooming", category: "Social", icon: "🤝", description: "侧首轻柔啃咬增进社交", isLoop: true, duration: 2.5 },
        Maternal_Guard: { id: "Maternal_Guard", nameZh: "母马护驹", nameEn: "Guard", category: "Social", icon: "🛡️", description: "横向遮挡守护身侧幼驹", isLoop: true, duration: 2.5 },

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
    };

    onLoad() {
        const rootUt = this.node.getComponent(UITransform) || this.node.addComponent(UITransform);
        rootUt.setContentSize(120, 90);
        this.profile = HorseAssetRegistry.getHorseByNo(this.horseNo);
        this.setupVisualNodes();
        this.node.on(Node.EventType.TOUCH_END, this.onTapHorse, this);
    }

    onDestroy() {
        this.node.off(Node.EventType.TOUCH_END, this.onTapHorse, this);
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

        // 触感与拟音
        WestHaptics.tap();
        if (chosen === "Neigh") {
            WestAudio.playHorseNeigh("COMMON");
        } else {
            WestAudio.playHorseSnort("COMMON");
        }

        // 生成向上飘散的爱心与亲密度羁绊气泡
        this.spawnAffectionHeart();
    }

    private onTapHorse(): void {
        // 牧场/马房/幼驹/互动模式下允许手势抚摸交互，比赛进行中不干扰视角
        if (this.isPaddockMode || this.isFoal) {
            this.petHorse();
        }
    }

    /** 生成向上飘浮并渐隐的爱心粒子动画 (Affection Heart FX) */
    private spawnAffectionHeart(): void {
        if (!this.isValid || !this.node || !this.node.isValid) return;

        const heartNode = new Node("AffectionHeart");
        heartNode.layer = this.node.layer;
        this.node.addChild(heartNode);
        const offsetX = (Math.random() - 0.5) * 20;
        heartNode.setPosition(offsetX, 32, 0);

        const ut = heartNode.addComponent(UITransform);
        ut.setContentSize(80, 24);

        const lbl = heartNode.addComponent(Label);
        lbl.fontSize = 13;
        lbl.lineHeight = 16;
        lbl.string = Math.random() > 0.4 ? "❤️ +5" : "✨ +5";
        lbl.color = new Color(245, 60, 90, 255);

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
        this.profile = HorseAssetRegistry.getHorseByNo(this.horseNo);
        this.renderRealisticHorseSilhouette();
        this.renderSaddleCloth();
        this.loadRunningSprite();
    }

    /** 初始化或重置幼驹展示 (编号 1-20, 成长阶段 1-4) */
    public setFoalStage(foalNo: number, stage: FoalGrowthStage) {
        this.isFoal = true;
        this.horseNo = Math.max(1, Math.min(20, foalNo));
        this.foalStage = stage;
        this.profile = HorseAssetRegistry.getHorseByNo(this.horseNo);
        if (this.jockeyNode) {
            this.jockeyNode.active = stage === FoalGrowthStage.RacingPro && !this.isPaddockMode;
        }
        if (this.saddleNode) {
            this.saddleNode.active = stage === FoalGrowthStage.RacingPro;
        }

        // 依据成长阶段缩放尺寸
        let stageScale = 1.0;
        if (stage === FoalGrowthStage.Foal) stageScale = 0.76;
        else if (stage === FoalGrowthStage.Yearling) stageScale = 0.88;
        else if (stage === FoalGrowthStage.Adult) stageScale = 1.0;
        else if (stage === FoalGrowthStage.RacingPro) stageScale = 1.05;
        this.setDisplayScale(stageScale);

        // 载入幼驹对应阶段精灵
        if (this.spriteNode && this.spriteNode.isValid) {
            HorseSprites.applyFoalStage(this.spriteNode, stage, this.horseNo, (sf) => {
                if (!this.isValid || !this.spriteNode || !this.spriteNode.isValid) return;
                this.isSpriteLoaded = true;
                this.staticSpriteFrame = sf;
                const sp = this.spriteNode.getComponent(Sprite) || this.spriteNode.addComponent(Sprite);
                sp.sizeMode = Sprite.SizeMode.CUSTOM;
                sp.spriteFrame = sf;
                const ut = this.spriteNode.getComponent(UITransform);
                if (ut) {
                    ut.setContentSize(56, 46);
                }
                if (this.horseG) this.horseG.clear();
            });
        }
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

    /** 建立可视化节点树结构 */
    private setupVisualNodes() {
        // 1. 地面投射阴影节点 (独立于马体上下起伏，贴地投影)
        this.shadowNode = new Node("GroundShadow");
        this.shadowNode.layer = this.node.layer;
        this.node.addChild(this.shadowNode);
        this.shadowNode.setPosition(0, -14, 0);
        this.shadowNode.addComponent(UITransform).setContentSize(60, 16);
        this.shadowG = this.shadowNode.addComponent(Graphics);
        this.renderShadow(1.0, 85);

        // 2. 主身体容器节点（承载骨骼颠簸起伏、俯仰角与伸缩变形）
        this.horseBodyNode = new Node("RealisticBody");
        this.horseBodyNode.layer = this.node.layer;
        this.node.addChild(this.horseBodyNode);
        this.horseBodyNode.setPosition(0, 0, 0);

        const ut = this.horseBodyNode.addComponent(UITransform);
        ut.setContentSize(60, 44);

        // 矢量备用骨架 Graphics
        this.horseG = this.horseBodyNode.addComponent(Graphics);

        // 3. 真实概念图透明精灵节点 (向右奔跑)
        this.spriteNode = new Node("HorseSprite");
        this.spriteNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.spriteNode);
        this.spriteNode.setPosition(0, 4, 0);
        const sUt = this.spriteNode.addComponent(UITransform);
        sUt.setContentSize(56, 46);

        // 3B. 2D 竞技职业骑师节点 (Jockey Rider)
        this.jockeyNode = new Node("JockeyRider");
        this.jockeyNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.jockeyNode);
        this.jockeyNode.setPosition(0, 4, 0);
        const jUt = this.jockeyNode.addComponent(UITransform);
        jUt.setContentSize(56, 46);
        this.jockeySprite = this.jockeyNode.addComponent(Sprite);
        this.jockeySprite.sizeMode = Sprite.SizeMode.CUSTOM;
        this.jockeyNode.active = !this.isPaddockMode && !this.isFoal;

        // 3C. 冲刺破空风阻线条节点 (Speed Lines)
        this.speedLinesNode = new Node("SpeedLines");
        this.speedLinesNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.speedLinesNode);
        this.speedLinesG = this.speedLinesNode.addComponent(Graphics);

        // 4. 竞技专属鞍布与马号节点 (紧贴马背)
        this.saddleNode = new Node("SaddleCloth");
        this.saddleNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.saddleNode);
        this.saddleNode.setPosition(-4, 3, 0);
        this.saddleNode.addComponent(UITransform).setContentSize(24, 16);
        this.saddleG = this.saddleNode.addComponent(Graphics);

        // 5. 头顶状态与动作交互气泡（仅在牧场/马厩 PaddockMode 下展示互动心情，赛道比赛模式下静默隐藏，保持赛道视觉专注与纯粹）
        this.bubbleNode = new Node("StatusBubble");
        this.bubbleNode.layer = this.node.layer;
        this.node.addChild(this.bubbleNode);
        this.bubbleNode.setPosition(0, 38, 0);
        this.bubbleNode.addComponent(UITransform).setContentSize(120, 24);
        this.bubbleG = this.bubbleNode.addComponent(Graphics);
        this.bubbleNode.active = this.isPaddockMode;

        const lblNode = new Node("BubbleLabel");
        lblNode.layer = this.node.layer;
        this.bubbleNode.addChild(lblNode);
        this.bubbleLabel = lblNode.addComponent(Label);
        this.bubbleLabel.fontSize = 11;
        this.bubbleLabel.lineHeight = 15;
        this.bubbleLabel.color = WestColors.INK_DARK;

        this.renderRealisticHorseSilhouette();
        this.renderSaddleCloth();
        this.loadRunningSprite();
        this.updateBubble();
    }

    /** 载入当前马匹的高精透明 2D 跑道精灵与独有 8 帧标准奔跑序列图集 */
    private loadRunningSprite() {
        if (!this.spriteNode || !this.spriteNode.isValid) return;

        if (this.isFoal) {
            this.setFoalStage(this.horseNo, this.foalStage);
            return;
        }

        // 1. 载入单帧高精展示底图作为保底与待机立绘
        HorseSprites.applyHorseRunningSprite(this.spriteNode, this.horseNo, (sf: SpriteFrame) => {
            if (!this.isValid || !this.spriteNode || !this.spriteNode.isValid) return;
            this.isSpriteLoaded = true;
            this.staticSpriteFrame = sf;
            const sp = this.spriteNode.getComponent(Sprite) || this.spriteNode.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            if (!this.isGallopAnimationLoaded) {
                sp.spriteFrame = sf;
            }
            const ut = this.spriteNode.getComponent(UITransform);
            if (ut) {
                ut.setContentSize(68, 54);
            }
            if (this.horseG) {
                this.horseG.clear();
            }
        });

        // 2. 载入该名驹专属的 8 帧标准奔跑序列帧与骑师彩衣图集 (保证每匹马具备独一无二的毛色、白章与彩衣)
        HorseSprites.loadHorseGallopAnimation(this.horseNo, (hFrames, jFrames) => {
            if (!this.isValid) return;
            this.gallopHorseFrames = hFrames;
            this.gallopJockeyFrames = jFrames;
            this.isGallopAnimationLoaded = hFrames && hFrames.length >= 8;
            if (this.isGallopAnimationLoaded && this.spriteNode) {
                const sp = this.spriteNode.getComponent(Sprite) || this.spriteNode.addComponent(Sprite);
                sp.spriteFrame = this.gallopHorseFrames[0];
                if (this.saddleNode) {
                    this.saddleNode.active = false; // 图集中已自带该马专属彩衣鞍布与缰绳
                }
            }
            if (this.jockeySprite && jFrames && jFrames.length >= 8) {
                this.jockeySprite.spriteFrame = jFrames[0];
                if (this.jockeyNode) {
                    this.jockeyNode.active = !this.isPaddockMode && !this.isFoal;
                }
            }
        });
    }

    /** 绘制地面动态椭圆投影阴影 */
    private renderShadow(scaleX: number = 1.0, alpha: number = 85) {
        if (!this.shadowG) return;
        this.shadowG.clear();
        this.shadowG.fillColor = new Color(20, 10, 5, Math.max(15, Math.min(130, alpha)));
        this.shadowG.ellipse(2, 0, Math.max(10, 22 * scaleX), 6);
        this.shadowG.fill();
    }

    /** 绘制马背上的专业竞技鞍布与马号数字 */
    private renderSaddleCloth() {
        if (!this.saddleG) return;
        this.saddleG.clear();

        // 牧场模式可弱化或保留鞍布
        const silkCol = this.getJockeySilkColor();

        // 鞍布主体底色
        this.saddleG.fillColor = silkCol;
        this.saddleG.roundRect(-8, -5, 16, 11, 2);
        this.saddleG.fill();

        // 烫金镶边
        this.saddleG.strokeColor = new Color(245, 205, 75, 240);
        this.saddleG.lineWidth = 1.2;
        this.saddleG.roundRect(-8, -5, 16, 11, 2);
        this.saddleG.stroke();

        // 鞍布中央清晰白色马号标记点
        this.saddleG.fillColor = Color.WHITE;
        this.saddleG.circle(0, 0, 3.2);
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
        if (this.isSpriteLoaded) return;
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

        // 牧场待机自动行为循环演化 (Auto Paddock Idle Cycle)
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

        // 非循环动作到期后平滑回归待机 (Stand)
        if (!this.isActionLoop && this.actionTimer >= this.actionDuration) {
            this.setAction("Stand", 1.0);
        }

        // 计算当前动作的 2D 动力学位姿
        const pose = this.computeActionPose(this.currentAction, this.animTime);

        // 驱动 8 帧奔跑动画序列
        const isMoving = ["Sprint", "Gallop", "Accelerate", "Canter", "Trot", "Walk"].includes(this.currentAction);
        if (this.isGallopAnimationLoaded && this.gallopHorseFrames.length >= 8 && isMoving) {
            let fps = 14;
            if (this.currentAction === "Sprint") fps = 18;
            else if (this.currentAction === "Canter") fps = 11;
            else if (this.currentAction === "Trot") fps = 8;
            else if (this.currentAction === "Walk") fps = 6;

            this.frameTimer += effectiveDt;
            if (this.frameTimer >= 1.0 / fps) {
                this.frameTimer = 0;
                this.currentFrameIndex = (this.currentFrameIndex + 1) % 8;
                if (this.spriteNode) {
                    const sp = this.spriteNode.getComponent(Sprite);
                    if (sp) sp.spriteFrame = this.gallopHorseFrames[this.currentFrameIndex];
                }
                if (this.jockeySprite && this.gallopJockeyFrames.length >= 8) {
                    this.jockeySprite.spriteFrame = this.gallopJockeyFrames[this.currentFrameIndex];
                }
            }
            if (this.jockeyNode) {
                this.jockeyNode.active = !this.isPaddockMode;
                // 冲刺直道骑师前倾俯压推骑动量 (Jockey Sprint Aero Tuck & Whipping Sway)
                if (this.currentAction === "Sprint") {
                    const whipSway = Math.sin(this.animTime * 22) * 1.5;
                    this.jockeyNode.setPosition(3 + whipSway * 0.4, 2 - whipSway * 0.2, 0);
                    this.jockeyNode.setRotationFromEuler(0, 0, -8 + whipSway * 3.5);
                } else if (this.currentAction === "Accelerate" || this.currentAction === "Gallop") {
                    this.jockeyNode.setPosition(1.5, 3, 0);
                    this.jockeyNode.setRotationFromEuler(0, 0, -3.5);
                } else {
                    this.jockeyNode.setPosition(0, 4, 0);
                    this.jockeyNode.setRotationFromEuler(0, 0, 0);
                }
            }
        } else if (!isMoving) {
            if (this.staticSpriteFrame && this.spriteNode) {
                const sp = this.spriteNode.getComponent(Sprite);
                if (sp && sp.spriteFrame !== this.staticSpriteFrame) {
                    sp.spriteFrame = this.staticSpriteFrame;
                }
            }
            if (this.jockeyNode && this.isPaddockMode) {
                this.jockeyNode.active = false;
            }
        }

        // 应用位移、旋转与拉伸挤压 (结合 viewScale 缩放内部身体容器)
        this.horseBodyNode.setPosition(pose.posX * this.viewScale, pose.posY * this.viewScale, 0);
        this.horseBodyNode.setRotationFromEuler(0, 0, pose.rotDeg);
        this.horseBodyNode.setScale(pose.scaleX * this.viewScale, pose.scaleY * this.viewScale, 1);

        // 地面投影动态联动
        this.renderShadow(pose.shadowScale, pose.shadowAlpha);

        // 冲刺/加速风阻线条动态特效
        this.renderSpeedLines();

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
        if (this.currentAction !== "Sprint" && this.currentAction !== "Accelerate") {
            return;
        }

        const isSprint = this.currentAction === "Sprint";
        const count = isSprint ? 6 : 3;
        const alpha = isSprint ? 190 : 110;
        const seed = Math.sin(this.animTime * 28);

        for (let i = 0; i < count; i++) {
            const lineY = -10 + i * 5.2 + Math.sin(this.animTime * 18 + i * 2) * 2;
            const startX = -24 - (i % 2) * 9 - Math.abs(seed) * 6;
            const len = (isSprint ? 32 : 18) + Math.abs(Math.sin(this.animTime * 14 + i * 3)) * 18;

            const isGold = isSprint && i % 2 === 0;
            HorseVisual2D._reusableSpeedColor.set(
                isGold ? 255 : 235,
                isGold ? 215 : 235,
                isGold ? 80 : 180,
                Math.floor(alpha * (0.6 + 0.4 * Math.random()))
            );
            this.speedLinesG.strokeColor = HorseVisual2D._reusableSpeedColor;
            this.speedLinesG.lineWidth = isSprint ? (isGold ? 2.2 : 1.5) : 1.2;
            this.speedLinesG.moveTo(startX, lineY);
            this.speedLinesG.lineTo(startX - len, lineY + (Math.random() - 0.5) * 1.8);
            this.speedLinesG.stroke();
        }
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
                const freq = action === "Sprint" ? 20.0 : 16.5;
                const phase = t * freq;
                posY = Math.sin(phase) * 4.2;
                const basePitch = action === "Sprint" ? 5.8 : 4.5;
                rotDeg = basePitch + Math.sin(phase * 0.5) * 2.8;
                scaleX = 1.0 + Math.sin(phase) * 0.10;
                scaleY = 1.0 - Math.sin(phase) * 0.08;
                shadowScale = 1.0 - (posY / 4.2) * 0.18;
                shadowAlpha = Math.floor(85 - (posY / 4.2) * 25);
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
            case "Snort": {
                posX = Math.sin(t * 12.0) * 2.5;
                rotDeg = Math.sin(t * 12.0) * 2.0;
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

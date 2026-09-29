/**
 * 2D 赛马竞技场地图与全景跑道系统 (RaceTrack2D)
 *
 * 采用多层 2D 场景分层渲染，提供极具西部沉浸感的全景赛道环境：
 * 1. 远景自然天际线 (Far Scenic Skyline)：红岩峡谷平顶山峦、渐变霞光、翱翔雄鹰；
 * 2. 中景大看台与小镇设施 (Midground Grandstand & Props)：双层橡木观众看台、牛仔观众剪影、迎风三角锦旗、老式风车与储水塔；
 * 3. 动态地表跑道 (Dynamic 2D Terrain Surface)：支持草地 (Turf)、泥地 (Dirt)、细沙 (Sand) 实时换肤；
 * 4. 专业比赛设施 (Pro Racing Facilities)：6 条白灰分道划线、起点 6 联装发令闸门 (带开闸微动效)、终点黑白相间龙门架；
 * 5. 动态竞速特效 (Racing Motion & Atmosphere)：赛跑时漂移的风沙与草屑粒子。
 */

import {
    Color,
    Component,
    Graphics,
    Layers,
    Node,
    UITransform,
    Vec3,
    tween,
    Sprite,
    Label,
    _decorator,
} from "cc";
import { WestColors } from "./WestTheme";
import { HorseSprites } from "./HorseSprites";

export interface HoofSplashParticle {
    x: number;
    y: number;
    vx: number;
    vy: number;
    r: number;
    color: Color;
    alpha: number;
    life: number;
    maxLife: number;
}

/** 统一全场批处理马蹄印数据结构 */
export interface UnifiedHoofprintItem {
    x: number;
    y: number;
    createdAt: number;
    depthScale: number;
}

const { ccclass } = _decorator;

export interface TrackThemePalette {
    surfaceBase: Color;       // 跑道基础底色
    surfaceDeep: Color;       // 压实与阴影色
    chalkLine: Color;         // 分道标线颜色
    fenceWood: Color;         // 围栏木质色
    particleColor: Color;     // 跑道飞尘颗粒色
    nameZh: string;
}

@ccclass("RaceTrack2D")
export class RaceTrack2D extends Component {
    /** 6 道真实 2.5D 透视梯级中心线 Y 坐标与道间划线 Y 坐标 (由上至下/远至近逐渐放宽，呈现空间透视纵深) */
    public static readonly LANE_PERSPECTIVE_Y = [100, 63, 24, -17, -61, -110];
    public static readonly LANE_DIVIDER_Y = [118, 82, 44, 4, -38, -84, -136];
    public static readonly LANE_DEPTH_SCALES = [0.85, 0.90, 0.96, 1.02, 1.08, 1.15];

    public static getLaneY(laneIdx: number): number {
        const safeIdx = Math.max(0, Math.min(5, laneIdx));
        return RaceTrack2D.LANE_PERSPECTIVE_Y[safeIdx] ?? (135 - (laneIdx + 1) * 41);
    }

    public static getLaneDepthScale(laneIdx: number): number {
        const safeIdx = Math.max(0, Math.min(5, laneIdx));
        return RaceTrack2D.LANE_DEPTH_SCALES[safeIdx] ?? 1.0;
    }

    private bgG: Graphics | null = null;
    private surfaceG: Graphics | null = null;
    private fxG: Graphics | null = null;

    // 5. 冲刺特写与电影感画幅暗角层 (Sprint Tension Vignette & Cinematic Letterbox)
    private sprintOverlayNode: Node | null = null;
    private sprintG: Graphics | null = null;
    private sprintBadgeNode: Node | null = null;
    private sprintStreamers: Array<{ x: number; y: number; vx: number; len: number; alpha: number }> = [];
    private sprintAlpha: number = 0;
    private sprintTargetAlpha: number = 0;
    private sprintProgress: number = 0;
    private isSprintActive: boolean = false;

    private gatesContainer: Node | null = null;
    private gateBars: Node[] = [];
    private isGatesOpened = false;

    /** 围栏上方西部实木里程碑牌匾容器 (START, 1/4, HALF, 3/4, FINISH) */
    private milestonesContainer: Node | null = null;

    /** 开闸爆发震屏与音效回调 */
    public onGatesOpened?: () => void;

    private mapWidth = 696;
    private mapHeight = 330;
    private currentTrackType = "Dirt";
    private currentWeather = "Sunny";
    private isRacing = false;

    // 远景全景大图节点
    private scenicTextureNode: Node | null = null;
    private scenicSprite: Sprite | null = null;

    // 地表无缝纹理节点
    private surfaceTextureNode: Node | null = null;
    private surfaceSprite: Sprite | null = null;

    // 统一全场马蹄凹痕批处理图元层 (合批绘制，取代 6 匹马独立 Graphics 减少 DrawCall)
    private hoofprintsBatchG: Graphics | null = null;
    private readonly unifiedHoofprints: UnifiedHoofprintItem[] = [];

    // 动态沙尘微粒与马蹄飞溅粒子（支持零 GC 分配对象池）
    private particles: Array<{ x: number; y: number; vx: number; r: number; alpha: number }> = [];
    private splashes: HoofSplashParticle[] = [];
    private readonly splashPool: HoofSplashParticle[] = [];

    // 马蹄着地微型冲击波环形粒子
    private readonly shockwaves: Array<{ x: number; y: number; r: number; maxR: number; alpha: number; color: Color }> = [];

    // 动态全屏天气系统（持续斜雨/积水波纹/沙暴狂风）
    private weatherDrops: Array<{ x: number; y: number; vx: number; vy: number; len: number; alpha: number }> = [];
    private groundRipples: Array<{ x: number; y: number; r: number; maxR: number; alpha: number }> = [];

    // 西部风滚草物理仿真对象 (Rolling Tumbleweed)
    private tumbleweed: { x: number; y: number; vx: number; rot: number; r: number; bouncePhase: number; active: boolean } = {
        x: -400,
        y: 126,
        vx: 85,
        rot: 0,
        r: 10,
        bouncePhase: 0,
        active: true,
    };
    private tumbleweedTimer: number = 0;

    protected onLoad(): void {
        this.initLayers();
    }

    /** 初始化地图多层渲染节点 */
    private initLayers(): void {
        if (this.bgG) return;

        let trans = this.getComponent(UITransform);
        if (!trans) {
            trans = this.addComponent(UITransform);
        }
        if (trans) {
            trans.setContentSize(this.mapWidth, this.mapHeight);
        }

        // 1. 远景与中景看台底图层
        const bgNode = new Node("Track2D_SkyAndStands");
        bgNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(bgNode);
        bgNode.setPosition(0, 0, 0);
        bgNode.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);

        // 1A. 高清写实西部峡谷全景大图层 (West Ranch Backdrop)
        const scenicNode = new Node("Track2D_ScenicBackdrop");
        scenicNode.layer = bgNode.layer;
        bgNode.addChild(scenicNode);
        const scenicH = 175;
        const scenicY = (this.mapHeight / 2) - (scenicH / 2) - 4;
        scenicNode.setPosition(0, scenicY, 0);
        const sUt = scenicNode.addComponent(UITransform);
        sUt.setContentSize(this.mapWidth - 16, scenicH);
        this.scenicTextureNode = scenicNode;
        this.scenicSprite = scenicNode.addComponent(Sprite);
        this.scenicSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 1B. 远景与看台装饰图元层 (大气光晕/看台挑檐/铜灯/彩旗/飞鹰)
        this.bgG = bgNode.addComponent(Graphics);

        // 2. 跑道无缝地表纹理层 (Seamless Terrain Layer: 完美覆盖 6 条道次，从 Y=118 到 Y=-138)
        const textureNode = new Node("Track2D_TextureSurface");
        textureNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(textureNode);
        const trackTopY = 118;
        const trackBottomY = -138;
        const trackTotalH = trackTopY - trackBottomY;
        const trackCenterY = (trackTopY + trackBottomY) / 2;
        textureNode.setPosition(0, trackCenterY, 0);
        const tUt = textureNode.addComponent(UITransform);
        tUt.setContentSize(this.mapWidth - 20, trackTotalH);
        this.surfaceTextureNode = textureNode;
        this.surfaceSprite = textureNode.addComponent(Sprite);
        this.surfaceSprite.type = Sprite.Type.TILED;
        this.surfaceSprite.sizeMode = Sprite.SizeMode.CUSTOM;

        // 2B. 跑道分道划线与护栏层
        const surfaceNode = new Node("Track2D_LanesSurface");
        surfaceNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(surfaceNode);
        surfaceNode.setPosition(0, 0, 0);
        surfaceNode.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
        this.surfaceG = surfaceNode.addComponent(Graphics);

        // 2C. 统一全场马蹄凹痕批处理图元层 (Batched Hoofprints Layer: 6 匹马全部蹄印单批次绘制)
        const hoofBatchNode = new Node("Track2D_BatchedHoofprints");
        hoofBatchNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(hoofBatchNode);
        hoofBatchNode.setPosition(0, 0, 0);
        hoofBatchNode.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
        this.hoofprintsBatchG = hoofBatchNode.addComponent(Graphics);

        // 2D. 围栏上方西部实木里程碑牌匾层 (START, 1/4, HALF, 3/4, FINISH)
        const milestonesNode = new Node("Track2D_Milestones");
        milestonesNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(milestonesNode);
        milestonesNode.setPosition(0, 0, 0);
        milestonesNode.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
        this.milestonesContainer = milestonesNode;

        // 3. 起跑闸门容器层
        this.gatesContainer = new Node("Track2D_StartingGates");
        this.gatesContainer.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(this.gatesContainer);
        this.gatesContainer.setPosition(0, 0, 0);
        this.gatesContainer.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);

        // 4. 跑道前置动态光影与飞沙层
        const fxNode = new Node("Track2D_MotionFX");
        fxNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(fxNode);
        fxNode.setPosition(0, 0, 0);
        fxNode.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
        this.fxG = fxNode.addComponent(Graphics);

        // 初始化 24 颗环境飞沙/草屑粒子
        this.particles = [];
        for (let i = 0; i < 24; i++) {
            this.particles.push({
                x: -330 + Math.random() * 660,
                y: -120 + Math.random() * 220,
                vx: 30 + Math.random() * 70,
                r: 1.2 + Math.random() * 2.2,
                alpha: 80 + Math.random() * 120,
            });
        }

        // 初始化 36 颗全屏动态天气粒子
        this.weatherDrops = [];
        for (let i = 0; i < 36; i++) {
            this.weatherDrops.push({
                x: -340 + Math.random() * 680,
                y: -140 + Math.random() * 320,
                vx: -80 - Math.random() * 40,
                vy: -420 - Math.random() * 160,
                len: 12 + Math.random() * 14,
                alpha: 130 + Math.random() * 90,
            });
        }

        // 5. 冲刺特写与电影感画幅暗角层 (Sprint Tension Vignette & Cinematic Letterbox)
        const sprintNode = new Node("Track2D_SprintOverlay");
        sprintNode.layer = this.node.layer || Layers.Enum.UI_2D;
        this.node.addChild(sprintNode);
        sprintNode.setPosition(0, 0, 0);
        sprintNode.addComponent(UITransform).setContentSize(this.mapWidth, this.mapHeight);
        this.sprintOverlayNode = sprintNode;
        this.sprintG = sprintNode.addComponent(Graphics);

        // 冲刺专属燃情徽章 (Top Center Sprint Banner)
        const badgeNode = new Node("SprintBannerBadge");
        badgeNode.layer = sprintNode.layer;
        sprintNode.addChild(badgeNode);
        badgeNode.setPosition(0, 142, 0);
        badgeNode.active = false;
        this.sprintBadgeNode = badgeNode;
        const bUt = badgeNode.addComponent(UITransform);
        bUt.setContentSize(240, 26);
        const bg = badgeNode.addComponent(Graphics);
        bg.fillColor = new Color(38, 20, 12, 235);
        bg.roundRect(-110, -13, 220, 26, 6);
        bg.fill();
        bg.strokeColor = WestColors.GOLD_METALLIC;
        bg.lineWidth = 1.4;
        bg.roundRect(-110, -13, 220, 26, 6);
        bg.stroke();

        const bLblNode = new Node("Text");
        bLblNode.layer = badgeNode.layer;
        badgeNode.addChild(bLblNode);
        bLblNode.setPosition(0, 0, 0);
        const bLbl = bLblNode.addComponent(Label);
        bLbl.fontSize = 12;
        bLbl.lineHeight = 14;
        bLbl.isBold = true;
        bLbl.color = WestColors.GOLD_BRIGHT;
        bLbl.string = "🔥 决胜冲刺 · FINAL SPRINT 🔥";

        // 初始化 18 根冲刺极速流光条
        this.sprintStreamers = [];
        for (let i = 0; i < 18; i++) {
            this.sprintStreamers.push({
                x: -350 + Math.random() * 700,
                y: -130 + Math.random() * 260,
                vx: -480 - Math.random() * 260,
                len: 30 + Math.random() * 55,
                alpha: 120 + Math.random() * 110,
            });
        }
    }

    /**
     * 设置 2D 赛道参数并重绘
     * @param width 地图总宽 (如 696)
     * @param height 地图总高 (如 330)
     * @param trackType 赛道类型 (Turf 草地, Dirt 泥地, Sand 细沙)
     * @param weather 天气 (Sunny, Rain, Sandstorm, etc.)
     */
    public setup(width: number, height: number, trackType = "Dirt", weather = "Sunny"): void {
        this.initLayers();
        this.mapWidth = width;
        this.mapHeight = height;
        this.currentTrackType = trackType;
        this.currentWeather = weather;

        this.drawScenicSkyAndStands();
        this.drawLanesSurface();
        this.buildStartingGates();
        this.buildMilestones();
    }

    /** 获取当前赛道地表调色板 */
    public getPalette(): TrackThemePalette {
        const lower = this.currentTrackType.toLowerCase();
        if (lower.includes("turf") || lower.includes("grass") || lower.includes("草")) {
            return {
                surfaceBase: new Color(84, 126, 68, 235),      // 茂密草皮绿
                surfaceDeep: new Color(58, 92, 48, 245),      // 深色割草条纹
                chalkLine: new Color(245, 245, 235, 190),     // 跑道白灰划线
                fenceWood: new Color(248, 245, 235, 240),     // 白木护栏
                particleColor: new Color(135, 185, 95, 140),  // 飞扬草屑
                nameZh: "🌿 绿茵草地赛道",
            };
        }
        if (lower.includes("sand") || lower.includes("沙")) {
            return {
                surfaceBase: new Color(212, 175, 124, 235),   // 金沙黄
                surfaceDeep: new Color(182, 142, 94, 245),    // 深沙阴影
                chalkLine: new Color(255, 248, 230, 200),
                fenceWood: new Color(240, 232, 218, 240),
                particleColor: new Color(235, 205, 155, 160), // 飞舞金沙
                nameZh: "🏖️ 细沙飞扬赛道",
            };
        }
        // 默认 Dirt 泥地赛道
        return {
            surfaceBase: new Color(168, 126, 92, 235),       // 经典西部红泥
            surfaceDeep: new Color(132, 94, 66, 245),        // 压实泥地与车辙
            chalkLine: new Color(250, 245, 235, 190),
            fenceWood: new Color(245, 240, 228, 240),
            particleColor: new Color(210, 175, 135, 150),   // 翻滚尘土
            nameZh: "🏜️ 柯尔特泥地赛道",
        };
    }

    /** 1. 绘制高清西部峡谷全景自然天际线与古典看台设施 */
    private drawScenicSkyAndStands(): void {
        // 载入写实西部全景大图 (涵盖峡谷群峰、日落云霞与远方牧场大看台)
        if (this.scenicTextureNode) {
            HorseSprites.applyImage(this.scenicTextureNode, "textures/west_ranch_bg.jpg", (sf) => {
                if (this.scenicSprite && this.scenicSprite.isValid) {
                    this.scenicSprite.sizeMode = Sprite.SizeMode.CUSTOM;
                }
            });
        }

        const g = this.bgG;
        if (!g) return;
        g.clear();

        const halfW = this.mapWidth / 2;
        const halfH = this.mapHeight / 2;
        const skyBottom = 118;
        const skyTop = halfH;
        const skyHeight = skyTop - skyBottom;

        // --- A. 大气光晕与晨昏色调渲染 (Atmospheric Lighting Overlay) ---
        const isSunset = this.currentWeather.toLowerCase().includes("sunset") || this.currentWeather.toLowerCase().includes("dawn");
        // 柔和天际暖光洗刷
        g.fillColor = isSunset ? new Color(255, 145, 55, 45) : new Color(125, 185, 245, 30);
        g.rect(-halfW + 8, skyBottom, this.mapWidth - 16, skyHeight);
        g.fill();

        // 地平线交界微尘地雾 (Horizon Golden Haze)
        g.fillColor = isSunset ? new Color(255, 195, 115, 80) : new Color(220, 235, 250, 55);
        g.rect(-halfW + 8, skyBottom, this.mapWidth - 16, 15);
        g.fill();

        // 柔和夕阳倾斜光柱 (Sunbeams / God Rays)
        if (isSunset || this.currentWeather.toLowerCase().includes("sunny")) {
            g.fillColor = new Color(255, 240, 195, 14);
            const rayW = 45;
            for (let r = 0; r < 4; r++) {
                const rx = -halfW + 80 + r * 140;
                g.moveTo(rx, skyTop);
                g.lineTo(rx + rayW, skyTop);
                g.lineTo(rx + rayW + 60, skyBottom);
                g.lineTo(rx + 60, skyBottom);
                g.close();
                g.fill();
            }
        }

        // 远方翱翔雄鹰剪影 (Desert Golden Eagle: 弧形大翅与滑翔气流)
        const eagleX = -72;
        const eagleY = skyBottom + 40;
        g.fillColor = new Color(48, 28, 20, 220);
        g.moveTo(eagleX, eagleY);
        g.bezierCurveTo(eagleX - 7, eagleY + 7, eagleX - 16, eagleY + 8, eagleX - 22, eagleY + 3);
        g.bezierCurveTo(eagleX - 14, eagleY + 4, eagleX - 7, eagleY + 1, eagleX, eagleY - 2);
        g.bezierCurveTo(eagleX + 7, eagleY + 1, eagleX + 14, eagleY + 4, eagleX + 22, eagleY + 3);
        g.bezierCurveTo(eagleX + 16, eagleY + 8, eagleX + 7, eagleY + 7, eagleX, eagleY);
        g.close();
        g.fill();

        // --- B. 西部木质观众看台顶棚、横梁与仿古铜灯 (Rustic Grandstand Balcony) ---
        const roofY = skyBottom + 26;

        // 老橡木看台挑檐屋顶主横梁 (Weathered Oak Timber Beam)
        g.fillColor = WestColors.WOOD_DARK;
        g.rect(-halfW + 8, roofY, this.mapWidth - 16, 8);
        g.fill();

        // 屋顶顶部受光金色修边 (Brass Highlight)
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 1.6;
        g.moveTo(-halfW + 8, roofY + 8);
        g.lineTo(halfW - 8, roofY + 8);
        g.stroke();

        // 横梁底部深色雕花阴影 (Timber Underside Shadow)
        g.fillColor = new Color(20, 12, 8, 160);
        g.rect(-halfW + 8, roofY - 2, this.mapWidth - 16, 3);
        g.fill();

        // 支撑立柱与斜撑牛腿 (Timber Corbel Brackets)
        const bracketStep = 75;
        const bracketCount = Math.floor((this.mapWidth - 32) / bracketStep);
        for (let b = 0; b <= bracketCount; b++) {
            const bx = -halfW + 20 + b * bracketStep;
            // 垂直支撑柱
            g.fillColor = new Color(64, 42, 28, 240);
            g.rect(bx - 3, roofY - 14, 6, 14);
            g.fill();
            // 斜撑倒三角牛腿
            g.fillColor = WestColors.WOOD_MEDIUM;
            g.moveTo(bx - 3, roofY);
            g.lineTo(bx - 10, roofY);
            g.lineTo(bx - 3, roofY - 8);
            g.close();
            g.fill();
            g.moveTo(bx + 3, roofY);
            g.lineTo(bx + 10, roofY);
            g.lineTo(bx + 3, roofY - 8);
            g.close();
            g.fill();

            // 挂在每根柱上的古典马车马灯与温暖暖黄色光晕 (Hanging Coach Lantern & Ambient Glow)
            if (b % 2 === 1) {
                const lanternY = roofY - 10;
                // 暖色光晕 (Radial Glow)
                g.fillColor = new Color(255, 210, 80, 50);
                g.circle(bx, lanternY, 14);
                g.fill();
                g.fillColor = new Color(255, 235, 140, 110);
                g.circle(bx, lanternY, 7);
                g.fill();
                // 铜质灯罩与底座
                g.fillColor = WestColors.BRASS_FRAME;
                g.roundRect(bx - 3.5, lanternY - 4.5, 7, 9, 1.5);
                g.fill();
                // 亮黄灯芯
                g.fillColor = new Color(255, 255, 220, 255);
                g.circle(bx, lanternY, 2.0);
                g.fill();

                // 地面柔和暖光微投光斑 (Lantern Ground Ambient Pool)
                g.fillColor = new Color(255, 225, 130, 28);
                g.ellipse(bx, 114, 20, 5);
                g.fill();
            }
        }

        // --- C. 屋檐迎风三角彩旗串 (Festive Western Pennants) ---
        const pennantCount = 28;
        const pennantStep = (this.mapWidth - 36) / pennantCount;
        for (let i = 0; i < pennantCount; i++) {
            const px = -halfW + 18 + i * pennantStep;
            const pColors = [
                WestColors.BANDANA_RED,
                new Color(45, 82, 132, 245),
                WestColors.CREAM,
                WestColors.GOLD_METALLIC,
            ];
            const pColor = pColors[i % pColors.length];

            // 旗面
            g.fillColor = pColor;
            g.moveTo(px, roofY - 1);
            g.lineTo(px + pennantStep - 1, roofY - 1);
            g.lineTo(px + pennantStep / 2, roofY - 9);
            g.close();
            g.fill();

            // 旗面阴影皱褶 (Fold Shadow)
            g.fillColor = new Color(0, 0, 0, 35);
            g.moveTo(px + pennantStep / 2, roofY - 1);
            g.lineTo(px + pennantStep - 1, roofY - 1);
            g.lineTo(px + pennantStep / 2, roofY - 9);
            g.close();
            g.fill();
        }
    }

    /** 2. 绘制 6 条分立的专业跑道地表、草坪割草纹/车辙与分道线 */
    private drawLanesSurface(): void {
        const g = this.surfaceG;
        if (!g) return;
        g.clear();

        const halfW = this.mapWidth / 2;
        const palette = this.getPalette();

        // 跑道总高度涵盖从 Y = 118 往下 6 条道至 Y = -138
        const trackTopY = 118;
        const trackBottomY = -138;
        const trackTotalH = trackTopY - trackBottomY;

        // --- A. 载入真实无缝赛道材质与大底色 ---
        const lower = this.currentTrackType.toLowerCase();
        let texPath = "textures/tracks/dirt_seamless.png";
        if (lower.includes("turf") || lower.includes("grass") || lower.includes("草")) {
            texPath = "textures/tracks/turf_seamless.png";
        } else if (lower.includes("sand") || lower.includes("沙")) {
            texPath = "textures/tracks/sand_seamless.png";
        }
        if (this.surfaceTextureNode) {
            HorseSprites.applyImage(this.surfaceTextureNode, texPath, (sf) => {
                if (this.surfaceSprite && this.surfaceSprite.isValid) {
                    this.surfaceSprite.type = Sprite.Type.TILED;
                }
            });
        }

        g.fillColor = palette.surfaceBase;
        g.roundRect(-halfW + 10, trackBottomY, this.mapWidth - 20, trackTotalH, 8);
        g.fill();

        // --- B. 多地形特殊质感 (割草明暗条纹 / 车辙与沙纹) ---
        const isTurf = this.currentTrackType.toLowerCase().includes("turf") || this.currentTrackType.toLowerCase().includes("草");
        if (isTurf) {
            // 专业草坪交替明暗割草条纹 (Mower Alternating Stripes)
            const stripeW = 34;
            const stripeCount = Math.floor((this.mapWidth - 20) / stripeW);
            for (let s = 0; s < stripeCount; s++) {
                if (s % 2 === 1) {
                    g.fillColor = palette.surfaceDeep;
                    g.rect(-halfW + 10 + s * stripeW, trackBottomY, stripeW, trackTotalH);
                    g.fill();
                }
            }
        } else {
            // 泥地与沙地压实车辙和奔跑蹄痕暗纹 (Dirt / Sand Ruts, 结合 2.5D 透视道次)
            g.fillColor = palette.surfaceDeep;
            for (let r = 0; r < 6; r++) {
                const laneCenterY = RaceTrack2D.getLaneY(r);
                const ds = RaceTrack2D.getLaneDepthScale(r);
                // 上蹄道暗槽
                g.rect(-halfW + 20, laneCenterY - 9 * ds, this.mapWidth - 40, 4.5 * ds);
                // 下蹄道暗槽
                g.rect(-halfW + 20, laneCenterY + 5 * ds, this.mapWidth - 40, 4.5 * ds);
                g.fill();
            }
        }

        // 沿护栏边缘的有机草屑/碎土自然咬合齿 (Organic Border Tufts & Soil Crumbs)
        const tuftStep = 22;
        const tuftCount = Math.floor((this.mapWidth - 24) / tuftStep);
        g.fillColor = isTurf ? new Color(52, 85, 42, 220) : new Color(118, 80, 55, 220);
        for (let t = 0; t <= tuftCount; t++) {
            const tx = -halfW + 14 + t * tuftStep + ((t * 7) % 5);
            // 上边界微锯齿齿纹
            g.moveTo(tx - 3.5, trackTopY);
            g.lineTo(tx, trackTopY - 2.8);
            g.lineTo(tx + 3.5, trackTopY);
            g.close();
            g.fill();
            // 下边界微锯齿齿纹
            g.moveTo(tx - 3.5, trackBottomY);
            g.lineTo(tx, trackBottomY + 2.8);
            g.lineTo(tx + 3.5, trackBottomY);
            g.close();
            g.fill();
        }

        // --- C. 6 条跑道白灰粉质感分道标线 (Chalk Dividers: 呈现 2.5D 深度微透视由细到粗渐变) ---
        g.strokeColor = palette.chalkLine;
        for (let l = 0; l <= 6; l++) {
            const divY = RaceTrack2D.LANE_DIVIDER_Y[l] ?? (135 - l * 41 - 20.5);
            g.lineWidth = 1.0 + (l / 6) * 1.2; // 顶部 1.0px 细线，底部 2.2px 粗线
            g.moveTo(-halfW + 18, divY);
            g.lineTo(halfW - 18, divY);
            g.stroke();
        }

        // 终点线白灰方格标线 (Checkered Finish Line Markings at x = 270)
        const finishX = 270;
        const boxH = 10;
        const numBoxes = Math.floor(trackTotalH / boxH);
        for (let b = 0; b < numBoxes; b++) {
            const boxY = trackBottomY + b * boxH;
            g.fillColor = b % 2 === 0 ? new Color(255, 255, 255, 230) : new Color(40, 40, 40, 200);
            g.rect(finishX - 4, boxY, 8, boxH);
            g.fill();
        }

        // --- D. 跑道上下边缘经典双层白木护栏 (Post & Rail Fence: 2.5D 远小近大立体透视) ---
        // 上护栏 (Y = 118: 远景，横木薄 3.0px，立柱宽 6px)
        this.drawPostAndRailFence(g, -halfW + 10, halfW - 10, 118, palette.fenceWood, 6, 3.0, 18);
        // 下护栏 (Y = -136: 近景，横木厚 4.5px，立柱宽 8px，附带地表柔和阴影)
        this.drawPostAndRailFence(g, -halfW + 10, halfW - 10, -136, palette.fenceWood, 8, 4.5, 24, true);

        // --- E. 边框原木加固围栏 (Grand Arena Outer Frame) ---
        g.strokeColor = WestColors.WOOD_FRAME;
        g.lineWidth = 3.0;
        g.roundRect(-halfW + 8, -this.mapHeight / 2 + 8, this.mapWidth - 16, this.mapHeight - 16, 10);
        g.stroke();
    }

    /** 绘制经典立体 2.5D 高精实木双层横栏与立桩 (Post & Rail Fence, 支持顶边倒角高光与投影) */
    private drawPostAndRailFence(
        g: Graphics,
        startX: number,
        endX: number,
        fenceY: number,
        woodColor: Color,
        postW = 6,
        railH = 3.5,
        postH = 18,
        withShadow = false,
    ): void {
        const totalW = endX - startX;

        // 1. 近景护栏专属底部地表阴影 (Cast Ground Shadow)
        if (withShadow) {
            g.fillColor = new Color(18, 10, 6, 75);
            g.rect(startX, fenceY - 7, totalW, 5);
            g.fill();
            g.fillColor = new Color(18, 10, 6, 35);
            g.rect(startX, fenceY - 9, totalW, 2);
            g.fill();
        }

        // 2. 双层横梁 (Upper Rail & Lower Rail, 具顶边高光与底边投影)
        const railsY = [fenceY + railH + 2, fenceY - 1];
        for (const ry of railsY) {
            // A. 横梁核心原木色
            g.fillColor = woodColor;
            g.rect(startX, ry, totalW, railH);
            g.fill();

            // B. 横梁顶部受光倒角高光 (Sunlight Chamfer Highlight)
            g.fillColor = new Color(
                Math.min(255, woodColor.r + 35),
                Math.min(255, woodColor.g + 30),
                Math.min(255, woodColor.b + 25),
                220
            );
            g.rect(startX, ry + railH - 0.8, totalW, 0.8);
            g.fill();

            // C. 横梁底部原木背阴暗纹 (Underside Shadow Crease)
            g.fillColor = new Color(
                Math.max(0, woodColor.r - 55),
                Math.max(0, woodColor.g - 50),
                Math.max(0, woodColor.b - 45),
                190
            );
            g.rect(startX, ry, totalW, 0.8);
            g.fill();
        }

        // 3. 竖立桩柱 (3D Timber Posts 带立体倒角棱面与金属锁栓)
        const postStep = 44;
        const postCount = Math.floor(totalW / postStep);
        const halfPW = postW / 2;

        for (let p = 0; p <= postCount; p++) {
            const px = startX + p * postStep;
            const pTopY = fenceY + postH - 4;
            const pBotY = fenceY - railH - 3;
            const curH = pTopY - pBotY;

            // 柱身底色
            g.fillColor = new Color(
                Math.max(0, woodColor.r - 30),
                Math.max(0, woodColor.g - 28),
                Math.max(0, woodColor.b - 25),
                woodColor.a
            );
            g.rect(px - halfPW, pBotY, postW, curH);
            g.fill();

            // 柱身左侧高光棱线 (Left Bevel)
            g.fillColor = new Color(
                Math.min(255, woodColor.r + 25),
                Math.min(255, woodColor.g + 22),
                Math.min(255, woodColor.b + 18),
                180
            );
            g.rect(px - halfPW, pBotY, 1.2, curH);
            g.fill();

            // 柱顶屋脊状倒角削尖帽 (Chamfered Timber Cap)
            g.fillColor = new Color(
                Math.min(255, woodColor.r + 40),
                Math.min(255, woodColor.g + 35),
                Math.min(255, woodColor.b + 30),
                woodColor.a
            );
            g.moveTo(px - halfPW, pTopY);
            g.lineTo(px, pTopY + 2.5);
            g.lineTo(px + halfPW, pTopY);
            g.close();
            g.fill();

            // 铆接金属垫片与铁钉 (Iron Carriage Bolt)
            g.fillColor = new Color(42, 32, 26, 230);
            g.circle(px, fenceY + railH + 2 + railH / 2, 1.0);
            g.circle(px, fenceY - 1 + railH / 2, 1.0);
            g.fill();
        }
    }

    /** 3. 构建 6 联装老西部专业起跑门架 (Starting Gates 1~6) 与开闸动效 */
    private buildStartingGates(): void {
        if (!this.gatesContainer) return;
        this.gatesContainer.destroyAllChildren();
        this.gateBars = [];
        this.isGatesOpened = false;

        const gateStartX = -272; // 与赛跑起点 -270 对齐

        // A. 顶部贯穿 6 闸的铸铁联动门楣桁架 (Overhead Gantry Crossbeam)
        const trussNode = new Node("StartingGate_OverheadTruss");
        trussNode.layer = this.gatesContainer.layer || Layers.Enum.UI_2D;
        this.gatesContainer.addChild(trussNode);
        trussNode.setPosition(gateStartX, -10, 0);
        const tg = trussNode.addComponent(Graphics);
        // 主铸铁横梁 (贯通 Y: 118 至 Y: -138 全高 256px)
        tg.fillColor = new Color(38, 28, 22, 245);
        tg.rect(-10, -135, 14, 260);
        tg.fill();
        tg.strokeColor = WestColors.BRASS_FRAME;
        tg.lineWidth = 1.4;
        tg.rect(-10, -135, 14, 260);
        tg.stroke();

        // 铸铁铆钉与横向加固筋条
        for (let s = 0; s < 7; s++) {
            const sy = RaceTrack2D.LANE_DIVIDER_Y[s] ?? (120 - s * 41);
            tg.fillColor = WestColors.LEATHER_DARK;
            tg.rect(-12, sy - 2, 18, 4);
            tg.fill();
            tg.fillColor = WestColors.GOLD_METALLIC;
            tg.circle(-7, sy, 1.2);
            tg.circle(1, sy, 1.2);
            tg.fill();
        }

        // B. 6 联装独立发令闸位 (Stalls 1 ~ 6)
        for (let i = 0; i < 6; i++) {
            const laneY = RaceTrack2D.getLaneY(i);
            const ds = RaceTrack2D.getLaneDepthScale(i);
            const gateNode = new Node(`Gate_${i + 1}`);
            gateNode.layer = this.gatesContainer.layer || Layers.Enum.UI_2D;
            this.gatesContainer.addChild(gateNode);
            gateNode.setPosition(gateStartX, laneY, 0);

            const g = gateNode.addComponent(Graphics);

            const stallH = 34 + i * 2.8;
            const halfH = stallH / 2;

            // 发令闸老橡木立柱框架与交叉钢桁架 (Oak Frame with X-Truss)
            g.fillColor = WestColors.WOOD_DARK;
            g.roundRect(-8 * ds, -halfH, 16 * ds, stallH, 2);
            g.fill();
            g.strokeColor = WestColors.BRASS_FRAME;
            g.lineWidth = 1.2;
            g.roundRect(-8 * ds, -halfH, 16 * ds, stallH, 2);
            g.stroke();

            // 侧边交叉木纹支撑 (X-Bracing)
            g.strokeColor = new Color(20, 14, 10, 180);
            g.lineWidth = 1.0;
            g.moveTo(-6 * ds, -halfH + 2);
            g.lineTo(6 * ds, halfH - 2);
            g.moveTo(-6 * ds, halfH - 2);
            g.lineTo(6 * ds, -halfH + 2);
            g.stroke();

            // 发令门号徽章 (黄色黄铜双层圆盘徽章 + 黑色凹刻数字)
            const badgeY = halfH - 4;
            g.fillColor = WestColors.GOLD_METALLIC;
            g.circle(0, badgeY, 8.5 * ds);
            g.fill();
            g.strokeColor = WestColors.LEATHER_DARK;
            g.lineWidth = 1.3;
            g.circle(0, badgeY, 8.5 * ds);
            g.stroke();
            // 内圈金环
            g.strokeColor = new Color(255, 245, 200, 220);
            g.lineWidth = 0.8;
            g.circle(0, badgeY, 6.8 * ds);
            g.stroke();

            // 闸门清晰道次编号数字标签
            const numNode = new Node(`GateNum_${i + 1}`);
            numNode.layer = gateNode.layer;
            gateNode.addChild(numNode);
            numNode.setPosition(0, badgeY, 0);
            const numLbl = numNode.addComponent(Label);
            numLbl.fontSize = Math.round(11 * ds);
            numLbl.lineHeight = Math.round(12 * ds);
            numLbl.isBold = true;
            numLbl.color = WestColors.INK_DARK;
            numLbl.string = `${i + 1}`;

            // 起跑前挡门横梁（带旋转铰链锚点，开闸时向上或向前翻开）
            const barNode = new Node(`Bar_${i + 1}`);
            barNode.layer = gateNode.layer;
            gateNode.addChild(barNode);
            barNode.setPosition(6 * ds, 0, 0);
            const barG = barNode.addComponent(Graphics);

            // 红白相间警示斜条纹挡门 (Red & White Hazard Barrier)
            barG.fillColor = WestColors.BANDANA_RED;
            barG.roundRect(0, -halfH + 2, 6 * ds, stallH - 4, 1.5);
            barG.fill();
            barG.strokeColor = WestColors.BRASS_FRAME;
            barG.lineWidth = 1.0;
            barG.roundRect(0, -halfH + 2, 6 * ds, stallH - 4, 1.5);
            barG.stroke();

            // 白色斜纹
            barG.strokeColor = Color.WHITE;
            barG.lineWidth = 1.6;
            for (let w = -halfH + 4; w <= halfH - 4; w += 6) {
                barG.moveTo(0, w);
                barG.lineTo(6 * ds, w + 4);
                barG.stroke();
            }

            this.gateBars.push(barNode);
        }
    }

    /** 构建上方白木护栏处的西部实木里程碑挂牌 (START, 1/4, HALF, 3/4, FINISH) */
    private buildMilestones(): void {
        if (!this.milestonesContainer) return;
        this.milestonesContainer.destroyAllChildren();

        const markers = [
            { x: -270, label: "START", color: WestColors.BANDANA_RED },
            { x: -135, label: "1/4", color: WestColors.WOOD_DARK },
            { x: 0, label: "HALF", color: WestColors.WOOD_DARK },
            { x: 135, label: "3/4", color: WestColors.WOOD_DARK },
            { x: 270, label: "FINISH", color: WestColors.GOLD_METALLIC },
        ];

        const railY = 126;

        for (const m of markers) {
            const mNode = new Node(`Milestone_${m.label}`);
            mNode.layer = this.milestonesContainer.layer || Layers.Enum.UI_2D;
            this.milestonesContainer.addChild(mNode);
            mNode.setPosition(m.x, railY, 0);

            const g = mNode.addComponent(Graphics);

            // 1. 悬挂铁链 (Iron Hanging Links)
            g.strokeColor = new Color(50, 40, 32, 230);
            g.lineWidth = 1.2;
            // 左链条
            g.moveTo(-10, 8);
            g.lineTo(-10, 16);
            g.stroke();
            // 右链条
            g.moveTo(10, 8);
            g.lineTo(10, 16);
            g.stroke();

            // 2. 实木标牌雕花底板 (Carved Timber Plaque with Brass Trim)
            g.fillColor = m.color;
            g.roundRect(-20, -9, 40, 18, 4);
            g.fill();
            g.strokeColor = WestColors.BRASS_FRAME;
            g.lineWidth = 1.4;
            g.roundRect(-20, -9, 40, 18, 4);
            g.stroke();

            // 四角黄铜角码固定铆钉 (Brass Corner Rivets)
            g.fillColor = WestColors.GOLD_METALLIC;
            g.circle(-16, -6, 1.2);
            g.circle(16, -6, 1.2);
            g.circle(-16, 6, 1.2);
            g.circle(16, 6, 1.2);
            g.fill();

            const lblNode = new Node("Text");
            lblNode.layer = mNode.layer;
            mNode.addChild(lblNode);
            lblNode.setPosition(0, 0, 0);
            const lbl = lblNode.addComponent(Label);
            lbl.fontSize = 10;
            lbl.lineHeight = 12;
            lbl.isBold = true;
            lbl.color = m.color === WestColors.GOLD_METALLIC ? WestColors.INK_DARK : WestColors.CREAM;
            lbl.string = m.label;
        }
    }

    /** 触发开闸瞬间动画（起跑挡板猛烈弹开并激荡爆发飞沙） */
    public openStartingGates(): void {
        if (this.isGatesOpened) return;
        this.isGatesOpened = true;
        this.isRacing = true;

        (this.gateBars ?? []).forEach((bar, idx) => {
            if (!bar || !bar.isValid) return;
            tween(bar)
                .delay(idx * 0.02)
                .to(0.18, { scale: new Vec3(1.2, 0.1, 1), position: new Vec3(8, 14, 0) }, { easing: "backOut" })
                .start();
        });

        // 6 联装发令闸门前瞬间爆发起步沙浪
        const gateStartX = -272;
        for (let i = 0; i < 6; i++) {
            const laneY = RaceTrack2D.getLaneY(i);
            const ds = RaceTrack2D.getLaneDepthScale(i);
            this.emitHoofImpact(gateStartX, laneY, 2.0, ds);
        }

        // 触发开闸瞬间相机震动与枪响反馈
        this.onGatesOpened?.();
    }

    /** 重置起跑闸门为闭合锁止状态 */
    public resetStartingGates(): void {
        this.isGatesOpened = false;
        this.isRacing = false;
        (this.gateBars ?? []).forEach((bar) => {
            if (!bar || !bar.isValid) return;
            bar.setScale(new Vec3(1, 1, 1));
            bar.setPosition(new Vec3(4, 0, 0));
        });
        if (this.fxG) {
            this.fxG.clear();
        }
    }

    /** 设置是否处于赛跑冲刺阶段（激活跑道流光与扬尘微粒） */
    public setRacing(racing: boolean): void {
        this.isRacing = racing;
        if (racing && !this.isGatesOpened) {
            this.openStartingGates();
        } else if (!racing) {
            this.resetStartingGates();
            this.setSprintProgress(0);
        }
    }

    /**
     * 实时设置冲刺特写进度 (0.0 ~ 1.0)
     * 当赛程进入最后 30% 冲刺阶段 (>= 0.70) 时，激活电影级特写暗角、冲刺光效与速度流光
     */
    public setSprintProgress(leaderProgress: number, _leaderLaneX?: number): void {
        this.sprintProgress = leaderProgress;
        if (leaderProgress >= 0.70 && leaderProgress < 0.98) {
            this.isSprintActive = true;
            this.sprintTargetAlpha = Math.min(1.0, (leaderProgress - 0.70) / 0.12);
            if (this.sprintBadgeNode && !this.sprintBadgeNode.active) {
                this.sprintBadgeNode.active = true;
                this.sprintBadgeNode.setScale(new Vec3(0.6, 0.6, 1));
                tween(this.sprintBadgeNode)
                    .to(0.28, { scale: new Vec3(1.0, 1.0, 1) }, { easing: "backOut" })
                    .start();
            }
        } else {
            this.sprintTargetAlpha = 0;
            if (this.sprintAlpha <= 0.05) {
                this.isSprintActive = false;
                if (this.sprintBadgeNode && this.sprintBadgeNode.active) {
                    this.sprintBadgeNode.active = false;
                }
            }
        }
    }

    /** 添加全场统一批处理马蹄印 (减少 6 匹马独立组件开销) */
    public addUnifiedHoofprint(x: number, y: number, createdAt: number, depthScale = 1.0): void {
        this.unifiedHoofprints.push({ x, y, createdAt, depthScale });
    }

    /** 清空全场马蹄凹痕 */
    public clearUnifiedHoofprints(): void {
        this.unifiedHoofprints.length = 0;
        if (this.hoofprintsBatchG && this.hoofprintsBatchG.isValid) {
            this.hoofprintsBatchG.clear();
        }
    }

    private allocSplash(): HoofSplashParticle {
        return this.splashPool.pop() || {
            x: 0,
            y: 0,
            vx: 0,
            vy: 0,
            r: 0,
            color: new Color(0, 0, 0, 255),
            alpha: 255,
            life: 0,
            maxLife: 1,
        };
    }

    private freeSplash(p: HoofSplashParticle): void {
        if (this.splashPool.length < 160) {
            this.splashPool.push(p);
        }
    }

    /**
     * 接收马匹实际踏地事件，在马蹄精确着力点爆发飞溅泥沙/草屑与粉尘抛物线
     * @param posX 马蹄踏地绝对 X 坐标 (如 -270 ~ 270)
     * @param laneY 该马所在跑道中心 Y 坐标
     * @param intensity 冲刺受力强度倍率
     * @param depthScale 2.5D 深度透视缩放比 (0.93 ~ 1.07)
     */
    public emitHoofImpact(posX: number, laneY: number, intensity: number = 1.0, depthScale: number = 1.0): void {
        if (!this.isRacing) return;
        const trackLower = this.currentTrackType.toLowerCase();
        const weatherLower = this.currentWeather.toLowerCase();

        const isTurf = trackLower.includes("turf") || trackLower.includes("草");
        const isSand = trackLower.includes("sand") || trackLower.includes("沙");
        const isRainy = weatherLower.includes("rain") || weatherLower.includes("雨") || weatherLower.includes("mud");
        const isSnow = weatherLower.includes("snow") || weatherLower.includes("雪");

        const palette = this.getPalette();

        // 触发微型着地冲击波 (Ground Shockwave)
        if (this.shockwaves.length < 16) {
            this.shockwaves.push({
                x: posX,
                y: laneY - 4 * depthScale,
                r: 2 * depthScale,
                maxR: (8 + intensity * 2.5) * depthScale,
                alpha: 150,
                color: palette.particleColor,
            });
        }

        const count = Math.floor((3 + Math.random() * 4) * intensity);
        for (let k = 0; k < count; k++) {
            let col: Color;
            let radius = (1.5 + Math.random() * 2.2) * depthScale;
            let maxLife = 0.36 + Math.random() * 0.24;

            if (isSnow) {
                // 雪地扬起洁白冰晶碎雪与淡蓝微粒
                col = Math.random() > 0.3
                    ? new Color(245, 248, 255, 245)
                    : new Color(210, 230, 255, 230);
                radius = (1.2 + Math.random() * 1.8) * depthScale;
                maxLife = 0.42 + Math.random() * 0.22;
            } else if (isRainy) {
                // 雨天泥泞深褐色沉重湿泥浆
                col = Math.random() > 0.4
                    ? new Color(52, 34, 20, 250)
                    : new Color(78, 48, 26, 245);
                radius = (2.0 + Math.random() * 2.4) * depthScale;
            } else if (isTurf) {
                // 绿茵草屑与黑色草根泥
                col = Math.random() > 0.4
                    ? new Color(48, 128, 42, 245)
                    : new Color(75, 48, 28, 245);
            } else if (isSand) {
                // 干燥细沙与暖金扬尘
                col = new Color(225 + Math.floor(Math.random() * 25), 185 + Math.floor(Math.random() * 35), 115, 235);
            } else {
                // 经典红土泥地
                col = new Color(135 + Math.floor(Math.random() * 35), 75 + Math.floor(Math.random() * 25), 45, 245);
            }

            const p = this.allocSplash();
            p.x = posX + (Math.random() * 8 - 4) * depthScale;
            p.y = laneY + (Math.random() * 6 - 3) * depthScale;
            p.vx = (-95 - Math.random() * 120) * depthScale; // 强烈向后喷射
            p.vy = (32 + Math.random() * 70) * depthScale;   // 向上抛起
            p.r = radius;
            p.color.set(col.r, col.g, col.b, col.a);
            p.alpha = 240;
            p.life = 0;
            p.maxLife = maxLife;
            this.splashes.push(p);
        }

        // 雨天额外触发 2-3 颗晶莹水雾微滴
        if (isRainy) {
            const waterDrops = Math.floor(2 + Math.random() * 2);
            for (let w = 0; w < waterDrops; w++) {
                const wp = this.allocSplash();
                wp.x = posX + (Math.random() * 6 - 3) * depthScale;
                wp.y = laneY + (Math.random() * 4 - 2) * depthScale;
                wp.vx = (-110 - Math.random() * 100) * depthScale;
                wp.vy = (45 + Math.random() * 80) * depthScale;
                wp.r = (1.0 + Math.random() * 1.4) * depthScale;
                wp.color.set(195, 220, 250, 210);
                wp.alpha = 210;
                wp.life = 0;
                wp.maxLife = 0.28 + Math.random() * 0.16;
                this.splashes.push(wp);
            }
        }
    }

    private static readonly _tempParticleColor = new Color(0, 0, 0, 255);
    private static readonly _tempRainColor = new Color(210, 225, 245, 140);
    private static readonly _tempStormColor = new Color(225, 185, 125, 80);
    private static readonly _tempSplashColor = new Color(0, 0, 0, 255);

    /** 每帧更新赛道飞沙粒子、全屏天气与竞技氛围 */
    protected update(dt: number): void {
        // 驱动统一合批马蹄印渲染 (即便比赛结束仍继续渐隐 3 秒)
        this.updateBatchedHoofprints(Date.now());

        if (!this.fxG) return;
        this.fxG.clear();

        const palette = this.getPalette();
        const halfW = this.mapWidth / 2;

        // 1. 常驻流动跑道微尘与环境浮粒 (保持赛场生机活力)
        (this.particles ?? []).forEach((p) => {
            const speedMul = this.isRacing ? 2.2 : 0.8;
            p.x += p.vx * dt * speedMul;
            if (p.x > halfW - 20) {
                p.x = -halfW + 20 + Math.random() * 40;
                p.y = -120 + Math.random() * 220;
            }

            RaceTrack2D._tempParticleColor.set(
                palette.particleColor.r,
                palette.particleColor.g,
                palette.particleColor.b,
                Math.floor(p.alpha * (this.isRacing ? 0.75 : 0.45)),
            );
            this.fxG!.fillColor = RaceTrack2D._tempParticleColor;
            this.fxG!.circle(p.x, p.y, p.r);
            this.fxG!.fill();
        });

        // 2. 动态全屏天气与赛道环境物理层 (Rain 雨丝+积水涟漪 / Sandstorm 飞沙狂风)
        const weatherLower = this.currentWeather.toLowerCase();
        const isRain = weatherLower.includes("rain") || weatherLower.includes("雨");
        const isSand = weatherLower.includes("sand") || weatherLower.includes("storm") || weatherLower.includes("沙");

        if (isRain) {
            // A. 斜落动态雨丝 (连续速度模拟)
            this.fxG.strokeColor = RaceTrack2D._tempRainColor;
            this.fxG.lineWidth = 1.2;
            for (const drop of this.weatherDrops) {
                drop.x += drop.vx * dt;
                drop.y += drop.vy * dt;

                // 触碰地面 (Y <= -136) 产生积水波纹并重置到顶部
                if (drop.y <= -136) {
                    if (this.groundRipples.length < 24) {
                        this.groundRipples.push({
                            x: drop.x,
                            y: -136 + Math.random() * 250,
                            r: 1.5,
                            maxR: 5.5 + Math.random() * 4.0,
                            alpha: 160,
                        });
                    }
                    drop.y = 150 + Math.random() * 30;
                    drop.x = -halfW + 30 + Math.random() * (this.mapWidth - 40);
                }

                this.fxG.moveTo(drop.x, drop.y);
                this.fxG.lineTo(drop.x - 7, drop.y - drop.len);
                this.fxG.stroke();
            }

            // B. 跑道地面积水扩散波纹 (Ground Splash Ripples)
            for (let rIdx = this.groundRipples.length - 1; rIdx >= 0; rIdx--) {
                const rip = this.groundRipples[rIdx];
                rip.r += dt * 9.0;
                rip.alpha -= dt * 220;
                if (rip.alpha <= 0 || rip.r >= rip.maxR) {
                    this.groundRipples.splice(rIdx, 1);
                    continue;
                }
                const a = Math.floor(Math.max(0, rip.alpha));
                RaceTrack2D._tempRainColor.a = a;
                this.fxG.strokeColor = RaceTrack2D._tempRainColor;
                this.fxG.lineWidth = 0.9;
                // 绘制压扁的透视水圈 (椭圆)
                this.fxG.ellipse(rip.x, rip.y, rip.r * 1.8, rip.r * 0.7);
                this.fxG.stroke();
            }
        } else if (isSand) {
            // 沙暴呼啸狂风与卷云气流
            this.fxG.strokeColor = RaceTrack2D._tempStormColor;
            this.fxG.lineWidth = 2.2;
            for (const drop of this.weatherDrops) {
                drop.x += (280 + Math.random() * 120) * dt;
                drop.y += Math.sin(drop.x * 0.05) * 12 * dt;
                if (drop.x > halfW) {
                    drop.x = -halfW - 20;
                    drop.y = -130 + Math.random() * 260;
                }
                this.fxG.moveTo(drop.x, drop.y);
                this.fxG.lineTo(drop.x + 38 + Math.random() * 25, drop.y + (Math.random() - 0.5) * 3);
                this.fxG.stroke();
            }
        }

        // 3. 西部标志性风滚草物理滚动与自然弹跳仿真 (Rolling Tumbleweed)
        this.tumbleweedTimer += dt;
        if (this.tumbleweed.active) {
            const tw = this.tumbleweed;
            tw.x += tw.vx * dt;
            tw.rot += (tw.vx / tw.r) * dt;
            tw.bouncePhase += dt * 5.2;
            const bounceH = Math.abs(Math.sin(tw.bouncePhase)) * 12;
            const currentY = tw.y + bounceH;

            // 绘制风滚草地表柔和阴影
            this.fxG.fillColor = new Color(20, 12, 8, 45);
            const shadowScale = Math.max(0.5, 1.0 - bounceH / 20);
            this.fxG.ellipse(tw.x, tw.y - 4, tw.r * shadowScale, tw.r * 0.35 * shadowScale);
            this.fxG.fill();

            // 绘制干草团交错枝条 (Tangled Brush Branches)
            this.fxG.strokeColor = new Color(175, 135, 88, 220);
            this.fxG.lineWidth = 1.2;
            const branches = 6;
            for (let b = 0; b < branches; b++) {
                const ang = tw.rot + (b * Math.PI * 2) / branches;
                const cosA = Math.cos(ang);
                const sinA = Math.sin(ang);
                this.fxG.moveTo(tw.x, currentY);
                this.fxG.lineTo(tw.x + cosA * tw.r, currentY + sinA * tw.r * 0.85);
                this.fxG.stroke();
                // 侧枝小刺
                this.fxG.moveTo(tw.x + cosA * tw.r * 0.6, currentY + sinA * tw.r * 0.5);
                this.fxG.lineTo(tw.x + cosA * tw.r * 0.85 - sinA * 3, currentY + sinA * tw.r * 0.7 + cosA * 3);
                this.fxG.stroke();
            }
            // 外圈毛糙轮廓
            this.fxG.circle(tw.x, currentY, tw.r * 0.9);
            this.fxG.stroke();

            // 滚出屏幕右侧后进入休眠冷却，随机重新从左侧吹出
            if (tw.x > halfW + 40) {
                tw.active = false;
                this.tumbleweedTimer = 0;
            }
        } else {
            // 每 12~18 秒吹过一颗风滚草
            if (this.tumbleweedTimer > 14 + Math.random() * 6) {
                this.tumbleweed.active = true;
                this.tumbleweed.x = -halfW - 30;
                this.tumbleweed.y = 120 + Math.random() * 10;
                this.tumbleweed.vx = 70 + Math.random() * 45;
                this.tumbleweed.r = 8 + Math.random() * 4;
                this.tumbleweed.bouncePhase = 0;
            }
        }

        // 4. 动态冲刺特写与电影感画幅暗角 (Sprint Tension Vignette & Letterbox FX)
        this.updateSprintOverlay(dt);

        // 5. 比赛专属剧烈动态特效 (仅比赛中生效：踏地冲击波、飞溅泥浆)
        if (!this.isRacing) return;

        // 5A. 渲染马蹄踏地冲击波 (Shockwaves)
        for (let sIdx = this.shockwaves.length - 1; sIdx >= 0; sIdx--) {
            const sw = this.shockwaves[sIdx];
            sw.r += dt * 26;
            sw.alpha -= dt * 450;
            if (sw.alpha <= 0 || sw.r >= sw.maxR) {
                this.shockwaves.splice(sIdx, 1);
                continue;
            }
            RaceTrack2D._tempParticleColor.set(sw.color.r, sw.color.g, sw.color.b, Math.floor(sw.alpha));
            this.fxG.strokeColor = RaceTrack2D._tempParticleColor;
            this.fxG.lineWidth = 1.0;
            this.fxG.ellipse(sw.x, sw.y, sw.r * 1.4, sw.r * 0.55);
            this.fxG.stroke();
        }

        // 5B. 更新并渲染飞溅泥点 (带重力下落与阻力减速，基于对象池零 GC 回收)
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const sp = this.splashes[i];
            sp.life += dt;
            if (sp.life >= sp.maxLife) {
                this.splashes.splice(i, 1);
                this.freeSplash(sp);
                continue;
            }
            sp.x += sp.vx * dt;
            sp.y += sp.vy * dt;
            sp.vy -= 220 * dt; // 重力加速度
            sp.vx *= 0.94;     // 空气阻力
            const fade = 1.0 - (sp.life / sp.maxLife);
            const a = Math.floor(sp.alpha * fade);

            RaceTrack2D._tempSplashColor.set(sp.color.r, sp.color.g, sp.color.b, a);
            this.fxG.fillColor = RaceTrack2D._tempSplashColor;
            this.fxG.circle(sp.x, sp.y, sp.r * (0.8 + 0.4 * fade));
            this.fxG.fill();
        }
    }

    /** 渲染冲刺特写画幅遮罩、动态边缘暗角与极速掠影流光 */
    private updateSprintOverlay(dt: number): void {
        if (!this.sprintG) return;
        this.sprintG.clear();

        // 平滑渐显/渐隐暗角
        const speed = this.sprintTargetAlpha > this.sprintAlpha ? 3.0 : 2.5;
        this.sprintAlpha += (this.sprintTargetAlpha - this.sprintAlpha) * Math.min(1.0, dt * speed);

        if (this.sprintAlpha <= 0.01) {
            return;
        }

        const halfW = this.mapWidth / 2;
        const halfH = this.mapHeight / 2;
        const a = this.sprintAlpha;

        // 1. 顶部与底部电影感微遮幅 (Cinematic Letterbox Bars with Gold Accent)
        const barH = 16 * a;
        this.sprintG.fillColor = new Color(15, 9, 6, Math.floor(180 * a));
        // 顶遮幅
        this.sprintG.rect(-halfW, halfH - barH, this.mapWidth, barH);
        this.sprintG.fill();
        // 底遮幅
        this.sprintG.rect(-halfW, -halfH, this.mapWidth, barH);
        this.sprintG.fill();

        // 顶底金边细线
        this.sprintG.strokeColor = new Color(241, 196, 15, Math.floor(190 * a));
        this.sprintG.lineWidth = 1.0;
        this.sprintG.moveTo(-halfW, halfH - barH);
        this.sprintG.lineTo(halfW, halfH - barH);
        this.sprintG.moveTo(-halfW, -halfH + barH);
        this.sprintG.lineTo(halfW, -halfH + barH);
        this.sprintG.stroke();

        // 2. 左右两侧柔和冲刺暗角 (Side Tension Vignette)
        const vigW = 48 * a;
        this.sprintG.fillColor = new Color(15, 9, 6, Math.floor(95 * a));
        this.sprintG.rect(-halfW, -halfH, vigW, this.mapHeight);
        this.sprintG.rect(halfW - vigW, -halfH, vigW, this.mapHeight);
        this.sprintG.fill();

        // 3. 极速冲刺空气流光微粒 (Golden Speed Streamers)
        this.sprintG.lineWidth = 1.2;
        for (const st of this.sprintStreamers) {
            st.x += st.vx * dt;
            if (st.x < -halfW - st.len) {
                st.x = halfW + 20 + Math.random() * 50;
                st.y = -110 + Math.random() * 220;
            }
            const stAlpha = Math.floor(st.alpha * a);
            if (stAlpha > 0) {
                this.sprintG.strokeColor = new Color(245, 215, 120, stAlpha);
                this.sprintG.moveTo(st.x, st.y);
                this.sprintG.lineTo(st.x + st.len, st.y);
                this.sprintG.stroke();
            }
        }
    }

    /** 集中合批更新并绘制全场 6 匹马所有马蹄印 (Unified Batched Hoofprints, 极大减少 DrawCall) */
    private updateBatchedHoofprints(now: number): void {
        if (!this.hoofprintsBatchG || !this.hoofprintsBatchG.isValid) return;

        // 淘汰超期 > 3000ms 的旧痕迹
        while (this.unifiedHoofprints.length > 0 && now - this.unifiedHoofprints[0].createdAt >= 3000) {
            this.unifiedHoofprints.shift();
        }

        this.hoofprintsBatchG.clear();
        if (this.unifiedHoofprints.length === 0) return;

        for (const hp of this.unifiedHoofprints) {
            const age = now - hp.createdAt;
            if (age >= 3000) continue;
            const alpha = Math.floor(180 * (1 - age / 3000));
            if (alpha <= 0) continue;
            const ds = hp.depthScale;

            // 1. 马蹄铁 U 形外凸凹槽 (Horseshoe Arch)
            this.hoofprintsBatchG.strokeColor = new Color(68, 42, 24, alpha);
            this.hoofprintsBatchG.lineWidth = 1.8 * ds;
            this.hoofprintsBatchG.arc(hp.x, hp.y, 4.2 * ds, -Math.PI * 0.7, Math.PI * 0.7, false);
            this.hoofprintsBatchG.stroke();

            // 2. 马蹄深压泥土暗色凹陷核心
            this.hoofprintsBatchG.fillColor = new Color(50, 30, 16, Math.floor(alpha * 0.65));
            this.hoofprintsBatchG.circle(hp.x - 0.8 * ds, hp.y, 2.0 * ds);
            this.hoofprintsBatchG.fill();
        }
    }

    protected onDestroy(): void {
        this.onGatesOpened = undefined;
        this.gateBars.length = 0;
        this.splashes.length = 0;
        this.splashPool.length = 0;
        this.particles.length = 0;
        this.shockwaves.length = 0;
        this.unifiedHoofprints.length = 0;
        this.weatherDrops.length = 0;
        this.groundRipples.length = 0;
    }
}

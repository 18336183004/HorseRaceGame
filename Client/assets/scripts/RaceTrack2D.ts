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

const { ccclass, property } = _decorator;

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
    private bgG: Graphics | null = null;
    private surfaceG: Graphics | null = null;
    private fxG: Graphics | null = null;

    private gatesContainer: Node | null = null;
    private gateBars: Node[] = [];
    private isGatesOpened = false;

    private mapWidth = 696;
    private mapHeight = 330;
    private currentTrackType = "Dirt";
    private currentWeather = "Sunny";
    private isRacing = false;

    // 地表无缝纹理节点
    private surfaceTextureNode: Node | null = null;
    private surfaceSprite: Sprite | null = null;

    // 动态沙尘微粒与马蹄飞溅粒子
    private particles: Array<{ x: number; y: number; vx: number; r: number; alpha: number }> = [];
    private splashes: HoofSplashParticle[] = [];
    private splashSpawnTimer: number = 0;

    // 动态全屏天气系统（持续斜雨/积水波纹/沙暴狂风）
    private weatherDrops: Array<{ x: number; y: number; vx: number; vy: number; len: number; alpha: number }> = [];
    private groundRipples: Array<{ x: number; y: number; r: number; maxR: number; alpha: number }> = [];

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

    /** 1. 绘制远景峡谷天际线与中景观众大看台 */
    private drawScenicSkyAndStands(): void {
        const g = this.bgG;
        if (!g) return;
        g.clear();

        const halfW = this.mapWidth / 2;
        const halfH = this.mapHeight / 2;

        // --- A. 远景自然天际线 (从跑道顶端 Y = 118 到舞台顶端 Y = halfH) ---
        const skyTop = halfH;
        const skyBottom = 118;
        const skyHeight = skyTop - skyBottom;

        // 天空底色（晚霞/朝阳橙粉暖光渐变）
        const isSunset = this.currentWeather.toLowerCase().includes("sunset") || this.currentWeather.toLowerCase().includes("dawn");
        g.fillColor = isSunset ? new Color(238, 152, 98, 255) : new Color(186, 212, 232, 255);
        g.rect(-halfW, skyBottom, this.mapWidth, skyHeight);
        g.fill();

        // 远方红岩平顶山群剪影 (Red Rock Mesas, 居于地平线之上)
        g.fillColor = isSunset ? new Color(145, 78, 62, 220) : new Color(152, 116, 96, 220);
        g.moveTo(-halfW, skyBottom + 12);
        g.lineTo(-halfW + 70, skyBottom + 36);
        g.lineTo(-halfW + 140, skyBottom + 34); // 平顶山 1
        g.lineTo(-halfW + 180, skyBottom + 18);
        g.lineTo(-halfW + 260, skyBottom + 44);
        g.lineTo(-halfW + 350, skyBottom + 42); // 平顶山 2
        g.lineTo(-halfW + 410, skyBottom + 20);
        g.lineTo(-halfW + 520, skyBottom + 38);
        g.lineTo(-halfW + 610, skyBottom + 36); // 平顶山 3
        g.lineTo(halfW, skyBottom + 16);
        g.lineTo(halfW, skyBottom);
        g.lineTo(-halfW, skyBottom);
        g.close();
        g.fill();

        // 远景飞鹰剪影 (Desert Falcon)
        g.strokeColor = new Color(75, 45, 35, 200);
        g.lineWidth = 1.4;
        const falconX = -80;
        const falconY = skyBottom + 48;
        g.moveTo(falconX - 10, falconY - 3);
        g.lineTo(falconX, falconY);
        g.lineTo(falconX + 10, falconY - 3);
        g.stroke();

        // --- B. 中景西部观众大看台与小镇设施 (紧贴跑道上护栏后方，Y=120~138) ---
        // 观众看台阶梯席 (Y = 120 ~ 134)
        const standY = skyBottom + 2;
        g.fillColor = new Color(72, 50, 36, 245);
        g.rect(-halfW + 16, standY, this.mapWidth - 32, 14);
        g.fill();

        // 看台正面木柱立板 (Timber Railing)
        g.fillColor = WestColors.LEATHER_DARK;
        g.rect(-halfW + 14, standY - 2, this.mapWidth - 28, 4);
        g.fill();

        // 牛仔剪影：戴宽檐帽的看台人群，趴在上护栏后方欢呼观赛
        for (let j = 0; j < 26; j++) {
            const px = -halfW + 35 + j * 24 + ((j * 7) % 5);
            const py = standY + 8;
            // 牛仔帽宽檐
            g.fillColor = new Color(42, 28, 18, 230);
            g.roundRect(px - 6, py + 2, 12, 3, 1.2);
            g.fill();
            // 帽顶
            g.roundRect(px - 3, py + 5, 6, 4, 1.0);
            g.fill();
            // 头肩
            g.circle(px, py, 3.2);
            g.fill();
        }

        // 观众看台老橡木挑檐屋顶 (Roof Eaves, Y = 138)
        const roofY = standY + 16;
        g.fillColor = WestColors.WOOD_DARK;
        g.rect(-halfW + 12, roofY - 2, this.mapWidth - 24, 6);
        g.fill();

        // 屋顶装饰横梁金线
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 1.5;
        g.moveTo(-halfW + 12, roofY + 4);
        g.lineTo(halfW - 12, roofY + 4);
        g.stroke();

        // 挂在屋檐下的红蓝白迎风三角锦旗 (Pennants)
        const flagCount = 20;
        const flagStep = (this.mapWidth - 40) / flagCount;
        for (let i = 0; i < flagCount; i++) {
            const fx = -halfW + 20 + i * flagStep;
            g.fillColor = (i % 3 === 0)
                ? WestColors.BANDANA_RED
                : (i % 3 === 1 ? new Color(52, 96, 148, 240) : WestColors.CREAM);
            g.moveTo(fx, roofY - 2);
            g.lineTo(fx + flagStep, roofY - 2);
            g.lineTo(fx + flagStep / 2, roofY - 8);
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
            // 泥地与沙地压实车辙和奔跑蹄痕暗纹 (Dirt / Sand Ruts)
            g.fillColor = palette.surfaceDeep;
            for (let r = 0; r < 6; r++) {
                const laneCenterY = 135 - (r + 1) * 41;
                // 上蹄道暗槽
                g.rect(-halfW + 20, laneCenterY - 11, this.mapWidth - 40, 5);
                // 下蹄道暗槽
                g.rect(-halfW + 20, laneCenterY + 6, this.mapWidth - 40, 5);
                g.fill();
            }
        }

        // --- C. 6 条跑道白灰粉质感分道标线 (Chalk Dividers) ---
        g.strokeColor = palette.chalkLine;
        g.lineWidth = 1.4;
        for (let l = 0; l <= 6; l++) {
            const divY = 135 - l * 41 - 20.5;
            g.moveTo(-halfW + 18, divY);
            g.lineTo(halfW - 18, divY);
            g.stroke();
        }

        // --- D. 跑道上下边缘经典双层白木护栏 (Post & Rail Fence) ---
        // 上护栏 (Y = 118: 位于道次 0 上方，紧贴看台与赛道边界)
        this.drawPostAndRailFence(g, -halfW + 10, halfW - 10, 118, palette.fenceWood);
        // 下护栏 (Y = -136: 位于道次 5 下方，下边界绝不遮挡马蹄与底部耐力 HUD)
        this.drawPostAndRailFence(g, -halfW + 10, halfW - 10, -136, palette.fenceWood);

        // --- E. 边框原木加固围栏 (Grand Arena Outer Frame) ---
        g.strokeColor = WestColors.WOOD_FRAME;
        g.lineWidth = 3.0;
        g.roundRect(-halfW + 8, -this.mapHeight / 2 + 8, this.mapWidth - 16, this.mapHeight - 16, 10);
        g.stroke();
    }

    /** 绘制经典白木双层横栏与立桩 (Post & Rail Fence) */
    private drawPostAndRailFence(g: Graphics, startX: number, endX: number, fenceY: number, woodColor: Color): void {
        const totalW = endX - startX;
        // 双层横梁
        g.fillColor = woodColor;
        g.rect(startX, fenceY + 6, totalW, 3.5);
        g.rect(startX, fenceY - 2, totalW, 3.5);
        g.fill();

        // 竖立桩柱 (Post)
        const postStep = 44;
        const postCount = Math.floor(totalW / postStep);
        g.fillColor = new Color(woodColor.r - 20, woodColor.g - 20, woodColor.b - 20, woodColor.a);
        for (let p = 0; p <= postCount; p++) {
            const px = startX + p * postStep;
            g.rect(px - 3, fenceY - 6, 6, 18);
            g.fill();
        }
    }

    /** 3. 构建 6 联装老西部起跑门架 (Starting Gates 1~6) 与开闸动效 */
    private buildStartingGates(): void {
        if (!this.gatesContainer) return;
        this.gatesContainer.destroyAllChildren();
        this.gateBars = [];
        this.isGatesOpened = false;

        const gateStartX = -272; // 与赛跑起点 -270 对齐

        for (let i = 0; i < 6; i++) {
            const laneY = 135 - (i + 1) * 41;
            const gateNode = new Node(`Gate_${i + 1}`);
            gateNode.layer = this.gatesContainer.layer || Layers.Enum.UI_2D;
            this.gatesContainer.addChild(gateNode);
            gateNode.setPosition(gateStartX, laneY, 0);

            const g = gateNode.addComponent(Graphics);

            // 发令闸立柱框架 (老橡木 + 钢铁铆钉)
            g.fillColor = WestColors.WOOD_DARK;
            g.rect(-6, -18, 12, 36);
            g.fill();
            g.strokeColor = WestColors.BRASS_FRAME;
            g.lineWidth = 1.2;
            g.rect(-6, -18, 12, 36);
            g.stroke();

            // 发令门号徽章 (黄色黄铜圆形 + 黑色数字)
            g.fillColor = WestColors.GOLD_METALLIC;
            g.circle(0, 15, 7.5);
            g.fill();
            g.strokeColor = WestColors.LEATHER_DARK;
            g.lineWidth = 1.0;
            g.circle(0, 15, 7.5);
            g.stroke();

            // 起跑前挡门横梁（带旋转锚点，开闸时向上或向前翻开）
            const barNode = new Node(`Bar_${i + 1}`);
            barNode.layer = gateNode.layer;
            gateNode.addChild(barNode);
            barNode.setPosition(4, 0, 0);
            const barG = barNode.addComponent(Graphics);
            barG.fillColor = WestColors.BANDANA_RED;
            barG.rect(0, -14, 5, 28);
            barG.fill();
            barG.strokeColor = WestColors.CREAM;
            barG.lineWidth = 1.0;
            barG.rect(0, -14, 5, 28);
            barG.stroke();

            this.gateBars.push(barNode);
        }
    }

    /** 触发开闸瞬间动画（起跑挡板猛烈弹开） */
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
        }
    }

    /**
     * 接收马匹实际踏地事件，在马蹄精确着力点爆发飞溅泥沙/草屑与粉尘抛物线
     * @param posX 马蹄踏地绝对 X 坐标 (如 -270 ~ 270)
     * @param laneY 该马所在跑道中心 Y 坐标
     * @param intensity 冲刺受力强度倍率
     */
    public emitHoofImpact(posX: number, laneY: number, intensity: number = 1.0): void {
        if (!this.isRacing) return;
        const trackLower = this.currentTrackType.toLowerCase();
        const weatherLower = this.currentWeather.toLowerCase();

        const isTurf = trackLower.includes("turf") || trackLower.includes("草");
        const isSand = trackLower.includes("sand") || trackLower.includes("沙");
        const isRainy = weatherLower.includes("rain") || weatherLower.includes("雨") || weatherLower.includes("mud");
        const isSnow = weatherLower.includes("snow") || weatherLower.includes("雪");

        const count = Math.floor((3 + Math.random() * 4) * intensity);
        for (let k = 0; k < count; k++) {
            let col: Color;
            let radius = 1.5 + Math.random() * 2.2;
            let maxLife = 0.36 + Math.random() * 0.24;

            if (isSnow) {
                // 雪地扬起洁白冰晶碎雪与淡蓝微粒
                col = Math.random() > 0.3
                    ? new Color(245, 248, 255, 245)
                    : new Color(210, 230, 255, 230);
                radius = 1.2 + Math.random() * 1.8;
                maxLife = 0.42 + Math.random() * 0.22;
            } else if (isRainy) {
                // 雨天泥泞深褐色沉重湿泥浆
                col = Math.random() > 0.4
                    ? new Color(52, 34, 20, 250)
                    : new Color(78, 48, 26, 245);
                radius = 2.0 + Math.random() * 2.4;
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

            this.splashes.push({
                x: posX + (Math.random() * 8 - 4),
                y: laneY + (Math.random() * 6 - 3),
                vx: -95 - Math.random() * 120, // 强烈向后喷射
                vy: 32 + Math.random() * 70,   // 向上抛起
                r: radius,
                color: col,
                alpha: 240,
                life: 0,
                maxLife: maxLife,
            });
        }

        // 雨天额外触发 2-3 颗晶莹水雾微滴
        if (isRainy) {
            const waterDrops = Math.floor(2 + Math.random() * 2);
            for (let w = 0; w < waterDrops; w++) {
                this.splashes.push({
                    x: posX + (Math.random() * 6 - 3),
                    y: laneY + (Math.random() * 4 - 2),
                    vx: -110 - Math.random() * 100,
                    vy: 45 + Math.random() * 80,
                    r: 1.0 + Math.random() * 1.4,
                    color: new Color(195, 220, 250, 210),
                    alpha: 210,
                    life: 0,
                    maxLife: 0.28 + Math.random() * 0.16,
                });
            }
        }
    }

    private static readonly _tempParticleColor = new Color(0, 0, 0, 255);
    private static readonly _tempRainColor = new Color(210, 225, 245, 140);
    private static readonly _tempStormColor = new Color(225, 185, 125, 80);
    private static readonly _tempSplashColor = new Color(0, 0, 0, 255);

    /** 每帧更新赛道飞沙粒子与竞技氛围 */
    protected update(dt: number): void {
        if (!this.fxG) return;
        this.fxG.clear();

        if (!this.isRacing) return;

        const palette = this.getPalette();
        const halfW = this.mapWidth / 2;

        // 1. 比赛中更新并渲染流动的跑道环境微粒
        (this.particles ?? []).forEach((p) => {
            p.x += p.vx * dt * 2.2;
            if (p.x > halfW - 20) {
                p.x = -halfW + 20 + Math.random() * 40;
                p.y = -120 + Math.random() * 220;
            }

            RaceTrack2D._tempParticleColor.set(
                palette.particleColor.r,
                palette.particleColor.g,
                palette.particleColor.b,
                Math.floor(p.alpha * 0.75),
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

        // 3. 更新并渲染飞溅泥点 (带重力下落与阻力减速)
        for (let i = this.splashes.length - 1; i >= 0; i--) {
            const sp = this.splashes[i];
            sp.life += dt;
            if (sp.life >= sp.maxLife) {
                this.splashes.splice(i, 1);
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
}

import {
    _decorator,
    Component,
    Node,
    MeshRenderer,
    utils,
    Material,
    Color,
    Vec3,
    Layers,
    Mesh,
    tween,
} from "cc";
import { HorseEntity3D } from "./HorseEntity3D";

const { ccclass } = _decorator;

/**
 * 真实 3D 赛马竞技场地图与跑道系统 (RaceTrack3D)
 *
 * 采用现代 3D 场景管线与定向光影烘焙网格构建专业立体赛马竞技场：
 * 1. 6 条独立三维跑道 (Lane 0 ~ 5)，物理纵深宽度与立体分道标线
 * 2. 真实地表材质响应 (Turf 天然草地 / Dirt 西部红土泥地 / Sand 黄金细沙地 / Mud 泥泞雨地)
 * 3. 赛道两侧白色立体双横杆原木马场围栏与立柱系统 (3D Picket Fences & Posts) + 里程碑号牌
 * 4. 起点 3D 机械发令闸箱 (Starting Gates) 带可开启动态闸门与 1~6 号跑道权威徽章
 * 5. 终点跨赛道 3D 龙门架 (Finish Line Gantry) 悬挂黑白方格旗与动态红外激光标尺
 * 6. 外场绿茵木质观礼大看台 (Grandstand) 与节日彩旗
 * 7. 远景自然峡谷山峦天际线 (Distant Horizon Mesas)，强化竞技场壮丽纵深
 */
@ccclass("RaceTrack3D")
export class RaceTrack3D extends Component {
    // 跑道物理参数
    public static readonly TRACK_LENGTH = 110;     // 赛道全长 (米)
    public static readonly START_X = -45;          // 起点线 X
    public static readonly FINISH_X = 45;          // 终点线 X
    public static readonly LANE_COUNT = 6;         // 6 条跑道
    public static readonly LANE_WIDTH = 2.4;       // 单道宽度 (米)
    public static readonly TOTAL_WIDTH = 14.4;     // 跑道总宽 (米)

    private trackGroundNode: Node | null = null;
    private fenceGroupNode: Node | null = null;
    private startGatesNode: Node | null = null;
    private finishArchNode: Node | null = null;
    private grandstandNode: Node | null = null;
    private horizonNode: Node | null = null;
    private laserLineNode: Node | null = null;

    // 6 扇起跑闸门叶片节点 (供开闸动画物理旋转)
    private gateDoors: Node[] = [];
    private areGatesOpen: boolean = false;

    private currentTrackType = "Dirt";
    private currentWeather = "Sunny";

    /** 计算道次索引 [0, 5] 对应的 3D 空间 Z 轴物理坐标 */
    public static getLaneZ(laneIdx: number): number {
        const safeIdx = Math.max(0, Math.min(5, laneIdx));
        return (safeIdx - 2.5) * RaceTrack3D.LANE_WIDTH;
    }

    /** 将服务端的比赛进度 [0, 1] 转换为 3D 赛道 X 轴世界坐标 */
    public static getProgressX(progress: number): number {
        const clamped = Math.max(0, Math.min(1.0, progress));
        return RaceTrack3D.START_X + (RaceTrack3D.FINISH_X - RaceTrack3D.START_X) * clamped;
    }

    protected onLoad(): void {
        this.node.layer = Layers.Enum.DEFAULT;
        this.buildOrResetTrack(this.currentTrackType, this.currentWeather);
    }

    /** 确保跑道地表与建筑设施完好，并刷新当前地貌与天气光效 */
    public buildOrResetTrack(trackType?: string, weather?: string): void {
        if (trackType) this.currentTrackType = trackType;
        if (weather) this.currentWeather = weather;

        this.gateDoors.length = 0;
        this.areGatesOpen = false;

        // 清理旧有架构
        if (this.startGatesNode && this.startGatesNode.isValid) {
            this.startGatesNode.destroy();
            this.startGatesNode = null;
        }
        if (this.fenceGroupNode && this.fenceGroupNode.isValid) {
            this.fenceGroupNode.destroy();
            this.fenceGroupNode = null;
        }
        if (this.trackGroundNode && this.trackGroundNode.isValid) {
            this.trackGroundNode.destroy();
            this.trackGroundNode = null;
        }
        if (this.finishArchNode && this.finishArchNode.isValid) {
            this.finishArchNode.destroy();
            this.finishArchNode = null;
        }
        if (this.grandstandNode && this.grandstandNode.isValid) {
            this.grandstandNode.destroy();
            this.grandstandNode = null;
        }
        if (this.horizonNode && this.horizonNode.isValid) {
            this.horizonNode.destroy();
            this.horizonNode = null;
        }

        this.buildTrackSurface();
        this.buildFences();
        this.buildStartingGates();
        this.buildFinishLineArch();
        this.buildGrandstandAndArena();
        this.buildDistantHorizon();

        this.applyEnvironment(this.currentTrackType, this.currentWeather);
    }

    public setupEnvironment(trackType: string, weather: string): void {
        this.currentTrackType = trackType;
        this.currentWeather = weather;
        this.applyEnvironment(trackType, weather);
    }

    /** 开闸发令爆发动效：6 扇机械门向前 90° 猛烈弹开 */
    public openGates(animate = true): void {
        if (this.areGatesOpen) return;
        this.areGatesOpen = true;

        for (const door of this.gateDoors) {
            if (!door || !door.isValid) continue;
            if (animate) {
                tween(door)
                    .to(0.22, { eulerAngles: new Vec3(0, 92, 0) }, { easing: "backOut" })
                    .start();
            } else {
                door.setRotationFromEuler(0, 92, 0);
            }
        }
    }

    /** 闭合复位起跑闸门 */
    public closeGates(): void {
        this.areGatesOpen = false;
        for (const door of this.gateDoors) {
            if (!door || !door.isValid) continue;
            door.setRotationFromEuler(0, 0, 0);
        }
    }

    /** 1. 构建立体跑道路面与分道标线 */
    private buildTrackSurface(): void {
        this.trackGroundNode = new Node("TrackGround");
        this.trackGroundNode.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.trackGroundNode);

        // 主跑道路基 (长 125m, 宽 16m)
        const mainTrack = this.createMeshBox("MainSurface", new Vec3(RaceTrack3D.TRACK_LENGTH + 20, 0.2, RaceTrack3D.TOTAL_WIDTH + 1.2), new Vec3(0, -0.1, 0));
        this.trackGroundNode.addChild(mainTrack);

        // 外围草坪平原基底 (广阔远景，宽 160m, 深 65m)
        const outerGrass = this.createMeshBox("OuterGrassPlain", new Vec3(RaceTrack3D.TRACK_LENGTH + 50, 0.16, 65), new Vec3(0, -0.14, 0));
        this.trackGroundNode.addChild(outerGrass);

        // 5 条分道虚线标线 (白灰色发光条带)
        for (let l = 1; l < RaceTrack3D.LANE_COUNT; l++) {
            const laneZ = (l - 3.0) * RaceTrack3D.LANE_WIDTH;
            const divider = this.createMeshBox(`LaneDivider_${l}`, new Vec3(RaceTrack3D.TRACK_LENGTH + 12, 0.21, 0.08), new Vec3(0, -0.09, laneZ));
            this.setNodeColor(divider, new Color(245, 245, 248, 220));
            this.trackGroundNode.addChild(divider);
        }

        // 起点粗白标线
        const startLine = this.createMeshBox("StartLineMark", new Vec3(0.45, 0.22, RaceTrack3D.TOTAL_WIDTH), new Vec3(RaceTrack3D.START_X, -0.08, 0));
        this.setNodeColor(startLine, new Color(255, 255, 255, 255));
        this.trackGroundNode.addChild(startLine);

        // 终点红白相间方格标线
        const finishLine = this.createMeshBox("FinishLineMark", new Vec3(0.68, 0.22, RaceTrack3D.TOTAL_WIDTH), new Vec3(RaceTrack3D.FINISH_X, -0.08, 0));
        this.setNodeColor(finishLine, new Color(230, 42, 42, 255));
        this.trackGroundNode.addChild(finishLine);
    }

    /** 2. 构建赛道两侧白色立体木护栏、立柱与里程碑 */
    private buildFences(): void {
        this.fenceGroupNode = new Node("FencesGroup");
        this.fenceGroupNode.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.fenceGroupNode);

        const fenceHalfWidth = RaceTrack3D.TOTAL_WIDTH / 2 + 0.35;
        const sides = [-fenceHalfWidth, fenceHalfWidth];

        const postSpacing = 3.6;
        const totalPosts = Math.floor((RaceTrack3D.TRACK_LENGTH + 18) / postSpacing);
        const startX = -(RaceTrack3D.TRACK_LENGTH + 18) / 2;

        for (const sideZ of sides) {
            // 两条平行横贯通栏木条 (Upper & Lower Rails)
            const railUpper = this.createMeshBox("RailUpper", new Vec3(RaceTrack3D.TRACK_LENGTH + 18, 0.08, 0.12), new Vec3(0, 1.15, sideZ));
            const railLower = this.createMeshBox("RailLower", new Vec3(RaceTrack3D.TRACK_LENGTH + 18, 0.08, 0.12), new Vec3(0, 0.65, sideZ));
            this.setNodeColor(railUpper, new Color(248, 248, 250, 255));
            this.setNodeColor(railLower, new Color(248, 248, 250, 255));
            this.fenceGroupNode.addChild(railUpper);
            this.fenceGroupNode.addChild(railLower);

            // 每隔 3.6 米树立一根立体圆木护栏立柱
            for (let i = 0; i <= totalPosts; i++) {
                const posX = startX + i * postSpacing;
                const post = this.createMeshBox(`Post_${i}`, new Vec3(0.16, 1.35, 0.16), new Vec3(posX, 0.65, sideZ));
                this.setNodeColor(post, new Color(240, 240, 244, 255));
                this.fenceGroupNode.addChild(post);
            }
        }

        // 沿外侧护栏设置里程碑标牌 (1/4, 1/2, 3/4)
        const markers = [
            { name: "Sign_Start", x: RaceTrack3D.START_X, text: "START" },
            { name: "Sign_1_4", x: RaceTrack3D.START_X + 22.5, text: "1/4" },
            { name: "Sign_Half", x: 0, text: "HALF" },
            { name: "Sign_3_4", x: RaceTrack3D.START_X + 67.5, text: "3/4" },
            { name: "Sign_Finish", x: RaceTrack3D.FINISH_X, text: "FINISH" },
        ];

        for (const m of markers) {
            const board = this.createMeshBox(m.name, new Vec3(1.2, 0.6, 0.15), new Vec3(m.x, 1.75, fenceHalfWidth + 0.15));
            this.setNodeColor(board, new Color(218, 172, 68, 255));
            this.fenceGroupNode.addChild(board);
        }
    }

    /** 3. 构建起跑点 3D 机械发令闸箱 (带可动态开闭的闸门) */
    private buildStartingGates(): void {
        this.startGatesNode = new Node("StartingGates3D");
        this.startGatesNode.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.startGatesNode);
        this.startGatesNode.setPosition(RaceTrack3D.START_X, 0, 0);

        const gateHeight = 3.6;
        const metalColor = new Color(52, 73, 94, 255);
        const wingLeather = new Color(115, 45, 35, 255);

        // 顶层横贯桁架大梁 (Truss Header Beam)
        const headerBeam = this.createMeshBox("GateHeader", new Vec3(2.6, 0.38, RaceTrack3D.TOTAL_WIDTH + 0.6), new Vec3(-0.4, gateHeight, 0));
        this.setNodeColor(headerBeam, metalColor);
        this.startGatesNode.addChild(headerBeam);

        // 六个隔闸分道立体框与门头号牌
        for (let i = 0; i <= RaceTrack3D.LANE_COUNT; i++) {
            const laneZ = (i - 3.0) * RaceTrack3D.LANE_WIDTH;
            const pillarFront = this.createMeshBox(`PillarFront_${i}`, new Vec3(0.22, gateHeight, 0.22), new Vec3(0.85, gateHeight / 2, laneZ));
            const pillarBack = this.createMeshBox(`PillarBack_${i}`, new Vec3(0.22, gateHeight, 0.22), new Vec3(-1.65, gateHeight / 2, laneZ));
            this.setNodeColor(pillarFront, metalColor);
            this.setNodeColor(pillarBack, metalColor);
            this.startGatesNode.addChild(pillarFront);
            this.startGatesNode.addChild(pillarBack);

            // 侧边防撞软质护垫 (Padded Divider Wings)
            const wing = this.createMeshBox(`Wing_${i}`, new Vec3(2.5, 1.35, 0.12), new Vec3(-0.4, 1.15, laneZ));
            this.setNodeColor(wing, wingLeather);
            this.startGatesNode.addChild(wing);
        }

        // 闸门顶部悬挂的 1~6 醒目马号彩牌与动态铰接闸门
        const gateLaneColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];

        for (let laneIdx = 0; laneIdx < RaceTrack3D.LANE_COUNT; laneIdx++) {
            const laneZ = RaceTrack3D.getLaneZ(laneIdx);
            const badgeBox = this.createMeshBox(`Badge_${laneIdx + 1}`, new Vec3(0.18, 0.65, 1.2), new Vec3(0.85, gateHeight - 0.2, laneZ));
            const laneColor = gateLaneColors[laneIdx] || new Color(241, 196, 15, 255);
            this.setNodeColor(badgeBox, laneColor);
            this.startGatesNode.addChild(badgeBox);

            // 前后双侧高亮立体赛道号牌 (3D Lane Numbers on Gate Stall)
            const digitMesh = HorseEntity3D.getDigitMesh(laneIdx + 1);

            // 前侧号码 (面向跑道终点方向 +X)
            const digitFront = new Node(`GateDigitFront_${laneIdx + 1}`);
            digitFront.layer = Layers.Enum.DEFAULT;
            const mrF = digitFront.addComponent(MeshRenderer);
            mrF.mesh = digitMesh;
            mrF.material = HorseEntity3D.getMaterial(new Color(255, 255, 255, 255));
            digitFront.setPosition(0.85 + 0.11, gateHeight - 0.2, laneZ);
            digitFront.setRotationFromEuler(0, 90, 0);
            digitFront.setScale(1.7, 1.7, 1.7);
            this.startGatesNode.addChild(digitFront);

            // 后侧号码 (面向发令闸准备入口方向 -X)
            const digitBack = new Node(`GateDigitBack_${laneIdx + 1}`);
            digitBack.layer = Layers.Enum.DEFAULT;
            const mrB = digitBack.addComponent(MeshRenderer);
            mrB.mesh = digitMesh;
            mrB.material = HorseEntity3D.getMaterial(new Color(255, 255, 255, 255));
            digitBack.setPosition(0.85 - 0.11, gateHeight - 0.2, laneZ);
            digitBack.setRotationFromEuler(0, -90, 0);
            digitBack.setScale(1.7, 1.7, 1.7);
            this.startGatesNode.addChild(digitBack);

            // 前置动态铰接起跑门 (Swing Gates)
            const doorPivot = new Node(`GateDoorPivot_${laneIdx + 1}`);
            doorPivot.layer = Layers.Enum.DEFAULT;
            this.startGatesNode.addChild(doorPivot);
            doorPivot.setPosition(0.85, 1.2, laneZ - RaceTrack3D.LANE_WIDTH / 2 + 0.1);

            const doorMesh = this.createMeshBox(`DoorMesh_${laneIdx + 1}`, new Vec3(0.08, 1.2, RaceTrack3D.LANE_WIDTH - 0.2), new Vec3(0, 0, (RaceTrack3D.LANE_WIDTH - 0.2) / 2));
            this.setNodeColor(doorMesh, new Color(220, 220, 225, 255));
            doorPivot.addChild(doorMesh);
            this.gateDoors.push(doorPivot);
        }
    }

    /** 4. 构建终点跨赛道 3D 金属龙门架与激光终点线 */
    private buildFinishLineArch(): void {
        this.finishArchNode = new Node("FinishLineArch3D");
        this.finishArchNode.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.finishArchNode);
        this.finishArchNode.setPosition(RaceTrack3D.FINISH_X, 0, 0);

        const archH = 5.2;
        const archWidth = RaceTrack3D.TOTAL_WIDTH + 2.5;
        const trussColor = new Color(44, 62, 80, 255);

        // 左右双主立柱
        const leftTower = this.createMeshBox("TowerL", new Vec3(0.8, archH, 0.8), new Vec3(0, archH / 2, -archWidth / 2));
        const rightTower = this.createMeshBox("TowerR", new Vec3(0.8, archH, 0.8), new Vec3(0, archH / 2, archWidth / 2));
        this.setNodeColor(leftTower, trussColor);
        this.setNodeColor(rightTower, trussColor);
        this.finishArchNode.addChild(leftTower);
        this.finishArchNode.addChild(rightTower);

        // 跨道桁架顶梁
        const crossBeam = this.createMeshBox("CrossBeam", new Vec3(1.1, 0.9, archWidth), new Vec3(0, archH, 0));
        this.setNodeColor(crossBeam, trussColor);
        this.finishArchNode.addChild(crossBeam);

        // 黑白方格终点招牌 (Checkered Finish Banner)
        const bannerBox = this.createMeshBox("FinishBanner", new Vec3(0.18, 0.75, RaceTrack3D.TOTAL_WIDTH), new Vec3(0, archH - 0.7, 0));
        this.setNodeColor(bannerBox, new Color(245, 245, 245, 255));
        this.finishArchNode.addChild(bannerBox);

        // 终点红外激光扫描发射器
        this.laserLineNode = this.createMeshBox("LaserBeam", new Vec3(0.06, archH - 0.5, 0.06), new Vec3(0, (archH - 0.5) / 2, 0));
        this.setNodeColor(this.laserLineNode, new Color(255, 38, 38, 220));
        this.finishArchNode.addChild(this.laserLineNode);
    }

    /** 5. 构建外场观礼大看台与彩旗 */
    private buildGrandstandAndArena(): void {
        this.grandstandNode = new Node("GrandstandArena");
        this.grandstandNode.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.grandstandNode);

        const standZ = -(RaceTrack3D.TOTAL_WIDTH / 2 + 5.5);

        // 4 级阶梯原木大看台
        for (let step = 0; step < 4; step++) {
            const stepY = step * 0.75;
            const stepDeep = standZ - step * 1.4;
            const bench = this.createMeshBox(`BenchTier_${step}`, new Vec3(65, 0.65, 1.2), new Vec3(0, stepY + 0.32, stepDeep));
            this.setNodeColor(bench, new Color(140, 85, 45, 255));
            this.grandstandNode.addChild(bench);
        }

        // 看台立柱与顶棚
        const roofPillar1 = this.createMeshBox("RoofPillar1", new Vec3(0.4, 5.2, 0.4), new Vec3(-28, 2.6, standZ));
        const roofPillar2 = this.createMeshBox("RoofPillar2", new Vec3(0.4, 5.2, 0.4), new Vec3(28, 2.6, standZ));
        this.setNodeColor(roofPillar1, new Color(70, 45, 25, 255));
        this.setNodeColor(roofPillar2, new Color(70, 45, 25, 255));
        this.grandstandNode.addChild(roofPillar1);
        this.grandstandNode.addChild(roofPillar2);

        // 大看台遮阳棚 (Canopy Roof)
        const roof = this.createMeshBox("CanopyRoof", new Vec3(72, 0.25, 8.5), new Vec3(0, 5.2, standZ - 2.5));
        this.setNodeColor(roof, new Color(192, 57, 43, 255));
        this.grandstandNode.addChild(roof);
    }

    /** 6. 构建远景壮丽峡谷山峦天际线 (Distant Mesa Horizons) */
    private buildDistantHorizon(): void {
        this.horizonNode = new Node("DistantHorizon");
        this.horizonNode.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.horizonNode);

        // 远方连绵起伏的红岩平顶山峦 (Mesa Ridges: 宽 180m, 高 22m, Z 轴深处 -35m)
        const mesaColors = [
            new Color(152, 92, 62, 255),
            new Color(138, 80, 54, 255),
            new Color(165, 105, 72, 255),
        ];

        const mesas = [
            { name: "Mesa_1", size: new Vec3(55, 18, 12), pos: new Vec3(-50, 9, -38) },
            { name: "Mesa_2", size: new Vec3(70, 24, 15), pos: new Vec3(10, 12, -42) },
            { name: "Mesa_3", size: new Vec3(60, 20, 12), pos: new Vec3(75, 10, -36) },
        ];

        mesas.forEach((m, idx) => {
            const mesaNode = this.createMeshBox(m.name, m.size, m.pos);
            this.setNodeColor(mesaNode, mesaColors[idx % mesaColors.length]);
            this.horizonNode?.addChild(mesaNode);
        });
    }

    /** 应用地表材质与光照环境 */
    private applyEnvironment(trackType: string, weather: string): void {
        if (!this.trackGroundNode) return;
        const mainSurface = this.trackGroundNode.getChildByName("MainSurface");
        const outerGrass = this.trackGroundNode.getChildByName("OuterGrassPlain");

        let trackColor = new Color(145, 96, 58, 255); // 默认 Dirt 红土
        const typeUpper = (trackType || "").toUpperCase();

        if (typeUpper.includes("TURF") || typeUpper.includes("GRASS") || typeUpper.includes("草")) {
            trackColor = new Color(52, 122, 56, 255); // 草地绿
        } else if (typeUpper.includes("SAND") || typeUpper.includes("沙")) {
            trackColor = new Color(208, 172, 115, 255); // 沙地金黄
        } else if (typeUpper.includes("MUD") || typeUpper.includes("雨") || typeUpper.includes("泥")) {
            trackColor = new Color(85, 52, 32, 255); // 湿泥深褐
        }

        const weatherUpper = (weather || "").toUpperCase();
        const isRainy = weatherUpper.includes("RAIN") || weatherUpper.includes("雨");
        const isSunset = weatherUpper.includes("SUNSET") || weatherUpper.includes("夕");

        if (isRainy) {
            trackColor = new Color(
                Math.round(trackColor.r * 0.72),
                Math.round(trackColor.g * 0.72),
                Math.round(trackColor.b * 0.72),
                255
            );
        } else if (isSunset) {
            trackColor = new Color(
                Math.min(255, Math.round(trackColor.r * 1.15)),
                Math.round(trackColor.g * 0.90),
                Math.round(trackColor.b * 0.80),
                255
            );
        }

        if (mainSurface) {
            this.setNodeColor(mainSurface, trackColor);
        }

        if (outerGrass) {
            let grassColor = new Color(45, 102, 48, 255);
            if (isRainy) grassColor = new Color(32, 75, 36, 255);
            else if (isSunset) grassColor = new Color(58, 95, 40, 255);
            this.setNodeColor(outerGrass, grassColor);
        }
    }

    private createMeshBox(name: string, scale: Vec3, pos: Vec3): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.DEFAULT;
        node.setPosition(pos);

        const mr = node.addComponent(MeshRenderer);
        mr.mesh = HorseEntity3D.getShadedBoxMesh(scale.x, scale.y, scale.z);
        return node;
    }

    private setNodeColor(node: Node, color: Color): void {
        const mr = node.getComponent(MeshRenderer);
        if (!mr) return;
        mr.material = HorseEntity3D.getMaterial(color);
    }
}

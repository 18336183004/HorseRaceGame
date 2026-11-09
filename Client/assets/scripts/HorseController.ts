import { Color, Component, Graphics, Node, Vec3, _decorator } from "cc";
import { HorseVisual2D } from "./HorseVisual2D";
import { RaceTrack2D } from "./RaceTrack2D";
import { HorseEntity3D } from "./HorseEntity3D";
import { RaceTrack3D } from "./RaceTrack3D";

const { ccclass, property } = _decorator;

interface HoofprintItem {
    x: number;
    y: number;
    createdAt: number;
    isLeft: boolean;
}

/**
 * 单匹马表现控制器。
 * 位置只由服务端 finishTime 和 serverTime 推导，客户端不参与名次计算。
 * 包含：平滑插值移动、支持 3D 真实纯血马动力学 (HorseEntity3D) 与 3D 空间坐标同步。
 */
@ccclass("HorseController")
export class HorseController extends Component {
    private static readonly _dustColor1 = new Color(205, 175, 130, 255);
    private static readonly _dustColor2 = new Color(225, 195, 150, 255);
    private static readonly _dustColor3 = new Color(235, 215, 175, 255);
    private static readonly _dustColor4 = new Color(245, 230, 195, 255);
    private static readonly _hoofprintCoreColor = new Color(50, 30, 16, 255);
    @property(Node)
    public horseVisual: Node | null = null;

    private visual2D: HorseVisual2D | null = null;
    private visual3D: HorseEntity3D | null = null;
    private raceTrack2D: RaceTrack2D | null = null;
    private position3D: Vec3 = new Vec3();

    private finishTime = 30;
    private raceStartMs = 0;
    private running = false;
    private dustTrailNode: Node | null = null;
    private dustGraphics: Graphics | null = null;

    // 动态策略与超车轨迹系统
    private horseNo = 1;
    private isQuinellaMode = false;
    private archetype = 0; // 0: 领跑型, 1: 跟跑型, 2: 冲刺型, 3: 缠斗型
    private currentProgress = 0;
    private maxProgressReached = 0;
    private currentLaneX = -270;

    // 3 秒跑道马蹄印凹痕系统 (Hoofprints Trail System)
    private hoofprintsG: Graphics | null = null;
    private readonly hoofprints: HoofprintItem[] = [];
    private lastHoofprintX = -999;
    private isLeftHoof = false;

    // 跑道物理道次索引 [0, 5] 与 2.5D 深度透视缩放
    private laneIndex = -1;
    private depthScale = 1.0;
    private isDueling = false;
    private templateId = 0;
    private isBetTarget = false;

    /** 设置赛马模板编号 (1-20，决定纯血马品种毛色与鬃尾材质) */
    public setHorseTemplateId(templateId: number): void {
        this.templateId = Math.max(1, Math.min(20, templateId));
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setTemplateId(this.templateId);
        }
    }

    /** 设置赛马道次/马号 (1-6) */
    public setHorseNo(no: number): void {
        this.horseNo = no;
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setHorseNo(no);
        }
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setLaneNo(no);
            if (this.templateId > 0) {
                this.visual3D.setTemplateId(this.templateId);
            } else {
                this.visual3D.setHorseNo(no);
            }
        }
    }

    public getHorseNo(): number {
        return this.horseNo;
    }

    /** 设置玩家是否押注该马匹，激活 3D 浮空常驻黄金信标 */
    public setBetTarget(isBet: boolean): void {
        this.isBetTarget = isBet;
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setBetTarget(isBet);
        }
    }

    /** 关联 3D 纯血马物理实体组件 */
    public setVisual3D(v: HorseEntity3D | null): void {
        this.visual3D = v;
        const laneZ = RaceTrack3D.getLaneZ(this.laneIndex >= 0 ? this.laneIndex : (this.horseNo - 1) % 6);
        this.position3D.set(RaceTrack3D.START_X, 0, laneZ);
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.node.setPosition(this.position3D);
            if (this.templateId > 0) {
                this.visual3D.setTemplateId(this.templateId);
            } else if (this.horseNo > 0) {
                this.visual3D.setTemplateId(this.horseNo);
            }
            if (this.horseNo > 0) {
                this.visual3D.setLaneNo(this.horseNo);
            }
            if (this.isBetTarget) {
                this.visual3D.setBetTarget(true);
            }
            this.visual3D.setShowJockey(true);
        }
    }

    public getVisual3D(): HorseEntity3D | null {
        return this.visual3D;
    }

    public getPosition3D(): Vec3 {
        return this.position3D;
    }

    /** 关联 2D 写实表现组件 */
    public setVisual2D(v: HorseVisual2D | null): void {
        this.visual2D = v;
        if (this.visual2D && this.horseNo > 0) {
            this.visual2D.setHorseNo(this.horseNo);
            this.visual2D.setLaneDepthScale(this.depthScale);
        }
    }

    /** 设置赛马当前分配的跑道物理道次 (0-5)，自动驱动 2.5D 纵深透视缩放 */
    public setLaneIndex(idx: number): void {
        this.laneIndex = idx;
        const laneZ = RaceTrack3D.getLaneZ(idx);
        this.position3D.set(RaceTrack3D.START_X, 0, laneZ);
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.node.setPosition(this.position3D);
        }
        // 跑道 6 道从上至下 (0 ~ 5) 实现真实 2.5D 纵深透视缩放 (0.85x ~ 1.15x)
        this.depthScale = RaceTrack2D.getLaneDepthScale(idx);
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setLaneDepthScale(this.depthScale);
        }
    }

    /** 设置当前是否与相邻道次战驹陷入激烈并驾齐驱对抗 */
    public setDueling(dueling: boolean): void {
        this.isDueling = dueling;
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setDueling(dueling);
        }
    }

    /** 为赛马施加瞬时马刺或强力挥鞭冲刺爆发 */
    public boostSprint(): void {
        if (!this.running) return;
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setAction("Sprint", 1.55);
        }
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setSprint(true);
        }
    }

    /** 关联 2D 赛道组件以触发物理马蹄飞溅粒子 */
    public setRaceTrack2D(track: RaceTrack2D | null): void {
        this.raceTrack2D = track;
    }

    /** 关联跑道马蹄印图元组件 */
    public setHoofprintGraphics(g: Graphics | null): void {
        this.hoofprintsG = g;
        this.hoofprints.length = 0;
        this.lastHoofprintX = -999;
    }

    /** 控制 2D 马匹视觉与扬尘节点的显示/隐藏（用于 3D 与 2D 竞技场无缝切换） */
    public set2DVisible(visible: boolean): void {
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.node.active = visible;
        }
        if (this.dustTrailNode && this.dustTrailNode.isValid) {
            this.dustTrailNode.active = visible;
        }
        if (this.hoofprintsG && this.hoofprintsG.node && this.hoofprintsG.node.isValid) {
            this.hoofprintsG.node.active = visible;
        }
    }

    /** 控制 3D 马匹视觉的显示/隐藏 */
    public set3DVisible(visible: boolean): void {
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.node.active = visible;
        }
    }

    /** 在起跑闸门内等待发令时，随机展现真实马匹小动作（刨地、打响鼻、机警站立） */
    public setPreRaceIdle(seed: number): void {
        const roll = Math.abs(seed + this.horseNo * 11) % 3;
        if (this.visual2D && this.visual2D.isValid) {
            if (roll === 0) {
                this.visual2D.setAction("Stand", 1.0);
            } else if (roll === 1) {
                this.visual2D.setAction("Paw", 0.9);
            } else {
                this.visual2D.setAction("Snort_Alert", 1.0);
            }
        }
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setAction(roll === 0 ? "Stand" : "Trot", 0.8);
        }
    }

    /** 初始化一匹马的服务端比赛参数与战术策略原型。 */
    public init(
        finishTime: number,
        raceStartMs: number,
        horseNo = 1,
        seed = 0,
        isQuinellaMode = false,
        runningStyle?: string,
    ): void {
        this.finishTime = Math.max(0.1, finishTime);
        this.raceStartMs = raceStartMs;
        this.horseNo = horseNo;
        this.isQuinellaMode = isQuinellaMode;
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setHorseNo(horseNo);
            this.visual2D.setAction("Start", 1.2);
        }
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setLaneNo(horseNo);
            if (this.templateId > 0) {
                this.visual3D.setTemplateId(this.templateId);
            } else {
                this.visual3D.setHorseNo(horseNo);
            }
            if (this.isBetTarget) {
                this.visual3D.setBetTarget(true);
            }
            this.visual3D.setAction("Gallop", 1.0);
        }
        // 优先依据服务端数据库赋予的真实跑法属性解析策略原型
        const parsed = HorseController.parseRunningStyle(runningStyle);
        this.archetype = parsed !== null ? parsed : Math.abs((seed + horseNo * 7 + (isQuinellaMode ? 13 : 3)) % 4);
        this.running = true;
        this.maxProgressReached = 0;
        this.hoofprints.length = 0;
        this.lastHoofprintX = -999;
        this.apply(0);
    }

    /** 重置到起点，供进入新轮次时复用。 */
    public reset(): void {
        this.running = false;
        this.isDueling = false;
        this.maxProgressReached = 0;
        this.clearDustTrail();
        this.clearHoofprints();
        if (this.raceTrack2D && this.raceTrack2D.isValid) {
            this.raceTrack2D.clearUnifiedHoofprints();
        }
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setAction("Stand", 1.0);
        }
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setAction("Stand", 1.0);
        }
        this.apply(0);
    }

    /** 将马直接定位到终点。 */
    public stopAtFinish(): void {
        this.running = false;
        this.maxProgressReached = 1;
        this.clearDustTrail();
        if (this.visual2D && this.visual2D.isValid) {
            this.visual2D.setAction("Finish", 0.8);
        }
        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.setAction("Stand", 0.8);
        }
        this.apply(1);
    }

    /** 读取当前赛程绝对进度 [0, 1] */
    public getProgress(): number {
        return this.currentProgress;
    }

    /** 读取当前跑道 X 像素坐标 [-270, 270] */
    public getLaneX(): number {
        return this.currentLaneX;
    }

    /** 在模式切换（WIN <-> QUINELLA）时实时调整战术策略原型与中程轨迹，保持服务端完成时间权威不变 */
    public updateMode(seed: number, isQuinellaMode: boolean, runningStyle?: string): void {
        this.isQuinellaMode = isQuinellaMode;
        const parsed = HorseController.parseRunningStyle(runningStyle);
        this.archetype = parsed !== null ? parsed : HorseController.computeArchetype(seed, this.horseNo, isQuinellaMode);
    }

    /** 读取当前跑法战术原型编号 (0: 领跑型, 1: 跟跑型, 2: 冲刺型, 3: 缠斗型) */
    public getArchetype(): number {
        return this.archetype;
    }

    /** 静态辅助：解析服务端下发的 runningStyle 为原型编号 */
    public static parseRunningStyle(runningStyle?: string): number | null {
        if (!runningStyle) return null;
        const s = runningStyle.toUpperCase();
        if (s.includes("FRONT") || s.includes("LEAD") || s.includes("RUNNER") || s.includes("先行") || s.includes("逃")) return 0;
        if (s.includes("STALKER") || s.includes("PACE") || s.includes("差") || s.includes("跟")) return 1;
        if (s.includes("CLOSER") || s.includes("RUSH") || s.includes("STRETCH") || s.includes("追") || s.includes("冲")) return 2;
        if (s.includes("BATTLER") || s.includes("VERSATILE") || s.includes("HOLD") || s.includes("斗")) return 3;
        return null;
    }

    /** 静态辅助：根据种子、马号与模式计算战术原型 */
    public static computeArchetype(seed: number, horseNo: number, isQuinellaMode = false): number {
        return Math.abs((seed + horseNo * 7 + (isQuinellaMode ? 13 : 3)) % 4);
    }

    /** 静态辅助：获取战术原型中英文描述与标识 */
    public static getArchetypeName(archetype: number, isEn = false): { name: string; tag: string; icon: string } {
        if (isEn) {
            switch (archetype % 4) {
                case 0:
                    return { name: "Front Runner", tag: "Lead", icon: "⚡" };
                case 1:
                    return { name: "Stalker", tag: "Pace", icon: "🎯" };
                case 2:
                    return { name: "Closer", tag: "Rush", icon: "🔥" };
                case 3:
                default:
                    return { name: "Battler", tag: "Grind", icon: "🛡️" };
            }
        }
        switch (archetype % 4) {
            case 0:
                return { name: "领跑突击", tag: "先行", icon: "⚡" };
            case 1:
                return { name: "跟跑突围", tag: "差行", icon: "🎯" };
            case 2:
                return { name: "后发冲刺", tag: "追击", icon: "🔥" };
            case 3:
            default:
                return { name: "强力缠斗", tag: "斗士", icon: "🛡️" };
        }
    }

    /** 使用服务端校准后的当前时间计算动态超车与冲刺动画进度。 */
    public syncToServer(nowMs: number): void {
        // 即便已过终点，仍驱动已产生的蹄印继续完成 3 秒渐隐淡出
        this.updateHoofprints(nowMs);

        if (!this.running) {
            return;
        }

        const elapsedSeconds = Math.max(0, (nowMs - this.raceStartMs) / 1000);
        const progress = this.calculateDynamicProgress(elapsedSeconds);

        this.apply(progress, nowMs);

        if (elapsedSeconds >= this.finishTime || progress >= 1) {
            this.running = false;
            this.clearDustTrail();
        }
    }

    /**
     * 计算非线性动态战术轨迹进度。
     * 严格数学边界约束：
     * u = 0 时，delta = 0，progress = 0；
     * u = 1 (即达到 finishTime) 时，delta = 0，progress = 1.0；
     * 100% 遵从服务端结算权威，同时在比赛中段实现真实领跑交替与反超！
     */
    private calculateDynamicProgress(elapsedSeconds: number): number {
        if (elapsedSeconds <= 0) return 0;
        if (elapsedSeconds >= this.finishTime) return 1.0;

        const u = Math.max(0, Math.min(1.0, elapsedSeconds / this.finishTime));
        // 基础平滑 S 曲线
        const baseEased = u * u * (3 - 2 * u);

        // 边界窗函数：在起点(0)和终点(1)处严格归零
        const windowFactor = Math.sin(Math.PI * u);

        // 四种奔跑战术原型
        let styleCurve = 0;
        switch (this.archetype) {
            case 0: // 领跑突击型 (Front-Runner): 起步爆发力强，前程狂飙拉开差距，后程略显疲惫
                styleCurve = Math.sin(Math.PI * u) * (1 - u);
                break;
            case 1: // 跟跑突围型 (Stalker): 隐忍中前程，在 55%~75% 处掀起波澜反超
                styleCurve = Math.sin(Math.PI * 2 * u) * 0.5 + Math.sin(Math.PI * u) * 0.2;
                break;
            case 2: // 后发制人冲刺型 (Deep Closer): 前半程留力蓄势，最后 35% 终点直道爆发惊天逆转
                styleCurve = -Math.sin(Math.PI * u) * (1 - u) * 0.75 + Math.sin(Math.PI * u) * Math.pow(u, 1.4) * 1.5;
                break;
            case 3: // 强力缠斗型 (Grinder): 多波次起伏，在多马混战中咬住领先者
            default:
                styleCurve = Math.sin(Math.PI * 3 * u) * 0.4 + Math.sin(Math.PI * u) * 0.3;
                break;
        }

        // 连赢模式下双雄争霸更激烈，微幅放大中程交锋振幅
        const amplitude = this.isQuinellaMode ? 0.082 : 0.068;
        const delta = amplitude * windowFactor * styleCurve;

        const rawProgress = Math.max(0, Math.min(1.0, baseEased + delta));
        // 单调防倒退：马匹失速减速但绝不向后倒滑
        const result = Math.max(this.maxProgressReached, rawProgress);
        this.maxProgressReached = result;
        return result;
    }

    /** 清空扬尘粒子 */
    private clearDustTrail(): void {
        if (this.dustGraphics && this.dustGraphics.isValid) {
            this.dustGraphics.clear();
        }
    }

    /** 清空马蹄印痕迹 */
    private clearHoofprints(): void {
        this.hoofprints.length = 0;
        this.lastHoofprintX = -999;
        if (this.hoofprintsG && this.hoofprintsG.isValid) {
            this.hoofprintsG.clear();
        }
    }

    /** 更新跑道上 3 秒渐隐淡出的马蹄凹痕 */
    private updateHoofprints(nowMs: number): void {
        if (!this.hoofprintsG || !this.hoofprintsG.isValid) return;

        // 移除超过 3000ms (3.0秒) 生命周期的陈旧蹄印
        while (this.hoofprints.length > 0 && nowMs - this.hoofprints[0].createdAt >= 3000) {
            this.hoofprints.shift();
        }

        this.hoofprintsG.clear();
        if (this.hoofprints.length === 0) return;

        for (const hp of this.hoofprints) {
            const age = nowMs - hp.createdAt;
            if (age >= 3000) continue;
            // 随时间线性由 180 渐隐至 0
            const alpha = Math.floor(180 * (1 - age / 3000));
            if (alpha <= 0) continue;

            // 1. 马蹄铁 U 形外凸凹槽 (Horseshoe Arch，结合 2.5D 深度缩放)
            this.hoofprintsG.strokeColor = new Color(68, 42, 24, alpha);
            this.hoofprintsG.lineWidth = 1.8 * this.depthScale;
            this.hoofprintsG.arc(hp.x, hp.y, 4.2 * this.depthScale, -Math.PI * 0.7, Math.PI * 0.7, false);
            this.hoofprintsG.stroke();

            // 2. 马蹄深压泥土暗色凹陷核心
            HorseController._hoofprintCoreColor.a = Math.floor(alpha * 0.65);
            this.hoofprintsG.fillColor = HorseController._hoofprintCoreColor;
            this.hoofprintsG.circle(hp.x - 0.8 * this.depthScale, hp.y, 2.0 * this.depthScale);
            this.hoofprintsG.fill();
        }
    }

    /** 更新动态沙尘粒子拖尾 */
    private updateDustTrail(progress: number): void {
        if (!this.horseVisual || !this.horseVisual.isValid) return;
        if (!this.dustTrailNode || !this.dustTrailNode.isValid) {
            this.dustTrailNode = new Node("DustTrail");
            this.dustTrailNode.layer = this.horseVisual.layer;
            this.horseVisual.addChild(this.dustTrailNode);
            this.dustTrailNode.setPosition(-20, -10, 0);
            this.dustGraphics = this.dustTrailNode.addComponent(Graphics);
        }

        if (!this.dustGraphics) return;
        this.dustGraphics.clear();

        if (!this.running || progress <= 0.02 || progress >= 0.98) {
            return;
        }

        // 动态扬尘拖尾粒子：随着赛马奔驰加速而变得更加剧烈与浓密 (按 2.5D 深度缩放)
        const intensity = 0.5 + progress * 0.5;
        const seed = Math.sin(progress * 50);
        const ds = this.depthScale;

        // 粒子 1：靠近马蹄的近景浓缩尘土团 (基于预分配对象零 GC)
        HorseController._dustColor1.a = Math.floor(165 * intensity);
        this.dustGraphics.fillColor = HorseController._dustColor1;
        this.dustGraphics.circle((-6 + seed * 2.5) * ds, -2 * ds, (5.0 + intensity * 4.0) * ds);
        this.dustGraphics.fill();

        // 粒子 2：中景飞扬翻滚沙粒
        HorseController._dustColor2.a = Math.floor(110 * intensity);
        this.dustGraphics.fillColor = HorseController._dustColor2;
        this.dustGraphics.circle((-16 - seed * 2.2) * ds, (2 + seed * 1.5) * ds, (7.5 + intensity * 5.0) * ds);
        this.dustGraphics.fill();

        // 粒子 3：上浮消散的轻盈尘土云
        HorseController._dustColor3.a = Math.floor(65 * intensity);
        this.dustGraphics.fillColor = HorseController._dustColor3;
        this.dustGraphics.circle((-28 + seed * 3.5) * ds, (5 + seed * 2.0) * ds, (9.5 + intensity * 6.0) * ds);
        this.dustGraphics.fill();

        // 粒子 4：尾部随风飘散微弱尘雾
        HorseController._dustColor4.a = Math.floor(35 * intensity);
        this.dustGraphics.fillColor = HorseController._dustColor4;
        this.dustGraphics.circle((-42 - seed * 2.0) * ds, 7 * ds, (12.0 + intensity * 6.5) * ds);
        this.dustGraphics.fill();
    }

    /** 应用动态计算出的坐标与扬尘视觉。 */
    private apply(progress: number, nowMs?: number): void {
        const posX = -270 + 540 * progress;
        this.currentProgress = progress;
        this.currentLaneX = posX;

        // 1. 同步驱动 3D 纯血马物理实体 (HorseEntity3D) 在 3D 空间的位置与姿态
        const posX3D = RaceTrack3D.getProgressX(progress);
        const laneZ3D = RaceTrack3D.getLaneZ(this.laneIndex >= 0 ? this.laneIndex : (this.horseNo - 1) % 6);
        this.position3D.set(posX3D, 0, laneZ3D);

        if (this.visual3D && this.visual3D.isValid) {
            this.visual3D.node.setPosition(posX3D, 0, laneZ3D);

            if (this.running) {
                if (progress >= 0.97) {
                    this.visual3D.setAction("Finish", 1.35);
                } else if (progress >= 0.65 || (this.archetype === 2 && progress >= 0.55)) {
                    this.visual3D.setSprint(true);
                } else if (this.archetype === 0 && progress < 0.35) {
                    this.visual3D.setSprint(true);
                } else {
                    this.visual3D.setAction("Gallop", 1.05);
                }
            }
        }

        const visual = this.horseVisual;
        if (!visual || !visual.isValid || !(visual as unknown as { _lpos?: unknown })._lpos) {
            return;
        }

        // 奔跑中拟真四蹄腾空起伏与战术侧向微偏置 (Tactical Lane Micro-Veer & Stride Suspension)
        let posY = 0;
        if (this.running && progress > 0.01 && progress < 0.99) {
            // 四蹄步频起伏 (Gallop Stride Bounce: 频率随冲刺加快)
            const gallopPhase = (progress * (progress >= 0.70 ? 110 : 80) + this.horseNo * 1.5) % (Math.PI * 2);
            const gallopBob = Math.sin(gallopPhase) * (progress >= 0.70 ? 2.4 : 1.5) * this.depthScale;

            // 战术道次微偏置：真实赛马贴内道与外道突围侧向机动 (不超过 ±3.5px，绝不越出自身道次)
            let laneVeer = 0;
            if (this.archetype === 0) {
                // 领跑型：极具侵略性紧贴内栏内侧 (-2.2px)
                laneVeer = -2.2 * this.depthScale;
            } else if (this.archetype === 2 && progress >= 0.60) {
                // 冲刺追击型：进入直道后外道大迂回寻找空旷冲线通道 (+2.8px)
                const swing = Math.min(1.0, (progress - 0.60) / 0.16);
                laneVeer = 2.8 * swing * this.depthScale;
            } else if (this.archetype === 1 && progress >= 0.40 && progress < 0.80) {
                // 跟跑突围型：中程跟跑侧切摆动
                laneVeer = Math.sin((progress - 0.40) * Math.PI * 2.5) * 1.8 * this.depthScale;
            }
            posY = gallopBob + laneVeer;
        }

        visual.setPosition(posX, posY, 0);
        this.updateDustTrail(progress);

        // 冲刺撞线高精定格微闪光与终点冲线反馈
        if (this.running && progress >= 0.995 && this.maxProgressReached < 0.995) {
            this.maxProgressReached = 1.0;
            if (this.raceTrack2D && this.raceTrack2D.isValid) {
                const lIdx = this.laneIndex >= 0 ? this.laneIndex : (this.horseNo - 1) % 6;
                const laneY = RaceTrack2D.getLaneY(lIdx);
                this.raceTrack2D.triggerPhotoFinishFlash(posX, laneY);
            }
        }

        // 联动 2D 写实表现组件动作状态机（融合跑法战术原型与对抗状态）
        if (this.running && this.visual2D && this.visual2D.isValid) {
            if (progress >= 0.97) {
                // 临近冲线压线最后一跃：前伸鼻尖全力撞线
                this.visual2D.setAction("Finish", 1.35);
            } else if (this.isDueling && progress > 0.15 && progress < 0.97) {
                // 两马并驾齐驱并线死斗
                this.visual2D.setAction("Head_To_Head", 1.35);
            } else if (progress >= 0.70 || (this.archetype === 2 && progress >= 0.58)) {
                // 直道冲刺阶段：后发追击型或决战直道全力超频
                const sprintSpeed = this.archetype === 2 ? 1.5 : 1.35;
                this.visual2D.setAction("Sprint", sprintSpeed);
            } else if (this.archetype === 0 && progress < 0.32) {
                // 领跑先锋型出闸前程狂飙爆发
                this.visual2D.setAction("Sprint", 1.25);
            } else if (progress > 0.05) {
                const paceSpeed = (this.archetype === 1 && progress > 0.45) ? 1.15 : 1.0;
                this.visual2D.setAction("Accelerate", paceSpeed);
            }
        }

        // 当赛马奔跑且在跑道有效段内时，根据步频生成真实的马蹄印痕（与服务端校准时间基准完全对齐）
        if (this.running && progress > 0.02 && progress < 0.98) {
            if (posX - this.lastHoofprintX >= 24) {
                this.isLeftHoof = !this.isLeftHoof;
                const hpY = (this.isLeftHoof ? -5 : 5) * this.depthScale;
                const hpX = posX - 14;
                const hpTime = nowMs !== undefined ? nowMs : Date.now();

                // 优先交由 RaceTrack2D 单图元合批池统一渲染 (极大降低 6 匹马产生的 DrawCall)
                if (this.raceTrack2D && this.raceTrack2D.isValid) {
                    const lIdx = this.laneIndex >= 0 ? this.laneIndex : (this.horseNo - 1) % 6;
                    const laneY = RaceTrack2D.getLaneY(lIdx);
                    this.raceTrack2D.addUnifiedHoofprint(hpX, laneY + hpY, hpTime, this.depthScale);
                    this.raceTrack2D.emitHoofImpact(hpX, laneY + hpY, progress >= 0.7 ? 1.8 : 1.0, this.depthScale);
                    if (this.isDueling && Math.random() < 0.4) {
                        this.raceTrack2D.emitDuelClash(hpX + 6, laneY, 1.25);
                    }
                } else {
                    this.hoofprints.push({
                        x: hpX,
                        y: hpY,
                        createdAt: hpTime,
                        isLeft: this.isLeftHoof,
                    });
                }
                this.lastHoofprintX = posX;
            }
        }
    }

    protected onDestroy(): void {
        this.clearDustTrail();
        this.clearHoofprints();
        if (this.dustTrailNode && this.dustTrailNode.isValid) {
            this.dustTrailNode.destroy();
            this.dustTrailNode = null;
            this.dustGraphics = null;
        }
        this.visual2D = null;
        this.raceTrack2D = null;
        this.hoofprintsG = null;
    }
}

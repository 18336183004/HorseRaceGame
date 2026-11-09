import {
    _decorator,
    Component,
    Node,
    Camera,
    Vec3,
    math,
} from "cc";
import { RaceTrack3D } from "./RaceTrack3D";

const { ccclass } = _decorator;

export type CameraViewMode = "AUTO" | "PANORAMIC" | "LEADER_CHASE" | "HEAD_ON" | "OVERVIEW";

/**
 * 3D 赛马竞技场智能运镜导播系统 (CameraDirector3D)
 *
 * 核心特性：
 * 1. AUTO (🎬 智能导播): 依据赛程 5 大核心阶段（起跑破门 -> 提速抢位 -> 中程拉锯 -> 直道绝杀 -> 冲线定格）智能自动平滑切镜。
 * 2. PANORAMIC (🎥 广播全景): 国际赛马标准侧向平滑横移跟踪，随赛程递进动态推近焦距与调整机位高度。
 * 3. LEADER_CHASE (🏇 贴身追随): 第一人称领跑战驹第三人称极速低空贴身追焦，强力俯仰与蹄声颠簸震颤。
 * 4. HEAD_ON (🎯 迎面冲锋): 前置逆向机位迎面退行跟拍，正对狂飙而来的千军万马，带来震撼的面冲感。
 * 5. OVERVIEW (🦅 鸟瞰全局): 高空掌控 6 条道次实时排位与内道反超。
 */
@ccclass("CameraDirector3D")
export class CameraDirector3D extends Component {
    private targetCameraNode: Node | null = null;
    private currentMode: CameraViewMode = "AUTO";

    // 导播目标位置与焦点缓冲
    private currentPos: Vec3 = new Vec3();
    private targetPos: Vec3 = new Vec3();
    private currentLookTarget: Vec3 = new Vec3();
    private targetLookTarget: Vec3 = new Vec3();

    // 赛马群领先者与重心追踪数据
    private leaderX: number = RaceTrack3D.START_X;
    private leaderZ: number = 0;
    private packProgress: number = 0;
    private isPhotoFinishActive: boolean = false;

    // 平滑阻尼系数与微动参数
    private smoothFactor: number = 5.5;
    private targetFov: number = 38;
    private rumbleTime: number = 0;
    private idleTime: number = 0;

    public setCameraNode(camNode: Node): void {
        this.targetCameraNode = camNode;
        this.currentPos.set(camNode.position);
        this.resetToStart();
    }

    public getViewMode(): CameraViewMode {
        return this.currentMode;
    }

    public setViewMode(mode: CameraViewMode): void {
        this.currentMode = mode;
    }

    /** 循环切换机位视角：智能导播 -> 广播全景 -> 贴身追随 -> 迎面冲锋 -> 鸟瞰全局 */
    public cycleViewMode(): string {
        switch (this.currentMode) {
            case "AUTO":
                this.currentMode = "PANORAMIC";
                return "🎥 广播全景 (BROADCAST)";
            case "PANORAMIC":
                this.currentMode = "LEADER_CHASE";
                return "🏇 贴身追随 (CHASE)";
            case "LEADER_CHASE":
                this.currentMode = "HEAD_ON";
                return "🎯 迎面冲锋 (HEAD-ON)";
            case "HEAD_ON":
                this.currentMode = "OVERVIEW";
                return "🦅 鸟瞰全局 (OVERVIEW)";
            case "OVERVIEW":
            default:
                this.currentMode = "AUTO";
                return "🎬 智能导播 (AUTO)";
        }
    }

    /** 更新赛马群最新位置供运镜解算 */
    public updateRaceTracking(leaderX: number, leaderZ: number, progress: number, photoFinish = false): void {
        this.leaderX = Number.isFinite(leaderX) ? leaderX : RaceTrack3D.START_X;
        this.leaderZ = Number.isFinite(leaderZ) ? leaderZ : 0;
        this.packProgress = Math.max(0, Math.min(1.0, progress));
        this.isPhotoFinishActive = photoFinish;
    }

    /** 重置摄影机至发令待机视角 */
    public resetToStart(): void {
        this.leaderX = RaceTrack3D.START_X;
        this.leaderZ = 0;
        this.packProgress = 0;
        this.isPhotoFinishActive = false;
        this.idleTime = 0;

        // 起点前侧方 3/4 黄金视角：清晰尽收六匹入闸名驹
        this.targetPos.set(RaceTrack3D.START_X - 7.5, 4.2, 11.8);
        this.targetLookTarget.set(RaceTrack3D.START_X + 3.0, 1.4, 0);

        this.currentPos.set(this.targetPos);
        this.currentLookTarget.set(this.targetLookTarget);

        if (this.targetCameraNode) {
            this.targetCameraNode.setPosition(this.currentPos);
            this.targetCameraNode.lookAt(this.currentLookTarget);
            const cam = this.targetCameraNode.getComponent(Camera);
            if (cam) cam.fov = 40;
        }
    }

    protected update(dt: number): void {
        if (!this.targetCameraNode) return;

        // 1. 评估当前机位理想位置与焦点
        this.evaluateCameraTransform(dt);

        // 2. 电影级平滑阻尼插值 (Damped Lerp)
        const t = Math.min(1.0, dt * this.smoothFactor);
        Vec3.lerp(this.currentPos, this.currentPos, this.targetPos, t);
        Vec3.lerp(this.currentLookTarget, this.currentLookTarget, this.targetLookTarget, t);

        // 3. 奔跑震颤与发令待机呼吸摇臂
        let camPosY = this.currentPos.y;
        let camPosX = this.currentPos.x;

        if (this.packProgress <= 0.01) {
            // 待机呼吸微动摇臂：画面绝不凝固僵死
            this.idleTime += dt;
            camPosY += Math.sin(this.idleTime * 1.4) * 0.08;
            camPosX += Math.cos(this.idleTime * 0.9) * 0.12;
        } else if (this.packProgress > 0.01 && this.packProgress < 0.98) {
            // 策马狂奔马蹄颠簸震颤
            this.rumbleTime += dt;
            const rumbleFreq = this.currentMode === "LEADER_CHASE" ? 22.0 : 15.0;
            const rumbleAmp = this.currentMode === "LEADER_CHASE" ? 0.055 : 0.024;
            camPosY += Math.sin(this.rumbleTime * rumbleFreq) * rumbleAmp;
        }

        this.targetCameraNode.setPosition(camPosX, camPosY, this.currentPos.z);
        this.targetCameraNode.lookAt(this.currentLookTarget);

        // 4. 镜头视场角平滑缩放
        const cam = this.targetCameraNode.getComponent(Camera);
        if (cam) {
            cam.fov = math.lerp(cam.fov, this.targetFov, Math.min(1.0, dt * 4.5));
        }
    }

    private evaluateCameraTransform(dt: number): void {
        // 临近终点绝杀裁决强制定格
        if (this.isPhotoFinishActive) {
            this.targetPos.set(RaceTrack3D.FINISH_X + 0.5, 2.5, 9.8);
            this.targetLookTarget.set(RaceTrack3D.FINISH_X, 1.3, 0);
            this.smoothFactor = 8.0;
            this.targetFov = 26;
            return;
        }

        switch (this.currentMode) {
            case "AUTO": {
                // 🎬 智能导播模式：依赛程 5 大核心阶段自动平滑切镜
                if (this.packProgress < 0.10) {
                    // Phase 1: 起跑破门爆发 (0% ~ 10%) - 闸箱前侧方微仰视广角
                    this.targetPos.set(RaceTrack3D.START_X - 6.5, 3.8, 10.5);
                    this.targetLookTarget.set(RaceTrack3D.START_X + 4.5, 1.4, 0);
                    this.smoothFactor = 5.5;
                    this.targetFov = 40;
                } else if (this.packProgress < 0.35) {
                    // Phase 2: 狂飙抢位低空滑轨 (10% ~ 35%) - 侧前方仰视狂奔马群
                    this.targetPos.set(this.leaderX + 6.8, 2.6, 11.5);
                    this.targetLookTarget.set(this.leaderX - 1.2, 1.4, this.leaderZ * 0.4);
                    this.smoothFactor = 5.8;
                    this.targetFov = 36;
                } else if (this.packProgress < 0.68) {
                    // Phase 3: 中程拉锯广播全景 (35% ~ 68%) - 大景深侧向全景跟随
                    this.targetPos.set(this.leaderX - 2.5, 6.8, 16.2);
                    this.targetLookTarget.set(this.leaderX + 4.5, 1.3, 0);
                    this.smoothFactor = 5.2;
                    this.targetFov = 38;
                } else if (this.packProgress < 0.92) {
                    // Phase 4: 直道冲刺近身追击 (68% ~ 92%) - 领头战驹第三人称斜后方贴身追随
                    this.targetPos.set(this.leaderX - 5.8, 2.8, this.leaderZ * 0.35 + 3.8);
                    this.targetLookTarget.set(this.leaderX + 4.8, 1.5, this.leaderZ * 0.5);
                    this.smoothFactor = 6.5;
                    this.targetFov = 44 - (this.packProgress - 0.68) * 16.0;
                } else {
                    // Phase 5: 毫厘压线绝杀冲线 (92% ~ 100%) - 终点激光定格机位
                    this.targetPos.set(RaceTrack3D.FINISH_X + 0.6, 2.5, 9.8);
                    this.targetLookTarget.set(RaceTrack3D.FINISH_X, 1.3, 0);
                    this.smoothFactor = 7.8;
                    this.targetFov = 26;
                }
                break;
            }

            case "PANORAMIC": {
                // 🎥 广播全景模式：侧向跟踪，随赛程动态微调距离与俯仰
                const camX = this.leaderX - 2.5;
                const camY = 7.8 - this.packProgress * 1.8;
                const camZ = 16.8 - this.packProgress * 3.5;
                this.targetPos.set(camX, camY, camZ);
                this.targetLookTarget.set(this.leaderX + 3.5, 1.3, 0);
                this.smoothFactor = 5.2;
                this.targetFov = 38 - this.packProgress * 6.0;
                break;
            }

            case "LEADER_CHASE": {
                // 🏇 贴身追随模式：第三人称跟随，冲刺时低伏拉近
                const isSprint = this.packProgress >= 0.65;
                const followX = this.leaderX - (isSprint ? 4.8 : 6.0);
                const followY = 3.2 - (isSprint ? 0.8 : 0);
                const followZ = this.leaderZ * 0.35 + (isSprint ? 2.8 : 3.6);
                this.targetPos.set(followX, followY, followZ);
                this.targetLookTarget.set(this.leaderX + 4.5, 1.4, this.leaderZ * 0.5);
                this.smoothFactor = 6.2;
                this.targetFov = isSprint ? 42 : 44;
                break;
            }

            case "HEAD_ON": {
                // 🎯 迎面冲锋模式：逆向倒车跟拍，正对狂奔而来的马群
                const headX = this.leaderX + 13.0 - this.packProgress * 3.0;
                const headY = 2.4;
                const headZ = this.leaderZ * 0.25 + 2.8;
                this.targetPos.set(headX, headY, headZ);
                this.targetLookTarget.set(this.leaderX - 1.5, 1.4, this.leaderZ * 0.4);
                this.smoothFactor = 5.8;
                this.targetFov = 35;
                break;
            }

            case "OVERVIEW":
            default: {
                // 🦅 鸟瞰全局模式：高空战术视角，随赛程平滑推进
                const overX = this.leaderX - 1.5;
                const overY = 18.5 - this.packProgress * 3.0;
                const overZ = 10.5 - this.packProgress * 2.0;
                this.targetPos.set(overX, overY, overZ);
                this.targetLookTarget.set(this.leaderX + 4.0, 0.4, 0);
                this.smoothFactor = 5.0;
                this.targetFov = 34;
                break;
            }
        }
    }
}

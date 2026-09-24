/**
 * 《西部边境赛马会》移动端/全平台触感震动反馈系统 (WestHaptics)。
 * 遵循 racegame-project-standards，严禁 any。
 *
 * 架构特点：
 * 1. 严格全平台安全降级：桌面端、不支持 navigator.vibrate 或权限受限设备静默无感跳过；
 * 2. 精确触感模式库：涵盖筹码落桌、发令后坐力、直道马蹄心跳冲刺、拉断彩带爆震与定格绝杀紧张感；
 * 3. 节流与冷却机制：防连续快速高频触发引起的设备电量损耗与系统截断。
 */
export class WestHaptics {
    private static enabled: boolean = true;
    private static lastVibrateTime: number = 0;

    /** 检查当前运行环境是否支持 Vibration API */
    public static isSupported(): boolean {
        return (
            typeof window !== "undefined" &&
            typeof navigator !== "undefined" &&
            typeof navigator.vibrate === "function"
        );
    }

    /** 设置震动开关状态 */
    public static setEnabled(enabled: boolean): void {
        this.enabled = enabled;
    }

    /** 获取当前震动开关状态 */
    public static isEnabled(): boolean {
        return this.enabled;
    }

    /**
     * 底层震动驱动，附带全局开关与防震荡冷却检测
     * @param pattern 震动毫秒数或交替阵列 [震动, 暂停, 震动...]
     * @param minIntervalMs 两次震动之间的最小安全间隔 (默认 40ms)
     */
    public static vibrate(pattern: number | number[], minIntervalMs: number = 40): boolean {
        if (!this.enabled || !this.isSupported()) {
            return false;
        }

        const now = Date.now();
        if (now - this.lastVibrateTime < minIntervalMs) {
            return false;
        }

        try {
            const success = navigator.vibrate(pattern);
            if (success) {
                this.lastVibrateTime = now;
            }
            return success;
        } catch {
            return false;
        }
    }

    /** 极轻微点触（15ms）：用于通用 UI 按钮、标签页切换、手势轻抚反馈 */
    public static tap(): void {
        this.vibrate(15, 30);
    }

    /** 下注与筹码落桌触感（25ms）：拟真砝码压在木质桌面上的清脆触感 */
    public static betClick(): void {
        this.vibrate(25, 35);
    }

    /** 发令枪响与起跑出闸（[45, 25, 75]）：模拟后坐力与冲闸瞬间的沉重震颤 */
    public static starterGun(): void {
        this.vibrate([45, 25, 75], 300);
    }

    /** 直道冲刺心跳脉冲（[25, 55]）：模拟高频马蹄蹬踏与心跳共振 */
    public static sprintPulse(): void {
        this.vibrate([25, 55], 160);
    }

    /** 冲线拉断终点彩带爆震（[80, 40, 120]）：第一名撞线夺冠的爆发式狂欢三段震动 */
    public static ribbonSnap(): void {
        this.vibrate([80, 40, 120], 500);
    }

    /** 毫厘绝杀判读紧绷感（[30, 80, 30]）：Photo-Finish 扫描线划过时的紧绷停顿感 */
    public static photoFinishTension(): void {
        this.vibrate([30, 80, 30], 400);
    }

    /** 立即停止当前正在运行的任何震动 */
    public static stop(): void {
        if (this.isSupported()) {
            try {
                navigator.vibrate(0);
            } catch {
                // ignore
            }
        }
    }
}

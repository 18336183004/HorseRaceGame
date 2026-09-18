/**
 * 《西部边境赛马会》性能预算与质量分级系统 (v2.1)
 * 遵循 racegame-project-standards，严禁 any。
 *
 * 质量预算表：
 * - high (旗舰机): 粒子 100%, 3层环境混音, 复音数 8, 后处理全开 (暗角 + 光照)
 * - medium (主流机): 粒子 60%, 2层环境混音, 复音数 6, 只保留暗角
 * - low (千元机): 粒子 30%, 1层环境混音, 复音数 4, 关闭后处理
 * - power_save (省电): 粒子 0, 仅 BGM, 复音数 2, 关闭后处理
 */

export type QualityTier = "high" | "medium" | "low" | "power_save";

export interface QualityProfile {
    tier: QualityTier;
    labelZh: string;
    particleRatio: number;
    ambienceLayers: number;
    polyphonyLimit: number;
    enableVignette: boolean;
    enableLighting: boolean;
}

export class WestPerformance {
    private static currentTier: QualityTier = "medium";

    private static readonly PROFILES: Record<QualityTier, QualityProfile> = {
        high: {
            tier: "high",
            labelZh: "高画质 (旗舰)",
            particleRatio: 1.0,
            ambienceLayers: 3,
            polyphonyLimit: 8,
            enableVignette: true,
            enableLighting: true,
        },
        medium: {
            tier: "medium",
            labelZh: "平衡 (推荐)",
            particleRatio: 0.6,
            ambienceLayers: 2,
            polyphonyLimit: 6,
            enableVignette: true,
            enableLighting: false,
        },
        low: {
            tier: "low",
            labelZh: "流畅 (千元机)",
            particleRatio: 0.3,
            ambienceLayers: 1,
            polyphonyLimit: 4,
            enableVignette: false,
            enableLighting: false,
        },
        power_save: {
            tier: "power_save",
            labelZh: "极省电 (低功耗)",
            particleRatio: 0.0,
            ambienceLayers: 0,
            polyphonyLimit: 2,
            enableVignette: false,
            enableLighting: false,
        },
    };

    /** 初始化或从本地缓存加载画质等级 */
    public static init(): void {
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("racegame.qualityTier") as QualityTier | null;
            if (saved && saved in this.PROFILES) {
                this.currentTier = saved;
                return;
            }
        }

        // 启动时硬件基准探测 (CPU核心数与环境)
        this.currentTier = this.detectOptimalTier();
    }

    private static detectOptimalTier(): QualityTier {
        if (typeof navigator === "undefined") {
            return "medium";
        }

        const cores = navigator.hardwareConcurrency || 4;
        // 旗舰机标准：8核及以上
        if (cores >= 8) {
            return "high";
        }
        // 主流机：4核-6核
        if (cores >= 4) {
            return "medium";
        }
        // 低端设备：双核及以下
        return "low";
    }

    public static setTier(tier: QualityTier): void {
        this.currentTier = tier;
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("racegame.qualityTier", tier);
        }
    }

    public static getTier(): QualityTier {
        return this.currentTier;
    }

    public static getProfile(): QualityProfile {
        return this.PROFILES[this.currentTier];
    }

    /** 粒子缩减过滤辅助方法 */
    public static shouldSpawnParticle(index: number): boolean {
        const ratio = this.PROFILES[this.currentTier].particleRatio;
        if (ratio <= 0) return false;
        if (ratio >= 1.0) return true;
        return (index % Math.round(1 / ratio)) === 0;
    }

    /** 当前最大允许音效复音数 */
    public static getPolyphonyLimit(): number {
        return this.PROFILES[this.currentTier].polyphonyLimit;
    }

    /** 环境混音层数限制 */
    public static getAmbienceLayers(): number {
        return this.PROFILES[this.currentTier].ambienceLayers;
    }
}

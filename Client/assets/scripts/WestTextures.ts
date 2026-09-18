import { Color, Graphics } from "cc";

/**
 * 《西部边境赛马会》程序化矢量材质与纹理引擎 (v2.1)
 * 遵循 racegame-project-standards，严禁 any。
 *
 * 纹理是西部的骨骼与质地，杜绝光滑平整塑料感：
 * 1. 亚麻布 (Linen): 浅底浅网格纤维，赋予地表面板手工纺织感；
 * 2. 牛皮纸纤维 (Parchment Fiber): 悬赏卡与羊皮纸的自然草浆与纤维暗痕；
 * 3. 旧木纹 (Wood Grain): 带有年轮波纹、木结疤痕与干燥裂隙的沙龙实木；
 * 4. 黄铜氧化痕 (Brass Patina): 金属扣件、铆钉边缘的风化氧化与磨损高光；
 * 5. 活字墨滴微渗 (Letterpress Noise): 模拟铅字活字印刷的微弱墨晕飞溅。
 */
export class WestTextures {
    /**
     * 为浅色底板注入细腻亚麻布 (Linen) 交叉纤维经纬线
     */
    public static applyLinenTexture(
        g: Graphics,
        width: number,
        height: number,
        density = 16,
        alpha = 18,
    ): void {
        const halfW = width / 2;
        const halfH = height / 2;
        const step = Math.max(12, density);

        // 经线 (纵向微细纤维)
        g.strokeColor = new Color(156, 102, 68, alpha);
        g.lineWidth = 1.0;
        for (let x = -halfW; x <= halfW; x += step) {
            const jitter = Math.sin(x * 0.4) * 2;
            g.moveTo(x + jitter, -halfH);
            g.lineTo(x - jitter, halfH);
            g.stroke();
        }

        // 纬线 (横向微细纤维)
        g.strokeColor = new Color(221, 184, 146, Math.floor(alpha * 1.2));
        g.lineWidth = 0.8;
        for (let y = -halfH; y <= halfH; y += step) {
            const jitter = Math.cos(y * 0.3) * 2;
            g.moveTo(-halfW, y + jitter);
            g.lineTo(halfW, y - jitter);
            g.stroke();
        }
    }

    /**
     * 为牛皮纸卡片、通缉令与账本注入不规则草浆纤维与自然絮状杂质
     */
    public static applyParchmentFiber(
        g: Graphics,
        width: number,
        height: number,
        fiberCount = 36,
    ): void {
        const halfW = width / 2;
        const halfH = height / 2;

        for (let i = 0; i < fiberCount; i++) {
            // 伪随机确定纤维位置
            const seed = (i * 9301 + 49297) % 233280;
            const normX = (seed / 233280) * 2 - 1;
            const seedY = ((i + 17) * 49297 + 9301) % 233280;
            const normY = (seedY / 233280) * 2 - 1;

            const cx = normX * (halfW - 20);
            const cy = normY * (halfH - 20);
            const len = 6 + (seed % 14);
            const angle = (seed % 360) * (Math.PI / 180);

            // 褐色植物碎屑细纤维
            g.strokeColor = new Color(107, 79, 58, 40 + (seed % 35));
            g.lineWidth = 0.9;
            g.moveTo(cx, cy);
            g.lineTo(
                cx + Math.cos(angle) * len + (seed % 3 - 1),
                cy + Math.sin(angle) * len + (seed % 3 - 1),
            );
            g.stroke();

            // 微弱暗点杂质
            if (i % 3 === 0) {
                g.fillColor = new Color(62, 39, 35, 30);
                g.circle(cx - 2, cy + 1, 1.2);
                g.fill();
            }
        }
    }

    /**
     * 为木板、操作栏与柜台注入逼真旧橡木年轮、波状木纹与结疤
     */
    public static applyWoodGrain(
        g: Graphics,
        width: number,
        height: number,
        knots = 2,
    ): void {
        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 波浪状平行年轮纹路
        const lines = Math.max(3, Math.floor(height / 14));
        const lineStep = height / (lines + 1);

        g.lineWidth = 1.2;
        for (let l = 0; l < lines; l++) {
            const baseY = -halfH + (l + 1) * lineStep;
            g.strokeColor = new Color(70, 40, 20, 45 + (l % 3) * 15);

            g.moveTo(-halfW, baseY);
            const segments = 6;
            const segW = width / segments;
            for (let s = 1; s <= segments; s++) {
                const segX = -halfW + s * segW;
                const wave = Math.sin(s * 1.5 + l * 0.8) * 4.5;
                g.lineTo(segX, baseY + wave);
            }
            g.stroke();
        }

        // 2. 天然木质结疤 (Knots)
        for (let k = 0; k < knots; k++) {
            const knotX = (k === 0 ? -1 : 1) * (halfW * 0.35);
            const knotY = (k % 2 === 0 ? -1 : 1) * (halfH * 0.25);

            // 结疤中心深木色硬核
            g.fillColor = new Color(48, 25, 12, 110);
            g.circle(knotX, knotY, 3.8);
            g.fill();

            // 环绕结疤的环状生长轮
            g.strokeColor = new Color(68, 38, 20, 65);
            g.lineWidth = 1.0;
            g.arc(knotX, knotY, 8.5, 0, Math.PI * 2, false);
            g.stroke();
            g.arc(knotX, knotY, 14.0, -Math.PI * 0.8, Math.PI * 0.8, false);
            g.stroke();
        }
    }

    /**
     * 为黄铜五金、铆钉与金属外框注入金属氧化铜绿斑驳与磨损高光
     */
    public static applyBrassPatina(
        g: Graphics,
        width: number,
        height: number,
    ): void {
        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 边缘纳瓦霍绿松石色铜绿氧化痕 (Verdigris Patina，控制在极小边缘)
        g.strokeColor = new Color(42, 157, 143, 40); // 纳瓦霍古铜绿微痕
        g.lineWidth = 1.2;
        g.moveTo(-halfW + 4, halfH - 2);
        g.lineTo(-halfW + 28, halfH - 2);
        g.stroke();

        g.moveTo(halfW - 28, -halfH + 2);
        g.lineTo(halfW - 4, -halfH + 2);
        g.stroke();

        // 2. 磨损拉丝反光微线条
        g.strokeColor = new Color(255, 235, 180, 55);
        g.lineWidth = 0.8;
        g.moveTo(-halfW + 10, 0);
        g.lineTo(halfW - 10, 0);
        g.stroke();
    }

    /**
     * 为活字印刷标题与悬赏通缉令注入活字微渗与细微墨点飞溅 (Letterpress Noise)
     */
    public static applyLetterpressNoise(
        g: Graphics,
        cx: number,
        cy: number,
        radius = 40,
        splatterCount = 12,
    ): void {
        for (let i = 0; i < splatterCount; i++) {
            const angle = (i / splatterCount) * Math.PI * 2 + (i % 5) * 0.3;
            const dist = radius * 0.6 + (i % 7) * 4;
            const px = cx + Math.cos(angle) * dist;
            const py = cy + Math.sin(angle) * dist;
            const dotR = 0.6 + (i % 3) * 0.4;

            g.fillColor = new Color(62, 39, 35, 25 + (i % 4) * 15);
            g.circle(px, py, dotR);
            g.fill();
        }
    }
}

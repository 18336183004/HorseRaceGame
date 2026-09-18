import { Color, Graphics, Node, UITransform } from "cc";
import { WestTextures } from "./WestTextures";
import { WestPerformance } from "./WestPerformance";

/**
 * 《西部边境赛马会》UI 专属调色与视觉系统 (v2.1 品牌重塑).
 * 核心策略：「一街八铺」统一沙色基底 (SAND_LIGHT / 篝火深沙) + 单页 ≤15% 独占强调色与特色商铺招牌/道具锚点。
 * 文化规范：绿松石 (TURQUOISE) 仅用于马具扣件与银饰饰品 (单屏 ≤ 5%)，方巾红 (BANDANA_RED) 为主行动牛仔色。
 */
export const WestColors = {
    // 1.1 天空与氛围
    SKY_DAWN: new Color(244, 162, 97, 255),        // 登录页日出暖橙 (#F4A261)
    SKY_NOON: new Color(168, 218, 220, 255),       // 晴空青 (#A8DADC)
    SKY_SUNSET: new Color(231, 111, 81, 255),      // 结算页日落珊瑚 (#E76F51)
    SKY_DUSK: new Color(109, 89, 122, 255),        // 结算页暮紫 (#6D597A)

    // 1.2 沙土地基与日光底板 (8 页统一共享基底)
    SAND_LIGHT: new Color(242, 232, 207, 255),     // 统一全街浅色主基底 (#F2E8CF) - 全局公共底色
    SAND_MEDIUM: new Color(221, 184, 146, 255),    // 面板中景、大厅暖沙卡片底 (#DDB892)
    SAND_DEEP: new Color(201, 166, 107, 255),      // 暖木/做旧牛皮替代色 (#C9A66B)
    DUST_BROWN: new Color(176, 137, 104, 255),     // 跑道沙尘、风化旧木 (#B08968)
    HAY_YELLOW: new Color(233, 216, 166, 255),     // 马厩谷仓干草黄 (#E9D8A6)
    HAY_GOLD: new Color(233, 216, 166, 255),       // 马厩干草金黄 (#E9D8A6) - v2.1 规范名

    // 1.3 皮革与实木
    LEATHER_LIGHT: new Color(198, 139, 89, 255),   // 暖皮按钮、明亮酒吧吧台 (#C68B59)
    LEATHER_MEDIUM: new Color(156, 102, 68, 255),  // 经典马鞍棕、外框榫接 (#9C6644)
    LEATHER_DARK: new Color(127, 79, 36, 255),     // 深化阴影与缝纫线 (#7F4F24)
    LEATHER_STITCH: new Color(255, 240, 200, 220), // 马鞍缝纫线亮白针脚

    // 1.4 牛仔点缀高饱和色 (单页轮换强调色 ≤ 15%)
    DENIM_BLUE: new Color(69, 123, 157, 255),      // 边境褪色牛仔布蓝 (#457B9D) - 设置页强调色
    DENIM_DEEP: new Color(29, 53, 87, 255),        // 靛蓝夜间底、石板账房深强调 (#1D3557) - 历史页强调色
    TURQUOISE: new Color(42, 157, 143, 255),       // 纳瓦霍绿松石银饰 (#2A9D8F) - 文化规范：仅用于首饰、银饰、钱包扣、马具扣件、骑手饰品，单屏 ≤ 5%
    BANDANA_RED: new Color(186, 36, 42, 255),      // 牛仔红方巾、主行动按钮 (#BA242A) - 护眼沉稳牛仔红
    BANDANA_DARK: new Color(140, 28, 28, 255),     // 火漆印章深红底盘
    CACTUS_GREEN: new Color(42, 157, 143, 255),    // 荒野仙人掌绿

    // 1.5 金属质感
    BRASS: new Color(212, 163, 115, 255),          // 日晒黄铜铆钉、扣件 (#D4A373) - 成就页强调色
    GOLD_LEAF: new Color(233, 196, 106, 255),      // 胜利金箔、中奖高光 (#E9C46A) - 结算页强调色
    GUNMETAL: new Color(92, 107, 115, 255),        // 左轮弹巢、枪管冷铁 (#5C6B73)
    SHELL_SILVER: new Color(234, 234, 234, 255),   // 弹壳与纳瓦霍纯银反光
    RIVET_BRASS: new Color(255, 230, 160, 255),    // 铆钉高光
    RIVET_SHADOW: new Color(50, 32, 20, 220),      // 铆钉阴影

    // 1.6 纸墨与高对比可读性文字
    INK_BROWN: new Color(62, 39, 35, 255),         // 悬赏令主墨色，比纯黑更暖 (#3E2723) - 统一主文字色
    INK_SOFT: new Color(107, 79, 58, 255),         // 浅褐次级说明文字 (#6B4F3A)
    CHALK_CREAM: new Color(253, 246, 227, 255),    // 黑板奶白粉笔字 (#FDF6E3)
    CREAM: new Color(248, 242, 224, 255),          // 温润日晒羊皮纸主面 (#F8F2E0) - 柔化防眩目
    PARCHMENT_CREASE: new Color(215, 185, 145, 180),// 羊皮纸折痕阴影

    // 1.7 兼容与语义映射别名
    BG_CHARCOAL: new Color(242, 232, 207, 255),    // 映射至 SAND_LIGHT (告别全黑)
    BG_WALNUT: new Color(201, 166, 107, 255),      // 映射至 SAND_DEEP
    BG_DIRT_TRACK: new Color(176, 137, 104, 255),  // 映射至 DUST_BROWN
    BG_MIDNIGHT: new Color(29, 53, 87, 255),       // 映射至 DENIM_DEEP
    WOOD_DARK: new Color(156, 102, 68, 255),       // 映射至 LEATHER_MEDIUM
    WOOD_MEDIUM: new Color(198, 139, 89, 255),     // 映射至 LEATHER_LIGHT
    WOOD_FRAME: new Color(156, 102, 68, 255),      // 映射至 LEATHER_MEDIUM
    WOOD_LIGHT: new Color(221, 184, 146, 255),     // 映射至 SAND_MEDIUM
    WOOD_PLANK_LINE: new Color(80, 50, 30, 160),
    GOLD_BRIGHT: new Color(233, 196, 106, 255),    // 映射至 GOLD_LEAF
    GOLD_METALLIC: new Color(212, 163, 115, 255),  // 映射至 BRASS
    BRASS_HIGHLIGHT: new Color(255, 230, 160, 255),// 铆钉高光
    BRASS_FRAME: new Color(212, 163, 115, 255),    // 映射至 BRASS
    SEAL_RED: new Color(186, 36, 42, 255),         // 映射至 BANDANA_RED
    CHALK_YELLOW: new Color(253, 246, 227, 255),   // 映射至 CHALK_CREAM
    PARCHMENT_LIGHT: new Color(248, 242, 224, 255),// 映射至 CREAM (柔和羊皮)
    PARCHMENT_BASE: new Color(242, 232, 207, 255), // 映射至 SAND_LIGHT
    PARCHMENT_BORDER: new Color(156, 102, 68, 255),// 映射至 LEATHER_MEDIUM
    INK_DARK: new Color(62, 39, 35, 255),          // 映射至 INK_BROWN
    INK_MUTED: new Color(107, 79, 58, 255),       // 映射至 INK_SOFT
    TEXT_GOLD: new Color(233, 196, 106, 255),      // 映射至 GOLD_LEAF
    TEXT_PARCHMENT: new Color(62, 39, 35, 255),    // 浅底对应深墨字 (#3E2723)
    TEXT_MUTED: new Color(107, 79, 58, 255),       // 浅底对应浅褐字 (#6B4F3A)
    TEXT_CHALK: new Color(253, 246, 227, 255),     // 奶白粉笔字
    DESERT_SAGE: new Color(42, 157, 143, 255),     // 映射至 TURQUOISE
    WHITE_STAMP: new Color(255, 255, 255, 255),
    LEATHER_SADDLE: new Color(156, 102, 68, 255),  // 映射至 LEATHER_MEDIUM
    LEATHER_AGED: new Color(127, 79, 36, 255),    // 映射至 LEATHER_DARK
    BADGE_BLUE: new Color(69, 123, 157, 255),      // 映射至 DENIM_BLUE
};

/** 日光与篝火双主题 */
export type ThemeMode = "auto" | "daylight" | "campfire";

export class WestThemeManager {
    private static userMode: ThemeMode = "auto";
    private static effectiveMode: "daylight" | "campfire" = "daylight";

    public static init(): void {
        if (typeof localStorage !== "undefined") {
            const saved = localStorage.getItem("racegame.themeMode") as ThemeMode | null;
            if (saved === "auto" || saved === "daylight" || saved === "campfire") {
                this.userMode = saved;
                this.refreshEffectiveMode();
                return;
            }
        }
        this.userMode = "auto";
        this.refreshEffectiveMode();
    }

    private static refreshEffectiveMode(): void {
        if (this.userMode === "auto") {
            const hour = new Date().getHours();
            this.effectiveMode = (hour >= 6 && hour < 20) ? "daylight" : "campfire";
        } else {
            this.effectiveMode = this.userMode;
        }
    }

    public static setMode(mode: ThemeMode): void {
        this.userMode = mode;
        this.refreshEffectiveMode();
        if (typeof localStorage !== "undefined") {
            localStorage.setItem("racegame.themeMode", mode);
        }
    }

    public static getUserMode(): ThemeMode {
        return this.userMode;
    }

    public static getEffectiveMode(): "daylight" | "campfire" {
        this.refreshEffectiveMode();
        return this.effectiveMode;
    }

    public static getMode(): "daylight" | "campfire" {
        return this.getEffectiveMode();
    }

    public static getBaseBgColor(): Color {
        this.refreshEffectiveMode();
        // 篝火主题：SAND_DEEP #C9A66B 整体压暗 25% 且偏暖红 (#9E7A52)
        return this.effectiveMode === "campfire"
            ? new Color(158, 122, 82, 255)
            : WestColors.SAND_LIGHT;
    }

    public static getPanelColor(): Color {
        this.refreshEffectiveMode();
        return this.effectiveMode === "campfire"
            ? new Color(145, 110, 75, 255)
            : WestColors.SAND_MEDIUM;
    }

    /** 篝火火光微弱闪烁系数 (0.3Hz, ±5% 亮度波动) */
    public static getCampfireFlickerRatio(timeSeconds: number): number {
        if (this.effectiveMode !== "campfire") return 1.0;
        return 1.0 + Math.sin(timeSeconds * Math.PI * 2 * 0.3) * 0.05;
    }
}


/**
 * 西部牛仔风格 UI 图元与装饰物理绘制器。
 * 包含：高对比通缉令、黑板粉笔字赔率板、独立花色马票、黄铜机械仪表盘与马刺冲刺按钮。
 */
export class WestStyle {
    /**
     * 绘制双层老橡木底板，并在四角点缀金属反光黄铜铆钉。
     */
    public static drawWoodPlank(
        node: Node,
        width: number,
        height: number,
        radius = 12,
        fillColor = WestColors.WOOD_DARK,
        borderColor = WestColors.WOOD_FRAME,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 底层深胡桃木轮廓外框
        g.fillColor = borderColor;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 内层暖木板面板
        const inset = 3.5;
        g.fillColor = fillColor;
        g.roundRect(-halfW + inset, -halfH + inset, width - inset * 2, height - inset * 2, Math.max(2, radius - 2));
        g.fill();

        // 3. 内部黄铜细高光边框线（侧光立体感）
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 1.4;
        g.roundRect(-halfW + inset + 1, -halfH + inset + 1, width - (inset + 1) * 2, height - (inset + 1) * 2, Math.max(2, radius - 3));
        g.stroke();

        // 4. 四角黄铜固定铆钉（带高光与深色阴影）
        if (width >= 70 && height >= 44) {
            const rivetOffset = Math.min(13, radius + 2);
            const rX = halfW - rivetOffset;
            const rY = halfH - rivetOffset;
            const corners = [
                [-rX, -rY],
                [rX, -rY],
                [-rX, rY],
                [rX, rY],
            ];
            for (const [cx, cy] of corners) {
                // 铆钉底影
                g.fillColor = WestColors.RIVET_SHADOW;
                g.circle(cx + 0.6, cy - 0.6, 3.2);
                g.fill();
                // 铆钉黄铜面
                g.fillColor = WestColors.RIVET_BRASS;
                g.circle(cx, cy, 2.6);
                g.fill();
                // 顶部白反光微光点
                g.fillColor = WestColors.SHELL_SILVER;
                g.circle(cx - 0.7, cy + 0.7, 1.0);
                g.fill();
            }
        }

        // 5. 实木年轮纹理 (Wood Grain)
        WestTextures.applyWoodGrain(g, width - inset * 2, height - inset * 2, 1);
    }

    /**
     * 绘制复古羊皮纸告示面板（高亮米黄基底 + 焦边暗底 + 内部炭印细线）。
     */
    public static drawParchment(
        node: Node,
        width: number,
        height: number,
        radius = 10,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 火烧焦边最外层暗底
        g.fillColor = WestColors.PARCHMENT_BORDER;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 羊皮纸高亮暖米黄主基底 (跳出深色背景)
        const margin = 3;
        g.fillColor = WestColors.PARCHMENT_BASE;
        g.roundRect(-halfW + margin, -halfH + margin, width - margin * 2, height - margin * 2, radius - 2);
        g.fill();

        // 3. 折痕微弱立体阴影
        g.fillColor = WestColors.PARCHMENT_CREASE;
        g.rect(-halfW + margin + 10, 0, width - (margin + 10) * 2, 2.5);
        g.fill();

        // 4. 复古炭黑双线内框印痕
        g.strokeColor = WestColors.INK_DARK;
        g.lineWidth = 1.2;
        g.roundRect(-halfW + margin + 4, -halfH + margin + 4, width - (margin + 4) * 2, height - (margin + 4) * 2, radius - 4);
        g.stroke();

        // 5. 羊皮纸自然草浆纤维 (Parchment Fiber)
        WestTextures.applyParchmentFiber(g, width - margin * 2, height - margin * 2, 16);
    }

    /**
     * 绘制高冲击力“今日头马”悬赏令卡片（Wanted Poster）。
     * 包含：明亮羊皮纸底、火烧毛边、炭黑木刻重边框、顶部金属固定长钉与落款火漆印。
     */
    public static drawWantedPosterCard(
        node: Node,
        width: number,
        height: number,
        radius = 8,
        withTopPin = true,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 焦边最外层暗底
        g.fillColor = WestColors.PARCHMENT_BORDER;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 焦痕撕裂毛边效果 (模拟四角撕边与折角)
        g.fillColor = new Color(42, 22, 12, 255);
        g.moveTo(-halfW, halfH - 16);
        g.lineTo(-halfW + 16, halfH);
        g.lineTo(-halfW, halfH);
        g.close();
        g.fill();

        g.moveTo(halfW, -halfH + 16);
        g.lineTo(halfW - 16, -halfH);
        g.lineTo(halfW, -halfH);
        g.close();
        g.fill();

        // 3. 明亮羊皮纸主卡面 (#FFF8E7，产生强烈的视觉撕裂张力)
        const m = 3.5;
        g.fillColor = WestColors.PARCHMENT_LIGHT;
        g.roundRect(-halfW + m, -halfH + m, width - m * 2, height - m * 2, radius - 2);
        g.fill();

        // 4. 纸张中央对角线微折痕
        g.strokeColor = WestColors.PARCHMENT_CREASE;
        g.lineWidth = 1.2;
        g.moveTo(-halfW + m + 14, halfH - 25);
        g.lineTo(halfW - m - 14, -halfH + 25);
        g.stroke();

        // 5. 通缉令炭黑粗外框 (Heavy Charcoal Border)
        g.strokeColor = WestColors.INK_DARK;
        g.lineWidth = 2.4;
        g.roundRect(-halfW + m + 4, -halfH + m + 4, width - (m + 4) * 2, height - (m + 4) * 2, radius - 4);
        g.stroke();

        // 6. 细内边框
        g.strokeColor = WestColors.INK_MUTED;
        g.lineWidth = 1.0;
        g.roundRect(-halfW + m + 8, -halfH + m + 8, width - (m + 8) * 2, height - (m + 8) * 2, radius - 5);
        g.stroke();

        // 7. 顶部黄铜长钉固定装置 (Top Brass Pushpin with metallic highlight & drop shadow)
        if (withTopPin && height >= 60) {
            const pinY = halfH - m - 4;
            // 投影
            g.fillColor = WestColors.RIVET_SHADOW;
            g.circle(1.2, pinY - 1.5, 4.2);
            g.fill();
            // 黄铜钉头
            g.fillColor = WestColors.BRASS_HIGHLIGHT;
            g.circle(0, pinY, 3.6);
            g.fill();
            // 白银反光点
            g.fillColor = WestColors.SHELL_SILVER;
            g.circle(-0.8, pinY + 0.8, 1.4);
            g.fill();
        }

        // 8. 自然草浆纤维与活字印微渗 (Parchment Fiber & Letterpress Noise)
        WestTextures.applyParchmentFiber(g, width - m * 2, height - m * 2, 20);
        WestTextures.applyLetterpressNoise(g, 0, halfH - 24, 28, 8);
    }

    /**
     * 绘制具有独特辨识度的下注马票（Serrated Bet Ticket）。
     * 每张马票带有专属马匹色彩徽章、撕票凹槽、明亮票面与选中时的鲜红火漆印！
     */
    public static drawBetTicket(
        node: Node,
        width: number,
        height: number,
        isSelected = false,
        horseNo = 1,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        const horseBadgeColors = [
            new Color(230, 57, 70, 255),   // 1: 烈焰红
            new Color(51, 122, 183, 255),  // 2: 极速蓝
            new Color(42, 157, 143, 255),  // 3: 仙人掌绿
            new Color(244, 162, 97, 255),  // 4: 落日熔金
            new Color(155, 89, 182, 255),  // 5: 魅影紫
            new Color(255, 209, 102, 255), // 6: 皇家金
        ];
        const badgeColor = horseBadgeColors[(horseNo - 1) % 6];

        if (isSelected) {
            // 选中态：外围金光扩散光晕
            g.fillColor = new Color(255, 209, 102, 90);
            g.roundRect(-halfW - 3, -halfH - 3, width + 6, height + 6, 12);
            g.fill();

            // 黄铜镀金边框
            g.fillColor = WestColors.BRASS_HIGHLIGHT;
            g.roundRect(-halfW, -halfH, width, height, 10);
            g.fill();

            // 内层高对比明亮票面 (#FFF8E7)
            const pad = 2.8;
            g.fillColor = WestColors.PARCHMENT_LIGHT;
            g.roundRect(-halfW + pad, -halfH + pad, width - pad * 2, height - pad * 2, 8);
            g.fill();

            // 左侧马号专属色块垂直缎带
            g.fillColor = badgeColor;
            g.roundRect(-halfW + pad, -halfH + pad, 14, height - pad * 2, 4);
            g.fill();

            // 内部金色双层精细边框线
            g.strokeColor = WestColors.BRASS_HIGHLIGHT;
            g.lineWidth = 1.6;
            g.roundRect(-halfW + pad + 2, -halfH + pad + 2, width - (pad + 2) * 2, height - (pad + 2) * 2, 6);
            g.stroke();

            // 票根两侧撕票半圆凹口 (Serrated Notches)
            g.fillColor = WestColors.BG_CHARCOAL;
            g.circle(-halfW, 0, 7);
            g.circle(halfW, 0, 7);
            g.fill();
            g.strokeColor = WestColors.BRASS_HIGHLIGHT;
            g.lineWidth = 1.6;
            g.arc(-halfW, 0, 7, -Math.PI / 2, Math.PI / 2, false);
            g.stroke();
            g.arc(halfW, 0, 7, Math.PI / 2, -Math.PI / 2, false);
            g.stroke();

            // 右侧鲜红立体火漆印戳记 (CONFIRMED 印记)
            const stampX = halfW - 24;
            g.fillColor = WestColors.BANDANA_DARK;
            g.circle(stampX, 0, 16);
            g.fill();
            g.fillColor = WestColors.SEAL_RED;
            g.circle(stampX, 0, 14);
            g.fill();
            g.strokeColor = WestColors.BRASS_HIGHLIGHT;
            g.lineWidth = 1.2;
            g.circle(stampX, 0, 11);
            g.stroke();
            // 印章中心五角星
            g.fillColor = WestColors.BRASS_HIGHLIGHT;
            g.circle(stampX, 0, 4);
            g.fill();
        } else {
            // 未选中态：深色硬橡木外框
            g.fillColor = WestColors.WOOD_FRAME;
            g.roundRect(-halfW, -halfH, width, height, 10);
            g.fill();

            // 内层做旧熟皮革板 (#4A2E1B)
            const pad = 2.5;
            g.fillColor = WestColors.LEATHER_AGED;
            g.roundRect(-halfW + pad, -halfH + pad, width - pad * 2, height - pad * 2, 8);
            g.fill();

            // 左侧马号专属色块暗色垂直缎带
            g.fillColor = badgeColor;
            g.roundRect(-halfW + pad, -halfH + pad, 8, height - pad * 2, 3);
            g.fill();

            // 幽暗古铜细线
            g.strokeColor = new Color(160, 110, 60, 120);
            g.lineWidth = 1;
            g.roundRect(-halfW + pad + 1.5, -halfH + pad + 1.5, width - (pad + 1.5) * 2, height - (pad + 1.5) * 2, 6);
            g.stroke();

            // 票根两侧撕票半圆凹口
            g.fillColor = WestColors.BG_CHARCOAL;
            g.circle(-halfW, 0, 6);
            g.circle(halfW, 0, 6);
            g.fill();
            g.strokeColor = WestColors.WOOD_FRAME;
            g.lineWidth = 1.2;
            g.arc(-halfW, 0, 6, -Math.PI / 2, Math.PI / 2, false);
            g.stroke();
            g.arc(halfW, 0, 6, Math.PI / 2, -Math.PI / 2, false);
            g.stroke();

            // 撕票虚线 (Perforated Line)
            g.strokeColor = new Color(20, 12, 8, 180);
            g.lineWidth = 1.2;
            g.moveTo(halfW - 32, -halfH + 6);
            g.lineTo(halfW - 32, halfH - 6);
            g.stroke();
        }

        // 票面草浆纤维 (Parchment Fiber)
        WestTextures.applyParchmentFiber(g, width, height, 10);
    }

    /**
     * 绘制酒馆粉笔赔率黑板（深石板底 + 实木边框 + 高亮黄粉笔细线与粉笔灰颗粒）。
     */
    public static drawChalkBoard(
        node: Node,
        width: number,
        height: number,
        radius = 8,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 实木外框
        g.fillColor = WestColors.WOOD_FRAME;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 黑板板岩底色 (Slate Charcoal: #181D24)
        const inset = 3.5;
        g.fillColor = new Color(22, 28, 34, 255);
        g.roundRect(-halfW + inset, -halfH + inset, width - inset * 2, height - inset * 2, Math.max(2, radius - 2));
        g.fill();

        // 3. 高亮粉笔细线 (#FFF176 粉笔黄，清晰醒目)
        g.strokeColor = WestColors.CHALK_YELLOW;
        g.lineWidth = 1.2;
        g.roundRect(-halfW + inset + 2.5, -halfH + inset + 2.5, width - (inset + 2.5) * 2, height - (inset + 2.5) * 2, Math.max(2, radius - 3));
        g.stroke();

        // 4. 四角黄铜固定角螺栓（带高光）
        const bOff = Math.min(9, radius + 2);
        const corners = [
            [-halfW + bOff, -halfH + bOff],
            [halfW - bOff, -halfH + bOff],
            [-halfW + bOff, halfH - bOff],
            [halfW - bOff, halfH - bOff],
        ];
        for (const [cx, cy] of corners) {
            g.fillColor = WestColors.RIVET_BRASS;
            g.circle(cx, cy, 2.4);
            g.fill();
            g.fillColor = WestColors.SHELL_SILVER;
            g.circle(cx - 0.5, cy + 0.5, 0.8);
            g.fill();
        }
    }

    /**
     * 绘制黄铜机械速度表盘（Brass Mechanical Speedometer）。
     * 包含：黄铜外圈铆钉、危险红区刻度弧、指针及阴影、玻璃罩反光弧。
     */
    public static drawSpeedometerGauge(
        node: Node,
        size = 80,
        pct = 0.85,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const r = size / 2;

        // 1. 底层外圈黄铜表壳
        g.fillColor = WestColors.BRASS_HIGHLIGHT;
        g.circle(0, 0, r);
        g.fill();

        // 2. 表盘内圈深炭灰面
        g.fillColor = new Color(20, 20, 20, 255);
        g.circle(0, 0, r - 3.5);
        g.fill();

        // 3. 安全与危险红区刻度环 (70% ~ 100% 为刺目火漆红危险区)
        g.strokeColor = WestColors.CACTUS_GREEN;
        g.lineWidth = 3.5;
        g.arc(0, 0, r - 9, Math.PI * 0.8, Math.PI * 0.2, true);
        g.stroke();

        g.strokeColor = WestColors.SEAL_RED;
        g.lineWidth = 4.0;
        g.arc(0, 0, r - 9, Math.PI * 0.2, 0, true);
        g.stroke();

        // 4. 刻度点
        g.fillColor = WestColors.SHELL_SILVER;
        for (let i = 0; i <= 6; i++) {
            const angle = Math.PI * 0.8 - (i / 6) * Math.PI * 0.8;
            const px = Math.cos(angle) * (r - 15);
            const py = Math.sin(angle) * (r - 15);
            g.circle(px, py, 1.2);
            g.fill();
        }

        // 5. 机械指针 (根据 pct 计算指向弧度)
        const needleAngle = Math.PI * 0.8 - pct * Math.PI * 0.8;
        const nx = Math.cos(needleAngle) * (r - 8);
        const ny = Math.sin(needleAngle) * (r - 8);

        // 指针阴影
        g.strokeColor = new Color(0, 0, 0, 160);
        g.lineWidth = 2.4;
        g.moveTo(0.8, -0.8);
        g.lineTo(nx + 0.8, ny - 0.8);
        g.stroke();

        // 指针主体 (刺目火漆红)
        g.strokeColor = WestColors.SEAL_RED;
        g.lineWidth = 2.0;
        g.moveTo(0, 0);
        g.lineTo(nx, ny);
        g.stroke();

        // 中心转轴铜铆钉
        g.fillColor = WestColors.BRASS_HIGHLIGHT;
        g.circle(0, 0, 4.5);
        g.fill();
        g.fillColor = WestColors.SHELL_SILVER;
        g.circle(-0.8, 0.8, 1.4);
        g.fill();

        // 6. 玻璃罩半圆月牙反光
        g.fillColor = new Color(255, 255, 255, 35);
        g.arc(0, 0, r - 4, 0, Math.PI, false);
        g.fill();
    }

    /**
     * 绘制做旧皮革子弹带（耐力值指示，黄铜子弹亮暗代表充能）。
     */
    public static drawBulletBelt(
        node: Node,
        width: number,
        height: number,
        activeBullets = 5,
        totalBullets = 6,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 皮革子弹背带底板
        g.fillColor = WestColors.LEATHER_AGED;
        g.roundRect(-halfW, -halfH, width, height, 6);
        g.fill();

        // 2. 皮革上下缝线
        g.strokeColor = WestColors.LEATHER_STITCH;
        g.lineWidth = 1.0;
        g.moveTo(-halfW + 4, halfH - 3);
        g.lineTo(halfW - 4, halfH - 3);
        g.stroke();
        g.moveTo(-halfW + 4, -halfH + 3);
        g.lineTo(halfW - 4, -halfH + 3);
        g.stroke();

        // 3. 一排黄铜子弹 (活跃为黄铜高光+银反光，消耗为空弹孔)
        const step = (width - 24) / totalBullets;
        for (let i = 0; i < totalBullets; i++) {
            const bx = -halfW + 16 + i * step;
            const isActive = i < activeBullets;

            if (isActive) {
                // 子弹阴影
                g.fillColor = WestColors.RIVET_SHADOW;
                g.roundRect(bx - 3.5, -halfH + 5, 8.5, height - 10, 2);
                g.fill();
                // 黄铜弹壳主体
                g.fillColor = WestColors.BRASS_HIGHLIGHT;
                g.roundRect(bx - 4, -halfH + 6, 8, height - 12, 2);
                g.fill();
                // 弹头银亮光
                g.fillColor = WestColors.SHELL_SILVER;
                g.circle(bx, halfH - 9, 3.2);
                g.fill();
            } else {
                // 空弹插孔
                g.fillColor = new Color(24, 14, 8, 255);
                g.roundRect(bx - 3.5, -halfH + 6, 7, height - 12, 2);
                g.fill();
            }
        }
    }

    /**
     * 绘制黄铜牛仔马刺按钮（Cowboy Spur Sprint Button）。
     * 冲刺时亮起刺眼红光与星形马刺齿轮。
     */
    public static drawSpurButton(
        node: Node,
        size = 80,
        isGlowing = false,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const r = size / 2;

        // 1. 冲刺外圈红光/金光流萤
        if (isGlowing) {
            g.fillColor = new Color(230, 57, 70, 110);
            g.circle(0, 0, r + 5);
            g.fill();
        }

        // 2. 马刺转轮 8 齿齿轮结构
        g.fillColor = isGlowing ? WestColors.SEAL_RED : WestColors.BRASS_FRAME;
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const tx = Math.cos(angle) * r;
            const ty = Math.sin(angle) * r;
            g.circle(tx, ty, 5.5);
            g.fill();
        }

        // 3. 中心圆盘主体
        g.fillColor = isGlowing ? WestColors.SEAL_RED : WestColors.BRASS_HIGHLIGHT;
        g.circle(0, 0, r - 5);
        g.fill();

        // 4. 内层压槽金属圈
        g.strokeColor = isGlowing ? WestColors.BRASS_HIGHLIGHT : WestColors.WOOD_FRAME;
        g.lineWidth = 2.2;
        g.circle(0, 0, r - 12);
        g.stroke();

        // 5. 中心轴铜星
        g.fillColor = isGlowing ? WestColors.SHELL_SILVER : WestColors.GOLD_BRIGHT;
        g.circle(0, 0, 7);
        g.fill();
    }

    /**
     * 绘制高精细德州扑克 / 拟物金铸筹码按钮（带齿槽条纹与双重金属光泽）。
     */
    public static drawPokerChip(
        node: Node,
        width: number,
        height: number,
        chipValue: number,
        isSelected: boolean,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;
        const radius = Math.min(halfW, halfH);

        // 选中外光圈扩散
        if (isSelected) {
            g.fillColor = new Color(255, 209, 102, 100);
            g.roundRect(-halfW - 4, -halfH - 4, width + 8, height + 8, radius + 4);
            g.fill();
        }

        let chipBaseColor = WestColors.LEATHER_SADDLE;
        if (chipValue >= 1000) {
            chipBaseColor = new Color(140, 24, 24, 255);  // 千元酒红
        } else if (chipValue >= 500) {
            chipBaseColor = WestColors.SEAL_RED;          // 500火漆红
        } else if (chipValue >= 100) {
            chipBaseColor = WestColors.BADGE_BLUE;         // 100骑兵蓝
        } else if (chipValue >= 50) {
            chipBaseColor = WestColors.CACTUS_GREEN;       // 50仙人掌绿
        } else if (chipValue >= 10) {
            chipBaseColor = WestColors.LEATHER_AGED;       // 10深皮革
        }

        // 1. 底层厚重黄铜边框
        g.fillColor = isSelected ? WestColors.BRASS_HIGHLIGHT : WestColors.BRASS_FRAME;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 筹码主体
        const inset = 2.5;
        g.fillColor = chipBaseColor;
        g.roundRect(-halfW + inset, -halfH + inset, width - inset * 2, height - inset * 2, radius - inset);
        g.fill();

        // 3. 筹码边缘 4 对放射刻槽
        g.fillColor = isSelected ? WestColors.BRASS_HIGHLIGHT : WestColors.SHELL_SILVER;
        const notchW = 7;
        const notchH = 4.5;
        g.rect(-notchW / 2, halfH - inset - notchH, notchW, notchH);
        g.rect(-notchW / 2, -halfH + inset, notchW, notchH);
        g.rect(-halfW + inset, -notchW / 2, notchH, notchW);
        g.rect(halfW - inset - notchH, -notchW / 2, notchH, notchW);
        g.fill();

        // 4. 上半圆弧立体高光
        g.fillColor = new Color(255, 255, 255, 45);
        g.roundRect(-halfW + inset, 0, width - inset * 2, halfH - inset, 5);
        g.fill();

        // 5. 内圈黄铜同心圆环
        g.strokeColor = isSelected ? WestColors.BRASS_HIGHLIGHT : WestColors.BRASS_FRAME;
        g.lineWidth = 1.8;
        g.roundRect(-halfW + 7, -halfH + 7, width - 14, height - 14, Math.max(3, radius - 7));
        g.stroke();
    }

    /**
     * 绘制重型西部实木 / 炽热火漆行动大按钮（如“立即撕票出战 / 确认下注”）。
     */
    public static drawActionBanner(
        node: Node,
        width: number,
        height: number,
        isPrimary = true,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 底层厚重黄铜边框
        g.fillColor = isPrimary ? WestColors.BRASS_HIGHLIGHT : WestColors.WOOD_FRAME;
        g.roundRect(-halfW, -halfH, width, height, 14);
        g.fill();

        // 2. 按钮主体（首要动作为炽热火漆红 #E63946，普通为深胡桃木色）
        const inset = 3.2;
        g.fillColor = isPrimary ? WestColors.SEAL_RED : WestColors.WOOD_DARK;
        g.roundRect(-halfW + inset, -halfH + inset, width - inset * 2, height - inset * 2, 11);
        g.fill();

        // 3. 上半部分微光浮雕层
        g.fillColor = new Color(255, 255, 255, 40);
        g.roundRect(-halfW + inset, 0, width - inset * 2, halfH - inset, 6);
        g.fill();

        // 4. 金色边框线与四角黄铜铆钉
        g.strokeColor = isPrimary ? WestColors.BRASS_HIGHLIGHT : WestColors.BRASS_FRAME;
        g.lineWidth = 1.6;
        g.roundRect(-halfW + inset + 1, -halfH + inset + 1, width - (inset + 1) * 2, height - (inset + 1) * 2, 10);
        g.stroke();

        // 四角黄铜固定铆钉
        if (width >= 100) {
            const rx = halfW - 12;
            const ry = halfH - 10;
            const corners = [[-rx, -ry], [rx, -ry], [-rx, ry], [rx, ry]];
            for (const [cx, cy] of corners) {
                g.fillColor = WestColors.RIVET_SHADOW;
                g.circle(cx + 0.5, cy - 0.5, 2.6);
                g.fill();
                g.fillColor = WestColors.BRASS_HIGHLIGHT;
                g.circle(cx, cy, 2.2);
                g.fill();
            }
        }
    }

    /**
     * 绘制做旧火漆印章底座 (深红蜡印，带凹凸边缘与金色压印星标)。
     */
    public static drawWaxSealStamp(
        node: Node,
        radius = 28,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        // 1. 外层蜡融滴落不规则轮廓
        g.fillColor = WestColors.BANDANA_DARK;
        g.circle(0, 0, radius);
        g.fill();

        g.circle(-radius * 0.7, -radius * 0.5, radius * 0.28);
        g.circle(radius * 0.6, -radius * 0.6, radius * 0.25);
        g.circle(radius * 0.7, radius * 0.4, radius * 0.26);
        g.circle(-radius * 0.5, radius * 0.7, radius * 0.24);
        g.fill();

        // 2. 主体火漆凹陷层 (#E63946 刺目火漆红)
        g.fillColor = WestColors.SEAL_RED;
        g.circle(0, 0, radius * 0.85);
        g.fill();

        // 3. 金色压印圆环
        g.strokeColor = WestColors.BRASS_HIGHLIGHT;
        g.lineWidth = 1.6;
        g.circle(0, 0, radius * 0.7);
        g.stroke();

        // 4. 中心警徽星/马蹄铁金色微标
        g.fillColor = WestColors.BRASS_HIGHLIGHT;
        g.circle(0, 0, radius * 0.28);
        g.fill();
    }

    /**
     * 绘制奢华西部沙龙实木主面板（双层胡桃木 + 铁铸防撞包角 + 黄铜铆钉 + 水平木板缝暗线）。
     */
    public static drawGrandSaloonPanel(
        node: Node,
        width: number,
        height: number,
        radius = 14,
        fillColor = WestColors.WOOD_DARK,
        borderColor = WestColors.WOOD_FRAME,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 最底层深橡木轮廓外框
        g.fillColor = borderColor;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 内部深胡桃木主板面
        const inset = 4;
        g.fillColor = fillColor;
        g.roundRect(-halfW + inset, -halfH + inset, width - inset * 2, height - inset * 2, Math.max(2, radius - 2));
        g.fill();

        // 3. 木料横向缝隙暗线 (增加真实多块拼装实木物理质感)
        const planks = Math.floor(height / 70);
        if (planks >= 2) {
            g.strokeColor = WestColors.WOOD_PLANK_LINE;
            g.lineWidth = 1.6;
            const stepY = (height - inset * 2) / planks;
            for (let i = 1; i < planks; i++) {
                const py = -halfH + inset + i * stepY;
                g.moveTo(-halfW + inset + 2, py);
                g.lineTo(halfW - inset - 2, py);
                g.stroke();
            }
        }

        // 4. 金属黄铜内嵌压边线
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 1.4;
        g.roundRect(-halfW + inset + 2, -halfH + inset + 2, width - (inset + 2) * 2, height - (inset + 2) * 2, Math.max(2, radius - 3));
        g.stroke();

        // 5. 四个拐角加装西部特色 L 形铁铸包角与黄铜铆钉
        if (width >= 100 && height >= 70) {
            const cornerLen = Math.min(24, width * 0.1);
            const cornerThick = 4.5;
            g.fillColor = new Color(20, 20, 20, 255);
            // 左上 L 角
            g.rect(-halfW, halfH - cornerLen, cornerThick, cornerLen);
            g.rect(-halfW, halfH - cornerThick, cornerLen, cornerThick);
            // 右上 L 角
            g.rect(halfW - cornerThick, halfH - cornerLen, cornerThick, cornerLen);
            g.rect(halfW - cornerLen, halfH - cornerThick, cornerLen, cornerThick);
            // 左下 L 角
            g.rect(-halfW, -halfH, cornerThick, cornerLen);
            g.rect(-halfW, -halfH, cornerLen, cornerThick);
            // 右下 L 角
            g.rect(halfW - cornerThick, -halfH, cornerThick, cornerLen);
            g.rect(halfW - cornerLen, -halfH, cornerLen, cornerThick);
            g.fill();

            // 四角黄铜固定铆钉
            const rOffset = 11;
            const corners = [
                [-halfW + rOffset, halfH - rOffset],
                [halfW - rOffset, halfH - rOffset],
                [-halfW + rOffset, -halfH + rOffset],
                [halfW - rOffset, -halfH + rOffset],
            ];
            for (const [cx, cy] of corners) {
                g.fillColor = WestColors.RIVET_SHADOW;
                g.circle(cx + 0.5, cy - 0.5, 3.2);
                g.fill();
                g.fillColor = WestColors.BRASS_HIGHLIGHT;
                g.circle(cx, cy, 2.6);
                g.fill();
                g.fillColor = WestColors.SHELL_SILVER;
                g.circle(cx - 0.7, cy + 0.7, 1.0);
                g.fill();
            }
        }

        // 6. 木纹与黄铜风化光泽 (Wood Grain & Brass Patina)
        WestTextures.applyWoodGrain(g, width - inset * 2, height - inset * 2, 2);
        WestTextures.applyBrassPatina(g, width, height);
    }

    /**
     * 绘制悬挂式老西部酒馆木质吊牌（带上方挂链铁环与做旧原木纹理）。
     */
    public static drawSaloonSign(
        node: Node,
        width: number,
        height: number,
        radius = 8,
        isHighlight = false,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 底层木板外沿
        g.fillColor = isHighlight ? WestColors.BRASS_HIGHLIGHT : WestColors.WOOD_FRAME;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 主体木牌面（高亮为马鞍熟褐，普通为深胡桃木）
        const inset = 2.8;
        g.fillColor = isHighlight ? WestColors.LEATHER_SADDLE : WestColors.WOOD_DARK;
        g.roundRect(-halfW + inset, -halfH + inset, width - inset * 2, height - inset * 2, radius - 2);
        g.fill();

        // 3. 上部微光浮雕
        g.fillColor = new Color(255, 255, 255, 30);
        g.roundRect(-halfW + inset, 0, width - inset * 2, halfH - inset, 4);
        g.fill();

        // 4. 黄铜边线
        g.strokeColor = isHighlight ? WestColors.BRASS_HIGHLIGHT : WestColors.BRASS_FRAME;
        g.lineWidth = 1.4;
        g.roundRect(-halfW + inset + 1, -halfH + inset + 1, width - (inset + 1) * 2, height - (inset + 1) * 2, radius - 3);
        g.stroke();

        // 5. 左右悬挂铁铆钉与挂环
        if (width >= 60) {
            const rx = halfW - 10;
            const ry = halfH - 7;
            g.fillColor = WestColors.RIVET_SHADOW;
            g.circle(-rx + 0.5, ry - 0.5, 2.8);
            g.circle(rx + 0.5, ry - 0.5, 2.8);
            g.fill();
            g.fillColor = WestColors.BRASS_HIGHLIGHT;
            g.circle(-rx, ry, 2.2);
            g.circle(rx, ry, 2.2);
            g.fill();
        }

        // 6. 原木年轮纹理 (Wood Grain)
        WestTextures.applyWoodGrain(g, width - inset * 2, height - inset * 2, 1);
    }

    /**
     * 绘制街机经典黄金赛马 15 组连赢（Quinella）矩阵单元格。
     * 融合街机荧光显示与西部实木机械盘风格：
     * - 默认状态：深胡桃木色底板 + 双色马号标识色块 + 炭黑金边。
     * - 选中状态：火漆红底 + 炽热黄铜高光金边 + 选中发光内嵌框。
     * - 中奖获胜状态：胜利璀璨金底 + 警长五角金星光晕 + 边框高亮。
     */
    public static drawQuinellaCell(
        node: Node,
        width: number,
        height: number,
        isSelected = false,
        isWinner = false,
        horse1 = 1,
        horse2 = 2,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        const horseColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];

        // 1. 底层外框
        if (isWinner) {
            g.fillColor = WestColors.GOLD_BRIGHT;
            g.roundRect(-halfW, -halfH, width, height, 6);
            g.fill();
            g.fillColor = WestColors.BANDANA_DARK;
            g.roundRect(-halfW + 2, -halfH + 2, width - 4, height - 4, 4);
            g.fill();
        } else if (isSelected) {
            g.fillColor = WestColors.BRASS_HIGHLIGHT;
            g.roundRect(-halfW, -halfH, width, height, 6);
            g.fill();
            g.fillColor = WestColors.BANDANA_RED;
            g.roundRect(-halfW + 2, -halfH + 2, width - 4, height - 4, 4);
            g.fill();
        } else {
            g.fillColor = WestColors.WOOD_FRAME;
            g.roundRect(-halfW, -halfH, width, height, 6);
            g.fill();
            g.fillColor = WestColors.WOOD_DARK;
            g.roundRect(-halfW + 2, -halfH + 2, width - 4, height - 4, 4);
            g.fill();
        }

        // 2. 顶部双马色条指示带 (街机双色配对质感)
        const c1 = horseColors[(horse1 - 1) % 6];
        const c2 = horseColors[(horse2 - 1) % 6];
        const barH = 4;
        const barY = halfH - 2 - barH;
        g.fillColor = c1;
        g.rect(-halfW + 3, barY, (width - 6) / 2, barH);
        g.fill();
        g.fillColor = c2;
        g.rect(-halfW + 3 + (width - 6) / 2, barY, (width - 6) / 2, barH);
        g.fill();

        // 3. 边框高亮
        g.strokeColor = isWinner ? WestColors.GOLD_BRIGHT : (isSelected ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME);
        g.lineWidth = isWinner ? 2.5 : (isSelected ? 2.0 : 1.0);
        g.roundRect(-halfW + 1, -halfH + 1, width - 2, height - 2, 5);
        g.stroke();
    }

    /**
     * 【一街八铺 · 统一沙色基底与特色商铺视觉锚点 (v2.1 品牌重塑)】
     * 遵循 v2.1 修正方案 P1：从「八景」收缩到「一街八铺」
     * 杜绝页面随意变换主色导致的品牌割裂，全页面共享统一的沙色街道基底 (SAND_LIGHT / 篝火深沙)。
     * 每个页面通过独占的强调色 (面积 ≤ 15%) + 鲜明的商铺招牌与道具锚点作区分：
     * - 登录：SKY_DAWN 暖橙 + 日出朝晖与远山台地小镇剪影 + 仙人掌与风滚草
     * - 大厅：BANDANA_RED 方巾红 + 粗犷老木沙龙吊牌 ("SALOON") + 吧台弹壳与百叶窗日光
     * - 竞技场：DUST_BROWN 沙尘 + 白木围栏立桩 + 泥土赛道与尘土飞扬粒子
     * - 结算：GOLD_LEAF 金箔 + 胜利领奖台 + 篝火与跃动星火微粒
     * - 成就：BRASS 做旧铜 + 粗犷通缉木墙 + 锻造生铁方钉与悬赏令边角
     * - 马厩：HAY_GOLD 干草黄 + 谷仓人字大木梁 + 暖马灯光晕与草堆套马索
     * - 设置：DENIM_BLUE 牛仔布 + 边境电报机木座 + 旋钮与架空电报铜线
     * - 历史：DENIM_DEEP 夜靛 + 石板黑板微粉笔划痕 + 复古黄铜齿轮与机械钟摆
     * 贯穿全剧的世界观母题：风滚草、仙人掌剪影、柯尔特公署火漆印。
     */
    public static drawSceneBackground(node: Node, page: string, width = 720, height = 1280): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // =========================================================================
        // 1. 全局「一街八铺」统一基底 (8 页共享同一沙色大地)
        // =========================================================================
        const baseBg = WestThemeManager.getBaseBgColor();
        g.fillColor = baseBg;
        g.rect(-halfW, -halfH, width, height);
        g.fill();

        // 亚麻布纤维质地 (赋予全屏沙土地细腻纺织手感)
        WestTextures.applyLinenTexture(g, width, height, 22, 14);

        // 底部沙土街道地表 (高度约 200px)
        const streetH = 200;
        g.fillColor = WestColors.SAND_MEDIUM;
        g.rect(-halfW, -halfH, width, streetH);
        g.fill();

        // 街道边缘压实泥沙分界线
        g.strokeColor = WestColors.LEATHER_MEDIUM;
        g.lineWidth = 2.0;
        g.moveTo(-halfW, -halfH + streetH);
        g.lineTo(halfW, -halfH + streetH);
        g.stroke();

        // 街道天然草浆沙砾纤维
        WestTextures.applyParchmentFiber(g, width, streetH, 14);

        // 最底端木板人行道 (Boardwalk Timber Planks)
        const boardwalkH = 34;
        g.fillColor = WestColors.LEATHER_DARK;
        g.rect(-halfW, -halfH, width, boardwalkH);
        g.fill();
        WestTextures.applyWoodGrain(g, width, boardwalkH, 1);

        // 贯穿世界观锚点辅助绘制器：仙人掌剪影
        const drawCactusSilhouette = (cx: number, cy: number, scale: number): void => {
            g.fillColor = new Color(75, 105, 65, 190);
            g.roundRect(cx - 6 * scale, cy, 12 * scale, 100 * scale, 6 * scale);
            g.fill();
            g.roundRect(cx - 24 * scale, cy + 30 * scale, 20 * scale, 10 * scale, 5 * scale);
            g.roundRect(cx - 26 * scale, cy + 30 * scale, 10 * scale, 45 * scale, 5 * scale);
            g.fill();
            g.roundRect(cx + 4 * scale, cy + 50 * scale, 22 * scale, 10 * scale, 5 * scale);
            g.roundRect(cx + 16 * scale, cy + 50 * scale, 10 * scale, 40 * scale, 5 * scale);
            g.fill();
        };

        // 贯穿世界观锚点辅助绘制器：风滚草 (Tumbleweed)
        const drawTumbleweed = (cx: number, cy: number, r: number): void => {
            g.strokeColor = new Color(138, 92, 54, 180);
            g.lineWidth = 1.0;
            for (let i = 0; i < 5; i++) {
                const ox = (i % 3 - 1) * (r * 0.25);
                const oy = (i % 2 - 0.5) * (r * 0.25);
                g.arc(cx + ox, cy + oy, r * (0.6 + (i % 3) * 0.2), 0, Math.PI * 1.8, false);
                g.stroke();
            }
        };

        // 贯穿世界观锚点辅助绘制器：柯尔特公署官方火漆印 (Colt Agency Wax Seal)
        const drawColtAgencySeal = (cx: number, cy: number, radius = 24): void => {
            // 外缘深红底盘
            g.fillColor = WestColors.BANDANA_DARK;
            g.circle(cx, cy, radius);
            g.fill();
            // 内缘鲜红火漆
            g.fillColor = WestColors.BANDANA_RED;
            g.circle(cx, cy, radius - 3);
            g.fill();
            // 黄铜光泽双圆圈
            g.strokeColor = WestColors.GOLD_LEAF;
            g.lineWidth = 1.2;
            g.circle(cx, cy, radius - 5);
            g.stroke();
            //  central star / emblem
            g.fillColor = WestColors.CREAM;
            g.circle(cx, cy, 3.5);
            g.fill();
        };

        // =========================================================================
        // 2. 依据各页面绘制专属商铺招牌、道具与单强调色 (面积 ≤ 15%)
        // =========================================================================
        switch (page) {
            case "login": {
                // 强调色：SKY_DAWN #F4A261 暖橙 (≤ 15%)
                // 视觉锚点：日出破晓天际线 + 边境小镇远景剪影 + 仙人掌与风滚草
                const topSkyH = 180;
                // 顶部窄带日出朝阳暖光 (面积约 14%)
                g.fillColor = new Color(244, 162, 97, 130);
                g.rect(-halfW, halfH - topSkyH, width, topSkyH);
                g.fill();

                // 晨光日轮
                const sunY = halfH - 120;
                g.fillColor = new Color(255, 235, 170, 70);
                g.circle(0, sunY, 70);
                g.fill();
                g.fillColor = new Color(255, 220, 130, 220);
                g.circle(0, sunY, 32);
                g.fill();

                // 远方小镇建筑物轮廓 (风车、钟塔、平顶沙龙剪影)
                g.fillColor = new Color(176, 118, 76, 170);
                // 建筑群底横条
                g.rect(-halfW + 40, halfH - topSkyH, width - 80, 26);
                g.fill();
                // 沙龙假山墙 (Saloon False Front)
                g.rect(-halfW + 110, halfH - topSkyH, 60, 48);
                g.fill();
                // 钟楼尖塔
                g.moveTo(-halfW + 280, halfH - topSkyH + 65);
                g.lineTo(-halfW + 270, halfH - topSkyH);
                g.lineTo(-halfW + 290, halfH - topSkyH);
                g.close();
                g.fill();
                // 风车塔架
                g.moveTo(halfW - 140, halfH - topSkyH);
                g.lineTo(halfW - 130, halfH - topSkyH + 58);
                g.lineTo(halfW - 120, halfH - topSkyH);
                g.close();
                g.fill();

                // 街道锚点：右侧双臂仙人掌剪影，左侧风滚草
                drawCactusSilhouette(halfW - 75, -halfH + streetH - 20, 0.8);
                drawTumbleweed(-halfW + 90, -halfH + 60, 18);
                break;
            }

            case "lobby": {
                // 强调色：BANDANA_RED #C1121F 方巾红 (≤ 15%)
                // 视觉锚点：沙龙悬挂原木招牌 ("SALOON") + 吧台嵌入弹壳 + 百叶窗日光
                // 1. 顶部沙龙木挑檐横梁
                g.fillColor = WestColors.LEATHER_MEDIUM;
                g.rect(-halfW, halfH - 85, width, 85);
                g.fill();
                WestTextures.applyWoodGrain(g, width, 85, 2);

                // 2. 悬挂沙龙招牌 (木板吊牌 + 铁链 + 方巾红徽标)
                const signW = 280;
                const signH = 64;
                const signY = halfH - 120;
                // 铸铁吊链
                g.strokeColor = WestColors.GUNMETAL;
                g.lineWidth = 2.0;
                g.moveTo(-80, halfH - 85);
                g.lineTo(-80, signY + signH / 2);
                g.moveTo(80, halfH - 85);
                g.lineTo(80, signY + signH / 2);
                g.stroke();

                // 招牌木板
                g.fillColor = WestColors.SAND_MEDIUM;
                g.roundRect(-signW / 2, signY - signH / 2, signW, signH, 8);
                g.fill();
                g.strokeColor = WestColors.BANDANA_RED;
                g.lineWidth = 2.4;
                g.roundRect(-signW / 2 + 3, signY - signH / 2 + 3, signW - 6, signH - 6, 6);
                g.stroke();
                // 招牌方巾红装饰领花
                g.fillColor = WestColors.BANDANA_RED;
                g.circle(-signW / 2 + 16, signY, 5);
                g.circle(signW / 2 - 16, signY, 5);
                g.fill();

                // 3. 斜射日光光柱 (2条柔和光束，≤10% 面积)
                g.fillColor = new Color(255, 248, 215, 18);
                g.moveTo(-160, halfH);
                g.lineTo(-40, halfH);
                g.lineTo(-200, -halfH);
                g.lineTo(-320, -halfH);
                g.close();
                g.fill();

                // 4. 底部沙龙厚木吧台与嵌入黄铜弹壳
                g.fillColor = WestColors.LEATHER_DARK;
                g.rect(-halfW, -halfH + boardwalkH, width, 28);
                g.fill();
                for (let bx = -halfW + 60; bx < halfW; bx += 90) {
                    g.fillColor = WestColors.BRASS;
                    g.circle(bx, -halfH + boardwalkH + 14, 5.5);
                    g.fill();
                    g.fillColor = WestColors.SHELL_SILVER;
                    g.circle(bx, -halfH + boardwalkH + 14, 2.2);
                    g.fill();
                }
                break;
            }

            case "race": {
                // 强调色：DUST_BROWN #B08968 沙尘 (≤ 15%)
                // 视觉锚点：跑道白木围栏 + 泥土赛道与扬尘微粒
                // 1. 中部赛道沙尘界标带 (DUST_BROWN 强调带)
                const trackY = -halfH + streetH + 20;
                g.fillColor = WestColors.DUST_BROWN;
                g.rect(-halfW, trackY, width, 55);
                g.fill();

                // 2. 经典日晒白木横栏与桩柱 (Post & Rail Fence)
                g.fillColor = new Color(248, 244, 230, 230);
                // 双层横栏
                g.rect(-halfW, trackY + 42, width, 6);
                g.rect(-halfW, trackY + 24, width, 5);
                g.fill();
                // 立柱
                for (let px = -halfW + 35; px < halfW; px += 85) {
                    g.rect(px, trackY + 12, 8, 42);
                    g.fill();
                }

                // 3. 终点迎风三角小彩旗线
                const flagY = halfH - 75;
                g.strokeColor = WestColors.LEATHER_MEDIUM;
                g.lineWidth = 1.2;
                g.moveTo(-halfW, flagY);
                g.lineTo(halfW, flagY - 12);
                g.stroke();
                for (let fx = -halfW + 20; fx < halfW; fx += 32) {
                    const isRed = Math.floor((fx - (-halfW + 20)) / 32) % 2 === 0;
                    g.fillColor = isRed ? WestColors.BANDANA_RED : WestColors.CREAM;
                    g.moveTo(fx, flagY - 2);
                    g.lineTo(fx + 22, flagY - 2);
                    g.lineTo(fx + 11, flagY - 20);
                    g.close();
                    g.fill();
                }

                // 4. 浮尘微粒 (受性能预算配置调控)
                const dustParticles = [
                    { x: -180, y: trackY + 65, r: 2.2 },
                    { x: -110, y: trackY + 80, r: 1.8 },
                    { x: 30, y: trackY + 70, r: 2.5 },
                    { x: 140, y: trackY + 85, r: 2.0 },
                    { x: 230, y: trackY + 60, r: 1.6 },
                ];
                g.fillColor = new Color(215, 185, 145, 120);
                for (let i = 0; i < dustParticles.length; i++) {
                    if (WestPerformance.shouldSpawnParticle(i)) {
                        g.circle(dustParticles[i].x, dustParticles[i].y, dustParticles[i].r);
                        g.fill();
                    }
                }
                break;
            }

            case "settlement": {
                // 强调色：GOLD_LEAF #E9C46A 金箔 (≤ 15%)
                // 视觉锚点：领奖台 + 胜利篝火与跃动星火
                // 1. 金箔领奖台 (Victory Podium on Street)
                const podY = -halfH + streetH;
                g.fillColor = WestColors.LEATHER_MEDIUM;
                // 阶梯底座
                g.rect(-160, podY, 320, 24);
                g.fill();
                g.fillColor = WestColors.GOLD_LEAF;
                g.rect(-160, podY + 21, 320, 3);
                g.fill();

                // 2. 篝火 (Campfire on the left street)
                const fireX = -halfW + 110;
                const fireY = -halfH + 80;
                g.fillColor = new Color(255, 140, 50, 45);
                g.circle(fireX, fireY, 46);
                g.fill();
                g.fillColor = WestColors.GOLD_LEAF;
                g.moveTo(fireX - 8, fireY);
                g.lineTo(fireX, fireY + 26);
                g.lineTo(fireX + 8, fireY);
                g.close();
                g.fill();

                // 升腾星火 (受性能预算调控)
                const sparks = [
                    { x: fireX - 2, y: fireY + 34, r: 1.5 },
                    { x: fireX + 4, y: fireY + 46, r: 1.2 },
                    { x: fireX - 5, y: fireY + 60, r: 1.0 },
                ];
                g.fillColor = WestColors.GOLD_LEAF;
                for (let i = 0; i < sparks.length; i++) {
                    if (WestPerformance.shouldSpawnParticle(i)) {
                        g.circle(sparks[i].x, sparks[i].y, sparks[i].r);
                        g.fill();
                    }
                }

                // 柯尔特公署官方颁发火漆印章锚点
                drawColtAgencySeal(halfW - 90, halfH - 120, 26);
                break;
            }

            case "feats": {
                // 强调色：BRASS #D4A373 做旧铜 (≤ 15%)
                // 视觉锚点：通缉墙 + 锻造生铁方钉 + 悬赏令纸角
                // 1. 松木通缉木墙 (Wanted Board)
                const boardW = width - 60;
                const boardH = 140;
                const boardY = halfH - 130;
                g.fillColor = WestColors.SAND_MEDIUM;
                g.roundRect(-boardW / 2, boardY - boardH / 2, boardW, boardH, 10);
                g.fill();
                WestTextures.applyWoodGrain(g, boardW, boardH, 2);

                // 黄铜外边框
                g.strokeColor = WestColors.BRASS;
                g.lineWidth = 2.0;
                g.roundRect(-boardW / 2 + 2, boardY - boardH / 2 + 2, boardW - 4, boardH - 4, 8);
                g.stroke();

                // 2. 锻造生铁方钉 (Heavy Forged Spikes)
                const nailPositions = [
                    [-boardW / 2 + 18, boardY + boardH / 2 - 18],
                    [boardW / 2 - 18, boardY + boardH / 2 - 18],
                    [-boardW / 2 + 18, boardY - boardH / 2 + 18],
                    [boardW / 2 - 18, boardY - boardH / 2 + 18],
                ];
                for (const [nx, ny] of nailPositions) {
                    g.fillColor = WestColors.GUNMETAL;
                    g.rect(nx - 4, ny - 4, 8, 8);
                    g.fill();
                    g.fillColor = WestColors.SHELL_SILVER;
                    g.rect(nx - 1.5, ny - 1.5, 3, 3);
                    g.fill();
                }

                // 悬赏令撕裂残角
                g.fillColor = WestColors.CREAM;
                g.moveTo(-boardW / 2 + 38, boardY - 20);
                g.lineTo(-boardW / 2 + 95, boardY - 20);
                g.lineTo(-boardW / 2 + 88, boardY + 35);
                g.lineTo(-boardW / 2 + 38, boardY + 30);
                g.close();
                g.fill();
                break;
            }

            case "stable": {
                // 强调色：HAY_GOLD #E9D8A6 干草黄 (≤ 15%)
                // 视觉锚点：谷仓人字木梁 + 干草堆 + 套马索
                // 1. 顶部人字形大木梁 (Barn Timber Rafters)
                g.strokeColor = WestColors.LEATHER_MEDIUM;
                g.lineWidth = 16;
                g.moveTo(-halfW, halfH);
                g.lineTo(0, halfH - 140);
                g.lineTo(halfW, halfH);
                g.stroke();

                // 木梁铁栓扣
                g.fillColor = WestColors.GUNMETAL;
                g.circle(0, halfH - 140, 9);
                g.fill();

                // 2. 悬挂马灯光晕 (Lantern Glow)
                const lanternY = halfH - 180;
                g.fillColor = new Color(233, 216, 166, 65);
                g.circle(0, lanternY, 45);
                g.fill();
                g.fillColor = WestColors.BRASS;
                g.rect(-6, lanternY - 10, 12, 18);
                g.fill();

                // 3. 人行道旁的干草堆 (Hay Bundle on the Boardwalk)
                const hayX = halfW - 120;
                const hayY = -halfH + 60;
                g.fillColor = WestColors.HAY_GOLD;
                g.roundRect(hayX - 35, hayY - 20, 70, 40, 8);
                g.fill();
                // 稻草杂乱纤维
                g.strokeColor = new Color(185, 150, 90, 150);
                g.lineWidth = 1.0;
                for (let i = 0; i < 8; i++) {
                    g.moveTo(hayX - 25 + i * 6, hayY - 12);
                    g.lineTo(hayX - 20 + i * 7, hayY + 14);
                    g.stroke();
                }

                // 悬挂盘曲套马索 (Coiled Lasso)
                g.strokeColor = WestColors.LEATHER_MEDIUM;
                g.lineWidth = 2.2;
                g.arc(-halfW + 80, halfH - 240, 24, 0, Math.PI * 1.8, false);
                g.stroke();
                break;
            }

            case "settings": {
                // 强调色：DENIM_BLUE #457B9D 牛仔布 (≤ 15%)
                // 视觉锚点：电报机木座 + 旋钮与架空电报铜线
                // 1. 顶部架空电报线剪影 (Aerial Telegraph Wires)
                g.strokeColor = new Color(55, 80, 110, 150);
                g.lineWidth = 1.4;
                g.moveTo(-halfW, halfH - 70);
                g.lineTo(halfW, halfH - 65);
                g.moveTo(-halfW, halfH - 85);
                g.lineTo(halfW, halfH - 82);
                g.stroke();

                // 2. 电报局牛仔蓝标牌 (Telegraph Desk Plaque)
                const plaqueW = 260;
                const plaqueH = 46;
                const plaqueY = halfH - 130;
                g.fillColor = WestColors.DENIM_BLUE;
                g.roundRect(-plaqueW / 2, plaqueY - plaqueH / 2, plaqueW, plaqueH, 6);
                g.fill();
                g.strokeColor = WestColors.BRASS;
                g.lineWidth = 1.6;
                g.roundRect(-plaqueW / 2 + 2, plaqueY - plaqueH / 2 + 2, plaqueW - 4, plaqueH - 4, 4);
                g.stroke();

                // 3. 黄铜微调旋钮 (Brass Adjustment Knobs)
                for (let k = -60; k <= 60; k += 60) {
                    g.fillColor = WestColors.BRASS;
                    g.circle(k, -halfH + 80, 8);
                    g.fill();
                    g.fillColor = WestColors.GUNMETAL;
                    g.circle(k, -halfH + 80, 3);
                    g.fill();
                }
                break;
            }

            case "history": // 夜班账房
            default: {
                // 强调色：DENIM_DEEP #1D3557 夜靛 (≤ 15%)
                // 视觉锚点：石板黑板框架 + 细微粉笔划痕 + 钟摆机械齿轮
                // 1. 顶部石板黑板账目楣条 (Slate Ledger Heading Bar)
                const barW = width - 80;
                const barH = 50;
                const barY = halfH - 95;
                g.fillColor = WestColors.DENIM_DEEP;
                g.roundRect(-barW / 2, barY - barH / 2, barW, barH, 6);
                g.fill();

                // 微弱粉笔灰拂痕
                g.fillColor = new Color(220, 235, 255, 20);
                g.ellipse(-60, barY, 120, 12);
                g.ellipse(80, barY, 90, 10);
                g.fill();

                // 黄铜包角
                g.fillColor = WestColors.BRASS;
                g.rect(-barW / 2, barY - barH / 2, 8, 8);
                g.rect(barW / 2 - 8, barY - barH / 2, 8, 8);
                g.rect(-barW / 2, barY + barH / 2 - 8, 8, 8);
                g.rect(barW / 2 - 8, barY + barH / 2 - 8, 8, 8);
                g.fill();

                // 2. 账房机械钟摆与齿轮剪影 (Clockwork Pendulum)
                const pendX = halfW - 85;
                const pendY = halfH - 240;
                g.strokeColor = WestColors.BRASS;
                g.lineWidth = 2.0;
                g.moveTo(pendX, pendY + 50);
                g.lineTo(pendX - 10, pendY);
                g.stroke();
                g.fillColor = WestColors.BRASS;
                g.circle(pendX - 10, pendY, 11);
                g.fill();
                break;
            }
        }
    }

    /**
     * 【日晒高对比悬赏告示卡片 (v2.1 质感打磨)】
     * 日晒牛皮纸底 + 风滚草剪影水印 + 真实咖啡杯底圈渍 + 3D 立体黄铜铆钉。
     */
    public static drawSunBleachedPoster(
        node: Node,
        width: number,
        height: number,
        radius = 8,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 浅米白日晒牛皮纸底 (SAND_LIGHT)
        g.fillColor = WestColors.SAND_LIGHT;
        g.roundRect(-halfW, -halfH, width, height, radius);
        g.fill();

        // 2. 居中淡雅风滚草水印 (Tumbleweed Watermark Silhouette)
        g.strokeColor = new Color(185, 150, 110, 22);
        g.lineWidth = 1.2;
        const twR = Math.min(55, width * 0.16);
        g.circle(0, 0, twR);
        g.circle(0, 0, twR * 0.65);
        for (let a = 0; a < 6; a++) {
            const rad = (Math.PI / 3) * a;
            g.moveTo(0, 0);
            g.lineTo(Math.cos(rad) * twR, Math.sin(rad) * twR);
        }
        g.stroke();

        // 3. 复古咖啡杯圈渍旧印痕 (Coffee Ring Stain & Satellite Drops)
        if (width >= 180 && height >= 100) {
            const stainX = halfW - 75;
            const stainY = halfH - 65;
            // 外圈深色沉淀环
            g.strokeColor = new Color(175, 125, 80, 50);
            g.lineWidth = 2.8;
            g.circle(stainX, stainY, 34);
            g.stroke();
            // 内圈浅色晕染
            g.strokeColor = new Color(195, 150, 105, 30);
            g.lineWidth = 1.5;
            g.circle(stainX + 2, stainY - 2, 31);
            g.stroke();
            // 边缘飞溅小水滴
            g.fillColor = new Color(170, 120, 75, 45);
            g.circle(stainX + 38, stainY + 12, 2.5);
            g.circle(stainX + 44, stainY + 8, 1.5);
            g.fill();
        }

        // 4. 悬赏令炭黑双线边框 (Charcoal Double Frame)
        g.strokeColor = WestColors.INK_BROWN;
        g.lineWidth = 2.0;
        g.roundRect(-halfW + 6, -halfH + 6, width - 12, height - 12, Math.max(2, radius - 2));
        g.stroke();

        g.lineWidth = 0.8;
        g.roundRect(-halfW + 10, -halfH + 10, width - 20, height - 20, Math.max(2, radius - 4));
        g.stroke();

        // 5. 四角 3D 立体黄铜铆钉 (Spherical Brass Rivets with Specular Highlight)
        if (width >= 80 && height >= 50) {
            const inset = 9;
            const corners = [
                { x: -halfW + inset, y: halfH - inset },
                { x: halfW - inset, y: halfH - inset },
                { x: -halfW + inset, y: -halfH + inset },
                { x: halfW - inset, y: -halfH + inset },
            ];
            for (const c of corners) {
                // 铆钉底座阴影
                g.fillColor = new Color(50, 30, 15, 140);
                g.circle(c.x + 0.8, c.y - 0.8, 3.6);
                g.fill();
                // 黄铜球体
                g.fillColor = WestColors.BRASS;
                g.circle(c.x, c.y, 3.2);
                g.fill();
                // 左上白色高光点
                g.fillColor = WestColors.SHELL_SILVER;
                g.circle(c.x - 0.9, c.y + 0.9, 1.1);
                g.fill();
            }
        }
    }

    /**
     * 【亚麻布纹理奶油输入框底板】(Linen Woven Cream Input Box)
     * 用于登录与注册页的账号输入，呈现日晒浅色粗麻布织线质感与清晰深墨字
     */
    public static drawLinenInputBox(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 奶油亚麻基底 (CREAM #FEFAE0)
        g.fillColor = WestColors.CREAM;
        g.roundRect(-halfW, -halfH, width, height, 6);
        g.fill();

        // 2. 亚麻布织线暗纹 (Woven Cross-hatch Lines)
        g.strokeColor = new Color(220, 205, 175, 75);
        g.lineWidth = 1.0;
        for (let x = -halfW + 16; x < halfW; x += 16) {
            g.moveTo(x, -halfH + 2);
            g.lineTo(x, halfH - 2);
            g.stroke();
        }

        // 3. 皮革缝线外框
        g.strokeColor = WestColors.LEATHER_MEDIUM;
        g.lineWidth = 1.8;
        g.roundRect(-halfW + 1, -halfH + 1, width - 2, height - 2, 5);
        g.stroke();
    }

    /**
     * 【旧皮革棕内嵌密码输入框底板】(Recessed Aged Leather Input Box)
     * 用于金库密匙与密码输入，呈现皮革凹陷立体内阴影与金色提示
     */
    public static drawLeatherInputBox(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 旧皮革深棕主基底 (LEATHER_DARK #7F4F24)
        g.fillColor = WestColors.LEATHER_DARK;
        g.roundRect(-halfW, -halfH, width, height, 6);
        g.fill();

        // 2. 顶部与左侧内凹阴影 (Recessed Inner Shadow)
        g.fillColor = new Color(20, 10, 5, 160);
        g.rect(-halfW + 2, halfH - 6, width - 4, 4);
        g.rect(-halfW + 2, -halfH + 2, 4, height - 4);
        g.fill();

        // 3. 黄铜镶嵌边框 (BRASS)
        g.strokeColor = WestColors.BRASS;
        g.lineWidth = 1.4;
        g.roundRect(-halfW + 1, -halfH + 1, width - 2, height - 2, 5);
        g.stroke();
    }

    /**
     * 【双实木卷轴牛皮卷纸】(Dual Roller Leather Scroll)
     * 用于浮动彩池等公证书与长篇公告，左右附带两根老橡木车削卷轴把手
     */
    public static drawLeatherScroll(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 左右实木卷轴端柄 (Turned Wood Handles)
        const handleW = 16;
        g.fillColor = WestColors.LEATHER_MEDIUM;
        // 左卷轴
        g.roundRect(-halfW, -halfH - 14, handleW, height + 28, 6);
        g.fill();
        // 右卷轴
        g.roundRect(halfW - handleW, -halfH - 14, handleW, height + 28, 6);
        g.fill();

        // 轴头黄铜装饰套箍
        g.fillColor = WestColors.BRASS;
        g.rect(-halfW - 2, halfH + 6, handleW + 4, 8);
        g.rect(-halfW - 2, -halfH - 14, handleW + 4, 8);
        g.rect(halfW - handleW - 2, halfH + 6, handleW + 4, 8);
        g.rect(halfW - handleW - 2, -halfH - 14, handleW + 4, 8);
        g.fill();

        // 2. 舒展牛皮卷纸面 (CREAM)
        const scrollW = width - handleW * 2 + 4;
        g.fillColor = WestColors.CREAM;
        g.roundRect(-halfW + handleW - 2, -halfH, scrollW, height, 4);
        g.fill();

        // 卷纸上下边缘卷曲阴影
        g.fillColor = new Color(210, 185, 140, 140);
        g.rect(-halfW + handleW - 2, halfH - 8, scrollW, 8);
        g.rect(-halfW + handleW - 2, -halfH, scrollW, 8);
        g.fill();

        // 纸面深墨框线
        g.strokeColor = WestColors.INK_SOFT;
        g.lineWidth = 1.2;
        g.roundRect(-halfW + handleW + 6, -halfH + 8, scrollW - 16, height - 16, 3);
        g.stroke();

        // 纸草浆纤维质感 (Parchment Fiber)
        WestTextures.applyParchmentFiber(g, scrollW, height, 18);
    }

    /**
     * 【边境电报纸带优惠/邀请券】(Telegraph Ticker Tape)
     * 两侧打孔等宽电报纸带，用于个人设置页的专属邀请码与公函展示
     */
    public static drawTelegraphTape(node: Node, width: number, height: number): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        // 1. 米白电报打孔纸带主体
        g.fillColor = WestColors.CREAM;
        g.roundRect(-halfW, -halfH, width, height, 4);
        g.fill();

        // 2. 上下两排电报机打孔齿痕
        g.fillColor = WestColors.DENIM_BLUE; // 透出底色
        const holeRadius = 3.5;
        const spacing = 18;
        for (let x = -halfW + 15; x < halfW - 10; x += spacing) {
            g.circle(x, halfH - 6, holeRadius);
            g.circle(x, -halfH + 6, holeRadius);
        }
        g.fill();

        // 3. 纸带水平打印辅助基准红线
        g.strokeColor = new Color(215, 90, 80, 80);
        g.lineWidth = 1;
        g.moveTo(-halfW + 10, halfH - 14);
        g.lineTo(halfW - 10, halfH - 14);
        g.moveTo(-halfW + 10, -halfH + 14);
        g.lineTo(halfW - 10, -halfH + 14);
        g.stroke();
    }

    /**
     * 【牛仔套马索风格属性雷达图】(Lasso Rope Radar)
     * 用于马厩与骑师属性可视化展示
     */
    public static drawLassoRadar(node: Node, size: number, stats: number[]): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const r = size / 2;
        const numAxes = 4; // 速度、耐力、爆发力、胜率
        const angles = [-Math.PI / 2, 0, Math.PI / 2, Math.PI];

        // 1. 套马索编织外圈 (Rope Outer Circle)
        g.strokeColor = WestColors.LEATHER_LIGHT;
        g.lineWidth = 3.5;
        g.circle(0, 0, r);
        g.stroke();

        g.strokeColor = WestColors.LEATHER_DARK;
        g.lineWidth = 1.0;
        g.circle(0, 0, r * 0.5);
        g.stroke();

        // 2. 四极十字瞄准线
        g.strokeColor = new Color(160, 110, 70, 100);
        g.lineWidth = 1;
        g.moveTo(-r, 0);
        g.lineTo(r, 0);
        g.moveTo(0, -r);
        g.lineTo(0, r);
        g.stroke();

        // 3. 属性多边形填充 (仙人掌绿 / 绿松石半透高亮)
        if (stats.length >= 4) {
            g.fillColor = new Color(42, 157, 143, 110);
            g.strokeColor = WestColors.TURQUOISE;
            g.lineWidth = 2.0;

            const pts: Array<{ x: number; y: number }> = [];
            for (let i = 0; i < numAxes; i++) {
                const val = Math.max(0.2, Math.min(1.0, stats[i] || 0.5));
                const ptR = r * val;
                const px = ptR * Math.cos(angles[i]);
                const py = ptR * Math.sin(angles[i]);
                pts.push({ x: px, y: py });
                if (i === 0) g.moveTo(px, py);
                else g.lineTo(px, py);
            }
            g.close();
            g.fill();
            g.stroke();

            // 顶点皮绳木扣节点
            g.fillColor = WestColors.BRASS;
            for (const pt of pts) {
                g.circle(pt.x, pt.y, 4);
                g.fill();
            }
        }
    }

    /**
     * 【6 匹赛驹官方传统赛马丝绸花色纹样绘制】(Authentic Jockey Silks)
     * 严格遵照世界传统赛马规范：
     * 1号: 红底黑斜带 (Red with Black Sash)
     * 2号: 蓝白菱格拼花 (Blue & White Diamond Harlequin)
     * 3号: 墨绿底金环 (Forest Green with Gold Hoops)
     * 4号: 橙白棋盘格 (Orange & White Check)
     * 5号: 皇家紫金折线闪电 (Royal Purple with Gold Lightning Chevron)
     * 6号: 炭黑粗黄铜条纹 (Black & Brass Horizontal Bars)
     */
    public static drawHorseSilkPattern(
        node: Node,
        horseNo: number,
        width: number,
        height: number,
    ): void {
        const g = node.getComponent(Graphics) || node.addComponent(Graphics);
        g.clear();

        const halfW = width / 2;
        const halfH = height / 2;

        switch (horseNo) {
            case 1: { // 1号 烈焰疾风：红底黑斜带
                g.fillColor = new Color(205, 30, 40, 255);
                g.rect(-halfW, -halfH, width, height);
                g.fill();

                g.fillColor = new Color(25, 25, 25, 255);
                g.moveTo(-halfW, halfH - 12);
                g.lineTo(-halfW + 16, halfH);
                g.lineTo(halfW, -halfH + 12);
                g.lineTo(halfW - 16, -halfH);
                g.close();
                g.fill();
                break;
            }
            case 2: { // 2号 黑金魅影：蓝白菱格
                g.fillColor = new Color(30, 80, 150, 255);
                g.rect(-halfW, -halfH, width, height);
                g.fill();

                g.fillColor = new Color(250, 250, 250, 255);
                const diaW = width / 2;
                const diaH = height / 2;
                // 中心菱形
                g.moveTo(0, halfH - 2);
                g.lineTo(diaW * 0.6, 0);
                g.lineTo(0, -halfH + 2);
                g.lineTo(-diaW * 0.6, 0);
                g.close();
                g.fill();
                break;
            }
            case 3: { // 3号 荒野游侠：墨绿底金环
                g.fillColor = new Color(35, 105, 55, 255);
                g.rect(-halfW, -halfH, width, height);
                g.fill();

                g.fillColor = WestColors.GOLD_LEAF;
                g.rect(-halfW, -halfH * 0.3, width, height * 0.3);
                g.fill();
                break;
            }
            case 4: { // 4号 沙漠风暴：橙白棋盘格
                g.fillColor = new Color(235, 120, 45, 255);
                g.rect(-halfW, -halfH, width, height);
                g.fill();

                g.fillColor = new Color(250, 250, 245, 255);
                g.rect(-halfW, 0, halfW, halfH);
                g.rect(0, -halfH, halfW, halfH);
                g.fill();
                break;
            }
            case 5: { // 5号 皇家荣耀：皇家紫金闪电
                g.fillColor = new Color(90, 40, 120, 255);
                g.rect(-halfW, -halfH, width, height);
                g.fill();

                g.fillColor = WestColors.GOLD_LEAF;
                // 闪电折线
                g.moveTo(-halfW + 4, halfH);
                g.lineTo(0, 0);
                g.lineTo(4, 0);
                g.lineTo(-2, -halfH);
                g.lineTo(halfW - 4, -halfH);
                g.lineTo(2, 0);
                g.lineTo(-2, 0);
                g.close();
                g.fill();
                break;
            }
            case 6: // 6号 狂暴雷霆：黑金粗横条纹
            default: {
                g.fillColor = new Color(30, 30, 30, 255);
                g.rect(-halfW, -halfH, width, height);
                g.fill();

                g.fillColor = WestColors.BRASS;
                const barThickness = height / 5;
                g.rect(-halfW, halfH - barThickness * 2, width, barThickness);
                g.rect(-halfW, -halfH + barThickness, width, barThickness);
                g.fill();
                break;
            }
        }

        // 外围黄铜镶边
        g.strokeColor = WestColors.BRASS;
        g.lineWidth = 1.5;
        g.rect(-halfW + 1, -halfH + 1, width - 2, height - 2);
        g.stroke();
    }
}

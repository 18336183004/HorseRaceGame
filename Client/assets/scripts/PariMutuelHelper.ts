import { Button, Color, EventTouch, Graphics, Label, Layers, Node, UITransform } from "cc";
import { WestAudio } from "./WestAudio";
import { WestColors, WestStyle } from "./WestTheme";
import { WestTypography } from "./WestTypography";
import { WestMotion } from "./WestMotion";

/**
 * 浮动彩池制（Pari-Mutuel）与稀释赔率计算辅助中心 (v2.1 排版与动效规范)。
 *
 * 核心规则：
 * 1. 彩池池化赔付限额：每轮设立赔付安全限额彩池；
 * 2. 赔付稀释 (Dilution)：当总应付奖金超过彩池时，启动同权稀释因子 (DilutionFactor)；
 * 3. 1.05x 保底防亏机制：所有中奖订单稀释后均享有最低 1.05 倍保底赔付，杜绝中奖亏损。
 */
export class PariMutuelHelper {
    /** 格式化金额字符串 */
    public static formatMoney(amount: number): string {
        const safeAmount = typeof amount === "number" && !isNaN(amount) ? amount : 0;
        return safeAmount.toLocaleString("zh-CN", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
        });
    }

    /** 格式化稀释比例百分比 */
    public static formatDilutionPercent(factor: number): string {
        const safeFactor = typeof factor === "number" && !isNaN(factor) ? factor : 1.0;
        const pct = Math.min(100, Math.max(0, safeFactor * 100));
        return `${pct.toFixed(1)}%`;
    }

    /** 计算经浮动彩池与 1.05x 保底修正后的毛奖 */
    public static calculateFloorProtectedGross(
        betAmount: number,
        rawGross: number,
        dilutionFactor = 1.0,
    ): {
        grossReward: number;
        isDiluted: boolean;
        isFloorApplied: boolean;
    } {
        if (dilutionFactor >= 0.9999) {
            return {
                grossReward: rawGross,
                isDiluted: false,
                isFloorApplied: false,
            };
        }

        const diluted = rawGross * dilutionFactor;
        const floor = betAmount * 1.05;
        const finalGross = Math.max(diluted, floor);
        const isFloorApplied = diluted < floor;

        return {
            grossReward: Number(finalGross.toFixed(2)),
            isDiluted: true,
            isFloorApplied,
        };
    }

    /**
     * 渲染下注控制台顶部的彩池状态标签
     */
    public static renderPoolBadge(
        parent: Node,
        x: number,
        y: number,
        poolAmount: number,
        dilutionFactor = 1.0,
        onClick?: () => void,
    ): Node {
        const isDiluted = dilutionFactor < 0.9999 && dilutionFactor > 0;
        const badge = new Node("PariMutuelBadge");
        badge.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(badge);
        badge.setPosition(x, y);
        badge.addComponent(UITransform).setContentSize(300, 32);

        const g = badge.addComponent(Graphics);
        g.fillColor = isDiluted ? new Color(70, 30, 20, 240) : new Color(30, 30, 20, 230);
        g.roundRect(-150, -16, 300, 32, 6);
        g.fill();
        g.strokeColor = isDiluted ? WestColors.BANDANA_RED : WestColors.GOLD_METALLIC;
        g.lineWidth = 1.0;
        g.roundRect(-150, -16, 300, 32, 6);
        g.stroke();

        const labelNode = new Node("BadgeLabel");
        labelNode.layer = badge.layer;
        badge.addChild(labelNode);
        const lbl = labelNode.addComponent(Label);
        if (isDiluted) {
            lbl.string = `⚠️ 彩池稀释: x${PariMutuelHelper.formatDilutionPercent(dilutionFactor)} (1.05x保底)`;
        } else {
            lbl.string = `💰 浮动彩池: ${PariMutuelHelper.formatMoney(poolAmount)} 🪙`;
        }
        WestTypography.apply(lbl, "caption", {
            size: 12,
            color: WestColors.GOLD_BRIGHT,
        });

        if (onClick) {
            const btn = badge.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            badge.on(Button.EventType.CLICK, () => {
                WestMotion.playButtonPress(badge, false, onClick);
            });
        }

        return badge;
    }

    /**
     * 显示浮动彩池制（Pari-Mutuel）与保底机制规则说明弹窗
     */
    public static showRulesModal(
        root: Node,
        poolAmount: number,
        dilutionFactor = 1.0,
    ): Node {
        WestAudio.playScrollUnfurl();

        const mask = new Node("PariMutuelModalMask");
        mask.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(mask);
        mask.setPosition(360, 640);
        mask.addComponent(UITransform).setContentSize(720, 1280);

        const gMask = mask.addComponent(Graphics);
        gMask.fillColor = new Color(20, 15, 10, 190);
        gMask.rect(-360, -640, 720, 1280);
        gMask.fill();
        mask.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            event.propagationStopped = true;
        });
        mask.on(Node.EventType.TOUCH_END, () => {
            if (mask && mask.isValid) {
                mask.destroy();
            }
        });

        // 真实两端木轴展开的牛皮卷轴 (Dual Roller Leather Scroll)
        const card = new Node("PariMutuelCard");
        card.layer = mask.layer;
        mask.addChild(card);
        card.addComponent(UITransform).setContentSize(660, 620);
        WestStyle.drawLeatherScroll(card, 660, 620);
        card.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            event.propagationStopped = true;
        });
        card.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
        });

        // 标题
        const titleBox = new Node("TitleBox");
        titleBox.layer = card.layer;
        card.addChild(titleBox);
        titleBox.setPosition(0, 245);
        titleBox.addComponent(UITransform).setContentSize(580, 50);

        const tLabelNode = new Node("TitleText");
        tLabelNode.layer = titleBox.layer;
        titleBox.addChild(tLabelNode);
        const tl = tLabelNode.addComponent(Label);
        tl.string = "📜 边境公证处 · 浮动彩池规则 (Pari-Mutuel)";
        WestTypography.apply(tl, "heading", {
            size: 19,
            color: WestColors.INK_BROWN,
        });

        // 右上角便捷关闭按钮 [✕]
        const topCloseNode = new Node("TopCloseBtn");
        topCloseNode.layer = card.layer;
        card.addChild(topCloseNode);
        topCloseNode.setPosition(275, 245);
        topCloseNode.addComponent(UITransform).setContentSize(44, 44);
        const tcLabel = topCloseNode.addComponent(Label);
        tcLabel.string = "✕";
        WestTypography.apply(tcLabel, "heading", { size: 22, color: WestColors.INK_BROWN });
        const tcBtn = topCloseNode.addComponent(Button);
        tcBtn.transition = Button.Transition.SCALE;
        topCloseNode.on(Button.EventType.CLICK, () => {
            if (mask && mask.isValid) {
                mask.destroy();
            }
        });

        // 内容牛皮纸说明
        const descCard = new Node("DescCard");
        descCard.layer = card.layer;
        card.addChild(descCard);
        descCard.setPosition(0, 30);
        descCard.addComponent(UITransform).setContentSize(580, 350);

        const dLabelNode = new Node("DescText");
        dLabelNode.layer = descCard.layer;
        descCard.addChild(dLabelNode);
        dLabelNode.addComponent(UITransform).setContentSize(540, 330);
        const dl = dLabelNode.addComponent(Label);
        WestTypography.apply(dl, "body", {
            size: 14,
            color: WestColors.INK_BROWN,
        });

        const isDiluted = dilutionFactor < 0.9999 && dilutionFactor > 0;
        dl.string =
            `【当前边境局势】\n` +
            `• 本轮安全彩池总额: ${PariMutuelHelper.formatMoney(poolAmount)} 🪙\n` +
            `• 稀释结算因子: ${isDiluted ? `x${PariMutuelHelper.formatDilutionPercent(dilutionFactor)} (已触发稀释)` : "100% (未触发稀释)"}\n\n` +
            `【浮动彩池 (Pari-Mutuel) 三大公证铁律】\n` +
            `1. 彩池防穿仓机制：当全场总赔付超出本轮安全彩池时，启动同权稀释因子 (DilutionFactor)。\n` +
            `2. 1.05x 保底防亏铁律：稀释绝不会导致玩家中奖后倒贴亏本！系统硬性保障中奖金额不低于本金的 105%。\n` +
            `3. 规费减免友好：实际平台规费将在稀释后的实际毛收益上按比例扣缴。\n\n` +
            `怀俄明柯尔特特区公署 · 边境公证人 敬启`;

        // 关闭按钮
        const closeBtn = new Node("CloseBtn");
        closeBtn.layer = card.layer;
        card.addChild(closeBtn);
        closeBtn.setPosition(0, -185);
        closeBtn.addComponent(UITransform).setContentSize(240, 50);
        WestStyle.drawActionBanner(closeBtn, 240, 50, true);

        const btnTextNode = new Node("BtnText");
        btnTextNode.layer = closeBtn.layer;
        closeBtn.addChild(btnTextNode);
        const btnLabel = btnTextNode.addComponent(Label);
        btnLabel.string = "知晓并收起卷轴";
        WestTypography.apply(btnLabel, "heading", {
            size: 16,
            color: WestColors.GOLD_LEAF,
        });

        const btn = closeBtn.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        closeBtn.on(Button.EventType.CLICK, () => {
            WestMotion.playButtonPress(closeBtn, false, () => {
                mask.destroy();
            });
        });

        // 底部文字
        const footNode = new Node("FootText");
        footNode.layer = card.layer;
        card.addChild(footNode);
        footNode.setPosition(0, -255);
        const fl = footNode.addComponent(Label);
        fl.string = "🌵 怀俄明柯尔特特区公署 · Pari-Mutuel 浮动彩池公证 🌵";
        WestTypography.apply(fl, "caption", {
            size: 12,
            color: WestColors.INK_SOFT,
        });

        return mask;
    }
}

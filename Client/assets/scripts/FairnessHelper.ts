import { Button, Color, EventTouch, Graphics, Label, Layers, Node, UITransform } from "cc";
import { WestAudio } from "./WestAudio";
import { WestColors, WestStyle } from "./WestTheme";
import { WestTypography } from "./WestTypography";
import { WestMotion } from "./WestMotion";

/**
 * 可证明公允（Provably Fair）时序与密码学校验器 (v2.1 排版与动效规范)。
 *
 * 时序规范：
 * 1. 下注开始前 (BettingStart)：服务端已生成加密种子并公示 Commitment = SHA256(ServerSeed)；
 * 2. 下注全部封盘开赛并结算后：服务端公布明文 ServerSeed；
 * 3. 客户端执行反向 SHA-256 算法比对 Commitment，保证赛果无法篡改且无剧透。
 */
export class FairnessHelper {
    /** 纯前端计算 SHA-256 十六进制哈希 */
    public static async sha256(message: string): Promise<string> {
        if (typeof crypto !== "undefined" && crypto.subtle) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        return "";
    }

    /** 校验明文种子与哈希承诺是否一致 */
    public static async verifySeed(seed: string, commitment: string): Promise<boolean> {
        if (!seed || !commitment) {
            return false;
        }
        const calcHash = await this.sha256(seed);
        return calcHash.toLowerCase() === commitment.toLowerCase();
    }

    /** 渲染下注台顶部/底部的承诺徽章 */
    public static renderCommitmentBadge(
        parent: Node,
        x: number,
        y: number,
        commitment: string,
        seed: string | null | undefined,
        onClick: () => void,
    ): Node {
        const badge = new Node("FairnessBadge");
        badge.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(badge);
        badge.setPosition(x, y);
        badge.addComponent(UITransform).setContentSize(300, 32);

        const isSettled = Boolean(seed);
        const g = badge.addComponent(Graphics);
        g.fillColor = isSettled ? new Color(35, 60, 40, 240) : new Color(30, 25, 20, 230);
        g.roundRect(-150, -16, 300, 32, 6);
        g.fill();
        g.strokeColor = isSettled ? WestColors.DESERT_SAGE : WestColors.GOLD_METALLIC;
        g.lineWidth = 1.0;
        g.roundRect(-150, -16, 300, 32, 6);
        g.stroke();

        const shortCommit = commitment ? `${commitment.slice(0, 8)}...${commitment.slice(-6)}` : "未就绪";
        const labelNode = new Node("BadgeLabel");
        labelNode.layer = badge.layer;
        badge.addChild(labelNode);
        const lbl = labelNode.addComponent(Label);
        lbl.string = isSettled
            ? `🔐 公平承诺已验算 (SHA-256)`
            : `🔐 承诺锁定: ${shortCommit}`;
        WestTypography.apply(lbl, "caption", {
            size: 12,
            color: isSettled ? WestColors.DESERT_SAGE : WestColors.GOLD_BRIGHT,
        });

        const btn = badge.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        badge.on(Button.EventType.CLICK, () => {
            WestMotion.playButtonPress(badge, false, onClick);
        });
        return badge;
    }

    /**
     * 打开 Provably Fair 可证明公允详细核验弹窗
     */
    public static async showFairnessModal(
        root: Node,
        commitment: string,
        seed: string | null | undefined,
        roundNo = "",
    ): Promise<Node> {
        const mask = new Node("FairnessModalMask");
        mask.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(mask);
        mask.setPosition(360, 640);
        mask.addComponent(UITransform).setContentSize(720, 1280);

        const gMask = mask.addComponent(Graphics);
        gMask.fillColor = new Color(18, 12, 8, 180);
        gMask.rect(-360, -640, 720, 1280);
        gMask.fill();
        mask.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            event.propagationStopped = true;
        });
        mask.on(Node.EventType.TOUCH_END, () => {
            WestMotion.playModalExit(card, mask, () => {
                if (mask && mask.isValid) {
                    mask.destroy();
                }
            });
        });

        // 中心老橡木主面板
        const card = new Node("FairnessCard");
        card.layer = mask.layer;
        mask.addChild(card);
        card.addComponent(UITransform).setContentSize(670, 760);
        WestStyle.drawGrandSaloonPanel(card, 670, 760, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        card.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            event.propagationStopped = true;
        });
        card.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
        });

        // 丝滑展开入场动效
        WestMotion.playModalEnter(card, mask);

        // 标题黑板
        const titleBox = new Node("TitleBox");
        titleBox.layer = card.layer;
        card.addChild(titleBox);
        titleBox.setPosition(0, 325);
        titleBox.addComponent(UITransform).setContentSize(630, 64);
        WestStyle.drawChalkBoard(titleBox, 630, 64, 8);

        const tLabelNode = new Node("TitleText");
        tLabelNode.layer = titleBox.layer;
        titleBox.addChild(tLabelNode);
        const tl = tLabelNode.addComponent(Label);
        tl.string = `🔐 柯尔特公证署 · 可证明公允性验算\n${roundNo ? `第 ${roundNo} 期 · ` : ""}SHA-256 密码承诺锁定体系`;
        WestTypography.apply(tl, "heading", {
            size: 17,
            color: WestColors.GOLD_BRIGHT,
        });

        // 右上角快捷关闭按钮 [✕]
        const topCloseNode = new Node("TopCloseBtn");
        topCloseNode.layer = card.layer;
        card.addChild(topCloseNode);
        topCloseNode.setPosition(290, 325);
        topCloseNode.addComponent(UITransform).setContentSize(44, 44);
        const tcLabel = topCloseNode.addComponent(Label);
        tcLabel.string = "✕";
        WestTypography.apply(tcLabel, "heading", { size: 22, color: WestColors.GOLD_BRIGHT });
        const tcBtn = topCloseNode.addComponent(Button);
        tcBtn.transition = Button.Transition.SCALE;
        topCloseNode.on(Button.EventType.CLICK, () => {
            WestMotion.playModalExit(card, mask, () => {
                if (mask && mask.isValid) {
                    mask.destroy();
                }
            });
        });

        // 1. 服务端哈希承诺 (Commitment)
        const commitTitle = new Node("CommitTitle");
        commitTitle.layer = card.layer;
        card.addChild(commitTitle);
        commitTitle.setPosition(0, 260);
        const ctl = commitTitle.addComponent(Label);
        ctl.string = "📜 下注前已公布哈希承诺 Commitment = SHA256(ServerSeed)";
        WestTypography.apply(ctl, "caption", {
            size: 14,
            color: WestColors.GOLD_BRIGHT,
        });

        const commitBox = new Node("CommitBox");
        commitBox.layer = card.layer;
        card.addChild(commitBox);
        commitBox.setPosition(0, 215);
        commitBox.addComponent(UITransform).setContentSize(620, 48);
        WestStyle.drawWoodPlank(commitBox, 620, 48, 6, WestColors.WOOD_MEDIUM, WestColors.WOOD_FRAME);

        const cValNode = new Node("CommitVal");
        cValNode.layer = commitBox.layer;
        commitBox.addChild(cValNode);
        const cvl = cValNode.addComponent(Label);
        cvl.string = commitment || "暂无承诺数据";
        WestTypography.apply(cvl, "caption", {
            size: 13,
            color: WestColors.PARCHMENT_LIGHT,
        });

        // 2. 服务端明文随机种子 (ServerSeed)
        const seedTitle = new Node("SeedTitle");
        seedTitle.layer = card.layer;
        card.addChild(seedTitle);
        seedTitle.setPosition(0, 155);
        const stl = seedTitle.addComponent(Label);
        stl.string = "🎲 完赛后公开明文种子 ServerSeed (开赛前加密保密)";
        WestTypography.apply(stl, "caption", {
            size: 14,
            color: WestColors.GOLD_BRIGHT,
        });

        const seedBox = new Node("SeedBox");
        seedBox.layer = card.layer;
        card.addChild(seedBox);
        seedBox.setPosition(0, 110);
        seedBox.addComponent(UITransform).setContentSize(620, 48);
        WestStyle.drawWoodPlank(seedBox, 620, 48, 6, WestColors.WOOD_MEDIUM, WestColors.WOOD_FRAME);

        const sValNode = new Node("SeedVal");
        sValNode.layer = seedBox.layer;
        seedBox.addChild(sValNode);
        const svl = sValNode.addComponent(Label);
        svl.string = seed ? seed : "🔒 种子已在下注前锁定，完赛结算后公开明文防剧透";
        WestTypography.apply(svl, "caption", {
            size: 13,
            color: seed ? WestColors.PARCHMENT_LIGHT : WestColors.TEXT_MUTED,
        });

        // 3. 算法比对牛皮纸卡片
        const statusCard = new Node("StatusCard");
        statusCard.layer = card.layer;
        card.addChild(statusCard);
        statusCard.setPosition(0, 0);
        statusCard.addComponent(UITransform).setContentSize(620, 100);
        WestStyle.drawWantedPosterCard(statusCard, 620, 100, 8);

        const statusLabelNode = new Node("StatusLabel");
        statusLabelNode.layer = statusCard.layer;
        statusCard.addChild(statusLabelNode);
        statusLabelNode.addComponent(UITransform).setContentSize(580, 80);
        const statusLabel = statusLabelNode.addComponent(Label);
        WestTypography.apply(statusLabel, "body", {
            size: 14,
            color: WestColors.INK_DARK,
        });

        if (!seed) {
            statusLabel.string =
                "🔒 下注前已锁死赛果：服务端下注前即向公证署提交了 SHA-256 哈希承诺。\n" +
                "为杜绝透题，明文种子将在赛事完赛结算后公开供您反向验算！";
        } else {
            statusLabel.string = "正在调用客户端原生 WebCrypto SHA-256 比对验算...";
        }

        // 4. 一键核验按钮
        const verifyBtn = new Node("VerifyBtn");
        verifyBtn.layer = card.layer;
        card.addChild(verifyBtn);
        verifyBtn.setPosition(0, -95);
        verifyBtn.addComponent(UITransform).setContentSize(340, 52);
        WestStyle.drawActionBanner(verifyBtn, 340, 52, true);

        const vBtnTextNode = new Node("VBtnText");
        vBtnTextNode.layer = verifyBtn.layer;
        verifyBtn.addChild(vBtnTextNode);
        const vBtnLabel = vBtnTextNode.addComponent(Label);
        vBtnLabel.string = "⚡ 执行客户端 SHA-256 验算";
        WestTypography.apply(vBtnLabel, "heading", {
            size: 16,
            color: WestColors.GOLD_BRIGHT,
        });

        const runVerify = async (): Promise<void> => {
            if (!seed || !commitment) {
                statusLabel.string =
                    "⚠️ 当前赛事尚未完赛结算，明文种子处于加密保密期。\n" +
                    "请在开奖结算后再行验算哈希一致性！";
                statusLabel.color = WestColors.BANDANA_RED;
                return;
            }

            try {
                const passed = await FairnessHelper.verifySeed(seed, commitment);
                if (passed) {
                    statusLabel.string =
                        "✅ 柯尔特公证署 SHA-256 反向核验一致！\n" +
                        "SHA256(公开种子) === 下注前承诺哈希。\n" +
                        "赛果开赛前已锚定，杜绝作弊，公允有效！";
                    statusLabel.color = WestColors.DESERT_SAGE;
                    WestAudio.playGoldCascade();
                } else {
                    statusLabel.string = "❌ 核验失败：计算哈希与承诺不一致！";
                    statusLabel.color = WestColors.BANDANA_RED;
                }
            } catch {
                statusLabel.string = "核验异常：当前环境不支持标准 WebCrypto";
                statusLabel.color = WestColors.BANDANA_RED;
            }
        };

        const vBtn = verifyBtn.addComponent(Button);
        vBtn.transition = Button.Transition.NONE;
        verifyBtn.on(Button.EventType.CLICK, () => {
            WestMotion.playButtonPress(verifyBtn, true, () => {
                void runVerify();
            });
        });

        // 若已有 seed 则自动跑一次校验
        if (seed && commitment) {
            void runVerify();
        }

        // 5. 关闭按钮
        const closeBtn = new Node("CloseBtn");
        closeBtn.layer = card.layer;
        card.addChild(closeBtn);
        closeBtn.setPosition(0, -185);
        closeBtn.addComponent(UITransform).setContentSize(220, 46);
        WestStyle.drawWoodPlank(closeBtn, 220, 46, 6, WestColors.WOOD_MEDIUM, WestColors.WOOD_FRAME);

        const cTextNode = new Node("CloseBtnText");
        cTextNode.layer = closeBtn.layer;
        closeBtn.addChild(cTextNode);
        const cl = cTextNode.addComponent(Label);
        cl.string = "关闭";
        WestTypography.apply(cl, "heading", {
            size: 16,
            color: WestColors.PARCHMENT_LIGHT,
        });

        const cBtn = closeBtn.addComponent(Button);
        cBtn.transition = Button.Transition.NONE;
        closeBtn.on(Button.EventType.CLICK, () => {
            WestMotion.playButtonPress(closeBtn, false, () => {
                WestMotion.playModalExit(card, mask, () => {
                    if (mask && mask.isValid) {
                        mask.destroy();
                    }
                });
            });
        });

        // 6. 底部法律告知
        const legalNode = new Node("LegalText");
        legalNode.layer = card.layer;
        card.addChild(legalNode);
        legalNode.setPosition(0, -290);
        const ll = legalNode.addComponent(Label);
        ll.string = "🌵 怀俄明柯尔特特区赛马会公证署 · SHA-256 密码学链上存证 🌵";
        WestTypography.apply(ll, "caption", {
            size: 12,
            color: WestColors.TEXT_MUTED,
        });

        return mask;
    }
}

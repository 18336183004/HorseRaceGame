import { Button, Color, EventTouch, Graphics, Label, Layers, Node, UITransform } from "cc";
import { MaintenanceDto } from "./ApiTypes";
import { WestAudio } from "./WestAudio";
import { WestColors, WestStyle } from "./WestTheme";
import { WestTypography } from "./WestTypography";
import { WestMotion } from "./WestMotion";

/**
 * 边陲公署游戏维护控制中心 (v2.1 排版与动效规范)。
 * 集中管理维护预警通知、自动停赛提示与强制踢出锁定遮罩。
 */
export class MaintenanceHelper {
    private static currentMaintenance: MaintenanceDto | null = null;
    private static lockdownModalNode: Node | null = null;

    /** 更新维护状态快照 */
    public static updateState(dto?: MaintenanceDto | null): void {
        this.currentMaintenance = dto ?? null;
    }

    /** 获取当前维护数据快照 */
    public static getState(): MaintenanceDto | null {
        return this.currentMaintenance;
    }

    /** 是否处于停服维护进行中 */
    public static isUnderMaintenance(): boolean {
        return Boolean(this.currentMaintenance?.isMaintenanceActive);
    }

    /** 是否处于维护预告窗口期（赛程停止排期，提示下线） */
    public static isInNoticeWindow(): boolean {
        return Boolean(this.currentMaintenance?.inNoticeWindow);
    }

    /** 检查当前操作是否被维护阻断。如果在预告期，返回警告文案；如果在维护期，返回强制踢出文案。 */
    public static checkActionBlocked(): { blocked: boolean; warningOnly: boolean; message: string } {
        if (this.isUnderMaintenance()) {
            const reason = this.currentMaintenance?.maintenanceReason || this.currentMaintenance?.reason || "系统例行维护";
            return {
                blocked: true,
                warningOnly: false,
                message: `游戏维护中，请玩家下线等待维护！原因: ${reason}`,
            };
        }

        if (this.isInNoticeWindow()) {
            const mins = this.currentMaintenance?.minutesUntilStart ?? this.currentMaintenance?.remainingMinutes ?? 5;
            return {
                blocked: false,
                warningOnly: true,
                message: `提示：游戏将于 ${mins} 分钟后进行系统维护，请玩家下线等待维护！`,
            };
        }

        return { blocked: false, warningOnly: false, message: "" };
    }

    /**
     * 渲染顶部维护预告常驻横幅（如果处于预告期且未停服）。
     */
    public static renderNoticeBanner(
        parent: Node,
        y = 1210,
        onClick?: () => void,
    ): Node | null {
        if (!this.isInNoticeWindow() || this.isUnderMaintenance()) {
            return null;
        }

        const mins = this.currentMaintenance?.minutesUntilStart ?? this.currentMaintenance?.remainingMinutes ?? 5;
        const banner = new Node("MaintenanceNoticeBanner");
        banner.layer = parent.layer || Layers.Enum.UI_2D;
        const parentTransform = parent.getComponent(UITransform);
        const posX = parentTransform && parentTransform.anchorX === 0 ? 360 : 0;
        banner.setPosition(posX, y);
        banner.addComponent(UITransform).setContentSize(696, 36);

        const g = banner.addComponent(Graphics);
        g.fillColor = WestColors.BANDANA_RED;
        g.roundRect(-348, -18, 696, 36, 6);
        g.fill();
        g.strokeColor = WestColors.GOLD_BRIGHT;
        g.lineWidth = 1.2;
        g.roundRect(-348, -18, 696, 36, 6);
        g.stroke();

        const labelNode = new Node("BannerText");
        labelNode.layer = banner.layer;
        banner.addChild(labelNode);
        const lbl = labelNode.addComponent(Label);
        lbl.string = `⚠️ 边陲维护警报: 游戏将于 ${mins} 分钟后停服维护，请玩家提前下线等待维护！`;
        WestTypography.apply(lbl, "caption", {
            size: 13,
            color: WestColors.PARCHMENT_LIGHT,
        });

        if (onClick) {
            const btn = banner.addComponent(Button);
            btn.transition = Button.Transition.NONE;
            banner.on(Button.EventType.CLICK, () => {
                WestMotion.playButtonPress(banner, false, onClick);
            });
        }

        return banner;
    }

    /**
     * 显示全屏不可穿透的系统维护锁定面板，踢出玩家并禁止一切游戏操作。
     */
    public static showMaintenanceLockdownModal(
        root: Node,
        reason?: string | null,
        endAt?: string | null,
        onExitApp?: () => void,
    ): Node {
        if (this.lockdownModalNode && this.lockdownModalNode.isValid) {
            return this.lockdownModalNode;
        }

        WestAudio.playStampThud("COMMON");

        const r = reason || this.currentMaintenance?.maintenanceReason || this.currentMaintenance?.reason || "系统例行升级维护与赛事校准";
        const e = endAt || this.currentMaintenance?.maintenanceEndAt;

        // 全屏深黑遮罩（阻断所有触控事件）
        const mask = new Node("MaintenanceLockdownMask");
        mask.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(mask);
        const rootTransform = root.getComponent(UITransform);
        const maskX = rootTransform && rootTransform.anchorX === 0 ? 360 : 0;
        const maskY = rootTransform && rootTransform.anchorY === 0 ? 640 : 0;
        mask.setPosition(maskX, maskY);
        mask.addComponent(UITransform).setContentSize(720, 1280);

        const gMask = mask.addComponent(Graphics);
        gMask.fillColor = new Color(29, 53, 87, 245); // 全屏 96% 不透明 DENIM_DEEP (#1D3557 靛蓝夜)
        gMask.rect(-360, -640, 720, 1280);
        gMask.fill();

        // 吞噬所有点击
        mask.on(Node.EventType.TOUCH_START, (event: EventTouch) => {
            event.propagationStopped = true;
        });
        mask.on(Node.EventType.TOUCH_END, (event: EventTouch) => {
            event.propagationStopped = true;
        });

        // 中心黑铁铆钉重装锁定面板 (Gunmetal Black Iron Plate)
        const board = new Node("LockdownBoard");
        board.layer = mask.layer;
        mask.addChild(board);
        board.addComponent(UITransform).setContentSize(640, 520);
        WestStyle.drawGrandSaloonPanel(board, 640, 520, 16, WestColors.GUNMETAL, WestColors.BRASS);

        // 丝滑展开入场动效
        WestMotion.playModalEnter(board, mask);

        // 标题条
        const titleBox = new Node("TitleBox");
        titleBox.layer = board.layer;
        board.addChild(titleBox);
        titleBox.setPosition(0, 210);
        titleBox.addComponent(UITransform).setContentSize(580, 50);
        const gt = titleBox.addComponent(Graphics);
        gt.fillColor = WestColors.BANDANA_RED;
        gt.roundRect(-290, -25, 580, 50, 8);
        gt.fill();
        gt.strokeColor = WestColors.GOLD_BRIGHT;
        gt.lineWidth = 1.5;
        gt.roundRect(-290, -25, 580, 50, 8);
        gt.stroke();

        const tLabelNode = new Node("TitleText");
        tLabelNode.layer = titleBox.layer;
        titleBox.addChild(tLabelNode);
        const tLabel = tLabelNode.addComponent(Label);
        tLabel.string = "🚧 柯尔特特区公署 · 系统维护中 🚧";
        WestTypography.apply(tLabel, "heading", {
            size: 20,
            color: WestColors.GOLD_BRIGHT,
        });

        // 提示卡片
        const cardBox = new Node("CardBox");
        cardBox.layer = board.layer;
        board.addChild(cardBox);
        cardBox.setPosition(0, 50);
        cardBox.addComponent(UITransform).setContentSize(580, 220);
        WestStyle.drawWantedPosterCard(cardBox, 580, 220, 8);

        const noticeNode = new Node("NoticeDesc");
        noticeNode.layer = cardBox.layer;
        cardBox.addChild(noticeNode);
        noticeNode.setPosition(0, 30);
        const formattedEndAt = e && !isNaN(new Date(e).getTime()) ? new Date(e).toLocaleString("zh-CN") : null;
        const nLabel = noticeNode.addComponent(Label);
        nLabel.string =
            `尊敬的西部骑手：\n\n` +
            `为提供更公允稳定的游戏环境，游戏当前正在进行例行维护。\n` +
            `所有赛事与下注已暂停，所有在线玩家已强制下线。\n\n` +
            `📌 维护事由: ${r}\n` +
            (formattedEndAt ? `⏱️ 预计开服时间: ${formattedEndAt}\n` : "") +
            `请稍后重新进入游戏。`;
        WestTypography.apply(nLabel, "body", {
            size: 15,
            color: WestColors.INK_DARK,
        });
        noticeNode.addComponent(UITransform).setContentSize(540, 180);

        // 退出或刷新按钮
        const exitBtn = new Node("ExitBtn");
        exitBtn.layer = board.layer;
        board.addChild(exitBtn);
        exitBtn.setPosition(0, -140);
        exitBtn.addComponent(UITransform).setContentSize(240, 52);
        WestStyle.drawActionBanner(exitBtn, 240, 52, true);

        const btnTextNode = new Node("BtnText");
        btnTextNode.layer = exitBtn.layer;
        exitBtn.addChild(btnTextNode);
        const btnLabel = btnTextNode.addComponent(Label);
        btnLabel.string = "🚪 退出登录 / 重载";
        WestTypography.apply(btnLabel, "heading", {
            size: 17,
            color: WestColors.GOLD_BRIGHT,
        });

        const btn = exitBtn.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        exitBtn.on(Button.EventType.CLICK, () => {
            WestMotion.playButtonPress(exitBtn, true, () => {
                if (onExitApp) {
                    onExitApp();
                } else if (typeof window !== "undefined") {
                    window.location.reload();
                }
            });
        });

        // 底部小字
        const footNode = new Node("FootText");
        footNode.layer = board.layer;
        board.addChild(footNode);
        footNode.setPosition(0, -220);
        const fLabel = footNode.addComponent(Label);
        fLabel.string = "🌵 怀俄明柯尔特特区公署 · 边境特区秩序维护委员会 🌵";
        WestTypography.apply(fLabel, "caption", {
            size: 13,
            color: WestColors.TEXT_MUTED,
        });

        this.lockdownModalNode = mask;
        return mask;
    }

    /** 清理并移除锁定遮罩（当维护结束时） */
    public static dismissLockdown(): void {
        if (this.lockdownModalNode && this.lockdownModalNode.isValid) {
            this.lockdownModalNode.destroy();
        }
        this.lockdownModalNode = null;
    }
}

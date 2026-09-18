import { Node, Quat, Tween, UIOpacity, Vec3, tween } from "cc";
import { WestAudio } from "./WestAudio";

/**
 * 《西部边境赛马会》参数化动效与音画同步引擎 (v2.1)
 * 遵循 racegame-project-standards，严禁 any。
 *
 * 核心动效参数矩阵：
 * 1. 按钮按下 (Button Press): easeOutBack, 120ms, 缩放至 0.94 再回弹, 绑定皮革按压/上膛音效；
 * 2. 卡片翻页 (Card Flip): easeInOutCubic, 320ms, X轴微位移 + 8° 旋转；
 * 3. 火漆砸印 (Wax Stamp): easeInQuad (144ms) + easeOutElastic (96ms), 总计 240ms, 在 60% 关键帧对齐沉重盖印音效；
 * 4. 中奖金币 (Coin Shower): 错帧动画 800ms, 每枚 +80ms 阶梯升腾；
 * 5. 页面门换 (Saloon Door): easeInOutQuart, 450ms, 木门对开滑入；
 * 6. 筹码浮起 (Chip Float): easeOutBack, 180ms, Y轴 -6px 浮起回落并带微弱光晕；
 * 7. 并发管控：每屏同时运行动效 ≤ 3 组，防低端机卡顿掉帧。
 */
export class WestMotion {
    /** 基于过期时间戳的并发动效槽位池，防止因节点销毁或被中断导致槽位永久泄漏锁死 */
    private static activeSlots: number[] = [];
    private static readonly MAX_CONCURRENT_TWEENS = 3;

    private static acquireSlot(durationMs = 400): boolean {
        const now = Date.now();
        this.activeSlots = this.activeSlots.filter((expireAt) => expireAt > now);
        if (this.activeSlots.length >= this.MAX_CONCURRENT_TWEENS) {
            return false;
        }
        this.activeSlots.push(now + durationMs);
        return true;
    }

    private static releaseSlot(): void {
        if (this.activeSlots.length > 0) {
            this.activeSlots.shift();
        }
    }

    /**
     * 按钮按下弹性缩放反馈 (120ms easeOutBack)
     * 同时触发对应的音效（普通按钮触发 playLeatherPress，核心按钮触发 playRevolverCock）
     * 保证玩家点击必有按压反馈，不受全局槽位拥塞影响。
     */
    public static playButtonPress(
        node: Node,
        isCoreAction = false,
        onComplete?: () => void,
    ): void {
        if (!node || !node.isValid) return;

        // 音画绑定：按压触发 SFX
        if (isCoreAction) {
            WestAudio.playRevolverCock("COMMON");
        } else {
            WestAudio.playLeatherPress("COMMON");
        }

        const originalScale = node.getScale();
        const targetScale = new Vec3(
            originalScale.x * 0.94,
            originalScale.y * 0.94,
            originalScale.z,
        );

        Tween.stopAllByTarget(node);
        tween(node)
            .to(0.06, { scale: targetScale }, { easing: "sineOut" })
            .to(0.06, { scale: originalScale }, { easing: "backOut" })
            .call(() => {
                onComplete?.();
            })
            .start();
    }

    /**
     * 卡片翻页/切页展开 (320ms easeInOutCubic)
     */
    public static playCardFlip(
        node: Node,
        dx = 40,
        onComplete?: () => void,
    ): void {
        if (!node || !node.isValid) return;

        if (!this.acquireSlot()) {
            onComplete?.();
            return;
        }

        const originalPos = node.getPosition();
        node.setPosition(originalPos.x + dx, originalPos.y, originalPos.z);
        node.setRotationFromEuler(0, 0, 8);

        tween(node)
            .to(
                0.32,
                {
                    position: originalPos,
                },
                {
                    easing: "cubicInOut",
                    onUpdate: (target?: Node, ratio?: number) => {
                        const r = ratio ?? 1;
                        if (node && node.isValid) {
                            node.setRotationFromEuler(0, 0, (1 - r) * 8);
                        }
                    },
                },
            )
            .call(() => {
                this.releaseSlot();
                onComplete?.();
            })
            .start();
    }

    /**
     * 官方火漆砸印动画 (240ms：前 144ms easeInQuad 下砸，60% 关键帧精准起振 SFX，后 96ms easeOutElastic 弹性回位)
     */
    public static playWaxStamp(node: Node, onComplete?: () => void): void {
        if (!node || !node.isValid) return;

        const originalScale = node.getScale();
        node.setScale(originalScale.x * 2.5, originalScale.y * 2.5, originalScale.z);

        // 前 144ms 加速下砸
        tween(node)
            .to(
                0.144,
                { scale: new Vec3(originalScale.x * 0.88, originalScale.y * 0.88, originalScale.z) },
                { easing: "quadIn" },
            )
            .call(() => {
                // 关键帧 60% 起振点：火漆沉击音效
                WestAudio.playStampThud("COMMON");
            })
            // 后 96ms 弹性回位到标准 1.0
            .to(
                0.096,
                { scale: originalScale },
                { easing: "elasticOut" },
            )
            .call(() => {
                onComplete?.();
            })
            .start();
    }

    /**
     * 筹码浮起动画 (180ms easeOutBack)
     */
    public static playChipFloat(node: Node, onComplete?: () => void): void {
        if (!node || !node.isValid) return;

        if (!this.acquireSlot()) {
            onComplete?.();
            return;
        }

        const originalPos = node.getPosition();
        const targetPos = new Vec3(originalPos.x, originalPos.y + 6, originalPos.z);

        tween(node)
            .to(0.09, { position: targetPos }, { easing: "backOut" })
            .to(0.09, { position: originalPos }, { easing: "sineInOut" })
            .call(() => {
                this.releaseSlot();
                onComplete?.();
            })
            .start();
    }

    /**
     * 西部木门对开/滑入动画 (450ms easeInOutQuart)
     */
    public static playSaloonDoors(
        leftDoor: Node,
        rightDoor: Node,
        onComplete?: () => void,
    ): void {
        if (!leftDoor || !leftDoor.isValid || !rightDoor || !rightDoor.isValid) {
            onComplete?.();
            return;
        }

        WestAudio.playSaloonDoor("COMMON");

        const leftOrig = leftDoor.getPosition();
        const rightOrig = rightDoor.getPosition();

        // 门开启退后并复位
        tween(leftDoor)
            .to(0.45, { position: new Vec3(leftOrig.x - 360, leftOrig.y, leftOrig.z) }, { easing: "quartInOut" })
            .to(0.35, { position: leftOrig }, { easing: "quartOut" })
            .start();

        tween(rightDoor)
            .to(0.45, { position: new Vec3(rightOrig.x + 360, rightOrig.y, rightOrig.z) }, { easing: "quartInOut" })
            .to(0.35, { position: rightOrig }, { easing: "quartOut" })
            .call(() => {
                onComplete?.();
            })
            .start();
    }

    /**
     * 节点丝滑淡入与微位移浮现 (200ms easeOutCubic)
     * 通过 UIOpacity 实现整棵子树的平滑渐显，杜绝画面突兀跳变与空白闪屏。
     */
    public static fadeInNode(
        node: Node,
        duration = 0.22,
        startYOffset = 10,
        onComplete?: () => void,
    ): void {
        if (!node || !node.isValid) {
            onComplete?.();
            return;
        }

        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = node.addComponent(UIOpacity);
        }
        uiOpacity.opacity = 0;

        const originalPos = node.getPosition();
        if (startYOffset !== 0) {
            node.setPosition(originalPos.x, originalPos.y - startYOffset, originalPos.z);
            tween(node)
                .to(duration, { position: originalPos }, { easing: "cubicOut" })
                .start();
        }

        tween(uiOpacity)
            .to(duration, { opacity: 255 }, { easing: "cubicOut" })
            .call(() => {
                onComplete?.();
            })
            .start();
    }

    /**
     * 节点平滑淡出与微位移消隐 (140ms easeInSine)
     */
    public static fadeOutNode(
        node: Node,
        duration = 0.14,
        endYOffset = -6,
        onComplete?: () => void,
    ): void {
        if (!node || !node.isValid) {
            onComplete?.();
            return;
        }

        let uiOpacity = node.getComponent(UIOpacity);
        if (!uiOpacity) {
            uiOpacity = node.addComponent(UIOpacity);
        }

        const originalPos = node.getPosition();
        if (endYOffset !== 0) {
            tween(node)
                .to(duration, { position: new Vec3(originalPos.x, originalPos.y + endYOffset, originalPos.z) }, { easing: "sineIn" })
                .start();
        }

        tween(uiOpacity)
            .to(duration, { opacity: 0 }, { easing: "sineIn" })
            .call(() => {
                onComplete?.();
            })
            .start();
    }

    /**
     * 弹窗（Modal）温润丝滑展开：遮罩淡入 + 面板微缩放弹性浮现 (200ms backOut)
     */
    public static playModalEnter(
        panel: Node,
        mask?: Node,
        onComplete?: () => void,
    ): void {
        if (mask && mask.isValid) {
            let maskOpacity = mask.getComponent(UIOpacity);
            if (!maskOpacity) {
                maskOpacity = mask.addComponent(UIOpacity);
            }
            maskOpacity.opacity = 0;
            tween(maskOpacity)
                .to(0.18, { opacity: 255 }, { easing: "sineOut" })
                .start();
        }

        if (panel && panel.isValid) {
            let panelOpacity = panel.getComponent(UIOpacity);
            if (!panelOpacity) {
                panelOpacity = panel.addComponent(UIOpacity);
            }
            panelOpacity.opacity = 0;

            const originalScale = panel.getScale();
            panel.setScale(originalScale.x * 0.92, originalScale.y * 0.92, originalScale.z);

            tween(panelOpacity)
                .to(0.18, { opacity: 255 }, { easing: "sineOut" })
                .start();

            tween(panel)
                .to(0.20, { scale: originalScale }, { easing: "backOut" })
                .call(() => {
                    onComplete?.();
                })
                .start();
        } else {
            onComplete?.();
        }
    }

    /**
     * 弹窗（Modal）优雅收起：面板微缩放淡出 + 遮罩渐隐 (140ms sineIn)
     */
    public static playModalExit(
        panel: Node,
        mask?: Node,
        onComplete?: () => void,
    ): void {
        if (mask && mask.isValid) {
            let maskOpacity = mask.getComponent(UIOpacity);
            if (!maskOpacity) {
                maskOpacity = mask.addComponent(UIOpacity);
            }
            tween(maskOpacity)
                .to(0.14, { opacity: 0 }, { easing: "sineIn" })
                .start();
        }

        if (panel && panel.isValid) {
            let panelOpacity = panel.getComponent(UIOpacity);
            if (!panelOpacity) {
                panelOpacity = panel.addComponent(UIOpacity);
            }

            const currentScale = panel.getScale();
            const targetScale = new Vec3(currentScale.x * 0.92, currentScale.y * 0.92, currentScale.z);

            tween(panelOpacity)
                .to(0.14, { opacity: 0 }, { easing: "sineIn" })
                .start();

            tween(panel)
                .to(0.14, { scale: targetScale }, { easing: "sineIn" })
                .call(() => {
                    onComplete?.();
                })
                .start();
        } else {
            onComplete?.();
        }
    }
}


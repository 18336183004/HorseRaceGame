/**
 * 赛马 3D / 2D / 权威解剖三视图 / 典藏油画 豪华检赏展台弹窗 (HorseGalleryModal)
 *
 * 全面升级赛马多维视觉与文化检赏体系：
 * 1. 【🎲 3D立体展台】: 360° 自由拖拽触控、高精度三阶黄铜胡桃木金丝绒底座、双向主补聚光灯与浮游金尘；
 * 2. 【⚡ 2D奔腾动效】: 古典解剖骨骼动力学、四阶段成长期即时切换 (幼驹/青年/成年/职业赛马)；
 * 3. 【📐 权威解剖三视图】: 1536x960 统一工程制图规范，支持三视总览、侧立面、正迎面、背立面毫米级基线对齐切换与骨骼体尺档案；
 * 4. 【🖼️ 典藏油画立绘】: 18~19 世纪欧陆大师纯血名驹传世油画立绘与血统铭牌；
 * 5. 即时动力学姿态演练与触控抚摸心形交互。
 */

import {
    _decorator,
    Component,
    Node,
    Graphics,
    Color,
    Vec3,
    UITransform,
    Label,
    Button,
    HorizontalTextAlignment,
    Layers,
    EventTouch,
    director,
    Sprite,
} from "cc";
import { HorseAssetRegistry, FoalGrowthStage, HorseInfo } from "./HorseAssetRegistry";
import { HorseVisual2D } from "./HorseVisual2D";
import { HorseVisual3D } from "./HorseVisual3D";
import { HorseSprites } from "./HorseSprites";
import { WestColors } from "./WestTheme";
import { WestAudio } from "./WestAudio";

const { ccclass } = _decorator;

export type GalleryMainMode = "3D" | "2D" | "ORTHO" | "SHOWCASE";
export type OrthoSubView = "ALL" | "SIDE" | "FRONT" | "BACK";

interface HeartParticle {
    x: number;
    y: number;
    vy: number;
    scale: number;
    alpha: number;
    life: number;
    maxLife: number;
}

@ccclass("HorseGalleryModal")
export class HorseGalleryModal extends Component {
    private static instance: HorseGalleryModal | null = null;

    private currentHorseNo: number = 1;
    private currentStage: FoalGrowthStage = FoalGrowthStage.Adult;
    private currentMainMode: GalleryMainMode = "3D";
    private currentOrthoSubView: OrthoSubView = "ALL";
    private currentAction: string = "Gallop";

    // UI 组件节点引用
    private modalPanel: Node | null = null;
    private titleLabel: Label | null = null;
    private descLabel: Label | null = null;
    private styleBadgeLabel: Label | null = null;

    // 模式切换主 Tab 栏
    private mainModeButtons: Array<{ mode: GalleryMainMode; btnNode: Node; bg: Graphics; label: Label }> = [];

    // 动态舞台与表现组件
    private stageBox: Node | null = null;
    private stageBackG: Graphics | null = null;
    private stageFxG: Graphics | null = null;

    // 表现层挂载点
    private liveHorseNode2D: Node | null = null;
    private liveVisual2D: HorseVisual2D | null = null;
    private liveHorseNode3D: Node | null = null;
    private liveVisual3D: HorseVisual3D | null = null;
    private imageDisplayNode: Node | null = null;

    // 二级控制条挂载容器 (动作按钮 / 成长阶段 / 三视图分立面)
    private subControlRow: Node | null = null;
    private stageButtons: Array<{ stage: FoalGrowthStage; btnNode: Node; bg: Graphics; label: Label }> = [];
    private actionButtons: Array<{ id: string; btnNode: Node; bg: Graphics; label: Label }> = [];
    private orthoSubButtons: Array<{ view: OrthoSubView; btnNode: Node; bg: Graphics; label: Label }> = [];

    // 舞台动态光效与环境微粒 (Spotlight & Ambient Golden Motes)
    private animTime: number = 0;
    private readonly motes: Array<{ x: number; y: number; vx: number; vy: number; r: number; alpha: number }> = [];

    // 轻触抚摸心形交互粒子 (Love Hearts on Touch)
    private heartsG: Graphics | null = null;
    private readonly hearts: HeartParticle[] = [];

    /** 全局调起弹窗入口 */
    public static show(horseNo: number = 1, parentNode?: Node, defaultStage?: FoalGrowthStage): HorseGalleryModal {
        const scene = director.getScene();
        const canvas = scene?.getChildByName("Canvas");
        const targetParent = canvas || parentNode || scene;

        if (!this.instance || !this.instance.isValid) {
            const root = new Node("HorseGalleryModalRoot");
            root.layer = Layers.Enum.UI_2D;
            if (targetParent) {
                targetParent.addChild(root);
            }
            this.instance = root.addComponent(HorseGalleryModal);
        }

        if (this.instance.node.parent) {
            this.instance.node.setSiblingIndex(this.instance.node.parent.children.length - 1);
        }

        this.instance.currentHorseNo = Math.max(1, Math.min(20, horseNo));
        if (defaultStage !== undefined) {
            this.instance.currentStage = defaultStage;
            this.instance.currentMainMode = "2D";
        }

        this.instance.node.active = true;
        this.instance.refreshDisplay();
        return this.instance;
    }

    protected onLoad(): void {
        HorseGalleryModal.instance = this;
        this.initAmbientMotes();
        this.buildUI();
    }

    /** 初始化环境漂浮微金微粒 */
    private initAmbientMotes(): void {
        this.motes.length = 0;
        for (let i = 0; i < 18; i++) {
            this.motes.push({
                x: -280 + Math.random() * 560,
                y: -100 + Math.random() * 220,
                vx: -6 + Math.random() * 12,
                vy: 8 + Math.random() * 16,
                r: 1.0 + Math.random() * 1.8,
                alpha: 80 + Math.random() * 120,
            });
        }
    }

    /** 构建纯动态检赏弹窗界面 */
    private buildUI(): void {
        const root = this.node;
        root.layer = Layers.Enum.UI_2D;
        const rootUt = root.addComponent(UITransform);
        rootUt.setContentSize(720, 1280);

        // 1. 半透明暗色遮罩
        const mask = new Node("ModalMask");
        mask.layer = Layers.Enum.UI_2D;
        root.addChild(mask);
        mask.setPosition(0, 0, 0);
        mask.addComponent(UITransform).setContentSize(720, 1280);
        const mg = mask.addComponent(Graphics);
        mg.fillColor = new Color(0, 0, 0, 215);
        mg.rect(-360, -640, 720, 1280);
        mg.fill();

        mask.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            e.propagationStopped = true;
            this.close();
        }, this);

        // 2. 居中实木羊皮纸大弹窗面板 (宽 684 x 高 640)
        const panel = new Node("GalleryPanel");
        panel.layer = Layers.Enum.UI_2D;
        root.addChild(panel);
        panel.setPosition(0, 0, 0);
        panel.addComponent(UITransform).setContentSize(684, 640);
        this.modalPanel = panel;

        // 面板木框底图
        const pg = panel.addComponent(Graphics);
        pg.fillColor = new Color(246, 240, 226, 255);
        pg.roundRect(-342, -320, 684, 640, 14);
        pg.fill();
        pg.strokeColor = WestColors.WOOD_DARK;
        pg.lineWidth = 3.6;
        pg.roundRect(-342, -320, 684, 640, 14);
        pg.stroke();

        // 烫金内边框
        pg.strokeColor = WestColors.GOLD_METALLIC;
        pg.lineWidth = 1.4;
        pg.roundRect(-336, -314, 672, 628, 10);
        pg.stroke();

        // 3. 顶部标题栏 (Y = 282)
        const titleNode = new Node("TitleNode");
        titleNode.layer = Layers.Enum.UI_2D;
        panel.addChild(titleNode);
        titleNode.setPosition(0, 282, 0);
        this.titleLabel = titleNode.addComponent(Label);
        this.titleLabel.fontSize = 16;
        this.titleLabel.lineHeight = 24;
        this.titleLabel.color = WestColors.INK_DARK;
        this.titleLabel.isBold = true;
        titleNode.addComponent(UITransform).setContentSize(380, 28);

        // 切换上一匹 (◀)
        this.createNavButton(panel, "◀ 上一匹", -270, 282, 72, 28, () => {
            WestAudio.playChipClink();
            this.currentHorseNo = this.currentHorseNo > 1 ? this.currentHorseNo - 1 : 20;
            this.refreshDisplay();
        });

        // 切换下一匹 (▶)
        this.createNavButton(panel, "下一匹 ▶", 220, 282, 72, 28, () => {
            WestAudio.playChipClink();
            this.currentHorseNo = this.currentHorseNo < 20 ? this.currentHorseNo + 1 : 1;
            this.refreshDisplay();
        });

        // 关闭按钮 (✕)
        const closeBtn = new Node("CloseBtn");
        closeBtn.layer = Layers.Enum.UI_2D;
        panel.addChild(closeBtn);
        closeBtn.setPosition(308, 282, 0);
        closeBtn.addComponent(UITransform).setContentSize(34, 34);
        const cg = closeBtn.addComponent(Graphics);
        cg.fillColor = WestColors.BANDANA_RED;
        cg.circle(0, 0, 14);
        cg.fill();
        const closeTxt = new Node("CloseTxt");
        closeTxt.layer = Layers.Enum.UI_2D;
        closeBtn.addChild(closeTxt);
        const cl = closeTxt.addComponent(Label);
        cl.fontSize = 18;
        cl.lineHeight = 22;
        cl.color = Color.WHITE;
        cl.string = "✕";
        const cBtnComp = closeBtn.addComponent(Button);
        cBtnComp.node.on(Button.EventType.CLICK, () => this.close(), this);

        // =====================================================================
        // 3B. 【四大核心展示形态主 Tab 栏】(Y = 244, 宽 650 x 高 28)
        // =====================================================================
        const mainModesNode = new Node("MainModesNode");
        mainModesNode.layer = Layers.Enum.UI_2D;
        panel.addChild(mainModesNode);
        mainModesNode.setPosition(0, 244, 0);

        const modeConfigs: Array<{ mode: GalleryMainMode; name: string }> = [
            { mode: "3D", name: "🎲 3D立体展台" },
            { mode: "2D", name: "⚡ 2D奔腾动效" },
            { mode: "ORTHO", name: "📐 权威解剖三视图" },
            { mode: "SHOWCASE", name: "🖼️ 典藏油画立绘" },
        ];

        modeConfigs.forEach((mc, idx) => {
            const btn = new Node(`MainMode_${mc.mode}`);
            btn.layer = Layers.Enum.UI_2D;
            mainModesNode.addChild(btn);
            btn.setPosition(-240 + idx * 160, 0, 0);
            btn.addComponent(UITransform).setContentSize(152, 28);

            const bg = btn.addComponent(Graphics);
            const isSel = mc.mode === this.currentMainMode;
            this.drawModeButtonBackground(bg, isSel);

            const txtNode = new Node("Txt");
            txtNode.layer = Layers.Enum.UI_2D;
            btn.addChild(txtNode);
            const tl = txtNode.addComponent(Label);
            tl.fontSize = 13.5;
            tl.lineHeight = 18;
            tl.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.CREAM;
            tl.isBold = isSel;
            tl.string = mc.name;

            this.mainModeButtons.push({ mode: mc.mode, btnNode: btn, bg, label: tl });

            const bComp = btn.addComponent(Button);
            bComp.node.on(Button.EventType.CLICK, () => {
                WestAudio.playChipClink();
                this.currentMainMode = mc.mode;
                this.refreshDisplay();
            }, this);
        });

        // =====================================================================
        // 4. 【中央全景主视口舞台】(宽 648 x 高 250, Y = 84)
        // =====================================================================
        this.stageBox = new Node("StageBox");
        this.stageBox.layer = Layers.Enum.UI_2D;
        panel.addChild(this.stageBox);
        this.stageBox.setPosition(0, 84, 0);
        this.stageBox.addComponent(UITransform).setContentSize(648, 250);

        this.stageBackG = this.stageBox.addComponent(Graphics);

        // 4C. 动态聚光灯与环境光斑特效层
        const fxNode = new Node("StageFxNode");
        fxNode.layer = Layers.Enum.UI_2D;
        this.stageBox.addChild(fxNode);
        this.stageFxG = fxNode.addComponent(Graphics);

        // 4D. 2D 骨骼动力学马匹节点
        this.liveHorseNode2D = new Node("LiveHorseNode2D");
        this.liveHorseNode2D.layer = Layers.Enum.UI_2D;
        this.stageBox.addChild(this.liveHorseNode2D);
        this.liveHorseNode2D.setPosition(0, -64, 0);
        this.liveVisual2D = this.liveHorseNode2D.addComponent(HorseVisual2D);
        this.liveVisual2D.isPaddockMode = true;
        this.liveVisual2D.setDisplayScale(2.4);

        // 4E. 3D 立体模型展台节点 (通过 RenderTexture 768x512 高清映射于 2D 舞台)
        this.liveHorseNode3D = new Node("LiveHorseNode3D");
        this.liveHorseNode3D.layer = Layers.Enum.UI_2D;
        this.stageBox.addChild(this.liveHorseNode3D);
        this.liveHorseNode3D.setPosition(0, 0, 0);
        const trans3D = this.liveHorseNode3D.addComponent(UITransform);
        trans3D.setContentSize(600, 240);
        this.liveVisual3D = this.liveHorseNode3D.addComponent(HorseVisual3D);
        this.liveVisual3D.setAutoRotate(true);

        // 4F. 静态大图展示节点 (展示统一解剖三视图与典藏油画立绘)
        this.imageDisplayNode = new Node("ImageDisplayNode");
        this.imageDisplayNode.layer = Layers.Enum.UI_2D;
        this.stageBox.addChild(this.imageDisplayNode);
        this.imageDisplayNode.setPosition(0, 0, 0);
        this.imageDisplayNode.addComponent(UITransform).setContentSize(600, 240);
        const sp = this.imageDisplayNode.addComponent(Sprite);
        sp.sizeMode = Sprite.SizeMode.CUSTOM;

        // 4G. 轻触抚摸爱心粒子特效层
        const heartsNode = new Node("HeartsNode");
        heartsNode.layer = Layers.Enum.UI_2D;
        this.stageBox.addChild(heartsNode);
        this.heartsG = heartsNode.addComponent(Graphics);

        // 监听触碰马匹舞台，触发互动抚摸爱心
        this.stageBox.on(Node.EventType.TOUCH_END, (e: EventTouch) => {
            if (this.currentMainMode === "3D" || this.currentMainMode === "2D") {
                const uiPos = e.getUILocation();
                const trans = this.stageBox?.getComponent(UITransform);
                if (trans) {
                    const localPos = trans.convertToNodeSpaceAR(new Vec3(uiPos.x, uiPos.y, 0));
                    this.triggerTouchHeart(localPos.x, localPos.y);
                }
            }
        }, this);

        // 舞台左上角：跑法与风格勋章
        const badgeNode = new Node("StyleBadgeNode");
        badgeNode.layer = Layers.Enum.UI_2D;
        this.stageBox.addChild(badgeNode);
        badgeNode.setPosition(-150, 102, 0);
        badgeNode.addComponent(UITransform).setContentSize(320, 24);
        this.styleBadgeLabel = badgeNode.addComponent(Label);
        this.styleBadgeLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
        this.styleBadgeLabel.fontSize = 13;
        this.styleBadgeLabel.lineHeight = 17;
        this.styleBadgeLabel.color = WestColors.INK_DARK;
        this.styleBadgeLabel.isBold = true;

        // =====================================================================
        // 5. 【二级交互与分立面控制栏】(Y = -66, 宽 648 x 高 34)
        // =====================================================================
        this.subControlRow = new Node("SubControlRow");
        this.subControlRow.layer = Layers.Enum.UI_2D;
        panel.addChild(this.subControlRow);
        this.subControlRow.setPosition(0, -66, 0);
        this.subControlRow.addComponent(UITransform).setContentSize(648, 34);

        // =====================================================================
        // 6. 【血统档案与解剖体尺属性卡】(Y = -186, 宽 648 x 高 140)
        // =====================================================================
        const infoCard = new Node("InfoCard");
        infoCard.layer = Layers.Enum.UI_2D;
        panel.addChild(infoCard);
        infoCard.setPosition(0, -186, 0);
        infoCard.addComponent(UITransform).setContentSize(648, 140);

        const ig = infoCard.addComponent(Graphics);
        ig.fillColor = new Color(238, 230, 212, 255);
        ig.roundRect(-324, -70, 648, 140, 8);
        ig.fill();
        ig.strokeColor = WestColors.BRASS_FRAME;
        ig.lineWidth = 1.4;
        ig.roundRect(-324, -70, 648, 140, 8);
        ig.stroke();

        const descNode = new Node("DescTextNode");
        descNode.layer = Layers.Enum.UI_2D;
        infoCard.addChild(descNode);
        descNode.setPosition(0, 0, 0);
        this.descLabel = descNode.addComponent(Label);
        this.descLabel.fontSize = 13.5;
        this.descLabel.lineHeight = 22;
        this.descLabel.color = WestColors.INK_DARK;
        this.descLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
        descNode.addComponent(UITransform).setContentSize(618, 122);
    }

    /** 绘制舞台背景风格（随主模式智能切换） */
    private renderStageBackground(): void {
        if (!this.stageBackG) return;
        const sg = this.stageBackG;
        sg.clear();

        if (this.currentMainMode === "3D") {
            // 3D 展台背景：古典美术馆米色暖墙 + 原木饰线 + 尊贵展厅环境
            sg.fillColor = new Color(236, 228, 214, 255);
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.fill();
            sg.strokeColor = WestColors.BRASS_FRAME;
            sg.lineWidth = 2.0;
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.stroke();

            // 实木复古护墙板立缝
            sg.strokeColor = new Color(218, 206, 188, 160);
            sg.lineWidth = 1.0;
            for (let x = -300; x <= 300; x += 40) {
                sg.moveTo(x, -48);
                sg.lineTo(x, 125);
            }
            sg.stroke();

            // 展厅温润深木色抛光地坪
            sg.fillColor = new Color(68, 45, 30, 255);
            sg.rect(-322, -123, 644, 75);
            sg.fill();
            sg.strokeColor = WestColors.GOLD_METALLIC;
            sg.lineWidth = 1.6;
            sg.moveTo(-322, -48);
            sg.lineTo(322, -48);
            sg.stroke();

            // 聚光灯微弱暖金光斑
            sg.fillColor = new Color(255, 230, 160, 25);
            sg.ellipse(0, -68, 210, 42);
            sg.fill();

        } else if (this.currentMainMode === "2D") {
            // 2D 动效背景：自然广阔牧场草甸与暖阳远山
            sg.fillColor = new Color(225, 235, 245, 255);
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.fill();

            // 绿茵跑道
            sg.fillColor = new Color(112, 162, 68, 255);
            sg.rect(-322, -123, 644, 110);
            sg.fill();
            sg.strokeColor = new Color(145, 100, 50, 255);
            sg.lineWidth = 2.0;
            sg.moveTo(-322, -13);
            sg.lineTo(322, -13);
            sg.stroke();

            // 框线
            sg.strokeColor = WestColors.BRASS_FRAME;
            sg.lineWidth = 2.0;
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.stroke();

        } else if (this.currentMainMode === "ORTHO") {
            // 权威三视图：工程测绘深色羊皮纸蓝图网格 (Architectural Blueprint Style)
            sg.fillColor = new Color(24, 30, 42, 255);
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.fill();
            sg.strokeColor = new Color(70, 110, 160, 255);
            sg.lineWidth = 2.0;
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.stroke();

            // 测绘网格细线 (Grid Lines)
            sg.strokeColor = new Color(45, 62, 88, 120);
            sg.lineWidth = 0.8;
            for (let x = -310; x <= 310; x += 30) {
                sg.moveTo(x, -120);
                sg.lineTo(x, 120);
            }
            for (let y = -110; y <= 110; y += 30) {
                sg.moveTo(-315, y);
                sg.lineTo(315, y);
            }
            sg.stroke();

            // 基准线 (Datum Lines): 地平线与髻甲线高亮标尺
            sg.strokeColor = new Color(220, 75, 75, 180);
            sg.lineWidth = 1.2;
            sg.moveTo(-315, -78);
            sg.lineTo(315, -78);
            sg.stroke();

            sg.strokeColor = new Color(75, 180, 240, 180);
            sg.moveTo(-315, 42);
            sg.lineTo(315, 42);
            sg.stroke();

        } else if (this.currentMainMode === "SHOWCASE") {
            // 典藏油画立绘：古典美术馆奢华深胡桃木与烫金画框内衬
            sg.fillColor = new Color(38, 28, 22, 255);
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.fill();
            sg.strokeColor = WestColors.GOLD_BRIGHT;
            sg.lineWidth = 2.4;
            sg.roundRect(-324, -125, 648, 250, 8);
            sg.stroke();

            // 内部金色古典雕花圈线
            sg.strokeColor = new Color(205, 165, 85, 160);
            sg.lineWidth = 1.0;
            sg.roundRect(-318, -119, 636, 238, 5);
            sg.stroke();
        }
    }

    /** 刷新展示数据与模型表现 */
    private refreshDisplay(): void {
        const horse = HorseAssetRegistry.getHorseByNo(this.currentHorseNo);

        if (this.titleLabel) {
            this.titleLabel.string = `No.${horse.horseNo} 【${horse.nameZh}】 ${horse.nameEn}`;
        }

        if (this.styleBadgeLabel) {
            this.styleBadgeLabel.string = `🏇 战术原型: 【${horse.runningStyle}】 | 标称肩高: ${horse.heightHh || "16.2 hh"}`;
        }

        this.renderStageBackground();
        this.updateMainModeButtons();
        this.refreshVisualContent();
        this.buildSubControlRow();
        this.updateDescriptionText();
    }

    /** 依据当前主模式切换舞台表现物 */
    private refreshVisualContent(): void {
        const mode = this.currentMainMode;
        if (this.liveHorseNode3D) {
            this.liveHorseNode3D.active = mode === "3D";
            if (mode === "3D" && this.liveVisual3D) {
                this.liveVisual3D.setHorseNo(this.currentHorseNo);
                this.liveVisual3D.setAction(this.currentAction, 1.2);
            }
        }

        if (this.liveHorseNode2D) {
            this.liveHorseNode2D.active = mode === "2D";
            if (mode === "2D" && this.liveVisual2D) {
                this.liveVisual2D.setHorseNo(this.currentHorseNo);
                this.liveVisual2D.setFoalStage(this.currentHorseNo, this.currentStage);
                this.liveVisual2D.setAction(this.currentAction, 1.2);
            }
        }

        if (this.imageDisplayNode) {
            this.imageDisplayNode.active = mode === "ORTHO" || mode === "SHOWCASE";
            if (mode === "ORTHO") {
                const ut = this.imageDisplayNode.getComponent(UITransform);
                if (ut) ut.setContentSize(580, 230);
                if (this.currentOrthoSubView === "ALL") {
                    HorseSprites.applyHorseOrtho(this.imageDisplayNode, this.currentHorseNo);
                } else if (this.currentOrthoSubView === "SIDE") {
                    HorseSprites.applyHorseOrthoSide(this.imageDisplayNode, this.currentHorseNo);
                } else if (this.currentOrthoSubView === "FRONT") {
                    HorseSprites.applyHorseOrthoFront(this.imageDisplayNode, this.currentHorseNo);
                } else {
                    HorseSprites.applyHorseOrthoBack(this.imageDisplayNode, this.currentHorseNo);
                }
            } else if (mode === "SHOWCASE") {
                const ut = this.imageDisplayNode.getComponent(UITransform);
                if (ut) ut.setContentSize(420, 230);
                HorseSprites.applyHorseShowcase(this.imageDisplayNode, this.currentHorseNo);
            }
        }
    }

    /** 动态重构二级交互控制栏 (随模式呈现动作指令 / 成长期切换 / 三视分立面) */
    private buildSubControlRow(): void {
        if (!this.subControlRow) return;
        this.subControlRow.removeAllChildren();
        this.stageButtons.length = 0;
        this.actionButtons.length = 0;
        this.orthoSubButtons.length = 0;

        const parent = this.subControlRow;

        if (this.currentMainMode === "3D" || this.currentMainMode === "2D") {
            // 动作演练指令按钮组 (6 大真实步态)
            const actions = [
                { id: "Gallop", name: "⚡ 极速狂奔", speed: 1.4 },
                { id: "Stand", name: "🐴 沉稳待机", speed: 1.0 },
                { id: "Graze", name: "🌾 低头吃草", speed: 1.0 },
                { id: "Rear", name: "⚡ 昂首起扬", speed: 1.2 },
                { id: "Walk", name: "🚶 优雅慢步", speed: 1.0 },
                { id: "Sliding_Stop", name: "🛑 深蹲急停", speed: 1.2 },
            ];

            actions.forEach((act, idx) => {
                const btn = new Node(`ActBtn_${act.id}`);
                btn.layer = Layers.Enum.UI_2D;
                parent.addChild(btn);
                btn.setPosition(-255 + idx * 102, 0, 0);
                btn.addComponent(UITransform).setContentSize(96, 30);

                const bg = btn.addComponent(Graphics);
                const isSel = act.id === this.currentAction;
                this.drawActionButtonBackground(bg, isSel);

                const txtNode = new Node("Txt");
                txtNode.layer = Layers.Enum.UI_2D;
                btn.addChild(txtNode);
                const tl = txtNode.addComponent(Label);
                tl.fontSize = 13.5;
                tl.lineHeight = 18;
                tl.color = isSel ? WestColors.GOLD_BRIGHT : Color.WHITE;
                tl.string = act.name;

                this.actionButtons.push({ id: act.id, btnNode: btn, bg, label: tl });

                const bComp = btn.addComponent(Button);
                bComp.node.on(Button.EventType.CLICK, () => {
                    WestAudio.playChipClink();
                    this.currentAction = act.id;
                    this.applyAction(act.id, act.speed);
                    this.updateActionButtonStyles();
                }, this);
            });

        } else if (this.currentMainMode === "ORTHO") {
            // 权威解剖三视图分立面切换
            const views: Array<{ view: OrthoSubView; name: string }> = [
                { view: "ALL", name: "📐 三视总览 (1536x960 建筑级)" },
                { view: "SIDE", name: "🐎 侧立面 (Side 1024x1024)" },
                { view: "FRONT", name: "🎯 正迎面 (Front 1024x1024)" },
                { view: "BACK", name: "🛡️ 背立面 (Back 1024x1024)" },
            ];

            views.forEach((v, idx) => {
                const btn = new Node(`OrthoSub_${v.view}`);
                btn.layer = Layers.Enum.UI_2D;
                parent.addChild(btn);
                btn.setPosition(-236 + idx * 158, 0, 0);
                btn.addComponent(UITransform).setContentSize(150, 30);

                const bg = btn.addComponent(Graphics);
                const isSel = v.view === this.currentOrthoSubView;
                this.drawModeButtonBackground(bg, isSel);

                const txtNode = new Node("Txt");
                txtNode.layer = Layers.Enum.UI_2D;
                btn.addChild(txtNode);
                const tl = txtNode.addComponent(Label);
                tl.fontSize = 13;
                tl.lineHeight = 17;
                tl.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.CREAM;
                tl.string = v.name;

                this.orthoSubButtons.push({ view: v.view, btnNode: btn, bg, label: tl });

                const bComp = btn.addComponent(Button);
                bComp.node.on(Button.EventType.CLICK, () => {
                    WestAudio.playChipClink();
                    this.currentOrthoSubView = v.view;
                    this.refreshVisualContent();
                    this.updateOrthoSubButtonStyles();
                    this.updateDescriptionText();
                }, this);
            });

        } else if (this.currentMainMode === "SHOWCASE") {
            // 典藏油画立绘提示与鉴赏提示条
            const hintBox = new Node("ShowcaseHintBox");
            hintBox.layer = Layers.Enum.UI_2D;
            parent.addChild(hintBox);
            hintBox.setPosition(0, 0, 0);
            hintBox.addComponent(UITransform).setContentSize(620, 30);

            const hg = hintBox.addComponent(Graphics);
            hg.fillColor = WestColors.WOOD_DARK;
            hg.roundRect(-310, -15, 620, 30, 5);
            hg.fill();
            hg.strokeColor = WestColors.GOLD_METALLIC;
            hg.lineWidth = 1.0;
            hg.roundRect(-310, -15, 620, 30, 5);
            hg.stroke();

            const txtNode = new Node("Txt");
            txtNode.layer = Layers.Enum.UI_2D;
            hintBox.addChild(txtNode);
            const tl = txtNode.addComponent(Label);
            tl.fontSize = 13;
            tl.lineHeight = 17;
            tl.color = WestColors.GOLD_BRIGHT;
            tl.string = "🎨 欧陆马术古典油画珍藏级立绘 · 精确展现纯血种马骨相与赛场冠军气韵";
        }
    }

    /** 更新血统档案卡片说明文本 */
    private updateDescriptionText(): void {
        if (!this.descLabel) return;
        const horse: HorseInfo = HorseAssetRegistry.getHorseByNo(this.currentHorseNo);

        if (this.currentMainMode === "3D") {
            this.descLabel.string =
                `【3D立体展台】: 运行纯血纯种 3D 解剖几何动力实体 (深胸骨架、铰接飞节、伏鞍骑师与扬尘粒子)\n` +
                `【血统品系】: ${horse.coatColor} | ${horse.breed} | 战术原型: ${horse.runningStyle}\n` +
                `【体能雷达】: 冲刺爆发力 ★★★★★ | 耐力持久度 ★★★★☆ | 拼斗斗志 ★★★★★\n` +
                `【展台交互】: 水平拖拽可 360° 旋转检赏，轻触马身可触发亲昵抚摸互动，下方可切换步态演练。`;
        } else if (this.currentMainMode === "2D") {
            this.descLabel.string =
                `【2D奔腾动效】: 运行 2D 古典解剖骨骼动力学引擎，支持四节骨骼自然伸展与肌肉伸缩\n` +
                `【成长阶段】: 巅峰黄金期 (骨骼发育完全，肌肉群处于竞技极值，四蹄角质坚韧)\n` +
                `【血统品系】: ${horse.coatColor} | ${horse.breed} | 经典战法: ${horse.runningStyle}\n` +
                `【动作指令】: 轻触下方指令栏即时驱动狂奔、起扬、急停与吃草，领略奔腾动感。`;
        } else if (this.currentMainMode === "ORTHO") {
            const subViewName = this.currentOrthoSubView === "ALL" ? "三视总览" :
                (this.currentOrthoSubView === "SIDE" ? "侧立面" :
                    (this.currentOrthoSubView === "FRONT" ? "正迎面" : "背立面"));
            this.descLabel.string =
                `【权威解剖三视图】: 当前分立面: 【${subViewName}】 | 1536x960 统一工程制图规范，基准毫米级对齐\n` +
                `【解剖体尺】: 标称肩高: ${horse.heightHh || "16.2 hh"} | 竞技标准体重: ${horse.weightKg ? horse.weightKg + " kg" : "485 kg"} | 骨量管围: 20.8 cm\n` +
                `【骨骼特征】: 45° 倾斜肩胛骨便于前肢大幅前伸，深胸深腹肺活量极大，强韧短背利于后驱力量传导\n` +
                `【基线标定】: 地平线 (Ground Datum Y=810) 与髻甲线 (Withers Datum Y=265) 保持严谨绝对水平一致。`;
        } else {
            this.descLabel.string =
                `【典藏油画立绘】: 18~19 世纪欧陆马术大师经典油画立绘，再现纯血种马的矫健身形与古典美学\n` +
                `【品系档案】: ${horse.nameZh} (${horse.nameEn}) | 纯血赛马 (Thoroughbred) | 经典被毛: ${horse.coatColor}\n` +
                `【竞技历史】: 拥有优越的冠军血统基因，在各大一级大赛中展现出非凡的速度与持久竞逐斗志\n` +
                `【艺术鉴赏】: 细腻笔触展现丝绒般被毛光泽与深邃目光，极具名驹传世收藏价值。`;
        }
    }

    /** 绘制 Tab 按钮背景 */
    private drawModeButtonBackground(g: Graphics, isSelected: boolean): void {
        g.clear();
        g.fillColor = isSelected ? new Color(175, 115, 45, 255) : WestColors.WOOD_DARK;
        g.roundRect(-75, -14, 150, 28, 5);
        g.fill();
        g.strokeColor = isSelected ? WestColors.GOLD_BRIGHT : WestColors.GOLD_METALLIC;
        g.lineWidth = isSelected ? 2.0 : 1.0;
        g.roundRect(-75, -14, 150, 28, 5);
        g.stroke();
    }

    /** 绘制动作指令按钮背景 */
    private drawActionButtonBackground(g: Graphics, isSelected: boolean): void {
        g.clear();
        g.fillColor = isSelected ? new Color(175, 115, 45, 255) : WestColors.WOOD_MEDIUM;
        g.roundRect(-48, -15, 96, 30, 5);
        g.fill();
        g.strokeColor = isSelected ? WestColors.GOLD_BRIGHT : WestColors.GOLD_METALLIC;
        g.lineWidth = isSelected ? 2.0 : 1.0;
        g.roundRect(-48, -15, 96, 30, 5);
        g.stroke();
    }

    /** 辅助：创建带黄铜木质效果的导航按钮 */
    private createNavButton(parent: Node, text: string, x: number, y: number, w: number, h: number, onClick: () => void): Node {
        const btn = new Node("NavBtn");
        btn.layer = Layers.Enum.UI_2D;
        parent.addChild(btn);
        btn.setPosition(x, y, 0);
        btn.addComponent(UITransform).setContentSize(w, h);

        const bg = btn.addComponent(Graphics);
        bg.fillColor = WestColors.WOOD_MEDIUM;
        bg.roundRect(-w / 2, -h / 2, w, h, 5);
        bg.fill();
        bg.strokeColor = WestColors.GOLD_METALLIC;
        bg.lineWidth = 1.2;
        bg.roundRect(-w / 2, -h / 2, w, h, 5);
        bg.stroke();

        const txt = new Node("Txt");
        txt.layer = Layers.Enum.UI_2D;
        btn.addChild(txt);
        const l = txt.addComponent(Label);
        l.fontSize = 13;
        l.lineHeight = 17;
        l.color = Color.WHITE;
        l.string = text;

        const bComp = btn.addComponent(Button);
        bComp.node.on(Button.EventType.CLICK, onClick, this);
        return btn;
    }

    /** 触碰展台马匹触发爱心粒子与欢愉反应 */
    private triggerTouchHeart(x: number, y: number): void {
        WestAudio.playChipClink();
        for (let i = 0; i < 4; i++) {
            this.hearts.push({
                x: x + (Math.random() - 0.5) * 24,
                y: y + (Math.random() - 0.5) * 16,
                vy: 55 + Math.random() * 45,
                scale: 0.8 + Math.random() * 0.6,
                alpha: 255,
                life: 0,
                maxLife: 0.7 + Math.random() * 0.4,
            });
        }
        if (this.currentAction === "Stand" || this.currentAction === "Graze") {
            this.applyAction("Rear", 1.2);
            this.scheduleOnce(() => {
                this.applyAction(this.currentAction, 1.0);
            }, 1.6);
        }
    }

    /** 每帧更新聚光灯微呼吸、浮游金尘与抚摸爱心 */
    protected update(dt: number): void {
        this.animTime += dt;

        // 1. 绘制顶部聚光灯光锥与环境金尘 (在 3D 展台或油画模式下展现顶级光影氛围)
        if (this.stageFxG && (this.currentMainMode === "3D" || this.currentMainMode === "SHOWCASE")) {
            this.stageFxG.clear();

            const breath = Math.sin(this.animTime * 1.8) * 0.05 + 0.95;
            const spotAlpha = Math.floor(45 * breath);

            // 顶部聚光灯光源至展台的暖金锥形漫射光束
            this.stageFxG.fillColor = new Color(255, 235, 180, spotAlpha);
            this.stageFxG.moveTo(-20, 125);
            this.stageFxG.lineTo(20, 125);
            this.stageFxG.lineTo(145, -76);
            this.stageFxG.lineTo(-145, -76);
            this.stageFxG.close();
            this.stageFxG.fill();

            // 展台上方柔光高亮椭圆光斑
            this.stageFxG.fillColor = new Color(255, 245, 205, Math.floor(55 * breath));
            this.stageFxG.ellipse(0, -76, 130, 18);
            this.stageFxG.fill();

            // 浮游金尘微粒流动
            for (const mote of this.motes) {
                mote.x += mote.vx * dt;
                mote.y += mote.vy * dt;
                if (mote.y > 120) {
                    mote.y = -95;
                    mote.x = -260 + Math.random() * 520;
                }
                const mAlpha = Math.floor(mote.alpha * (Math.sin(this.animTime * 3.0 + mote.x) * 0.3 + 0.7));
                this.stageFxG.fillColor = new Color(255, 225, 140, Math.max(0, mAlpha));
                this.stageFxG.circle(mote.x, mote.y, mote.r);
                this.stageFxG.fill();
            }
        } else if (this.stageFxG) {
            this.stageFxG.clear();
        }

        // 2. 绘制抚摸爱心粒子
        if (this.heartsG) {
            this.heartsG.clear();
            for (let i = this.hearts.length - 1; i >= 0; i--) {
                const hp = this.hearts[i];
                hp.life += dt;
                if (hp.life >= hp.maxLife) {
                    this.hearts.splice(i, 1);
                    continue;
                }
                hp.y += hp.vy * dt;
                hp.x += Math.sin(hp.life * 6.0) * 12 * dt;
                const progress = hp.life / hp.maxLife;
                const a = Math.floor(255 * (1 - progress));
                const s = hp.scale * (1.0 + progress * 0.4);

                this.heartsG.fillColor = new Color(245, 85, 115, a);
                const hx = hp.x;
                const hy = hp.y;
                const hr = 5.0 * s;
                this.heartsG.circle(hx - hr * 0.5, hy, hr * 0.6);
                this.heartsG.circle(hx + hr * 0.5, hy, hr * 0.6);
                this.heartsG.moveTo(hx - hr, hy - hr * 0.1);
                this.heartsG.lineTo(hx + hr, hy - hr * 0.1);
                this.heartsG.lineTo(hx, hy - hr * 1.3);
                this.heartsG.close();
                this.heartsG.fill();
            }
        }
    }

    /** 执行动作指令 */
    private applyAction(actionId: string, speed = 1.0): void {
        if (this.liveVisual2D) {
            this.liveVisual2D.setAction(actionId, speed);
        }
        if (this.liveVisual3D) {
            this.liveVisual3D.setAction(actionId, speed);
        }
    }

    /** 更新主模式 Tab 按钮高亮 */
    private updateMainModeButtons(): void {
        for (const item of this.mainModeButtons) {
            const isSelected = item.mode === this.currentMainMode;
            this.drawModeButtonBackground(item.bg, isSelected);
            item.label.color = isSelected ? WestColors.GOLD_BRIGHT : WestColors.CREAM;
            item.label.isBold = isSelected;
        }
    }

    /** 更新动作按钮高亮样式 */
    private updateActionButtonStyles(): void {
        for (const item of this.actionButtons) {
            const isSelected = item.id === this.currentAction;
            this.drawActionButtonBackground(item.bg, isSelected);
            item.label.color = isSelected ? WestColors.GOLD_BRIGHT : Color.WHITE;
        }
    }

    /** 更新三视分立面按钮高亮 */
    private updateOrthoSubButtonStyles(): void {
        for (const item of this.orthoSubButtons) {
            const isSelected = item.view === this.currentOrthoSubView;
            this.drawModeButtonBackground(item.bg, isSelected);
            item.label.color = isSelected ? WestColors.GOLD_BRIGHT : WestColors.CREAM;
        }
    }

    public close(): void {
        this.node.destroy();
        if (HorseGalleryModal.instance === this) {
            HorseGalleryModal.instance = null;
        }
    }
}

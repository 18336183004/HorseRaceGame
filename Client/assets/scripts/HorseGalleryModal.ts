import { _decorator, Component, Node, Graphics, Color, Label, UITransform, Layers, Button, Sprite, EventTouch, HorizontalTextAlignment, Vec3, tween } from "cc";
import { HorseAssetRegistry, HorseProfile, FoalGrowthStage } from "./HorseAssetRegistry";
import { HorseSprites } from "./HorseSprites";
import { WestColors } from "./WestTheme";
import { HorseVisual2D } from "./HorseVisual2D";
import { WestAudio } from "./WestAudio";

const { ccclass } = _decorator;

/**
 * 赛马 2D 美术图鉴、三视图与成长四阶段展示弹窗 (HorseGalleryModal)
 * 结合 18-20 世纪古典欧美纯血马设计图，提供 20 匹名驹真实油画立绘、
 * 解剖三视图大图、幼驹 4 期演变大图以及 2D 骨骼动力学动作即时演练。
 */
@ccclass("HorseGalleryModal")
export class HorseGalleryModal extends Component {
    private static instance: HorseGalleryModal | null = null;

    private modalRoot: Node | null = null;
    private currentHorseNo: number = 1;
    private currentStage: FoalGrowthStage = FoalGrowthStage.Adult;

    // 动态文字与内容节点
    private titleLabel: Label | null = null;
    private descLabel: Label | null = null;
    private stageButtonGraphics: { id: FoalGrowthStage; bg: Graphics; label: Label }[] = [];

    // 画布与贴图展示区
    private showcaseBox: Node | null = null;
    private showcaseImgNode: Node | null = null;
    private orthoBox: Node | null = null;
    private orthoImgNode: Node | null = null;
    private orthoTitleLbl: Label | null = null;

    // 2D 骨骼动力学实时动作演练模式
    private liveHorseNode: Node | null = null;
    private liveHorseVisual: HorseVisual2D | null = null;
    private isLiveMotionMode: boolean = false;
    private modeToggleLabel: Label | null = null;
    private actionChipsBar: Node | null = null;

    // 成长四阶段时间轴滑块手柄
    private scrubberKnobNode: Node | null = null;

    public static show(horseNo: number = 1, parentNode?: Node, initialStage: FoalGrowthStage = FoalGrowthStage.Adult) {
        if (this.instance && (!this.instance.isValid || !this.instance.node || !this.instance.node.isValid)) {
            this.instance = null;
        }

        if (!this.instance) {
            const root = new Node("HorseGalleryModalRoot");
            if (parentNode && parentNode.isValid) {
                parentNode.addChild(root);
            }
            this.instance = root.addComponent(HorseGalleryModal);
        } else if (parentNode && parentNode.isValid && this.instance.node.parent !== parentNode) {
            this.instance.node.removeFromParent();
            parentNode.addChild(this.instance.node);
        }

        this.instance.open(horseNo, initialStage);
    }

    onLoad() {
        HorseGalleryModal.instance = this;
        this.buildUI();
    }

    public open(horseNo: number, initialStage: FoalGrowthStage = FoalGrowthStage.Adult) {
        this.currentHorseNo = Math.max(1, Math.min(20, horseNo));
        this.currentStage = initialStage;
        if (this.modalRoot && this.modalRoot.isValid) {
            this.modalRoot.active = true;
        }
        this.refreshDisplay();
    }

    public close() {
        if (this.modalRoot && this.modalRoot.isValid) {
            this.modalRoot.active = false;
        }
        HorseSprites.clearGalleryCache();
    }

    private buildUI() {
        this.stageButtonGraphics = [];
        this.modalRoot = new Node("ModalContainer");
        this.modalRoot.layer = Layers.Enum.UI_2D;
        this.node.addChild(this.modalRoot);
        this.modalRoot.addComponent(UITransform).setContentSize(840, 560);

        // 1. 半透明暗色遮罩
        const mask = new Node("BackdropMask");
        mask.layer = Layers.Enum.UI_2D;
        this.modalRoot.addChild(mask);
        mask.addComponent(UITransform).setContentSize(2000, 2000);
        const mg = mask.addComponent(Graphics);
        mg.fillColor = new Color(0, 0, 0, 205);
        mg.rect(-1000, -1000, 2000, 2000);
        mg.fill();

        const maskBtn = mask.addComponent(Button);
        maskBtn.node.on(Button.EventType.CLICK, () => this.close(), this);

        // 2. 主画框容器（古典维多利亚胡桃木 + 烫金黄铜外框，适配 720 竖屏严密视口）
        const panel = new Node("GalleryPanel");
        panel.layer = Layers.Enum.UI_2D;
        this.modalRoot.addChild(panel);
        panel.addComponent(UITransform).setContentSize(680, 530);
        panel.on(Node.EventType.TOUCH_START, (e: EventTouch) => { e.propagationStopped = true; });
        panel.on(Node.EventType.TOUCH_END, (e: EventTouch) => { e.propagationStopped = true; });

        const pg = panel.addComponent(Graphics);

        // 深木底板
        pg.fillColor = WestColors.WOOD_DARK;
        pg.roundRect(-340, -265, 680, 530, 12);
        pg.fill();

        // 羊皮纸内芯底色
        pg.fillColor = new Color(248, 242, 230, 255);
        pg.roundRect(-326, -251, 652, 502, 8);
        pg.fill();

        // 烫金双边线
        pg.strokeColor = WestColors.GOLD_METALLIC;
        pg.lineWidth = 2.4;
        pg.roundRect(-326, -251, 652, 502, 8);
        pg.stroke();

        // 3. 顶部标题栏
        const headerNode = new Node("Header");
        headerNode.layer = Layers.Enum.UI_2D;
        panel.addChild(headerNode);
        headerNode.setPosition(0, 222, 0);

        const titleLblNode = new Node("TitleLbl");
        titleLblNode.layer = Layers.Enum.UI_2D;
        headerNode.addChild(titleLblNode);
        this.titleLabel = titleLblNode.addComponent(Label);
        this.titleLabel.fontSize = 17;
        this.titleLabel.lineHeight = 22;
        this.titleLabel.color = WestColors.LEATHER_DARK;
        this.titleLabel.string = "名驹 2D 古典画作与解剖三视图图鉴";

        // 上一匹按钮 (Prev Horse)
        const prevBtn = new Node("PrevHorseBtn");
        prevBtn.layer = Layers.Enum.UI_2D;
        panel.addChild(prevBtn);
        prevBtn.setPosition(-255, 222, 0);
        prevBtn.addComponent(UITransform).setContentSize(68, 28);
        const pbg = prevBtn.addComponent(Graphics);
        pbg.fillColor = WestColors.WOOD_MEDIUM;
        pbg.roundRect(-34, -14, 68, 28, 5);
        pbg.fill();
        pbg.strokeColor = WestColors.GOLD_METALLIC;
        pbg.lineWidth = 1.2;
        pbg.roundRect(-34, -14, 68, 28, 5);
        pbg.stroke();
        const ptxtNode = new Node("PrevTxt");
        ptxtNode.layer = Layers.Enum.UI_2D;
        prevBtn.addChild(ptxtNode);
        const ptl = ptxtNode.addComponent(Label);
        ptl.fontSize = 12;
        ptl.lineHeight = 16;
        ptl.color = Color.WHITE;
        ptl.string = "◀ 上一匹";
        const prevBtnComp = prevBtn.addComponent(Button);
        prevBtnComp.node.on(Button.EventType.CLICK, () => {
            this.currentHorseNo = this.currentHorseNo > 1 ? this.currentHorseNo - 1 : 20;
            this.refreshDisplay();
        }, this);

        // 下一匹按钮 (Next Horse)
        const nextBtn = new Node("NextHorseBtn");
        nextBtn.layer = Layers.Enum.UI_2D;
        panel.addChild(nextBtn);
        nextBtn.setPosition(225, 222, 0);
        nextBtn.addComponent(UITransform).setContentSize(68, 28);
        const nbg = nextBtn.addComponent(Graphics);
        nbg.fillColor = WestColors.WOOD_MEDIUM;
        nbg.roundRect(-34, -14, 68, 28, 5);
        nbg.fill();
        nbg.strokeColor = WestColors.GOLD_METALLIC;
        nbg.lineWidth = 1.2;
        nbg.roundRect(-34, -14, 68, 28, 5);
        nbg.stroke();
        const ntxtNode = new Node("NextTxt");
        ntxtNode.layer = Layers.Enum.UI_2D;
        nextBtn.addChild(ntxtNode);
        const ntl = ntxtNode.addComponent(Label);
        ntl.fontSize = 12;
        ntl.lineHeight = 16;
        ntl.color = Color.WHITE;
        ntl.string = "下一匹 ▶";
        const nextBtnComp = nextBtn.addComponent(Button);
        nextBtnComp.node.on(Button.EventType.CLICK, () => {
            this.currentHorseNo = this.currentHorseNo < 20 ? this.currentHorseNo + 1 : 1;
            this.refreshDisplay();
        }, this);

        // 关闭按钮 (符合 44x44 无障碍触控基准，内缩至 X = 300，避免贴边越界)
        const closeBtn = new Node("CloseBtn");
        closeBtn.layer = Layers.Enum.UI_2D;
        panel.addChild(closeBtn);
        closeBtn.setPosition(300, 222, 0);
        closeBtn.addComponent(UITransform).setContentSize(44, 44);
        const cg = closeBtn.addComponent(Graphics);
        cg.fillColor = WestColors.BANDANA_RED;
        cg.circle(0, 0, 18);
        cg.fill();
        const closeTxt = new Node("CloseTxt");
        closeTxt.layer = Layers.Enum.UI_2D;
        closeBtn.addChild(closeTxt);
        const cl = closeTxt.addComponent(Label);
        cl.fontSize = 20;
        cl.lineHeight = 24;
        cl.color = Color.WHITE;
        cl.string = "✕";
        const btnComp = closeBtn.addComponent(Button);
        btnComp.node.on(Button.EventType.CLICK, () => this.close(), this);

        // 4. 左侧主展区：2D 油画艺术场景展示大图与 2D 动效演练舞台 (占黄金分割 61.8%, 宽 390 x 高 250)
        this.showcaseBox = new Node("ShowcaseBox");
        this.showcaseBox.layer = Layers.Enum.UI_2D;
        panel.addChild(this.showcaseBox);
        this.showcaseBox.setPosition(-125, 36, 0);
        this.showcaseBox.addComponent(UITransform).setContentSize(390, 250);

        // 内部真实贴图挂载子节点 (黄金画框展现，3:2 原画黄金长宽比 300x200，杜绝压扁变形)
        this.showcaseImgNode = new Node("ShowcaseImg");
        this.showcaseImgNode.layer = Layers.Enum.UI_2D;
        this.showcaseBox.addChild(this.showcaseImgNode);
        this.showcaseImgNode.setPosition(0, 16, 0);
        const scUt = this.showcaseImgNode.addComponent(UITransform);
        scUt.setContentSize(300, 200);
        this.showcaseImgNode.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;

        // 内部 2D 骨骼动力学实时动作演练节点 (2.3x 豪迈奔腾展示)
        this.liveHorseNode = new Node("LiveHorseNode");
        this.liveHorseNode.layer = Layers.Enum.UI_2D;
        this.showcaseBox.addChild(this.liveHorseNode);
        this.liveHorseNode.setPosition(0, 8, 0);
        this.liveHorseVisual = this.liveHorseNode.addComponent(HorseVisual2D);
        this.liveHorseVisual.isPaddockMode = true;
        this.liveHorseVisual.setDisplayScale(2.3);
        this.liveHorseNode.active = false;

        // 模式切换按钮 (油画立绘 <-> 2D 骨骼动效)
        const modeBtn = new Node("ModeToggleBtn");
        modeBtn.layer = Layers.Enum.UI_2D;
        this.showcaseBox.addChild(modeBtn);
        modeBtn.setPosition(0, -104, 0);
        modeBtn.addComponent(UITransform).setContentSize(180, 26);
        const mbg = modeBtn.addComponent(Graphics);
        mbg.fillColor = WestColors.WOOD_MEDIUM;
        mbg.roundRect(-90, -13, 180, 26, 5);
        mbg.fill();
        mbg.strokeColor = WestColors.GOLD_METALLIC;
        mbg.lineWidth = 1.2;
        mbg.roundRect(-90, -13, 180, 26, 5);
        mbg.stroke();

        const mtxtNode = new Node("ModeTxt");
        mtxtNode.layer = Layers.Enum.UI_2D;
        modeBtn.addChild(mtxtNode);
        this.modeToggleLabel = mtxtNode.addComponent(Label);
        this.modeToggleLabel.fontSize = 11;
        this.modeToggleLabel.lineHeight = 15;
        this.modeToggleLabel.color = WestColors.GOLD_BRIGHT;
        this.modeToggleLabel.string = "🎬 切换 2D 骨骼动效演练";

        const mBtnComp = modeBtn.addComponent(Button);
        mBtnComp.node.on(Button.EventType.CLICK, () => {
            this.isLiveMotionMode = !this.isLiveMotionMode;
            if (this.modeToggleLabel) {
                this.modeToggleLabel.string = this.isLiveMotionMode ? "🖼️ 切换油画展示大图" : "🎬 切换 2D 骨骼动效演练";
            }
            if (this.actionChipsBar) {
                this.actionChipsBar.active = this.isLiveMotionMode;
            }
            this.refreshDisplay();
        }, this);

        // 动作演练快捷芯片栏 (仅在 2D 动效演练模式下显示，宽 390 区间从容排布)
        this.actionChipsBar = new Node("ActionChipsBar");
        this.actionChipsBar.layer = Layers.Enum.UI_2D;
        this.showcaseBox.addChild(this.actionChipsBar);
        this.actionChipsBar.setPosition(0, -68, 0);
        this.actionChipsBar.active = false;

        const actionChips = [
            { id: "Walk", name: "慢步" },
            { id: "Trot", name: "快步" },
            { id: "Gallop", name: "袭步" },
            { id: "Graze", name: "吃草" },
            { id: "Rear", name: "起扬" },
            { id: "Sliding_Stop", name: "急停" },
        ];
        actionChips.forEach((ac, idx) => {
            const chip = new Node(`Chip_${ac.id}`);
            chip.layer = Layers.Enum.UI_2D;
            this.actionChipsBar!.addChild(chip);
            chip.setPosition(-145 + idx * 58, 0, 0);
            chip.addComponent(UITransform).setContentSize(50, 22);

            const cbg = chip.addComponent(Graphics);
            cbg.fillColor = new Color(42, 28, 18, 220);
            cbg.roundRect(-25, -11, 50, 22, 4);
            cbg.fill();
            cbg.strokeColor = WestColors.BRASS_FRAME;
            cbg.lineWidth = 1.0;
            cbg.roundRect(-25, -11, 50, 22, 4);
            cbg.stroke();

            const ctlNode = new Node("ChipTxt");
            ctlNode.layer = Layers.Enum.UI_2D;
            chip.addChild(ctlNode);
            const cl = ctlNode.addComponent(Label);
            cl.fontSize = 11;
            cl.lineHeight = 15;
            cl.color = Color.WHITE;
            cl.string = ac.name;

            const cb = chip.addComponent(Button);
            cb.node.on(Button.EventType.CLICK, () => {
                if (this.liveHorseVisual) {
                    this.liveHorseVisual.setAction(ac.id, 1.0);
                }
            }, this);
        });

        // 5. 右侧辅助展示区：解剖三视图与成长阶段大图 (占黄金分割 38.2%, 宽 240 x 高 250)
        this.orthoBox = new Node("OrthoBox");
        this.orthoBox.layer = Layers.Enum.UI_2D;
        panel.addChild(this.orthoBox);
        this.orthoBox.setPosition(200, 36, 0);
        this.orthoBox.addComponent(UITransform).setContentSize(240, 250);

        this.orthoImgNode = new Node("OrthoImg");
        this.orthoImgNode.layer = Layers.Enum.UI_2D;
        this.orthoBox.addChild(this.orthoImgNode);
        this.orthoImgNode.setPosition(0, 16, 0);
        const otUt = this.orthoImgNode.addComponent(UITransform);
        otUt.setContentSize(220, 138);
        this.orthoImgNode.addComponent(Sprite).sizeMode = Sprite.SizeMode.CUSTOM;

        // 底部标牌文字
        const otTitleNode = new Node("OrthoTitleLbl");
        otTitleNode.layer = Layers.Enum.UI_2D;
        this.orthoBox.addChild(otTitleNode);
        otTitleNode.setPosition(0, -109, 0);
        this.orthoTitleLbl = otTitleNode.addComponent(Label);
        this.orthoTitleLbl.fontSize = 11;
        this.orthoTitleLbl.lineHeight = 15;
        this.orthoTitleLbl.color = WestColors.GOLD_BRIGHT;
        this.orthoTitleLbl.string = "📐 名驹解剖三视图";

        // 6. 底部马匹档案文字信息 (居中布局，宽 630)
        const infoNode = new Node("InfoTextNode");
        infoNode.layer = Layers.Enum.UI_2D;
        panel.addChild(infoNode);
        infoNode.setPosition(0, -118, 0);
        const infoLblNode = new Node("DescLbl");
        infoLblNode.layer = Layers.Enum.UI_2D;
        infoNode.addChild(infoLblNode);
        this.descLabel = infoLblNode.addComponent(Label);
        this.descLabel.fontSize = 12;
        this.descLabel.lineHeight = 17;
        this.descLabel.color = WestColors.LEATHER_DARK;
        this.descLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
        this.descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        infoLblNode.addComponent(UITransform).setContentSize(630, 42);

        // 7. 幼驹成长四阶段时间轴导轨滑块 (Growth Timeline Scrubber)
        const scrubberTrack = new Node("GrowthScrubberTrack");
        scrubberTrack.layer = Layers.Enum.UI_2D;
        panel.addChild(scrubberTrack);
        scrubberTrack.setPosition(0, -154, 0);
        scrubberTrack.addComponent(UITransform).setContentSize(600, 24);

        const tg = scrubberTrack.addComponent(Graphics);
        // 导轨背景 (黄铜木纹导轨)
        tg.fillColor = WestColors.WOOD_DARK;
        tg.roundRect(-250, -4, 500, 8, 4);
        tg.fill();
        tg.strokeColor = WestColors.BRASS_FRAME;
        tg.lineWidth = 1.2;
        tg.roundRect(-250, -4, 500, 8, 4);
        tg.stroke();

        // 4 个里程碑节点指示刻度
        for (let i = 0; i < 4; i++) {
            const dotX = -225 + i * 150;
            tg.fillColor = WestColors.GOLD_BRIGHT;
            tg.circle(dotX, 0, 5);
            tg.fill();
            tg.strokeColor = WestColors.WOOD_DARK;
            tg.lineWidth = 1.2;
            tg.circle(dotX, 0, 5);
            tg.stroke();
        }

        // 滑块手柄 (Horseshoe / Brass Knob)
        const knob = new Node("ScrubberKnob");
        knob.layer = Layers.Enum.UI_2D;
        scrubberTrack.addChild(knob);
        knob.setPosition(-225, 0, 0);
        knob.addComponent(UITransform).setContentSize(28, 28);
        const kg = knob.addComponent(Graphics);
        kg.fillColor = WestColors.GOLD_BRIGHT;
        kg.circle(0, 0, 9);
        kg.fill();
        kg.strokeColor = WestColors.LEATHER_DARK;
        kg.lineWidth = 2.0;
        kg.circle(0, 0, 9);
        kg.stroke();
        this.scrubberKnobNode = knob;

        // 支持点击或拖拽导轨快速换档
        const onScrubberTouch = (e: EventTouch): void => {
            const loc = e.getUILocation();
            const ut = scrubberTrack.getComponent(UITransform);
            if (!ut) return;
            const localPos = ut.convertToNodeSpaceAR(new Vec3(loc.x, loc.y, 0));
            this.handleScrubberTouch(localPos.x);
        };
        scrubberTrack.on(Node.EventType.TOUCH_START, onScrubberTouch, this);
        scrubberTrack.on(Node.EventType.TOUCH_MOVE, onScrubberTouch, this);

        // 8. 幼驹成长四阶段切换按钮栏 (幼驹期 -> 青年期 -> 成年期 -> 职业赛马)
        const stageBar = new Node("StageButtonBar");
        stageBar.layer = Layers.Enum.UI_2D;
        panel.addChild(stageBar);
        stageBar.setPosition(0, -196, 0);

        const stages = [
            { id: FoalGrowthStage.Foal, name: "① 幼驹期 (0~1岁)" },
            { id: FoalGrowthStage.Yearling, name: "② 青年期 (1~2岁)" },
            { id: FoalGrowthStage.Adult, name: "③ 成年期 (3~5岁)" },
            { id: FoalGrowthStage.RacingPro, name: "④ 职业赛马 (5岁+)" }
        ];

        for (let i = 0; i < stages.length; i++) {
            const s = stages[i];
            const btn = new Node(`StageBtn_${s.id}`);
            btn.layer = Layers.Enum.UI_2D;
            stageBar.addChild(btn);
            btn.setPosition(-225 + i * 150, 0, 0);
            btn.addComponent(UITransform).setContentSize(146, 32);

            const bg = btn.addComponent(Graphics);
            bg.fillColor = WestColors.WOOD_MEDIUM;
            bg.roundRect(-73, -16, 146, 32, 6);
            bg.fill();
            bg.strokeColor = WestColors.GOLD_METALLIC;
            bg.lineWidth = 1.2;
            bg.roundRect(-73, -16, 146, 32, 6);
            bg.stroke();

            const txtNode = new Node("BtnTxt");
            txtNode.layer = Layers.Enum.UI_2D;
            btn.addChild(txtNode);
            const tl = txtNode.addComponent(Label);
            tl.fontSize = 11;
            tl.lineHeight = 16;
            tl.color = Color.WHITE;
            tl.string = s.name;

            this.stageButtonGraphics.push({ id: s.id, bg, label: tl });

            const b = btn.addComponent(Button);
            b.node.on(Button.EventType.CLICK, () => {
                WestAudio.playChipClink();
                this.currentStage = s.id;
                this.refreshDisplay();
            }, this);
        }
    }

    /** 响应成长时间轴拖拽与点击换档 */
    private handleScrubberTouch(localX: number): void {
        const stageOffsets = [-225, -75, 75, 225];
        let closestIdx = 0;
        let minDiff = 99999;
        for (let i = 0; i < stageOffsets.length; i++) {
            const diff = Math.abs(localX - stageOffsets[i]);
            if (diff < minDiff) {
                minDiff = diff;
                closestIdx = i;
            }
        }
        const targetStage = (closestIdx + 1) as FoalGrowthStage;
        if (targetStage !== this.currentStage) {
            this.currentStage = targetStage;
            WestAudio.playChipClink();
            this.refreshDisplay();
        }
    }

    /** 刷新展示数据与画框 */
    private refreshDisplay() {
        const horse = HorseAssetRegistry.getHorseByNo(this.currentHorseNo);
        const stageIdx = Math.max(0, Math.min(HorseAssetRegistry.FOAL_STAGES.length - 1, (this.currentStage as number) - 1));
        const stageInfo = HorseAssetRegistry.FOAL_STAGES[stageIdx];

        if (this.titleLabel) {
            this.titleLabel.string = `No.${horse.horseNo} 【${horse.nameZh}】(${horse.nameEn}) - 欧美18~20世纪写实档案`;
        }

        if (this.descLabel) {
            this.descLabel.string =
                `【毛色血统】: ${horse.coatColor} | ${horse.breed}\n` +
                `【体态解剖】: ${horse.descriptionZh}\n` +
                `【${stageInfo.nameZh}特征 (${stageInfo.ageDesc})】: ${stageInfo.anatomicalTrait}`;
        }

        // 更新成长阶段按钮高亮样式
        for (const item of this.stageButtonGraphics) {
            const isSelected = item.id === this.currentStage;
            item.bg.clear();
            item.bg.fillColor = isSelected ? new Color(175, 115, 45, 255) : WestColors.WOOD_MEDIUM;
            item.bg.roundRect(-73, -16, 146, 32, 6);
            item.bg.fill();
            item.bg.strokeColor = isSelected ? WestColors.GOLD_BRIGHT : WestColors.GOLD_METALLIC;
            item.bg.lineWidth = isSelected ? 2.4 : 1.0;
            item.bg.roundRect(-73, -16, 146, 32, 6);
            item.bg.stroke();
            item.label.color = isSelected ? WestColors.GOLD_BRIGHT : Color.WHITE;
        }

        // 平滑滑动成长时间轴手柄
        if (this.scrubberKnobNode && this.scrubberKnobNode.isValid) {
            const targetX = -225 + stageIdx * 150;
            tween(this.scrubberKnobNode)
                .to(0.18, { position: new Vec3(targetX, 0, 0) }, { easing: "sineOut" })
                .start();
        }

        this.renderShowcaseCanvas(horse);
        this.renderOrthoCanvas(horse);
    }

    /** 绘制左侧 2D 油画艺术展示画框或实时 2D 动效画框 */
    private renderShowcaseCanvas(horse: HorseProfile) {
        if (!this.showcaseBox) return;
        let g = this.showcaseBox.getComponent(Graphics);
        if (!g) g = this.showcaseBox.addComponent(Graphics);
        g.clear();

        // 古典羊皮纸底框与烫金外框 (黄金画框 390 x 250)
        g.fillColor = new Color(242, 236, 222, 255);
        g.roundRect(-195, -125, 390, 250, 6);
        g.fill();
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 2.4;
        g.roundRect(-195, -125, 390, 250, 6);
        g.stroke();

        if (this.isLiveMotionMode) {
            // 隐藏静态油画，展示实时 2D 骨骼动力学马匹
            if (this.showcaseImgNode) this.showcaseImgNode.active = false;
            if (this.liveHorseNode) this.liveHorseNode.active = true;
            if (this.liveHorseVisual) {
                if (this.currentStage === FoalGrowthStage.Adult) {
                    this.liveHorseVisual.setHorseNo(horse.horseNo);
                } else {
                    this.liveHorseVisual.setFoalStage(horse.horseNo, this.currentStage);
                }
            }
        } else {
            // 展示真实高清 2D 油画艺术立绘大图（采用渐进式加载：精灵秒级占位 -> 4K Showcase 渐变载入，彻底消除白屏等待）
            if (this.showcaseImgNode && this.showcaseImgNode.isValid) {
                this.showcaseImgNode.active = true;
                HorseSprites.applyShowcaseProgressive(this.showcaseImgNode, horse.horseNo);
            }
            if (this.liveHorseNode) {
                this.liveHorseNode.active = false;
            }
        }
    }

    /** 绘制右侧解剖三视图与成长阶段画框 */
    private renderOrthoCanvas(horse: HorseProfile) {
        if (!this.orthoBox) return;
        let g = this.orthoBox.getComponent(Graphics);
        if (!g) g = this.orthoBox.addComponent(Graphics);
        g.clear();

        // 手绘解剖图谱底框 (黄金副区 240 x 250)
        g.fillColor = new Color(242, 238, 226, 255);
        g.roundRect(-120, -125, 240, 250, 6);
        g.fill();
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 2.4;
        g.roundRect(-120, -125, 240, 250, 6);
        g.stroke();

        // 底部标牌
        g.fillColor = new Color(50, 32, 22, 230);
        g.roundRect(-100, -120, 200, 22, 4);
        g.fill();

        if (this.orthoImgNode && this.orthoImgNode.isValid) {
            const ut = this.orthoImgNode.getComponent(UITransform);
            if (this.currentStage === FoalGrowthStage.Adult) {
                // 成年三视图为 ~1.6:1 宽幅比例，按 220x138 呈现，杜绝纵向拉伸变形
                if (ut) ut.setContentSize(220, 138);
                this.orthoImgNode.setPosition(0, 16, 0);
                if (this.orthoTitleLbl) {
                    this.orthoTitleLbl.string = "📐 名驹解剖三视图 (正·侧·背)";
                }
                HorseSprites.applyHorseOrtho(this.orthoImgNode, horse.horseNo);
            } else {
                // 幼驹 4 阶段图鉴为 1:1 正方比例，按 190x190 呈现
                if (ut) ut.setContentSize(190, 190);
                this.orthoImgNode.setPosition(0, 10, 0);
                const sNames = ["① 幼驹期图鉴 (0~1岁)", "② 青年期图鉴 (1~2岁)", "③ 成年期图鉴 (3~5岁)", "④ 职业赛马图鉴 (5岁+)"];
                const sIdx = Math.max(0, Math.min(3, (this.currentStage as number) - 1));
                if (this.orthoTitleLbl) {
                    this.orthoTitleLbl.string = `🌱 ${sNames[sIdx]}`;
                }
                HorseSprites.applyFoalStage(this.orthoImgNode, this.currentStage, horse.horseNo);
            }
        }
    }

    protected onDestroy(): void {
        if (HorseGalleryModal.instance === this) {
            HorseGalleryModal.instance = null;
        }
        this.modalRoot = null;
        this.titleLabel = null;
        this.descLabel = null;
        this.showcaseBox = null;
        this.showcaseImgNode = null;
        this.orthoBox = null;
        this.orthoImgNode = null;
        this.orthoTitleLbl = null;
        this.liveHorseNode = null;
        this.liveHorseVisual = null;
        this.scrubberKnobNode = null;
        this.stageButtonGraphics.length = 0;
        HorseSprites.clearGalleryCache();
    }
}

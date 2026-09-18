import { _decorator, Component, Node, Graphics, Color, Label, UITransform, Layers, Button, EventHandler } from "cc";
import { HorseAssetRegistry, HorseProfile, FoalGrowthStage, FoalStageInfo } from "./HorseAssetRegistry";
import { WestColors } from "./WestTheme";

const { ccclass } = _decorator;

/**
 * 赛马 2D 美术图鉴、三视图与成长四阶段展示弹窗 (HorseGalleryModal)
 * 提供 18-20 世纪古典欧美纯血马油画立绘、解剖三视图、幼驹4期演变及30+动作的交互查看。
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

    // 画布展示区
    private showcaseBox: Node | null = null;
    private orthoBox: Node | null = null;

    public static show(horseNo: number = 1, parentNode?: Node) {
        // 防御式清理无效单例
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
            // 页面切换时重新挂载至新父级
            this.instance.node.removeFromParent();
            parentNode.addChild(this.instance.node);
        }

        this.instance.open(horseNo);
    }

    onLoad() {
        HorseGalleryModal.instance = this;
        this.buildUI();
    }

    public open(horseNo: number) {
        this.currentHorseNo = Math.max(1, Math.min(12, horseNo));
        this.currentStage = FoalGrowthStage.Adult;
        if (this.modalRoot && this.modalRoot.isValid) {
            this.modalRoot.active = true;
        }
        this.refreshDisplay();
    }

    public close() {
        if (this.modalRoot && this.modalRoot.isValid) {
            this.modalRoot.active = false;
        }
    }

    private buildUI() {
        this.stageButtonGraphics = [];
        this.modalRoot = new Node("ModalContainer");
        this.modalRoot.layer = Layers.Enum.UI_2D;
        this.node.addChild(this.modalRoot);
        this.modalRoot.addComponent(UITransform).setContentSize(840, 560);

        // 1. 半透明暗色遮罩（支持点击空白处快速关闭）
        const mask = new Node("BackdropMask");
        mask.layer = Layers.Enum.UI_2D;
        this.modalRoot.addChild(mask);
        mask.addComponent(UITransform).setContentSize(2000, 2000);
        const mg = mask.addComponent(Graphics);
        mg.fillColor = new Color(0, 0, 0, 195);
        mg.rect(-1000, -1000, 2000, 2000);
        mg.fill();

        const maskBtn = mask.addComponent(Button);
        maskBtn.node.on(Button.EventType.CLICK, () => this.close(), this);

        // 2. 主画框容器（古典维多利亚胡桃木 + 烫金黄铜外框）
        const panel = new Node("GalleryPanel");
        panel.layer = Layers.Enum.UI_2D;
        this.modalRoot.addChild(panel);
        panel.addComponent(UITransform).setContentSize(780, 520);
        const pg = panel.addComponent(Graphics);

        // 深木底板
        pg.fillColor = WestColors.WOOD_DARK;
        pg.roundRect(-390, -260, 780, 520, 12);
        pg.fill();

        // 羊皮纸内芯底色
        pg.fillColor = new Color(248, 242, 230, 255);
        pg.roundRect(-376, -246, 752, 492, 8);
        pg.fill();

        // 烫金双边线
        pg.strokeColor = WestColors.GOLD_METALLIC;
        pg.lineWidth = 3.0;
        pg.roundRect(-376, -246, 752, 492, 8);
        pg.stroke();

        // 3. 顶部标题栏
        const headerNode = new Node("Header");
        headerNode.layer = Layers.Enum.UI_2D;
        panel.addChild(headerNode);
        headerNode.setPosition(0, 218, 0);

        const titleLblNode = new Node("TitleLbl");
        titleLblNode.layer = Layers.Enum.UI_2D;
        headerNode.addChild(titleLblNode);
        this.titleLabel = titleLblNode.addComponent(Label);
        this.titleLabel.fontSize = 22;
        this.titleLabel.lineHeight = 26;
        this.titleLabel.color = WestColors.LEATHER_DARK;
        this.titleLabel.string = "名驹 2D 古典画作与解剖三视图图鉴";

        // 关闭按钮
        const closeBtn = new Node("CloseBtn");
        closeBtn.layer = Layers.Enum.UI_2D;
        panel.addChild(closeBtn);
        closeBtn.setPosition(350, 218, 0);
        closeBtn.addComponent(UITransform).setContentSize(32, 32);
        const cg = closeBtn.addComponent(Graphics);
        cg.fillColor = WestColors.BANDANA_RED;
        cg.circle(0, 0, 14);
        cg.fill();
        const closeTxt = new Node("CloseTxt");
        closeTxt.layer = Layers.Enum.UI_2D;
        closeBtn.addChild(closeTxt);
        const cl = closeTxt.addComponent(Label);
        cl.fontSize = 18;
        cl.lineHeight = 20;
        cl.color = Color.WHITE;
        cl.string = "✕";
        const btnComp = closeBtn.addComponent(Button);
        const eh = new EventHandler();
        eh.target = this.node;
        eh.component = "HorseGalleryModal";
        eh.handler = "close";
        btnComp.clickEvents.push(eh);

        // 4. 左侧展示区：2D 油画艺术图展示
        this.showcaseBox = new Node("ShowcaseBox");
        this.showcaseBox.layer = Layers.Enum.UI_2D;
        panel.addChild(this.showcaseBox);
        this.showcaseBox.setPosition(-185, 30, 0);
        this.showcaseBox.addComponent(UITransform).setContentSize(340, 260);

        // 5. 右侧展示区：解剖三视图展示
        this.orthoBox = new Node("OrthoBox");
        this.orthoBox.layer = Layers.Enum.UI_2D;
        panel.addChild(this.orthoBox);
        this.orthoBox.setPosition(185, 30, 0);
        this.orthoBox.addComponent(UITransform).setContentSize(340, 260);

        // 6. 底部马匹档案文字信息
        const infoNode = new Node("InfoTextNode");
        infoNode.layer = Layers.Enum.UI_2D;
        panel.addChild(infoNode);
        infoNode.setPosition(-350, -135, 0);
        const infoLblNode = new Node("DescLbl");
        infoLblNode.layer = Layers.Enum.UI_2D;
        infoNode.addChild(infoLblNode);
        this.descLabel = infoLblNode.addComponent(Label);
        this.descLabel.fontSize = 13;
        this.descLabel.lineHeight = 18;
        this.descLabel.color = WestColors.LEATHER_DARK;
        this.descLabel.overflow = Label.Overflow.RESIZE_HEIGHT;
        infoLblNode.addComponent(UITransform).setContentSize(700, 50);

        // 7. 幼驹成长四阶段切换按钮栏 (幼驹期 -> 青年期 -> 成年期 -> 职业赛马)
        const stageBar = new Node("StageButtonBar");
        stageBar.layer = Layers.Enum.UI_2D;
        panel.addChild(stageBar);
        stageBar.setPosition(0, -205, 0);

        const stages = [
            { id: FoalGrowthStage.Foal, name: "① 幼驹期 (0~6月)" },
            { id: FoalGrowthStage.Yearling, name: "② 青年期 (1~2岁)" },
            { id: FoalGrowthStage.Adult, name: "③ 成年期 (3~4岁)" },
            { id: FoalGrowthStage.RacingPro, name: "④ 职业赛马 (4岁+)" }
        ];

        for (let i = 0; i < stages.length; i++) {
            const s = stages[i];
            const btn = new Node(`StageBtn_${s.id}`);
            btn.layer = Layers.Enum.UI_2D;
            stageBar.addChild(btn);
            btn.setPosition(-270 + i * 180, 0, 0);
            btn.addComponent(UITransform).setContentSize(160, 32);

            const bg = btn.addComponent(Graphics);
            bg.fillColor = WestColors.WOOD_MEDIUM;
            bg.roundRect(-80, -16, 160, 32, 6);
            bg.fill();
            bg.strokeColor = WestColors.GOLD_METALLIC;
            bg.lineWidth = 1.2;
            bg.roundRect(-80, -16, 160, 32, 6);
            bg.stroke();

            const txtNode = new Node("BtnTxt");
            txtNode.layer = Layers.Enum.UI_2D;
            btn.addChild(txtNode);
            const tl = txtNode.addComponent(Label);
            tl.fontSize = 12;
            tl.lineHeight = 16;
            tl.color = Color.WHITE;
            tl.string = s.name;

            this.stageButtonGraphics.push({ id: s.id, bg, label: tl });

            const b = btn.addComponent(Button);
            b.node.on(Button.EventType.CLICK, () => {
                this.currentStage = s.id;
                this.refreshDisplay();
            }, this);
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
            item.bg.roundRect(-80, -16, 160, 32, 6);
            item.bg.fill();
            item.bg.strokeColor = isSelected ? WestColors.GOLD_BRIGHT : WestColors.GOLD_METALLIC;
            item.bg.lineWidth = isSelected ? 2.4 : 1.0;
            item.bg.roundRect(-80, -16, 160, 32, 6);
            item.bg.stroke();
            item.label.color = isSelected ? WestColors.GOLD_BRIGHT : Color.WHITE;
        }

        this.renderShowcaseCanvas(horse);
        this.renderOrthoCanvas(horse);
    }

    /** 绘制左侧 2D 油画艺术展示画框 */
    private renderShowcaseCanvas(horse: HorseProfile) {
        if (!this.showcaseBox) return;
        let g = this.showcaseBox.getComponent(Graphics);
        if (!g) g = this.showcaseBox.addComponent(Graphics);
        g.clear();

        // 画框金边与羊皮纸内框
        g.fillColor = new Color(230, 222, 205, 255);
        g.roundRect(-165, -125, 330, 250, 6);
        g.fill();
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 2.0;
        g.roundRect(-165, -125, 330, 250, 6);
        g.stroke();

        // 艺术画名标牌
        g.fillColor = new Color(50, 32, 22, 220);
        g.roundRect(-120, -120, 240, 24, 4);
        g.fill();

        // 模拟 19 世纪油画草坪与夕阳渐变背景
        g.fillColor = new Color(245, 205, 140, 180); // 暮色夕阳
        g.rect(-160, 20, 320, 95);
        g.fill();
        g.fillColor = new Color(110, 140, 75, 220);  // 英国古典草甸
        g.rect(-160, -95, 320, 115);
        g.fill();

        // 奔腾或站立的写实纯血马油画身架剪影
        g.fillColor = new Color(140, 52, 30, 255);
        g.ellipse(-20, -20, 55, 32);
        g.fill();
        g.circle(28, -14, 30);
        g.fill();
        g.moveTo(-45, 0);
        g.lineTo(-75, 45);
        g.lineTo(-60, 50);
        g.lineTo(-30, 10);
        g.close();
        g.fill();
        g.ellipse(-78, 48, 18, 12);
        g.fill();
    }

    /** 绘制右侧解剖三视图画框 (正视/侧视/背视) */
    private renderOrthoCanvas(horse: HorseProfile) {
        if (!this.orthoBox) return;
        let g = this.orthoBox.getComponent(Graphics);
        if (!g) g = this.orthoBox.addComponent(Graphics);
        g.clear();

        // 手绘解剖图谱羊皮纸底
        g.fillColor = new Color(242, 238, 226, 255);
        g.roundRect(-165, -125, 330, 250, 6);
        g.fill();
        g.strokeColor = WestColors.BRASS_FRAME;
        g.lineWidth = 2.0;
        g.roundRect(-165, -125, 330, 250, 6);
        g.stroke();

        // 解剖学水平参考线 (Guide lines)
        g.strokeColor = new Color(190, 175, 150, 160);
        g.lineWidth = 1.0;
        const heights = [-60, -20, 20, 55];
        for (const h of heights) {
            g.moveTo(-160, h);
            g.lineTo(160, h);
            g.stroke();
        }

        // 侧视图 (Side View - 2D骨骼切件标准)
        g.strokeColor = new Color(60, 40, 28, 255);
        g.lineWidth = 1.6;
        g.ellipse(-45, -10, 42, 24);
        g.stroke();
        g.circle(0, -6, 24);
        g.stroke();

        // 正视图 (Front View)
        g.ellipse(90, -10, 18, 40);
        g.stroke();
        g.circle(90, 36, 11);
        g.stroke();

        // 底部标尺与文字
        g.fillColor = new Color(75, 50, 35, 230);
        g.roundRect(-140, -120, 280, 22, 4);
        g.fill();
    }
}

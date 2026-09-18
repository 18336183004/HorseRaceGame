import { _decorator, Component, Node, Graphics, Color, Vec3, UITransform, Sprite, resources, Texture2D, SpriteFrame } from "cc";
import { HorseAssetRegistry, HorseProfile } from "./HorseAssetRegistry";

const { ccclass, property } = _decorator;

/**
 * 赛马 2D 写实视觉组件 (HorseVisual2D)
 * 将粗糙的 Emoji 圆圈升级为具备 18~20 世纪古典欧美质感的写实赛马 2D 骨骼动效与立绘。
 */
@ccclass("HorseVisual2D")
export class HorseVisual2D extends Component {
    @property
    public horseNo: number = 1;

    private profile: HorseProfile | null = null;
    private horseBodyNode: Node | null = null;
    private horseG: Graphics | null = null;
    private spriteNode: Node | null = null;

    // 动画状态与物理参数
    private currentAction: string = "Stand";
    private animTime: number = 0;
    private isRunning: boolean = false;
    private speedFactor: number = 1.0;
    private baseScale: Vec3 = new Vec3(1, 1, 1);

    onLoad() {
        this.profile = HorseAssetRegistry.getHorseByNo(this.horseNo);
        this.setupVisualNodes();
    }

    /** 初始化或重置马匹编号与资料 */
    public setHorseNo(horseNo: number) {
        this.horseNo = horseNo;
        this.profile = HorseAssetRegistry.getHorseByNo(horseNo);
        this.renderRealisticHorse();
    }

    /** 建立可视化节点树结构 */
    private setupVisualNodes() {
        // 主身体容器节点
        this.horseBodyNode = new Node("RealisticBody");
        this.horseBodyNode.layer = this.node.layer;
        this.node.addChild(this.horseBodyNode);
        this.horseBodyNode.setPosition(0, 0, 0);

        const ut = this.horseBodyNode.addComponent(UITransform);
        ut.setContentSize(56, 44);

        this.horseG = this.horseBodyNode.addComponent(Graphics);

        // 立绘/切片贴图挂载子节点
        this.spriteNode = new Node("HorseSprite");
        this.spriteNode.layer = this.node.layer;
        this.horseBodyNode.addChild(this.spriteNode);
        this.spriteNode.setPosition(0, 4, 0);
        const sUt = this.spriteNode.addComponent(UITransform);
        sUt.setContentSize(52, 38);

        this.renderRealisticHorse();
        this.tryLoadShowcaseTexture();
    }

    /** 绘制写实 2D 马匹剪影与解剖肌理（在贴图加载完成前或作为底层骨架） */
    private renderRealisticHorse() {
        const g = this.horseG;
        if (!g) return;
        g.clear();

        const coat = this.getCoatBaseColor();

        // 1. 地面投射柔和椭圆阴影
        g.fillColor = new Color(0, 0, 0, 75);
        g.ellipse(0, -18, 22, 6);
        g.fill();

        // 2. 真实纯血马侧视体态 (Thoroughbred Silhouette)
        // A. 后躯与臀肌 (Pelvis & Quarters)
        g.fillColor = coat;
        g.circle(10, -2, 13);
        g.fill();

        // B. 主躯干与深胸廓 (Thorax & Flank)
        g.ellipse(-2, -1, 16, 11);
        g.fill();

        // C. 前胸与肩胛 (Shoulder)
        g.circle(-12, 1, 11);
        g.fill();

        // D. 优美弓形颈部与颈脊 (Crest & Neck)
        g.moveTo(-16, 6);
        g.lineTo(-24, 18);
        g.lineTo(-18, 20);
        g.lineTo(-8, 9);
        g.close();
        g.fill();

        // E. 纯血马典型头部 (Refined Head & Muzzle)
        g.ellipse(-24, 19, 6.5, 4.5);
        g.fill();

        // F. 直立敏锐双耳 (Ears forward)
        g.fillColor = new Color(coat.r - 25, coat.g - 25, coat.b - 25, 255);
        g.moveTo(-22, 22);
        g.lineTo(-24, 28);
        g.lineTo(-20, 24);
        g.close();
        g.fill();

        // G. 飘逸马尾 (Tail)
        g.fillColor = this.getManeColor();
        g.moveTo(20, 3);
        g.bezierCurveTo(28, 0, 32, -12, 26, -20);
        g.bezierCurveTo(23, -15, 21, -8, 17, -2);
        g.close();
        g.fill();

        // H. 颈鬃 (Flowing Mane)
        g.moveTo(-14, 14);
        g.lineTo(-10, 20);
        g.lineTo(-6, 12);
        g.close();
        g.fill();

        // I. 高光皮毛肌理与肋骨暗部阴影
        g.strokeColor = new Color(coat.r + 35, coat.g + 35, coat.b + 35, 120);
        g.lineWidth = 1.6;
        g.moveTo(-8, 7);
        g.lineTo(8, 4);
        g.stroke();

        // J. 竞技鞍布与马号数字标
        g.fillColor = new Color(245, 240, 225, 240); // 象牙白鞍布
        g.roundRect(-5, 0, 14, 10, 2);
        g.fill();
        g.strokeColor = new Color(180, 140, 60, 255); // 金色镶边
        g.lineWidth = 1.0;
        g.roundRect(-5, 0, 14, 10, 2);
        g.stroke();
    }

    /** 异步加载本马对应的高清展示画作贴图 */
    private tryLoadShowcaseTexture() {
        if (!this.profile) return;
        const resPath = this.profile.showcaseUrl;

        resources.load(resPath, Texture2D, (err, texture) => {
            if (err || !texture || !this.isValid || !this.spriteNode || !this.spriteNode.isValid) {
                // 若无打包进 resources 路径，则优雅保留细腻的 2D 写实矢量解剖体态
                return;
            }
            const sp = this.spriteNode.getComponent(Sprite) || this.spriteNode.addComponent(Sprite);
            sp.sizeMode = Sprite.SizeMode.CUSTOM;
            const sf = new SpriteFrame();
            sf.texture = texture;
            sp.spriteFrame = sf;
        });
    }

    /** 依毛色名称解析符合 18-20 世纪油画的基准色彩 */
    private getCoatBaseColor(): Color {
        const no = this.horseNo;
        switch (no) {
            case 1: return new Color(152, 54, 32, 255);   // 赤焰流星：深栗红
            case 2: return new Color(188, 196, 202, 255); // 翠风：浅银灰青
            case 3: return new Color(212, 172, 74, 255);  // 金色箭矢：金黄帕洛米诺
            case 4: return new Color(38, 38, 42, 255);     // 暗影猎手：煤黑
            case 5: return new Color(238, 240, 245, 255); // 银月：雪银白
            case 6: return new Color(92, 114, 138, 255);  // 蓝潮：石板蓝灰沙毛
            case 7: return new Color(125, 48, 85, 255);   // 紫电：深红紫栗
            case 8: return new Color(118, 75, 48, 255);   // 暴风疾行：经典红骝
            case 9: return new Color(74, 52, 42, 255);    // 惊雷破空：黑骝色
            case 10: return new Color(168, 42, 36, 255);  // 烈阳战将：红枣骝
            case 11: return new Color(175, 160, 115, 255);// 翡翠之梦：沙金青骝
            case 12: default: return new Color(85, 60, 48, 255); // 极光之星：深褐
        }
    }

    /** 获取鬃毛与马尾对比色彩 */
    private getManeColor(): Color {
        const coat = this.getCoatBaseColor();
        if (coat.r > 200 && coat.g > 200 && coat.b > 200) {
            return new Color(210, 215, 220, 255);
        }
        return new Color(Math.max(15, coat.r - 50), Math.max(15, coat.g - 50), Math.max(15, coat.b - 50), 255);
    }

    /** 切换动作状态 */
    public setAction(action: string, speedFactor: number = 1.0) {
        this.currentAction = action;
        this.speedFactor = Math.max(0.2, Math.min(3.0, Number(speedFactor) || 1.0));
        this.isRunning = (action === "Accelerate" || action === "Sprint" || action === "Gallop");
    }

    /** 物理逐帧更新：模拟 2D 骨骼起伏、拉伸与头部律动 (Gallop Galloping Simulation) */
    update(dt: number) {
        if (!this.horseBodyNode || !this.horseBodyNode.isValid) return;
        this.animTime += dt * this.speedFactor;

        if (this.isRunning) {
            // 疾驰袭步时的四拍上下起伏波（采用线性累加 phase 防超频抖动）
            const phase = this.animTime * 16.0;
            const bobY = Math.sin(phase) * 3.5;

            // 高速奔跑时身体向前的俯角 (Pitch Tilt)
            const tiltAngle = -4 + Math.sin(phase * 0.5) * 2.5;

            // 躯干拉伸与压缩 (Squash and Stretch)
            const stretchX = 1.0 + Math.sin(phase) * 0.08;
            const squashY = 1.0 - Math.sin(phase) * 0.06;

            this.horseBodyNode.setPosition(0, bobY, 0);
            this.horseBodyNode.setRotationFromEuler(0, 0, tiltAngle);
            this.horseBodyNode.setScale(stretchX, squashY, 1);
        } else {
            // 待机轻微呼吸
            const breatheY = Math.sin(this.animTime * 3.0) * 0.8;
            this.horseBodyNode.setPosition(0, breatheY, 0);
            this.horseBodyNode.setRotationFromEuler(0, 0, 0);
            this.horseBodyNode.setScale(1, 1, 1);
        }
    }
}

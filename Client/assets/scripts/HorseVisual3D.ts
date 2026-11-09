import {
    _decorator,
    Component,
    Node,
    MeshRenderer,
    Material,
    Color,
    Vec3,
    EventTouch,
    Layers,
    Mesh,
    RenderTexture,
    Sprite,
    SpriteFrame,
    Camera,
    director,
    UITransform,
    Texture2D,
} from "cc";
import { HorseEntity3D } from "./HorseEntity3D";

const { ccclass, property } = _decorator;

/**
 * 赛马真实 3D 展台呈现引擎 (HorseVisual3D)
 *
 * 采用原生 3D 高精解剖曲面、多层古典欧式圆形豪华旋转底座、超清离屏渲染通道与透视微距摄影机：
 * 1. 独立 3D 舞台渲染世界 (ShowcaseStage3D) + 黄金画幅摄影机 (Studio Showcase Camera)
 * 2. 多层典雅欧式圆形旋转展台 (外圈耀金黄铜台基 + 中层黑胡桃木台 + 顶层暗红丝绒圆形踏面与接触暗影)
 * 3. 完美画幅取景距离与零黑框透明 Alpha 缓冲通道，杜绝视口边缘穿模与黑边压扁
 * 4. 拟真物理转盘触控：水平拖拽自由 360° 检赏，支持惯性阻尼滑行与慢速匀速自转
 * 5. 挂载真实 3D 纯血马运动学解剖实体，支持 20 匹名驹配色与 8 大动作状态机即时演练
 */
@ccclass("HorseVisual3D")
export class HorseVisual3D extends Component {
    @property
    public horseNo: number = 1;

    // 独立 3D 舞台节点与组件
    private stageRoot: Node | null = null;
    private stageCamera: Camera | null = null;
    private turntableRoot: Node | null = null;
    private horseEntity: HorseEntity3D | null = null;

    // 离屏渲染目标与 UI Sprite
    private renderTexture: RenderTexture | null = null;
    private uiSprite: Sprite | null = null;

    // 交互与展台朝向 (初始侧迎面 -28° 黄金雕塑透视，充分展示马首、胸肌与流线侧身)
    private turntableAngleY: number = -28;
    private angularVelocity: number = 0;   // 旋转角速度 (度/秒，惯性平滑)
    private isAutoRotate: boolean = true;
    private idleTime: number = 0;
    private isDragging: boolean = false;
    private lastTouchX: number = 0;
    private displayScale: number = 0.82;

    // 动画状态
    private currentAction: string = "Stand";
    private animSpeed: number = 1.0;

    // 共享几何体网格 (圆形豪华底座)
    private static brassRimMesh: Mesh | null = null;
    private static woodRingMesh: Mesh | null = null;
    private static velvetTopMesh: Mesh | null = null;
    private static contactShadowMesh: Mesh | null = null;

    protected onLoad(): void {
        this.buildShowcaseStage();
        this.setupTouchListeners();
    }

    protected onEnable(): void {
        if (this.stageRoot && this.stageRoot.isValid) {
            this.stageRoot.active = true;
        }
        if (this.stageCamera && this.stageCamera.isValid) {
            this.stageCamera.enabled = true;
        }
    }

    protected onDisable(): void {
        if (this.stageRoot && this.stageRoot.isValid) {
            this.stageRoot.active = false;
        }
        if (this.stageCamera && this.stageCamera.isValid) {
            this.stageCamera.enabled = false;
        }
    }

    protected onDestroy(): void {
        if (this.stageRoot && this.stageRoot.isValid) {
            this.stageRoot.destroy();
            this.stageRoot = null;
        }
        if (this.renderTexture && this.renderTexture.isValid) {
            this.renderTexture.destroy();
            this.renderTexture = null;
        }
    }

    private buildShowcaseStage(): void {
        const scene = director.getScene();
        if (!scene) return;

        // 1. 创建独立 3D 世界舞台根节点 (置于独立空间 600, 300, 600)
        const stageNode = new Node(`ShowcaseStage3D_${this.node.uuid || Math.random()}`);
        stageNode.layer = Layers.Enum.DEFAULT;
        scene.addChild(stageNode);
        stageNode.setPosition(600, 300, 600);
        this.stageRoot = stageNode;

        // 2. 动态根据宿主节点视口尺寸分配超清抗锯齿 RenderTexture (杜绝拉伸畸变)
        const trans = this.node.getComponent(UITransform);
        const nodeW = trans && trans.width > 0 ? trans.width : 600;
        const nodeH = trans && trans.height > 0 ? trans.height : 240;
        const rtW = Math.round(nodeW * 2.0);
        const rtH = Math.round(nodeH * 2.0);

        const rt = new RenderTexture();
        rt.reset({ width: rtW, height: rtH });
        rt.setFilters(Texture2D.Filter.LINEAR, Texture2D.Filter.LINEAR);
        rt.setWrapMode(Texture2D.WrapMode.CLAMP_TO_EDGE, Texture2D.WrapMode.CLAMP_TO_EDGE);
        this.renderTexture = rt;

        // 3. 舞台专属透视摄影机 (精准微距景深 5.4m, FOV 27°, 纵深黄金微俯角 1.36m -> 0.78m)
        const camNode = new Node("StageCamera");
        camNode.layer = Layers.Enum.DEFAULT;
        stageNode.addChild(camNode);
        camNode.setPosition(0, 1.25, 5.6);
        const stagePos = stageNode.position;
        const targetWorld = new Vec3(stagePos.x, stagePos.y + 0.72, stagePos.z);
        camNode.lookAt(targetWorld);

        const cam = camNode.addComponent(Camera);
        cam.projection = Camera.ProjectionType.PERSPECTIVE;
        cam.fov = 28;
        cam.priority = 25;
        cam.visibility = Layers.Enum.DEFAULT;
        cam.clearFlags = Camera.ClearFlag.SOLID_COLOR;
        // 关键：清除为完全透明 (Alpha 0)，使 3D 展台无缝融合于 2D 弹窗与木纹背景
        cam.clearColor = new Color(0, 0, 0, 0);
        cam.targetTexture = rt;
        this.stageCamera = cam;

        // 4. 3D 多层古典圆形西洋旋转展台 (Multi-Tier Classical Circular Turntable: 48 边圆滑几何)
        if (!HorseVisual3D.brassRimMesh) {
            // 黄铜外底座 (外扩微倒角圆柱体)
            HorseVisual3D.brassRimMesh = HorseEntity3D.getCylinderMesh(2.28, 2.38, 0.08, 48, true, true, true);
        }
        if (!HorseVisual3D.woodRingMesh) {
            // 黑胡桃木中层台面
            HorseVisual3D.woodRingMesh = HorseEntity3D.getCylinderMesh(2.10, 2.18, 0.08, 48, true, true);
        }
        if (!HorseVisual3D.velvetTopMesh) {
            // 暗红丝绒圆形踏面
            HorseVisual3D.velvetTopMesh = HorseEntity3D.getCylinderMesh(1.92, 1.95, 0.06, 48, true, true);
        }
        if (!HorseVisual3D.contactShadowMesh) {
            // 蹄底软接触阴影面片
            HorseVisual3D.contactShadowMesh = HorseEntity3D.getCylinderMesh(1.45, 1.45, 0.002, 36, true, true);
        }

        this.turntableRoot = new Node("Turntable3DRoot");
        this.turntableRoot.layer = Layers.Enum.DEFAULT;
        stageNode.addChild(this.turntableRoot);
        this.turntableRoot.setPosition(0, 0, 0);

        // 4A. 外层黄铜光泽底座 (Brass Outer Pedestal, Y=-0.14)
        const rimNode = new Node("TurntableBrassRim");
        rimNode.layer = Layers.Enum.DEFAULT;
        this.turntableRoot.addChild(rimNode);
        rimNode.setPosition(0, -0.14, 0);
        const mrRim = rimNode.addComponent(MeshRenderer);
        mrRim.mesh = HorseVisual3D.brassRimMesh;
        mrRim.material = HorseEntity3D.getMaterial(new Color(224, 182, 72, 255));

        // 4B. 中层深色黑胡桃木台 (Walnut Wood Ring, Y=-0.07)
        const woodNode = new Node("TurntableWoodRing");
        woodNode.layer = Layers.Enum.DEFAULT;
        this.turntableRoot.addChild(woodNode);
        woodNode.setPosition(0, -0.07, 0);
        const mrWood = woodNode.addComponent(MeshRenderer);
        mrWood.mesh = HorseVisual3D.woodRingMesh;
        mrWood.material = HorseEntity3D.getMaterial(new Color(52, 32, 18, 255));

        // 4C. 顶层暗红丝绒圆形踏面 (Crimson Velvet Surface, Y=-0.03，顶面严格平齐 Y=0.00)
        const velvetNode = new Node("TurntableVelvetTop");
        velvetNode.layer = Layers.Enum.DEFAULT;
        this.turntableRoot.addChild(velvetNode);
        velvetNode.setPosition(0, -0.03, 0);
        const mrVelvet = velvetNode.addComponent(MeshRenderer);
        mrVelvet.mesh = HorseVisual3D.velvetTopMesh;
        mrVelvet.material = HorseEntity3D.getMaterial(new Color(138, 26, 34, 255));

        // 4D. 马蹄接触暗影面 (Soft Ambient Contact Shadow, Y=0.002)
        const shadowNode = new Node("TurntableContactShadow");
        shadowNode.layer = Layers.Enum.DEFAULT;
        this.turntableRoot.addChild(shadowNode);
        shadowNode.setPosition(0, 0.002, 0);
        shadowNode.setScale(1.15, 1.0, 0.55);
        const mrShadow = shadowNode.addComponent(MeshRenderer);
        mrShadow.mesh = HorseVisual3D.contactShadowMesh;
        mrShadow.material = HorseEntity3D.getMaterial(new Color(25, 8, 12, 180));

        // 5. 挂载真实 3D 纯血赛马解剖动力学实体
        const horseNode = new Node("ShowcaseHorseEntity3D");
        horseNode.layer = Layers.Enum.DEFAULT;
        this.turntableRoot.addChild(horseNode);
        horseNode.setPosition(0, 0, 0);

        this.horseEntity = horseNode.addComponent(HorseEntity3D);
        this.horseEntity.showJockey = false; // 展台模式纯赏名驹，隐蔽骑师
        this.horseEntity.setTemplateId(this.horseNo);
        this.horseEntity.setHorseNo(this.horseNo);
        this.horseEntity.setAction(this.currentAction, this.animSpeed);

        this.applyScaleAndRotation();

        // 6. 将 RenderTexture 绑定至当前 2D UI 节点的 Sprite 组件
        let sprite = this.node.getComponent(Sprite);
        if (!sprite) {
            sprite = this.node.addComponent(Sprite);
        }
        sprite.sizeMode = Sprite.SizeMode.CUSTOM;
        const sf = new SpriteFrame();
        sf.texture = rt;
        sprite.spriteFrame = sf;
        this.uiSprite = sprite;

        // 保持 2D UI 节点精确尺寸
        const hostTrans = this.node.getComponent(UITransform);
        if (hostTrans) {
            hostTrans.setContentSize(nodeW, nodeH);
        }
    }

    public setHorseNo(no: number): void {
        this.horseNo = Math.max(1, Math.min(20, no));
        if (this.horseEntity && this.horseEntity.isValid) {
            this.horseEntity.setTemplateId(this.horseNo);
            this.horseEntity.setHorseNo(this.horseNo);
        }
    }

    public setAction(action: string, speed = 1.0): void {
        this.currentAction = action;
        this.animSpeed = speed;
        if (this.horseEntity && this.horseEntity.isValid) {
            this.horseEntity.setAction(action, speed);
        }
    }

    public setTurntableAngle(deg: number): void {
        this.turntableAngleY = deg;
        this.angularVelocity = 0;
        this.applyScaleAndRotation();
    }

    public getTurntableAngle(): number {
        return this.turntableAngleY;
    }

    public setAutoRotate(enable: boolean): void {
        this.isAutoRotate = enable;
    }

    public setDisplayScale(scale: number): void {
        this.displayScale = scale;
        this.applyScaleAndRotation();
    }

    private applyScaleAndRotation(): void {
        if (!this.turntableRoot || !this.turntableRoot.isValid) return;
        this.turntableRoot.setScale(this.displayScale, this.displayScale, this.displayScale);
        this.turntableRoot.setRotationFromEuler(0, this.turntableAngleY, 0);
    }

    private setupTouchListeners(): void {
        const target = this.node;
        target.on(Node.EventType.TOUCH_START, (e: EventTouch) => {
            this.isDragging = true;
            this.angularVelocity = 0;
            this.lastTouchX = e.getUILocation().x;
        }, this);

        target.on(Node.EventType.TOUCH_MOVE, (e: EventTouch) => {
            if (!this.isDragging) return;
            const curX = e.getUILocation().x;
            const deltaX = curX - this.lastTouchX;
            this.lastTouchX = curX;
            this.turntableAngleY += deltaX * 0.70;
            this.angularVelocity = deltaX * 32.0; // 记录松手惯性角动量
            this.applyScaleAndRotation();
        }, this);

        target.on(Node.EventType.TOUCH_END, () => {
            this.isDragging = false;
        }, this);
        target.on(Node.EventType.TOUCH_CANCEL, () => {
            this.isDragging = false;
        }, this);
    }

    protected update(dt: number): void {
        if (this.isDragging) return;

        // 惯性平滑阻尼滑行
        if (Math.abs(this.angularVelocity) > 1.0) {
            this.turntableAngleY += this.angularVelocity * dt;
            const decay = Math.pow(0.15, dt);
            this.angularVelocity *= decay;
            this.applyScaleAndRotation();
        } else if (this.isAutoRotate) {
            // 黄金视角呼吸感微幅慢摆 (-28° ± 6°)，始终保证马首向阳朝前迎客
            this.idleTime += dt * 0.45;
            this.turntableAngleY = -28.0 + Math.sin(this.idleTime) * 6.0;
            this.applyScaleAndRotation();
        }
    }
}

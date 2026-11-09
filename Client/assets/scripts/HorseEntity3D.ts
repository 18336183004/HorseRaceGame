import {
    _decorator,
    Component,
    Node,
    MeshRenderer,
    utils,
    Material,
    Color,
    Vec3,
    Layers,
    Mesh,
} from "cc";

const { ccclass, property } = _decorator;

export interface Horse3DColorPalette {
    coat: Color;          // 被毛主色 (Body coat)
    secondary: Color;     // 吻部/腹底柔和过渡色 (Muzzle / belly shade)
    mane: Color;          // 鬃毛与马尾毛色 (Mane & tail)
    hoof: Color;          // 马蹄角质色 (Hoof keratin)
    silk: Color;          // 骑师彩衣主色 (Jockey silks)
    silkCap: Color;       // 骑师头盔/帽子辅色 (Jockey helmet cap)
    socksWhite?: boolean; // 是否拥有白袜四蹄 (White stockings on legs)
    starWhite?: boolean;  // 是否拥有白额流星斑 (White forehead star)
}

/**
 * 真实纯血赛马 3D 高精解剖曲面动力学实体 (HorseEntity3D)
 *
 * 严格按照 18~20 世纪古典纯血赛马 (Thoroughbred) 标准骨骼解剖体型比例建模：
 * 1. 解剖级流线躯干 (Deep Girth Torso)：深邃胸深、高耸鬐甲、流线背脊、腰腹紧凑收束、饱满后臀
 * 2. 雕塑感马首 (Sculpted Equine Head)：宽额骨、丰满咬肌下颌、高挺鼻梁、细腻柔和吻部、鼻孔与灵动侧目
 * 3. 优雅拱颈 (Arched Crested Neck)：自鬐甲自然斜挑而起，颈背拱脊饱满，喉下收敛
 * 4. 真实四肢关节骨骼 (Anatomical Equine Limbs)：
 *    - 前肢：斜肩、圆润前臂、平滑腕膝、纤细管骨、球节、倾斜系部与微外撇马蹄
 *    - 后肢：饱满大腿股肌、后弯飞节 (Hock with calcaneus)、笔直管骨与四蹄自然接地
 * 5. 飘逸多层立体鬃毛 (Layered Flowing Mane) 与 丰满流线马尾 (Curved Plumed Tail)
 * 6. 零悬空高精度接地：四蹄平稳踏立于展台垫面，杜绝漂浮与穿模
 * 7. 多角度演播室定向光影 (Studio Sunlight, Ambient Occlusion & Specular Fresnel)
 * 8. 真实步态物理动力学 (Stand 典雅昂立, Gallop 极速飞驰, Rear 昂首起扬, Graze 低头吃草, Trot 轻快小跑)
 */
@ccclass("HorseEntity3D")
export class HorseEntity3D extends Component {
    @property
    public horseNo: number = 1;

    @property
    public templateId: number = 1;

    @property
    public laneNo: number = 1;

    @property
    public showJockey: boolean = false; // 展台模式默认纯展示名驹，无骑手遮挡

    // 核心骨骼节点
    private bodyRoot: Node | null = null;
    private torsoNode: Node | null = null;
    private neckNode: Node | null = null;
    private headNode: Node | null = null;
    private maneRootNode: Node | null = null;
    private tailJointNode: Node | null = null;
    private tailHairNode: Node | null = null;
    private saddleClothNode: Node | null = null;
    private saddleClothNodeL: Node | null = null;
    private saddleClothNodeR: Node | null = null;
    private saddleDigitNodeL: Node | null = null;
    private saddleDigitNodeR: Node | null = null;
    private saddleNode: Node | null = null;
    private girthNode: Node | null = null;
    private bridleNode: Node | null = null;
    private bitRingLNode: Node | null = null;
    private bitRingRNode: Node | null = null;
    private reinsL: Node | null = null;
    private reinsR: Node | null = null;
    private stirrupLNode: Node | null = null;
    private stirrupRNode: Node | null = null;
    private jockeyNode: Node | null = null;
    private jockeyTorsoNode: Node | null = null;
    private jockeyHeadNode: Node | null = null;
    private jockeyCap: Node | null = null;
    private jockeyGoggles: Node | null = null;
    private jockeyArmL: Node | null = null;
    private jockeyArmR: Node | null = null;
    private jockeyLegL: Node | null = null;
    private jockeyLegR: Node | null = null;
    private jockeyWhipNode: Node | null = null;
    private groundShadowNode: Node | null = null;
    private targetMarkerNode: Node | null = null;
    private isBetTarget: boolean = false;

    // 前肢骨骼
    private frontLeftUpper: Node | null = null;
    private frontLeftLower: Node | null = null;
    private frontRightUpper: Node | null = null;
    private frontRightLower: Node | null = null;

    // 后肢骨骼
    private backLeftUpper: Node | null = null;
    private backLeftLower: Node | null = null;
    private backRightUpper: Node | null = null;
    private backRightLower: Node | null = null;

    // 步态动力学状态
    private currentAction: string = "Stand";
    private animTime: number = 0;
    private animSpeed: number = 1.0;
    private isSprinting: boolean = false;

    // 马蹄沙尘粒子系统
    private dustParticles: Array<{ node: Node; life: number; maxLife: number; velocity: Vec3 }> = [];
    private dustRoot: Node | null = null;
    private nextDustTime: number = 0;

    // 共享几何体资产与材质缓存
    private static meshCache: Map<string, Mesh> = new Map();
    private static materialCache: Map<string, Material> = new Map();
    private static dustMaterialCache: Material | null = null;

    // 演播室主光源方向 (斜前方 45° 金色阳光)
    private static readonly KEY_SUN = new Vec3(0.55, 0.76, 0.34).normalize();
    // 摄像机视线方向 (供菲涅尔轮廓高光计算)
    private static readonly VIEW_DIR = new Vec3(0.0, 0.20, 0.98).normalize();

    // =========================================================================
    // 材质与光照烘焙引擎
    // =========================================================================

    /** 获取或创建顶点色定向光影材质 */
    public static getMaterial(color: Color): Material {
        const key = `${color.r}_${color.g}_${color.b}_${color.a}`;
        let mat = HorseEntity3D.materialCache.get(key);
        if (!mat || !mat.isValid) {
            mat = new Material();
            mat.initialize({
                effectName: "builtin-unlit",
                defines: {
                    USE_VERTEX_COLOR: true,
                },
                states: {}
            });
            mat.setProperty("mainColor", color);
            HorseEntity3D.materialCache.set(key, mat);
        }
        return mat;
    }

    /** 计算平滑漫反射 + 半球环境光 + 菲涅尔轮廓光 + 柔和高光 */
    public static computeVertexShade(normalX: number, normalY: number, normalZ: number, isMetallic = false): number {
        // 主阳光漫反射 (Key Sunlight)
        const dotSun = normalX * HorseEntity3D.KEY_SUN.x + normalY * HorseEntity3D.KEY_SUN.y + normalZ * HorseEntity3D.KEY_SUN.z;
        const diffuse = Math.max(0, dotSun) * 0.58;

        // 天空柔和半球环境光 (Sky Ambient)
        const skyAmbient = 0.44 + 0.16 * Math.max(0, normalY);
        // 地面漫反射微弱反弹 (Ground Bounce)
        const groundBounce = 0.08 * Math.max(0, -normalY);

        // 菲涅尔轮廓边缘光 (Fresnel Rim: 凸显马身健美肌肉线条与毛皮光泽)
        const dotView = Math.max(0, normalX * HorseEntity3D.VIEW_DIR.x + normalY * HorseEntity3D.VIEW_DIR.y + normalZ * HorseEntity3D.VIEW_DIR.z);
        const rim = Math.pow(1.0 - Math.min(1.0, dotView), 2.2) * 0.32;

        // 镜面丝滑高光 (Blinn-Phong Specular: 赛马油亮皮毛质感)
        const halfX = (HorseEntity3D.KEY_SUN.x + HorseEntity3D.VIEW_DIR.x) * 0.5;
        const halfY = (HorseEntity3D.KEY_SUN.y + HorseEntity3D.VIEW_DIR.y) * 0.5;
        const halfZ = (HorseEntity3D.KEY_SUN.z + HorseEntity3D.VIEW_DIR.z) * 0.5;
        const halfLen = Math.sqrt(halfX * halfX + halfY * halfY + halfZ * halfZ) || 1.0;
        const dotHalf = Math.max(0, (normalX * halfX + normalY * halfY + normalZ * halfZ) / halfLen);
        const spec = Math.pow(dotHalf, isMetallic ? 28 : 14) * (isMetallic ? 0.45 : 0.24);

        const total = skyAmbient + groundBounce + diffuse + rim + spec;
        return Math.max(0.36, Math.min(1.30, total));
    }

    // =========================================================================
    // 解剖学曲面放样几何生成器
    // =========================================================================

    /**
     * 高精度沿 X 轴截面放样平滑网格生成器
     * 支持非对称马体截面形状、双向平滑圆顶封口与法线连续插值
     */
    public static buildLoftMesh(
        sections: Array<{
            x: number;
            y: number;
            ry: number;
            rz: number;
            yTopBias?: number; // 顶部背脊/鬐甲突起微调
            yBotBias?: number; // 腹部/深胸胸骨微调
        }>,
        segs = 24,
        closeFront = true,
        closeBack = true,
        frontExtend = 0.08,
        backExtend = 0.08
    ): Mesh {
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const nRings = sections.length;
        if (nRings < 2) {
            return utils.MeshUtils.createMesh({ positions, normals, colors, indices });
        }

        // 1. 生成所有截面圆环顶点 (C1 连续埃尔米特平滑曲率插值，彻底消除侧腹折痕)
        for (let r = 0; r < nRings; r++) {
            const sec = sections[r];
            const topBias = sec.yTopBias || 0;
            const botBias = sec.yBotBias || 0;

            for (let i = 0; i < segs; i++) {
                const theta = (2.0 * Math.PI * i) / segs;
                const cosT = Math.cos(theta);
                const sinT = Math.sin(theta);

                // 解剖学平滑连续背脊与深胸过渡
                const t = (cosT + 1.0) * 0.5; // 0 (腹底) ~ 1 (背脊)
                const smoothT = t * t * (3.0 - 2.0 * t);
                const bias = botBias + (topBias - botBias) * smoothT;
                const radY = sec.ry + bias;

                const vy = sec.y + radY * cosT;
                const vz = sec.rz * sinT;
                positions.push(sec.x, vy, vz);
            }
        }

        // 2. 生成相邻截面间的四边形 (双三角形，严格保证法线朝外)
        const isXDecreasing = sections[0].x > sections[nRings - 1].x;

        for (let r = 0; r < nRings - 1; r++) {
            for (let i = 0; i < segs; i++) {
                const nextI = (i + 1) % segs;
                const v0 = r * segs + i;
                const v1 = r * segs + nextI;
                const v2 = (r + 1) * segs + nextI;
                const v3 = (r + 1) * segs + i;

                if (isXDecreasing) {
                    indices.push(v0, v2, v1, v0, v3, v2);
                } else {
                    indices.push(v0, v1, v2, v0, v2, v3);
                }
            }
        }

        // 3. 前端封口 (Front Dome)
        let frontApexIdx = -1;
        if (closeFront) {
            frontApexIdx = positions.length / 3;
            const sec0 = sections[0];
            const dx = isXDecreasing ? frontExtend : -frontExtend;
            positions.push(sec0.x + dx, sec0.y, 0);

            for (let i = 0; i < segs; i++) {
                const nextI = (i + 1) % segs;
                if (isXDecreasing) {
                    indices.push(frontApexIdx, i, nextI);
                } else {
                    indices.push(frontApexIdx, nextI, i);
                }
            }
        }

        // 4. 后端封口 (Rear Dome)
        let backApexIdx = -1;
        if (closeBack) {
            backApexIdx = positions.length / 3;
            const secLast = sections[nRings - 1];
            const dx = isXDecreasing ? -backExtend : backExtend;
            positions.push(secLast.x + dx, secLast.y, 0);
            const lastBase = (nRings - 1) * segs;

            for (let i = 0; i < segs; i++) {
                const nextI = (i + 1) % segs;
                if (isXDecreasing) {
                    indices.push(backApexIdx, lastBase + nextI, lastBase + i);
                } else {
                    indices.push(backApexIdx, lastBase + i, lastBase + nextI);
                }
            }
        }

        // 5. 精确三角形面积累积平滑法线
        const nVerts = positions.length / 3;
        const normAccum: number[][] = [];
        for (let v = 0; v < nVerts; v++) normAccum.push([0, 0, 0]);

        for (let t = 0; t < indices.length; t += 3) {
            const i0 = indices[t], i1 = indices[t + 1], i2 = indices[t + 2];
            const p0x = positions[i0 * 3], p0y = positions[i0 * 3 + 1], p0z = positions[i0 * 3 + 2];
            const p1x = positions[i1 * 3], p1y = positions[i1 * 3 + 1], p1z = positions[i1 * 3 + 2];
            const p2x = positions[i2 * 3], p2y = positions[i2 * 3 + 1], p2z = positions[i2 * 3 + 2];

            const ax = p1x - p0x, ay = p1y - p0y, az = p1z - p0z;
            const bx = p2x - p0x, by = p2y - p0y, bz = p2z - p0z;

            let nx = ay * bz - az * by;
            let ny = az * bx - ax * bz;
            let nz = ax * by - ay * bx;

            const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
            if (len > 1e-6) {
                nx /= len; ny /= len; nz /= len;
                normAccum[i0][0] += nx; normAccum[i0][1] += ny; normAccum[i0][2] += nz;
                normAccum[i1][0] += nx; normAccum[i1][1] += ny; normAccum[i1][2] += nz;
                normAccum[i2][0] += nx; normAccum[i2][1] += ny; normAccum[i2][2] += nz;
            }
        }

        // 6. 生成最终平滑法线与光影色彩
        for (let v = 0; v < nVerts; v++) {
            const n = normAccum[v];
            let len = Math.sqrt(n[0] * n[0] + n[1] * n[1] + n[2] * n[2]);
            if (len < 1e-6) len = 1.0;
            const nx = n[0] / len, ny = n[1] / len, nz = n[2] / len;
            normals.push(nx, ny, nz);

            const shade = HorseEntity3D.computeVertexShade(nx, ny, nz);
            colors.push(shade, shade, shade, 1.0);
        }

        return utils.MeshUtils.createMesh({ positions, normals, colors, indices });
    }

    /**
     * 高精度圆台/圆柱体网格生成器 (带平滑侧壁与双封顶，供马腿关节、马蹄与展台使用)
     */
    public static getCylinderMesh(
        rTop: number,
        rBot: number,
        height: number,
        segs = 24,
        withTopCap = true,
        withBotCap = true,
        isMetallic = false
    ): Mesh {
        const key = `cyl_${rTop.toFixed(3)}_${rBot.toFixed(3)}_${height.toFixed(3)}_${segs}_${withTopCap}_${withBotCap}_${isMetallic}`;
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const halfH = height / 2.0;
        const slope = (rBot - rTop) / height;

        // 1. 侧壁顶点
        const sideStart = 0;
        for (let i = 0; i < segs; i++) {
            const theta = (2.0 * Math.PI * i) / segs;
            const cosT = Math.cos(theta), sinT = Math.sin(theta);

            let nx = cosT, ny = slope, nz = sinT;
            const nLen = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
            nx /= nLen; ny /= nLen; nz /= nLen;
            const shade = HorseEntity3D.computeVertexShade(nx, ny, nz, isMetallic);

            // 顶环
            positions.push(rTop * cosT, halfH, rTop * sinT);
            normals.push(nx, ny, nz);
            colors.push(shade, shade, shade, 1.0);

            // 底环
            positions.push(rBot * cosT, -halfH, rBot * sinT);
            normals.push(nx, ny, nz);
            colors.push(shade, shade, shade, 1.0);
        }

        // 侧壁三角形
        for (let i = 0; i < segs; i++) {
            const nextI = (i + 1) % segs;
            const t0 = sideStart + i * 2;
            const b0 = sideStart + i * 2 + 1;
            const t1 = sideStart + nextI * 2;
            const b1 = sideStart + nextI * 2 + 1;
            indices.push(t0, b1, t1, t0, b0, b1);
        }

        // 2. 顶盖
        if (withTopCap) {
            const topCenterIdx = positions.length / 3;
            positions.push(0, halfH, 0);
            normals.push(0, 1, 0);
            const topShade = HorseEntity3D.computeVertexShade(0, 1, 0, isMetallic);
            colors.push(topShade, topShade, topShade, 1.0);

            const capStart = positions.length / 3;
            for (let i = 0; i < segs; i++) {
                const theta = (2.0 * Math.PI * i) / segs;
                positions.push(rTop * Math.cos(theta), halfH, rTop * Math.sin(theta));
                normals.push(0, 1, 0);
                colors.push(topShade, topShade, topShade, 1.0);
            }

            for (let i = 0; i < segs; i++) {
                const nextI = (i + 1) % segs;
                indices.push(topCenterIdx, capStart + i, capStart + nextI);
            }
        }

        // 3. 底盖
        if (withBotCap) {
            const botCenterIdx = positions.length / 3;
            positions.push(0, -halfH, 0);
            normals.push(0, -1, 0);
            const botShade = HorseEntity3D.computeVertexShade(0, -1, 0, isMetallic);
            colors.push(botShade, botShade, botShade, 1.0);

            const capStart = positions.length / 3;
            for (let i = 0; i < segs; i++) {
                const theta = (2.0 * Math.PI * i) / segs;
                positions.push(rBot * Math.cos(theta), -halfH, rBot * Math.sin(theta));
                normals.push(0, -1, 0);
                colors.push(botShade, botShade, botShade, 1.0);
            }

            for (let i = 0; i < segs; i++) {
                const nextI = (i + 1) % segs;
                indices.push(botCenterIdx, capStart + nextI, capStart + i);
            }
        }

        mesh = utils.MeshUtils.createMesh({ positions, normals, colors, indices });
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    /** 生成平滑椭球体网格 (用于关节、眼眸、马耳基部) */
    public static getEllipsoidMesh(rx: number, ry: number, rz: number, rings = 10, segs = 14): Mesh {
        const key = `ellip_${rx.toFixed(3)}_${ry.toFixed(3)}_${rz.toFixed(3)}_${rings}_${segs}`;
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        // 北极点
        positions.push(0, ry, 0);
        normals.push(0, 1, 0);
        const topShade = HorseEntity3D.computeVertexShade(0, 1, 0);
        colors.push(topShade, topShade, topShade, 1.0);

        // 中间环
        for (let r = 1; r < rings; r++) {
            const phi = (Math.PI * r) / rings;
            const cosPhi = Math.cos(phi), sinPhi = Math.sin(phi);
            const py = ry * cosPhi;

            for (let i = 0; i < segs; i++) {
                const theta = (2.0 * Math.PI * i) / segs;
                const cosTheta = Math.cos(theta), sinTheta = Math.sin(theta);
                const px = rx * sinPhi * cosTheta;
                const pz = rz * sinPhi * sinTheta;

                let nx = px / (rx * rx), ny = py / (ry * ry), nz = pz / (rz * rz);
                const len = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
                nx /= len; ny /= len; nz /= len;

                positions.push(px, py, pz);
                normals.push(nx, ny, nz);
                const shade = HorseEntity3D.computeVertexShade(nx, ny, nz);
                colors.push(shade, shade, shade, 1.0);
            }
        }

        // 南极点
        const botIdx = positions.length / 3;
        positions.push(0, -ry, 0);
        normals.push(0, -1, 0);
        const botShade = HorseEntity3D.computeVertexShade(0, -1, 0);
        colors.push(botShade, botShade, botShade, 1.0);

        // 北极扇区
        for (let i = 0; i < segs; i++) {
            const nextI = (i + 1) % segs;
            indices.push(0, 1 + i, 1 + nextI);
        }

        // 体环四边形
        for (let r = 0; r < rings - 2; r++) {
            const r0 = 1 + r * segs;
            const r1 = 1 + (r + 1) * segs;
            for (let i = 0; i < segs; i++) {
                const nextI = (i + 1) % segs;
                indices.push(r0 + i, r1 + i, r1 + nextI, r0 + i, r1 + nextI, r0 + nextI);
            }
        }

        // 南极扇区
        const lastRing = 1 + (rings - 2) * segs;
        for (let i = 0; i < segs; i++) {
            const nextI = (i + 1) % segs;
            indices.push(botIdx, lastRing + nextI, lastRing + i);
        }

        mesh = utils.MeshUtils.createMesh({ positions, normals, colors, indices });
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    /** 警觉马耳 3D 贝壳造型网格 (带内凹耳蜗与尖端倾角) */
    /** 贵族纯血马警觉双耳 3D 贝壳造型网格 (比例精巧，内凹耳蜗与向前微挑) */
    public static getEarMesh(): Mesh {
        const key = "horse_sculpted_ear_v5";
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        const positions: number[] = [
            // 尖端 Tip (13cm 纯血马精致秀美比例)
            0.010, 0.130, 0.000,
            // 外侧缘 Outer
            0.015, 0.065, 0.038,
            // 内侧缘 Inner
            0.015, 0.065, -0.038,
            // 基部前中 Base Front
            0.028, 0.000, 0.000,
            // 基部后凹槽 Base Back (凸壳)
            -0.024, 0.012, 0.000,
            // 耳窝凹槽中心 (Concave trough)
            0.012, 0.052, 0.000
        ];

        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [
            0, 1, 5,   // 前外瓣
            0, 5, 2,   // 前内瓣
            1, 3, 5,   // 前下外
            5, 3, 2,   // 前下内
            0, 4, 1,   // 后外凸壳
            0, 2, 4,   // 后内凸壳
            1, 4, 3,   // 侧底封
            2, 3, 4    // 侧底封
        ];

        for (let i = 0; i < positions.length; i += 3) {
            let nx = positions[i] + 0.03;
            let ny = 0.40;
            let nz = positions[i + 2];
            const l = Math.sqrt(nx * nx + ny * ny + nz * nz) || 1.0;
            nx /= l; ny /= l; nz /= l;
            normals.push(nx, ny, nz);
            const shade = HorseEntity3D.computeVertexShade(nx, ny, nz);
            colors.push(shade, shade, shade, 1.0);
        }

        mesh = utils.MeshUtils.createMesh({ positions, normals, colors, indices });
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    /** 雕塑级顺滑贴颈鬃毛网格 (Sculpted Contoured Flowing Mane) */
    public static getSculptedManeMesh(): Mesh {
        const key = "horse_sculpted_mane_v6";
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        // 沿颈背高耸拱脊分布，精准骑跨于颈项上表面 (Y=0.30 ~ 0.57)，并向右侧 (+Z) 飘逸侧倾
        const sections = [
            // 颈根鬐甲处 (Near withers)
            { x: -0.05, y: 0.30, ry: 0.065, rz: 0.045, yTopBias: 0.03 },
            { x: 0.12, y: 0.42, ry: 0.080, rz: 0.052, yTopBias: 0.04 },
            // 颈弓中峰 (Mid crest)
            { x: 0.32, y: 0.52, ry: 0.090, rz: 0.058, yTopBias: 0.04 },
            { x: 0.52, y: 0.57, ry: 0.085, rz: 0.055, yTopBias: 0.03 },
            // 枕骨近耳处 (Near poll)
            { x: 0.70, y: 0.57, ry: 0.070, rz: 0.045, yTopBias: 0.02 },
            { x: 0.80, y: 0.55, ry: 0.050, rz: 0.035, yTopBias: 0.01 }
        ];

        mesh = HorseEntity3D.buildLoftMesh(sections, 16, true, true, 0.04, 0.04);
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    /** 传统鬃毛块兼容方法 */
    public static getManeTuftMesh(length: number, height: number, depth: number): Mesh {
        return HorseEntity3D.getSculptedManeMesh();
    }

    /** 丰满流线马尾毛羽网格 (Curved Plumed Tail: 贴身垂落至飞节下方) */
    public static getTailPlumeMesh(): Mesh {
        const key = "horse_tail_plume_v5";
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        // 严格遵循重力垂落流线，向后仅微挑 10cm，垂直优雅瀑布下垂
        const sections = [
            // 尾根 (Dock)
            { x: 0.00, y: 0.00, ry: 0.07, rz: 0.06 },
            // 尾弓微挑 (Arch Crest)
            { x: -0.05, y: -0.06, ry: 0.09, rz: 0.07 },
            // 上段丰满羽簇
            { x: -0.08, y: -0.18, ry: 0.12, rz: 0.10 },
            // 中段饱满主尾束 (Mid volume)
            { x: -0.10, y: -0.38, ry: 0.14, rz: 0.11 },
            // 中下段自然垂流
            { x: -0.08, y: -0.60, ry: 0.12, rz: 0.09 },
            // 尾稍收束
            { x: -0.06, y: -0.78, ry: 0.08, rz: 0.06 },
            // 尾尖 (末端在飞节下方)
            { x: -0.03, y: -0.92, ry: 0.04, rz: 0.03 }
        ];

        mesh = HorseEntity3D.buildLoftMesh(sections, 16, true, true, 0.05, 0.06);
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    /** 传统六面体网格 (供 RaceTrack3D 跑道设施兼容调用) */
    public static getShadedBoxMesh(sx: number, sy: number, sz: number): Mesh {
        const key = `box_${sx.toFixed(2)}_${sy.toFixed(2)}_${sz.toFixed(2)}`;
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        const hx = sx / 2, hy = sy / 2, hz = sz / 2;
        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const addFace = (p0: number[], p1: number[], p2: number[], p3: number[], nx: number, ny: number, nz: number) => {
            const start = positions.length / 3;
            positions.push(...p0, ...p1, ...p2, ...p3);
            normals.push(nx, ny, nz, nx, ny, nz, nx, ny, nz, nx, ny, nz);
            const shade = HorseEntity3D.computeVertexShade(nx, ny, nz);
            for (let i = 0; i < 4; i++) {
                colors.push(shade, shade, shade, 1.0);
            }
            indices.push(start, start + 1, start + 2, start, start + 2, start + 3);
        };

        addFace([-hx, hy, -hz], [hx, hy, -hz], [hx, hy, hz], [-hx, hy, hz], 0, 1, 0);
        addFace([-hx, -hy, hz], [hx, -hy, hz], [hx, -hy, -hz], [-hx, -hy, -hz], 0, -1, 0);
        addFace([hx, -hy, hz], [hx, hy, hz], [hx, hy, -hz], [hx, -hy, -hz], 1, 0, 0);
        addFace([-hx, -hy, -hz], [-hx, hy, -hz], [-hx, hy, hz], [-hx, -hy, hz], -1, 0, 0);
        addFace([-hx, -hy, hz], [-hx, hy, hz], [hx, hy, hz], [hx, -hy, hz], 0, 0, 1);
        addFace([hx, -hy, -hz], [hx, hy, -hz], [-hx, hy, -hz], [-hx, -hy, -hz], 0, 0, -1);

        mesh = utils.MeshUtils.createMesh({ positions, normals, colors, indices });
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    /** 梯形渐缩多面体 (保留接口兼容) */
    public static getTaperedMesh(
        backW: number, backH: number,
        frontW: number, frontH: number,
        length: number,
        offsetY = 0
    ): Mesh {
        return HorseEntity3D.getShadedBoxMesh(length, Math.max(backH, frontH), Math.max(backW, frontW));
    }

    /**
     * 高清晰 3D 几何阿拉伯数字网格 (1~6)，供赛马鞍布号牌与发令闸门门头展示
     */
    public static getDigitMesh(digit: number): Mesh {
        const safeDigit = Math.max(1, Math.min(6, Math.floor(digit || 1)));
        const key = `digit_mesh_v2_${safeDigit}`;
        let mesh = HorseEntity3D.meshCache.get(key);
        if (mesh && mesh.isValid) return mesh;

        const positions: number[] = [];
        const normals: number[] = [];
        const colors: number[] = [];
        const indices: number[] = [];

        const addBox = (cx: number, cy: number, cz: number, sx: number, sy: number, sz: number) => {
            const hx = sx / 2, hy = sy / 2, hz = sz / 2;
            const faces = [
                { n: [0, 0, 1], v: [[-hx, -hy, hz], [hx, -hy, hz], [hx, hy, hz], [-hx, hy, hz]] },
                { n: [0, 0, -1], v: [[hx, -hy, -hz], [-hx, -hy, -hz], [-hx, hy, -hz], [hx, hy, -hz]] },
                { n: [0, 1, 0], v: [[-hx, hy, hz], [hx, hy, hz], [hx, hy, -hz], [-hx, hy, -hz]] },
                { n: [0, -1, 0], v: [[-hx, -hy, -hz], [hx, -hy, -hz], [hx, -hy, hz], [-hx, -hy, hz]] },
                { n: [1, 0, 0], v: [[hx, -hy, hz], [hx, -hy, -hz], [hx, hy, -hz], [hx, hy, hz]] },
                { n: [-1, 0, 0], v: [[-hx, -hy, -hz], [-hx, -hy, hz], [-hx, hy, hz], [-hx, hy, -hz]] },
            ];

            for (const f of faces) {
                const fBase = positions.length / 3;
                const shade = HorseEntity3D.computeVertexShade(f.n[0], f.n[1], f.n[2]);
                for (const pt of f.v) {
                    positions.push(cx + pt[0], cy + pt[1], cz + pt[2]);
                    normals.push(f.n[0], f.n[1], f.n[2]);
                    colors.push(shade, shade, shade, 1.0);
                }
                indices.push(fBase, fBase + 1, fBase + 2, fBase, fBase + 2, fBase + 3);
            }
        };

        const thick = 0.035;
        const barW = 0.045;
        switch (safeDigit) {
            case 1:
                addBox(0.015, 0, 0, barW, 0.26, thick);
                addBox(-0.025, 0.09, 0, 0.045, 0.07, thick);
                addBox(0.015, -0.11, 0, 0.12, 0.045, thick);
                break;
            case 2:
                addBox(0, 0.105, 0, 0.14, barW, thick);
                addBox(0.05, 0.055, 0, barW, 0.08, thick);
                addBox(0, 0.0, 0, 0.14, barW, thick);
                addBox(-0.05, -0.055, 0, barW, 0.08, thick);
                addBox(0, -0.105, 0, 0.14, barW, thick);
                break;
            case 3:
                addBox(0, 0.105, 0, 0.14, barW, thick);
                addBox(0.05, 0.055, 0, barW, 0.08, thick);
                addBox(-0.01, 0.0, 0, 0.12, barW, thick);
                addBox(0.05, -0.055, 0, barW, 0.08, thick);
                addBox(0, -0.105, 0, 0.14, barW, thick);
                break;
            case 4:
                addBox(-0.045, 0.05, 0, barW, 0.13, thick);
                addBox(0, -0.01, 0, 0.14, barW, thick);
                addBox(0.035, 0, 0, barW, 0.25, thick);
                break;
            case 5:
                addBox(0, 0.105, 0, 0.14, barW, thick);
                addBox(-0.05, 0.055, 0, barW, 0.08, thick);
                addBox(0, 0.0, 0, 0.14, barW, thick);
                addBox(0.05, -0.055, 0, barW, 0.08, thick);
                addBox(0, -0.105, 0, 0.14, barW, thick);
                break;
            case 6:
            default:
                addBox(0, 0.105, 0, 0.14, barW, thick);
                addBox(-0.05, 0, 0, barW, 0.24, thick);
                addBox(0, 0.0, 0, 0.14, barW, thick);
                addBox(0.05, -0.055, 0, barW, 0.08, thick);
                addBox(0, -0.105, 0, 0.14, barW, thick);
                break;
        }

        mesh = utils.MeshUtils.createMesh({ positions, normals, colors, indices });
        HorseEntity3D.meshCache.set(key, mesh);
        return mesh;
    }

    // =========================================================================
    // 20 匹纯血名驹权威色彩矩阵
    // =========================================================================

    public static readonly LANE_COLORS: Record<number, Color> = {
        1: new Color(217, 83, 79, 255),  // 1: 烈焰红
        2: new Color(51, 122, 183, 255), // 2: 极速蓝
        3: new Color(92, 184, 92, 255),  // 3: 灵动绿
        4: new Color(240, 173, 78, 255), // 4: 黄金橙
        5: new Color(155, 89, 182, 255), // 5: 魅影紫
        6: new Color(218, 165, 32, 255), // 6: 皇家金
    };

    public static readonly HORSE_PALETTES: Record<number, Horse3DColorPalette> = {
        1: { // 赤焰流星 (深红栗毛，额头带白色星斑)
            coat: new Color(175, 58, 30, 255),
            secondary: new Color(138, 45, 24, 255),
            mane: new Color(75, 18, 12, 255),
            hoof: new Color(38, 32, 26, 255),
            silk: new Color(225, 45, 45, 255),
            silkCap: new Color(255, 215, 0, 255),
            starWhite: true,
        },
        2: { // 翠风 (铁青斑驳毛，银白霜鬓)
            coat: new Color(182, 190, 198, 255),
            secondary: new Color(150, 158, 166, 255),
            mane: new Color(238, 242, 248, 255),
            hoof: new Color(48, 50, 56, 255),
            silk: new Color(42, 168, 82, 255),
            silkCap: new Color(242, 244, 248, 255)
        },
        3: { // 金色箭头 (金黄帕洛米诺，奶白鬃尾，四蹄白)
            coat: new Color(226, 182, 96, 255),
            secondary: new Color(198, 156, 78, 255),
            mane: new Color(254, 252, 240, 255),
            hoof: new Color(52, 44, 32, 255),
            silk: new Color(255, 185, 25, 255),
            silkCap: new Color(32, 32, 32, 255),
            socksWhite: true
        },
        4: { // 暗影猎手 (乌木纯黑，黑曜漆光)
            coat: new Color(32, 30, 34, 255),
            secondary: new Color(20, 18, 22, 255),
            mane: new Color(14, 14, 16, 255),
            hoof: new Color(22, 22, 24, 255),
            silk: new Color(92, 46, 148, 255),
            silkCap: new Color(225, 32, 32, 255)
        },
        5: { // 银月 (纯银白毛，宛若初雪)
            coat: new Color(240, 244, 250, 255),
            secondary: new Color(214, 220, 228, 255),
            mane: new Color(254, 255, 255, 255),
            hoof: new Color(58, 58, 65, 255),
            silk: new Color(36, 115, 228, 255),
            silkCap: new Color(255, 255, 255, 255)
        },
        6: { // 蓝潮 (石板蓝灰沙毛)
            coat: new Color(88, 108, 132, 255),
            secondary: new Color(70, 86, 106, 255),
            mane: new Color(42, 48, 60, 255),
            hoof: new Color(36, 40, 48, 255),
            silk: new Color(22, 145, 220, 255),
            silkCap: new Color(255, 168, 0, 255)
        },
        7: { // 紫电 (深红骝微带紫光)
            coat: new Color(146, 52, 46, 255),
            secondary: new Color(118, 42, 36, 255),
            mane: new Color(28, 22, 22, 255),
            hoof: new Color(34, 30, 30, 255),
            silk: new Color(165, 35, 245, 255),
            silkCap: new Color(255, 218, 0, 255)
        },
        8: { // 暴风疾行 (经典骝毛四蹄白袜)
            coat: new Color(152, 84, 46, 255),
            secondary: new Color(124, 66, 36, 255),
            mane: new Color(24, 20, 18, 255),
            hoof: new Color(40, 36, 32, 255),
            silk: new Color(248, 132, 34, 255),
            silkCap: new Color(42, 42, 42, 255),
            socksWhite: true
        },
        9: { // 惊雷破空 (黑骝色白星章)
            coat: new Color(76, 50, 38, 255),
            secondary: new Color(58, 36, 28, 255),
            mane: new Color(18, 16, 14, 255),
            hoof: new Color(32, 28, 26, 255),
            silk: new Color(225, 22, 64, 255),
            silkCap: new Color(255, 255, 255, 255),
            starWhite: true
        },
        10: { // 烈阳战将 (红枣骝色)
            coat: new Color(190, 122, 86, 255),
            secondary: new Color(160, 96, 66, 255),
            mane: new Color(114, 70, 48, 255),
            hoof: new Color(46, 40, 34, 255),
            silk: new Color(215, 108, 32, 255),
            silkCap: new Color(0, 132, 132, 255)
        },
        11: { // 翡翠之梦 (沙金青骝)
            coat: new Color(98, 104, 114, 255),
            secondary: new Color(76, 84, 92, 255),
            mane: new Color(188, 194, 204, 255),
            hoof: new Color(40, 42, 46, 255),
            silk: new Color(0, 172, 144, 255),
            silkCap: new Color(255, 255, 255, 255)
        },
        12: { // 极光之星 (深褐配菱形星斑)
            coat: new Color(205, 136, 68, 255),
            secondary: new Color(176, 110, 52, 255),
            mane: new Color(250, 220, 158, 255),
            hoof: new Color(44, 36, 30, 255),
            silk: new Color(255, 102, 75, 255),
            silkCap: new Color(32, 148, 255, 255),
            starWhite: true
        },
        13: { // 天火之翼 (琥珀赤金栗毛)
            coat: new Color(202, 122, 50, 255),
            secondary: new Color(168, 98, 38, 255),
            mane: new Color(56, 32, 15, 255),
            hoof: new Color(46, 36, 30, 255),
            silk: new Color(235, 78, 26, 255),
            silkCap: new Color(255, 218, 0, 255)
        },
        14: { // 荒原霸主 (野生原野深褐栗)
            coat: new Color(165, 80, 44, 255),
            secondary: new Color(138, 64, 36, 255),
            mane: new Color(40, 24, 18, 255),
            hoof: new Color(44, 38, 32, 255),
            silk: new Color(36, 158, 88, 255),
            silkCap: new Color(242, 242, 242, 255)
        },
        15: { // 白银之光 (铂银纯亮毛)
            coat: new Color(224, 228, 234, 255),
            secondary: new Color(196, 200, 208, 255),
            mane: new Color(250, 252, 255, 255),
            hoof: new Color(62, 62, 68, 255),
            silk: new Color(74, 135, 235, 255),
            silkCap: new Color(255, 255, 255, 255)
        },
        16: { // 黑曜风暴 (炭黑深灰毛)
            coat: new Color(34, 34, 40, 255),
            secondary: new Color(24, 24, 30, 255),
            mane: new Color(15, 15, 18, 255),
            hoof: new Color(24, 24, 28, 255),
            silk: new Color(185, 32, 54, 255),
            silkCap: new Color(255, 218, 0, 255)
        },
        17: { // 月影独行 (石板青灰斑)
            coat: new Color(126, 136, 146, 255),
            secondary: new Color(100, 110, 120, 255),
            mane: new Color(202, 212, 222, 255),
            hoof: new Color(42, 44, 50, 255),
            silk: new Color(155, 48, 185, 255),
            silkCap: new Color(255, 185, 32, 255)
        },
        18: { // 狂怒号角 (古铜暗骝)
            coat: new Color(116, 70, 38, 255),
            secondary: new Color(94, 56, 32, 255),
            mane: new Color(30, 20, 14, 255),
            hoof: new Color(40, 34, 28, 255),
            silk: new Color(220, 124, 32, 255),
            silkCap: new Color(32, 32, 32, 255)
        },
        19: { // 金羽神鹰 (鎏金黄栗毛)
            coat: new Color(210, 130, 44, 255),
            secondary: new Color(184, 112, 36, 255),
            mane: new Color(72, 42, 18, 255),
            hoof: new Color(50, 42, 32, 255),
            silk: new Color(255, 200, 28, 255),
            silkCap: new Color(205, 32, 32, 255)
        },
        20: { // 深渊魅影 (深邃靛青黑)
            coat: new Color(30, 36, 56, 255),
            secondary: new Color(22, 26, 42, 255),
            mane: new Color(16, 20, 32, 255),
            hoof: new Color(26, 30, 40, 255),
            silk: new Color(32, 80, 165, 255),
            silkCap: new Color(0, 205, 185, 255)
        }
    };

    // =========================================================================
    // 生命周期与架构装配
    // =========================================================================

    protected onLoad(): void {
        this.buildHorse3DStructure();
    }

    protected onDestroy(): void {
        if (this.dustRoot && this.dustRoot.isValid) {
            this.dustRoot.destroy();
            this.dustRoot = null;
        }
        this.dustParticles.length = 0;
    }

    public setHorseNo(no: number): void {
        this.horseNo = no;
        if (this.templateId <= 1) {
            this.templateId = Math.max(1, Math.min(20, no));
        }
        if (this.laneNo <= 1) {
            this.laneNo = Math.max(1, Math.min(6, no));
        }
        this.applyColors();
    }

    public setTemplateId(id: number): void {
        this.templateId = Math.max(1, Math.min(20, id));
        this.horseNo = this.templateId;
        this.applyColors();
    }

    public setLaneNo(lane: number): void {
        this.laneNo = Math.max(1, Math.min(6, lane));
        const digitMesh = HorseEntity3D.getDigitMesh(this.laneNo);
        if (this.saddleDigitNodeL && this.saddleDigitNodeL.isValid) {
            const mr = this.saddleDigitNodeL.getComponent(MeshRenderer);
            if (mr) mr.mesh = digitMesh;
        }
        if (this.saddleDigitNodeR && this.saddleDigitNodeR.isValid) {
            const mr = this.saddleDigitNodeR.getComponent(MeshRenderer);
            if (mr) mr.mesh = digitMesh;
        }
        this.applyColors();
    }

    public setShowJockey(show: boolean): void {
        this.showJockey = show;
        if (this.saddleClothNodeL && this.saddleClothNodeL.isValid) this.saddleClothNodeL.active = show;
        if (this.saddleClothNodeR && this.saddleClothNodeR.isValid) this.saddleClothNodeR.active = show;
        if (this.saddleNode && this.saddleNode.isValid) this.saddleNode.active = show;
        if (this.girthNode && this.girthNode.isValid) this.girthNode.active = show;
        if (this.bridleNode && this.bridleNode.isValid) this.bridleNode.active = show;
        if (this.jockeyNode && this.jockeyNode.isValid) this.jockeyNode.active = show;
        if (this.reinsL && this.reinsL.isValid) this.reinsL.active = show;
        if (this.reinsR && this.reinsR.isValid) this.reinsR.active = show;
    }

    public setBetTarget(isBet: boolean): void {
        this.isBetTarget = isBet;
        if (this.targetMarkerNode && this.targetMarkerNode.isValid) {
            this.targetMarkerNode.active = isBet;
        }
    }

    public setAction(action: string, speed = 1.0): void {
        this.currentAction = action;
        this.animSpeed = speed;
        this.isSprinting = action === "Sprint";
    }

    public setSprint(sprint: boolean): void {
        this.isSprinting = sprint;
        if (sprint) {
            this.currentAction = "Sprint";
            this.animSpeed = 1.45;
        } else {
            this.currentAction = "Gallop";
            this.animSpeed = 1.05;
        }
    }

    // =========================================================================
    // 3D 纯血马骨骼解剖架构装配 (精密接地标定与全套赛马骑师赛具)
    // =========================================================================

    private buildHorse3DStructure(): void {
        this.node.layer = Layers.Enum.DEFAULT;

        // 1. 根位移与旋转点
        this.bodyRoot = new Node("Horse3DBodyRoot");
        this.bodyRoot.layer = Layers.Enum.DEFAULT;
        this.node.addChild(this.bodyRoot);
        this.bodyRoot.setPosition(0, 0, 0);

        // 0. 真实贴地动态阴影 (Contact Ground Shadow: Y=0.005 紧贴跑道路面，消除浮空感)
        this.groundShadowNode = this.createPart(
            "GroundShadow",
            HorseEntity3D.getCylinderMesh(0.85, 0.95, 0.002, 28, true, true),
            new Vec3(0, 0.005, 0)
        );
        this.bodyRoot.addChild(this.groundShadowNode);

        // 2. 连续平滑放样躯干 (Lofted Barrel Torso)
        // 躯干中心 Y 定在 1.15m，使得马蹄自然立于地面 Y = 0.00
        const torsoSections = [
            // 前胸突起 (Breast / Chest)
            { x: 0.82, y: 0.03, ry: 0.31, rz: 0.24, yTopBias: 0.02, yBotBias: 0.05 },
            // 肩胛与高鬐甲 (Shoulder & High Withers: 流畅饱满过渡)
            { x: 0.54, y: 0.11, ry: 0.43, rz: 0.31, yTopBias: 0.05, yBotBias: 0.08 },
            // 深胸肋 (Heart Girth)
            { x: 0.24, y: 0.09, ry: 0.45, rz: 0.33, yTopBias: 0.03, yBotBias: 0.09 },
            // 鞍背平滑微凹 (Saddle Back)
            { x: -0.05, y: 0.06, ry: 0.41, rz: 0.31, yTopBias: -0.01, yBotBias: 0.04 },
            // 腰腹收敛 (Loin & Flank Tuck)
            { x: -0.32, y: 0.08, ry: 0.38, rz: 0.29, yTopBias: 0.02, yBotBias: -0.05 },
            // 臀峰与荐部 (Croup & Hip Crest)
            { x: -0.62, y: 0.12, ry: 0.43, rz: 0.33, yTopBias: 0.04, yBotBias: -0.01 },
            // 臀大肌后坡 (Hamstrings & Buttocks)
            { x: -0.88, y: 0.05, ry: 0.37, rz: 0.27, yTopBias: 0.00, yBotBias: 0.02 },
            // 尾根衔接点 (Dock)
            { x: -1.02, y: -0.02, ry: 0.16, rz: 0.13 }
        ];
        const torsoMesh = HorseEntity3D.buildLoftMesh(torsoSections, 24, true, true, 0.12, 0.10);
        this.torsoNode = this.createPart("Torso", torsoMesh, new Vec3(0, 1.15, 0));
        this.bodyRoot.addChild(this.torsoNode);

        // 3. 优雅拱颈 (Arched Crested Neck)
        this.neckNode = new Node("NeckJoint");
        this.neckNode.layer = Layers.Enum.DEFAULT;
        this.torsoNode.addChild(this.neckNode);
        this.neckNode.setPosition(0.50, 0.12, 0);
        this.neckNode.setRotationFromEuler(0, 0, 40);

        const neckSections = [
            { x: 0.00, y: 0.00, ry: 0.28, rz: 0.18, yTopBias: 0.04 }, // 颈根 (Neck base)
            { x: 0.20, y: 0.14, ry: 0.24, rz: 0.15, yTopBias: 0.06 },
            { x: 0.42, y: 0.26, ry: 0.20, rz: 0.12, yTopBias: 0.07 }, // 颈弓顶峰 (Crest arch)
            { x: 0.62, y: 0.35, ry: 0.16, rz: 0.10, yTopBias: 0.05 },
            { x: 0.78, y: 0.40, ry: 0.13, rz: 0.09, yTopBias: 0.02 }  // 枕骨项部 (Poll)
        ];
        const neckMesh = HorseEntity3D.buildLoftMesh(neckSections, 20, false, false);
        const neckMeshNode = this.createPart("NeckMesh", neckMesh, new Vec3(0, 0, 0));
        this.neckNode.addChild(neckMeshNode);

        // 4. 雕塑感马首 (Sculpted Equine Head: 尊贵纯血马面容)
        this.headNode = new Node("HeadJoint");
        this.headNode.layer = Layers.Enum.DEFAULT;
        this.neckNode.addChild(this.headNode);
        this.headNode.setPosition(0.78, 0.40, 0);
        this.headNode.setRotationFromEuler(0, 0, -32);

        // 4A. 马头主体放样
        const headSections = [
            { x: 0.00, y: 0.00, ry: 0.13, rz: 0.10 },                 // 枕骨顶 (Poll)
            { x: 0.12, y: 0.01, ry: 0.14, rz: 0.12, yTopBias: 0.02 },// 宽额部 (Brow)
            { x: 0.24, y: -0.02, ry: 0.11, rz: 0.095 },              // 鼻梁上段
            { x: 0.38, y: -0.05, ry: 0.085, rz: 0.075 },             // 鼻骨下段
            { x: 0.48, y: -0.08, ry: 0.065, rz: 0.060 }              // 柔和吻部
        ];
        const headMesh = HorseEntity3D.buildLoftMesh(headSections, 20, true, true, 0.05, 0.05);
        const headMeshNode = this.createPart("HeadMesh", headMesh, new Vec3(0, 0, 0));
        this.headNode.addChild(headMeshNode);

        // 4B. 真实马下颌与咬肌 (Masseter: 扁圆紧致肌肉)
        const jawL = this.createPart("JawL", HorseEntity3D.getEllipsoidMesh(0.10, 0.08, 0.042, 8, 10), new Vec3(0.08, -0.08, 0.075));
        const jawR = this.createPart("JawR", HorseEntity3D.getEllipsoidMesh(0.10, 0.08, 0.042, 8, 10), new Vec3(0.08, -0.08, -0.075));
        jawL.setRotationFromEuler(-8, 10, -15);
        jawR.setRotationFromEuler(8, -10, -15);
        this.headNode.addChild(jawL);
        this.headNode.addChild(jawR);

        // 4C. 柔和天鹅绒吻部与鼻孔
        const muzzleCap = this.createPart(
            "Muzzle",
            HorseEntity3D.getEllipsoidMesh(0.075, 0.065, 0.062, 8, 12),
            new Vec3(0.48, -0.08, 0)
        );
        this.headNode.addChild(muzzleCap);

        const nostrilL = this.createPart("NostrilL", HorseEntity3D.getEllipsoidMesh(0.032, 0.025, 0.018, 6, 8), new Vec3(0.48, -0.065, 0.058));
        const nostrilR = this.createPart("NostrilR", HorseEntity3D.getEllipsoidMesh(0.032, 0.025, 0.018, 6, 8), new Vec3(0.48, -0.065, -0.058));
        this.headNode.addChild(nostrilL);
        this.headNode.addChild(nostrilR);

        // 4D. 额头菱形流星白斑 (置于颅额上表面 Y=0.155)
        const starMesh = HorseEntity3D.getShadedBoxMesh(0.06, 0.09, 0.03);
        const foreheadStar = this.createPart("ForeheadStar", starMesh, new Vec3(0.16, 0.155, 0));
        foreheadStar.setRotationFromEuler(0, 0, -10);
        this.headNode.addChild(foreheadStar);

        // 4E. 灵动侧置眼眸 (含角膜高光小晶点，富有神采)
        const eyeMesh = HorseEntity3D.getEllipsoidMesh(0.040, 0.038, 0.028, 8, 10);
        const eyeL = this.createPart("EyeL", eyeMesh, new Vec3(0.15, 0.04, 0.120));
        const eyeR = this.createPart("EyeR", eyeMesh, new Vec3(0.15, 0.04, -0.120));
        this.headNode.addChild(eyeL);
        this.headNode.addChild(eyeR);

        const glintMesh = HorseEntity3D.getEllipsoidMesh(0.012, 0.012, 0.010, 6, 6);
        const glintL = this.createPart("EyeGlintL", glintMesh, new Vec3(0.165, 0.048, 0.130));
        const glintR = this.createPart("EyeGlintR", glintMesh, new Vec3(0.165, 0.048, -0.130));
        this.headNode.addChild(glintL);
        this.headNode.addChild(glintR);

        // 4F. 警觉双耳 (立于枕骨项顶 Y=0.135)
        const earMesh = HorseEntity3D.getEarMesh();
        const earL = this.createPart("EarL", earMesh, new Vec3(0.02, 0.135, 0.055));
        const earR = this.createPart("EarR", earMesh, new Vec3(0.02, 0.135, -0.055));
        earL.setRotationFromEuler(6, 14, 15);
        earR.setRotationFromEuler(6, -14, 15);
        this.headNode.addChild(earL);
        this.headNode.addChild(earR);

        // 4G. 赛马真皮水勒 (Leather Bridle, Bit Rings & Browband)
        this.bridleNode = new Node("BridleRoot");
        this.bridleNode.layer = Layers.Enum.DEFAULT;
        this.headNode.addChild(this.bridleNode);

        const browband = this.createPart("Browband", HorseEntity3D.getShadedBoxMesh(0.035, 0.022, 0.25), new Vec3(0.10, 0.115, 0));
        this.bridleNode.addChild(browband);

        const noseband = this.createPart("Noseband", HorseEntity3D.getShadedBoxMesh(0.035, 0.022, 0.18), new Vec3(0.36, -0.045, 0));
        this.bridleNode.addChild(noseband);

        const cheekL = this.createPart("CheekL", HorseEntity3D.getCylinderMesh(0.012, 0.012, 0.22, 8), new Vec3(0.24, 0.02, 0.11));
        const cheekR = this.createPart("CheekR", HorseEntity3D.getCylinderMesh(0.012, 0.012, 0.22, 8), new Vec3(0.24, 0.02, -0.11));
        cheekL.setRotationFromEuler(0, 0, 45);
        cheekR.setRotationFromEuler(0, 0, 45);
        this.bridleNode.addChild(cheekL);
        this.bridleNode.addChild(cheekR);

        const bitRingMesh = HorseEntity3D.getCylinderMesh(0.032, 0.032, 0.012, 14, true, true, true);
        this.bitRingLNode = this.createPart("BitRingL", bitRingMesh, new Vec3(0.44, -0.075, 0.070));
        this.bitRingRNode = this.createPart("BitRingR", bitRingMesh, new Vec3(0.44, -0.075, -0.070));
        this.bitRingLNode.setRotationFromEuler(90, 0, 0);
        this.bitRingRNode.setRotationFromEuler(90, 0, 0);
        this.bridleNode.addChild(this.bitRingLNode);
        this.bridleNode.addChild(this.bitRingRNode);
        this.bridleNode.active = this.showJockey;

        // 5. 飘逸贴颈立体鬃毛与额毛 (Contoured Flowing Mane & Forelock)
        this.maneRootNode = new Node("ManeRoot");
        this.maneRootNode.layer = Layers.Enum.DEFAULT;
        this.neckNode.addChild(this.maneRootNode);
        this.maneRootNode.setPosition(0.00, 0.00, 0.025);

        const maneMesh = this.createPart("ManeMesh", HorseEntity3D.getSculptedManeMesh(), new Vec3(0, 0, 0));
        this.maneRootNode.addChild(maneMesh);

        const forelock = this.createPart("Forelock", HorseEntity3D.getEllipsoidMesh(0.07, 0.04, 0.035, 6, 8), new Vec3(0.08, 0.165, 0.015));
        forelock.setRotationFromEuler(0, 0, -20);
        this.headNode.addChild(forelock);

        // 6. 丰满流线马尾 (Curved Plumed Tail: 贴身垂落至飞节下方)
        this.tailJointNode = new Node("TailJoint");
        this.tailJointNode.layer = Layers.Enum.DEFAULT;
        this.torsoNode.addChild(this.tailJointNode);
        this.tailJointNode.setPosition(-1.00, 0.04, 0);

        this.tailHairNode = this.createPart("TailHair", HorseEntity3D.getTailPlumeMesh(), new Vec3(0, 0, 0));
        this.tailJointNode.addChild(this.tailHairNode);

        // 7. 专业赛鞍与双侧 3D 号码布系统
        // 7A. 纯皮赛鞍 (Racing English Saddle)
        this.saddleNode = this.createPart(
            "Saddle",
            HorseEntity3D.getCylinderMesh(0.26, 0.30, 0.44, 16, true, true),
            new Vec3(0.05, 0.38, 0)
        );
        this.saddleNode.setRotationFromEuler(0, 0, 90);
        this.torsoNode.addChild(this.saddleNode);
        this.saddleNode.active = this.showJockey;

        // 7B. 紧固肚带 (Girth Strap)
        this.girthNode = this.createPart(
            "GirthStrap",
            HorseEntity3D.getCylinderMesh(0.33, 0.35, 0.10, 16, true, true),
            new Vec3(0.05, 0.05, 0)
        );
        this.girthNode.setRotationFromEuler(0, 0, 90);
        this.torsoNode.addChild(this.girthNode);
        this.girthNode.active = this.showJockey;

        // 7C. 双侧立体赛马号码布 (Left & Right Number Cloths with 3D Digits)
        const clothW = 0.46, clothH = 0.30, clothThick = 0.018;
        const saddleClothMesh = HorseEntity3D.getShadedBoxMesh(clothW, clothH, clothThick);
        const digitMesh = HorseEntity3D.getDigitMesh(this.laneNo);

        // 左侧号码布 (面向 +Z 跑道外侧)
        this.saddleClothNodeL = new Node("SaddleClothL");
        this.saddleClothNodeL.layer = Layers.Enum.DEFAULT;
        this.torsoNode.addChild(this.saddleClothNodeL);
        this.saddleClothNodeL.setPosition(0.02, 0.22, 0.32);
        const mrClothL = this.saddleClothNodeL.addComponent(MeshRenderer);
        mrClothL.mesh = saddleClothMesh;

        this.saddleDigitNodeL = new Node("SaddleDigitL");
        this.saddleDigitNodeL.layer = Layers.Enum.DEFAULT;
        this.saddleClothNodeL.addChild(this.saddleDigitNodeL);
        this.saddleDigitNodeL.setPosition(0, 0, 0.018);
        const mrDigitL = this.saddleDigitNodeL.addComponent(MeshRenderer);
        mrDigitL.mesh = digitMesh;

        // 右侧号码布 (面向 -Z 跑道内侧)
        this.saddleClothNodeR = new Node("SaddleClothR");
        this.saddleClothNodeR.layer = Layers.Enum.DEFAULT;
        this.torsoNode.addChild(this.saddleClothNodeR);
        this.saddleClothNodeR.setPosition(0.02, 0.22, -0.32);
        const mrClothR = this.saddleClothNodeR.addComponent(MeshRenderer);
        mrClothR.mesh = saddleClothMesh;

        this.saddleDigitNodeR = new Node("SaddleDigitR");
        this.saddleDigitNodeR.layer = Layers.Enum.DEFAULT;
        this.saddleClothNodeR.addChild(this.saddleDigitNodeR);
        this.saddleDigitNodeR.setPosition(0, 0, -0.018);
        this.saddleDigitNodeR.setRotationFromEuler(0, 180, 0);
        const mrDigitR = this.saddleDigitNodeR.addComponent(MeshRenderer);
        mrDigitR.mesh = digitMesh;

        this.saddleClothNodeL.active = this.showJockey;
        this.saddleClothNodeR.active = this.showJockey;

        // 7D. 真皮双缰绳 (Reins L & R)
        this.reinsL = this.createPart("ReinsL", HorseEntity3D.getCylinderMesh(0.012, 0.012, 0.65, 8), new Vec3(0.40, 0.28, 0.15));
        this.reinsR = this.createPart("ReinsR", HorseEntity3D.getCylinderMesh(0.012, 0.012, 0.65, 8), new Vec3(0.40, 0.28, -0.15));
        this.reinsL.setRotationFromEuler(0, 0, -28);
        this.reinsR.setRotationFromEuler(0, 0, -28);
        this.torsoNode.addChild(this.reinsL);
        this.torsoNode.addChild(this.reinsR);
        this.reinsL.active = this.showJockey;
        this.reinsR.active = this.showJockey;

        // 7E. 全套专业赛马骑师 (Aerodynamic Professional Jockey)
        this.jockeyNode = new Node("JockeyRoot");
        this.jockeyNode.layer = Layers.Enum.DEFAULT;
        this.torsoNode.addChild(this.jockeyNode);
        this.jockeyNode.setPosition(0.05, 0.38, 0);

        // 骑师躯干 (彩衣 Silks) - 经典破风低姿俯身角度 52°
        this.jockeyTorsoNode = this.createPart(
            "JockeyTorso",
            HorseEntity3D.getCylinderMesh(0.14, 0.10, 0.44, 12, true, true),
            new Vec3(0.08, 0.20, 0)
        );
        this.jockeyTorsoNode.setRotationFromEuler(0, 0, 52);
        this.jockeyNode.addChild(this.jockeyTorsoNode);

        // 骑师肩部肌肉过渡
        const shoulders = this.createPart("JockeyShoulders", HorseEntity3D.getEllipsoidMesh(0.09, 0.08, 0.16, 8, 12), new Vec3(0.24, 0.34, 0));
        this.jockeyNode.addChild(shoulders);

        // 骑师头部 (面部肤色 + 彩帽 + 护目镜)
        this.jockeyHeadNode = new Node("JockeyHeadJoint");
        this.jockeyHeadNode.layer = Layers.Enum.DEFAULT;
        this.jockeyNode.addChild(this.jockeyHeadNode);
        this.jockeyHeadNode.setPosition(0.28, 0.44, 0);
        this.jockeyHeadNode.setRotationFromEuler(0, 0, -18);

        const faceNode = this.createPart("JockeyFace", HorseEntity3D.getEllipsoidMesh(0.065, 0.075, 0.062, 8, 10), new Vec3(0.015, -0.015, 0));
        this.jockeyHeadNode.addChild(faceNode);

        this.jockeyCap = this.createPart("JockeyCap", HorseEntity3D.getEllipsoidMesh(0.085, 0.080, 0.082, 10, 14), new Vec3(0.00, 0.025, 0));
        this.jockeyHeadNode.addChild(this.jockeyCap);

        const visorNode = this.createPart("JockeyVisor", HorseEntity3D.getShadedBoxMesh(0.055, 0.014, 0.082), new Vec3(0.075, 0.030, 0));
        visorNode.setRotationFromEuler(0, 0, -15);
        this.jockeyHeadNode.addChild(visorNode);

        this.jockeyGoggles = this.createPart("JockeyGoggles", HorseEntity3D.getShadedBoxMesh(0.030, 0.035, 0.115), new Vec3(0.065, 0.010, 0));
        this.jockeyHeadNode.addChild(this.jockeyGoggles);

        // 骑师双臂 (紧握前方缰绳)
        const armLen = 0.22;
        this.jockeyArmL = this.createPart("JockeyArmL", HorseEntity3D.getCylinderMesh(0.045, 0.038, armLen, 10, true, true), new Vec3(0.22, 0.28, 0.14));
        this.jockeyArmL.setRotationFromEuler(0, 0, 40);
        this.jockeyNode.addChild(this.jockeyArmL);

        this.jockeyArmR = this.createPart("JockeyArmR", HorseEntity3D.getCylinderMesh(0.045, 0.038, armLen, 10, true, true), new Vec3(0.22, 0.28, -0.14));
        this.jockeyArmR.setRotationFromEuler(0, 0, 40);
        this.jockeyNode.addChild(this.jockeyArmR);

        // 骑师双手手套 (Gloved Hands)
        const handL = this.createPart("JockeyHandL", HorseEntity3D.getEllipsoidMesh(0.038, 0.032, 0.032, 6, 8), new Vec3(0.38, 0.32, 0.12));
        this.jockeyNode.addChild(handL);

        const handR = this.createPart("JockeyHandR", HorseEntity3D.getEllipsoidMesh(0.038, 0.032, 0.032, 6, 8), new Vec3(0.38, 0.32, -0.12));
        this.jockeyNode.addChild(handR);

        // 骑师马鞭 (Whip Crop in Right Hand)
        this.jockeyWhipNode = this.createPart("JockeyWhip", HorseEntity3D.getCylinderMesh(0.008, 0.005, 0.42, 6), new Vec3(0.26, 0.24, -0.18));
        this.jockeyWhipNode.setRotationFromEuler(0, 0, -45);
        this.jockeyNode.addChild(this.jockeyWhipNode);

        // 骑师双腿 (经典超短马镫深曲膝抱鞍骑姿)
        this.jockeyLegL = this.createPart("JockeyThighL", HorseEntity3D.getCylinderMesh(0.068, 0.052, 0.22, 10, true, true), new Vec3(0.05, 0.20, 0.18));
        this.jockeyLegL.setRotationFromEuler(0, 0, 36);
        this.jockeyNode.addChild(this.jockeyLegL);

        this.jockeyLegR = this.createPart("JockeyThighR", HorseEntity3D.getCylinderMesh(0.068, 0.052, 0.22, 10, true, true), new Vec3(0.05, 0.20, -0.18));
        this.jockeyLegR.setRotationFromEuler(0, 0, 36);
        this.jockeyNode.addChild(this.jockeyLegR);

        // 小腿与亮黑抛光马靴
        const bootL = this.createPart("JockeyBootL", HorseEntity3D.getCylinderMesh(0.052, 0.040, 0.20, 10, true, true), new Vec3(-0.06, 0.08, 0.19));
        bootL.setRotationFromEuler(0, 0, -55);
        this.jockeyNode.addChild(bootL);

        const bootR = this.createPart("JockeyBootR", HorseEntity3D.getCylinderMesh(0.052, 0.040, 0.20, 10, true, true), new Vec3(-0.06, 0.08, -0.19));
        bootR.setRotationFromEuler(0, 0, -55);
        this.jockeyNode.addChild(bootR);

        // 悬挂金属马镫环 (Stirrup Irons)
        const stirrupMesh = HorseEntity3D.getCylinderMesh(0.045, 0.045, 0.015, 12, true, true, true);
        this.stirrupLNode = this.createPart("StirrupL", stirrupMesh, new Vec3(-0.05, 0.02, 0.20));
        this.stirrupRNode = this.createPart("StirrupR", stirrupMesh, new Vec3(-0.05, 0.02, -0.20));
        this.stirrupLNode.setRotationFromEuler(90, 0, 0);
        this.stirrupRNode.setRotationFromEuler(90, 0, 0);
        this.jockeyNode.addChild(this.stirrupLNode);
        this.jockeyNode.addChild(this.stirrupRNode);

        this.jockeyNode.active = this.showJockey;

        // 押注信标 (常驻黄金标记)
        this.targetMarkerNode = this.createPart(
            "BetTargetMarker",
            HorseEntity3D.getCylinderMesh(0.0, 0.24, 0.36, 6, true, true, true),
            new Vec3(0.05, 2.50, 0)
        );
        this.targetMarkerNode.setRotationFromEuler(180, 0, 0);
        this.targetMarkerNode.active = false;
        this.torsoNode.addChild(this.targetMarkerNode);

        // 8. 四肢精密解剖接地系统 (零漂浮、零穿模，四蹄稳健踏立)
        // 左前肢 (世界 Y=1.00 -> Y=0.00)
        this.frontLeftUpper = this.createForeleg("FrontLeftUpper", this.torsoNode, new Vec3(0.48, -0.15, 0.20));
        this.frontLeftLower = this.createLowerForeleg("FrontLeftLower", this.frontLeftUpper);

        // 右前肢
        this.frontRightUpper = this.createForeleg("FrontRightUpper", this.torsoNode, new Vec3(0.48, -0.15, -0.20));
        this.frontRightLower = this.createLowerForeleg("FrontRightLower", this.frontRightUpper);

        // 左后肢 (世界 Y=1.05 -> Y=0.00)
        this.backLeftUpper = this.createHindleg("BackLeftUpper", this.torsoNode, new Vec3(-0.58, -0.10, 0.22));
        this.backLeftLower = this.createLowerHindleg("BackLeftLower", this.backLeftUpper);

        // 右后肢
        this.backRightUpper = this.createHindleg("BackRightUpper", this.torsoNode, new Vec3(-0.58, -0.10, -0.22));
        this.backRightLower = this.createLowerHindleg("BackRightLower", this.backRightUpper);

        // 应用马匹配色与标识
        this.applyColors();
    }

    /**
     * 前肢肩臂与前臂骨骼装配 (长度精确标定 0.458m)
     */
    private createForeleg(name: string, parent: Node, offset: Vec3): Node {
        const joint = new Node(name);
        joint.layer = Layers.Enum.DEFAULT;
        parent.addChild(joint);
        joint.setPosition(offset);

        // 肩部圆润肌肉过渡
        const shoulderBulge = this.createPart(
            `${name}_Shoulder`,
            HorseEntity3D.getEllipsoidMesh(0.11, 0.15, 0.08, 8, 10),
            new Vec3(0.01, -0.06, 0)
        );
        joint.addChild(shoulderBulge);

        // 前臂肌肉 (渐缩圆柱体)
        const armLen = 0.458;
        const armMesh = this.createPart(
            `${name}_Mesh`,
            HorseEntity3D.getCylinderMesh(0.092, 0.058, armLen, 16, true, true),
            new Vec3(0, -armLen / 2.0, 0)
        );
        joint.addChild(armMesh);

        // 腕膝关节 (腕骨整洁平整)
        const kneeCap = this.createPart(
            `${name}_Knee`,
            HorseEntity3D.getEllipsoidMesh(0.060, 0.058, 0.054, 8, 10),
            new Vec3(0.005, -armLen, 0)
        );
        joint.addChild(kneeCap);

        return joint;
    }

    /**
     * 前肢下部：管骨、球节、系部与马蹄 (零漂浮精准接地 Y=0.00)
     */
    private createLowerForeleg(name: string, upperJoint: Node): Node {
        const lowerJoint = new Node(name);
        lowerJoint.layer = Layers.Enum.DEFAULT;
        upperJoint.addChild(lowerJoint);
        const armLen = 0.458;
        lowerJoint.setPosition(0, -armLen, 0);

        // 管骨 (0.380m 纤细坚韧)
        const cannonLen = 0.380;
        const cannon = this.createPart(
            `${name}_Mesh`,
            HorseEntity3D.getCylinderMesh(0.040, 0.038, cannonLen, 14, true, true),
            new Vec3(0, -cannonLen / 2.0, 0)
        );
        lowerJoint.addChild(cannon);

        // 球节 (Fetlock)
        const fetlock = this.createPart(
            `${name}_Fetlock`,
            HorseEntity3D.getEllipsoidMesh(0.052, 0.052, 0.048, 8, 10),
            new Vec3(0.005, -cannonLen, 0)
        );
        lowerJoint.addChild(fetlock);

        // 系部 (45° 倾斜系骨 0.12m)
        const pastern = this.createPart(
            `${name}_Pastern`,
            HorseEntity3D.getCylinderMesh(0.038, 0.044, 0.110, 12, true, true),
            new Vec3(0.042, -cannonLen - 0.042, 0)
        );
        pastern.setRotationFromEuler(0, 0, -45);
        lowerJoint.addChild(pastern);

        // 马蹄 (外扩圆台，底平齐 Y=0.000)
        const hoof = this.createPart(
            `${name}_Hoof`,
            HorseEntity3D.getCylinderMesh(0.054, 0.076, 0.070, 18, true, true),
            new Vec3(0.092, -cannonLen - 0.127, 0)
        );
        lowerJoint.addChild(hoof);

        // 银亮马蹄铁 (Horseshoe Rim: 底部银白色金属光泽)
        const shoe = this.createPart(
            `${name}_Shoe`,
            HorseEntity3D.getCylinderMesh(0.075, 0.077, 0.012, 18, true, true, true),
            new Vec3(0.092, -cannonLen - 0.158, 0)
        );
        lowerJoint.addChild(shoe);

        return lowerJoint;
    }

    /**
     * 后肢股部与大腿小腿骨骼装配 (自然飞节折角)
     */
    private createHindleg(name: string, parent: Node, offset: Vec3): Node {
        const joint = new Node(name);
        joint.layer = Layers.Enum.DEFAULT;
        parent.addChild(joint);
        joint.setPosition(offset);
        joint.setRotationFromEuler(0, 0, -10); // 自然微后倾

        // 强健后臀股大肌
        const thighBulge = this.createPart(
            `${name}_Thigh`,
            HorseEntity3D.getEllipsoidMesh(0.16, 0.22, 0.11, 10, 12),
            new Vec3(-0.02, -0.08, 0)
        );
        joint.addChild(thighBulge);

        // 小腿小股肌 (0.510m)
        const gaskinLen = 0.510;
        const gaskin = this.createPart(
            `${name}_Mesh`,
            HorseEntity3D.getCylinderMesh(0.110, 0.062, gaskinLen, 16, true, true),
            new Vec3(-0.015, -gaskinLen / 2.0, 0)
        );
        joint.addChild(gaskin);

        // 标志性后肢飞节 (向后突出的跟骨结节)
        const hockCap = this.createPart(
            `${name}_Hock`,
            HorseEntity3D.getCylinderMesh(0.068, 0.050, 0.11, 14, true, true),
            new Vec3(-0.032, -gaskinLen, 0)
        );
        hockCap.setRotationFromEuler(0, 0, 12);
        joint.addChild(hockCap);

        return joint;
    }

    /**
     * 后肢下部：后管骨、球节、系部与马蹄 (零漂浮精准接地 Y=0.00)
     */
    private createLowerHindleg(name: string, upperJoint: Node): Node {
        const lowerJoint = new Node(name);
        lowerJoint.layer = Layers.Enum.DEFAULT;
        upperJoint.addChild(lowerJoint);
        const gaskinLen = 0.510;
        lowerJoint.setPosition(-0.015, -gaskinLen, 0);
        lowerJoint.setRotationFromEuler(0, 0, 10); // 补偿上肢倾斜，使后管骨垂直垂地

        // 后管骨 (0.386m)
        const cannonLen = 0.386;
        const cannon = this.createPart(
            `${name}_Mesh`,
            HorseEntity3D.getCylinderMesh(0.042, 0.040, cannonLen, 14, true, true),
            new Vec3(0, -cannonLen / 2.0, 0)
        );
        lowerJoint.addChild(cannon);

        // 后球节
        const fetlock = this.createPart(
            `${name}_Fetlock`,
            HorseEntity3D.getEllipsoidMesh(0.052, 0.052, 0.048, 8, 10),
            new Vec3(0.005, -cannonLen, 0)
        );
        lowerJoint.addChild(fetlock);

        // 后系部 (45° 倾斜系骨)
        const pastern = this.createPart(
            `${name}_Pastern`,
            HorseEntity3D.getCylinderMesh(0.040, 0.046, 0.110, 12, true, true),
            new Vec3(0.042, -cannonLen - 0.042, 0)
        );
        pastern.setRotationFromEuler(0, 0, -45);
        lowerJoint.addChild(pastern);

        // 后蹄 (外扩圆台，底平齐 Y=0.000)
        const hoof = this.createPart(
            `${name}_Hoof`,
            HorseEntity3D.getCylinderMesh(0.055, 0.076, 0.070, 18, true, true),
            new Vec3(0.092, -cannonLen - 0.127, 0)
        );
        lowerJoint.addChild(hoof);

        // 银亮马蹄铁 (Horseshoe Rim: 底部银白色金属光泽)
        const shoe = this.createPart(
            `${name}_Shoe`,
            HorseEntity3D.getCylinderMesh(0.075, 0.077, 0.012, 18, true, true, true),
            new Vec3(0.092, -cannonLen - 0.158, 0)
        );
        lowerJoint.addChild(shoe);

        return lowerJoint;
    }


    private createPart(name: string, mesh: Mesh, pos: Vec3): Node {
        const node = new Node(name);
        node.layer = Layers.Enum.DEFAULT;
        node.setPosition(pos);

        const mr = node.addComponent(MeshRenderer);
        mr.mesh = mesh;
        return node;
    }

    // =========================================================================
    // 色彩分派与高阶马体标识渲染
    // =========================================================================

    public applyColors(): void {
        const palId = this.templateId || this.horseNo || 1;
        const p = HorseEntity3D.HORSE_PALETTES[palId] || HorseEntity3D.HORSE_PALETTES[1];

        const setNodeMat = (node: Node | null | undefined, color: Color) => {
            if (!node || !node.isValid) return;
            const mr = node.getComponent(MeshRenderer);
            if (mr) {
                mr.material = HorseEntity3D.getMaterial(color);
            }
        };

        const applyBranchCoat = (node: Node | null | undefined, coatColor: Color) => {
            if (!node || !node.isValid) return;
            const mr = node.getComponent(MeshRenderer);
            if (mr) {
                mr.material = HorseEntity3D.getMaterial(coatColor);
            }
            node.children.forEach(c => {
                if (!c.name.includes("Mane") && !c.name.includes("Tail") &&
                    !c.name.includes("Hoof") && !c.name.includes("Saddle") &&
                    !c.name.includes("Jockey") && !c.name.includes("Muzzle") &&
                    !c.name.includes("Nostril") && !c.name.includes("Eye") &&
                    !c.name.includes("Star") && !c.name.includes("Forelock") &&
                    !c.name.includes("Reins") && !c.name.includes("BetTargetMarker") &&
                    !c.name.includes("Shoe") && !c.name.includes("Bridle") &&
                    !c.name.includes("BitRing") && !c.name.includes("Stirrup") &&
                    !c.name.includes("GroundShadow") && !c.name.includes("Digit")) {
                    applyBranchCoat(c, coatColor);
                }
            });
        };

        // 1. 被毛主色
        applyBranchCoat(this.torsoNode, p.coat);
        if (this.neckNode) applyBranchCoat(this.neckNode, p.coat);
        if (this.headNode) applyBranchCoat(this.headNode, p.coat);

        // 2. 吻部柔和过渡、灵动黑眸、白星斑与黑鼻孔
        if (this.headNode) {
            setNodeMat(this.headNode.getChildByName("Muzzle"), p.secondary);
            setNodeMat(this.headNode.getChildByName("NostrilL"), new Color(28, 24, 24, 255));
            setNodeMat(this.headNode.getChildByName("NostrilR"), new Color(28, 24, 24, 255));
            setNodeMat(this.headNode.getChildByName("EyeL"), new Color(16, 16, 20, 255));
            setNodeMat(this.headNode.getChildByName("EyeR"), new Color(16, 16, 20, 255));
            setNodeMat(this.headNode.getChildByName("Forelock"), p.mane);

            const star = this.headNode.getChildByName("ForeheadStar");
            if (star) {
                star.active = !!p.starWhite;
                setNodeMat(star, new Color(250, 252, 255, 255));
            }
        }

        // 3. 鬃毛与马尾毛色
        if (this.maneRootNode) {
            this.maneRootNode.children.forEach(c => setNodeMat(c, p.mane));
        }
        if (this.tailHairNode) {
            setNodeMat(this.tailHairNode, p.mane);
        }

        // 4. 四蹄角质、银亮蹄铁与白袜 (White Stockings)
        const hoofNodes = [
            this.frontLeftLower?.getChildByName("FrontLeftLower_Hoof"),
            this.frontRightLower?.getChildByName("FrontRightLower_Hoof"),
            this.backLeftLower?.getChildByName("BackLeftLower_Hoof"),
            this.backRightLower?.getChildByName("BackRightLower_Hoof"),
        ];
        hoofNodes.forEach(h => setNodeMat(h, p.hoof));

        const shoeNodes = [
            this.frontLeftLower?.getChildByName("FrontLeftLower_Shoe"),
            this.frontRightLower?.getChildByName("FrontRightLower_Shoe"),
            this.backLeftLower?.getChildByName("BackLeftLower_Shoe"),
            this.backRightLower?.getChildByName("BackRightLower_Shoe"),
        ];
        const shoeColor = new Color(218, 226, 238, 255);
        shoeNodes.forEach(s => setNodeMat(s, shoeColor));

        if (p.socksWhite) {
            const whiteSocks = [
                this.frontLeftLower?.getChildByName("FrontLeftLower_Pastern"),
                this.frontRightLower?.getChildByName("FrontRightLower_Pastern"),
                this.backLeftLower?.getChildByName("BackLeftLower_Pastern"),
                this.backRightLower?.getChildByName("BackRightLower_Pastern"),
            ];
            whiteSocks.forEach(s => setNodeMat(s, new Color(245, 248, 252, 255)));
        }

        // 5. 鞍褥、双侧号码布、真皮赛鞍与水勒缰绳
        const laneColor = HorseEntity3D.LANE_COLORS[this.laneNo] || p.silk;
        if (this.saddleClothNode) {
            setNodeMat(this.saddleClothNode, laneColor);
        }
        if (this.saddleClothNodeL) {
            setNodeMat(this.saddleClothNodeL, laneColor);
        }
        if (this.saddleClothNodeR) {
            setNodeMat(this.saddleClothNodeR, laneColor);
        }
        const digitColor = new Color(255, 255, 255, 255);
        if (this.saddleDigitNodeL) {
            setNodeMat(this.saddleDigitNodeL, digitColor);
        }
        if (this.saddleDigitNodeR) {
            setNodeMat(this.saddleDigitNodeR, digitColor);
        }
        if (this.saddleNode) {
            setNodeMat(this.saddleNode, new Color(42, 24, 14, 255));
        }
        const bridleColor = new Color(48, 30, 18, 255);
        if (this.bridleNode) {
            setNodeMat(this.bridleNode, bridleColor);
        }
        const metalRingColor = new Color(230, 235, 245, 255);
        if (this.bitRingLNode) setNodeMat(this.bitRingLNode, metalRingColor);
        if (this.bitRingRNode) setNodeMat(this.bitRingRNode, metalRingColor);
        if (this.stirrupLNode) setNodeMat(this.stirrupLNode, metalRingColor);
        if (this.stirrupRNode) setNodeMat(this.stirrupRNode, metalRingColor);

        if (this.torsoNode) {
            setNodeMat(this.torsoNode.getChildByName("ReinsL"), bridleColor);
            setNodeMat(this.torsoNode.getChildByName("ReinsR"), bridleColor);
        }
        if (this.targetMarkerNode) {
            setNodeMat(this.targetMarkerNode, new Color(255, 218, 25, 255));
        }
        if (this.groundShadowNode) {
            setNodeMat(this.groundShadowNode, new Color(15, 12, 10, 160));
        }

        // 6. 骑师装备与服饰 (Aerodynamic Jockey Gear)
        if (this.jockeyNode) {
            setNodeMat(this.jockeyNode.getChildByName("JockeyTorso"), p.silk);
            setNodeMat(this.jockeyNode.getChildByName("JockeyCap"), p.silkCap);
            setNodeMat(this.jockeyNode.getChildByName("JockeyFace"), new Color(235, 192, 165, 255));
            setNodeMat(this.jockeyNode.getChildByName("JockeyGoggles"), new Color(20, 24, 32, 255));
            setNodeMat(this.jockeyNode.getChildByName("JockeyLegs"), new Color(248, 250, 255, 255));
            setNodeMat(this.jockeyNode.getChildByName("JockeyBootL"), new Color(18, 16, 16, 255));
            setNodeMat(this.jockeyNode.getChildByName("JockeyBootR"), new Color(18, 16, 16, 255));
            setNodeMat(this.jockeyNode.getChildByName("JockeyArmL"), p.silk);
            setNodeMat(this.jockeyNode.getChildByName("JockeyArmR"), p.silk);
            setNodeMat(this.jockeyNode.getChildByName("JockeyGloveL"), new Color(242, 244, 248, 255));
            setNodeMat(this.jockeyNode.getChildByName("JockeyGloveR"), new Color(242, 244, 248, 255));
            if (this.jockeyWhipNode) {
                setNodeMat(this.jockeyWhipNode, new Color(28, 24, 20, 255));
            }
        }
    }

    // =========================================================================
    // 真实步态物理动力学演算
    // =========================================================================

    protected update(dt: number): void {
        this.animTime += dt * this.animSpeed;
        this.evaluateKinematics(this.animTime, dt);
        this.updateDustParticles(dt);

        if (this.targetMarkerNode && this.targetMarkerNode.isValid && this.isBetTarget) {
            const spinY = (this.animTime * 150) % 360;
            this.targetMarkerNode.setRotationFromEuler(180, spinY, 0);
            this.targetMarkerNode.setPosition(0.05, 2.50 + Math.sin(this.animTime * 4.2) * 0.12, 0);
        }
    }

    private evaluateKinematics(t: number, dt: number): void {
        if (!this.bodyRoot || !this.torsoNode) return;

        if (this.currentAction === "Gallop" || this.currentAction === "Sprint" || this.currentAction === "Finish") {
            const isFinish = this.currentAction === "Finish";
            const isSprint = this.isSprinting || isFinish;
            const freq = isFinish ? 15.0 : (this.isSprinting ? 13.5 : 10.2);
            const phase = t * freq;

            // 1. 躯干起伏与前后俯仰 (Z 轴俯仰)
            const bobY = 1.15 + Math.sin(phase) * (isSprint ? 0.14 : 0.10);
            const pitchZ = Math.sin(phase + 0.3) * (isFinish ? 8.5 : (isSprint ? 7.0 : 5.5));
            const rollX = Math.cos(phase * 0.5) * 0.8;
            this.torsoNode.setPosition(0, bobY, 0);
            this.torsoNode.setRotationFromEuler(rollX, 0, pitchZ);

            // 2. 颈部与头部向前延伸
            if (this.neckNode) {
                const baseNeck = isFinish ? 18 : (isSprint ? 24 : 32);
                const neckPitch = baseNeck + Math.sin(phase - 0.4) * 4.5;
                this.neckNode.setRotationFromEuler(0, 0, neckPitch);
            }
            if (this.headNode) {
                const baseHead = isFinish ? -28 : (isSprint ? -38 : -46);
                const headPitch = baseHead + Math.cos(phase) * 3.5;
                this.headNode.setRotationFromEuler(0, 0, headPitch);
            }

            // 3. 尾巴迎风高扬
            if (this.tailJointNode) {
                const tailAngle = -42 + Math.sin(phase * 1.3) * 12.0;
                this.tailJointNode.setRotationFromEuler(0, 0, tailAngle);
            }

            // 4. 前肢奔腾蹬地
            const flPhase = phase;
            const frPhase = phase + 0.60;

            if (this.frontLeftUpper && this.frontLeftLower) {
                const upperRot = Math.sin(flPhase) * (isFinish ? 42 : 36) - 4;
                const lowerRot = Math.max(0, -Math.sin(flPhase + 0.4) * (isFinish ? 65 : 56));
                this.frontLeftUpper.setRotationFromEuler(0, 0, upperRot);
                this.frontLeftLower.setRotationFromEuler(0, 0, lowerRot);
            }

            if (this.frontRightUpper && this.frontRightLower) {
                const upperRot = Math.sin(frPhase) * (isFinish ? 42 : 36) - 4;
                const lowerRot = Math.max(0, -Math.sin(frPhase + 0.4) * (isFinish ? 65 : 56));
                this.frontRightUpper.setRotationFromEuler(0, 0, upperRot);
                this.frontRightLower.setRotationFromEuler(0, 0, lowerRot);
            }

            // 5. 后肢爆发蹬跃
            const blPhase = phase + Math.PI * 0.85;
            const brPhase = phase + Math.PI * 0.85 + 0.45;

            if (this.backLeftUpper && this.backLeftLower) {
                const upperRot = -12 + Math.sin(blPhase) * 36;
                const lowerRot = 16 + Math.max(0, Math.sin(blPhase - 0.5) * 42);
                this.backLeftUpper.setRotationFromEuler(0, 0, upperRot);
                this.backLeftLower.setRotationFromEuler(0, 0, lowerRot);
            }

            if (this.backRightUpper && this.backRightLower) {
                const upperRot = -12 + Math.sin(brPhase) * 36;
                const lowerRot = 16 + Math.max(0, Math.sin(brPhase - 0.5) * 42);
                this.backRightUpper.setRotationFromEuler(0, 0, upperRot);
                this.backRightLower.setRotationFromEuler(0, 0, lowerRot);
            }

            // 6. 骑师贴背动感姿态与策马挥鞭
            if (this.jockeyNode && this.showJockey) {
                const jockeyBob = 0.46 + Math.sin(phase + 0.2) * (isSprint ? 0.045 : 0.03);
                const tuckForward = isSprint ? 0.08 : 0.05;
                const tuckPitch = isSprint ? -10 : -6;
                this.jockeyNode.setPosition(tuckForward, jockeyBob, 0);
                this.jockeyNode.setRotationFromEuler(0, 0, tuckPitch + Math.sin(phase + 0.3) * 3.5);
            }
            if (this.jockeyWhipNode && this.showJockey) {
                const whipFlick = isSprint ? Math.sin(phase * 2.2) * 28 : Math.sin(phase) * 10;
                this.jockeyWhipNode.setRotationFromEuler(20, 0, -45 + whipFlick);
            }

            // 7. 贴地动态阴影形变与缩放 (悬空时微缩，下踏时延展)
            if (this.groundShadowNode) {
                const shadowScaleX = 1.0 - (bobY - 1.15) * 0.45;
                const shadowScaleZ = 1.0 - (bobY - 1.15) * 0.45;
                this.groundShadowNode.setScale(shadowScaleX, 1, shadowScaleZ);
            }

            // 8. 蹄下扬沙
            this.spawnDust(dt);

        } else if (this.currentAction === "Trot") {
            const phase = t * 6.0;
            this.torsoNode.setPosition(0, 1.15 + Math.abs(Math.sin(phase)) * 0.06, 0);
            this.torsoNode.setRotationFromEuler(0, 0, Math.sin(phase) * 2.2);

            if (this.neckNode) this.neckNode.setRotationFromEuler(0, 0, 34 + Math.sin(phase) * 2.5);
            if (this.frontLeftUpper) this.frontLeftUpper.setRotationFromEuler(0, 0, Math.sin(phase) * 22);
            if (this.frontRightUpper) this.frontRightUpper.setRotationFromEuler(0, 0, -Math.sin(phase) * 22);
            if (this.backLeftUpper) this.backLeftUpper.setRotationFromEuler(0, 0, -12 - Math.sin(phase) * 18);
            if (this.backRightUpper) this.backRightUpper.setRotationFromEuler(0, 0, -12 + Math.sin(phase) * 18);
            if (this.groundShadowNode) this.groundShadowNode.setScale(1.0, 1.0, 1.0);

        } else if (this.currentAction === "Rear") {
            // 昂首起扬 (保持头部处于画幅安全区内)
            const pitch = 26 + Math.sin(t * 3.2) * 3.5;
            this.torsoNode.setPosition(-0.16, 1.25, 0);
            this.torsoNode.setRotationFromEuler(0, 0, pitch);

            if (this.neckNode) this.neckNode.setRotationFromEuler(0, 0, 40 + Math.sin(t * 3.5) * 4);
            if (this.headNode) this.headNode.setRotationFromEuler(0, 0, -42 + Math.sin(t * 3.5) * 3);
            if (this.tailJointNode) this.tailJointNode.setRotationFromEuler(0, 0, -42);

            if (this.frontLeftUpper) this.frontLeftUpper.setRotationFromEuler(0, 0, 42 + Math.sin(t * 6) * 14);
            if (this.frontRightUpper) this.frontRightUpper.setRotationFromEuler(0, 0, 50 - Math.sin(t * 6) * 14);
            if (this.backLeftUpper) this.backLeftUpper.setRotationFromEuler(0, 0, -24);
            if (this.backRightUpper) this.backRightUpper.setRotationFromEuler(0, 0, -24);
            if (this.groundShadowNode) this.groundShadowNode.setScale(0.85, 1.0, 0.9);

        } else if (this.currentAction === "Graze") {
            // 低头吃草
            const chew = Math.sin(t * 6.5) * 0.015;
            this.torsoNode.setPosition(0, 1.10 + chew, 0);
            this.torsoNode.setRotationFromEuler(0, 0, -6);

            if (this.neckNode) this.neckNode.setRotationFromEuler(0, 0, -26 + Math.sin(t * 1.5) * 2.5);
            if (this.headNode) this.headNode.setRotationFromEuler(0, 0, -32 + Math.sin(t * 6.0) * 3.5);
            if (this.tailJointNode) this.tailJointNode.setRotationFromEuler(0, 0, -8 + Math.sin(t * 1.8) * 5);

            if (this.frontLeftUpper) this.frontLeftUpper.setRotationFromEuler(0, 0, 4);
            if (this.frontRightUpper) this.frontRightUpper.setRotationFromEuler(0, 0, 4);
            if (this.backLeftUpper) this.backLeftUpper.setRotationFromEuler(0, 0, -14);
            if (this.backRightUpper) this.backRightUpper.setRotationFromEuler(0, 0, -14);
            if (this.groundShadowNode) this.groundShadowNode.setScale(1.0, 1.0, 1.0);

        } else {
            // 典雅昂立 (Stand / Idle: 冠军名驹轩昂傲立)
            const breathe = Math.sin(t * 1.8) * 0.008;
            this.torsoNode.setPosition(0, 1.15 + breathe, 0);
            this.torsoNode.setRotationFromEuler(0, 0, 0);

            if (this.neckNode) this.neckNode.setRotationFromEuler(0, 0, 40 + Math.sin(t * 1.4) * 1.2);
            if (this.headNode) this.headNode.setRotationFromEuler(0, 0, -32 + Math.sin(t * 1.8) * 1.0);
            if (this.tailJointNode) this.tailJointNode.setRotationFromEuler(0, 0, -6 + Math.sin(t * 1.6) * 3.5);

            if (this.frontLeftUpper) this.frontLeftUpper.setRotationFromEuler(0, 0, 0);
            if (this.frontRightUpper) this.frontRightUpper.setRotationFromEuler(0, 0, 0);
            if (this.backLeftUpper) this.backLeftUpper.setRotationFromEuler(0, 0, -10);
            if (this.backRightUpper) this.backRightUpper.setRotationFromEuler(0, 0, -10);
            if (this.frontLeftLower) this.frontLeftLower.setRotationFromEuler(0, 0, 0);
            if (this.frontRightLower) this.frontRightLower.setRotationFromEuler(0, 0, 0);
            if (this.backLeftLower) this.backLeftLower.setRotationFromEuler(0, 0, 10);
            if (this.backRightLower) this.backRightLower.setRotationFromEuler(0, 0, 10);
            if (this.jockeyNode && this.showJockey) {
                this.jockeyNode.setPosition(0.05, 0.46, 0);
                this.jockeyNode.setRotationFromEuler(0, 0, -5);
            }
            if (this.jockeyWhipNode && this.showJockey) {
                this.jockeyWhipNode.setRotationFromEuler(15, 0, -35);
            }
            if (this.groundShadowNode) {
                const s = 1.0 - breathe * 0.3;
                this.groundShadowNode.setScale(s, 1.0, s);
            }
        }
    }

    // =========================================================================
    // 沙尘粒子系统
    // =========================================================================

    private ensureDustRoot(): Node | null {
        if (this.dustRoot && this.dustRoot.isValid) {
            return this.dustRoot;
        }
        const parentNode = this.node.parent || this.node;
        this.dustRoot = new Node(`DustPool_${this.node.name}`);
        this.dustRoot.layer = Layers.Enum.DEFAULT;
        parentNode.addChild(this.dustRoot);
        return this.dustRoot;
    }

    private spawnDust(dt: number): void {
        this.nextDustTime -= dt;
        if (this.nextDustTime > 0) return;
        this.nextDustTime = this.isSprinting ? 0.06 : 0.10;

        const root = this.ensureDustRoot();
        if (!root) return;

        let p = this.dustParticles.find(item => item.life <= 0);
        if (!p) {
            const pNode = new Node("DustPart");
            pNode.layer = Layers.Enum.DEFAULT;
            root.addChild(pNode);
            const mr = pNode.addComponent(MeshRenderer);
            mr.mesh = HorseEntity3D.getCylinderMesh(0.10, 0.14, 0.12, 8, true, true);
            if (!HorseEntity3D.dustMaterialCache) {
                HorseEntity3D.dustMaterialCache = HorseEntity3D.getMaterial(new Color(195, 165, 125, 200));
            }
            mr.material = HorseEntity3D.dustMaterialCache;

            p = {
                node: pNode,
                life: 0,
                maxLife: 0.50,
                velocity: new Vec3()
            };
            this.dustParticles.push(p);
        }

        p.node.active = true;
        p.life = 0.50;
        p.maxLife = 0.50;
        const sideOff = (Math.random() - 0.5) * 0.7;

        p.node.setPosition(-1.1, 0.12, sideOff);
        p.velocity.set(
            -2.2 - Math.random() * 1.8,
            1.0 + Math.random() * 1.2,
            (Math.random() - 0.5) * 1.0
        );
        p.node.setScale(0.16, 0.16, 0.16);
    }

    private updateDustParticles(dt: number): void {
        for (const p of this.dustParticles) {
            if (p.life <= 0) continue;
            p.life -= dt;
            if (p.life <= 0) {
                p.node.active = false;
                continue;
            }

            const curPos = p.node.position;
            p.node.setPosition(
                curPos.x + p.velocity.x * dt,
                curPos.y + p.velocity.y * dt,
                curPos.z + p.velocity.z * dt
            );

            const scale = 0.16 + (1 - p.life / p.maxLife) * 0.35;
            p.node.setScale(scale, scale, scale);
        }
    }
}

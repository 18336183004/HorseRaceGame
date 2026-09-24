/**
 * 赛马 2D 高清贴图资产数据中心 (HorseSprites)
 * 支持 20 匹成年名驹 (H01-H20) 与小马驹各成长阶段的透明跑道精灵 (Sprite)、
 * 油画艺术展示图 (Showcase) 与解剖三视图 (Ortho)。
 * 支持本地路径动态加载与内存缓存，全面兼容静态贴图路径与 DataURI。
 */

import { ImageAsset, Sprite, SpriteFrame, Texture2D, Node, assetManager, Rect, Size } from "cc";
import { HorseAssetRegistry, HorseProfile, FoalGrowthStage } from "./HorseAssetRegistry";
import { ClientConfig } from "./ClientConfig";

export interface HorseSpriteItem {
    horseNo: number;
    nameZh: string;
    nameEn: string;
    spriteUri: string;      // 面向终点线（向右）的透明 2D 跑道精灵
    showcaseUri: string;    // 2D 艺术油画展示大图
    orthoUri: string;       // 解剖三视图大图
    orthoSideUri: string;   // 解剖侧视大图
    orthoFrontUri: string;  // 解剖正视大图
    orthoBackUri: string;   // 解剖后视大图
    gallopUri: string;      // 8 帧专属袭步图集 (1024x128)
    jockeyUri: string;      // 8 帧专属骑师彩衣图集 (1024x128)
}

export const HORSE_SPRITES_DATA: Record<number, HorseSpriteItem> = {};

// 动态注册 1-20 匹名驹标准资产路径
for (const horse of HorseAssetRegistry.HORSES) {
    const fileBase = horse.showcaseUrl.replace("textures/horses/", "").replace("_Showcase", "");
    HORSE_SPRITES_DATA[horse.horseNo] = {
        horseNo: horse.horseNo,
        nameZh: horse.nameZh,
        nameEn: horse.nameEn,
        spriteUri: `textures/horses/${fileBase}_Sprite.png`,
        showcaseUri: `textures/horses/${fileBase}_Showcase.png`,
        orthoUri: `textures/horses/${fileBase}_Ortho.png`,
        orthoSideUri: `textures/horses/${fileBase}_Ortho_Side.png`,
        orthoFrontUri: `textures/horses/${fileBase}_Ortho_Front.png`,
        orthoBackUri: `textures/horses/${fileBase}_Ortho_Back.png`,
        gallopUri: `textures/horses/${fileBase}_Gallop_8f.png`,
        jockeyUri: `textures/horses/${fileBase}_Jockey_8f.png`,
    };
}

export const FOAL_STAGES_DATA: Record<number, string> = {
    1: "textures/foals/F01_WildBreeze_Stage1_Foal.png",
    2: "textures/foals/F01_WildBreeze_Stage2_Yearling.png",
    3: "textures/foals/F01_WildBreeze_Stage3_Adult.png",
    4: "textures/foals/F01_WildBreeze_Stage4_Pro.png",
};

export class HorseSprites {
    private static frameCache: Map<string, SpriteFrame> = new Map();
    private static accessTimestamps: Map<string, number> = new Map();
    private static permanentKeys: Set<string> = new Set();
    private static readonly MAX_LRU_ENTRIES: number = 24;

    /** 判断资源是否属于常驻白名单（如跑道 8 帧奔跑图集与标准小马精灵） */
    private static isPermanentAsset(key: string): boolean {
        return (
            key.includes("Gallop") ||
            key.includes("Jockey") ||
            key.includes("Sprite") ||
            key.includes("sheet") ||
            HorseSprites.permanentKeys.has(key)
        );
    }

    /** 写入缓存并维护 LRU 淘汰机制 */
    private static cacheSet(key: string, spriteFrame: SpriteFrame, isPermanent: boolean = false): void {
        if (!key || !spriteFrame) return;
        this.frameCache.set(key, spriteFrame);
        this.accessTimestamps.set(key, Date.now());
        if (isPermanent || this.isPermanentAsset(key)) {
            this.permanentKeys.add(key);
        } else {
            this.enforceLruLimit();
        }
    }

    /** 读取缓存并刷新最后访问时间戳 */
    private static cacheGet(key: string): SpriteFrame | undefined {
        const sf = this.frameCache.get(key);
        if (sf && sf.isValid) {
            this.accessTimestamps.set(key, Date.now());
            return sf;
        }
        return undefined;
    }

    /** 执行 LRU 淘汰，安全释放超出上限的高清纹理（优先回收未使用的画廊展示立绘/三视图） */
    public static enforceLruLimit(): void {
        const evictableKeys: Array<{ key: string; time: number }> = [];
        for (const [key, time] of this.accessTimestamps.entries()) {
            if (!this.permanentKeys.has(key) && !this.isPermanentAsset(key)) {
                evictableKeys.push({ key, time });
            }
        }

        if (evictableKeys.length <= this.MAX_LRU_ENTRIES) return;

        // 按访问时间升序排序（最旧的排在前面）
        evictableKeys.sort((a, b) => a.time - b.time);
        const toEvictCount = evictableKeys.length - this.MAX_LRU_ENTRIES;

        for (let i = 0; i < toEvictCount; i++) {
            const victimKey = evictableKeys[i].key;
            const sf = this.frameCache.get(victimKey);
            this.frameCache.delete(victimKey);
            this.accessTimestamps.delete(victimKey);

            if (sf && sf.isValid) {
                if (sf.texture && sf.texture.isValid) {
                    try {
                        sf.texture.destroy();
                    } catch {
                        // ignore
                    }
                }
                try {
                    sf.destroy();
                } catch {
                    // ignore
                }
            }
        }
    }

    /** 关闭画廊弹窗或内存吃紧时主动调用，清除非活跃大图缓存 */
    public static clearGalleryCache(): void {
        const toDelete: string[] = [];
        for (const [key] of this.frameCache.entries()) {
            if (!this.permanentKeys.has(key) && !this.isPermanentAsset(key)) {
                toDelete.push(key);
            }
        }
        for (const key of toDelete) {
            const sf = this.frameCache.get(key);
            this.frameCache.delete(key);
            this.accessTimestamps.delete(key);
            if (sf && sf.isValid) {
                if (sf.texture && sf.texture.isValid) {
                    try {
                        sf.texture.destroy();
                    } catch {
                        // ignore
                    }
                }
                try {
                    sf.destroy();
                } catch {
                    // ignore
                }
            }
        }
    }

    /** 核心加载方法：支持相对路径、绝对 URL 与 DataURI */
    public static applyImage(
        targetNode: Node,
        pathOrUri: string,
        onLoaded?: (spriteFrame: SpriteFrame) => void
    ): void {
        if (!targetNode || !targetNode.isValid || !pathOrUri) return;

        const cached = this.cacheGet(pathOrUri);
        if (cached && cached.isValid) {
            const sp = targetNode.getComponent(Sprite) || targetNode.addComponent(Sprite);
            sp.spriteFrame = cached;
            if (onLoaded) onLoaded(cached);
            return;
        }

        // 1. DataURI 处理
        if (pathOrUri.startsWith("data:")) {
            this.loadViaHtmlImage(targetNode, pathOrUri, pathOrUri, (sf) => {
                if (sf && onLoaded) onLoaded(sf);
            });
            return;
        }

        // 2. 规范化静态文件路径
        let cleanPath = pathOrUri;
        if (!cleanPath.endsWith(".png") && !cleanPath.endsWith(".jpg") && !cleanPath.endsWith(".jpeg")) {
            cleanPath += ".png";
        }

        const apiBase = (ClientConfig.apiBaseUrl || "http://localhost:55230").replace(/\/$/, "");
        const rawRelative = cleanPath.replace(/^\.?\//, "");
        const candidates = [
            `${apiBase}/${rawRelative}`,
            `${apiBase}/assets/${rawRelative}`,
            cleanPath,
            `assets/${cleanPath}`,
            `./${cleanPath}`,
            `./assets/${cleanPath}`,
        ];

        this.tryLoadCandidates(targetNode, pathOrUri, candidates, 0, onLoaded);
    }

    /** 兼容旧版 applyDataUri 接口 */
    public static applyDataUri(
        targetNode: Node,
        dataUriOrPath: string,
        onLoaded?: (spriteFrame: SpriteFrame) => void
    ): void {
        this.applyImage(targetNode, dataUriOrPath, onLoaded);
    }

    private static tryLoadCandidates(
        targetNode: Node,
        originalKey: string,
        candidates: string[],
        index: number,
        onLoaded?: (sf: SpriteFrame) => void
    ) {
        if (index >= candidates.length) {
            // 所有路径尝试完毕仍未成功，使用 DOM Image 最终尝试原始路径
            this.loadViaHtmlImage(targetNode, candidates[0], originalKey, (sf) => {
                if (sf && onLoaded) onLoaded(sf);
            });
            return;
        }

        const curUrl = candidates[index];

        // 优先使用 Cocos assetManager.loadRemote
        if (typeof assetManager !== "undefined" && assetManager && assetManager.loadRemote) {
            assetManager.loadRemote<ImageAsset>(curUrl, { ext: ".png" }, (err, imageAsset) => {
                if (!err && imageAsset && imageAsset.isValid) {
                    if (!targetNode || !targetNode.isValid) return;
                    const texture = new Texture2D();
                    texture.image = imageAsset;
                    const spriteFrame = new SpriteFrame();
                    spriteFrame.texture = texture;
                    spriteFrame.rect = new Rect(0, 0, imageAsset.width, imageAsset.height);
                    spriteFrame.originalSize = new Size(imageAsset.width, imageAsset.height);

                    HorseSprites.cacheSet(originalKey, spriteFrame);
                    HorseSprites.cacheSet(curUrl, spriteFrame);

                    const sp = targetNode.getComponent(Sprite) || targetNode.addComponent(Sprite);
                    sp.spriteFrame = spriteFrame;
                    if (onLoaded) onLoaded(spriteFrame);
                } else {
                    // 尝试用 HTML Image 加载当前路径，若仍失败则尝试下一个 candidate
                    this.loadViaHtmlImage(targetNode, curUrl, originalKey, (sf) => {
                        if (sf) {
                            if (onLoaded) onLoaded(sf);
                        } else {
                            this.tryLoadCandidates(targetNode, originalKey, candidates, index + 1, onLoaded);
                        }
                    });
                }
            });
        } else {
            this.loadViaHtmlImage(targetNode, curUrl, originalKey, (sf) => {
                if (sf) {
                    if (onLoaded) onLoaded(sf);
                } else {
                    this.tryLoadCandidates(targetNode, originalKey, candidates, index + 1, onLoaded);
                }
            });
        }
    }

    private static loadViaHtmlImage(
        targetNode: Node,
        srcUrl: string,
        cacheKey: string,
        callback?: (sf: SpriteFrame | null) => void
    ) {
        if (typeof Image === "undefined") {
            if (callback) callback(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            if (!targetNode || !targetNode.isValid) {
                if (callback) callback(null);
                return;
            }
            try {
                const imageAsset = new ImageAsset(img);
                const texture = new Texture2D();
                texture.image = imageAsset;
                const spriteFrame = new SpriteFrame();
                spriteFrame.texture = texture;
                spriteFrame.rect = new Rect(0, 0, imageAsset.width, imageAsset.height);
                spriteFrame.originalSize = new Size(imageAsset.width, imageAsset.height);

                HorseSprites.cacheSet(cacheKey, spriteFrame);
                HorseSprites.cacheSet(srcUrl, spriteFrame);

                const sp = targetNode.getComponent(Sprite) || targetNode.addComponent(Sprite);
                sp.spriteFrame = spriteFrame;
                if (callback) callback(spriteFrame);
            } catch (e) {
                if (callback) callback(null);
            }
        };
        img.onerror = () => {
            if (callback) callback(null);
        };
        img.src = srcUrl;
    }

    /** 获取指定马号的精灵与图鉴数据项 (支持 1-20) */
    public static getHorseItem(horseNo: number): HorseSpriteItem {
        const no = Math.max(1, Math.min(20, horseNo));
        if (HORSE_SPRITES_DATA[no]) {
            return HORSE_SPRITES_DATA[no];
        }
        const horse = HorseAssetRegistry.getHorseByNo(no);
        const fileBase = horse.showcaseUrl.replace("textures/horses/", "").replace("_Showcase", "");
        return {
            horseNo: horse.horseNo,
            nameZh: horse.nameZh,
            nameEn: horse.nameEn,
            spriteUri: `textures/horses/${fileBase}_Sprite.png`,
            showcaseUri: `textures/horses/${fileBase}_Showcase.png`,
            orthoUri: `textures/horses/${fileBase}_Ortho.png`,
            orthoSideUri: `textures/horses/${fileBase}_Ortho_Side.png`,
            orthoFrontUri: `textures/horses/${fileBase}_Ortho_Front.png`,
            orthoBackUri: `textures/horses/${fileBase}_Ortho_Back.png`,
            gallopUri: `textures/horses/${fileBase}_Gallop_8f.png`,
            jockeyUri: `textures/horses/${fileBase}_Jockey_8f.png`,
        };
    }

    /** 为指定马号 (1-20) 绑定透明 2D 跑道精灵 */
    public static applyHorseRunningSprite(
        targetNode: Node,
        horseNo: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const item = this.getHorseItem(horseNo);
        this.applyImage(targetNode, item.spriteUri, onLoaded);
    }

    /** 为指定马号 (1-20) 绑定 2D 油画艺术展示图 */
    public static applyHorseShowcase(
        targetNode: Node,
        horseNo: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const item = this.getHorseItem(horseNo);
        this.applyImage(targetNode, item.showcaseUri, onLoaded);
    }

    /** 为指定马号 (1-20) 绑定解剖三视图大图 (全景) */
    public static applyHorseOrtho(
        targetNode: Node,
        horseNo: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const item = this.getHorseItem(horseNo);
        this.applyImage(targetNode, item.orthoUri, onLoaded);
    }

    /** 为指定马号 (1-20) 绑定解剖侧视大图 */
    public static applyHorseOrthoSide(
        targetNode: Node,
        horseNo: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const item = this.getHorseItem(horseNo);
        this.applyImage(targetNode, item.orthoSideUri, onLoaded);
    }

    /** 为指定马号 (1-20) 绑定解剖正视大图 */
    public static applyHorseOrthoFront(
        targetNode: Node,
        horseNo: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const item = this.getHorseItem(horseNo);
        this.applyImage(targetNode, item.orthoFrontUri, onLoaded);
    }

    /** 为指定马号 (1-20) 绑定解剖后视大图 */
    public static applyHorseOrthoBack(
        targetNode: Node,
        horseNo: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const item = this.getHorseItem(horseNo);
        this.applyImage(targetNode, item.orthoBackUri, onLoaded);
    }

    public static readonly FOAL_META: { idx: number; fileBase: string }[] = [
        { idx: 1, fileBase: "F01_WildBreeze" },
        { idx: 2, fileBase: "F02_DesertGazelle" },
        { idx: 3, fileBase: "F03_LittleTumbleweed" },
        { idx: 4, fileBase: "F04_SpeckledLark" },
        { idx: 5, fileBase: "F05_RedRockFoal" },
        { idx: 6, fileBase: "F06_CanyonEcho" },
        { idx: 7, fileBase: "F07_MorningDew" },
        { idx: 8, fileBase: "F08_GoldenSand" },
        { idx: 9, fileBase: "F09_DuskFlame" },
        { idx: 10, fileBase: "F10_PrairieAntelope" },
        { idx: 11, fileBase: "F11_WyomingDawn" },
        { idx: 12, fileBase: "F12_PrairieSun" },
        { idx: 13, fileBase: "F13_SnowpeakShadow" },
        { idx: 14, fileBase: "F14_CopperHoof" },
        { idx: 15, fileBase: "F15_GoldenManeCub" },
        { idx: 16, fileBase: "F16_SwallowSpin" },
        { idx: 17, fileBase: "F17_Pinewind" },
        { idx: 18, fileBase: "F18_RussetStar" },
        { idx: 19, fileBase: "F19_FieldDreamer" },
        { idx: 20, fileBase: "F20_Snowdapple" }
    ];

    /** 绑定小马驹成长阶段图片 (支持各幼驹编号 1-20 与阶段 1-4) */
    public static applyFoalStage(
        targetNode: Node,
        stage: number,
        foalNo?: number,
        onLoaded?: (sf: SpriteFrame) => void
    ): void {
        const stageIdx = Math.max(0, Math.min(3, stage - 1));
        const stageSuffixes = ["Stage1_Foal", "Stage2_Yearling", "Stage3_Adult", "Stage4_Pro"];
        const sName = stageSuffixes[stageIdx];

        let uri = "";
        if (foalNo && foalNo >= 1 && foalNo <= this.FOAL_META.length) {
            const fb = this.FOAL_META[foalNo - 1].fileBase;
            uri = `textures/foals/${fb}_${sName}.png`;
        } else {
            uri = FOAL_STAGES_DATA[stage] || `textures/foals/F01_WildBreeze_${sName}.png`;
        }
        this.applyImage(targetNode, uri, onLoaded);
    }

    private static gallopCacheByHorse: Map<number, { horseFrames: SpriteFrame[]; jockeyFrames: SpriteFrame[] }> = new Map();
    private static gallopCallbacksByHorse: Map<number, Array<(h: SpriteFrame[], j: SpriteFrame[]) => void>> = new Map();

    /**
     * 按马号 (1-20) 载入该名驹独有 8 帧奔跑与骑师彩衣图集
     * 自动优先读取 Hxx_Name_Gallop_8f.png，确保 20 匹马各具独特毛色、白章与彩衣
     */
    public static loadHorseGallopAnimation(
        horseNo: number,
        callback: (horseFrames: SpriteFrame[], jockeyFrames: SpriteFrame[]) => void
    ): void {
        const no = Math.max(1, Math.min(20, horseNo));
        const cached = this.gallopCacheByHorse.get(no);
        if (cached) {
            callback(cached.horseFrames, cached.jockeyFrames);
            return;
        }

        const item = this.getHorseItem(no);
        const horseGallopPath = item.gallopUri || `textures/horses/H01_CrimsonMeteor_Gallop_8f.png`;
        const jockeyGallopPath = item.jockeyUri || `textures/horses/H01_CrimsonMeteor_Jockey_8f.png`;

        let list = this.gallopCallbacksByHorse.get(no);
        if (list) {
            list.push(callback);
            return;
        }
        list = [callback];
        this.gallopCallbacksByHorse.set(no, list);

        const dummy = new Node(`GallopLoader_${no}`);
        this.applyImage(dummy, horseGallopPath, (hSf) => {
            if (!hSf || !hSf.texture) {
                // 回退到全局通用
                this.loadGallopAnimation((fallbackH, fallbackJ) => {
                    dummy.destroy();
                    this.gallopCacheByHorse.set(no, { horseFrames: fallbackH, jockeyFrames: fallbackJ });
                    const cbs = this.gallopCallbacksByHorse.get(no) || [];
                    this.gallopCallbacksByHorse.delete(no);
                    cbs.forEach((cb) => cb(fallbackH, fallbackJ));
                });
                return;
            }

            const hTex = hSf.texture as Texture2D;
            const hFrames: SpriteFrame[] = [];
            for (let i = 0; i < 8; i++) {
                const sf = new SpriteFrame();
                sf.texture = hTex;
                sf.rect = new Rect(i * 128, 0, 128, 128);
                sf.originalSize = new Size(128, 128);
                hFrames.push(sf);
            }

            this.applyImage(dummy, jockeyGallopPath, (jSf) => {
                dummy.destroy();
                const jFrames: SpriteFrame[] = [];
                if (jSf && jSf.texture) {
                    const jTex = jSf.texture as Texture2D;
                    for (let i = 0; i < 8; i++) {
                        const sf = new SpriteFrame();
                        sf.texture = jTex;
                        sf.rect = new Rect(i * 128, 0, 128, 128);
                        sf.originalSize = new Size(128, 128);
                        jFrames.push(sf);
                    }
                }
                const entry = { horseFrames: hFrames, jockeyFrames: jFrames };
                this.gallopCacheByHorse.set(no, entry);
                const cbs = this.gallopCallbacksByHorse.get(no) || [];
                this.gallopCallbacksByHorse.delete(no);
                cbs.forEach((cb) => cb(hFrames, jFrames));
            });
        });
    }

    private static gallopHorseFrames: SpriteFrame[] | null = null;
    private static gallopJockeyFrames: SpriteFrame[] | null = null;
    private static isGallopLoading: boolean = false;
    private static gallopCallbacks: Array<(hFrames: SpriteFrame[], jFrames: SpriteFrame[]) => void> = [];

    /**
     * 加载 8 帧标准奔跑序列图集 (Horse & Jockey)
     * 自动完成 1024x128 图集切片并缓存 8 个 SpriteFrame
     */
    public static loadGallopAnimation(
        callback: (horseFrames: SpriteFrame[], jockeyFrames: SpriteFrame[]) => void
    ): void {
        if (this.gallopHorseFrames && this.gallopJockeyFrames) {
            callback(this.gallopHorseFrames, this.gallopJockeyFrames);
            return;
        }

        this.gallopCallbacks.push(callback);
        if (this.isGallopLoading) return;
        this.isGallopLoading = true;

        const dummyNode = new Node("TempGallopLoader");
        const horsePath = "textures/horses/horse_gallop_sheet_8f.png";
        const jockeyPath = "textures/horses/jockey_ride_sheet_8f.png";

        this.applyImage(dummyNode, horsePath, (horseSf) => {
            if (!horseSf || !horseSf.texture) {
                this.isGallopLoading = false;
                dummyNode.destroy();
                return;
            }
            const horseTex = horseSf.texture as Texture2D;
            const hFrames: SpriteFrame[] = [];
            for (let i = 0; i < 8; i++) {
                const sf = new SpriteFrame();
                sf.texture = horseTex;
                sf.rect = new Rect(i * 128, 0, 128, 128);
                sf.originalSize = new Size(128, 128);
                hFrames.push(sf);
            }
            this.gallopHorseFrames = hFrames;

            // 载入骑师图集
            this.applyImage(dummyNode, jockeyPath, (jockeySf) => {
                dummyNode.destroy();
                this.isGallopLoading = false;
                if (jockeySf && jockeySf.texture) {
                    const jockeyTex = jockeySf.texture as Texture2D;
                    const jFrames: SpriteFrame[] = [];
                    for (let i = 0; i < 8; i++) {
                        const sf = new SpriteFrame();
                        sf.texture = jockeyTex;
                        sf.rect = new Rect(i * 128, 0, 128, 128);
                        sf.originalSize = new Size(128, 128);
                        jFrames.push(sf);
                    }
                    this.gallopJockeyFrames = jFrames;
                } else {
                    this.gallopJockeyFrames = [];
                }

                const cbs = [...this.gallopCallbacks];
                this.gallopCallbacks = [];
                cbs.forEach((cb) => cb(this.gallopHorseFrames!, this.gallopJockeyFrames!));
            });
        });
    }
}

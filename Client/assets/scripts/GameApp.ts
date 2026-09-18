import {
    Button,
    Camera,
    Color,
    Component,
    director,
    EditBox,
    Graphics,
    HorizontalTextAlignment,
    Label,
    Layers,
    Node,
    ResolutionPolicy,
    Sprite,
    UIOpacity,
    UITransform,
    Vec3,
    VerticalTextAlignment,
    tween,
    view,
    _decorator,
} from "cc";
import { ApiClient } from "./ApiClient";
import { ClientConfig } from "./ClientConfig";
import {
    AchievementClaimResponse,
    AchievementDto,
    BetOrderStatus,
    CharacterDto,
    ClaimCommissionResponse,
    CommentaryItemDto,
    DoubleDownResponseDto,
    NoticeDto,
    PaddockInfoDto,
    PlaceBetResponse,
    PlayerSummary,
    RaceEventPayload,
    RaceHorseDto,
    RaceRoundDto,
    RaceState,
    ReferralSummaryDto,
    TipsterRecommendationDto,
    RanchHorseSummaryDto,
    RanchHorseDetailDto,
    RanchHorseDto,
    RanchEquipmentDto,
    PlayerEquipmentDto,
    FeedResultDto,
    TrainResultDto,
    CareResultDto,
    TrialResultDto,
    BuybackResultDto,
    RanchQualificationTrialDto,
    RanchCatalogDto,
} from "./ApiTypes";
import { HorseController } from "./HorseController";
import { HorseVisual2D } from "./HorseVisual2D";
import { HorseGalleryModal } from "./HorseGalleryModal";
import { SignalRClient } from "./SignalRClient";
import { I18n } from "./I18n";
import { WestAudio } from "./WestAudio";
import { WestColors, WestStyle, WestThemeManager, ThemeMode } from "./WestTheme";
import { WEST_TEXTURES, WEST_HORSES_META, getHorseVisualMeta, applyWestTexture, preloadWestAssets } from "./WestAssets";
import { MaintenanceHelper } from "./MaintenanceHelper";
import { FairnessHelper } from "./FairnessHelper";
import { PariMutuelHelper } from "./PariMutuelHelper";
import { WestTypography, TypographyLevel } from "./WestTypography";
import { WestMotion } from "./WestMotion";
import { WestPerformance, QualityTier } from "./WestPerformance";

const { ccclass, property } = _decorator;

type Page =
    | "login"
    | "register"
    | "lobby"
    | "wallet"
    | "race"
    | "tasks"
    | "feat"
    | "stable"
    | "characters"
    | "ranking"
    | "shop"
    | "bets"
    | "notices"
    | "settings"
    | "result";

interface BetOrderItemDto {
    orderNo: string;
    roundId: number;
    playType?: string;
    horseNo: number;
    secondHorseNo?: number | null;
    combination?: string | null;
    betAmount: number;
    lockedOdds: number;
    grossReward?: number;
    feeRate?: number;
    feeAmount?: number;
    netReward: number;
    status: number;
    statusReason?: string | null;
    isDoubleDown?: boolean;
    doubleDownAmount?: number;
}

interface BetDetailDto {
    order: {
        orderNo: string;
        roundId: number;
        playType?: string;
        horseNo: number;
        secondHorseNo?: number | null;
        combination?: string | null;
        betAmount: number;
        lockedOdds: number;
        grossReward: number;
        feeRate: number;
        feeAmount: number;
        netReward: number;
        status: number;
        statusReason?: string | null;
        isDoubleDown?: boolean;
        doubleDownAmount?: number;
        createdAt: string;
        settledAt?: string | null;
    };
    race: {
        id: number;
        roundNo: string;
        state: number;
        winnerHorseNo?: number | null;
        horses: Array<{
            horseNo: number;
            horseNameZhSnapshot?: string;
            finalRank?: number | null;
            finishTime?: number | null;
            isBlackHorse?: boolean | null;
        }>;
    } | null;
    walletTransactions: Array<{
        transactionType: string;
        amount: number;
        balanceBefore: number;
        balanceAfter: number;
        feeRate: number;
        feeAmount: number;
        createdAt: string;
    }>;
}

interface HorseCatalogItemDto {
    horseId: number;
    horseCode: string;
    nameZh: string;
    nameEn: string;
    descriptionZh: string;
    descriptionEn: string;
    totalRaces: number;
    winCount: number;
    winRate: number;
    rank1Count: number;
    rank2Count: number;
    rank3Count: number;
    rank4Count: number;
    rank5Count: number;
    rank6Count: number;
    rank1Probability: number;
    rank2Probability: number;
    rank3Probability: number;
    rank4Probability: number;
    rank5Probability: number;
    rank6Probability: number;
}

/**
 * 赛马游戏轻量 Cocos UI 主控。
 * 遵循 racegame-project-standards 规范，严禁 any 类型。
 * 界面对标原型 1.png 设计规范，融合顶部 HUD、底部 5-Tab 导航、转赠、邀请与社誉成就系统。
 */
@ccclass("GameApp")
export class GameApp extends Component {
    @property(Node)
    public root: Node | null = null;

    private bgRoot: Node | null = null;
    private pageRoot: Node | null = null;
    private raceMessageLabel: Label | null = null;
    private page: Page = "login";
    private serverOffsetMs = 0;
    private round: RaceRoundDto | null = null;
    private player: PlayerSummary | null = null;
    private selectedHorse = 0;
    private betMode: "WIN" | "QUINELLA" | "PLACE" | "EXACTA" | "TRIFECTA" = "WIN";
    private selectedQuinellaCombo: string | null = null;
    private exactaFirstHorse = 0;
    private exactaSecondHorse = 0;
    private trifectaFirstHorse = 0;
    private trifectaSecondHorse = 0;
    private trifectaThirdHorse = 0;
    private trackRadarNode: Node | null = null;
    private liveRankLabel: Label | null = null;
    private photoFinishModalNode: Node | null = null;
    private isReadySubmitted = false;
    private stableSubTab: "catalog" | "my" = "catalog";
    private networkToastNode: Node | null = null;
    private amount = 10;
    private signalr: SignalRClient | null = null;
    private readonly horses = new Map<number, HorseController>();
    private message = "";
    private resultRoundId = 0;
    private raceTickTimer: ReturnType<typeof setTimeout> | null = null;
    private shakeInterval: ReturnType<typeof setInterval> | null = null;

    // 原型拓展状态
    private musicEnabled = true;
    private soundFxEnabled = true;
    private betMultiplier = 1;
    private selectedChip = 10;
    private activeJockeyIndex = 0;
    private recentWinners: number[] = [];
    private ranchCatalogCache: RanchCatalogDto | null = null;

    /** 动态从服务端获取全量马房配置字典（含幼驹档位、饲料、训练、理疗），避免硬编码 */
    private async fetchRanchCatalog(): Promise<RanchCatalogDto | null> {
        if (this.ranchCatalogCache) {
            return this.ranchCatalogCache;
        }
        try {
            const res = await ApiClient.getRanchCatalog();
            if (res.data) {
                this.ranchCatalogCache = res.data;
                return res.data;
            }
        } catch { }
        return null;
    }

    // 防重复提交与切页重入标记
    private isSubmitting = false;
    private isPageSwitching = false;
    private pageVersion = 0;
    private lastCountdownPollMs = 0;

    // 动态赛事解说与多模式戏剧冲突独立追踪
    private winLeaderHorseNo = 0;
    private winLastOvertakeAnnounceMs = 0;
    private winLastMessage = "";

    private quinellaLastTop2Combo = "";
    private quinellaLastDuelAnnounceMs = 0;
    private quinellaLastOvertakeAnnounceMs = 0;
    private quinellaLastMessage = "";

    private lastPackDensityAnnounceMs = 0;

    // 马场分页与详情状态
    private stablePage = 1;
    private stableTab: "MY_RANCH" | "NURSERY" | "SPONSOR" | "CATALOG" = "MY_RANCH";
    private selectedHorseCatalogId: number | null = null;
    private selectedRanchHorseId: number | null = null;

    // 注单详情下钻状态
    private selectedBetOrderNo: string | null = null;
    private loginDraftAccount = "";
    private widescreenRoot: Node | null = null;

    // 登录/注册页提示消息标签（原地更新，避免整页重建丢失输入框焦点与草稿）
    private authMessageLabel: Label | null = null;

    // 扩展玩法：解说跑马灯、亮相圈贴士、15s追投加倍与Photo Finish
    private raceCommentaryLabel: Label | null = null;
    private parsedCommentary: CommentaryItemDto[] = [];
    private lastScriptCommentarySec = -1;
    private paddockInfo: PaddockInfoDto | null = null;
    private myRoundOrders: BetOrderItemDto[] = [];
    private doubleDownBtnNode: Node | null = null;
    private isDoubleDownSubmitted = false;
    private photoFinishBannerNode: Node | null = null;

    // 下注确认按钮的实时状态刷新回调（比赛阶段切换时无需整页重建）
    private refreshRaceBetButton: (() => void) | null = null;

    private getAudioMode(): "WIN" | "QUINELLA" {
        return this.betMode === "QUINELLA" || this.betMode === "EXACTA" || this.betMode === "TRIFECTA" ? "QUINELLA" : "WIN";
    }

    /** 弹出全屏通用的沉浸式金字皮鞍 Toast 提示框（居中偏上，2 秒后优雅淡出）。 */
    private showToast(msg: string, color = WestColors.GOLD_BRIGHT): void {
        const root = this.pageRoot || this.node;
        if (!root || !root.isValid) return;

        const toastNode = new Node("ToastNode");
        toastNode.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(toastNode);

        const rootTrans = root.getComponent(UITransform);
        const ax = rootTrans ? rootTrans.anchorX : 0.5;
        const ay = rootTrans ? rootTrans.anchorY : 0.5;
        // 居中偏上：pageRoot (anchor 0,0) 下坐标为 (360, 950)，Canvas (anchor 0.5,0.5) 下坐标为 (0, 310)
        const posX = ax === 0 ? 360 : 0;
        const posY = ay === 0 ? 950 : 310;
        toastNode.setPosition(posX, posY, 0);
        toastNode.setSiblingIndex(999999);

        const trans = toastNode.addComponent(UITransform);
        trans.setContentSize(540, 48);

        const bg = this.woodBox(toastNode, 0, 0, 540, 48, 8, WestColors.WOOD_DARK, WestColors.GOLD_BRIGHT);
        this.text(bg, msg, 0, 0, 15, color);

        let toastOpacity = toastNode.getComponent(UIOpacity);
        if (!toastOpacity) {
            toastOpacity = toastNode.addComponent(UIOpacity);
        }
        toastOpacity.opacity = 0;
        toastNode.setScale(new Vec3(0.6, 0.6, 1));

        // 动画控制：0.15s 弹性弹出 -> 1.7s 停留显式 -> 0.15s 缩放渐隐，总计恰好 2.0 秒后自动销毁
        tween(toastOpacity)
            .to(0.15, { opacity: 255 })
            .delay(1.7)
            .to(0.15, { opacity: 0 })
            .start();

        tween(toastNode)
            .to(0.15, { scale: new Vec3(1, 1, 1) }, { easing: "backOut" })
            .delay(1.7)
            .to(0.15, { scale: new Vec3(0.6, 0.6, 1) }, { easing: "quadIn" })
            .call(() => {
                if (toastNode && toastNode.isValid) {
                    toastNode.destroy();
                }
            })
            .start();
    }

    /** 顶部悬浮弱网断线重连指示条。 */
    private showNetworkToast(isReconnecting: boolean): void {
        const root = this.pageRoot || this.node;
        if (!root || !root.isValid) return;

        const rootTrans = root.getComponent(UITransform);
        const ax = rootTrans ? rootTrans.anchorX : 0.5;
        const ay = rootTrans ? rootTrans.anchorY : 0.5;
        const posX = ax === 0 ? 360 : 0;
        const posY = ay === 0 ? 1220 : 580;

        if (!this.networkToastNode || !this.networkToastNode.isValid) {
            const toast = new Node("NetworkToast");
            toast.layer = Layers.Enum.UI_2D;
            root.addChild(toast);
            toast.setPosition(posX, posY, 0);
            toast.addComponent(UITransform).setContentSize(480, 36);
            toast.setSiblingIndex(999999);
            this.networkToastNode = toast;
        } else {
            this.networkToastNode.setPosition(posX, posY, 0);
        }

        const toast = this.networkToastNode;
        toast.removeAllChildren();
        toast.active = true;

        if (isReconnecting) {
            const bg = this.box(toast, 0, 0, 480, 34, WestColors.LEATHER_SADDLE, 6);
            this.box(bg, 0, 0, 474, 28, WestColors.WOOD_DARK, 4);
            this.text(bg, "⚡ 边境电报信号微弱，正在重新连通驿站...", 0, 0, 13, WestColors.GOLD_BRIGHT);
        } else {
            const bg = this.box(toast, 0, 0, 360, 34, WestColors.CACTUS_GREEN, 6);
            this.box(bg, 0, 0, 354, 28, WestColors.WOOD_DARK, 4);
            this.text(bg, "✅ 驿站电报通信已恢复正常", 0, 0, 13, WestColors.CREAM);
            this.scheduleOnce(() => {
                if (toast && toast.isValid) {
                    toast.active = false;
                }
            }, 2.0);
        }
    }

    /**
     * Cocos 生命周期入口。
     * 采用竖屏 FIXED_WIDTH、横屏 FIXED_HEIGHT 自适应策略，
     * 彻底消除 SHOW_ALL letterbox 导致的触控坐标与 Web DOM 输入框双重偏移错位。
     */
    public start(): void {
        view.enableRetina(true);
        this.setupResolutionPolicy();
        view.setResizeCallback(() => {
            this.setupResolutionPolicy();
            const mount = this.root ?? this.node;
            if (mount && mount.isValid && this.page) {
                this.updatePageBackground(mount, this.page);
            }
        });

        let rootTrans = this.node.getComponent(UITransform);
        if (!rootTrans) {
            rootTrans = this.node.addComponent(UITransform);
        }
        rootTrans.setContentSize(720, 1280);

        preloadWestAssets();
        I18n.init();
        WestThemeManager.init();
        WestPerformance.init();
        this.initAudioSettings();
        ApiClient.restoreToken();
        ApiClient.onSessionExpired = () => {
            if (this.page !== "login" && this.page !== "register") {
                this.signalr?.stop();
                this.message = I18n.t("login.expired", "登录状态已失效，请重新登录");
                void this.show("login");
            }
        };
        ApiClient.onMaintenance = (notice) => {
            this.signalr?.stop();
            MaintenanceHelper.showMaintenanceLockdownModal(
                this.node,
                notice.message,
                notice.maintenanceEndAt,
                () => {
                    void ApiClient.logout();
                    void this.show("login");
                },
            );
        };
        void this.bootAsync();
    }

    /**
     * 根据屏幕宽高比动态应用分辨率适配策略：
     * 竖屏锁定宽度 720 (FIXED_WIDTH)，高度自适应填满屏幕，消除 letterbox 带来的触控/输入框坐标偏移；
     * 宽屏锁定高度 1280 (FIXED_HEIGHT)，宽度向两侧扩展并绘制沙龙壁纸。
     */
    private setupResolutionPolicy(): void {
        const frameSize = view.getFrameSize();
        if (frameSize.width > frameSize.height) {
            view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_HEIGHT);
        } else {
            view.setDesignResolutionSize(720, 1280, ResolutionPolicy.FIXED_WIDTH);
        }
    }

    /** 销毁主组件时主动关闭实时连接与倒计时，避免切场景后后台继续重连或泄漏。 */
    protected onDestroy(): void {
        ApiClient.onSessionExpired = null;
        ApiClient.onMaintenance = null;
        this.clearRaceTimer();
        this.clearShakeTimer();
        WestAudio.stopGallop();
        this.signalr?.clearHandlers();
        this.signalr?.stop();
        this.signalr = null;
        this.horses.clear();
        this.pageRoot = null;
        this.bgRoot = null;
        this.widescreenRoot = null;
        this.raceMessageLabel = null;
        this.raceCommentaryLabel = null;
        this.doubleDownBtnNode = null;
        this.photoFinishBannerNode = null;
    }

    /** 清理赛场倒计时定时器，避免多次重复进入赛场或切页时产生定时器泄漏。 */
    private clearRaceTimer(): void {
        if (this.raceTickTimer !== null) {
            clearTimeout(this.raceTickTimer);
            this.raceTickTimer = null;
        }
    }

    /** 清理屏幕震动定时器，重置震屏状态并避免切页/销毁后对失效节点操作。 */
    private clearShakeTimer(): void {
        if (this.shakeInterval !== null) {
            clearInterval(this.shakeInterval);
            this.shakeInterval = null;
        }
    }

    /** 比赛阶段只更新本地表现，不发起网络请求。 */
    public update(): void {
        if (this.page !== "race" || this.round?.state !== RaceState.Racing) {
            return;
        }

        const now = Date.now() + this.serverOffsetMs;
        for (const controller of this.horses.values()) {
            if (controller && controller.isValid) {
                controller.syncToServer(now);
            }
        }

        // 实时追踪戏剧冲突与领跑反超解说
        this.trackRaceDrama(now);
        // 服务端预设解说脚本同步
        this.trackScriptCommentary(now);
        // 终点毫厘裁决 (Photo Finish) 视觉慢动作与悬念提示
        this.trackPhotoFinish(now);
        // 比赛第15秒至18.5秒绝地追投加倍按钮
        this.trackInPlayDoubleDown(now);
        // 实时微缩赛道雷达与前三名动态看板刷新
        this.trackMiniRadarAndRanking();
    }

    /** 实时微缩赛道雷达与前三名动态看板更新 */
    private trackMiniRadarAndRanking(): void {
        if (!this.trackRadarNode || !this.trackRadarNode.isValid) return;
        const radarG = this.trackRadarNode.getComponent(Graphics);
        if (!radarG) return;

        radarG.clear();

        // 绘制雷达轨道背景槽 (540 x 8)
        radarG.fillColor = new Color(25, 20, 15, 200);
        radarG.roundRect(-270, -4, 540, 8, 4);
        radarG.fill();

        // 起点与终点标线
        radarG.strokeColor = WestColors.GOLD_METALLIC;
        radarG.lineWidth = 1.5;
        radarG.moveTo(-268, -6);
        radarG.lineTo(-268, 6);
        radarG.stroke();

        radarG.strokeColor = WestColors.BANDANA_RED;
        radarG.lineWidth = 2.0;
        radarG.moveTo(268, -6);
        radarG.lineTo(268, 6);
        radarG.stroke();

        const horseColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];

        const list: Array<{ horseNo: number; progress: number }> = [];
        for (const [horseNo, controller] of this.horses.entries()) {
            if (controller && controller.isValid) {
                list.push({ horseNo, progress: controller.getProgress() });
            }
        }

        if (list.length === 0) return;

        // 绘制 6 匹马在微缩雷达上的光标位置
        list.forEach((item) => {
            const rx = -266 + Math.max(0, Math.min(1.0, item.progress)) * 532;
            const c = horseColors[item.horseNo - 1] || WestColors.GOLD_BRIGHT;
            radarG.fillColor = c;
            radarG.circle(rx, 0, 5);
            radarG.fill();
            radarG.strokeColor = new Color(255, 255, 255, 200);
            radarG.lineWidth = 1;
            radarG.circle(rx, 0, 5);
            radarG.stroke();
        });

        // 刷新实时前三名徽章看板
        list.sort((a, b) => b.progress - a.progress);
        if (this.liveRankLabel && this.liveRankLabel.isValid && list.length >= 3) {
            this.liveRankLabel.string = `🥇${list[0].horseNo} 🥈${list[1].horseNo} 🥉${list[2].horseNo}`;
        }
    }

    /** 重置微缩雷达与实时排位看板为待命起跑状态（非比赛阶段或新轮次入场） */
    private resetMiniRadarAndRanking(): void {
        if (this.liveRankLabel && this.liveRankLabel.isValid) {
            this.liveRankLabel.string = "🏁 待起跑";
        }
        if (!this.trackRadarNode || !this.trackRadarNode.isValid) return;
        const radarG = this.trackRadarNode.getComponent(Graphics);
        if (!radarG) return;
        radarG.clear();

        // 绘制雷达轨道背景槽 (540 x 8)
        radarG.fillColor = new Color(25, 20, 15, 200);
        radarG.roundRect(-270, -4, 540, 8, 4);
        radarG.fill();

        // 起点与终点标线
        radarG.strokeColor = WestColors.GOLD_METALLIC;
        radarG.lineWidth = 1.5;
        radarG.moveTo(-268, -6);
        radarG.lineTo(-268, 6);
        radarG.stroke();

        radarG.strokeColor = WestColors.BANDANA_RED;
        radarG.lineWidth = 2.0;
        radarG.moveTo(268, -6);
        radarG.lineTo(268, 6);
        radarG.stroke();

        // 在起点依次绘制 6 匹马的待命彩球
        const horseColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];
        for (let i = 0; i < 6; i++) {
            const rx = -266 + i * 3.5;
            radarG.fillColor = horseColors[i];
            radarG.circle(rx, 0, 4.5);
            radarG.fill();
            radarG.strokeColor = new Color(255, 255, 255, 200);
            radarG.lineWidth = 1;
            radarG.circle(rx, 0, 4.5);
            radarG.stroke();
        }
    }

    /**
     * 依据当前下注模式（独赢 WIN vs 连赢 QUINELLA）追踪赛事戏剧冲突。
     * WIN 模式聚焦领跑者、单骑突围与王者反超；
     * QUINELLA 模式聚焦前二双雄并驾齐驱缠斗与连赢席位争夺！
     * 附加：马群密度感知、单骑脱逃与终点直道紧张感叠加。
     */
    private trackRaceDrama(now: number): void {
        if (this.horses.size === 0) return;

        const list: Array<{ horseNo: number; laneX: number; progress: number }> = [];
        for (const [horseNo, controller] of this.horses.entries()) {
            if (controller && controller.isValid) {
                list.push({
                    horseNo,
                    laneX: controller.getLaneX(),
                    progress: controller.getProgress(),
                });
            }
        }

        if (list.length === 0) return;

        // 按当前跑道 X 坐标降序排列 (第1名在最前面)
        list.sort((a, b) => b.laneX - a.laneX);

        const leader = list[0];
        const runnerUp = list.length > 1 ? list[1] : null;
        const tail = list[list.length - 1];

        // 起跑阶段 (< 0.06) 或冲线阶段 (>= 0.99) 略过解说
        if (leader.progress < 0.06 || leader.progress >= 0.99) {
            return;
        }

        const isQuinella = this.betMode === "QUINELLA";

        // ======= 通用环境：马群密度感知与单骑脱逃 =======
        const spreadPx = leader.laneX - tail.laneX;
        const leaderGap = runnerUp ? (leader.laneX - runnerUp.laneX) : 0;

        // 单骑脱逃：领跑者拉开超过 80px 且赛程在中段
        if (leaderGap > 80 && leader.progress > 0.25 && leader.progress < 0.85) {
            if (now - this.lastPackDensityAnnounceMs > 4500) {
                this.lastPackDensityAnnounceMs = now;
                const msg = `🦅 [单骑绝尘] ${leader.horseNo}号 大幅拉开身位，独霸赛道遥遥领先！`;
                this.updateRaceMessage(msg);
                WestAudio.playBullwhip("COMMON");
                return;
            }
        }

        // 全群混战：所有马匹聚集在 55px 以内 且赛程 > 30%
        if (spreadPx < 55 && leader.progress > 0.30 && leader.progress < 0.88) {
            if (now - this.lastPackDensityAnnounceMs > 5000) {
                this.lastPackDensityAnnounceMs = now;
                const msg = `🔥 [六骑混战] 全场战驹挤成一团！鞭影交错难分高下！`;
                this.updateRaceMessage(msg);
                WestAudio.playNeckAndNeckTension("COMMON");
                return;
            }
        }

        // ==========================================
        // QUINELLA (连赢模式独立追踪)：聚焦前二双雄缠斗！
        // ==========================================
        if (runnerUp) {
            const gap = leader.laneX - runnerUp.laneX;
            const top2Combo = `${Math.min(leader.horseNo, runnerUp.horseNo)}-${Math.max(leader.horseNo, runnerUp.horseNo)}`;

            // 直道冲刺阶段 (progress > 0.45) 且两匹马胶着缠斗 (< 38px)
            if (leader.progress > 0.45 && gap < 38) {
                if (now - this.quinellaLastDuelAnnounceMs > 3500) {
                    this.quinellaLastDuelAnnounceMs = now;
                    this.quinellaLastMessage = leader.progress > 0.82
                        ? `🏁 [终点前死斗！] ${leader.horseNo}号 与 ${runnerUp.horseNo}号 终点线前最后缠斗！鬃毛擦肩！`
                        : `🔥 [连赢双雄激战] ${leader.horseNo}号 与 ${runnerUp.horseNo}号 并驾齐驱！难分伯仲！`;
                    if (isQuinella) {
                        this.updateRaceMessage(this.quinellaLastMessage);
                    }
                    WestAudio.speakCowboy("duel", "QUINELLA");
                }
            } else if (top2Combo !== this.quinellaLastTop2Combo) {
                this.quinellaLastTop2Combo = top2Combo;
                if (now - this.quinellaLastOvertakeAnnounceMs > 2400) {
                    this.quinellaLastOvertakeAnnounceMs = now;
                    this.quinellaLastMessage = `⚡ [连赢席位更迭] ${leader.horseNo}号 与 ${runnerUp.horseNo}号 杀入前二阵列！`;
                    if (isQuinella) {
                        this.updateRaceMessage(this.quinellaLastMessage);
                    }
                    WestAudio.playBullwhip("QUINELLA");
                }
            }
        }

        // ==========================================
        // WIN (独赢模式独立追踪)：聚焦头名领跑者与王者反超！
        // ==========================================
        if (leader.horseNo !== this.winLeaderHorseNo) {
            const prevLeader = this.winLeaderHorseNo;
            this.winLeaderHorseNo = leader.horseNo;

            if (prevLeader !== 0 && now - this.winLastOvertakeAnnounceMs > 2200) {
                this.winLastOvertakeAnnounceMs = now;
                this.winLastMessage = leader.progress > 0.75
                    ? `🏁 [终点直道惊天逆转！] ${leader.horseNo}号 在最后弯道后发制人，强行反超夺冠！`
                    : `👑 [强势反超] ${leader.horseNo}号 烈马突围，夺得头名领跑！`;
                if (!isQuinella) {
                    this.updateRaceMessage(this.winLastMessage);
                }
                WestAudio.speakCowboy("overtake", "WIN");
            } else if (prevLeader === 0) {
                this.winLastMessage = `🐎 [率先冲出] ${leader.horseNo}号 拔得头筹率先领跑！`;
                if (!isQuinella) {
                    this.updateRaceMessage(this.winLastMessage);
                }
            }
        }
    }

    /** 同步服务端预设的动态解说脚本 */
    private trackScriptCommentary(now: number): void {
        if (!this.round || !this.round.raceStartAt || this.parsedCommentary.length === 0) return;
        const raceStartMs = new Date(this.round.raceStartAt).getTime();
        const elapsedSec = Math.max(0, (now - raceStartMs) / 1000);

        for (const item of this.parsedCommentary) {
            if (elapsedSec >= item.second && this.lastScriptCommentarySec < item.second) {
                this.lastScriptCommentarySec = item.second;
                const prefix = item.phase === "photo_finish" ? "📷 " : "🎙️ ";
                this.updateRaceMessage(`${prefix}${item.textZh}`);
                if (item.phase === "start") {
                    WestAudio.speakCowboy("start", this.getAudioMode());
                } else if (item.phase === "final_corner") {
                    WestAudio.playBullwhip("COMMON");
                } else if (item.phase === "photo_finish") {
                    WestAudio.playNeckAndNeckTension("COMMON");
                }
                break;
            }
        }
    }

    /** 终点毫厘裁决 (Photo Finish 2.0) 视觉悬念与微秒激光定格判定 */
    private trackPhotoFinish(now: number): void {
        if (!this.round || !this.round.isPhotoFinish || !this.round.raceStartAt) return;
        const raceStartMs = new Date(this.round.raceStartAt).getTime();
        const elapsedSec = (now - raceStartMs) / 1000;
        const raceDuration = this.round.raceDurationSeconds || 30;

        // 在比赛最后 2.5 秒内且接近终点时展示 PHOTO FINISH 2.0 视觉横幅、激光扫描与微秒判读框
        if (elapsedSec >= raceDuration - 2.5 && elapsedSec <= raceDuration + 1.2) {
            if (this.photoFinishBannerNode && !this.photoFinishBannerNode.active) {
                this.photoFinishBannerNode.active = true;
                const gap = this.round.photoFinishGapSeconds ?? 0.04;
                this.updateRaceMessage(`📷 [PHOTO FINISH 毫厘压线裁决] 胜负差距仅 ${gap}s！终点红外激光定格中！`);
                WestAudio.playNeckAndNeckTension("COMMON");
                this.shakeScreen(200, 3);
            }
        } else if (elapsedSec > raceDuration + 1.2) {
            if (this.photoFinishBannerNode && this.photoFinishBannerNode.active) {
                this.photoFinishBannerNode.active = false;
            }
        }
    }

    /** 比赛第15秒至18.5秒绝地追投加倍按钮状态驱动 */
    private trackInPlayDoubleDown(now: number): void {
        if (!this.round || !this.round.raceStartAt || this.myRoundOrders.length === 0 || this.isDoubleDownSubmitted) {
            if (this.doubleDownBtnNode && this.doubleDownBtnNode.active) {
                this.doubleDownBtnNode.active = false;
            }
            return;
        }

        const raceStartMs = new Date(this.round.raceStartAt).getTime();
        const elapsedSec = (now - raceStartMs) / 1000;

        // 追投窗口期 15.0s ~ 18.5s
        if (elapsedSec >= 15.0 && elapsedSec <= 18.5) {
            if (this.doubleDownBtnNode) {
                if (!this.doubleDownBtnNode.active) {
                    this.doubleDownBtnNode.active = true;
                    WestAudio.playSpurJingle();
                }
                const remainingSec = Math.max(0, Math.ceil(18.5 - elapsedSec));
                const lbl = this.doubleDownBtnNode.getComponentInChildren(Label);
                if (lbl) {
                    lbl.string = `🔥 追投加倍 (限时 ${remainingSec}s)`;
                }
            }
        } else {
            if (this.doubleDownBtnNode && this.doubleDownBtnNode.active) {
                this.doubleDownBtnNode.active = false;
            }
        }
    }

    /** 点击追投加倍按钮执行追投调用 */
    private async onDoubleDownClicked(): Promise<void> {
        if (this.isDoubleDownSubmitted || this.myRoundOrders.length === 0) return;
        const targetOrder = this.myRoundOrders.find(o => o.status === BetOrderStatus.Pending && !o.isDoubleDown);
        if (!targetOrder) {
            this.updateRaceMessage("⚠️ 本局无可追投的进行中注单");
            return;
        }

        this.isDoubleDownSubmitted = true;
        if (this.doubleDownBtnNode) {
            this.doubleDownBtnNode.active = false;
        }

        try {
            WestAudio.playBullwhip("COMMON");
            WestAudio.playRevolverCock();
            const res = await ApiClient.doubleDown(
                targetOrder.orderNo,
                `dd-${targetOrder.orderNo}-${Date.now()}`,
            );
            if (res.data) {
                targetOrder.betAmount = res.data.newTotalBet;
                targetOrder.isDoubleDown = true;
                targetOrder.doubleDownAmount = res.data.additionalDeducted;
                if (this.player) {
                    this.player.balance = res.data.currentBalance;
                }
                this.updateRaceMessage(`⚡ [追投成功] 追加 $${res.data.additionalDeducted}！总注额提升至 $${res.data.newTotalBet}！`);
                this.shakeScreen(200, 5);
            }
        } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : "追投加倍失败";
            this.updateRaceMessage(`⚠️ ${msg}`);
        }
    }

    /** 打开马匹亮相圈与骑师/天气贴士弹窗 */
    private showPaddockModal(root: Node): void {
        const modal = new Node("PaddockModal");
        modal.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(modal);
        modal.setPosition(360, 640);
        modal.addComponent(UITransform).setContentSize(680, 720);
        modal.setSiblingIndex(9999);

        // 柔和暮色遮罩 (护眼低反差)
        const mask = this.box(modal, 0, 0, 720, 1280, new Color(18, 12, 8, 175));

        // 沙龙面板
        const panel = new Node("PaddockPanel");
        panel.layer = modal.layer;
        modal.addChild(panel);
        panel.setPosition(0, 0);
        panel.addComponent(UITransform).setContentSize(640, 680);
        WestStyle.drawGrandSaloonPanel(panel, 640, 680, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 丝滑展开入场动效
        WestMotion.playModalEnter(panel, mask);

        const closeModal = (): void => {
            WestMotion.playModalExit(panel, mask, () => {
                if (modal && modal.isValid) {
                    modal.destroy();
                }
            });
        };
        this.bindClick(mask, closeModal);
        this.addModalCloseBtn(panel, 640, 680, closeModal);

        this.text(panel, "🏇 马匹亮相圈 · 专家情报", 0, 310, 22, WestColors.GOLD_BRIGHT);
        const weatherText = this.getWeatherText(this.round?.weather);
        const trackText = this.getTrackText(this.round?.trackType);
        this.text(panel, `🏜️ 赛道状况: ${trackText} | 天气: ${weatherText}`, 0, 275, 14, WestColors.PARCHMENT_LIGHT);

        const recs = this.paddockInfo?.recommendations ?? [];
        if (recs.length === 0) {
            this.text(panel, "赛前热身进行中，骑师正在做最后巡查...", 0, 0, 16, WestColors.PARCHMENT_LIGHT);
        } else {
            recs.forEach((rec, idx) => {
                const itemY = 220 - idx * 75;
                const row = this.woodBox(panel, 0, itemY, 600, 66, 8, WestColors.LEATHER_DARK, WestColors.WOOD_FRAME);

                // 推荐星级
                const stars = "★".repeat(rec.starRating) + "☆".repeat(Math.max(0, 5 - rec.starRating));
                this.text(row, `🐴 ${rec.horseNo}号马`, -270, 12, 16, WestColors.GOLD_BRIGHT, HorizontalTextAlignment.LEFT);
                this.text(row, `评分: ${stars}`, -270, -14, 13, WestColors.BANDANA_RED, HorizontalTextAlignment.LEFT);

                // 推荐理由与偏好
                this.text(row, `💡 ${rec.analysisZh}`, -50, 12, 13, WestColors.PARCHMENT_LIGHT, HorizontalTextAlignment.LEFT);
                this.text(row, `偏好: ${rec.preferredWeather}天 / ${rec.preferredTrack}道 (赔率 ${rec.odds})`, -50, -14, 12, WestColors.DESERT_SAGE, HorizontalTextAlignment.LEFT);

                // 快捷选择按钮
                this.button(row, "下注", 245, 0, 70, 36, () => {
                    this.selectedHorse = rec.horseNo;
                    closeModal();
                    this.updateRaceMessage(`已按专家推荐选择 ${rec.horseNo}号马`);
                }, WestColors.BANDANA_RED, WestColors.GOLD_BRIGHT, 14);
            });
        }

        // 关闭按钮
        this.saloonButton(panel, "✕ 关闭", 0, -305, 160, 42, closeModal, true, 16);
    }

    /**
     * 【下注后酒馆消遣轻微游戏 · Saloon Minigames】
     * 依据 PRD 2.1 节规范：在 180s 下注等待期，为玩家提供：
     * 1. 西部幸运轮盘 (Saloon Roulette)：消耗 2 币单轮转盘，产出小额金币或比赛助威道具；
     * 2. 牛仔洗牌骰 (Dice Duel)：与酒馆老板比大小，填补空白时间；
     * 3. 倒计时 <= 10s 时自动收起锁定。
     */
    private showSaloonMinigamesModal(root: Node): void {
        const modal = new Node("SaloonMinigamesModal");
        modal.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(modal);
        modal.setPosition(360, 640);
        modal.addComponent(UITransform).setContentSize(680, 840);
        modal.setSiblingIndex(9999);

        // 柔和暮色遮罩 (护眼低反差)
        const mask = this.box(modal, 0, 0, 720, 1280, new Color(18, 12, 8, 180));

        // 边境沙龙主板
        const panel = new Node("SaloonMinigamesPanel");
        panel.layer = modal.layer;
        modal.addChild(panel);
        panel.setPosition(0, 0);
        panel.addComponent(UITransform).setContentSize(650, 780);
        WestStyle.drawGrandSaloonPanel(panel, 650, 780, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 丝滑展开入场动效
        WestMotion.playModalEnter(panel, mask);

        let isClosed = false;
        let activeDiceTimer: ReturnType<typeof setInterval> | null = null;
        const closeModal = (): void => {
            if (isClosed) return;
            isClosed = true;
            if (activeDiceTimer !== null) {
                clearInterval(activeDiceTimer);
                activeDiceTimer = null;
            }
            WestMotion.playModalExit(panel, mask, () => {
                if (modal && modal.isValid) {
                    modal.destroy();
                }
            });
        };
        this.bindClick(mask, closeModal);
        this.addModalCloseBtn(panel, 650, 780, closeModal);

        // 顶部牌匾
        const titleBox = this.chalkboardBox(panel, 0, 345, 610, 42, 6);
        this.text(titleBox, "🎰 边境酒馆消遣休息室 · SALOON LOUNGE 🎲", 0, 0, 17, WestColors.GOLD_BRIGHT);
        this.text(panel, "赛前等候期休闲微玩 · 赢取金币与助威道具 (开赛前10秒封盘)", 0, 308, 12, WestColors.PARCHMENT_LIGHT);

        // 当前玩法 Tab：0 为幸运轮盘，1 为牛仔摇骰
        let currentTab = 0;
        let isSpinning = false;

        const tabBtnRoulette = this.saloonButton(panel, "🤠 西部幸运轮盘", -150, 270, 260, 36, () => {
            if (isSpinning) return;
            currentTab = 0;
            switchTab();
        }, true, 14);

        const tabBtnDice = this.saloonButton(panel, "🎲 牛仔拼骰比大小", 150, 270, 260, 36, () => {
            if (isSpinning) return;
            currentTab = 1;
            switchTab();
        }, false, 14);

        // 内容区容器
        const contentArea = new Node("MinigameContent");
        contentArea.layer = panel.layer;
        panel.addChild(contentArea);
        contentArea.setPosition(0, -10);
        contentArea.addComponent(UITransform).setContentSize(610, 450);

        const renderRoulette = (): void => {
            contentArea.destroyAllChildren();

            const rouletteBox = this.wantedPosterBox(contentArea, 0, 20, 580, 430, 8);
            this.text(rouletteBox, "★ 柯尔特转轮机 · 六合幸运奖盘 ★", 0, 192, 16, WestColors.INK_DARK);
            const balanceSubLabel = this.text(rouletteBox, `每次转动消耗 2 金币 | 当前持有: ${this.formatMoney(this.player?.balance ?? 0)} 币`, 0, 170, 12, WestColors.INK_MUTED);

            // 绘制转盘
            const wheelNode = new Node("RouletteWheel");
            wheelNode.layer = rouletteBox.layer;
            rouletteBox.addChild(wheelNode);
            wheelNode.setPosition(0, 30);
            wheelNode.addComponent(UITransform).setContentSize(240, 240);

            const prizes = [
                { text: "💰 5币", color: new Color(180, 140, 60, 255), amount: 5 },
                { text: "🪙 10币", color: new Color(160, 70, 50, 255), amount: 10 },
                { text: "📣 助威号角", color: new Color(80, 120, 160, 255), amount: 2 },
                { text: "💎 25大奖", color: new Color(218, 165, 32, 255), amount: 25 },
                { text: "⚡ 黄金马鞭", color: new Color(130, 90, 150, 255), amount: 2 },
                { text: "🍺 冰啤回本", color: new Color(90, 140, 80, 255), amount: 2 },
            ];

            const wg = wheelNode.addComponent(Graphics);
            const radius = 105;
            const sectorAngle = (Math.PI * 2) / prizes.length;
            for (let i = 0; i < prizes.length; i++) {
                const startA = i * sectorAngle;
                const endA = (i + 1) * sectorAngle;
                wg.fillColor = prizes[i].color;
                wg.moveTo(0, 0);
                wg.arc(0, 0, radius, startA, endA, false);
                wg.close();
                wg.fill();

                wg.strokeColor = WestColors.BRASS_FRAME;
                wg.lineWidth = 1.5;
                wg.stroke();

                // 扇区文字
                const midA = (startA + endA) / 2;
                const tx = Math.cos(midA) * (radius * 0.65);
                const ty = Math.sin(midA) * (radius * 0.65);
                this.text(wheelNode, prizes[i].text, tx, ty, 12, WestColors.CREAM);
            }

            // 中心轮轴
            wg.fillColor = WestColors.BRASS;
            wg.circle(0, 0, 24);
            wg.fill();
            wg.strokeColor = WestColors.WOOD_DARK;
            wg.lineWidth = 2;
            wg.stroke();
            this.text(wheelNode, "🤠", 0, 0, 16);

            // 指针
            const pointer = this.box(rouletteBox, 0, 140, 20, 24, WestColors.SEAL_RED, 4);
            const pg = pointer.getComponent(Graphics)!;
            pg.clear();
            pg.fillColor = WestColors.SEAL_RED;
            pg.moveTo(-10, 12);
            pg.lineTo(10, 12);
            pg.lineTo(0, -12);
            pg.close();
            pg.fill();

            const statusLabel = this.text(rouletteBox, "就绪：扣动击锤，旋转好运！", 0, -110, 14, WestColors.INK_DARK);

            this.saloonButton(
                rouletteBox,
                "🎰 扣动扳机旋转 (SPIN)",
                0,
                -160,
                280,
                42,
                async () => {
                    if (isSpinning) return;
                    if ((this.player?.balance ?? 0) < 2) {
                        statusLabel.string = "⚠️ 余额不足 2 金币，请先前往金库充值";
                        statusLabel.color = WestColors.BANDANA_RED;
                        return;
                    }
                    isSpinning = true;
                    WestAudio.playRevolverCock();
                    statusLabel.string = "🌀 轮盘飞速旋转中...";
                    statusLabel.color = WestColors.INK_DARK;

                    try {
                        const spinRes = await ApiClient.post<{
                            prizeIndex: number;
                            prizeText: string;
                            cost: number;
                            reward: number;
                            newBalance: number;
                        }>("/api/minigame/wheel/spin", {});

                        const prizeData = spinRes.data;
                        const wonIdx = prizeData && typeof prizeData.prizeIndex === "number"
                            ? prizeData.prizeIndex
                            : Math.floor(Math.random() * prizes.length);
                        const targetPrize = prizes[wonIdx];
                        const targetSectorMid = ((wonIdx + 0.5) * 360) / prizes.length;
                        const stopAngle = 360 * 4 + (90 - targetSectorMid);

                        tween(wheelNode).stop();
                        tween(wheelNode)
                            .to(1.8, { angle: stopAngle }, { easing: "cubicOut" })
                            .call(() => {
                                isSpinning = false;
                                if (prizeData && typeof prizeData.newBalance === "number" && this.player) {
                                    this.player.balance = prizeData.newBalance;
                                }
                                if (isClosed || !wheelNode || !wheelNode.isValid || !balanceSubLabel || !balanceSubLabel.isValid) {
                                    return;
                                }
                                balanceSubLabel.string = `每次转动消耗 2 金币 | 当前持有: ${this.formatMoney(this.player?.balance ?? 0)} 币`;
                                WestAudio.playGoldCascade("COMMON");
                                this.shakeScreen(150, 3);
                                statusLabel.string = `🎉 大吉！命中【${targetPrize.text}】！入账 ${targetPrize.amount} 币！`;
                                statusLabel.color = WestColors.BANDANA_RED;
                                this.showToast(`🎰 轮盘命中【${targetPrize.text}】！入账 ${targetPrize.amount} 🪙`, WestColors.GOLD_BRIGHT);
                                void this.loadPlayer();
                            })
                            .start();
                    } catch (err) {
                        isSpinning = false;
                        if (!isClosed && statusLabel && statusLabel.isValid) {
                            statusLabel.string = this.errorMessage(err, "转盘抽奖失败");
                            statusLabel.color = WestColors.BANDANA_RED;
                        }
                    }
                },
                true,
                15,
            );
        };

        const renderDice = (): void => {
            contentArea.destroyAllChildren();

            const diceBox = this.wantedPosterBox(contentArea, 0, 20, 580, 430, 8);
            this.text(diceBox, "★ 怀俄明拼骰擂台 · 决胜酒馆老板 ★", 0, 192, 16, WestColors.INK_DARK);
            const diceBalanceSubLabel = this.text(diceBox, `投掷消耗 2 金币 (胜赚4币/平退2币) | 当前持有: ${this.formatMoney(this.player?.balance ?? 0)} 币`, 0, 170, 12, WestColors.INK_MUTED);

            // 掌柜区域 (Boss)
            const bossBox = this.woodBox(diceBox, 0, 95, 540, 90, 8, WestColors.LEATHER_DARK, WestColors.WOOD_FRAME);
            this.text(bossBox, "🤠 酒馆老板 · 怀俄明老爹", -160, 0, 14, WestColors.CHALK_YELLOW);
            const bossDie1 = this.box(bossBox, 40, 0, 56, 56, WestColors.CREAM, 8);
            const bossDie2 = this.box(bossBox, 115, 0, 56, 56, WestColors.CREAM, 8);
            const bL1 = this.text(bossDie1, "🎲", 0, 0, 26, WestColors.INK_DARK);
            const bL2 = this.text(bossDie2, "🎲", 0, 0, 26, WestColors.INK_DARK);

            // 玩家区域 (Player)
            const playerBox = this.woodBox(diceBox, 0, -10, 540, 90, 8, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            this.text(playerBox, `🏇 你 (${this.player?.nickname ?? "牛仔"})`, -160, 0, 14, WestColors.GOLD_BRIGHT);
            const playerDie1 = this.box(playerBox, 40, 0, 56, 56, WestColors.CREAM, 8);
            const playerDie2 = this.box(playerBox, 115, 0, 56, 56, WestColors.CREAM, 8);
            const pL1 = this.text(playerDie1, "🎲", 0, 0, 26, WestColors.INK_DARK);
            const pL2 = this.text(playerDie2, "🎲", 0, 0, 26, WestColors.INK_DARK);

            const diceStatus = this.text(diceBox, "等待开局：下注 2 币与老板一决雌雄！", 0, -85, 14, WestColors.INK_DARK);

            const diceChars = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];

            this.saloonButton(
                diceBox,
                "🎲 摇骰开决 [消耗 2 币]",
                0,
                -150,
                280,
                42,
                async () => {
                    if (isSpinning) return;
                    if ((this.player?.balance ?? 0) < 2) {
                        diceStatus.string = "⚠️ 余额不足 2 金币，请先充值";
                        diceStatus.color = WestColors.BANDANA_RED;
                        return;
                    }
                    isSpinning = true;
                    WestAudio.playStampThud("COMMON");
                    diceStatus.string = "🎲 骰盅摇晃中...";
                    diceStatus.color = WestColors.INK_DARK;

                    try {
                        const diceRes = await ApiClient.post<{
                            playerDice: number[];
                            bossDice: number[];
                            playerSum: number;
                            bossSum: number;
                            result: string;
                            cost: number;
                            reward: number;
                            newBalance: number;
                        }>("/api/minigame/dice/roll", {});

                        const data = diceRes.data;
                        const b1 = data?.bossDice?.[0] ?? (Math.floor(Math.random() * 6) + 1);
                        const b2 = data?.bossDice?.[1] ?? (Math.floor(Math.random() * 6) + 1);
                        const p1 = data?.playerDice?.[0] ?? (Math.floor(Math.random() * 6) + 1);
                        const p2 = data?.playerDice?.[1] ?? (Math.floor(Math.random() * 6) + 1);

                        // 摇骰动画
                        let count = 0;
                        activeDiceTimer = setInterval(() => {
                            if (isClosed || !bL1 || !bL1.isValid || !bL1.node || !bL1.node.isValid) {
                                if (activeDiceTimer !== null) {
                                    clearInterval(activeDiceTimer);
                                    activeDiceTimer = null;
                                }
                                isSpinning = false;
                                return;
                            }
                            bL1.string = diceChars[Math.floor(Math.random() * 6)];
                            bL2.string = diceChars[Math.floor(Math.random() * 6)];
                            pL1.string = diceChars[Math.floor(Math.random() * 6)];
                            pL2.string = diceChars[Math.floor(Math.random() * 6)];
                            count++;
                            if (count >= 10) {
                                if (activeDiceTimer !== null) {
                                    clearInterval(activeDiceTimer);
                                    activeDiceTimer = null;
                                }
                                bL1.string = diceChars[b1 - 1];
                                bL2.string = diceChars[b2 - 1];
                                pL1.string = diceChars[p1 - 1];
                                pL2.string = diceChars[p2 - 1];

                                const bSum = b1 + b2;
                                const pSum = p1 + p2;
                                isSpinning = false;

                                if (data && typeof data.newBalance === "number" && this.player) {
                                    this.player.balance = data.newBalance;
                                }
                                if (isClosed || !diceBalanceSubLabel || !diceBalanceSubLabel.isValid) {
                                    return;
                                }
                                diceBalanceSubLabel.string = `投掷消耗 2 金币 (胜赚4币/平退2币) | 当前持有: ${this.formatMoney(this.player?.balance ?? 0)} 币`;

                                if (pSum > bSum) {
                                    WestAudio.playGoldCascade("COMMON");
                                    this.shakeScreen(150, 4);
                                    diceStatus.string = `🎉 牛仔大胜！点数 ${pSum} vs 老板 ${bSum}！赢得 4 金币 (净赚 +2 币)！`;
                                    diceStatus.color = WestColors.BANDANA_RED;
                                    this.showToast("🎲 拼骰大胜！赢得 4 🪙 (净赚 +2 币)", WestColors.GOLD_BRIGHT);
                                } else if (pSum === bSum) {
                                    diceStatus.string = `🤝 双方战平！点数同为 ${pSum}！原银退还 2 金币！`;
                                    diceStatus.color = WestColors.INK_DARK;
                                    this.showToast("🎲 双方战平！原银退还 2 🪙", WestColors.PARCHMENT_LIGHT);
                                } else {
                                    diceStatus.string = `🌵 老板占优！点数 ${bSum} vs 你的 ${pSum}！胜败乃牛仔常事！`;
                                    diceStatus.color = WestColors.INK_MUTED;
                                }
                                void this.loadPlayer();
                            }
                        }, 80);
                    } catch (err) {
                        isSpinning = false;
                        if (!isClosed && diceStatus && diceStatus.isValid) {
                            diceStatus.string = this.errorMessage(err, "摇骰对决失败");
                            diceStatus.color = WestColors.BANDANA_RED;
                        }
                    }
                },
                true,
                15,
            );
        };

        const switchTab = (): void => {
            if (activeDiceTimer !== null) {
                clearInterval(activeDiceTimer);
                activeDiceTimer = null;
            }
            if (currentTab === 0) {
                renderRoulette();
            } else {
                renderDice();
            }
        };

        switchTab();

        // 底部关闭
        this.saloonButton(panel, "✕ 返回赛场备战", 0, -355, 200, 40, closeModal, false, 14);
    }

    /** 打开超级大奖池说明弹窗 */
    private showJackpotModal(root: Node): void {
        const modal = new Node("JackpotModal");
        modal.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(modal);
        modal.setPosition(360, 640);
        modal.addComponent(UITransform).setContentSize(600, 400);
        modal.setSiblingIndex(9999);

        // 柔和暮色遮罩 (护眼低反差)
        const mask = this.box(modal, 0, 0, 720, 1280, new Color(18, 12, 8, 175));

        const panel = new Node("JackpotPanel");
        panel.layer = modal.layer;
        modal.addChild(panel);
        panel.setPosition(0, 0);
        panel.addComponent(UITransform).setContentSize(560, 360);
        WestStyle.drawGrandSaloonPanel(panel, 560, 360, 14, WestColors.WOOD_DARK, WestColors.GOLD_METALLIC);

        WestMotion.playModalEnter(panel, mask);

        let isClosed = false;
        const closeModal = (): void => {
            if (isClosed) return;
            isClosed = true;
            WestMotion.playModalExit(panel, mask, () => {
                if (modal && modal.isValid) {
                    modal.destroy();
                }
            });
        };
        this.bindClick(mask, closeModal);
        this.addModalCloseBtn(panel, 560, 360, closeModal);

        this.text(panel, "💎 西部超级累积大奖池", 0, 130, 22, WestColors.GOLD_BRIGHT);
        const dropStatus = this.round?.jackpotDropped
            ? `🎉 本轮已触发大奖掉落！总额: $${this.round.jackpotDropAmount}`
            : `🔥 奖池持续积聚中，任意注单均有机会引爆！`;
        this.text(panel, dropStatus, 0, 85, 14, WestColors.BANDANA_RED);

        const desc = [
            "• 每轮注单投注额的 1.5% 将自动注资超级累积奖池。",
            "• 奖池累计突破保底触发线时，将在结算时直接爆奖。",
            "• 中奖奖金将按有效注单比例全额发放至玩家金币钱包。",
            "• 所有参数与爆池记录由数据库配置控制，公平公开可查验。",
        ];
        desc.forEach((d, i) => {
            this.text(panel, d, -240, 40 - i * 32, 13, WestColors.PARCHMENT_LIGHT, HorizontalTextAlignment.LEFT);
        });

        this.saloonButton(panel, "我知道了", 0, -130, 140, 40, closeModal, true, 15);
    }

    /** 根据当前玩法模式计算其独立的马匹跑道次序与出战阵容。每个模式具有专属门号次序与位置。 */
    private getModeHorses(mode: "WIN" | "PLACE" | "QUINELLA" | "EXACTA" | "TRIFECTA"): RaceHorseDto[] {
        if (!this.round || !this.round.horses || this.round.horses.length === 0) return [];
        const base = [...this.round.horses];
        let shift = 0;
        switch (mode) {
            case "PLACE": shift = 1; break;
            case "QUINELLA": shift = 2; break;
            case "EXACTA": shift = 3; break;
            case "TRIFECTA": shift = 4; break;
            case "WIN": default: shift = 0; break;
        }
        if (shift === 0) return base;
        const n = base.length;
        const result: RaceHorseDto[] = [];
        for (let i = 0; i < n; i++) {
            result.push(base[(i + shift) % n]);
        }
        return result;
    }

    /** 在玩家切换下注模式选项卡时，实时调整赛道跑道马匹站位次序、战术策略与赛事解说视角 */
    private reinitHorsesForCurrentMode(): void {
        if (!this.round) {
            return;
        }

        // 1. 动态调整 6 条跑道上马匹与起跑门号次序，确保 5 种模式赛道门号及位置完全独立呈现
        const currentModeHorses = this.getModeHorses(this.betMode);
        currentModeHorses.forEach((horseItem, newLaneIdx) => {
            const horseNo = horseItem.horseNo;
            const targetLaneY = 135 - (newLaneIdx + 1) * 41;
            const horseCtrl = this.horses.get(horseNo);
            if (horseCtrl && horseCtrl.node && horseCtrl.node.parent && horseCtrl.node.parent.isValid) {
                horseCtrl.node.parent.setPosition(0, targetLaneY, 0);
            }
        });

        // 2. 若在比赛中，实时同步马匹 AI 战术策略
        if (this.round.state === RaceState.Racing) {
            const roundSeed = this.round.id;
            const isQuinella = this.betMode === "QUINELLA" || this.betMode === "EXACTA" || this.betMode === "TRIFECTA";

            for (const controller of this.horses.values()) {
                if (controller && controller.isValid) {
                    controller.updateMode(roundSeed, isQuinella);
                }
            }
        }

        let modeDesc = "";
        switch (this.betMode) {
            case "PLACE":
                modeDesc = "🛡️ 已切换至【位置稳赢】视角：前二名皆算胜出，稳健保本！";
                break;
            case "QUINELLA":
                modeDesc = this.quinellaLastMessage || "🎰 已切换至【街机连赢】视角：聚焦前二双雄并驾齐驱！";
                break;
            case "EXACTA":
                modeDesc = "🎯 已切换至【二连单精确】视角：锁定冠亚军严苛次序，高倍绝杀！";
                break;
            case "TRIFECTA":
                modeDesc = "👑 已切换至【三重彩三连单】视角：锁定前三甲次序，冲击千倍暴富！";
                break;
            case "WIN":
            default:
                modeDesc = this.winLastMessage || "🏇 已切换至【独赢单选】视角：聚焦头马突围与反超！";
                break;
        }
        this.updateRaceMessage(modeDesc);
    }

    /**
     * 弹出各玩法专属游戏规则弹窗 (独赢 WIN / 位置 PLACE / 连赢 QUINELLA / 二连单 EXACTA / 三重彩 TRIFECTA)
     */
    private showModeRulesModal(mode: "WIN" | "PLACE" | "QUINELLA" | "EXACTA" | "TRIFECTA"): void {
        const root = this.pageRoot || this.node;
        if (!root || !root.isValid) return;

        const isEn = I18n.getLocale() === "en-US";
        const modal = new Node("ModeRulesModal");
        modal.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(modal);
        const trans = root.getComponent(UITransform);
        const ax = trans?.anchorX ?? 0.5;
        const ay = trans?.anchorY ?? 0.5;
        modal.setPosition(ax === 0 ? 360 : 0, ay === 0 ? 640 : 0, 0);
        modal.addComponent(UITransform).setContentSize(680, 840);
        modal.setSiblingIndex(99999);

        const mask = this.box(modal, 0, 0, 720, 1280, new Color(18, 12, 8, 200));
        const panel = new Node("RulesPanel");
        panel.layer = modal.layer;
        modal.addChild(panel);
        panel.setPosition(0, 0);
        panel.addComponent(UITransform).setContentSize(640, 700);
        WestStyle.drawGrandSaloonPanel(panel, 640, 700, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        WestMotion.playModalEnter(panel, mask);

        const closeModal = (): void => {
            WestMotion.playModalExit(panel, mask, () => {
                if (modal && modal.isValid) modal.destroy();
            });
        };
        this.bindClick(mask, closeModal);
        this.addModalCloseBtn(panel, 640, 700, closeModal);

        const titleBox = this.chalkboardBox(panel, 0, 305, 600, 48, 8);
        let title = "";
        let tag = "";
        let winCond = "";
        let oddsDesc = "";
        let tips = "";
        let badgeColor = WestColors.GOLD_BRIGHT;

        switch (mode) {
            case "WIN":
                title = isEn ? "🏇 WIN CHAMPIONSHIP RULES" : "🏇 独赢单骑锦标赛 · 玩法规则";
                tag = isEn ? "Classic Single Pick · Match 1st Place" : "经典单选 · 独揽冠军";
                winCond = isEn
                    ? "★ Win Condition: Select 1 horse to win the race. If your chosen horse finishes in 1st place, you win!"
                    : "★ 中奖条件：选定 1 匹心仪赛马夺冠。只要该马匹率先冲过终点线获得第 1 名，即为中奖！";
                oddsDesc = isEn
                    ? "★ Odds Range: Dynamic ~2.0x to 30.0x based on form, weather, and jockey stats."
                    : "★ 赔率机制：2.0x ~ 30.0x 浮动赔率，依据马匹血统、天气赛道适应度及骑师加成动态判定。";
                tips = isEn
                    ? "★ Frontier Tip: Watch out for 'Front Runner' archetypes in sunny turf tracks!"
                    : "★ 牛仔秘籍：领跑突击型赛马在晴天草地胜率极高，是单挑夺冠的热门之选！";
                badgeColor = WestColors.GOLD_BRIGHT;
                break;
            case "PLACE":
                title = isEn ? "🛡️ PLACE ASSURANCE RULES" : "🛡️ 位置双席稳赢场 · 玩法规则";
                tag = isEn ? "Top 2 Finish · High Safety Margin" : "双席保底 · 稳健理财";
                winCond = isEn
                    ? "★ Win Condition: Select 1 horse to finish in the Top 2 (either 1st or 2nd place)."
                    : "★ 中奖条件：选定 1 匹马跑入前二名（第 1 名或第 2 名均算命中胜出）。";
                oddsDesc = isEn
                    ? "★ Odds Range: ~1.2x to 6.0x. Lower variance and the highest win rate on the frontier!"
                    : "★ 赔率机制：1.2x ~ 6.0x 稳健赔率。容错率高，是荒野最稳健的保底盈利盘！";
                tips = isEn
                    ? "★ Frontier Tip: Ideal for novice cowboys building their starter vault!"
                    : "★ 牛仔秘籍：适合新手牛仔滚存金币，即使惜败获得亚军也能稳拿丰厚派彩！";
                badgeColor = WestColors.DESERT_SAGE;
                break;
            case "QUINELLA":
                title = isEn ? "🎰 ARCADE QUINELLA RULES" : "🎰 街机双雄连赢场 · 玩法规则";
                tag = isEn ? "Top 2 Any Order · +25% Jackpot" : "双雄包揽 · 街机爆奖";
                winCond = isEn
                    ? "★ Win Condition: Select 2 horses to finish in the Top 2 in ANY order (e.g. 1-2 wins if 1st-2nd or 2nd-1st)."
                    : "★ 中奖条件：任选 2 匹马包揽前二名，不分名次先后（如选 1-2，无论是 1冠2亚 还是 2冠1亚 均中奖）！";
                oddsDesc = isEn
                    ? "★ Odds Range: ~5.0x to 80.0x. Plus, if any black horse hits Top 2, triggers JACKPOT BONUS +25%!"
                    : "★ 街机特权：若前二名中包含任一冷门黑马，立即引爆全服街机大爆机 JACKPOT BONUS +25% 赏金加成！";
                tips = isEn
                    ? "★ Frontier Tip: Pair a solid favorite with a high-speed underdog for massive payouts!"
                    : "★ 牛仔秘籍：以大热门搭配高爆发黑马，既有高胜率又能博取千倍街机爆彩！";
                badgeColor = WestColors.SEAL_RED;
                break;
            case "EXACTA":
                title = isEn ? "🎯 EXACTA SNIPER RULES" : "🎯 二连单精准场 · 玩法规则";
                tag = isEn ? "Exact 1st & 2nd Order · High Multiplier" : "严选冠亚 · 高倍绝杀";
                winCond = isEn
                    ? "★ Win Condition: Select 2 distinct horses in EXACT order: 1st Place (Winner) and 2nd Place (Runner-up)."
                    : "★ 中奖条件：选定 2 匹不同赛马，必须严格按次序分别命中第 1 名（冠军）与第 2 名（亚军）！";
                oddsDesc = isEn
                    ? "★ Odds Range: ~5.0x to 500.0x! Multiplies the individual odds of both horses."
                    : "★ 赔率机制：5.0x ~ 500.0x 超高赔率！组合赔率综合两匹马的独赢指数成倍放大。";
                tips = isEn
                    ? "★ Frontier Tip: Study race tactical archetypes to predict who overtakes at the wire!"
                    : "★ 牛仔秘籍：研判'领跑者'与'后劲超越型'战术组合，精准狙击终点线压线次序！";
                badgeColor = WestColors.TURQUOISE;
                break;
            case "TRIFECTA":
                title = isEn ? "👑 TRIFECTA CROWN RULES" : "👑 三重彩千倍巅峰场 · 玩法规则";
                tag = isEn ? "Exact 1st, 2nd & 3rd Order · Dream Pool" : "独揽前三 · 千倍梦想";
                winCond = isEn
                    ? "★ Win Condition: Select 3 distinct horses in EXACT order: 1st, 2nd, and 3rd Place!"
                    : "★ 中奖条件：选定 3 匹不同赛马，必须严格按次序包揽第 1 名（冠军）、第 2 名（亚军）与第 3 名（季军）！";
                oddsDesc = isEn
                    ? "★ Odds Range: Up to 2000.0x! The ultimate cowboy jackpot glory."
                    : "★ 赔率机制：最高可达 2000.0x！全服最具挑战性与最高赔付梦想的王座彩池！";
                tips = isEn
                    ? "★ Frontier Tip: A modest 5-coin wager can yield over 10,000 bounty gold!"
                    : "★ 牛仔秘籍：单注起投 5 金币，一旦三甲全部精准命中，可直接赢取破万巨额金库赏金！";
                badgeColor = WestColors.GOLD_BRIGHT;
                break;
        }

        this.text(titleBox, title, 0, 0, isEn ? 16 : 18, badgeColor);

        // 标签牌
        const tagBox = this.box(panel, 0, 252, 420, 30, WestColors.LEATHER_SADDLE, 6);
        this.text(tagBox, tag, 0, 0, isEn ? 12 : 13, WestColors.GOLD_BRIGHT);

        // 详细规则列表容器
        const cardBox = this.wantedPosterBox(panel, 0, 30, 580, 350, 8);
        const cardLabels = [winCond, oddsDesc, tips];
        const cardYs = [110, 20, -70];
        cardLabels.forEach((txt, idx) => {
            const row = this.woodBox(cardBox, 0, cardYs[idx], 540, 72, 6, WestColors.WOOD_DARK, WestColors.WOOD_FRAME);
            this.text(row, txt, 0, 0, isEn ? 12 : 13, WestColors.CREAM, HorizontalTextAlignment.CENTER, 520);
        });

        // 官方火漆印章
        const seal = new Node("RuleWaxSeal");
        seal.layer = cardBox.layer || Layers.Enum.UI_2D;
        cardBox.addChild(seal);
        seal.setPosition(235, -125, 0);
        seal.addComponent(UITransform).setContentSize(48, 48);
        WestStyle.drawWaxSealStamp(seal, 24);

        // 关闭按钮
        this.saloonButton(panel, isEn ? "🐎 Understood, Back to Arena" : "🐎 了解规则，进入赛场", 0, -260, 280, 46, closeModal, true, 16);
    }

    /** 启动时恢复会话并读取玩家与轮次快照。 */
    private async bootAsync(): Promise<void> {
        if (!ApiClient.getAccessToken() && ApiClient.getRefreshToken()) {
            await ApiClient.refresh();
        }

        if (!ApiClient.getAccessToken()) {
            await this.show("login");
            return;
        }

        try {
            await this.syncTime();
            await this.loadPlayer();
            await this.refreshRound();
            await this.show("lobby");
        } catch {
            ApiClient.clearTokens();
            this.message = I18n.t("login.expired", "登录状态已失效，请重新登录");
            await this.show("login");
        }
    }

    /** 屏幕物理微震动反馈（马刺冲刺、策马扬鞭、火漆印章砸下）。 */
    private shakeScreen(durationMs = 200, intensity = 4): void {
        const root = this.pageRoot;
        if (!root || !root.isValid || !(root as unknown as { _lpos?: unknown })._lpos) return;

        // 清理上一次未完成的震屏定时器，并复位基准位置
        this.clearShakeTimer();
        const origX = -360;
        const origY = -640;
        if (root.isValid && (root as unknown as { _lpos?: unknown })._lpos) {
            root.setPosition(origX, origY, 0);
        }

        const start = Date.now();
        this.shakeInterval = setInterval(() => {
            // 若节点已被销毁或进入析构，立即清理定时器并不再调用 setPosition，防止 null.x 异常
            if (!root || !root.isValid || !(root as unknown as { _lpos?: unknown })._lpos) {
                this.clearShakeTimer();
                return;
            }

            const elapsed = Date.now() - start;
            if (elapsed >= durationMs) {
                this.clearShakeTimer();
                if (root.isValid && (root as unknown as { _lpos?: unknown })._lpos) {
                    root.setPosition(origX, origY, 0);
                }
                return;
            }

            const offsetX = (Math.random() - 0.5) * intensity * 2;
            const offsetY = (Math.random() - 0.5) * intensity * 2;
            if (root.isValid && (root as unknown as { _lpos?: unknown })._lpos) {
                root.setPosition(origX + offsetX, origY + offsetY, 0);
            }
        }, 20);
    }

    private bgCanvasNode: Node | null = null;
    private currentSceneBg: string = "";

    /** 【日光边境·八景轮转】根据当前页面实时切换专属自然/建筑背景，全屏动态铺满无死角。 */
    private updatePageBackground(mountNode: Node, page: Page): void {
        const visibleSize = view.getVisibleSize();
        const vWidth = Math.max(720, visibleSize.width);
        const vHeight = Math.max(1280, visibleSize.height);

        if (!this.bgRoot || !this.bgRoot.isValid) {
            this.bgRoot = new Node("PersistentBackground");
            this.bgRoot.layer = Layers.Enum.UI_2D;
            mountNode.addChild(this.bgRoot);
            this.bgRoot.setSiblingIndex(0);
        }
        this.bgRoot.setPosition(-vWidth / 2, -vHeight / 2, 0);
        let bgTrans = this.bgRoot.getComponent(UITransform);
        if (!bgTrans) {
            bgTrans = this.bgRoot.addComponent(UITransform);
        }
        bgTrans.setContentSize(vWidth, vHeight);
        bgTrans.setAnchorPoint(0, 0);

        let sceneTag = "lobby";
        switch (page) {
            case "login":
            case "register":
                sceneTag = "login";
                break;
            case "lobby":
                sceneTag = "lobby";
                break;
            case "race":
                sceneTag = "race";
                break;
            case "result":
                sceneTag = "settlement";
                break;
            case "feat":
            case "tasks":
            case "ranking":
                sceneTag = "feats";
                break;
            case "stable":
            case "characters":
                sceneTag = "stable";
                break;
            case "settings":
            case "notices":
                sceneTag = "settings";
                break;
            case "bets":
            case "wallet":
            case "shop":
                sceneTag = "history";
                break;
            default:
                sceneTag = "lobby";
                break;
        }

        if (this.currentSceneBg === sceneTag && this.bgCanvasNode && this.bgCanvasNode.isValid) {
            return;
        }
        this.currentSceneBg = sceneTag;

        const oldBgCanvas = this.bgCanvasNode;

        // 创建专属图元画布 (居中填满整个可视区域)
        const bgCanvas = new Node("WestSceneCanvas");
        bgCanvas.layer = Layers.Enum.UI_2D;
        this.bgRoot.addChild(bgCanvas);
        bgCanvas.setPosition(vWidth / 2, vHeight / 2, 0);
        bgCanvas.addComponent(UITransform).setContentSize(vWidth, vHeight);
        this.bgCanvasNode = bgCanvas;

        WestStyle.drawSceneBackground(bgCanvas, sceneTag, vWidth, vHeight);

        // 如果存在旧背景，则新背景在 240ms 内平滑淡入覆盖，消除断崖式大色块突变与视觉闪烁
        if (oldBgCanvas && oldBgCanvas.isValid) {
            let newOpacity = bgCanvas.getComponent(UIOpacity);
            if (!newOpacity) {
                newOpacity = bgCanvas.addComponent(UIOpacity);
            }
            newOpacity.opacity = 0;
            tween(newOpacity)
                .to(0.24, { opacity: 255 }, { easing: "sineOut" })
                .call(() => {
                    if (oldBgCanvas && oldBgCanvas.isValid) {
                        oldBgCanvas.destroy();
                    }
                })
                .start();
        }

        // 篝火主题微弱火光闪烁层 (0.3Hz, ±5% 亮度波动)
        if (WestThemeManager.getMode() === "campfire") {
            const flickerNode = new Node("CampfireFlickerOverlay");
            flickerNode.layer = Layers.Enum.UI_2D;
            this.bgRoot.addChild(flickerNode);
            flickerNode.setPosition(vWidth / 2, vHeight / 2, 0);
            flickerNode.addComponent(UITransform).setContentSize(vWidth, vHeight);
            const fg = flickerNode.addComponent(Graphics);
            fg.fillColor = new Color(255, 120, 40, 10);
            fg.rect(-vWidth / 2, -vHeight / 2, vWidth, vHeight);
            fg.fill();
            tween(flickerNode)
                .repeatForever(
                    tween(flickerNode)
                        .to(1.65, { scale: new Vec3(1.02, 1.02, 1) }, { easing: "sineInOut" })
                        .to(1.65, { scale: new Vec3(0.98, 0.98, 1) }, { easing: "sineInOut" }),
                )
                .start();
        }

        // 宽屏左右两侧自适应西部沙龙边框
        this.updateWidescreenBorders(mountNode);
    }

    /** 手机竖屏 720x1280 居中原生呈现，宽屏两侧自适应绘制精致西部沙龙胡桃木壁纸边框与黄铜雕花。 */
    private updateWidescreenBorders(mountNode?: Node): void {
        const targetMount = mountNode ?? this.root ?? this.node;
        if (!targetMount || !targetMount.isValid) return;

        const visibleSize = view.getVisibleSize();
        if (visibleSize.width <= 720) {
            if (this.widescreenRoot && this.widescreenRoot.isValid) {
                this.widescreenRoot.destroy();
                this.widescreenRoot = null;
            }
            return;
        }

        if (this.widescreenRoot && this.widescreenRoot.isValid) {
            this.widescreenRoot.destroy();
            this.widescreenRoot = null;
        }

        const flankWidth = Math.ceil((visibleSize.width - 720) / 2) + 20;
        const totalHeight = Math.max(1280, visibleSize.height);

        const flankContainer = new Node("WidescreenSaloonFlanks");
        flankContainer.layer = Layers.Enum.UI_2D;
        targetMount.addChild(flankContainer);
        flankContainer.setSiblingIndex(1);
        this.widescreenRoot = flankContainer;

        const drawSaloonFlank = (isLeft: boolean): void => {
            const centerX = isLeft ? (-360 - flankWidth / 2) : (360 + flankWidth / 2);
            const flankNode = new Node(isLeft ? "LeftSaloonWallpaper" : "RightSaloonWallpaper");
            flankNode.layer = Layers.Enum.UI_2D;
            flankContainer.addChild(flankNode);
            flankNode.setPosition(centerX, 0, 0);
            flankNode.addComponent(UITransform).setContentSize(flankWidth, totalHeight);

            const g = flankNode.addComponent(Graphics);
            const halfW = flankWidth / 2;
            const halfH = totalHeight / 2;

            // 1. 深色胡桃木与红木墙裙底色
            g.fillColor = new Color(24, 15, 10, 255);
            g.rect(-halfW, -halfH, flankWidth, totalHeight);
            g.fill();

            // 2. 竖向橡木护墙板拼缝纹理
            const plankW = 48;
            const plankCount = Math.ceil(flankWidth / plankW) + 1;
            for (let i = 0; i < plankCount; i++) {
                const px = -halfW + i * plankW;
                g.strokeColor = new Color(38, 24, 16, 180);
                g.lineWidth = 2;
                g.moveTo(px, -halfH);
                g.lineTo(px, halfH);
                g.stroke();

                g.strokeColor = new Color(14, 8, 5, 220);
                g.lineWidth = 1;
                g.moveTo(px + 1, -halfH);
                g.lineTo(px + 1, halfH);
                g.stroke();
            }

            // 3. 西部沙龙大马士革复古菱形壁纸纹样
            g.strokeColor = new Color(68, 44, 28, 90);
            g.lineWidth = 1.5;
            const stepY = 80;
            for (let y = -halfH - stepY; y < halfH + stepY; y += stepY) {
                for (let x = -halfW; x < halfW + stepY; x += stepY) {
                    g.moveTo(x, y - 25);
                    g.lineTo(x + 25, y);
                    g.lineTo(x, y + 25);
                    g.lineTo(x - 25, y);
                    g.close();
                    g.stroke();
                }
            }

            // 4. 精致黄铜雕花与铆钉立柱边缘 (贴合 720 视口边缘)
            const edgeX = isLeft ? (halfW - 8) : (-halfW + 8);
            g.fillColor = WestColors.BRASS_FRAME;
            g.rect(edgeX - 4, -halfH, 8, totalHeight);
            g.fill();

            g.fillColor = WestColors.GOLD_METALLIC;
            g.rect(edgeX - 1, -halfH, 2, totalHeight);
            g.fill();

            // 边缘阴影 (给手机屏投射深度阴影)
            const shadowX = isLeft ? halfW : -halfW - 14;
            g.fillColor = new Color(0, 0, 0, 160);
            g.rect(shadowX, -halfH, 14, totalHeight);
            g.fill();

            // 黄铜铆钉阵列
            const rivetStep = 70;
            const rivetCount = Math.floor(totalHeight / rivetStep);
            for (let r = 0; r < rivetCount; r++) {
                const ry = -halfH + 35 + r * rivetStep;
                g.fillColor = WestColors.GOLD_BRIGHT;
                g.circle(edgeX, ry, 3.5);
                g.fill();
                g.fillColor = new Color(0, 0, 0, 120);
                g.circle(edgeX + 0.5, ry - 0.5, 1.5);
                g.fill();
            }

            // 5. 西部沙龙复古吊灯/铭牌装饰
            const decorY = [360, 0, -360];
            decorY.forEach((dy) => {
                const labelX = isLeft ? 10 : -10;
                this.text(flankNode, "★ 1888 SALOON ★", labelX, dy, 12, new Color(145, 105, 55, 160));
                this.text(flankNode, "⚜️", labelX, dy + 28, 18, new Color(185, 138, 48, 180));
            });
        };

        drawSaloonFlank(true);
        drawSaloonFlank(false);
    }

    /** 更新赛场内文字消息，并在居中偏上弹出 2 秒自动隐退的沉浸式提示框。 */
    private updateRaceMessage(msg: string): void {
        this.message = msg;
        if (this.raceMessageLabel && this.raceMessageLabel.isValid) {
            this.raceMessageLabel.string = msg;
        }
        if (msg) {
            const isSuccess = msg.includes("成功") || msg.includes("入账") || msg.includes("领奖") || msg.includes("到账");
            this.showToast(msg, isSuccess ? WestColors.GOLD_BRIGHT : WestColors.BANDANA_RED);
        }
    }

    /** 切换页面并平滑更新，异步构建完成后双向 Cross-Fade，彻底杜绝重复重入、白屏闪烁与组件跳变。 */
    private async show(page: Page): Promise<void> {
        if (this.isPageSwitching && this.page === page) {
            return;
        }
        this.isPageSwitching = true;
        const currentVersion = ++this.pageVersion;
        this.clearRaceTimer();
        this.clearShakeTimer();
        if (page !== "race") {
            WestAudio.stopGallop();
            this.raceMessageLabel = null;
        }
        this.page = page;

        const mountNode = this.root ?? this.node;
        mountNode.layer = Layers.Enum.UI_2D;
        this.updatePageBackground(mountNode, page);

        // 柔和的翻页音效与 8 景专属 BGM 切换
        if (page === "race") {
            WestAudio.playSaloonDoor("COMMON");
        } else {
            WestAudio.playLeatherPress("COMMON");
        }
        const bgmTarget = page === "race"
            ? (this.betMode === "QUINELLA" || this.betMode === "EXACTA" ? "race_quinella" : "race_win")
            : page;
        WestAudio.switchPageBgm(bgmTarget);
        if (page === "race") {
            WestAudio.switchMode(this.getAudioMode());
        }

        // 暂存旧页面节点，不立即销毁，作为平滑垫底以防止白屏突变
        const oldPageRoot = this.pageRoot;

        // 创建新页面，初始完全透明并挂载到 mountNode 上
        const newPageRoot = new Node("Page");
        newPageRoot.layer = Layers.Enum.UI_2D;
        mountNode.addChild(newPageRoot);
        newPageRoot.setPosition(-360, -640, 0);
        const trans = newPageRoot.addComponent(UITransform);
        trans.setContentSize(720, 1280);
        trans.setAnchorPoint(0, 0);

        let newPageOpacity = newPageRoot.getComponent(UIOpacity);
        if (!newPageOpacity) {
            newPageOpacity = newPageRoot.addComponent(UIOpacity);
        }
        newPageOpacity.opacity = 0;

        this.horses.clear();
        this.pageRoot = newPageRoot;

        try {
            switch (page) {
                case "login":
                    this.buildLogin();
                    break;
                case "register":
                    this.buildRegister();
                    break;
                case "lobby":
                    await this.buildLobby();
                    break;
                case "wallet":
                    await this.buildWallet();
                    break;
                case "race":
                    await this.buildRace();
                    break;
                case "tasks":
                    await this.buildTasks();
                    break;
                case "feat":
                    await this.buildFeat();
                    break;
                case "stable":
                    await this.buildStable();
                    break;
                case "characters":
                    await this.buildCharacters();
                    break;
                case "ranking":
                    await this.buildRanking();
                    break;
                case "shop":
                    await this.buildShop();
                    break;
                case "bets":
                    await this.buildBets();
                    break;
                case "notices":
                    await this.buildNotices();
                    break;
                case "settings":
                    this.buildSettings();
                    break;
                case "result":
                    await this.buildResult();
                    break;
            }

            // 新页面构建完毕，检查是否依然是当前版本
            if (this.pageVersion === currentVersion) {
                // 旧页面在 120ms 内柔和淡出并销毁
                if (oldPageRoot && oldPageRoot.isValid && oldPageRoot !== newPageRoot) {
                    WestMotion.fadeOutNode(oldPageRoot, 0.12, -4, () => {
                        if (oldPageRoot && oldPageRoot.isValid) {
                            oldPageRoot.destroy();
                        }
                    });
                }
                // 新页面在 200ms 内微浮入优雅渐显
                WestMotion.fadeInNode(newPageRoot, 0.20, 6);
            } else {
                // 如果页面版本已过时，安全清理废弃页面
                if (newPageRoot && newPageRoot.isValid) {
                    newPageRoot.destroy();
                }
            }
        } catch (err) {
            // 构建失败时不再向上抛异常（避免 void this.show(...) 产生未处理 Promise 拒绝）。
            // 改为清空半成品节点并渲染一个可恢复的错误兜底页，杜绝白屏。
            console.error(`[GameApp] 页面 "${page}" 构建失败:`, err);
            if (newPageRoot && newPageRoot.isValid) {
                newPageRoot.removeAllChildren();
                let op = newPageRoot.getComponent(UIOpacity);
                if (op) op.opacity = 255;
                try {
                    this.buildErrorFallback(page, err);
                } catch (fallbackErr) {
                    console.error("[GameApp] 错误兜底页渲染失败:", fallbackErr);
                }
            }
            if (oldPageRoot && oldPageRoot.isValid && oldPageRoot !== newPageRoot) {
                oldPageRoot.destroy();
            }
        } finally {
            if (this.pageVersion === currentVersion) {
                this.isPageSwitching = false;
            }
        }
    }

    /** 页面构建失败时的兜底 UI：显示错误信息并提供安全返回入口，避免白屏与未处理 Promise 拒绝。 */
    private buildErrorFallback(page: Page, err: unknown): void {
        const root = this.pageRoot;
        if (!root || !root.isValid) return;

        const isEn = I18n.getLocale() === "en-US";
        const box = this.box(root, 360, 640, 680, 520, WestColors.WOOD_DARK, 12);
        this.text(box, isEn ? "🤠 Oops! Something went wrong." : "🤠 哎呀！页面加载出了点岔子。", 0, 170, 24, WestColors.GOLD_BRIGHT);
        this.text(box, isEn ? "Error details (check console):" : "错误详情（请查看控制台）:", 0, 90, 14, WestColors.TEXT_PARCHMENT);

        const detail = this.text(
            box,
            err instanceof Error ? err.message : String(err),
            0,
            40,
            12,
            WestColors.BANDANA_RED,
            HorizontalTextAlignment.CENTER,
            600,
        );
        if (detail) {
            detail.overflow = Label.Overflow.SHRINK;
        }

        const safePage: Page = (page === "login" || page === "register") ? "login" : "lobby";
        this.westernButton(
            box,
            isEn ? "🐎 Back to Safe Page" : "🐎 返回安全页面",
            0,
            -90,
            380,
            56,
            () => {
                void this.show(safePage);
            },
            true,
            18,
        );
    }

    /** 播放西部沙龙百叶双开木门推开展现新景色的转场动效。 */
    private playSaloonDoorTransition(mountNode: Node): void {
        const transContainer = new Node("SaloonDoorTransition");
        transContainer.layer = Layers.Enum.UI_2D;
        mountNode.addChild(transContainer);
        transContainer.setSiblingIndex(99999);

        // 左扇门 (锚点在左边 x = -360)
        const leftDoor = new Node("LeftDoor");
        leftDoor.layer = Layers.Enum.UI_2D;
        transContainer.addChild(leftDoor);
        leftDoor.setPosition(-360, 0, 0);
        const lTrans = leftDoor.addComponent(UITransform);
        lTrans.setAnchorPoint(0, 0.5);
        lTrans.setContentSize(360, 1280);
        const lg = leftDoor.addComponent(Graphics);
        this.drawSaloonHalfDoor(lg, 360, 1280, true);

        // 右扇门 (锚点在右边 x = 360)
        const rightDoor = new Node("RightDoor");
        rightDoor.layer = Layers.Enum.UI_2D;
        transContainer.addChild(rightDoor);
        rightDoor.setPosition(360, 0, 0);
        const rTrans = rightDoor.addComponent(UITransform);
        rTrans.setAnchorPoint(1, 0.5);
        rTrans.setContentSize(360, 1280);
        const rg = rightDoor.addComponent(Graphics);
        this.drawSaloonHalfDoor(rg, 360, 1280, false);

        // 320ms 内百叶门由关到开向两侧旋转推开 (scaleX 从 1 变为 0)
        const duration = 0.32;
        tween(leftDoor)
            .to(duration, { scale: new Vec3(0, 1, 1) }, { easing: "quadOut" })
            .start();

        tween(rightDoor)
            .to(duration, { scale: new Vec3(0, 1, 1) }, { easing: "quadOut" })
            .call(() => {
                if (transContainer && transContainer.isValid) {
                    transContainer.destroy();
                }
            })
            .start();
    }

    /** 绘制西部沙龙半扇百叶木门 (Saloon Batwing Half Door) */
    private drawSaloonHalfDoor(g: Graphics, w: number, h: number, isLeft: boolean): void {
        g.clear();
        const startX = isLeft ? 0 : -w;

        // 1. 实木主框体 (橡木皮革棕)
        g.fillColor = WestColors.LEATHER_MEDIUM;
        g.roundRect(startX, -h / 2 + 180, w, h - 360, 12);
        g.fill();

        // 2. 门框深色滚边
        g.strokeColor = WestColors.LEATHER_DARK;
        g.lineWidth = 4;
        g.roundRect(startX + 4, -h / 2 + 184, w - 8, h - 368, 10);
        g.stroke();

        // 3. 百叶木板条阵列 (Louver Slats)
        const slatH = 22;
        const slatGap = 10;
        const slatTop = h / 2 - 250;
        const slatBottom = -h / 2 + 250;
        g.fillColor = WestColors.LEATHER_LIGHT;
        for (let sy = slatBottom; sy < slatTop; sy += (slatH + slatGap)) {
            g.roundRect(startX + 24, sy, w - 48, slatH, 4);
            g.fill();
            g.fillColor = new Color(0, 0, 0, 35);
            g.rect(startX + 24, sy, w - 48, 3);
            g.fill();
            g.fillColor = WestColors.LEATHER_LIGHT;
        }

        // 4. 双侧黄铜重型转轴铰链 (Brass Hinges)
        const hingeX = isLeft ? startX : startX + w - 16;
        g.fillColor = WestColors.BRASS;
        g.roundRect(hingeX, h / 2 - 280, 16, 50, 4);
        g.roundRect(hingeX, -h / 2 + 230, 16, 50, 4);
        g.fill();
        g.fillColor = WestColors.GUNMETAL;
        g.circle(hingeX + 8, h / 2 - 255, 3);
        g.circle(hingeX + 8, -h / 2 + 255, 3);
        g.fill();
    }

    /** 庆祝中奖：收益账本金箔升腾粒子特效 (Rising Gold Leaf Particles) */
    private spawnGoldFoilParticles(parent: Node): void {
        const foilRoot = new Node("GoldFoilContainer");
        foilRoot.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(foilRoot);
        foilRoot.setPosition(0, -30, 0);

        const goldColors = [
            WestColors.GOLD_LEAF,
            WestColors.GOLD_BRIGHT,
            new Color(255, 235, 140, 255),
            WestColors.BRASS,
        ];

        for (let i = 0; i < 24; i++) {
            if (!WestPerformance.shouldSpawnParticle(i)) {
                continue;
            }
            const flake = new Node(`Foil${i}`);
            flake.layer = foilRoot.layer;
            foilRoot.addChild(flake);

            const startX = (Math.random() - 0.5) * 560;
            const startY = -40 + Math.random() * 60;
            flake.setPosition(startX, startY, 0);

            const flakeW = 6 + Math.random() * 6;
            const flakeH = 8 + Math.random() * 8;
            flake.addComponent(UITransform).setContentSize(flakeW, flakeH);

            const fg = flake.addComponent(Graphics);
            fg.fillColor = goldColors[i % goldColors.length];
            fg.roundRect(-flakeW / 2, -flakeH / 2, flakeW, flakeH, 2);
            fg.fill();

            const endY = startY + 240 + Math.random() * 180;
            const driftX = startX + (Math.random() - 0.5) * 80;
            const flyTime = 1.0 + Math.random() * 1.2;

            tween(flake)
                .delay(Math.random() * 0.4)
                .to(
                    flyTime,
                    { position: new Vec3(driftX, endY, 0), angle: (Math.random() - 0.5) * 360 },
                    { easing: "quadOut" },
                )
                .call(() => {
                    if (flake && flake.isValid) {
                        flake.destroy();
                    }
                })
                .start();
        }

        setTimeout(() => {
            if (foilRoot && foilRoot.isValid) {
                foilRoot.destroy();
            }
        }, 3000);
    }

    /** 创建纯文字标签，全面接入 v2.1 四级排版阶梯与容器自适应换行，杜绝描述超出卡片边框。 */
    private text(
        parent: Node,
        content: string,
        x: number,
        y: number,
        size = 28,
        color = WestColors.INK_BROWN,
        align?: HorizontalTextAlignment,
        maxWidth?: number,
    ): Label {
        const node = new Node("Label");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);

        const label = node.addComponent(Label);
        label.string = content;

        let level: TypographyLevel = "body";
        if (size >= 40) {
            level = "display";
        } else if (size >= 26) {
            level = "heading";
        } else if (size >= 20) {
            level = "body";
        } else {
            level = "caption";
        }

        // 容器自适应边界检测：杜绝任何描述文字超出卡片边框
        let effectiveMaxWidth = maxWidth;
        if (!effectiveMaxWidth) {
            const parentTrans = parent.getComponent(UITransform);
            if (parentTrans && parentTrans.width > 70) {
                let estWidth = 0;
                for (let i = 0; i < content.length; i++) {
                    estWidth += content.charCodeAt(i) > 255 ? size * 1.05 : size * 0.6;
                }
                const safeParentMax = Math.max(70, parentTrans.width - 24);
                if (estWidth > safeParentMax) {
                    effectiveMaxWidth = safeParentMax;
                }
            }
        }

        WestTypography.apply(label, level, {
            size,
            color,
            align,
            maxWidth: effectiveMaxWidth,
            overflow: effectiveMaxWidth ? Label.Overflow.RESIZE_HEIGHT : Label.Overflow.NONE,
        });

        return label;
    }

    /** 创建矩形边框容器，支持自定义填充色与圆角。 */
    private box(
        parent: Node,
        x: number,
        y: number,
        width: number,
        height: number,
        fillColor = new Color(35, 42, 58, 255),
        radius = 16,
    ): Node {
        const node = new Node("Box");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);

        node.addComponent(UITransform).setContentSize(width, height);

        const graphics = node.addComponent(Graphics);
        graphics.fillColor = fillColor;
        if (radius > 0) {
            graphics.roundRect(
                -width / 2,
                -height / 2,
                width,
                height,
                radius,
            );
        } else {
            graphics.rect(-width / 2, -height / 2, width, height);
        }
        graphics.fill();

        return node;
    }

    /**
     * 统一绑定高灵敏度触控与点击事件，通过 WestMotion 参数化动效引擎驱动。
     * 支持 v2.1 动效参数（120ms easeOutBack + 0.94 缩放回弹）、音画绑定与 200ms 防抖防重。
     */
    private bindClick(node: Node, onClick: () => void, isCoreAction = false): void {
        const btn = node.getComponent(Button) || node.addComponent(Button);
        btn.transition = Button.Transition.NONE;
        let lastTrigger = 0;
        const trigger = (): void => {
            const now = Date.now();
            if (now - lastTrigger < 200) {
                return;
            }
            lastTrigger = now;
            WestMotion.playButtonPress(node, isCoreAction, () => {
                onClick();
            });
        };
        // 仅使用 Button.EventType.CLICK，不要同时注册 TOUCH_END，
        // 否则 Button 组件内部已经将 touch → click 事件转发，重复注册会导致
        // 事件调度竞争与触控坐标二次变换偏移。
        node.on(Button.EventType.CLICK, trigger, this);
    }

    /** 创建可点击按钮，使用 Cocos 原生 Button 组件与轻微按压缩放反馈。 */
    private button(
        parent: Node,
        title: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick: () => void,
        btnColor = new Color(48, 58, 82, 255),
        textColor = new Color(255, 255, 255, 255),
        fontSize = 24,
    ): Node {
        const node = this.box(parent, x, y, width, height, btnColor);
        this.text(node, title, 0, 0, fontSize, textColor);
        this.bindClick(node, onClick);
        return node;
    }

    /** 创建美国西部老橡木底板容器（双层木板纹 + 四角黄铜铆钉）。 */
    private woodBox(
        parent: Node,
        x: number,
        y: number,
        width: number,
        height: number,
        radius = 12,
        fillColor = WestColors.WOOD_DARK,
        borderColor = WestColors.WOOD_FRAME,
    ): Node {
        const node = new Node("WoodBox");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawWoodPlank(node, width, height, radius, fillColor, borderColor);
        return node;
    }

    /** 创建复古羊皮纸 / 悬赏告示面板容器（焦边纸张质感）。 */
    private parchmentBox(
        parent: Node,
        x: number,
        y: number,
        width: number,
        height: number,
        radius = 10,
    ): Node {
        const node = new Node("ParchmentBox");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawParchment(node, width, height, radius);
        return node;
    }

    /** 创建西部专属行动按钮（首要行动为红头巾金边，普通行动为木质皮纹）。 */
    private westernButton(
        parent: Node,
        title: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick: () => void,
        isPrimary = true,
        fontSize = 22,
    ): Node {
        const node = new Node("WestButton");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawActionBanner(node, width, height, isPrimary);

        this.text(
            node,
            title,
            0,
            0,
            fontSize,
            isPrimary ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT,
        );
        this.bindClick(node, onClick);
        return node;
    }

    /** 创建奢华西部沙龙实木主面板容器（双层原木板纹 + 铁铸包角 + 黄铜铆钉 + 水平木缝暗线）。 */
    private grandSaloonBox(
        parent: Node,
        x: number,
        y: number,
        width: number,
        height: number,
        radius = 14,
        fillColor = WestColors.WOOD_DARK,
        borderColor = WestColors.WOOD_FRAME,
    ): Node {
        const node = new Node("GrandSaloonBox");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawGrandSaloonPanel(node, width, height, radius, fillColor, borderColor);
        return node;
    }

    /** 创建复古通缉令 / 悬赏卡片面板容器（牛皮纸底 + 粗黑炭边框 + 双线印痕）。 */
    private wantedPosterBox(
        parent: Node,
        x: number,
        y: number,
        width: number,
        height: number,
        radius = 8,
    ): Node {
        const node = new Node("WantedPosterBox");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawSunBleachedPoster(node, width, height, radius);
        return node;
    }

    /** 创建酒馆黑板 / 告示牌容器（深色石板底 + 实木边框 + 粉笔细线）。 */
    private chalkboardBox(
        parent: Node,
        x: number,
        y: number,
        width: number,
        height: number,
        radius = 8,
    ): Node {
        const node = new Node("ChalkboardBox");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawChalkBoard(node, width, height, radius);
        return node;
    }

    /** 创建复古酒馆木质招牌按钮（挂链铁环、黄铜边框、雕刻原木面）。 */
    private saloonButton(
        parent: Node,
        title: string,
        x: number,
        y: number,
        width: number,
        height: number,
        onClick: () => void,
        isHighlight = false,
        fontSize = 18,
    ): Node {
        const node = new Node("SaloonSignBtn");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y);
        node.addComponent(UITransform).setContentSize(width, height);
        WestStyle.drawSaloonSign(node, width, height, 8, isHighlight);

        this.text(
            node,
            title,
            0,
            0,
            fontSize,
            isHighlight ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT,
        );
        this.bindClick(node, onClick);
        return node;
    }

    /** 初始化音频本地持久化状态。 */
    private initAudioSettings(): void {
        try {
            if (typeof localStorage !== "undefined") {
                const savedMusic = localStorage.getItem("racegame.musicEnabled") ?? localStorage.getItem("racegame_audio_music");
                if (savedMusic !== null) {
                    this.musicEnabled = savedMusic === "true";
                }
                const savedSfx = localStorage.getItem("racegame.soundEnabled") ?? localStorage.getItem("racegame_audio_sfx");
                if (savedSfx !== null) {
                    this.soundFxEnabled = savedSfx === "true";
                }
            }
        } catch {
            // ignore
        }
        WestAudio.setMusicEnabled(this.musicEnabled);
        WestAudio.setSoundEnabled(this.soundFxEnabled);
    }

    /** 切换背景音乐开关。 */
    private toggleMusic(): void {
        this.musicEnabled = !this.musicEnabled;
        WestAudio.setMusicEnabled(this.musicEnabled);
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("racegame.musicEnabled", String(this.musicEnabled));
                localStorage.setItem("racegame_audio_music", String(this.musicEnabled));
            }
        } catch {
            // ignore
        }
        this.message = this.musicEnabled ? "🎵 留声机配乐: 已开启" : "🎵 留声机配乐: 已静音";
    }

    /** 切换音效开关。 */
    private toggleSoundFx(): void {
        this.soundFxEnabled = !this.soundFxEnabled;
        WestAudio.setSoundEnabled(this.soundFxEnabled);
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem("racegame.soundEnabled", String(this.soundFxEnabled));
                localStorage.setItem("racegame_audio_sfx", String(this.soundFxEnabled));
            }
        } catch {
            // ignore
        }
        this.message = this.soundFxEnabled ? "🔊 枪炮与马蹄: 已开启" : "🔊 枪炮与马蹄: 已静音";
    }

    /** 根据玩家等级计算段位称号（1级骑师 ~ 皇家骑师）。 */
    private getPlayerTitle(level: number): string {
        if (level > 40) {
            return I18n.t("title.royal");
        }
        if (level > 30) {
            const sub = level - 30;
            return `${sub}${I18n.t("title.elite")}`;
        }
        if (level > 20) {
            const sub = level - 20;
            return `${sub}${I18n.t("title.senior")}`;
        }
        if (level > 10) {
            const sub = level - 10;
            return `${sub}${I18n.t("title.master")}`;
        }
        const sub = Math.max(1, level);
        return `${sub}${I18n.t("title.jockey")}`;
    }

    /** 计算星月日冠徽章矩阵（3星=1月，3月=1日，3日=1冠）。 */
    private getBadgeString(level: number): string {
        const totalStars = Math.max(1, level);
        const crowns = Math.floor(totalStars / 27);
        const remAfterCrowns = totalStars % 27;
        const suns = Math.floor(remAfterCrowns / 9);
        const remAfterSuns = remAfterCrowns % 9;
        const moons = Math.floor(remAfterSuns / 3);
        const stars = remAfterSuns % 3;

        let badges = "";
        for (let i = 0; i < crowns; i += 1) badges += "👑";
        for (let i = 0; i < suns; i += 1) badges += "☀️";
        for (let i = 0; i < moons; i += 1) badges += "🌙";
        for (let i = 0; i < stars; i += 1) badges += "★";
        return badges || "★";
    }

    /** 在弹窗面板右上角添加精致的关闭 (✕) 小按钮 */
    private addModalCloseBtn(panel: Node, panelW: number, panelH: number, onClose: () => void): Node {
        const btn = this.box(panel, panelW / 2 - 30, panelH / 2 - 28, 34, 34, WestColors.WOOD_DARK, 6);
        const g = btn.getComponent(Graphics);
        if (g) {
            g.strokeColor = WestColors.BRASS_FRAME;
            g.lineWidth = 1.2;
            g.stroke();
        }
        this.text(btn, "✕", 0, 0, 16, WestColors.GOLD_BRIGHT);
        this.bindClick(btn, onClose);
        return btn;
    }

    /** 商城购买高额金币防误触二次确认弹窗 */
    private showPurchaseConfirmModal(productId: number, title: string, price: number): void {
        const root = this.pageRoot || this.node;
        if (!root || !root.isValid) return;

        const isEn = I18n.getLocale() === "en-US";
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        mask.setSiblingIndex(99999);

        const modalBox = this.grandSaloonBox(mask, 0, 0, 560, 340, 16, WestColors.WOOD_DARK, WestColors.GOLD_METALLIC);
        WestMotion.playModalEnter(modalBox, mask);

        const closeModal = (): void => {
            WestMotion.playModalExit(modalBox, mask, () => {
                if (mask && mask.isValid) mask.destroy();
            });
        };
        this.bindClick(mask, closeModal);
        this.addModalCloseBtn(modalBox, 560, 340, closeModal);

        const titleBox = this.chalkboardBox(modalBox, 0, 125, 500, 40, 6);
        this.text(titleBox, `🛒 ${I18n.t("shop.confirmTitle", "确认购置装备")}`, 0, 0, 18, WestColors.GOLD_BRIGHT);

        const contentBox = this.wantedPosterBox(modalBox, 0, 22, 480, 115, 8);
        this.text(contentBox, `🎁 ${title}`, 0, 24, 20, WestColors.INK_DARK);
        this.text(
            contentBox,
            isEn ? `Spend ${this.formatMoney(price)} 🪙 to acquire this item?` : `是否消耗 ${this.formatMoney(price)} 🪙 购置该特许装备？`,
            0,
            -16,
            14,
            WestColors.LEATHER_SADDLE,
        );

        // 确认购买按钮
        this.westernButton(
            modalBox,
            `🐎 ${I18n.t("shop.confirmYes", "确认购置")}`,
            -120,
            -105,
            200,
            46,
            () => {
                closeModal();
                void this.purchaseAsync(productId);
            },
            true,
            16,
        );

        // 取消按钮
        this.saloonButton(
            modalBox,
            I18n.t("shop.confirmNo", "稍后再说"),
            120,
            -105,
            200,
            46,
            closeModal,
            false,
            16,
        );
    }

    /** 渲染顶部 HUD（头像、等级、昵称、头衔、经验、COIN 余额与设置齿轮）。 */
    private buildTopHud(root: Node): void {
        const player = this.player;
        const level = player?.character?.level ?? player?.level ?? 1;
        const title = this.getPlayerTitle(level);
        const badges = this.getBadgeString(level);

        const hudRoot = new Node("TopHudContainer");
        hudRoot.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(hudRoot);
        hudRoot.setSiblingIndex(9998);

        // 1. 顶部老橡木双层底板容器 (LEATHER_MEDIUM + BRASS)
        this.woodBox(hudRoot, 360, 1228, 700, 84, 14, WestColors.LEATHER_MEDIUM, WestColors.BRASS);

        // 2. 警长黄铜星徽头像框 (统一点击打开更衣室档案，对齐主流大众习惯)
        const avatarBox = this.box(hudRoot, 58, 1228, 62, 62, WestColors.BRASS_FRAME, 31);
        this.text(avatarBox, "🤠", 0, 0, 32);
        if (this.page !== "login" && this.page !== "register") {
            this.bindClick(avatarBox, () => {
                void this.show("characters");
            });
        }

        // 3. 皮鞍褐色等级标签
        const lvPill = this.box(hudRoot, 58, 1198, 56, 20, WestColors.LEATHER_SADDLE, 8);
        this.text(lvPill, `Lv.${level}`, 0, 0, 12, WestColors.GOLD_BRIGHT);

        // 4. 玩家昵称（羊皮纸亮文字，左对齐稳固排版）
        this.text(
            hudRoot,
            player?.nickname ?? "Cowboy",
            98,
            1248,
            19,
            WestColors.TEXT_PARCHMENT,
            HorizontalTextAlignment.LEFT,
        );

        // 5. 段位与双重连胜指标 (左对齐，避免居中漂移遮挡金币胶囊)
        const hitStreak = player?.currentHitStreak ?? 0;
        const profitStreak = player?.currentProfitStreak ?? 0;
        const isEn = I18n.getLocale() === "en-US";
        const streakText = isEn
            ? `⭐ ${title} ${badges} | 🎯 ${hitStreak}W 💰 ${profitStreak}P`
            : `⭐ ${title} ${badges} | 🎯 ${hitStreak}连 💰 ${profitStreak}连`;
        this.text(
            hudRoot,
            streakText,
            98,
            1226,
            isEn ? 11 : 12,
            WestColors.GOLD_BRIGHT,
            HorizontalTextAlignment.LEFT,
        );

        // 6. 经验进度条（深木槽 + 仙人掌绿充能）
        const exp = player?.exp ?? 0;
        this.box(hudRoot, 148, 1205, 100, 8, WestColors.WOOD_FRAME, 4);
        const expFillWidth = Math.min(100, Math.max(8, (exp % 10) * 10));
        this.box(
            hudRoot,
            148 - 50 + expFillWidth / 2,
            1205,
            expFillWidth,
            8,
            WestColors.DESERT_SAGE,
            4,
        );
        this.text(hudRoot, `Exp:${exp}`, 220, 1205, 11, WestColors.PARCHMENT_BORDER);

        // 7. 西部金币皮囊胶囊 (拓宽至 160px，点击胶囊直达金库账本 wallet，点击 + 号直达商城补给 shop)
        const goldBox = this.woodBox(hudRoot, 480, 1228, 160, 36, 18, WestColors.LEATHER_DARK, WestColors.TURQUOISE);
        this.bindClick(goldBox, () => {
            void this.show("wallet");
        });
        const turquoiseGem = this.box(goldBox, -68, 0, 12, 12, WestColors.TURQUOISE, 6);
        const gemG = turquoiseGem.getComponent(Graphics);
        if (gemG) {
            gemG.strokeColor = WestColors.SHELL_SILVER;
            gemG.lineWidth = 1.2;
            gemG.circle(0, 0, 6);
            gemG.stroke();
        }
        this.text(
            goldBox,
            `🪙 ${this.formatMoney(player?.balance ?? 0)}`,
            -4,
            0,
            14,
            WestColors.GOLD_BRIGHT,
        );
        this.button(
            goldBox,
            "+",
            58,
            0,
            24,
            24,
            () => {
                void this.show("shop");
            },
            WestColors.GOLD_METALLIC,
            WestColors.WOOD_FRAME,
            18,
        );

        // 8. 设置齿轮按钮（风蚀黄铜木质）
        this.button(
            hudRoot,
            "⚙️",
            655,
            1228,
            44,
            44,
            () => {
                void this.show("settings");
            },
            WestColors.WOOD_MEDIUM,
            WestColors.TEXT_PARCHMENT,
            20,
        );

        // 9. 破产救济金调度倒计时横幅（西部加急悬赏令红底，显示每日5次限额）
        if (
            player &&
            player.balance <= 0 &&
            player.relief &&
            player.relief.status === "SCHEDULED"
        ) {
            const grantMs = new Date(player.relief.grantAt).getTime();
            const nowMs = Date.now() + this.serverOffsetMs;
            const diffSec = Math.max(0, Math.floor((grantMs - nowMs) / 1000));
            const hours = Math.floor(diffSec / 3600).toString().padStart(2, "0");
            const mins = Math.floor((diffSec % 3600) / 60).toString().padStart(2, "0");
            const secs = (diffSec % 60).toString().padStart(2, "0");
            const timeStr = `${hours}:${mins}:${secs}`;

            const banner = this.box(hudRoot, 360, 1172, 700, 30, WestColors.BANDANA_RED, 8);
            const dailyCount = player.relief.dailyCount ?? 0;
            const msg = diffSec > 0
                ? (isEn
                    ? `Relief Ready in: ${timeStr} (${dailyCount}/5 daily claimed · Auto-credit)`
                    : `${I18n.t("relief.grantScheduled").replace("{0}", timeStr)} (今日已领 ${dailyCount}/5 次 · 到期或上线自动到账)`)
                : (isEn
                    ? `Relief Ready! (${dailyCount}/5 daily claimed · Auto-credit)`
                    : `${I18n.t("relief.grantNow")} (今日已领 ${dailyCount}/5 次 · 自动到账)`);
            this.text(banner, msg, 0, 0, isEn ? 12 : 13, WestColors.PARCHMENT_LIGHT);
        }
    }

    /** 渲染常驻底部 5-Tab 导航栏（老橡木酒馆栓马桩底板 + 中心突出大马鞍按钮，对标 1.png）。 */
    private buildBottomNav(
        root: Node,
        currentTab: "tasks" | "feat" | "stable" | "battle" | "rank" | "shop" | "none",
    ): void {
        const navRoot = new Node("BottomNavContainer");
        navRoot.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(navRoot);
        navRoot.setSiblingIndex(9999);

        // 底部厚重木纹横梁 (原木本色 + 烧烙印字，暖而不暗)
        this.box(navRoot, 360, 48, 720, 96, WestColors.LEATHER_MEDIUM, 0);
        this.box(navRoot, 360, 96, 720, 3, WestColors.BRASS, 0);

        const normalBg = WestColors.LEATHER_LIGHT;
        const activeBg = WestColors.BANDANA_RED;
        const activeText = WestColors.CREAM;
        const normalText = WestColors.INK_BROWN;
        const isEnNav = I18n.getLocale() === "en-US";
        const navFontSize = isEnNav ? 14 : 17;

        // 1. 任务 (悬赏令)
        this.button(
            navRoot,
            `📋 ${I18n.t("nav.tasks")}`,
            75,
            48,
            110,
            68,
            () => {
                void this.show("tasks");
            },
            currentTab === "tasks" ? activeBg : normalBg,
            currentTab === "tasks" ? activeText : normalText,
            navFontSize,
        );

        // 2. 功勋 (荣誉勋章，对标 1.png Feat 页面)
        this.button(
            navRoot,
            `🏆 ${I18n.t("nav.feat")}`,
            195,
            48,
            110,
            68,
            () => {
                void this.show("feat");
            },
            currentTab === "feat" ? activeBg : normalBg,
            currentTab === "feat" ? activeText : normalText,
            navFontSize,
        );

        // 3. 赛场 / 回主城（核心突出居中金边马鞍大按钮，对标 1.png）
        const battleBtn = this.box(navRoot, 360, 60, 138, 90, WestColors.BANDANA_RED, 18);
        WestStyle.drawActionBanner(battleBtn, 138, 90, true);
        const isBattleTab = currentTab === "battle" || this.page === "race";
        const centerIcon = isBattleTab ? "🏠" : "🏇";
        const centerText = isBattleTab ? I18n.t("common.backLobby", "回主城") : I18n.t("nav.battle");
        this.text(battleBtn, `${centerIcon}\n${centerText}`, 0, 0, isEnNav ? 16 : 19, WestColors.GOLD_BRIGHT);
        this.bindClick(battleBtn, () => {
            if (this.page === "race" || isBattleTab) {
                void this.show("lobby");
            } else {
                void this.show("race");
            }
        });

        // 4. 排行 (风云榜)
        this.button(
            navRoot,
            `🎖️ ${I18n.t("nav.rank")}`,
            525,
            48,
            110,
            68,
            () => {
                void this.show("ranking");
            },
            currentTab === "rank" ? activeBg : normalBg,
            currentTab === "rank" ? activeText : normalText,
            navFontSize,
        );

        // 5. 商城 (补给站)
        this.button(
            navRoot,
            `🛒 ${I18n.t("nav.shop")}`,
            645,
            48,
            110,
            68,
            () => {
                void this.show("shop");
            },
            currentTab === "shop" ? activeBg : normalBg,
            currentTab === "shop" ? activeText : normalText,
            navFontSize,
        );
    }

    /** 创建输入框；密码输入使用旧皮革深棕内嵌底，普通输入使用亚麻布织线奶油底。 */
    private input(
        parent: Node,
        placeholder: string,
        x: number,
        y: number,
        width: number,
        height: number,
        defaultValue = "",
        password = false,
    ): EditBox {
        // 动态注入全局 Web EditBox 像素级对齐与抗错位规则
        if (typeof document !== "undefined" && !document.getElementById("cocos-editbox-align-fix")) {
            const style = document.createElement("style");
            style.id = "cocos-editbox-align-fix";
            style.textContent = `
                .cocosEditBox, input.cocosEditBox, textarea.cocosEditBox,
                .cocos-edit-box, input.cocos-edit-box, textarea.cocos-edit-box {
                    box-sizing: border-box !important;
                    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif !important;
                    letter-spacing: 0.5px !important;
                    outline: none !important;
                    border: none !important;
                    background: transparent !important;
                    resize: none !important;
                    overflow: hidden !important;
                }
                /* 彻底消除 WebKit 浏览器下 textarea 默认的垂直滚动条与箭头 */
                textarea.cocosEditBox::-webkit-scrollbar,
                .cocosEditBox::-webkit-scrollbar {
                    display: none !important;
                    width: 0 !important;
                    height: 0 !important;
                }
            `;
            document.head.appendChild(style);
        }

        const node = new Node(password ? "LeatherInputBox" : "LinenInputBox");
        node.layer = parent.layer || Layers.Enum.UI_2D;
        parent.addChild(node);
        node.setPosition(x, y, 0);
        node.addComponent(UITransform).setContentSize(width, height);

        if (password) {
            WestStyle.drawLeatherInputBox(node, width, height);
        } else {
            WestStyle.drawLinenInputBox(node, width, height);
        }

        const paddingLeft = 18;
        const paddingRight = password ? 46 : 18;
        const labelW = width - paddingLeft - paddingRight;

        // 1. 显式创建 Canvas 渲染的占位提示 (Placeholder) Label 子节点
        const placeholderNode = new Node("PLACEHOLDER_LABEL");
        placeholderNode.layer = node.layer;
        node.addChild(placeholderNode);
        // 引擎 EditBox 的 _updateLabelPosition 按 (0,1) 锚点排版（顶部-左对齐），
        // 若这里用 (0,0.5) 会被引擎重排到输入框顶部导致文字漂移错位，
        // 因此必须与引擎约定保持一致：(0,1) + y = height/2 才能保证文字垂直居中。
        const phTrans = placeholderNode.addComponent(UITransform);
        phTrans.setContentSize(labelW, height);
        phTrans.setAnchorPoint(0, 1);
        placeholderNode.setPosition(-width / 2 + paddingLeft, height / 2, 0);

        const placeholderLabel = placeholderNode.addComponent(Label);
        placeholderLabel.string = placeholder;
        placeholderLabel.fontSize = Math.min(18, Math.round(height * 0.40));
        placeholderLabel.lineHeight = height;
        placeholderLabel.color = password
            ? new Color(205, 160, 115, 170)
            : new Color(145, 115, 85, 170);
        placeholderLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
        placeholderLabel.verticalAlign = VerticalTextAlignment.CENTER;
        placeholderLabel.overflow = Label.Overflow.CLAMP;

        // 2. 显式创建 Canvas 渲染的已输入文本 (Text) Label 子节点
        const textNode = new Node("TEXT_LABEL");
        textNode.layer = node.layer;
        node.addChild(textNode);
        const textTrans = textNode.addComponent(UITransform);
        textTrans.setContentSize(labelW, height);
        textTrans.setAnchorPoint(0, 1);
        textNode.setPosition(-width / 2 + paddingLeft, height / 2, 0);

        const textLabel = textNode.addComponent(Label);
        textLabel.string = defaultValue ? (password ? "•".repeat(defaultValue.length) : defaultValue) : "";
        textLabel.fontSize = Math.min(20, Math.round(height * 0.44));
        textLabel.lineHeight = height;
        textLabel.color = password ? WestColors.GOLD_BRIGHT : WestColors.INK_BROWN;
        textLabel.horizontalAlign = HorizontalTextAlignment.LEFT;
        textLabel.verticalAlign = VerticalTextAlignment.CENTER;
        textLabel.overflow = Label.Overflow.CLAMP;

        // 根据是否有默认值决定初始显示
        placeholderLabel.node.active = !defaultValue;
        textLabel.node.active = Boolean(defaultValue);

        // 3. 挂载 EditBox 控制器组件并正式绑定 Label 资产
        const editBox = node.addComponent(EditBox);
        editBox.textLabel = textLabel;
        editBox.placeholderLabel = placeholderLabel;
        editBox.placeholder = placeholder;
        editBox.string = defaultValue;
        editBox.inputMode = EditBox.InputMode.SINGLE_LINE;
        editBox.returnType = EditBox.KeyboardReturnType.DONE;
        editBox.inputFlag = password
            ? EditBox.InputFlag.PASSWORD
            : EditBox.InputFlag.DEFAULT;
        editBox.maxLength = 32;

        // EditBox 在 addComponent 时已按引擎 (0,1) 锚点重排过 Label（左内边距被重置为 2px），
        // 这里在挂载完成后显式恢复“垂直居中 + 设计内边距”，确保占位符/文本与输入框精确对齐。
        placeholderNode.setPosition(-width / 2 + paddingLeft, height / 2, 0);
        placeholderNode.getComponent(UITransform)?.setContentSize(labelW, height);
        textNode.setPosition(-width / 2 + paddingLeft, height / 2, 0);
        textNode.getComponent(UITransform)?.setContentSize(labelW, height);

        // 禁用 EditBox 自动挂载的白色默认精灵，保留矢量绘制的高质感边框底板
        const sp = node.getComponent(Sprite);
        if (sp) {
            sp.enabled = false;
        }
        editBox.backgroundImage = null;

        // 密码明暗文切换小眼睛按钮 (👁️ / 🙈)
        let isPlain = false;
        if (password) {
            const eyeBtn = this.box(node, width / 2 - 24, 0, 36, 36, new Color(0, 0, 0, 0), 4);
            const eyeLabel = this.text(eyeBtn, "👁️", 0, 0, 16, WestColors.GOLD_BRIGHT);
            this.bindClick(eyeBtn, () => {
                isPlain = !isPlain;
                eyeLabel.string = isPlain ? "🙈" : "👁️";
                editBox.inputFlag = isPlain ? EditBox.InputFlag.DEFAULT : EditBox.InputFlag.PASSWORD;
                if (textLabel && textLabel.isValid) {
                    textLabel.string = (password && !isPlain) ? "•".repeat(editBox.string.length) : editBox.string;
                }
                const impl = (editBox as unknown as { _impl?: { _edTxt?: HTMLInputElement | HTMLTextAreaElement } })._impl;
                if (impl?._edTxt) {
                    impl._edTxt.setAttribute("type", isPlain ? "text" : "password");
                }
            });
        }

        // 4. Web 平台绝对像素精确定位同步函数：杜绝 Cocos 内部矩阵在缩放与视口变化下的漂移错位
        const syncWebDomPosition = (): void => {
            if (typeof document === "undefined") return;
            const impl = (editBox as unknown as { _impl?: { _edTxt?: HTMLInputElement | HTMLTextAreaElement; _isTextArea?: boolean } })._impl;
            const edTxt = impl?._edTxt;
            if (!edTxt) return;

            const canvasElem = document.querySelector("canvas");
            if (!canvasElem) return;

            const rect = canvasElem.getBoundingClientRect();
            const visibleSize = view.getVisibleSize();
            if (visibleSize.width <= 0 || visibleSize.height <= 0) return;

            const worldPos = new Vec3();
            node.getWorldPosition(worldPos);

            let centerX = 0;
            let centerY = 0;
            let domW = width;
            let domH = height;

            // 优先使用 Cocos 渲染相机的视口投影算法，获得 100% 精确的屏幕像素坐标
            const sceneCamera = director.getScene()?.getComponentInChildren(Camera);
            if (sceneCamera) {
                const screenPos = new Vec3();
                sceneCamera.worldToScreen(worldPos, screenPos);
                const dpr = typeof window !== "undefined" && window.devicePixelRatio ? window.devicePixelRatio : 1;
                const clientCanvasX = screenPos.x / dpr;
                const clientCanvasY = (canvasElem.height - screenPos.y) / dpr;
                centerX = rect.left + clientCanvasX;
                centerY = rect.top + clientCanvasY;
                const scale = rect.width / (visibleSize.width || 720);
                domW = width * scale;
                domH = height * scale;
            } else {
                const scaleX = rect.width / (visibleSize.width || 720);
                const scaleY = rect.height / (visibleSize.height || 1280);
                domW = width * scaleX;
                domH = height * scaleY;
                centerX = rect.left + rect.width / 2 + worldPos.x * scaleX;
                centerY = rect.top + rect.height / 2 - worldPos.y * scaleY;
            }

            const scaleRatio = domW / width;
            const domPadL = Math.round(paddingLeft * scaleRatio);
            const domPadR = Math.round(paddingRight * scaleRatio);
            const domFontSize = Math.max(14, Math.round(Math.min(20, height * 0.44) * scaleRatio));

            // 使用 setProperty(..., 'important') 强力锁死样式并置顶，确保在输入框内绝对对齐且不被任何 UI 遮挡。
            // 注意：不能强制 display/visibility/opacity —— 显隐完全交给引擎 _showDom/_hideDom 控制，
            // 否则所有输入框的 DOM 会永久可见并叠在一起，导致点击错位与显示混乱。
            edTxt.style.setProperty("position", "fixed", "important");
            edTxt.style.setProperty("z-index", "999999", "important");
            edTxt.style.setProperty("transform", "none", "important");
            edTxt.style.setProperty("-webkit-transform", "none", "important");
            edTxt.style.setProperty("left", `${Math.round(centerX - domW / 2)}px`, "important");
            edTxt.style.setProperty("top", `${Math.round(centerY - domH / 2)}px`, "important");
            edTxt.style.setProperty("width", `${Math.round(domW)}px`, "important");
            edTxt.style.setProperty("height", `${Math.round(domH)}px`, "important");
            edTxt.style.setProperty("line-height", `${Math.round(domH)}px`, "important");
            edTxt.style.setProperty("font-size", `${domFontSize}px`, "important");
            edTxt.style.setProperty("padding", `0 ${domPadR}px 0 ${domPadL}px`, "important");
            edTxt.style.setProperty("margin", "0", "important");
            edTxt.style.setProperty("box-sizing", "border-box", "important");
            edTxt.style.setProperty("resize", "none", "important");
            edTxt.style.setProperty("overflow", "hidden", "important");
            edTxt.style.setProperty("border", "none", "important");
            edTxt.style.setProperty("border-radius", "6px", "important");
            edTxt.style.setProperty("outline", "none", "important");
            edTxt.style.setProperty("background", password ? "rgba(35, 25, 18, 0.96)" : "rgba(245, 235, 220, 0.96)", "important");
            edTxt.style.setProperty("box-shadow", "inset 0 1px 4px rgba(0, 0, 0, 0.35)", "important");
            edTxt.style.setProperty("color", password ? "#f39c12" : "#2c1810", "important");
            edTxt.style.setProperty("caret-color", password ? "#ffd700" : "#8b4513", "important");
            if (impl?._edTxt) {
                impl._edTxt.setAttribute("type", (password && !isPlain) ? "password" : "text");
            }
        };

        // 拦截并挂钩引擎内部 beforeDraw 帧循环，确保连续缩放或拖拽时实时贴合
        const impl = (editBox as unknown as { _impl?: { beforeDraw?: () => void } })._impl;
        if (impl && typeof impl.beforeDraw === "function") {
            const originalBeforeDraw = impl.beforeDraw.bind(impl);
            impl.beforeDraw = (): void => {
                originalBeforeDraw();
                syncWebDomPosition();
            };
        }

        // 5. 绑定生命周期与交互事件：输入时精准对齐，输入完成即时更新 Canvas 原生文本
        editBox.node.on(EditBox.EventType.EDITING_DID_BEGAN, () => {
            syncWebDomPosition();
            setTimeout(syncWebDomPosition, 30);
            setTimeout(syncWebDomPosition, 100);
        });

        editBox.node.on(EditBox.EventType.TEXT_CHANGED, (eb: EditBox) => {
            if (textLabel && textLabel.isValid) {
                textLabel.string = (password && !isPlain) ? "•".repeat(eb.string.length) : eb.string;
                textLabel.node.active = eb.string.length > 0;
            }
            if (placeholderLabel && placeholderLabel.isValid) {
                placeholderLabel.node.active = eb.string.length === 0;
            }
        });

        editBox.node.on(EditBox.EventType.EDITING_DID_ENDED, (eb: EditBox) => {
            if (textLabel && textLabel.isValid) {
                textLabel.string = (password && !isPlain) ? "•".repeat(eb.string.length) : eb.string;
                textLabel.node.active = eb.string.length > 0;
            }
            if (placeholderLabel && placeholderLabel.isValid) {
                placeholderLabel.node.active = eb.string.length === 0;
            }
        });

        return editBox;
    }

    /** 五级阶梯规费预估模型（对齐服务端规费标准：1.0% ~ 2.0%，并结合浮动彩池稀释与 1.05x 保底防亏机制）。 */
    private calculateBetPreview(amount: number, odds: number, dilutionFactor = 1.0): {
        feeRate: number;
        rawGrossReward: number;
        grossReward: number;
        estimatedFee: number;
        netReward: number;
        isDiluted: boolean;
        isFloorApplied: boolean;
    } {
        const safeAmount = Number.isFinite(amount) && amount > 0 ? amount : 0;
        const safeOdds = Number.isFinite(odds) && odds > 0 ? odds : 1.0;
        const safeDilution = Number.isFinite(dilutionFactor) && dilutionFactor > 0 ? dilutionFactor : 1.0;

        const rawGrossReward = Number((safeAmount * safeOdds).toFixed(2));
        const protectedGross = PariMutuelHelper.calculateFloorProtectedGross(safeAmount, rawGrossReward, safeDilution);
        const grossReward = protectedGross.grossReward;

        let feeRate = 0.010; // <= 10,000 为 1.0% (千分之10)
        if (grossReward > 500000) {
            feeRate = 0.020; // > 500,000 为 2.0% (百分之2)
        } else if (grossReward > 100000) {
            feeRate = 0.018; // 100,000 < grossReward <= 500,000 为 1.8%
        } else if (grossReward > 50000) {
            feeRate = 0.015; // 50,000 < grossReward <= 100,000 为 1.5%
        } else if (grossReward > 10000) {
            feeRate = 0.012; // 10,000 < grossReward <= 50,000 为 1.2%
        }

        const estimatedFee = Number((grossReward * feeRate).toFixed(2));
        const netReward = Number((grossReward - estimatedFee).toFixed(2));
        return {
            feeRate,
            rawGrossReward,
            grossReward,
            estimatedFee,
            netReward,
            isDiluted: protectedGross.isDiluted,
            isFloorApplied: protectedGross.isFloorApplied,
        };
    }

    /** 登录页面：美国西部酒馆风（大酒馆深木色金框、通缉令登记卡、像素级对齐标签与输入框）。 */
    private buildLogin(): void {
        const root = this.pageRoot!;

        // 1. 西部沉浸式深胡桃木边框公告板 (WOOD_DARK + GOLD_METALLIC 铆钉滚边，营造纯正西部大酒馆入口庄严感)
        const saloonBox = this.grandSaloonBox(root, 360, 640, 680, 1020, 18, WestColors.WOOD_DARK, WestColors.GOLD_METALLIC);

        // 2. 顶部黑板标题牌匾
        const titleBox = this.chalkboardBox(saloonBox, 0, 445, 630, 54, 6);
        this.text(titleBox, `🤠 ${I18n.t("login.title")}`, 0, 0, 24, WestColors.GOLD_BRIGHT);
        this.text(saloonBox, "WILD WEST TURF CLUB & SALOON · EST. 1885", 0, 400, 12, WestColors.TEXT_PARCHMENT);

        // 3. 通缉令样式的赏金牛仔签到表单面板 (比例协调，垂直紧凑无空虚荒漠)
        const formCard = this.wantedPosterBox(saloonBox, 0, 130, 620, 460, 12);
        this.text(formCard, "📜 边境牛仔签到署 (HUNTER SIGN-IN)", 0, 192, 20, WestColors.INK_DARK);
        this.text(formCard, "请输入你在怀俄明马帮名录上登记的凭据手印与金库密匙", 0, 164, 12, WestColors.INK_MUTED);

        const inputW = 500;
        const leftAlignX = -inputW / 2;

        this.text(formCard, "👤 牛仔登记账号 (Account):", leftAlignX, 114, 14, WestColors.INK_DARK, HorizontalTextAlignment.LEFT);
        const account = this.input(
            formCard,
            I18n.t("login.accountPlaceholder"),
            0,
            72,
            inputW,
            48,
            this.loginDraftAccount,
        );

        this.text(formCard, "🔑 金库通行密匙 (Password):", leftAlignX, 24, 14, WestColors.INK_DARK, HorizontalTextAlignment.LEFT);
        const password = this.input(
            formCard,
            I18n.t("login.passwordPlaceholder"),
            0,
            -18,
            inputW,
            48,
            "",
            true,
        );

        account.node.on(EditBox.EventType.EDITING_RETURN, () => {
            if (password.string.trim().length > 0) {
                void this.loginAsync(account.string, password.string);
            } else {
                password.setFocus();
            }
        });

        password.node.on(EditBox.EventType.EDITING_RETURN, () => {
            void this.loginAsync(account.string, password.string);
        });

        // 登录大按钮 (重型西部红领巾大按钮 BANDANA_RED)
        this.westernButton(
            formCard,
            `🐎 ${I18n.t("login.loginBtn")} (ENTER SALOON)`,
            0,
            -120,
            inputW,
            58,
            () => {
                void this.loginAsync(account.string, password.string);
            },
            true,
            19,
        );

        // 4. 切换去注册页面按钮 (边境牛仔蓝 DENIM_BLUE，圆角 8px)
        this.saloonButton(
            saloonBox,
            `⭐ 新骑手报到 · 签署牛仔契约入会领 1,000🪙`,
            0,
            -142,
            inputW,
            48,
            () => {
                this.message = "";
                this.loginDraftAccount = account.string.trim();
                void this.show("register");
            },
            true,
            14,
        );

        // 5. 提示或错误消息（保存引用以便原地更新，避免重建页面丢失输入焦点）
        const isError = this.message && !this.message.includes("成功") && !this.message.includes("中");
        this.authMessageLabel = this.text(
            saloonBox,
            this.message,
            0,
            -198,
            15,
            isError ? WestColors.BANDANA_RED : WestColors.DESERT_SAGE,
        );

        // 6. 边境特区合规与秩序告知卡
        const noticeCard = this.wantedPosterBox(saloonBox, 0, -285, 620, 74, 6);
        this.text(noticeCard, "⚖️ 怀俄明柯尔特治安署通告：严格执行公平竞马公约", 0, 14, 14, WestColors.INK_DARK);
        this.text(noticeCard, "全赛道由公证密码算法全天候链上监查 · 认证骑手享有全额财务保障", 0, -14, 12, WestColors.INK_MUTED);

        // 7. 西部格言
        this.text(
            saloonBox,
            "🌵 \"黄沙漫卷之处，唯有快枪与良驹永恒\" · 柯尔特特区 1885 🌵",
            0,
            -440,
            13,
            WestColors.TEXT_MUTED,
        );
    }

    /** 注册页面：美国西部酒馆风（包含账号、密码、确认密码三个输入框，像素级对齐与美化）。 */
    private buildRegister(): void {
        const root = this.pageRoot!;

        // 1. 西部沉浸式深胡桃木公告板 (WOOD_DARK + GOLD_METALLIC 铆钉滚边)
        const saloonBox = this.grandSaloonBox(root, 360, 640, 680, 1020, 18, WestColors.WOOD_DARK, WestColors.GOLD_METALLIC);

        // 2. 顶部黑板标题牌匾
        const titleBox = this.chalkboardBox(saloonBox, 0, 445, 630, 54, 6);
        this.text(titleBox, `⭐ ${I18n.t("register.title")} ⭐`, 0, 0, 24, WestColors.GOLD_BRIGHT);
        this.text(saloonBox, "ENLIST IN THE FRONTIER DERBY LEAGUE · EST. 1885", 0, 400, 12, WestColors.TEXT_PARCHMENT);

        // 3. 通缉令样式的赏金牛仔契约表单面板
        const formCard = this.wantedPosterBox(saloonBox, 0, 105, 620, 520, 12);
        this.text(formCard, "📜 签署边境通行契约 (NEW HUNTER DOSSIER)", 0, 222, 20, WestColors.INK_DARK);
        this.text(formCard, "登记马帮档案并领取初始 1,000 边境马会金币", 0, 194, 12, WestColors.INK_MUTED);

        const inputW = 500;
        const leftAlignX = -inputW / 2;

        this.text(formCard, "👤 登记牛仔账号 (Account):", leftAlignX, 154, 14, WestColors.INK_DARK, HorizontalTextAlignment.LEFT);
        const account = this.input(
            formCard,
            I18n.t("register.accountPlaceholder"),
            0,
            114,
            inputW,
            46,
            this.loginDraftAccount,
        );

        this.text(formCard, "🔑 设置金库密匙 (Password):", leftAlignX, 68, 14, WestColors.INK_DARK, HorizontalTextAlignment.LEFT);
        const password = this.input(
            formCard,
            I18n.t("register.passwordPlaceholder"),
            0,
            28,
            inputW,
            46,
            "",
            true,
        );

        this.text(formCard, "🔒 确认金库密匙 (Confirm Password):", leftAlignX, -18, 14, WestColors.INK_DARK, HorizontalTextAlignment.LEFT);
        const confirm = this.input(
            formCard,
            I18n.t("register.confirmPasswordPlaceholder"),
            0,
            -58,
            inputW,
            46,
            "",
            true,
        );

        account.node.on(EditBox.EventType.EDITING_RETURN, () => {
            password.setFocus();
        });

        password.node.on(EditBox.EventType.EDITING_RETURN, () => {
            confirm.setFocus();
        });

        confirm.node.on(EditBox.EventType.EDITING_RETURN, () => {
            void this.registerAsync(
                account.string,
                password.string,
                confirm.string,
            );
        });

        // 注册大按钮 (BANDANA_RED)
        this.westernButton(
            formCard,
            `⭐ ${I18n.t("register.submitBtn")} (ENLIST COWBOY)`,
            0,
            -152,
            inputW,
            58,
            () => {
                void this.registerAsync(
                    account.string,
                    password.string,
                    confirm.string,
                );
            },
            true,
            19,
        );

        // 4. 返回登录页面 (边境牛仔蓝 DENIM_BLUE)
        this.saloonButton(
            saloonBox,
            `🐎 已有马帮名册？返回大门签到 (BACK TO LOGIN)`,
            0,
            -185,
            inputW,
            48,
            () => {
                this.message = "";
                this.loginDraftAccount = account.string.trim();
                void this.show("login");
            },
            false,
            14,
        );

        // 5. 提示或错误消息（保存引用以便原地更新，避免重建页面丢失输入焦点）
        const isError = this.message && !this.message.includes("成功") && !this.message.includes("中");
        this.authMessageLabel = this.text(
            saloonBox,
            this.message,
            0,
            -238,
            15,
            isError ? WestColors.BANDANA_RED : WestColors.DESERT_SAGE,
        );

        // 6. 边境特区合规卡
        const noticeCard = this.wantedPosterBox(saloonBox, 0, -320, 620, 66, 6);
        this.text(noticeCard, "⚖️ 恪守边陲骑手誓词：诚信竞逐，严禁多重作弊小号", 0, 10, 13, WestColors.INK_DARK);
        this.text(noticeCard, "怀俄明州柯尔特特区马会注册认证 · 1885", 0, -14, 11, WestColors.INK_MUTED);

        // 7. 西部格言
        this.text(
            saloonBox,
            "🌵 \"一旦跨上马鞍，整个大西部都是你的领地\" · 1885 🌵",
            0,
            -440,
            13,
            WestColors.TEXT_MUTED,
        );
    }

    /** 原地更新登录/注册页提示消息，避免整页重建导致输入框焦点与草稿丢失。 */
    private updateAuthMessage(msg: string): void {
        this.message = msg;
        if (this.authMessageLabel && this.authMessageLabel.isValid) {
            this.authMessageLabel.string = msg;
            const isError = msg && !msg.includes("成功") && !msg.includes("中");
            this.authMessageLabel.color = isError ? WestColors.BANDANA_RED : WestColors.DESERT_SAGE;
        }
    }

    /** 登录并刷新玩家基础数据，成功后进入大厅主页面。 */
    private async loginAsync(account: string, password: string): Promise<void> {
        if (this.isSubmitting) {
            return;
        }

        account = (account ?? "").trim();
        // 注意：密码不做 trim。服务端按原始密码做哈希校验，trim 会导致含空格密码登录失败。
        this.loginDraftAccount = account;

        if (!account) {
            this.updateAuthMessage("请输入登录账号");
            return;
        }

        if (!password) {
            this.updateAuthMessage("请输入登录密码");
            return;
        }

        this.isSubmitting = true;
        this.message = "正在登录，请稍候...";
        await this.show("login");

        try {
            const response = await ApiClient.post<{
                accessToken: string;
                refreshToken: string;
            }>("/api/auth/login", {
                accountId: account,
                password,
                clientPlatform: "cocos",
                clientVersion: ClientConfig.clientVersion,
            });

            ApiClient.setTokens(
                response.data.accessToken,
                response.data.refreshToken,
            );
            this.message = I18n.t("login.loginSuccess");
            await this.syncTime();
            await this.loadPlayer();
            await this.show("lobby");
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("login.failed", "登录失败"));
            await this.show("login");
        } finally {
            this.isSubmitting = false;
        }
    }

    /** 注册完成后直接跳转到登录页面，保留账号，提示输入密码登录。 */
    private async registerAsync(
        account: string,
        password: string,
        confirmPassword: string,
    ): Promise<void> {
        if (this.isSubmitting) {
            return;
        }

        account = (account ?? "").trim();
        // 注意：密码不做 trim，与服务端 ValidateCredentialInput 的原始哈希校验保持一致。
        this.loginDraftAccount = account;

        if (!account || account.length < 8) {
            this.updateAuthMessage("账号长度不能小于8位");
            return;
        }

        if (!password || password.length < 8) {
            this.updateAuthMessage("密码长度不能小于8位");
            return;
        }

        if (password !== confirmPassword) {
            this.updateAuthMessage("两次输入的密码不一致");
            return;
        }

        this.isSubmitting = true;
        this.message = "正在注册，请稍候...";
        await this.show("register");

        try {
            await ApiClient.post("/api/auth/register", {
                accountId: account,
                password,
                confirmPassword,
                nickname: account,
            });
            // 注册完成之后直接跳转到登录页面输入账号和密码进行登录
            this.message = "注册成功！请在此输入密码登录";
            await this.show("login");
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("login.registerFailed", "注册失败"));
            await this.show("register");
        } finally {
            this.isSubmitting = false;
        }
    }

    /**
     * 重构后的大厅主界面（美国西部牛仔牧场与沙龙风格，严密网格无任何多余空隙）。
     * 包含顶部老橡木 HUD、吊牌快捷栏、中央主角展台与羊皮纸战绩卡片、进入赛场大马鞍按钮与常驻底部导航。
     */
    private async buildLobby(): Promise<void> {
        const root = this.pageRoot!;
        const player = this.player;

        // 1. 顶部老橡木双层 HUD (Y: 1228, h: 84)
        this.buildTopHud(root);

        // 2. 顶部酒馆吊牌快捷工具栏 (Y: 1150, h: 50, w: 160 each)
        this.saloonButton(
            root,
            `🐴 ${I18n.t("lobby.analysis", "马场名录")}`,
            102,
            1150,
            160,
            50,
            () => { void this.show("stable"); },
            false,
            17,
        );
        this.saloonButton(
            root,
            `💰 ${I18n.t("lobby.wallet", "金库账本")}`,
            274,
            1150,
            160,
            50,
            () => { void this.show("wallet"); },
            false,
            17,
        );
        this.saloonButton(
            root,
            `👥 ${I18n.t("lobby.invite", "悬赏邀友")}`,
            446,
            1150,
            160,
            50,
            () => { void this.showReferralModal(); },
            true,
            17,
        );
        this.saloonButton(
            root,
            `📢 ${I18n.t("lobby.notices", "边境公报")}`,
            618,
            1150,
            160,
            50,
            () => { void this.show("notices"); },
            false,
            17,
        );

        // 3. 中央实景木墙与巨大“今日头马”通缉令（Visual Focal Anchor: Giant Wanted Poster on Wood Wall）
        // 尺寸：696 x 560, 中心坐标 (360, 740)，自上而下严格垂直律动排版
        const isEn = I18n.getLocale() === "en-US";
        const wantedPoster = this.wantedPosterBox(root, 360, 740, 696, 560, 10);

        // (1) 通缉令复古炭黑抬头与高悬赏
        this.text(wantedPoster, isEn ? "★ WYOMING DERBY · WANTED POSTER ★" : "★ 怀俄明柯尔特特区 · 今日头马通缉令 ★", 0, 248, 17, WestColors.INK_DARK);
        this.text(wantedPoster, "WANTED · DEAD OR ALIVE", 0, 216, 25, WestColors.INK_DARK);
        this.text(wantedPoster, "★ REWARD: 10,000 GOLD COINS ★", 0, 184, 15, WestColors.SEAL_RED);

        // (2) 左侧：骑师/良驹高反差立绘展示框 (Y = 36, w = 210, h = 210)
        const equippedChar = this.player?.character;
        const defaultJockeyName = isEn
            ? (equippedChar?.nameEn ?? I18n.t("lobby.jockeyNameDefault"))
            : (equippedChar?.nameZh ?? I18n.t("lobby.jockeyNameDefault"));
        const charLevel = equippedChar?.level ?? player?.level ?? 1;
        const charExp = equippedChar?.exp ?? player?.exp ?? 0;
        const winRate = (Number(player?.winRate ?? 0) * 100).toFixed(1);

        const jockeyAvatarBox = this.woodBox(wantedPoster, -190, 36, 210, 210, 8, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.bindClick(jockeyAvatarBox, () => {
            void this.show("characters");
        });

        const charCutout = new Node("JockeyCutoutImg");
        charCutout.layer = wantedPoster.layer || Layers.Enum.UI_2D;
        jockeyAvatarBox.addChild(charCutout);
        charCutout.setPosition(0, 0, 0);
        charCutout.addComponent(UITransform).setContentSize(200, 200);
        applyWestTexture(charCutout, WEST_TEXTURES.JOCKEY_CHAR);

        const lockedTextNode = new Node("LockedText");
        lockedTextNode.layer = wantedPoster.layer || Layers.Enum.UI_2D;
        jockeyAvatarBox.addChild(lockedTextNode);
        const lockedLabel = lockedTextNode.addComponent(Label);
        lockedLabel.string = "🔒\n\nExpansion\nLocked";
        WestTypography.apply(lockedLabel, "body", {
            size: 24,
            color: WestColors.TEXT_MUTED,
        });
        lockedTextNode.active = false;

        const jockeyList = [
            {
                name: defaultJockeyName,
                subtitle: isEn ? "Master Jockey" : "柯尔特特级骑师",
                level: charLevel,
                winRate: winRate,
                tag: isEn ? "🏇 [ ACTIVE ]" : "🏇 [ 巡回出战 ACTIVE ]",
            },
            {
                name: isEn ? "Billy the Kid" : "比利小子 · 闪电鞭",
                subtitle: isEn ? "Lightning Gunner" : "怀俄明快枪巡回手",
                level: Math.max(1, charLevel - 1),
                winRate: "68.5",
                tag: isEn ? "🏇 [ READY ]" : "🏇 [ 候补就绪 READY ]",
            },
            {
                name: isEn ? "Annie Oakley" : "安妮·奥克利",
                subtitle: isEn ? "Wild Eagle Cowgirl" : "荒野神鹰女骑手",
                level: 1,
                winRate: "72.0",
                tag: isEn ? "🏇 [ STANDBY ]" : "🏇 [ 签约待命 STANDBY ]",
            },
        ];

        // 骑师左右切换木质小按钮（外置左右安全距，绝不压在立绘框边界上）
        this.button(
            wantedPoster,
            "◀",
            -316,
            36,
            28,
            50,
            () => {
                WestAudio.playParchmentFlip();
                this.activeJockeyIndex = (this.activeJockeyIndex - 1 + jockeyList.length) % jockeyList.length;
                updateJockeyDisplay();
            },
            WestColors.LEATHER_SADDLE,
            WestColors.GOLD_BRIGHT,
            18,
        );
        this.button(
            wantedPoster,
            "▶",
            -64,
            36,
            28,
            50,
            () => {
                WestAudio.playParchmentFlip();
                this.activeJockeyIndex = (this.activeJockeyIndex + 1) % jockeyList.length;
                updateJockeyDisplay();
            },
            WestColors.LEATHER_SADDLE,
            WestColors.GOLD_BRIGHT,
            18,
        );

        // 出战状态标签 (在立绘下方，严谨安全边距)
        const statusTagPill = this.box(wantedPoster, -190, -92, 210, 28, WestColors.DESERT_SAGE, 14);
        const statusLabel = this.text(statusTagPill, jockeyList[0].tag, 0, 0, 14, WestColors.GOLD_BRIGHT);

        // (3) 右侧：赏金档案与黄铜机械仪表盘 (点击打开更衣室档案，Y = 36, w = 360, h = 210)
        const rightDossier = this.box(wantedPoster, 145, 36, 360, 210, new Color(245, 235, 210, 0), 0);
        this.bindClick(rightDossier, () => {
            void this.show("characters");
        });
        const cardBoxTitle = this.text(rightDossier, `🤠 ${defaultJockeyName} · ${jockeyList[0].subtitle}`, 0, 80, isEn ? 17 : 19, WestColors.INK_DARK);
        const cardStatsLabel = this.text(
            rightDossier,
            isEn ? `Win Rate: ${winRate}%  |  Level: Lv.${charLevel}` : `生涯胜率: ${winRate}%  |  等级: Lv.${charLevel}`,
            0,
            54,
            14,
            WestColors.INK_MUTED,
        );

        // 黄铜速度表盘 (左) + 耐力子弹带 (右)
        const speedGaugeNode = new Node("LobbySpeedGauge");
        speedGaugeNode.layer = wantedPoster.layer || Layers.Enum.UI_2D;
        rightDossier.addChild(speedGaugeNode);
        speedGaugeNode.setPosition(-95, -10, 0);
        speedGaugeNode.addComponent(UITransform).setContentSize(76, 76);
        WestStyle.drawSpeedometerGauge(speedGaugeNode, 76, 0.88);
        this.text(rightDossier, isEn ? "Peak Burst 88%" : "极限爆发 88%", -95, -58, 11, WestColors.INK_DARK);

        const bulletBeltNode = new Node("LobbyBulletBelt");
        bulletBeltNode.layer = wantedPoster.layer || Layers.Enum.UI_2D;
        rightDossier.addChild(bulletBeltNode);
        bulletBeltNode.setPosition(95, 2, 0);
        bulletBeltNode.addComponent(UITransform).setContentSize(140, 30);
        WestStyle.drawBulletBelt(bulletBeltNode, 140, 30, 5, 6);
        this.text(rightDossier, isEn ? "Stamina 5/6" : "耐力弹药 5/6", 95, -24, 11, WestColors.INK_DARK);

        // 经验条
        const expCap = Math.max(100, charLevel * 50);
        const expPct = Math.min(1, charExp / expCap);
        const expBarW = 340;
        const expFillW = Math.max(8, expPct * expBarW);
        this.box(rightDossier, 0, -82, expBarW, 14, WestColors.PARCHMENT_BORDER, 7);
        this.box(rightDossier, -expBarW / 2 + expFillW / 2, -82, expFillW, 14, WestColors.DESERT_SAGE, 7);
        this.text(rightDossier, `EXP: ${(expPct * 100).toFixed(1)}% (${charExp}/${expCap})`, 0, -82, 11, WestColors.PARCHMENT_LIGHT);

        // 纯外观装扮提示（位于 Y = -135 独立净空带，彻底杜绝与出战标签碰撞覆盖）
        this.text(
            wantedPoster,
            isEn ? "★ Cosmetic Only · Affinity perks coming soon · Tap avatar for closet ★" : "★ 角色与鞍具当前为纯外观展示 · 后续版本开放羁绊微幅增益 · 点击头像进更衣室 ★",
            0,
            -135,
            11,
            WestColors.INK_MUTED,
        );

        // (4) 通缉令底部：5大独立竞技场入口 (独赢 WIN / 位置 PLACE / 连赢 QUINELLA / 二连单 EXACTA / 三重彩 TRIFECTA)
        const isRacing = this.round?.state === RaceState.Racing || this.round?.state === RaceState.Betting;
        const liveTag = isRacing ? (isEn ? " • LIVE" : " • 开战中") : "";

        // 标牌
        this.text(
            wantedPoster,
            isEn ? "★ 5 OFFICIAL DERBY TOURNAMENT ARENAS ★" : "★ 边境赛马会 · 5大顶级官方锦标竞技场 ★",
            0,
            -152,
            12,
            WestColors.INK_DARK,
        );

        // 第一行：3个核心场馆 (独赢、位置、连赢)
        const row1Modes: Array<{ mode: "WIN" | "PLACE" | "QUINELLA"; title: string; subtitle: string; x: number }> = [
            {
                mode: "WIN",
                title: `🏇 ${isEn ? "WIN" : "独赢场"}${liveTag}`,
                subtitle: isEn ? "1st Pick" : "单挑头马",
                x: -218,
            },
            {
                mode: "PLACE",
                title: `🛡️ ${isEn ? "PLACE" : "位置场"}${liveTag}`,
                subtitle: isEn ? "Top 2 Safe" : "双席保底",
                x: 0,
            },
            {
                mode: "QUINELLA",
                title: `🎰 ${isEn ? "QUINELLA" : "连赢场"}${liveTag}`,
                subtitle: isEn ? "Arcade +25%" : "双雄街机",
                x: 218,
            },
        ];

        row1Modes.forEach((item) => {
            this.westernButton(
                wantedPoster,
                item.title,
                item.x,
                -188,
                210,
                46,
                () => {
                    this.betMode = item.mode;
                    WestAudio.switchMode(this.getAudioMode());
                    this.shakeScreen(150, 3);
                    void this.show("race");
                },
                true,
                isEn ? 12 : 14,
            );
            this.text(wantedPoster, item.subtitle, item.x, -216, 10, WestColors.INK_MUTED);
        });

        // 第二行：2个进阶千倍大彩池场馆 (二连单精准场、三重彩巅峰场)
        const row2Modes: Array<{ mode: "EXACTA" | "TRIFECTA"; title: string; subtitle: string; x: number }> = [
            {
                mode: "EXACTA",
                title: `🎯 ${isEn ? "EXACTA (1st+2nd Exact)" : "二连单精准场 (严选冠亚)"}${liveTag}`,
                subtitle: isEn ? "5.0x - 500x Multiplier" : "精准包揽冠亚军 · 高倍绝杀",
                x: -164,
            },
            {
                mode: "TRIFECTA",
                title: `👑 ${isEn ? "TRIFECTA (Top 3 2000x)" : "三重彩巅峰场 (千倍彩池)"}${liveTag}`,
                subtitle: isEn ? "Up to 2000x Dream Pool" : "独揽前三甲次序 · 终极大奖池",
                x: 164,
            },
        ];

        row2Modes.forEach((item) => {
            this.westernButton(
                wantedPoster,
                item.title,
                item.x,
                -248,
                320,
                44,
                () => {
                    this.betMode = item.mode;
                    WestAudio.switchMode(this.getAudioMode());
                    this.shakeScreen(150, 3);
                    void this.show("race");
                },
                true,
                isEn ? 12 : 13,
            );
        });

        // (5) 纸张落款：刺目火漆印章
        const posterSeal = new Node("PosterWaxSeal");
        posterSeal.layer = wantedPoster.layer || Layers.Enum.UI_2D;
        wantedPoster.addChild(posterSeal);
        posterSeal.setPosition(295, -135, 0);
        posterSeal.addComponent(UITransform).setContentSize(46, 46);
        WestStyle.drawWaxSealStamp(posterSeal, 23);
        WestMotion.playWaxStamp(posterSeal);

        const updateJockeyDisplay = (): void => {
            const j = jockeyList[this.activeJockeyIndex % jockeyList.length];
            charCutout.active = true;
            lockedTextNode.active = false;
            statusLabel.string = j.tag;
            cardBoxTitle.string = `🤠 ${j.name} · ${j.subtitle}`;
            cardStatsLabel.string = isEn
                ? `Win Rate: ${j.winRate}%  |  Level: Lv.${j.level}`
                : `生涯胜率: ${j.winRate}%  |  等级: Lv.${j.level}`;
        };

        // 4. 下方非对称实景墙面 (左侧倾斜羊皮纸赛程表 + 右侧马票夹与工具栏)
        // 增高至 290px，居中 Y = 295，彻底消除底部 124px 荒原空隙
        // (1) 左侧：羊皮纸赛程表 (Derby Schedule Parchment, w = 328, h = 290, center X = 185, Y = 295)
        const scheduleBox = this.wantedPosterBox(root, 185, 295, 328, 290, 8);
        this.text(scheduleBox, isEn ? "📌 Today's Derby" : "📌 今日赛事速报", 0, 112, 17, WestColors.INK_DARK);

        const weatherText = this.getWeatherText(this.round?.weather);
        const trackText = this.getTrackText(this.round?.trackType);
        const roundTitleText = this.round
            ? (isEn ? `Round #${this.round.roundNo}` : `第 ${this.round.roundNo} 期`)
            : (isEn ? "No Schedule" : "暂无赛程");
        this.text(scheduleBox, `🏆 ${roundTitleText}`, 0, 78, 19, WestColors.SEAL_RED);
        this.text(scheduleBox, `${isEn ? "🏜️ Weather: " : "🏜️ 天气: "}${weatherText}`, 0, 44, 14, WestColors.INK_DARK);
        this.text(scheduleBox, `${isEn ? "🚩 Track: " : "🚩 赛道: "}${trackText}`, 0, 12, 14, WestColors.INK_DARK);

        // 状态与倒计时粉笔小黑板
        const schedChalk = this.chalkboardBox(scheduleBox, 0, -34, 285, 38, 6);
        const roundStatusLabel = this.text(schedChalk, this.round ? `${this.stateText(this.round.state)}` : (isEn ? "Pending" : "等待排期"), 0, 0, 14, WestColors.CHALK_YELLOW);
        this.updateLobbyRoundTicker(roundStatusLabel);

        this.text(scheduleBox, isEn ? "⚡ 6 Steeds · Low Rake · Auto-Notarized ⚡" : "⚡ 6驹竞逐 · 4级低抽成 · 自动公证 ⚡", 0, -95, 11, WestColors.INK_MUTED);

        // (2) 右侧：马票夹与边境军备公报 (Ticket Clip & Saloon Toolbar, w = 328, h = 290, center X = 535, Y = 295)
        const clipBox = this.grandSaloonBox(root, 535, 295, 328, 290, 10, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.text(clipBox, isEn ? "🎫 TICKET CLIP" : "🎫 边境马票夹 · TICKET CLIP", 0, 112, 16, WestColors.GOLD_BRIGHT);

        this.saloonButton(
            clipBox,
            isEn ? "📋 Bounty Tasks" : "📋 今日悬赏 (TASKS)",
            0,
            56,
            285,
            44,
            () => { void this.show("tasks"); },
            false,
            15,
        );

        this.saloonButton(
            clipBox,
            isEn ? "📜 Bet Archives" : "📜 历史注单 (BETS)",
            0,
            2,
            285,
            44,
            () => { void this.show("bets"); },
            false,
            15,
        );

        this.saloonButton(
            clipBox,
            isEn ? "🔄 Sync Derby" : "🔄 刷新局势 (SYNC)",
            0,
            -52,
            285,
            44,
            () => { void this.refreshLobbyAsync(); },
            true,
            15,
        );

        const networkStatus = ApiClient.getAccessToken()
            ? (isEn ? "Online" : "正常在线")
            : (isEn ? "Offline" : "离线未登");
        this.text(clipBox, isEn ? `📡 Net: ${networkStatus} | Wyoming Synced` : `📡 网络: ${networkStatus} | 怀俄明授时`, 0, -110, 12, WestColors.TEXT_MUTED);

        // 6. 常驻底部 5-Tab 导航
        this.buildBottomNav(root, "none");

        // 7. 检查是否有未读强制公告，有则弹出全屏阻断式弹窗提示
        if (ApiClient.getAccessToken()) {
            await this.checkForcedNoticeModalAsync(root);
        }
    }

    /** 大厅当前轮次动态倒计时跳动器。 */
    private updateLobbyRoundTicker(label: Label): void {
        this.clearRaceTimer();
        const tick = (): void => {
            if (!this.round || this.page !== "lobby" || !label || !label.isValid) {
                this.clearRaceTimer();
                return;
            }

            const now = Date.now() + this.serverOffsetMs;
            const target = this.getStateTargetMs(this.round);
            const remaining = target === null ? null : Math.ceil((target - now) / 1000);
            const countdownStr = remaining === null
                ? ""
                : ` (${Math.max(0, remaining)}s)`;

            label.string = `${I18n.t("lobby.round")}${this.round.roundNo} · ${this.stateText(this.round.state)}${countdownStr}`;

            // 倒计时归零时执行 HTTP 轮询兜底（防长连接丢包导致停留在 0s）
            if (remaining !== null && remaining <= 0 && (now - this.lastCountdownPollMs > 2500)) {
                this.lastCountdownPollMs = now;
                void this.refreshRound().then(() => {
                    if (this.page === "lobby" && label && label.isValid) {
                        const nextTarget = this.round ? this.getStateTargetMs(this.round) : null;
                        const nextRem = nextTarget === null ? null : Math.ceil((nextTarget - (Date.now() + this.serverOffsetMs)) / 1000);
                        label.string = `${I18n.t("lobby.round")}${this.round?.roundNo ?? ""} · ${this.round ? this.stateText(this.round.state) : ""}${nextRem !== null ? ` (${Math.max(0, nextRem)}s)` : ""}`;
                    }
                });
            }

            this.raceTickTimer = setTimeout(tick, 500);
        };
        tick();
    }

    /** 回到大厅时同时刷新玩家和轮次。 */
    private async refreshLobbyAsync(): Promise<void> {
        try {
            await this.syncTime();
            await this.loadPlayer();
            await this.refreshRound();
            this.message = I18n.t("lobby.refreshed", "数据已刷新");
            this.showToast(this.message, WestColors.GOLD_BRIGHT);
            await this.show("lobby");
        } catch (error) {
            // 刷新失败时保留当前页面并直接 Toast 提示，避免整页重建让错误提示瞬间消失。
            this.message = this.errorMessage(error, I18n.t("lobby.refreshFailed", "刷新失败"));
            this.showToast(this.message, WestColors.BANDANA_RED);
        }
    }

    /**
     * 赛场与下注页面（对标 1.png 原型 1002 & 1003）。
     * 引入近8期赛果历史走势栏、倍数快捷键 (x1, x2, x5, x10)、六马赔率卡片与动态实时预估。
     */
    private async buildRace(): Promise<void> {
        const root = this.pageRoot!;
        await this.refreshRound();
        await this.loadRecentHistory();

        // 1. 顶部 HUD 与常驻底部导航（提前挂载提升瞬时点击响应）
        this.buildTopHud(root);
        this.buildBottomNav(root, "battle");

        if (MaintenanceHelper.isInNoticeWindow()) {
            MaintenanceHelper.renderNoticeBanner(root, 1210, () => {
                const check = MaintenanceHelper.checkActionBlocked();
                this.message = check.message;
                this.updateRaceMessage(this.message);
            });
        }

        if (!this.round) {
            this.text(root, I18n.t("race.noRound"), 360, 800, 28);
            this.button(root, I18n.t("common.backLobby"), 360, 250, 280, 70, () => {
                void this.show("lobby");
            });
            return;
        }

        // 读取当前玩家在本轮已有的投注记录（多注单模式）
        let myRoundOrders: BetOrderItemDto[] = [];
        let currentBetTotalAmount = 0;
        try {
            const myBetsRes = await ApiClient.get<{
                horseNo?: number | null;
                totalAmount?: number;
                orders?: BetOrderItemDto[];
            }>(`/api/race/${this.round.id}/my-bets`);
            if (myBetsRes.data?.orders) {
                myRoundOrders = myBetsRes.data.orders;
                this.myRoundOrders = myRoundOrders;
                currentBetTotalAmount = myBetsRes.data.totalAmount ?? 0;
                if (this.selectedHorse <= 0 && myBetsRes.data.horseNo) {
                    this.selectedHorse = myBetsRes.data.horseNo;
                }
            }
        } catch {
            // 忽略未登录或网络临时抖动
        }

        // 读取赛前亮相圈贴士与专家推荐
        try {
            const paddockRes = await ApiClient.getPaddockInfo();
            if (paddockRes.data) {
                this.paddockInfo = paddockRes.data;
            }
        } catch {
            // 静默降级
        }

        // 2. 顶部综合酒馆黑板走势与轮次状态牌（老橡木双层 + 黄铜边框）
        const saloonHeaderBar = new Node("SaloonHeaderBar");
        saloonHeaderBar.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(saloonHeaderBar);
        saloonHeaderBar.setPosition(360, 1150);
        saloonHeaderBar.addComponent(UITransform).setContentSize(696, 52);
        WestStyle.drawGrandSaloonPanel(saloonHeaderBar, 696, 52, 10, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 🏠 顶部快捷返回主城木质吊牌
        this.saloonButton(
            saloonHeaderBar,
            "🏠 主城",
            -295,
            0,
            96,
            42,
            () => { void this.show("lobby"); },
            true,
            14,
        );

        const weatherText = this.getWeatherText(this.round.weather);
        const trackText = this.getTrackText(this.round.trackType);
        const statePrefix = this.round.state === RaceState.Betting ? "🔥 " + I18n.t("race.roundCountdown") + " " : "";
        const stateLabel = this.text(
            saloonHeaderBar,
            `${statePrefix}${this.stateText(this.round.state)} | 🏜️ ${weatherText}`,
            -145,
            7,
            13,
            WestColors.GOLD_BRIGHT,
        );
        this.text(
            saloonHeaderBar,
            `🚩 ${trackText} · 第${this.round.roundNo.slice(-4)}期`,
            -145,
            -11,
            11,
            WestColors.TEXT_MUTED,
        );
        const countdownLabel = this.text(saloonHeaderBar, "", -22, 7, 15, WestColors.BANDANA_RED);

        // 走势徽章：右半侧 + 📊 走势路单抽屉入口
        this.text(saloonHeaderBar, `📜 走势:`, 68, 0, 13, WestColors.GOLD_BRIGHT);
        const chipColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];
        const chipsX = [108, 135, 162, 189];
        this.recentWinners.slice(0, 4).forEach((winnerNo, idx) => {
            const chip = this.box(saloonHeaderBar, chipsX[idx], 0, 22, 22, chipColors[(winnerNo - 1) % 6], 11);
            const g = chip.getComponent(Graphics);
            if (g) {
                g.strokeColor = WestColors.BRASS_FRAME;
                g.lineWidth = 1.2;
                g.circle(0, 0, 11);
                g.stroke();
            }
            this.text(chip, `${winnerNo}`, 0, 0, 12, new Color(255, 255, 255, 255));
            this.bindClick(chip, () => { void this.buildTrendBeadPlateModal(root); });
        });

        // 📊 走势路单按钮
        this.saloonButton(
            saloonHeaderBar,
            "📊 路单",
            265,
            0,
            74,
            38,
            () => { void this.buildTrendBeadPlateModal(root); },
            true,
            13,
        );

        if (this.round.state === RaceState.Cancelled) {
            const cancelBox = this.woodBox(root, 360, 1102, 696, 32, 6, WestColors.BANDANA_RED, WestColors.GOLD_METALLIC);
            this.text(cancelBox, `⚠️ ${I18n.t("race.cancelledNotice")}`, 0, 0, 14, WestColors.PARCHMENT_LIGHT);
        } else {
            FairnessHelper.renderCommitmentBadge(
                root,
                195,
                1102,
                this.round.resultSeedCommitment ?? "",
                this.round.resultSeed,
                () => {
                    void FairnessHelper.showFairnessModal(
                        root,
                        this.round?.resultSeedCommitment ?? "",
                        this.round?.resultSeed,
                        this.round?.roundNo,
                    );
                },
            );

            const poolAmount = this.round.payoutPoolAmount ?? 100000;
            const dilutionFactor = this.round.dilutionFactor ?? 1.0;
            PariMutuelHelper.renderPoolBadge(
                root,
                525,
                1102,
                poolAmount,
                dilutionFactor,
                () => {
                    PariMutuelHelper.showRulesModal(root, poolAmount, dilutionFactor);
                },
            );

            // 📰 老牛仔赛前晨报速览 (Morning Chronicle & Paddock Walk)
            const morningBox = this.woodBox(root, 195, 1102, 140, 26, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            this.text(morningBox, "📰 赛前晨报速览", 0, 0, 12, WestColors.GOLD_BRIGHT);
            this.bindClick(morningBox, () => {
                this.showMorningChronicleModal(root);
            });

            // 💎 超级累积大奖池 (Mega Jackpot) 徽章
            const jackpotBox = this.woodBox(root, 360, 1102, 140, 26, 6, WestColors.WOOD_DARK, WestColors.GOLD_METALLIC);
            const dropText = this.round.jackpotDropped
                ? `🎉 巨奖掉落! $${this.round.jackpotDropAmount}`
                : `💎 累积巨奖池`;
            this.text(jackpotBox, dropText, 0, 0, 12, WestColors.GOLD_BRIGHT);
            this.bindClick(jackpotBox, () => {
                this.showJackpotModal(root);
            });
        }

        // 3. 赛马泥道竞技场（六马动态泥道与策马冲刺区）
        this.buildTrack(root);

        // 比赛中微操互动：看台呐喊与强力挥鞭轻交互 (PRD 2.2 / 3.3 节局内沉浸互动)
        const inPlayCheerBar = new Node("InPlayInteractiveBar");
        inPlayCheerBar.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(inPlayCheerBar);
        inPlayCheerBar.setPosition(360, 710);
        inPlayCheerBar.addComponent(UITransform).setContentSize(600, 48);

        this.saloonButton(
            inPlayCheerBar,
            "📣 看台呐喊助威!",
            -160,
            0,
            180,
            42,
            () => {
                WestAudio.playYeeHaw("COMMON");
                WestAudio.speakCowboy("spurs", this.getAudioMode());
                this.shakeScreen(150, 4);
                this.updateRaceMessage("📣 你在看台奋力呐喊：好马快冲！！全场欢腾！");
            },
            true,
            14,
        );

        this.saloonButton(
            inPlayCheerBar,
            "⚡ 扬鞭奋蹄加速!",
            160,
            0,
            180,
            42,
            () => {
                WestAudio.playBullwhip("COMMON");
                WestAudio.playHorseNeigh("COMMON");
                this.shakeScreen(180, 5);
                this.updateRaceMessage("⚡ 策马挥鞭！赛马昂首奋蹄，马蹄飞溅沙石！");
            },
            true,
            14,
        );
        inPlayCheerBar.active = this.round.state === RaceState.Racing;

        // 🔥 比赛进行中 (15s) 绝地追投加倍浮动悬浮按钮
        const ddNode = new Node("InPlayDoubleDownBtn");
        ddNode.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(ddNode);
        ddNode.setPosition(360, 710);
        ddNode.addComponent(UITransform).setContentSize(260, 50);
        WestStyle.drawGrandSaloonPanel(ddNode, 260, 50, 12, WestColors.BANDANA_RED, WestColors.GOLD_METALLIC);
        const isEnRace = I18n.getLocale() === "en-US";
        this.text(ddNode, I18n.t("race.doubleDownBtn", "🔥 追投加倍 (限时 3s)"), 0, 0, isEnRace ? 13 : 15, WestColors.GOLD_BRIGHT);
        this.bindClick(ddNode, () => {
            void this.onDoubleDownClicked();
        });
        ddNode.active = false;
        this.doubleDownBtnNode = ddNode;

        // 4. 西部沙龙下注总控台（Grand Saloon Betting Parlor）
        const deskBox = new Node("SaloonBettingDesk");
        deskBox.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(deskBox);
        deskBox.setPosition(360, 445);
        deskBox.addComponent(UITransform).setContentSize(696, 650);
        WestStyle.drawGrandSaloonPanel(deskBox, 696, 650, 14, WestColors.WOOD_DARK, WestColors.WOOD_FRAME);

        // (0) 玩法模式切换标签栏：【独赢 WIN】、【位置 PLACE】、【连赢 QUINELLA】、【二连单 EXACTA】、【三重彩 TRIFECTA】+【📜 玩法规则】
        const modeTabBar = this.box(deskBox, 0, 300, 670, 38, WestColors.WOOD_DARK, 6);
        const tabsData: Array<{ mode: "WIN" | "PLACE" | "QUINELLA" | "EXACTA" | "TRIFECTA"; label: string; x: number }> = [
            { mode: "WIN", label: I18n.t("race.modeWinTab", "🏇 独赢"), x: -265 },
            { mode: "PLACE", label: I18n.t("race.modePlaceTab", "🛡️ 位置"), x: -165 },
            { mode: "QUINELLA", label: I18n.t("race.modeQuinellaTab", "🎰 连赢"), x: -65 },
            { mode: "EXACTA", label: I18n.t("race.modeExactaTab", "🎯 二连单"), x: 35 },
            { mode: "TRIFECTA", label: I18n.t("race.modeTrifectaTab", "👑 三重彩"), x: 135 },
        ];

        const tabNodes: Array<{ mode: "WIN" | "PLACE" | "QUINELLA" | "EXACTA" | "TRIFECTA"; node: Node; labelNode: Label }> = [];
        tabsData.forEach((t) => {
            const tNode = new Node(`ModeTab_${t.mode}`);
            tNode.layer = deskBox.layer || Layers.Enum.UI_2D;
            modeTabBar.addChild(tNode);
            tNode.setPosition(t.x, 0);
            tNode.addComponent(UITransform).setContentSize(96, 32);
            const lbl = this.text(tNode, t.label, 0, 0, isEnRace ? 11 : 13, this.betMode === t.mode ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT);
            tabNodes.push({ mode: t.mode, node: tNode, labelNode: lbl });

            this.bindClick(tNode, () => {
                if (this.betMode !== t.mode) {
                    this.betMode = t.mode;
                    let shouldSyncInput = false;
                    if (this.betMode !== "WIN" && this.amount < 5) {
                        this.amount = 5;
                        shouldSyncInput = true;
                    }
                    WestAudio.switchMode(this.getAudioMode());
                    WestAudio.playLeatherPress("COMMON");
                    this.reinitHorsesForCurrentMode();
                    updateRaceUI(shouldSyncInput);
                }
            });
        });

        // 规则说明快捷常驻按钮
        const rulesBtnNode = new Node("ModeRulesBtn");
        rulesBtnNode.layer = deskBox.layer || Layers.Enum.UI_2D;
        modeTabBar.addChild(rulesBtnNode);
        rulesBtnNode.setPosition(248, 0);
        rulesBtnNode.addComponent(UITransform).setContentSize(116, 32);
        WestStyle.drawGrandSaloonPanel(rulesBtnNode, 116, 32, 6, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
        this.text(rulesBtnNode, isEnRace ? "📜 RULES" : "📜 玩法规则", 0, 0, isEnRace ? 11 : 12, WestColors.GOLD_BRIGHT);
        this.bindClick(rulesBtnNode, () => {
            WestAudio.playParchmentFlip();
            this.showModeRulesModal(this.betMode);
        });

        // (1) 倍数快捷选择栏（x1, x2, x5, x10, MAX，皮鞍古铜排扣）
        const multBar = this.box(deskBox, 0, 255, 670, 36, WestColors.WOOD_DARK, 8);
        this.text(multBar, I18n.t("race.multLabel", "⚡ 倍数"), -245, 0, isEnRace ? 13 : 15, WestColors.TEXT_PARCHMENT);
        const mults = [1, 2, 5, 10];
        const multX = [-140, -50, 40, 130];
        const multNodes: Array<{ node: Node; m: number }> = [];

        mults.forEach((m, idx) => {
            const isCurrent = this.betMultiplier === m;
            const btnNode = this.button(
                multBar,
                `x${m}`,
                multX[idx],
                0,
                76,
                28,
                () => {
                    WestAudio.playSpurJingle();
                    this.betMultiplier = m;
                    this.amount = this.selectedChip * m;
                    updateRaceUI();
                },
                isCurrent ? WestColors.BANDANA_RED : WestColors.LEATHER_SADDLE,
                isCurrent ? WestColors.GOLD_BRIGHT : WestColors.PARCHMENT_LIGHT,
                15,
            );
            multNodes.push({ node: btnNode, m });
        });

        // MAX 倍率按钮（警长红底金印）
        this.button(
            multBar,
            "MAX",
            215,
            0,
            76,
            28,
            () => {
                WestAudio.playSpurJingle();
                const bal = this.player?.balance ?? 100;
                this.betMultiplier = Math.max(1, Math.floor(bal / this.selectedChip));
                this.amount = Math.max(this.selectedChip, Math.floor(bal));
                updateRaceUI();
            },
            WestColors.BANDANA_RED,
            WestColors.GOLD_BRIGHT,
            14,
        );

        // (2A) 单马独赢模式容器 (WIN)
        const winContainer = new Node("WinContainer");
        winContainer.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(winContainer);
        winContainer.setPosition(0, 0);

        const gridX = [-162, 162];
        const gridY = [182, 118, 54];
        const horseCards: Array<{
            cardNode: Node;
            horseNo: number;
            titleLabel: Label;
            subLabel: Label;
            horseName: string;
            odds: number;
            favorTag: string;
        }> = [];
        // 独赢规则入口与名驹三视图图鉴入口
        this.saloonButton(winContainer, isEnRace ? "📜 Win Rules" : "📜 独赢规则说明", 235, 222, 120, 26, () => this.showModeRulesModal("WIN"), false, 12);
        this.saloonButton(winContainer, isEnRace ? "🏛️ Horse Gallery" : "🏛️ 12名驹三视图图鉴", 75, 222, 160, 26, () => HorseGalleryModal.show(this.selectedHorse || 1, this.node), false, 12);

        this.getModeHorses("WIN").forEach((horse, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const isSelected = this.selectedHorse === horse.horseNo;
            const isBet = myRoundOrders.some((o) => (!o.playType || o.playType === "WIN") && o.horseNo === horse.horseNo);
            const isEn = I18n.getLocale() === "en-US";
            const horseName = isEn && horse.horseNameEnSnapshot
                ? horse.horseNameEnSnapshot
                : (horse.horseNameZhSnapshot ?? "");
            const prefix = isBet ? (isEn ? "[BET] " : "[已投] ") : isSelected ? "[✓] " : "";

            const rankSymbols = ["", "①", "②", "③", "④", "⑤", "⑥"];
            const ranksStr = (horse.recentRanks && horse.recentRanks.length > 0)
                ? horse.recentRanks.slice(0, 4).map((r: number) => rankSymbols[r] || `${r}`).join(" ")
                : I18n.t("race.rookie", "新晋良驹");

            const isFavored = Boolean(
                (this.round?.trackType && horse.preferredTrack && horse.preferredTrack.toUpperCase() === this.round.trackType.toUpperCase()) ||
                (this.round?.weather && horse.preferredWeather && horse.preferredWeather.toUpperCase() === this.round.weather.toUpperCase())
            );
            const favorTag = isFavored ? " ✨" : "";

            const cardNode = new Node(`HorseCard${horse.horseNo}`);
            cardNode.layer = winContainer.layer || Layers.Enum.UI_2D;
            winContainer.addChild(cardNode);
            cardNode.setPosition(gridX[col], gridY[row]);
            cardNode.addComponent(UITransform).setContentSize(324, 56);

            WestStyle.drawBetTicket(cardNode, 324, 56, isSelected, horse.horseNo);

            // 专属马匹真实赛马彩衣图案徽记 (Jockey Racing Silk)
            const silkNode = new Node(`Silk${horse.horseNo}`);
            silkNode.layer = cardNode.layer || Layers.Enum.UI_2D;
            cardNode.addChild(silkNode);
            silkNode.setPosition(-130, 0, 0);
            silkNode.addComponent(UITransform).setContentSize(28, 28);
            WestStyle.drawHorseSilkPattern(silkNode, horse.horseNo, 28, 28);

            // 点击三视图与油画展示小按钮（阻止冒泡，避免误触发下注选中）
            const galleryIconBtn = this.box(cardNode, 140, 0, 28, 28, WestColors.WOOD_DARK, 6);
            this.text(galleryIconBtn, "🎨", 0, 0, 13);
            const gBtn = galleryIconBtn.addComponent(Button);
            gBtn.node.on(Button.EventType.CLICK, (event: { propagationStopped?: boolean }) => {
                if (event) {
                    event.propagationStopped = true;
                }
                HorseGalleryModal.show(horse.horseNo, this.node);
            }, this);

            const seed = Number(this.round?.id ?? 0);
            const archetype = HorseController.computeArchetype(seed, horse.horseNo, false);
            const styleInfo = HorseController.getArchetypeName(archetype, isEn);
            const hNumPrefix = isEn ? `No.${horse.horseNo} ` : `${horse.horseNo}号 `;
            const displayHorseName = isEn ? (horseName.length > 8 ? horseName.slice(0, 8) + "…" : horseName) : horseName.slice(0, 4);
            const titleText = `${prefix}${hNumPrefix}${displayHorseName} · x${Number(horse.odds).toFixed(2)}${favorTag}`;
            const subText = `${styleInfo.icon}${styleInfo.tag} | ${ranksStr}`;
            const titleLabel = this.text(cardNode, titleText, 14, 11, isEn ? 13 : 15, isSelected ? WestColors.INK_DARK : WestColors.TEXT_PARCHMENT);
            const subLabel = this.text(cardNode, subText, 14, -12, 12, isSelected ? WestColors.INK_MUTED : WestColors.TEXT_MUTED);

            horseCards.push({
                cardNode,
                horseNo: horse.horseNo,
                titleLabel,
                subLabel,
                horseName,
                odds: Number(horse.odds),
                favorTag,
            });

            this.bindClick(cardNode, () => {
                if (this.round?.state !== RaceState.Betting) {
                    return;
                }
                WestAudio.playChipClink();
                if (this.selectedHorse === horse.horseNo) {
                    this.selectedHorse = 0;
                    this.message = I18n.t("race.deselected");
                } else {
                    this.selectedHorse = horse.horseNo;
                    this.message = `${I18n.t("race.selected")}${horse.horseNo}${I18n.t("race.horse")}`;
                }
                updateRaceUI();
            });
        });

        // (2B) 街机连赢模式容器 (QUINELLA 15 组阶梯矩阵，对标 1.png 与街机老版黄金赛马)
        const quinellaContainer = new Node("QuinellaContainer");
        quinellaContainer.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(quinellaContainer);
        quinellaContainer.setPosition(0, 0);

        this.saloonButton(quinellaContainer, isEnRace ? "📜 Quinella Rules" : "📜 连赢玩法规则", 248, 232, 120, 24, () => this.showModeRulesModal("QUINELLA"), false, 11);

        const horseColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];

        const getQuinellaOdds = (h1: number, h2: number): number => {
            const minH = Math.min(h1, h2);
            const maxH = Math.max(h1, h2);
            const combo = `${minH}-${maxH}`;
            const found = this.round?.quinellaOdds?.find((q) => q.combination === combo);
            if (found) {
                return Number(found.odds);
            }
            const horseA = this.round?.horses.find((h) => h.horseNo === minH);
            const horseB = this.round?.horses.find((h) => h.horseNo === maxH);
            const oddA = horseA ? Number(horseA.odds) : 3.0;
            const oddB = horseB ? Number(horseB.odds) : 4.0;
            return Math.max(2.0, Math.round(oddA * oddB * 0.7 * 10) / 10);
        };

        // 街机阶梯矩阵布局：列标 (6, 5, 4, 3, 2)，行标 (1, 2, 3, 4, 5)
        const colHorseList = [6, 5, 4, 3, 2];
        const rowHorseList = [1, 2, 3, 4, 5];
        const colXs = [-204, -91, 22, 135, 248];
        const rowYs = [170, 135, 100, 65, 30];

        // 绘制列头指示标签 (Top Headers: 6, 5, 4, 3, 2)
        colHorseList.forEach((cHorse, j) => {
            const colHeader = this.box(quinellaContainer, colXs[j], 205, 108, 20, horseColors[cHorse - 1], 4);
            this.text(colHeader, `马号 [${cHorse}]`, 0, 0, 12, new Color(255, 255, 255, 255));
        });

        // 绘制行头指示标签 (Left Headers: 1, 2, 3, 4, 5)
        rowHorseList.forEach((rHorse, i) => {
            const rowHeader = this.box(quinellaContainer, -282, rowYs[i], 36, 30, horseColors[rHorse - 1], 4);
            this.text(rowHeader, `${rHorse}`, 0, 0, 14, new Color(255, 255, 255, 255));
        });

        // 绘制 15 组连赢矩阵单元格
        const quinellaCells: Array<{
            node: Node;
            combo: string;
            h1: number;
            h2: number;
            odds: number;
            comboLabel: Label;
            oddsLabel: Label;
        }> = [];

        rowHorseList.forEach((rHorse, i) => {
            const cellCount = 6 - rHorse;
            for (let j = 0; j < cellCount; j++) {
                const cHorse = colHorseList[j];
                const minH = Math.min(rHorse, cHorse);
                const maxH = Math.max(rHorse, cHorse);
                const combo = `${minH}-${maxH}`;
                const odds = getQuinellaOdds(minH, maxH);

                const cellNode = new Node(`QuinellaCell_${combo}`);
                cellNode.layer = quinellaContainer.layer || Layers.Enum.UI_2D;
                quinellaContainer.addChild(cellNode);
                cellNode.setPosition(colXs[j], rowYs[i]);
                cellNode.addComponent(UITransform).setContentSize(108, 31);

                const isSelected = this.selectedQuinellaCombo === combo;
                const isWinner = this.round?.quinellaCombination === combo;
                WestStyle.drawQuinellaCell(cellNode, 108, 31, isSelected, isWinner, minH, maxH);

                const comboLabel = this.text(cellNode, combo, 0, 5, 13, isSelected ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT);
                const oddsLabel = this.text(cellNode, `x${odds.toFixed(1)}`, 0, -8, 12, isSelected ? WestColors.TEXT_CHALK : WestColors.GOLD_METALLIC);

                quinellaCells.push({
                    node: cellNode,
                    combo,
                    h1: minH,
                    h2: maxH,
                    odds,
                    comboLabel,
                    oddsLabel,
                });

                this.bindClick(cellNode, () => {
                    if (this.round?.state !== RaceState.Betting) {
                        return;
                    }
                    WestAudio.playChipClink();
                    if (this.selectedQuinellaCombo === combo) {
                        this.selectedQuinellaCombo = null;
                        this.message = I18n.t("race.deselected");
                    } else {
                        this.selectedQuinellaCombo = combo;
                        this.message = `已选连赢二连碰组合: [${combo}] · 赔率 x${odds.toFixed(1)}`;
                    }
                    updateRaceUI();
                });
            }
        });

        // (2A2) 阶梯风险位置模式容器 (PLACE 选1匹马入前二，低风险保底盘)
        const placeContainer = new Node("PlaceContainer");
        placeContainer.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(placeContainer);
        placeContainer.setPosition(0, 0);

        this.saloonButton(placeContainer, isEnRace ? "📜 Place Rules" : "📜 位置规则说明", 235, 222, 120, 26, () => this.showModeRulesModal("PLACE"), false, 12);

        const placeCards: Array<{
            cardNode: Node;
            horseNo: number;
            titleLabel: Label;
            subLabel: Label;
            horseName: string;
            placeOdds: number;
        }> = [];

        this.getModeHorses("PLACE").forEach((horse, index) => {
            const col = index % 2;
            const row = Math.floor(index / 2);
            const isSelected = this.selectedHorse === horse.horseNo;
            const isBet = myRoundOrders.some((o) => o.playType === "PLACE" && o.horseNo === horse.horseNo);
            const isEn = I18n.getLocale() === "en-US";
            const horseName = isEn && horse.horseNameEnSnapshot
                ? horse.horseNameEnSnapshot
                : (horse.horseNameZhSnapshot ?? "");
            const prefix = isBet ? (isEn ? "[BET] " : "[已投] ") : isSelected ? "[✓] " : "";
            const placeOdds = Math.max(1.15, Math.min(4.50, Math.round(Number(horse.odds) * 0.40 * 100) / 100));

            const cardNode = new Node(`PlaceHorseCard${horse.horseNo}`);
            cardNode.layer = placeContainer.layer || Layers.Enum.UI_2D;
            placeContainer.addChild(cardNode);
            cardNode.setPosition(gridX[col], gridY[row]);
            cardNode.addComponent(UITransform).setContentSize(324, 56);

            WestStyle.drawBetTicket(cardNode, 324, 56, isSelected, horse.horseNo);

            const silkNode = new Node(`PlaceSilk${horse.horseNo}`);
            silkNode.layer = cardNode.layer || Layers.Enum.UI_2D;
            cardNode.addChild(silkNode);
            silkNode.setPosition(-130, 0, 0);
            silkNode.addComponent(UITransform).setContentSize(28, 28);
            WestStyle.drawHorseSilkPattern(silkNode, horse.horseNo, 28, 28);

            const seed = Number(this.round?.id ?? 0);
            const archetype = HorseController.computeArchetype(seed, horse.horseNo, false);
            const styleInfo = HorseController.getArchetypeName(archetype, isEn);
            const hNumPrefix = isEn ? `No.${horse.horseNo} ` : `${horse.horseNo}号 `;
            const displayHorseName = isEn ? (horseName.length > 8 ? horseName.slice(0, 8) + "…" : horseName) : horseName.slice(0, 4);
            const titleText = `${prefix}${hNumPrefix}${displayHorseName} · x${placeOdds.toFixed(2)}`;
            const subText = `${styleInfo.icon}${styleInfo.tag} | ${isEn ? "Top 2 Finish" : "位置(前二即中)"}`;
            const titleLabel = this.text(cardNode, titleText, 14, 11, isEn ? 13 : 15, isSelected ? WestColors.INK_DARK : WestColors.TEXT_PARCHMENT);
            const subLabel = this.text(cardNode, subText, 14, -12, 12, isSelected ? WestColors.INK_MUTED : WestColors.TEXT_MUTED);

            placeCards.push({
                cardNode,
                horseNo: horse.horseNo,
                titleLabel,
                subLabel,
                horseName,
                placeOdds,
            });

            this.bindClick(cardNode, () => {
                if (this.round?.state !== RaceState.Betting) return;
                WestAudio.playChipClink();
                if (this.selectedHorse === horse.horseNo) {
                    this.selectedHorse = 0;
                    this.message = I18n.t("race.deselected");
                } else {
                    this.selectedHorse = horse.horseNo;
                    this.message = isEn
                        ? `Selected Place: Horse #${horse.horseNo} · Odds x${placeOdds.toFixed(2)}`
                        : `已选位置保底盘：${horse.horseNo}号马 · 赔率 x${placeOdds.toFixed(2)}`;
                }
                updateRaceUI();
            });
        });

        // (2C) 二连单准确单模式容器 (EXACTA 严格按次序命中第1、第2名)
        const exactaContainer = new Node("ExactaContainer");
        exactaContainer.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(exactaContainer);
        exactaContainer.setPosition(0, 0);

        this.saloonButton(exactaContainer, isEnRace ? "📜 Exacta Rules" : "📜 二连单规则", 235, 235, 120, 26, () => this.showModeRulesModal("EXACTA"), false, 12);

        this.text(exactaContainer, I18n.t("race.exacta1st", "🥇 选定第 1 名 (冠军)："), isEnRace ? -235 : -220, 195, isEnRace ? 12 : 14, WestColors.GOLD_BRIGHT);
        const exacta1stNodes: Array<{ node: Node; horseNo: number; label: Label }> = [];
        const exactaBtnXs = [-120, -50, 20, 90, 160, 230];
        const exactaHorses = this.getModeHorses("EXACTA");
        const exactaHorseNos = exactaHorses.length === 6 ? exactaHorses.map((h) => h.horseNo) : [1, 2, 3, 4, 5, 6];

        exactaHorseNos.forEach((hNo, idx) => {
            const btn = this.woodBox(exactaContainer, exactaBtnXs[idx], 195, 52, 32, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            const lbl = this.text(btn, isEnRace ? `No.${hNo}` : `${hNo}号`, 0, 0, isEnRace ? 12 : 13, WestColors.TEXT_PARCHMENT);
            exacta1stNodes.push({ node: btn, horseNo: hNo, label: lbl });
            this.bindClick(btn, () => {
                if (this.round?.state !== RaceState.Betting) return;
                WestAudio.playChipClink();
                if (this.exactaFirstHorse === hNo) {
                    this.exactaFirstHorse = 0;
                } else {
                    this.exactaFirstHorse = hNo;
                    if (this.exactaSecondHorse === hNo) this.exactaSecondHorse = 0;
                }
                updateRaceUI();
            });
        });

        this.text(exactaContainer, I18n.t("race.exacta2nd", "🥈 选定第 2 名 (亚军)："), isEnRace ? -235 : -220, 135, isEnRace ? 12 : 14, WestColors.PARCHMENT_LIGHT);
        const exacta2ndNodes: Array<{ node: Node; horseNo: number; label: Label }> = [];
        exactaHorseNos.forEach((hNo, idx) => {
            const btn = this.woodBox(exactaContainer, exactaBtnXs[idx], 135, 52, 32, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            const lbl = this.text(btn, isEnRace ? `No.${hNo}` : `${hNo}号`, 0, 0, isEnRace ? 12 : 13, WestColors.TEXT_PARCHMENT);
            exacta2ndNodes.push({ node: btn, horseNo: hNo, label: lbl });
            this.bindClick(btn, () => {
                if (this.round?.state !== RaceState.Betting) return;
                WestAudio.playChipClink();
                if (this.exactaSecondHorse === hNo) {
                    this.exactaSecondHorse = 0;
                } else {
                    this.exactaSecondHorse = hNo;
                    if (this.exactaFirstHorse === hNo) this.exactaFirstHorse = 0;
                }
                updateRaceUI();
            });
        });

        const exactaOddsBadge = this.box(exactaContainer, 0, 65, 630, 36, WestColors.WOOD_DARK, 6);
        const exactaOddsLabel = this.text(exactaOddsBadge, isEnRace ? "🎯 Pick 1st and 2nd place horses in exact order" : "🎯 请分别指定冠军(1st)与亚军(2nd)马号", 0, 0, isEnRace ? 12 : 14, WestColors.GOLD_BRIGHT);

        // (2D) 三重彩模式容器 (TRIFECTA 严格按次序命中第1、第2、第3名，千倍梦想大奖)
        const trifectaContainer = new Node("TrifectaContainer");
        trifectaContainer.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(trifectaContainer);
        trifectaContainer.setPosition(0, 0);

        this.saloonButton(trifectaContainer, isEnRace ? "📜 Trifecta Rules" : "📜 三重彩规则", 235, 240, 120, 26, () => this.showModeRulesModal("TRIFECTA"), false, 12);

        this.text(trifectaContainer, I18n.t("race.trifecta1st", "🥇 选定第 1 名 (冠军)："), isEnRace ? -235 : -220, 205, isEnRace ? 12 : 13, WestColors.GOLD_BRIGHT);
        const trifecta1stNodes: Array<{ node: Node; horseNo: number; label: Label }> = [];
        const trifectaBtnXs = [-120, -50, 20, 90, 160, 230];
        const trifectaHorses = this.getModeHorses("TRIFECTA");
        const trifectaHorseNos = trifectaHorses.length === 6 ? trifectaHorses.map((h) => h.horseNo) : [1, 2, 3, 4, 5, 6];

        trifectaHorseNos.forEach((hNo, idx) => {
            const btn = this.woodBox(trifectaContainer, trifectaBtnXs[idx], 205, 52, 28, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            const lbl = this.text(btn, isEnRace ? `No.${hNo}` : `${hNo}号`, 0, 0, isEnRace ? 11 : 12, WestColors.TEXT_PARCHMENT);
            trifecta1stNodes.push({ node: btn, horseNo: hNo, label: lbl });
            this.bindClick(btn, () => {
                if (this.round?.state !== RaceState.Betting) return;
                WestAudio.playChipClink();
                if (this.trifectaFirstHorse === hNo) {
                    this.trifectaFirstHorse = 0;
                } else {
                    this.trifectaFirstHorse = hNo;
                    if (this.trifectaSecondHorse === hNo) this.trifectaSecondHorse = 0;
                    if (this.trifectaThirdHorse === hNo) this.trifectaThirdHorse = 0;
                }
                updateRaceUI();
            });
        });

        this.text(trifectaContainer, I18n.t("race.trifecta2nd", "🥈 选定第 2 名 (亚军)："), isEnRace ? -235 : -220, 155, isEnRace ? 12 : 13, WestColors.PARCHMENT_LIGHT);
        const trifecta2ndNodes: Array<{ node: Node; horseNo: number; label: Label }> = [];
        trifectaHorseNos.forEach((hNo, idx) => {
            const btn = this.woodBox(trifectaContainer, trifectaBtnXs[idx], 155, 52, 28, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            const lbl = this.text(btn, isEnRace ? `No.${hNo}` : `${hNo}号`, 0, 0, isEnRace ? 11 : 12, WestColors.TEXT_PARCHMENT);
            trifecta2ndNodes.push({ node: btn, horseNo: hNo, label: lbl });
            this.bindClick(btn, () => {
                if (this.round?.state !== RaceState.Betting) return;
                WestAudio.playChipClink();
                if (this.trifectaSecondHorse === hNo) {
                    this.trifectaSecondHorse = 0;
                } else {
                    this.trifectaSecondHorse = hNo;
                    if (this.trifectaFirstHorse === hNo) this.trifectaFirstHorse = 0;
                    if (this.trifectaThirdHorse === hNo) this.trifectaThirdHorse = 0;
                }
                updateRaceUI();
            });
        });

        this.text(trifectaContainer, I18n.t("race.trifecta3rd", "🥉 选定第 3 名 (季军)："), isEnRace ? -235 : -220, 105, isEnRace ? 12 : 13, WestColors.BRASS_FRAME);
        const trifecta3rdNodes: Array<{ node: Node; horseNo: number; label: Label }> = [];
        trifectaHorseNos.forEach((hNo, idx) => {
            const btn = this.woodBox(trifectaContainer, trifectaBtnXs[idx], 105, 52, 28, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            const lbl = this.text(btn, isEnRace ? `No.${hNo}` : `${hNo}号`, 0, 0, isEnRace ? 11 : 12, WestColors.TEXT_PARCHMENT);
            trifecta3rdNodes.push({ node: btn, horseNo: hNo, label: lbl });
            this.bindClick(btn, () => {
                if (this.round?.state !== RaceState.Betting) return;
                WestAudio.playChipClink();
                if (this.trifectaThirdHorse === hNo) {
                    this.trifectaThirdHorse = 0;
                } else {
                    this.trifectaThirdHorse = hNo;
                    if (this.trifectaFirstHorse === hNo) this.trifectaFirstHorse = 0;
                    if (this.trifectaSecondHorse === hNo) this.trifectaSecondHorse = 0;
                }
                updateRaceUI();
            });
        });

        const trifectaOddsBadge = this.box(trifectaContainer, 0, 52, 630, 32, WestColors.WOOD_DARK, 6);
        const trifectaOddsLabel = this.text(trifectaOddsBadge, isEnRace ? "👑 Pick distinct 1st, 2nd & 3rd horses · Win up to 2000x!" : "👑 请依次选定冠(1st)、亚(2nd)、季(3rd)军组合 · 冲击千倍梦想彩池！", 0, 0, isEnRace ? 12 : 13, WestColors.GOLD_BRIGHT);

        // (3) 实时毛奖/阶梯手续费/净奖预估牛皮纸账单
        const previewBox = new Node("PreviewReceipt");
        previewBox.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(previewBox);
        previewBox.setPosition(0, -10);
        previewBox.addComponent(UITransform).setContentSize(670, 38);
        WestStyle.drawWantedPosterCard(previewBox, 670, 38, 6);
        const previewLabel = this.text(previewBox, "", 0, 0, 13, WestColors.INK_DARK);

        // (4) 拟物化德州筹码盘 + 金额输入框 + 确认撕票押注大按钮
        const chipValues = [10, 50, 100, 500, 1000];
        const chipX = [-275, -205, -135, -65, 5];
        const chipNodes: Array<{ node: Node; val: number; label: Label }> = [];
        chipValues.forEach((val, idx) => {
            const isChipSelected = this.selectedChip === val;
            const chipNode = new Node(`Chip${val}`);
            chipNode.layer = deskBox.layer || Layers.Enum.UI_2D;
            deskBox.addChild(chipNode);
            chipNode.setPosition(chipX[idx], -55);
            chipNode.addComponent(UITransform).setContentSize(64, 46);

            WestStyle.drawPokerChip(chipNode, 64, 46, val, isChipSelected);
            const chipLabel = this.text(chipNode, `${val}`, 0, 0, 14, isChipSelected ? WestColors.GOLD_BRIGHT : WestColors.PARCHMENT_LIGHT);
            chipNodes.push({ node: chipNode, val, label: chipLabel });

            this.bindClick(chipNode, () => {
                WestAudio.playChipClink();
                WestMotion.playChipFloat(chipNode);
                this.selectedChip = val;
                this.amount = val * this.betMultiplier;
                updateRaceUI();
            });
        });

        const amountInput = this.input(
            deskBox,
            I18n.t("race.amountPlaceholder"),
            90,
            -55,
            96,
            46,
            String(this.amount),
        );

        amountInput.node.on(EditBox.EventType.TEXT_CHANGED, (eb: EditBox) => {
            const val = Number(eb.string.trim());
            if (Number.isFinite(val) && val > 0) {
                this.amount = val;
                if (this.amount !== this.selectedChip * this.betMultiplier) {
                    this.betMultiplier = 1;
                }
                updateRaceUI(false);
            }
        });

        amountInput.node.on(EditBox.EventType.EDITING_DID_ENDED, () => {
            const val = Number(amountInput.string.trim());
            if (Number.isFinite(val) && val > 0) {
                this.amount = val;
                if (this.amount !== this.selectedChip * this.betMultiplier) {
                    this.betMultiplier = 1;
                }
                updateRaceUI();
            }
        });

        const confirmBtn = new Node("ConfirmBetBtn");
        confirmBtn.layer = deskBox.layer || Layers.Enum.UI_2D;
        deskBox.addChild(confirmBtn);
        confirmBtn.setPosition(245, -55);
        confirmBtn.addComponent(UITransform).setContentSize(185, 46);
        WestStyle.drawActionBanner(confirmBtn, 185, 46, true);

        const confirmBtnText = this.text(confirmBtn, "", 0, 0, 16, WestColors.GOLD_BRIGHT);

        // 实时刷新下注按钮状态：比赛阶段从下注切换为开跑/结算时，无需整页重建即可显示“已封单”。
        let lastBettingOpen = this.round?.state === RaceState.Betting;
        const refreshBetButton = (): void => {
            const bettingOpen = this.round?.state === RaceState.Betting;
            if (bettingOpen !== lastBettingOpen) {
                lastBettingOpen = bettingOpen;
                WestStyle.drawActionBanner(confirmBtn, 185, 46, bettingOpen);
            }
            confirmBtnText.string = this.isSubmitting
                ? I18n.t("common.submitting")
                : !bettingOpen
                ? `🔒 ${I18n.t("race.betClosedBtn")}`
                : (isEnRace ? `🐎 ${I18n.t("race.confirmBetBtn", "CONFIRM BET")}` : `🐎 确认撕票押注`);
            confirmBtnText.color = bettingOpen ? WestColors.GOLD_BRIGHT : WestColors.TEXT_MUTED;
            confirmBtnText.fontSize = isEnRace ? (bettingOpen ? 13 : 12) : (bettingOpen ? 16 : 14);
        };
        this.refreshRaceBetButton = refreshBetButton;
        refreshBetButton();

        this.bindClick(confirmBtn, () => {
            if (this.round?.state !== RaceState.Betting) {
                this.message = I18n.t("race.betClosedNotice");
                this.updateRaceMessage(this.message);
                return;
            }
            WestAudio.playRevolverCock();
            WestAudio.playStampThud();
            this.shakeScreen(180, 4);
            const amount = Number(amountInput.string.trim());
            void this.placeBetAsync(amount);
        });

        // (4B) 赛前亮相圈与骑师贴士横幅
        if (this.paddockInfo && this.paddockInfo.recommendations && this.paddockInfo.recommendations.length > 0) {
            const topRec = this.paddockInfo.recommendations[0];
            const paddockBar = this.box(deskBox, 0, -96, 670, 26, WestColors.WOOD_DARK, 6);
            const stars = "★".repeat(topRec.starRating);
            this.text(
                paddockBar,
                `💡 骑师推介: ${topRec.horseNo}号马 (${stars}) · 查看全览`,
                0,
                0,
                12,
                WestColors.GOLD_BRIGHT,
            );
            this.bindClick(paddockBar, () => {
                this.showPaddockModal(root);
            });
        }

        // (4C) 全服超级彩金雨资格提示 (PRD 3.2: 当轮下注满50币享受彩金雨瓜分特权)
        if (currentBetTotalAmount >= 50) {
            const rainBar = this.box(deskBox, 0, -125, 670, 24, WestColors.WOOD_DARK, 6);
            const g = rainBar.getComponent(Graphics);
            if (g) {
                g.strokeColor = WestColors.GOLD_METALLIC;
                g.lineWidth = 1.2;
                g.stroke();
            }
            this.text(rainBar, `💎 当轮已投 $${currentBetTotalAmount} · 已锁定全服彩金雨特权！`, 0, 0, 12, WestColors.GOLD_BRIGHT);
        } else if (currentBetTotalAmount > 0) {
            const rainBar = this.box(deskBox, 0, -125, 670, 24, WestColors.WOOD_DARK, 6);
            const needed = (50 - currentBetTotalAmount).toFixed(1);
            this.text(rainBar, `🌧️ 当前已投 $${currentBetTotalAmount} · 差 $${needed} 激活彩金雨`, 0, 0, 12, WestColors.PARCHMENT_LIGHT);
        }

        // (4D) 【下注后消遣小玩法入口】(PRD 2.1 节酒馆消遣轻微游戏：幸运轮盘 / 牛仔摇骰比大小)
        this.saloonButton(
            deskBox,
            "🎰 酒馆消遣 (幸运转盘 / 拼骰比大小) 🎲",
            0,
            -156,
            460,
            32,
            () => {
                this.showSaloonMinigamesModal(root);
            },
            true,
            13,
        );

        // (5) 下注选定提示与系统消息
        const selectionHintLabel = this.text(deskBox, "", 0, -186, 14, WestColors.GOLD_BRIGHT);
        const messageLabel = this.text(deskBox, this.message, 0, -206, 13, WestColors.PARCHMENT_LIGHT);
        this.raceMessageLabel = messageLabel;

        // (6) 边境快捷下注工具栏（木质吊牌，主城、我的注单、赛马名录、刷新局势）
        this.saloonButton(
            deskBox,
            `🏠 主城`,
            -246,
            -246,
            156,
            42,
            () => {
                void this.show("lobby");
            },
            true,
            15,
        );
        this.saloonButton(
            deskBox,
            `📜 我的注单`,
            -82,
            -246,
            156,
            42,
            () => {
                void this.show("bets");
            },
            false,
            15,
        );
        this.saloonButton(
            deskBox,
            `🐴 赛马名录`,
            82,
            -246,
            156,
            42,
            () => {
                void this.show("stable");
            },
            false,
            15,
        );
        this.saloonButton(
            deskBox,
            `🔄 刷新局势`,
            246,
            -246,
            156,
            42,
            () => {
                void this.show("race");
            },
            false,
            15,
        );

        // (7) 底部西部格言条（完美补齐最底边隙）
        this.text(
            deskBox,
            "🌵 柯尔特边境特区赛马会 · 独赢与连赢双模式 · 实时结算 🌵",
            0,
            -290,
            12,
            WestColors.TEXT_MUTED,
        );

        // (4E) 官方倒计时说明（严格等待全员倒计时，严禁提前开赛）
        const readyNoticeBar = this.box(deskBox, 0, -126, 480, 26, WestColors.WOOD_DARK, 6);
        this.text(readyNoticeBar, "⏳ 官方下注倒计时进行中 · 所有玩家统一步调开闸", 0, 0, 12, WestColors.TEXT_MUTED);

        const updateRaceUI = (syncInput = true): void => {
            // 0. 模式切换按钮样式更新与容器切换
            winContainer.active = this.betMode === "WIN";
            placeContainer.active = this.betMode === "PLACE";
            quinellaContainer.active = this.betMode === "QUINELLA";
            exactaContainer.active = this.betMode === "EXACTA";
            trifectaContainer.active = this.betMode === "TRIFECTA";

            // 绘制 5 个 Tab 按钮
            tabNodes.forEach((t) => {
                const isTabCurrent = this.betMode === t.mode;
                const g = t.node.getComponent(Graphics) || t.node.addComponent(Graphics);
                g.clear();
                g.fillColor = isTabCurrent ? WestColors.BANDANA_RED : WestColors.WOOD_DARK;
                g.roundRect(-63, -17, 126, 34, 6);
                g.fill();
                g.strokeColor = isTabCurrent ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME;
                g.lineWidth = isTabCurrent ? 2.0 : 1.0;
                g.roundRect(-78, -17, 156, 34, 6);
                g.stroke();
                t.labelNode.color = isTabCurrent ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            });

            // 1. 倍数排扣高亮
            multNodes.forEach(({ node, m }) => {
                const isCurrent = this.betMultiplier === m;
                const g = node.getComponent(Graphics);
                if (g) {
                    g.clear();
                    g.fillColor = isCurrent ? WestColors.BANDANA_RED : WestColors.LEATHER_SADDLE;
                    g.roundRect(-38, -14, 76, 28, 6);
                    g.fill();
                    g.strokeColor = isCurrent ? WestColors.GOLD_BRIGHT : WestColors.PARCHMENT_LIGHT;
                    g.lineWidth = 1.2;
                    g.roundRect(-38, -14, 76, 28, 6);
                    g.stroke();
                }
                const lbl = node.getComponentInChildren(Label);
                if (lbl) {
                    lbl.color = isCurrent ? WestColors.GOLD_BRIGHT : WestColors.PARCHMENT_LIGHT;
                }
            });

            // 2A. 六马卡片票根重绘 (WIN)
            horseCards.forEach((item) => {
                const isSelected = this.selectedHorse === item.horseNo;
                const isBet = myRoundOrders.some((o) => (!o.playType || o.playType === "WIN") && o.horseNo === item.horseNo);
                const prefix = isBet ? "[已投] " : isSelected ? "[✓] " : "";
                WestStyle.drawBetTicket(item.cardNode, 324, 56, isSelected, item.horseNo);
                item.titleLabel.string = `${prefix}${item.horseNo}号 ${item.horseName.slice(0, 4)} · x${item.odds.toFixed(2)}${item.favorTag}`;
                item.titleLabel.color = isSelected ? WestColors.INK_DARK : WestColors.TEXT_PARCHMENT;
                item.subLabel.color = isSelected ? WestColors.INK_MUTED : WestColors.TEXT_MUTED;
            });

            // 2A2. 位置保底六马卡片票根重绘 (PLACE)
            placeCards.forEach((item) => {
                const isSelected = this.selectedHorse === item.horseNo;
                const isBet = myRoundOrders.some((o) => o.playType === "PLACE" && o.horseNo === item.horseNo);
                const prefix = isBet ? "[已投] " : isSelected ? "[✓] " : "";
                WestStyle.drawBetTicket(item.cardNode, 324, 56, isSelected, item.horseNo);
                item.titleLabel.string = `${prefix}${item.horseNo}号 ${item.horseName.slice(0, 4)} · x${item.placeOdds.toFixed(2)}`;
                item.titleLabel.color = isSelected ? WestColors.INK_DARK : WestColors.TEXT_PARCHMENT;
                item.subLabel.color = isSelected ? WestColors.INK_MUTED : WestColors.TEXT_MUTED;
            });

            // 2B. 连赢 15 单元格重绘 (QUINELLA)
            quinellaCells.forEach((cell) => {
                const isSelected = this.selectedQuinellaCombo === cell.combo;
                const isWinner = this.round?.quinellaCombination === cell.combo;
                WestStyle.drawQuinellaCell(cell.node, 108, 31, isSelected, isWinner, cell.h1, cell.h2);
                cell.oddsLabel.string = isWinner ? `🏆 x${cell.odds.toFixed(1)}` : `x${cell.odds.toFixed(1)}`;
                cell.comboLabel.color = (isSelected || isWinner) ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
                cell.oddsLabel.color = isWinner ? WestColors.GOLD_BRIGHT : (isSelected ? WestColors.TEXT_CHALK : WestColors.GOLD_METALLIC);
            });

            // 2C. 二连单按钮重绘 (EXACTA - 突出高亮被选中的马匹号码)
            exacta1stNodes.forEach(({ node, horseNo, label }) => {
                const isSel = this.exactaFirstHorse === horseNo;
                const g = node.getComponent(Graphics);
                if (g) {
                    g.clear();
                    g.fillColor = isSel ? new Color(220, 35, 35, 255) : WestColors.WOOD_DARK;
                    g.roundRect(-26, -16, 52, 32, 6);
                    g.fill();
                    g.strokeColor = isSel ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME;
                    g.lineWidth = isSel ? 2.5 : 1.0;
                    g.roundRect(-26, -16, 52, 32, 6);
                    g.stroke();
                }
                label.string = isSel ? (isEnRace ? `🥇#${horseNo}` : `🥇${horseNo}号`) : (isEnRace ? `#${horseNo}` : `${horseNo}号`);
                label.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            });
            exacta2ndNodes.forEach(({ node, horseNo, label }) => {
                const isSel = this.exactaSecondHorse === horseNo;
                const g = node.getComponent(Graphics);
                if (g) {
                    g.clear();
                    g.fillColor = isSel ? new Color(35, 115, 230, 255) : WestColors.WOOD_DARK;
                    g.roundRect(-26, -16, 52, 32, 6);
                    g.fill();
                    g.strokeColor = isSel ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME;
                    g.lineWidth = isSel ? 2.5 : 1.0;
                    g.roundRect(-26, -16, 52, 32, 6);
                    g.stroke();
                }
                label.string = isSel ? (isEnRace ? `🥈#${horseNo}` : `🥈${horseNo}号`) : (isEnRace ? `#${horseNo}` : `${horseNo}号`);
                label.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            });

            let exactaCalcOdds = 0;
            if (this.exactaFirstHorse > 0 && this.exactaSecondHorse > 0 && this.exactaFirstHorse !== this.exactaSecondHorse) {
                const horseA = this.round?.horses.find((h) => h.horseNo === this.exactaFirstHorse);
                const horseB = this.round?.horses.find((h) => h.horseNo === this.exactaSecondHorse);
                const oA = horseA ? Number(horseA.odds) : 3.0;
                const oB = horseB ? Number(horseB.odds) : 4.0;
                exactaCalcOdds = Math.max(3.0, Math.min(500.0, Math.round(oA * oB * 0.65 * 10) / 10));
                exactaOddsLabel.string = isEnRace
                    ? `🎯 EXACTA: [1st:#${this.exactaFirstHorse}] ➔ [2nd:#${this.exactaSecondHorse}] | Odds: x${exactaCalcOdds.toFixed(1)}`
                    : `🎯 已选二连单: [1st:${this.exactaFirstHorse}号] ➔ [2nd:${this.exactaSecondHorse}号] | 赔率: x${exactaCalcOdds.toFixed(1)}`;
            } else {
                exactaOddsLabel.string = isEnRace
                    ? "🎯 Pick distinct horses for 1st and 2nd place above"
                    : "🎯 请在上方分别选定不同的冠军(1st)与亚军(2nd)马号";
            }

            // 重绘 TRIFECTA 三列按钮 - 突出高亮冠、亚、季军入选号码
            trifecta1stNodes.forEach(({ node, horseNo, label }) => {
                const isSel = this.trifectaFirstHorse === horseNo;
                const g = node.getComponent(Graphics);
                if (g) {
                    g.clear();
                    g.fillColor = isSel ? new Color(220, 35, 35, 255) : WestColors.WOOD_DARK;
                    g.roundRect(-26, -14, 52, 28, 6);
                    g.fill();
                    g.strokeColor = isSel ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME;
                    g.lineWidth = isSel ? 2.5 : 1.0;
                    g.roundRect(-26, -14, 52, 28, 6);
                    g.stroke();
                }
                label.string = isSel ? (isEnRace ? `🥇#${horseNo}` : `🥇${horseNo}号`) : (isEnRace ? `#${horseNo}` : `${horseNo}号`);
                label.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            });
            trifecta2ndNodes.forEach(({ node, horseNo, label }) => {
                const isSel = this.trifectaSecondHorse === horseNo;
                const g = node.getComponent(Graphics);
                if (g) {
                    g.clear();
                    g.fillColor = isSel ? new Color(35, 115, 230, 255) : WestColors.WOOD_DARK;
                    g.roundRect(-26, -14, 52, 28, 6);
                    g.fill();
                    g.strokeColor = isSel ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME;
                    g.lineWidth = isSel ? 2.5 : 1.0;
                    g.roundRect(-26, -14, 52, 28, 6);
                    g.stroke();
                }
                label.string = isSel ? (isEnRace ? `🥈#${horseNo}` : `🥈${horseNo}号`) : (isEnRace ? `#${horseNo}` : `${horseNo}号`);
                label.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            });
            trifecta3rdNodes.forEach(({ node, horseNo, label }) => {
                const isSel = this.trifectaThirdHorse === horseNo;
                const g = node.getComponent(Graphics);
                if (g) {
                    g.clear();
                    g.fillColor = isSel ? new Color(210, 130, 40, 255) : WestColors.WOOD_DARK;
                    g.roundRect(-26, -14, 52, 28, 6);
                    g.fill();
                    g.strokeColor = isSel ? WestColors.GOLD_BRIGHT : WestColors.BRASS_FRAME;
                    g.lineWidth = isSel ? 2.5 : 1.0;
                    g.roundRect(-26, -14, 52, 28, 6);
                    g.stroke();
                }
                label.string = isSel ? (isEnRace ? `🥉#${horseNo}` : `🥉${horseNo}号`) : (isEnRace ? `#${horseNo}` : `${horseNo}号`);
                label.color = isSel ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            });

            let trifectaCalcOdds = 0;
            if (
                this.trifectaFirstHorse > 0 &&
                this.trifectaSecondHorse > 0 &&
                this.trifectaThirdHorse > 0 &&
                this.trifectaFirstHorse !== this.trifectaSecondHorse &&
                this.trifectaFirstHorse !== this.trifectaThirdHorse &&
                this.trifectaSecondHorse !== this.trifectaThirdHorse
            ) {
                const horseA = this.round?.horses.find((h) => h.horseNo === this.trifectaFirstHorse);
                const horseB = this.round?.horses.find((h) => h.horseNo === this.trifectaSecondHorse);
                const horseC = this.round?.horses.find((h) => h.horseNo === this.trifectaThirdHorse);
                const oA = horseA ? Number(horseA.odds) : 3.0;
                const oB = horseB ? Number(horseB.odds) : 4.0;
                const oC = horseC ? Number(horseC.odds) : 5.0;
                trifectaCalcOdds = Math.max(10.0, Math.min(2000.0, Math.round(oA * oB * oC * 0.85 * 10) / 10));
                trifectaOddsLabel.string = `👑 三重彩: [1st:${this.trifectaFirstHorse}] ➔ [2nd:${this.trifectaSecondHorse}] ➔ [3rd:${this.trifectaThirdHorse}] | 赔率: x${trifectaCalcOdds.toFixed(1)}`;
            } else {
                trifectaOddsLabel.string = "👑 请在上方依次选定不同名次的冠(1st)、亚(2nd)、季(3rd)军马号";
            }

            // 3. 拟物筹码重绘
            chipNodes.forEach(({ node, val, label }) => {
                const isChipSelected = this.selectedChip === val;
                WestStyle.drawPokerChip(node, 64, 46, val, isChipSelected);
                label.color = isChipSelected ? WestColors.GOLD_BRIGHT : WestColors.PARCHMENT_LIGHT;
            });

            // 4. 金额输入框同步
            if (syncInput) {
                amountInput.string = String(this.amount);
            }

            // 5. 羊皮纸实时预估账单
            const currentDilution = this.round?.dilutionFactor ?? 1.0;
            const minRequiredAmount = this.betMode === "WIN" ? 2 : 5;
            const isEn = I18n.getLocale() === "en-US";
            previewLabel.fontSize = isEn ? 11 : 12;

            if (this.amount < minRequiredAmount) {
                previewBox.active = true;
                previewLabel.string = isEn
                    ? `⚠️ Min bet for ${this.betMode === "WIN" ? "Win" : "Multi-Horse"} is ${minRequiredAmount} gold (Entered: ${this.amount} 🪙)`
                    : `⚠️ 【${this.betMode === "WIN" ? "独赢" : "街机复合"}】注式单注起投门槛为 ${minRequiredAmount} 金币（当前输入: ${this.amount} 🪙）`;
            } else if (this.betMode === "TRIFECTA") {
                if (trifectaCalcOdds > 0) {
                    previewBox.active = true;
                    const preview = this.calculateBetPreview(this.amount, trifectaCalcOdds, currentDilution);
                    const feePercent = (preview.feeRate * 100).toFixed(2);
                    previewLabel.string = isEn
                        ? `👑 Trifecta[${this.trifectaFirstHorse}->${this.trifectaSecondHorse}->${this.trifectaThirdHorse}] x${trifectaCalcOdds.toFixed(1)} | Gross:${preview.grossReward.toFixed(2)} Fee:${preview.estimatedFee.toFixed(2)}(${feePercent}%) Net:${preview.netReward.toFixed(2)} 🪙`
                        : `👑 三重彩[${this.trifectaFirstHorse}->${this.trifectaSecondHorse}->${this.trifectaThirdHorse}] 赔率:x${trifectaCalcOdds.toFixed(1)}  毛奖:${preview.grossReward.toFixed(2)}  手续费:${preview.estimatedFee.toFixed(2)}(${feePercent}%)  净奖:${preview.netReward.toFixed(2)} 🪙`;
                } else {
                    previewBox.active = false;
                }
            } else if (this.betMode === "EXACTA") {
                if (exactaCalcOdds > 0) {
                    previewBox.active = true;
                    const preview = this.calculateBetPreview(this.amount, exactaCalcOdds, currentDilution);
                    const feePercent = (preview.feeRate * 100).toFixed(2);
                    previewLabel.string = isEn
                        ? `🎯 Exacta[${this.exactaFirstHorse}->${this.exactaSecondHorse}] x${exactaCalcOdds.toFixed(1)} | Gross:${preview.grossReward.toFixed(2)} Fee:${preview.estimatedFee.toFixed(2)}(${feePercent}%) Net:${preview.netReward.toFixed(2)} 🪙`
                        : `🎯 二连单[${this.exactaFirstHorse}->${this.exactaSecondHorse}] 赔率:x${exactaCalcOdds.toFixed(1)}  毛奖:${preview.grossReward.toFixed(2)}  手续费:${preview.estimatedFee.toFixed(2)}(${feePercent}%)  净奖:${preview.netReward.toFixed(2)} 🪙`;
                } else {
                    previewBox.active = false;
                }
            } else if (this.betMode === "PLACE") {
                const sel = this.round?.horses.find((h) => h.horseNo === this.selectedHorse);
                if (sel) {
                    previewBox.active = true;
                    const pOdds = Math.max(1.15, Math.min(4.50, Math.round(Number(sel.odds) * 0.40 * 100) / 100));
                    const preview = this.calculateBetPreview(this.amount, pOdds, currentDilution);
                    const feePercent = (preview.feeRate * 100).toFixed(2);
                    previewLabel.string = isEn
                        ? `🛡️ Place[No.${this.selectedHorse}] x${pOdds.toFixed(2)} | Gross:${preview.grossReward.toFixed(2)} Fee:${preview.estimatedFee.toFixed(2)}(${feePercent}%) Net:${preview.netReward.toFixed(2)} 🪙`
                        : `🛡️ 位置[${this.selectedHorse}号马] 赔率:x${pOdds.toFixed(2)}  毛奖:${preview.grossReward.toFixed(2)}  手续费:${preview.estimatedFee.toFixed(2)}(${feePercent}%)  净奖:${preview.netReward.toFixed(2)} 🪙`;
                } else {
                    previewBox.active = false;
                }
            } else if (this.betMode === "QUINELLA") {
                if (this.selectedQuinellaCombo) {
                    previewBox.active = true;
                    const parts = this.selectedQuinellaCombo.split("-").map(Number);
                    const qOdds = getQuinellaOdds(parts[0], parts[1]);
                    const preview = this.calculateBetPreview(this.amount, qOdds, currentDilution);
                    const feePercent = (preview.feeRate * 100).toFixed(2);
                    const diluteTag = preview.isDiluted ? (isEn ? " (Diluted)" : ` (稀释${preview.isFloorApplied ? "·保底1.05x" : ""})`) : "";
                    previewLabel.string = isEn
                        ? `🎰 Quinella[${this.selectedQuinellaCombo}] x${qOdds.toFixed(1)} | Gross:${preview.grossReward.toFixed(2)}${diluteTag} Fee:${preview.estimatedFee.toFixed(2)}(${feePercent}%) Net:${preview.netReward.toFixed(2)} 🪙`
                        : `🎰 连赢[${this.selectedQuinellaCombo}] 赔率:x${qOdds.toFixed(1)}  毛奖:${preview.grossReward.toFixed(2)}${diluteTag}  手续费:${preview.estimatedFee.toFixed(2)}(${feePercent}%)  净奖:${preview.netReward.toFixed(2)} 🪙`;
                } else {
                    previewBox.active = false;
                }
            } else {
                const selectedHorseData = this.round?.horses.find((h) => h.horseNo === this.selectedHorse);
                if (selectedHorseData) {
                    previewBox.active = true;
                    const preview = this.calculateBetPreview(this.amount, Number(selectedHorseData.odds), currentDilution);
                    const feePercent = (preview.feeRate * 100).toFixed(2);
                    const diluteTag = preview.isDiluted ? (isEn ? " (Diluted)" : ` (稀释${preview.isFloorApplied ? "·保底1.05x" : ""})`) : "";
                    previewLabel.string = isEn
                        ? `🏇 Win[No.${this.selectedHorse}] x${Number(selectedHorseData.odds).toFixed(2)} | Gross:${preview.grossReward.toFixed(2)}${diluteTag} Fee:${preview.estimatedFee.toFixed(2)}(${feePercent}%) Net:${preview.netReward.toFixed(2)} 🪙`
                        : `${I18n.t("race.previewOdds")}${Number(selectedHorseData.odds).toFixed(2)}  ${I18n.t("race.previewGross")}${preview.grossReward.toFixed(2)}${diluteTag}  ${I18n.t("race.previewFee")}${preview.estimatedFee.toFixed(2)}(${feePercent}%)  ${I18n.t("race.previewNet")}${preview.netReward.toFixed(2)}`;
                } else {
                    previewBox.active = false;
                }
            }

            // 6. 提示文字与消息
            let selectionHint = "";
            if (this.betMode === "TRIFECTA") {
                if (
                    this.trifectaFirstHorse > 0 &&
                    this.trifectaSecondHorse > 0 &&
                    this.trifectaThirdHorse > 0 &&
                    this.trifectaFirstHorse !== this.trifectaSecondHorse &&
                    this.trifectaFirstHorse !== this.trifectaThirdHorse &&
                    this.trifectaSecondHorse !== this.trifectaThirdHorse
                ) {
                    selectionHint = `👑 已选三重彩: [1st:${this.trifectaFirstHorse}号] ➔ [2nd:${this.trifectaSecondHorse}号] ➔ [3rd:${this.trifectaThirdHorse}号] (投: ${this.amount} 🪙)`;
                } else {
                    selectionHint = "👑 请分别指定冠军(1st)、亚军(2nd)与季军(3rd)马匹";
                }
            } else if (this.betMode === "EXACTA") {
                if (this.exactaFirstHorse > 0 && this.exactaSecondHorse > 0 && this.exactaFirstHorse !== this.exactaSecondHorse) {
                    selectionHint = `🎯 已选二连单: [1st:${this.exactaFirstHorse}号] ➔ [2nd:${this.exactaSecondHorse}号] (投: ${this.amount} 🪙)`;
                } else {
                    selectionHint = "🎯 请选定不同的冠军与亚军马号";
                }
            } else if (this.betMode === "PLACE") {
                if (this.selectedHorse > 0) {
                    selectionHint = `🛡️ 已选位置保底: ${this.selectedHorse}号马 (进入前2名即中奖，投: ${this.amount} 🪙)`;
                } else {
                    selectionHint = "🛡️ 请在上方选定 1 匹马进行位置保底投注";
                }
            } else if (this.betMode === "QUINELLA") {
                if (this.selectedQuinellaCombo) {
                    selectionHint = `🎰 已选连赢: [${this.selectedQuinellaCombo}] (冠亚军无序，投: ${this.amount} 🪙)`;
                } else {
                    selectionHint = "🎰 请在上方 15 组矩阵中选择一组二连碰组合 (如 1-2)";
                }
            } else {
                if (this.selectedHorse > 0) {
                    selectionHint = `${I18n.t("race.selected")}${this.selectedHorse} ${I18n.t("race.horse")} (投: ${this.amount} 🪙)`;
                } else {
                    selectionHint = I18n.t("race.unselected");
                }
            }
            selectionHintLabel.string = selectionHint;
            messageLabel.string = this.message;
        };

        updateRaceUI();

        this.updateRaceLabels(stateLabel, countdownLabel);
        this.connectSignalR();
        await this.loadAnimationIfNeeded();
    }

    /** 构建近 15 期赛马历史走势路单与连赢二连碰冷热矩阵。 */
    private async buildTrendBeadPlateModal(root: Node): Promise<void> {
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 670, 960, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 670, 960, () => mask.destroy());

        // 顶部黑板标题
        const titleBox = this.chalkboardBox(modalBox, 0, 440, 630, 44, 6);
        this.text(titleBox, "📊 边境公证处 · 近15期赛果走势路单 📊", 0, 0, 19, WestColors.GOLD_BRIGHT);

        try {
            const res = await ApiClient.get<{
                items: Array<{
                    roundId: number;
                    roundNo: string;
                    winnerHorseNo: number | null;
                    secondHorseNo?: number | null;
                    quinellaCombo?: string | null;
                    isSkipped?: boolean;
                }>;
                summary?: {
                    totalRounds: number;
                    winnerDistribution?: Record<string, number>;
                };
            }>("/api/race/history?limit=15");

            const historyItems = (res.data?.items ?? []).filter((x) => !x.isSkipped && x.winnerHorseNo);

            const horseColors = [
                new Color(217, 83, 79, 255),  // 1: 烈焰红
                new Color(51, 122, 183, 255), // 2: 极速蓝
                new Color(92, 184, 92, 255),  // 3: 灵动绿
                new Color(240, 173, 78, 255), // 4: 黄金橙
                new Color(155, 89, 182, 255), // 5: 魅影紫
                new Color(218, 165, 32, 255), // 6: 皇家金
            ];

            // 1. 独赢珠盘路 (Win Bead Plate, 3行 x 5列)
            const beadBoard = this.wantedPosterBox(modalBox, 0, 260, 630, 260, 8);
            this.text(beadBoard, "🎯 独赢冠军珠盘路 (WINNER BEAD PLATE)", 0, 108, 16, WestColors.INK_DARK);

            if (historyItems.length === 0) {
                this.text(beadBoard, "暂无近期开奖走势数据", 0, 0, 18, WestColors.INK_MUTED);
            } else {
                const cols = 5;
                const cellW = 108;
                const cellH = 65;
                const startX = -216;
                const startY = 45;

                historyItems.slice(0, 15).forEach((item, idx) => {
                    const col = idx % cols;
                    const row = Math.floor(idx / cols);
                    const bx = startX + col * cellW;
                    const by = startY - row * cellH;

                    const winnerNo = item.winnerHorseNo ?? 1;
                    const bead = this.box(beadBoard, bx, by, 38, 38, horseColors[winnerNo - 1], 19);
                    const bg = bead.getComponent(Graphics);
                    if (bg) {
                        bg.strokeColor = WestColors.BRASS_FRAME;
                        bg.lineWidth = 1.8;
                        bg.circle(0, 0, 19);
                        bg.stroke();
                        // 高光
                        bg.fillColor = new Color(255, 255, 255, 70);
                        bg.arc(0, 0, 18, 0, Math.PI, false);
                        bg.fill();
                    }
                    this.text(bead, `${winnerNo}`, 0, 0, 18, new Color(255, 255, 255, 255));

                    // 轮号标签
                    const shortNo = item.roundNo ? item.roundNo.slice(-3) : `${item.roundId}`;
                    this.text(beadBoard, `#${shortNo}`, bx, by - 26, 11, WestColors.INK_MUTED);
                });
            }

            // 2. 六马胜率频次统计条 (1~6号马分布)
            const statsCard = this.chalkboardBox(modalBox, 0, 75, 630, 75, 6);
            this.text(statsCard, "📊 近15期六马夺冠频次分布 (CHAMPION FREQUENCY)", 0, 20, 13, WestColors.GOLD_BRIGHT);

            const counts = [0, 0, 0, 0, 0, 0];
            historyItems.forEach((item) => {
                if (item.winnerHorseNo && item.winnerHorseNo >= 1 && item.winnerHorseNo <= 6) {
                    counts[item.winnerHorseNo - 1]++;
                }
            });
            const maxCount = Math.max(1, ...counts);

            const freqX = [-210, -126, -42, 42, 126, 210];
            for (let h = 1; h <= 6; h++) {
                const c = counts[h - 1];
                const isHot = c === maxCount && c > 0;
                const fx = freqX[h - 1];
                const tag = isHot ? `🔥${h}号: ${c}次` : `${h}号: ${c}次`;
                this.text(statsCard, tag, fx, -14, 13, isHot ? WestColors.CHALK_YELLOW : WestColors.TEXT_PARCHMENT);
            }

            // 3. 街机黄金场 · 二连碰连赢走势 (Quinella Combos)
            const quinellaBoard = this.wantedPosterBox(modalBox, 0, -145, 630, 240, 8);
            this.text(quinellaBoard, "🎰 老街机黄金连赢二连碰走势 (QUINELLA HOT COMBOS)", 0, 95, 16, WestColors.INK_DARK);

            const quinellaCombos: string[] = [];
            historyItems.forEach((it) => {
                if (it.quinellaCombo) {
                    quinellaCombos.push(it.quinellaCombo);
                } else if (it.winnerHorseNo && it.secondHorseNo) {
                    const minH = Math.min(it.winnerHorseNo, it.secondHorseNo);
                    const maxH = Math.max(it.winnerHorseNo, it.secondHorseNo);
                    quinellaCombos.push(`${minH}-${maxH}`);
                }
            });

            if (quinellaCombos.length === 0) {
                this.text(quinellaBoard, "近期无连赢开出记录，等待下轮结算", 0, 0, 16, WestColors.INK_MUTED);
            } else {
                // 显示最近 10 期连赢组合横排
                this.text(quinellaBoard, "近期连赢开出序列 (最新 → 往期):", 0, 60, 13, WestColors.INK_MUTED);
                const qPillsX = [-230, -178, -126, -74, -22, 30, 82, 134, 186, 238];
                quinellaCombos.slice(0, 10).forEach((combo, idx) => {
                    const qBox = this.box(quinellaBoard, qPillsX[idx], 25, 48, 28, WestColors.BANDANA_RED, 4);
                    this.text(qBox, combo, 0, 0, 13, WestColors.GOLD_BRIGHT);
                });

                // 统计热门组合
                const comboFreq = new Map<string, number>();
                quinellaCombos.forEach((c) => {
                    comboFreq.set(c, (comboFreq.get(c) ?? 0) + 1);
                });
                const sortedCombos = Array.from(comboFreq.entries()).sort((a, b) => b[1] - a[1]);
                const topStr = sortedCombos.slice(0, 5).map(([c, cnt]) => `[${c}] 命中${cnt}次`).join("  ·  ");

                this.text(quinellaBoard, "🔥 黄金二连碰高频推荐热单:", 0, -25, 14, WestColors.SEAL_RED);
                this.text(quinellaBoard, topStr || "数据采集中", 0, -55, 14, WestColors.INK_DARK);
                this.text(quinellaBoard, "💡 提示：连赢不限冠亚顺序，选择 15 组中任一组命中前二即可获赔", 0, -88, 12, WestColors.INK_MUTED);
            }
        } catch {
            this.text(modalBox, "路单数据加载失败", 0, 0, 20, WestColors.SEAL_RED);
        }

        // 关闭按钮
        this.saloonButton(modalBox, "🚪 关闭路单 (CLOSE)", 0, -420, 260, 48, () => {
            mask.destroy();
        }, true, 16);
    }

    /** 创建六条美国西部牧场泥地赛道与马匹表现节点。 */
    private buildTrack(root: Node): void {
        const horseColors = [
            new Color(217, 83, 79, 255),  // 1: 烈焰红
            new Color(51, 122, 183, 255), // 2: 极速蓝
            new Color(92, 184, 92, 255),  // 3: 灵动绿
            new Color(240, 173, 78, 255), // 4: 黄金橙
            new Color(155, 89, 182, 255), // 5: 魅影紫
            new Color(218, 165, 32, 255), // 6: 皇家金
        ];

        // 牧场泥道大围栏（老橡木原木面板）
        const arenaBox = new Node("ArenaTrackBox");
        arenaBox.layer = root.layer || Layers.Enum.UI_2D;
        root.addChild(arenaBox);
        arenaBox.setPosition(360, 946);
        arenaBox.addComponent(UITransform).setContentSize(696, 330);
        WestStyle.drawGrandSaloonPanel(arenaBox, 696, 330, 12, WestColors.BG_DIRT_TRACK, WestColors.WOOD_FRAME);

        // 顶部悬挂动态解说跑马灯条 (左侧 530px) + 实时前三排位看板 (右侧 136px)
        const commentaryBar = this.woodBox(arenaBox, -70, 142, 530, 28, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        const commentaryLabel = this.text(commentaryBar, "🎙️ 现场解说席就绪 · 柯尔特边境赛马会", 0, 0, 13, WestColors.GOLD_BRIGHT);
        this.raceCommentaryLabel = commentaryLabel;

        const liveRankBoard = this.woodBox(arenaBox, 265, 142, 136, 28, 6, WestColors.WOOD_DARK, WestColors.GOLD_METALLIC);
        const liveRankLabel = this.text(liveRankBoard, "🥇- 🥈- 🥉-", 0, 0, 12, WestColors.GOLD_BRIGHT);
        this.liveRankLabel = liveRankLabel;

        // 赛道顶部微缩雷达进度线 (Mini Track Radar: 宽 540, 高 12)
        const radarNode = new Node("MiniTrackRadar");
        radarNode.layer = arenaBox.layer || Layers.Enum.UI_2D;
        arenaBox.addChild(radarNode);
        radarNode.setPosition(0, 120, 0);
        radarNode.addComponent(UITransform).setContentSize(540, 12);
        radarNode.addComponent(Graphics);
        this.trackRadarNode = radarNode;

        // 📷 Photo Finish 终点毫厘裁决中央悬浮屏 (2.0 红外激光与微距裁决框)
        const pfNode = new Node("PhotoFinishBanner");
        pfNode.layer = arenaBox.layer || Layers.Enum.UI_2D;
        arenaBox.addChild(pfNode);
        pfNode.setPosition(0, 0, 0);
        pfNode.addComponent(UITransform).setContentSize(520, 68);
        WestStyle.drawGrandSaloonPanel(pfNode, 520, 68, 12, WestColors.WOOD_DARK, WestColors.BANDANA_RED);

        // 终点激光标尺红外线
        const laserLine = new Node("LaserLine");
        laserLine.layer = pfNode.layer || Layers.Enum.UI_2D;
        pfNode.addChild(laserLine);
        laserLine.setPosition(0, 0, 0);
        const lg = laserLine.addComponent(Graphics);
        lg.strokeColor = new Color(255, 40, 40, 230);
        lg.lineWidth = 2.5;
        lg.moveTo(0, -32);
        lg.lineTo(0, 32);
        lg.stroke();

        this.text(pfNode, "📷 PHOTO FINISH · 终点毫厘激光定格判定中", 0, 14, 15, WestColors.GOLD_BRIGHT);
        this.text(pfNode, "⚡ 冠亚军鼻尖微距压线 · 高速摄像帧裁决", 0, -14, 12, WestColors.CHALK_YELLOW);
        pfNode.active = false;
        this.photoFinishBannerNode = pfNode;

        // 起点线与终点线立柱 (红白格相间终点线 + 原木栅栏立柱)
        const startPost = this.box(arenaBox, -270, -10, 6, 275, WestColors.LEATHER_MEDIUM, 2);
        this.text(startPost, "🚩", 0, 130, 16);

        const finishPost = new Node("FinishPostCheckered");
        finishPost.layer = arenaBox.layer || Layers.Enum.UI_2D;
        arenaBox.addChild(finishPost);
        finishPost.setPosition(270, -10, 0);
        finishPost.addComponent(UITransform).setContentSize(12, 275);
        const fg = finishPost.addComponent(Graphics);
        fg.fillColor = WestColors.LEATHER_DARK;
        fg.rect(-4, -137, 8, 275);
        fg.fill();
        const checkH = 14;
        const totalChecks = Math.floor(275 / checkH);
        for (let c = 0; c < totalChecks; c++) {
            fg.fillColor = c % 2 === 0 ? WestColors.BANDANA_RED : new Color(250, 250, 250, 255);
            fg.rect(-6, -137 + c * checkH, 12, checkH);
            fg.fill();
        }
        this.text(finishPost, "🏁", 0, 130, 16);

        const currentModeHorses = this.getModeHorses(this.betMode);
        for (let laneIdx = 0; laneIdx < 6; laneIdx += 1) {
            const horseItem = currentModeHorses[laneIdx];
            const laneY = 135 - (laneIdx + 1) * 41;
            const lane = this.box(
                arenaBox,
                0,
                laneY,
                676,
                38,
                new Color(176, 137, 104, 180), // DUST_BROWN
                8,
            );

            // 本轮实际参赛马匹不足 6 匹时，该跑道仅保留赛道，不创建幻影马，避免马号重复覆盖 this.horses 映射。
            if (!horseItem) {
                continue;
            }
            const horseNo = horseItem.horseNo;

            // 赛道马号木标牌（支持点击查看 2D 写实古典画作与解剖三视图）
            const badge = this.box(lane, -318, 0, 28, 28, WestColors.WOOD_DARK, 6);
            const bg = badge.getComponent(Graphics);
            if (bg) {
                bg.strokeColor = horseColors[horseNo - 1];
                bg.lineWidth = 1.8;
                bg.roundRect(-14, -14, 28, 28, 6);
                bg.stroke();
            }
            this.text(badge, `${horseNo}`, 0, 0, 16, horseColors[horseNo - 1]);
            const badgeBtn = badge.addComponent(Button);
            badgeBtn.node.on(Button.EventType.CLICK, () => {
                HorseGalleryModal.show(horseNo, this.node);
            }, this);

            // 赛道马蹄印凹痕节点 (位于马匹图层之下，呈现 3 秒渐隐的泥沙凹痕)
            const hoofprintsNode = new Node(`Hoofprints${horseNo}`);
            hoofprintsNode.layer = lane.layer || Layers.Enum.UI_2D;
            lane.addChild(hoofprintsNode);
            hoofprintsNode.setPosition(0, 0, 0);
            hoofprintsNode.addComponent(UITransform).setContentSize(676, 38);
            const hoofprintsG = hoofprintsNode.addComponent(Graphics);

            // 马匹表现节点（与 HorseController 逻辑绑定，保持 -270 起始坐标）
            const horseNode = new Node(`Horse${horseNo}`);
            horseNode.layer = lane.layer || Layers.Enum.UI_2D;
            lane.addChild(horseNode);
            horseNode.setPosition(-270, 0);
            horseNode.addComponent(UITransform).setContentSize(48, 48);

            // 挂载 2D 写实赛马表现组件（模拟 18-20 世纪纯血马骨骼起伏律动与贴图）
            const visual2D = horseNode.addComponent(HorseVisual2D);
            visual2D.setHorseNo(horseNo);

            const controller = horseNode.addComponent(HorseController);
            controller.horseVisual = horseNode;
            controller.setVisual2D(visual2D);
            controller.setHoofprintGraphics(hoofprintsG);
            this.horses.set(horseNo, controller);
        }

        // 赛场内实时 HUD：
        // 左下角：皮质水囊与耐力子弹带指标 (Stamina Belt & Canteen HUD)
        const staminaBox = this.box(arenaBox, -170, -140, 300, 36, WestColors.WOOD_DARK, 6);
        const bulletBeltHUD = new Node("TrackBulletBeltHUD");
        bulletBeltHUD.layer = arenaBox.layer || Layers.Enum.UI_2D;
        staminaBox.addChild(bulletBeltHUD);
        bulletBeltHUD.setPosition(-50, 0, 0);
        bulletBeltHUD.addComponent(UITransform).setContentSize(145, 26);
        WestStyle.drawBulletBelt(bulletBeltHUD, 145, 26, 6, 6);
        const isEnTrack = I18n.getLocale() === "en-US";
        this.text(staminaBox, isEnTrack ? "💧 Stamina 100%" : "💧 耐力 100%", 75, 0, isEnTrack ? 12 : 13, WestColors.PARCHMENT_LIGHT);

        // 右下角：黄铜马刺与扬鞭狂飙大按钮（带音效与屏幕剧烈震动反馈）
        this.button(
            arenaBox,
            I18n.t("race.spursBtn", "⚡ 马刺冲刺"),
            90,
            -140,
            120,
            36,
            () => {
                const curMode = this.getAudioMode();
                this.shakeScreen(240, 5);
                WestAudio.playBullwhip(curMode);
                WestAudio.playHorseSnort(curMode);
                WestAudio.speakCowboy("spurs", curMode);
                this.message = isEnTrack ? "⚡ Dig spurs into the horse! Sand storms and full sprint!" : "⚡ 马刺刺入马腹！黄沙漫天撕裂冲刺！";
                this.updateRaceMessage(this.message);
            },
            WestColors.SEAL_RED,
            WestColors.GOLD_BRIGHT,
            isEnTrack ? 13 : 15,
        );

        this.button(
            arenaBox,
            I18n.t("race.whipBtn", "🏇 扬鞭疾驰"),
            225,
            -140,
            120,
            36,
            () => {
                const curMode = this.getAudioMode();
                this.shakeScreen(180, 4);
                WestAudio.playWhip(curMode);
                WestAudio.playHorseNeigh(curMode);
                WestAudio.speakCowboy("spurs", curMode);
                this.message = isEnTrack ? "🏇 Whip cracked! Full throttle gallop ahead!" : "🏇 扬鞭策马！破风突围全速狂飙！";
                this.updateRaceMessage(this.message);
            },
            WestColors.LEATHER_SADDLE,
            WestColors.GOLD_BRIGHT,
            isEnTrack ? 13 : 15,
        );

        // 初始化微缩雷达与前三排位板为待命状态
        this.resetMiniRadarAndRanking();
    }

    /** 使用服务端时间校准阶段倒计时。 */
    private updateRaceLabels(
        stateLabel: Label,
        countdownLabel: Label,
    ): void {
        this.clearRaceTimer();
        const tick = (): void => {
            if (
                !this.round ||
                this.page !== "race" ||
                !stateLabel ||
                !stateLabel.isValid ||
                !countdownLabel ||
                !countdownLabel.isValid
            ) {
                this.clearRaceTimer();
                return;
            }

            stateLabel.string = this.stateText(this.round.state);

            // 比赛阶段切换时同步刷新下注按钮的封单状态（无需整页重建）
            this.refreshRaceBetButton?.();

            const now = Date.now() + this.serverOffsetMs;
            const target = this.getStateTargetMs(this.round);
            const remaining = target === null ? null : Math.ceil((target - now) / 1000);
            countdownLabel.string = remaining === null
                ? ""
                : `${Math.max(0, remaining)}s`;

            // 当倒计时归零且处于可轮询状态时，执行 HTTP 兜底轮询（防长连接丢包或网络抖动）
            if (remaining !== null && remaining <= 0 && (now - this.lastCountdownPollMs > 2000)) {
                this.lastCountdownPollMs = now;
                void (async () => {
                    const prevRoundState = this.round?.state;
                    const prevRoundId = this.round?.id;
                    await this.refreshRound();
                    if (this.page === "race") {
                        const isStateChanged = this.round?.state !== prevRoundState || this.round?.id !== prevRoundId;
                        if (this.round?.state === RaceState.Finished) {
                            this.resultRoundId = this.round.id;
                            await this.show("result");
                        } else if (this.round?.state === RaceState.Racing) {
                            if (isStateChanged) {
                                await this.loadAnimationIfNeeded();
                                await this.show("race");
                            }
                        } else if (this.round?.state === RaceState.Preparing || this.round?.state === RaceState.Betting) {
                            if (isStateChanged) {
                                await this.show("race");
                            }
                        }
                    }
                })();
            }

            this.raceTickTimer = setTimeout(tick, 500);
        };

        tick();
    }

    /** 返回当前阶段的服务端结束时间。 */
    private getStateTargetMs(round: RaceRoundDto): number | null {
        if (round.state === RaceState.Betting) {
            return new Date(round.bettingEndAt).getTime();
        }

        if (round.state === RaceState.Preparing && round.raceStartAt) {
            return new Date(round.raceStartAt).getTime();
        }

        if (round.state === RaceState.Racing && round.raceEndAt) {
            return new Date(round.raceEndAt).getTime();
        }

        return null;
    }

    /** 读取当前轮次并在完成状态转入结果页。 */
    private async refreshRound(): Promise<void> {
        const response = await ApiClient.get<RaceRoundDto | null>(
            "/api/race/current",
        );
        this.round = response.data;
        if (this.round?.commentaryScriptJson) {
            try {
                this.parsedCommentary = JSON.parse(this.round.commentaryScriptJson) as CommentaryItemDto[];
            } catch {
                this.parsedCommentary = [];
            }
        } else {
            this.parsedCommentary = [];
        }
        this.lastScriptCommentarySec = -1;
        this.isDoubleDownSubmitted = false;

        const maint = this.round?.maintenance ?? response.maintenance;
        if (maint) {
            MaintenanceHelper.updateState(maint);
            if (MaintenanceHelper.isUnderMaintenance()) {
                this.signalr?.stop();
                MaintenanceHelper.showMaintenanceLockdownModal(
                    this.node,
                    maint.maintenanceReason || maint.reason,
                    maint.maintenanceEndAt,
                    () => {
                        void ApiClient.logout();
                        void this.show("login");
                    },
                );
            }
        }

        if (
            this.round?.state === RaceState.Finished &&
            this.page === "race"
        ) {
            this.resultRoundId = this.round.id;
        } else if (
            this.round?.state !== RaceState.Racing &&
            this.page === "race"
        ) {
            this.resetMiniRadarAndRanking();
        }
    }

    /** 读取服务端动画参数。 */
    private async loadAnimationIfNeeded(): Promise<void> {
        if (
            !this.round ||
            !this.round.raceStartAt ||
            this.round.state !== RaceState.Racing
        ) {
            return;
        }

        try {
            const response = await ApiClient.get<{
                raceStartAt: string;
                animations: Array<{
                    horseNo: number;
                    finishTime: number;
                }>;
            }>(`/api/race/${this.round.id}/animation`);

            const raceStartMs = new Date(response.data.raceStartAt).getTime();
            const roundSeed = this.round.id;
            const isQuinella = this.betMode === "QUINELLA" || this.betMode === "EXACTA" || this.betMode === "TRIFECTA";

            // 重置赛事即时独立跟踪状态
            this.winLeaderHorseNo = 0;
            this.winLastOvertakeAnnounceMs = 0;
            this.winLastMessage = "";
            this.quinellaLastTop2Combo = "";
            this.quinellaLastDuelAnnounceMs = 0;
            this.quinellaLastOvertakeAnnounceMs = 0;
            this.quinellaLastMessage = "";
            this.lastPackDensityAnnounceMs = 0;

            for (const animation of response.data.animations) {
                const matchedHorse = this.round?.horses?.find((h) => h.horseNo === animation.horseNo);
                this.horses
                    .get(animation.horseNo)
                    ?.init(
                        animation.finishTime,
                        raceStartMs,
                        animation.horseNo,
                        roundSeed,
                        isQuinella,
                        matchedHorse?.runningStyle,
                    );
            }

            WestAudio.playRaceStart(this.getAudioMode());
            WestAudio.startGallop("COMMON");
            WestAudio.speakCowboy("start", this.getAudioMode());
        } catch {
            this.updateRaceMessage(I18n.t("race.animRetrying", "比赛动画参数暂时不可用，正在重试"));
        }
    }

    /** 建立 SignalR 轮次订阅；事件丢失时由 HTTP 快照补偿。 */
    private connectSignalR(): void {
        if (!this.round || !ApiClient.getAccessToken()) {
            return;
        }

        if (!this.signalr) {
            this.signalr = new SignalRClient(
                `${ApiClient.getBaseUrl()}/raceHub`,
                () => ApiClient.getAccessToken(),
            );

            const refreshFromEvent = async (): Promise<void> => {
                try {
                    await this.syncTime();
                    await this.refreshRound();
                    await this.loadPlayer();

                    if (
                        this.page === "race" &&
                        this.round?.state === RaceState.Racing
                    ) {
                        await this.loadAnimationIfNeeded();
                    }

                    if (
                        this.page === "race" &&
                        this.round?.state === RaceState.Finished
                    ) {
                        this.resultRoundId = this.round.id;
                        await this.show("result");
                    } else if (
                        this.page === "race" &&
                        this.round?.state === RaceState.Betting
                    ) {
                        await this.show("race");
                    }
                } catch {
                    this.message = I18n.t("race.syncError", "实时事件同步失败，将通过 HTTP 重试");
                }
            };

            this.signalr
                .on("RaceBettingStarted", refreshFromEvent)
                .on("RacePreparing", () => {
                    const m = this.getAudioMode();
                    WestAudio.playRaceStart(m);
                    WestAudio.playHorseNeigh(m);
                    return refreshFromEvent();
                })
                .on("RaceStarted", () => {
                    WestAudio.startGallop();
                    return refreshFromEvent();
                })
                .on("RaceFinished", () => {
                    const m = this.getAudioMode();
                    WestAudio.stopGallop();
                    WestAudio.playRaceFinishFanfare(m);
                    WestAudio.playGunshot(m);
                    return refreshFromEvent();
                })
                .on("RaceSettled", () => {
                    WestAudio.stopGallop();
                    return refreshFromEvent();
                })
                .on("RaceSkipped", () => {
                    WestAudio.stopGallop();
                    return refreshFromEvent();
                })
                .on("SystemMaintenanceKick", (payload: RaceEventPayload) => {
                    const kickReason = payload?.reason || "系统已进入维护时间窗口，所有在线玩家已被强制登出";
                    const kickEndAt = payload?.maintenanceEndAt;
                    this.signalr?.stop();
                    MaintenanceHelper.showMaintenanceLockdownModal(
                        this.node,
                        kickReason,
                        kickEndAt,
                        () => {
                            void ApiClient.logout();
                            void this.show("login");
                        },
                    );
                })
                .on("InPlayWindowOpened", () => {
                    if (this.doubleDownBtnNode && !this.isDoubleDownSubmitted && this.myRoundOrders.some(o => o.status === BetOrderStatus.Pending && !o.isDoubleDown)) {
                        this.doubleDownBtnNode.active = true;
                        WestAudio.playSpurJingle();
                    }
                })
                .on("PhotoFinishTriggered", (payload: RaceEventPayload) => {
                    if (this.photoFinishBannerNode && !this.photoFinishBannerNode.active) {
                        this.photoFinishBannerNode.active = true;
                        const gap = payload.gapTime ?? 0.05;
                        this.updateRaceMessage(`📷 [PHOTO FINISH 毫厘压线裁决] 差距仅 ${gap}s！终点高速镜头判定中！`);
                        WestAudio.playNeckAndNeckTension("COMMON");
                    }
                })
                .on("RaceBettingFastForward", (payload: RaceEventPayload) => {
                    const sec = payload?.remainingSeconds ?? 10;
                    this.showToast(`⚡ 全员牛仔就绪！倒计时加速至 ${sec} 秒！`, WestColors.GOLD_BRIGHT);
                    WestAudio.playCopperBell("COMMON");
                    if (this.round) {
                        this.round.bettingEndAt = new Date(Date.now() + sec * 1000).toISOString();
                    }
                    return refreshFromEvent();
                })
                .on("MegaJackpotDropped", (payload: RaceEventPayload) => {
                    const pool = payload?.totalPool ?? 8888;
                    this.updateRaceMessage(`🎉 [全服超级大奖掉落] 恭喜引爆巨奖池 $${pool}！全场普天同庆！`);
                    this.showMegaJackpotCelebration(pool);
                })
                .on("Reconnecting", () => {
                    this.showNetworkToast(true);
                })
                .on("Connected", () => {
                    this.showNetworkToast(false);
                    return refreshFromEvent();
                });
        }

        this.signalr.setRound(this.round.id);
        void this.signalr.start(this.round.id).catch(() => {
            this.message = I18n.t("race.signalrFailed", "实时连接失败，HTTP 快照仍可继续使用");
        });
    }

    /** 提交一笔下注；客户端做防重防抖，最终校验由服务端完成。 */
    private async placeBetAsync(amount: number): Promise<void> {
        if (this.isSubmitting) {
            return;
        }

        const maintCheck = MaintenanceHelper.checkActionBlocked();
        if (maintCheck.blocked) {
            this.message = maintCheck.message;
            this.updateRaceMessage(this.message);
            return;
        }
        if (maintCheck.warningOnly) {
            this.message = maintCheck.message;
            this.updateRaceMessage(this.message);
        }

        if (!this.round || this.round.state !== RaceState.Betting) {
            this.message = I18n.t("race.betClosed");
            this.updateRaceMessage(this.message);
            return;
        }

        let primaryHorse = 0;
        let secondHorse: number | null = null;
        let comboStr: string | null = null;

        if (this.betMode === "QUINELLA") {
            if (!this.selectedQuinellaCombo) {
                this.message = "请先在上方 15 组矩阵中点选一组二连碰连赢组合 (如 1-2)";
                this.updateRaceMessage(this.message);
                return;
            }
            const parts = this.selectedQuinellaCombo.split("-").map(Number);
            primaryHorse = parts[0];
            secondHorse = parts[1];
            comboStr = this.selectedQuinellaCombo;
        } else if (this.betMode === "EXACTA") {
            if (this.exactaFirstHorse <= 0 || this.exactaSecondHorse <= 0 || this.exactaFirstHorse === this.exactaSecondHorse) {
                this.message = I18n.t("race.exactaSelectBoth", "请先选择精确的第一名马匹与第二名马匹（不可相同）");
                this.updateRaceMessage(this.message);
                return;
            }
            primaryHorse = this.exactaFirstHorse;
            secondHorse = this.exactaSecondHorse;
            comboStr = `${this.exactaFirstHorse}-${this.exactaSecondHorse}`;
        } else if (this.betMode === "TRIFECTA") {
            if (
                this.trifectaFirstHorse <= 0 ||
                this.trifectaSecondHorse <= 0 ||
                this.trifectaThirdHorse <= 0 ||
                this.trifectaFirstHorse === this.trifectaSecondHorse ||
                this.trifectaFirstHorse === this.trifectaThirdHorse ||
                this.trifectaSecondHorse === this.trifectaThirdHorse
            ) {
                this.message = "👑 请选定不相同的冠军(1st)、亚军(2nd)与季军(3rd)马匹";
                this.updateRaceMessage(this.message);
                return;
            }
            primaryHorse = this.trifectaFirstHorse;
            secondHorse = this.trifectaSecondHorse;
            const thirdHorse = this.trifectaThirdHorse;
            comboStr = `${this.trifectaFirstHorse}-${this.trifectaSecondHorse}-${this.trifectaThirdHorse}`;
        } else {
            // "WIN" or "PLACE"
            if (this.selectedHorse <= 0) {
                this.message = I18n.t("race.selectFirst");
                this.updateRaceMessage(this.message);
                return;
            }
            primaryHorse = this.selectedHorse;
        }

        const minRequired = (this.betMode && this.betMode !== "WIN") ? 5 : 2;
        if (!Number.isFinite(amount) || amount < minRequired) {
            this.message = (this.betMode && this.betMode !== "WIN")
                ? "街机复合注式最低 5 金币起注"
                : I18n.t("race.minAmount");
            this.updateRaceMessage(this.message);
            return;
        }

        this.isSubmitting = true;
        let placedBetData: PlaceBetResponse | null = null;
        try {
            const payload: Record<string, unknown> = {
                roundId: this.round.id,
                playType: this.betMode,
                horseNo: primaryHorse,
                amount,
                idempotencyKey: this.createUuid(),
            };
            if (this.betMode === "QUINELLA" || this.betMode === "EXACTA") {
                payload.secondHorseNo = secondHorse;
                payload.combination = comboStr;
            } else if (this.betMode === "TRIFECTA") {
                payload.secondHorseNo = secondHorse;
                payload.thirdHorseNo = this.trifectaThirdHorse;
                payload.combination = comboStr;
            }

            const response = await ApiClient.post<PlaceBetResponse>(
                "/api/race/bet",
                payload,
            );
            placedBetData = response.data;
            const curAudioMode = this.getAudioMode();
            WestAudio.playBet(curAudioMode);
            WestAudio.playCopperBell(curAudioMode);
            WestAudio.playStampThud(curAudioMode);
            WestAudio.speakCowboy("bet", curAudioMode);
            this.amount = amount;
            let targetDesc = "";
            if (this.betMode === "QUINELLA") {
                targetDesc = `二连碰组合 [${comboStr}]`;
            } else if (this.betMode === "EXACTA") {
                targetDesc = `二连单精确 [1st:${primaryHorse}号 ➔ 2nd:${secondHorse}号]`;
            } else if (this.betMode === "TRIFECTA") {
                targetDesc = `三重彩精确 [1st:${primaryHorse} ➔ 2nd:${secondHorse} ➔ 3rd:${this.trifectaThirdHorse}]`;
            } else if (this.betMode === "PLACE") {
                targetDesc = `${primaryHorse}号马 (位置保底盘)`;
            } else {
                targetDesc = `${primaryHorse}号马 (独赢盘)`;
            }
            this.message =
                `${I18n.t("race.betSuccess", "下注成功")}：${response.data.orderNo} (${targetDesc})，${I18n.t("race.previewNet")}${this.formatMoney(response.data.netReward)}`;
            await this.loadPlayer();
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("race.betFailed", "下注失败"));
        } finally {
            this.isSubmitting = false;
        }

        if (placedBetData) {
            // 仅在押注成功后整页刷新（同步已投注标记与面板状态）
            await this.show("race");
            this.showBetReceiptModal(placedBetData);
        } else {
            // 押注失败：保留当前页面与输入，仅通过跑马灯与 Toast 提示错误
            this.updateRaceMessage(this.message);
        }
    }

    /**
     * 🎫 押注成功票据弹窗 (BET CONFIRMATION RECEIPT)
     * 展示当前押注马匹、本金、赔率、胜率、预期获胜净派彩等关键信息，支持玩家手动点击关闭。
     */
    private showBetReceiptModal(bet: PlaceBetResponse): void {
        const root = this.pageRoot ?? this.node;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 225), 0);
        mask.setSiblingIndex(9999);

        const closeModal = () => {
            WestAudio.playLeatherPress("COMMON");
            mask.destroy();
        };
        this.bindClick(mask, closeModal);

        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 780, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 780, closeModal);

        // 弹窗弹性进入动效
        modalBox.setScale(new Vec3(0.7, 0.7, 1));
        tween(modalBox)
            .to(0.25, { scale: new Vec3(1.03, 1.03, 1) }, { easing: "backOut" })
            .to(0.1, { scale: new Vec3(1, 1, 1) })
            .start();

        const isEn = I18n.getLocale() === "en-US";

        // 1. 顶部黑板标题牌匾
        const titleBox = this.chalkboardBox(modalBox, 0, 340, 620, 48, 6);
        this.text(titleBox, I18n.t("race.receiptTitle"), 0, 7, 18, WestColors.GOLD_BRIGHT);
        this.text(titleBox, `${I18n.t("race.receiptSubTitle")} · Round #${bet.roundId}`, 0, -14, 11, WestColors.TEXT_PARCHMENT);

        // 2. 复古牛皮纸注单大卡片
        const sheet = this.wantedPosterBox(modalBox, 0, 25, 610, 540, 10);

        // 2.1 注单号与玩法标识
        let playModeLabel = isEn ? "WIN" : "独赢";
        if (bet.playType === "PLACE") playModeLabel = isEn ? "PLACE (Top 2)" : "位置保底 (前二即中)";
        else if (bet.playType === "QUINELLA") playModeLabel = isEn ? "QUINELLA (Any Order)" : "连赢二连碰 (任意顺序)";
        else if (bet.playType === "EXACTA") playModeLabel = isEn ? "EXACTA (Exact Order)" : "二连单 (精确顺序)";
        else if (bet.playType === "TRIFECTA") playModeLabel = isEn ? "TRIFECTA (1st-2nd-3rd)" : "三重彩 (冠亚季精确)";

        this.text(sheet, `NO: ${bet.orderNo}`, -140, 235, 13, WestColors.INK_MUTED);
        const modeBadge = this.box(sheet, 180, 235, 180, 24, WestColors.WOOD_DARK, 4);
        this.text(modeBadge, playModeLabel, 0, 0, 11, WestColors.GOLD_BRIGHT);

        // 2.2 押注标的马匹详细卡片
        const targetBox = this.woodBox(sheet, 0, 175, 570, 52, 6, WestColors.WOOD_MEDIUM, WestColors.LEATHER_DARK);

        const getHorseName = (hNo: number): string => {
            const h = this.round?.horses.find((item) => item.horseNo === hNo);
            if (!h) return isEn ? `Horse #${hNo}` : `${hNo}号马`;
            return isEn && h.horseNameEnSnapshot ? h.horseNameEnSnapshot : (h.horseNameZhSnapshot ?? `名驹${hNo}`);
        };

        if (bet.playType === "QUINELLA") {
            const h1 = bet.horseNo;
            const h2 = bet.secondHorseNo ?? 0;
            this.text(targetBox, `🎰 组合 [${bet.combination ?? `${h1}-${h2}`}]: No.${h1} ${getHorseName(h1)}  &  No.${h2} ${getHorseName(h2)}`, 0, 0, 13, WestColors.GOLD_BRIGHT);
        } else if (bet.playType === "EXACTA") {
            const h1 = bet.horseNo;
            const h2 = bet.secondHorseNo ?? 0;
            this.text(targetBox, `🎯 二连单: 🥇1st: No.${h1} ${getHorseName(h1)}  ➔  🥈2nd: No.${h2} ${getHorseName(h2)}`, 0, 0, 13, WestColors.GOLD_BRIGHT);
        } else if (bet.playType === "TRIFECTA") {
            const h1 = bet.horseNo;
            const h2 = bet.secondHorseNo ?? 0;
            const h3 = bet.thirdHorseNo ?? 0;
            this.text(targetBox, `👑 三重彩: 🥇No.${h1} ➔ 🥈No.${h2} ➔ 🥉No.${h3}`, 0, 0, 14, WestColors.GOLD_BRIGHT);
        } else {
            // WIN or PLACE
            const silkNode = new Node(`ReceiptSilk_${bet.horseNo}`);
            silkNode.layer = targetBox.layer || Layers.Enum.UI_2D;
            targetBox.addChild(silkNode);
            silkNode.setPosition(-220, 0, 0);
            silkNode.addComponent(UITransform).setContentSize(26, 26);
            WestStyle.drawHorseSilkPattern(silkNode, bet.horseNo, 26, 26);

            const prefix = bet.playType === "PLACE" ? "🛡️ 选定位置马匹" : "🏇 选定独赢马匹";
            this.text(targetBox, `${prefix}: No.${bet.horseNo} 【${getHorseName(bet.horseNo)}】`, 20, 0, 15, WestColors.GOLD_BRIGHT);
        }

        // 2.3 第一排：押注金额 & 锁定赔率
        const amountCard = this.wantedPosterBox(sheet, -145, 95, 270, 62, 6);
        this.text(amountCard, isEn ? "Wager Amount" : "押注本金", 0, 14, 12, WestColors.INK_MUTED);
        this.text(amountCard, `${this.formatMoney(bet.betAmount)} 🪙`, 0, -10, 18, WestColors.INK_DARK);

        const oddsCard = this.wantedPosterBox(sheet, 145, 95, 270, 62, 6);
        this.text(oddsCard, isEn ? "Locked Odds (Guaranteed)" : "锁定公证赔率 (保全)", 0, 14, 12, WestColors.INK_MUTED);
        this.text(oddsCard, `x${Number(bet.lockedOdds).toFixed(2)}`, 0, -10, 18, WestColors.BANDANA_RED);

        // 2.4 第二排：预估胜率 & 预期毛奖
        let winRateDisplay = "16.7%";
        if (bet.playType === "PLACE") {
            const h = this.round?.horses.find((item) => item.horseNo === bet.horseNo);
            const wr = Number(h?.winRateSnapshot ?? 0.16);
            winRateDisplay = `${Math.min(95, Math.round(wr * 2.2 * 1000) / 10).toFixed(1)}% (前二进入率)`;
        } else if (bet.playType === "QUINELLA") {
            const h1 = this.round?.horses.find((item) => item.horseNo === bet.horseNo);
            const h2 = this.round?.horses.find((item) => item.horseNo === bet.secondHorseNo);
            const w1 = Number(h1?.winRateSnapshot ?? 0.16);
            const w2 = Number(h2?.winRateSnapshot ?? 0.16);
            winRateDisplay = `${Math.max(2.5, Math.min(65, Math.round((w1 + w2) * 0.7 * 1000) / 10)).toFixed(1)}% (组合概率)`;
        } else if (bet.playType === "EXACTA") {
            const h1 = this.round?.horses.find((item) => item.horseNo === bet.horseNo);
            const h2 = this.round?.horses.find((item) => item.horseNo === bet.secondHorseNo);
            const w1 = Number(h1?.winRateSnapshot ?? 0.16);
            const w2 = Number(h2?.winRateSnapshot ?? 0.16);
            winRateDisplay = `${Math.max(0.5, Math.min(35, Math.round(w1 * w2 * 4.5 * 1000) / 10)).toFixed(1)}% (精确概率)`;
        } else if (bet.playType === "TRIFECTA") {
            const h1 = this.round?.horses.find((item) => item.horseNo === bet.horseNo);
            const h2 = this.round?.horses.find((item) => item.horseNo === bet.secondHorseNo);
            const h3 = this.round?.horses.find((item) => item.horseNo === bet.thirdHorseNo);
            const w1 = Number(h1?.winRateSnapshot ?? 0.16);
            const w2 = Number(h2?.winRateSnapshot ?? 0.16);
            const w3 = Number(h3?.winRateSnapshot ?? 0.16);
            winRateDisplay = `${Math.max(0.1, Math.min(15, Math.round(w1 * w2 * w3 * 18 * 1000) / 10)).toFixed(1)}% (千倍梦想)`;
        } else {
            const h = this.round?.horses.find((item) => item.horseNo === bet.horseNo);
            winRateDisplay = `${(Number(h?.winRateSnapshot ?? 0.16) * 100).toFixed(1)}% (独赢胜率)`;
        }

        const winRateCard = this.wantedPosterBox(sheet, -145, 18, 270, 62, 6);
        this.text(winRateCard, isEn ? "Est. Win Rate" : "📊 预估胜率 (战力概率)", 0, 14, 12, WestColors.INK_MUTED);
        this.text(winRateCard, winRateDisplay, 0, -10, 15, WestColors.INK_DARK);

        const grossCard = this.wantedPosterBox(sheet, 145, 18, 270, 62, 6);
        this.text(grossCard, isEn ? "Gross Return" : "预期毛奖 (含本金)", 0, 14, 12, WestColors.INK_MUTED);
        this.text(grossCard, `${this.formatMoney(bet.grossReward)} 🪙`, 0, -10, 17, WestColors.INK_DARK);

        // 2.5 第三排：最终获胜净派彩金额金边大横幅（重点突出！）
        const netBanner = this.woodBox(sheet, 0, -70, 570, 78, 8, WestColors.LEATHER_SADDLE, WestColors.GOLD_BRIGHT);
        this.text(netBanner, isEn ? "👑 ESTIMATED NET WINNINGS (Net Bounty) 👑" : "👑 预期最终净获胜派彩金额 (NET WINNINGS) 👑", 0, 20, 12, WestColors.GOLD_BRIGHT);
        this.text(netBanner, `+${this.formatMoney(bet.netReward)} 🪙`, 0, -7, 24, WestColors.GOLD_BRIGHT);

        // 2.6 规费扣除与公证防伪存根说明
        const feePercent = (Number(bet.feeRate) * 100).toFixed(1);
        this.text(
            sheet,
            isEn
                ? `* Platform Rake: ${this.formatMoney(bet.feeAmount)} 🪙 (${feePercent}%) · Colt Federal Notary Stamped`
                : `* 平台阶梯规费抽成已核扣: ${this.formatMoney(bet.feeAmount)} 🪙 (${feePercent}%) · 赛果公开公正`,
            0,
            -135,
            11,
            WestColors.INK_MUTED,
        );
        this.text(sheet, "🌵 赔率已被柯尔特公证署加密锁定，不受后续全服注资稀释影响 🌵", 0, -158, 11, WestColors.DESERT_SAGE);

        // 3. 底部手动关闭按钮
        this.saloonButton(
            modalBox,
            isEn ? "📜 Keep Receipt & Close (OK)" : "📜 收下票据凭证 (OK)",
            0,
            -330,
            280,
            48,
            closeModal,
            true,
            16,
        );
    }

    /** 全屏 5~8 秒超级大奖彩金雨庆典弹窗 (Progressive Mega Jackpot Visuals) */
    private showMegaJackpotCelebration(dropAmount: number): void {
        const root = this.pageRoot ?? this.node;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 235), 0);
        mask.setSiblingIndex(9999);

        // 播放超燃庆典音频组合
        WestAudio.playRaceFinishFanfare("WIN");
        WestAudio.playCopperBell("WIN");
        WestAudio.playGoldCascade("WIN");

        const grandModal = this.grandSaloonBox(mask, 0, 40, 680, 780, 20, WestColors.WOOD_DARK, WestColors.GOLD_BRIGHT);
        grandModal.setScale(new Vec3(0.4, 0.4, 1));
        tween(grandModal)
            .to(0.45, { scale: new Vec3(1.05, 1.05, 1) }, { easing: "backOut" })
            .to(0.15, { scale: new Vec3(1, 1, 1) })
            .start();

        // 顶部金匾
        const titleBox = this.chalkboardBox(grandModal, 0, 330, 640, 52, 8);
        this.text(titleBox, "💰 怀俄明全服超级巨奖爆池 💰", 0, 0, 22, WestColors.GOLD_BRIGHT);

        // 副标
        this.text(grandModal, "MEGA PROGRESSIVE JACKPOT EXPLOSION", 0, 280, 13, WestColors.TEXT_PARCHMENT);

        // 宝箱图示 / 徽记
        const chestCard = this.woodBox(grandModal, 0, 150, 600, 180, 12, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
        this.text(chestCard, "🎁 纯金宝箱破封迸发 · 璀璨彩金全场暴落 🎁", 0, 56, 17, WestColors.PARCHMENT_LIGHT);

        const amountLabelNode = this.text(chestCard, `+${this.formatMoney(dropAmount)} 🪙`, 0, -8, 42, WestColors.GOLD_BRIGHT);
        tween(amountLabelNode.node)
            .repeatForever(
                tween(amountLabelNode.node)
                    .to(0.6, { scale: new Vec3(1.1, 1.1, 1) }, { easing: "sineInOut" })
                    .to(0.6, { scale: new Vec3(1.0, 1.0, 1) }, { easing: "sineInOut" })
            )
            .start();

        this.text(chestCard, "荒野联邦骑警总署公证 · 奖池累积彩金全员共享", 0, -60, 13, WestColors.TEXT_MUTED);

        // 生成 16 枚飞溅飘落的金币颗粒动效
        for (let i = 0; i < 16; i++) {
            const coinNode = this.box(mask, 0, 150, 26, 26, WestColors.GOLD_BRIGHT, 13);
            const targetX = (Math.random() - 0.5) * 640;
            const targetY = -400 - Math.random() * 200;
            const peakY = 250 + Math.random() * 150;
            const dur = 1.6 + Math.random() * 1.2;
            const rot = (Math.random() - 0.5) * 720;
            tween(coinNode)
                .delay(i * 0.08)
                .to(dur * 0.35, { position: new Vec3(targetX * 0.4, peakY, 0) }, { easing: "sineOut" })
                .to(dur * 0.65, { position: new Vec3(targetX, targetY, 0), angle: rot }, { easing: "sineIn" })
                .call(() => {
                    coinNode.destroy();
                })
                .start();
        }

        // 普天同庆横幅
        const banner = this.wantedPosterBox(grandModal, 0, -20, 600, 90, 8);
        this.text(banner, "🎉 边境全体参战牛仔同庆 · 狂欢大彩金注入总金库 🎉", 0, 14, 16, WestColors.INK_DARK);
        this.text(banner, "好运降临，银河倾泻！本轮投注牛仔皆获享额外好运眷顾！", 0, -18, 12, WestColors.INK_MUTED);

        let isDismissed = false;
        const dismissModal = () => {
            if (isDismissed) return;
            isDismissed = true;
            tween(grandModal)
                .to(0.25, { scale: new Vec3(0.2, 0.2, 1) }, { easing: "backIn" })
                .call(() => {
                    mask.destroy();
                })
                .start();
        };

        // 狂喜收下按钮
        this.saloonButton(grandModal, "🎉 狂喜收下 (CLAIM JACKPOT)", 0, -180, 360, 56, () => {
            WestAudio.playGoldCascade("WIN");
            dismissModal();
        }, true, 19);

        // 7秒后自动收起
        this.scheduleOnce(() => {
            dismissModal();
        }, 7);
    }

    /**
     * 📰 老牛仔赛前晨报与马房情报速览弹窗 (FRONTIER RACING CHRONICLE)
     * 消除 180s 下注期无事可做痛点，提供气候适性、马匹体重晨练走势、跑法剖析与稳健/爆冷两套策略推荐。
     */
    private showMorningChronicleModal(root: Node): void {
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        mask.setSiblingIndex(9999);
        this.bindClick(mask, () => {
            WestAudio.playLeatherPress("COMMON");
            mask.destroy();
        });

        WestAudio.playLeatherPress("COMMON");
        const modal = this.grandSaloonBox(mask, 0, 0, 680, 1000, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modal, 680, 1000, () => {
            WestAudio.playLeatherPress("COMMON");
            mask.destroy();
        });

        // 1. 报刊金字大标题
        const titleBox = this.chalkboardBox(modal, 0, 455, 640, 48, 6);
        const roundNoStr = this.round?.roundNo ? this.round.roundNo.slice(-4) : `${this.round?.id ?? 1}`;
        this.text(titleBox, `📰 怀俄明赛马晨报 · #${roundNoStr} 轮 📰`, 0, 0, 20, WestColors.GOLD_BRIGHT);

        // 2. 跑道与气象通告羊皮纸
        const weatherBoard = this.wantedPosterBox(modal, 0, 375, 640, 78, 6);
        const weatherZh = this.round?.weather === "RAINY" ? "🌧️ 暴雨倾盆 (跑道泥泞沙化)" : "☀️ 晴空万里 (坚硬干燥直道)";
        const trackZh = this.round?.trackType === "TURF" ? "🌱 绿茵草地" : "🏜️ 粗砂红泥道";
        const adviceZh = this.round?.weather === "RAINY"
            ? "⚠️ 暴雨泥泞：蹄铁抓地骤降，领跑逃马容易失速，后发冲刺型与缠斗型大爆冷几率飙升！"
            : "✨ 晴朗硬道：内道起步优势极大，领跑型与跟跑型马匹胜率稳健，建议关注前列！";

        this.text(weatherBoard, `气象: ${weatherZh}  |  场地: ${trackZh}`, 0, 18, 14, WestColors.INK_DARK);
        this.text(weatherBoard, adviceZh, 0, -14, 12, WestColors.BANDANA_RED);

        // 3. 6 匹马深度情报列表卡 (展示体重走势、跑法战术与适性评级)
        const horses = this.round?.horses ?? [];
        const seed = Number(this.round?.id ?? 0);
        const cardStartY = 275;
        const cardStepY = 72;

        const ratings = ["S 级 (夺冠大热)", "A 级 (绝好调)", "B 级 (平稳)", "C 级 (待爆发)"];
        const weightDeltas = ["+2kg (肌力充盈)", "+1kg (体态轻盈)", "-1kg (状态适中)", "-3kg (略显疲惫)", "+3kg (骨架厚重)", "-2kg (蓄势待发)"];

        horses.slice(0, 6).forEach((h, idx) => {
            const cy = cardStartY - idx * cardStepY;
            const horseBox = this.woodBox(modal, 0, cy, 640, 64, 8, WestColors.WOOD_MEDIUM, WestColors.LEATHER_DARK);
            const hName = I18n.getLocale() === "en-US" && h.horseNameEnSnapshot ? h.horseNameEnSnapshot : (h.horseNameZhSnapshot ?? `名驹${h.horseNo}`);

            // 跑法原型
            const archetype = HorseController.computeArchetype(seed, h.horseNo, false);
            const style = HorseController.getArchetypeName(archetype);

            // 评级与体重伪随机生成
            const rIdx = Math.abs((seed + h.horseNo * 3) % ratings.length);
            const wIdx = Math.abs((seed + h.horseNo * 5) % weightDeltas.length);
            const ratingText = ratings[rIdx];
            const weightText = weightDeltas[wIdx];

            // 彩衣标记
            const silkNode = new Node(`Silk_Chronicle_${h.horseNo}`);
            silkNode.layer = horseBox.layer || Layers.Enum.UI_2D;
            horseBox.addChild(silkNode);
            silkNode.setPosition(-285, 0, 0);
            silkNode.addComponent(UITransform).setContentSize(24, 24);
            WestStyle.drawHorseSilkPattern(silkNode, h.horseNo, 24, 24);

            // 第一行：马名、赔率、跑法、评级
            const isFavored = (rIdx <= 1);
            const colorName = isFavored ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT;
            this.text(horseBox, `${h.horseNo}号 ${hName} · 独赢x${Number(h.odds).toFixed(2)}`, -135, 12, 14, colorName);
            this.text(horseBox, `战术: ${style.icon}【${style.name}】`, 90, 12, 13, WestColors.CHALK_YELLOW);
            this.text(horseBox, ratingText, 230, 12, 13, isFavored ? WestColors.BANDANA_RED : WestColors.PARCHMENT_LIGHT);

            // 第二行：体重晨练走势与建议
            this.text(horseBox, `晨练体重: ${weightText}  |  胜率: ${(Number(h.winRateSnapshot ?? 0.16) * 100).toFixed(1)}%`, -35, -14, 12, WestColors.TEXT_MUTED);
        });

        // 4. 老牛仔核心推荐锦囊
        const tipBox = this.chalkboardBox(modal, 0, -195, 640, 80, 8);
        const bestHorse = horses.reduce((prev, curr) => (Number(curr.odds) < Number(prev.odds) ? curr : prev), horses[0] ?? { horseNo: 1 });
        const coldHorses = [...horses].sort((a, b) => Number(b.odds) - Number(a.odds));
        const coldTop1 = coldHorses[0]?.horseNo ?? 6;
        const coldTop2 = coldHorses[1]?.horseNo ?? 5;
        const coldTop3 = coldHorses[2]?.horseNo ?? 4;

        this.text(tipBox, `⭐ 老牛仔推荐：稳健保底关注 [${bestHorse.horseNo}号马] (位置/独赢)！`, 0, 18, 14, WestColors.GOLD_BRIGHT);
        this.text(tipBox, `🔥 梦想爆冷锦囊：二连单 [${coldTop1}➔${coldTop2}] / 三重彩 [${coldTop1}➔${coldTop2}➔${coldTop3}] 千倍赔率！`, 0, -16, 13, WestColors.CHALK_YELLOW);

        // 5. 底部操作按钮
        this.saloonButton(modal, "⭐ 采用稳健推荐 (选中保底马)", -160, -280, 280, 48, () => {
            WestAudio.playSpurJingle();
            this.betMode = "PLACE";
            this.selectedHorse = bestHorse.horseNo;
            this.reinitHorsesForCurrentMode();
            mask.destroy();
            this.showToast(`已为您切换至位置保底盘：${bestHorse.horseNo}号马！`, WestColors.GOLD_BRIGHT);
            void this.show("race");
        }, true, 14);

        this.saloonButton(modal, "🔥 冲击千倍梦想 (填入三重彩)", 160, -280, 280, 48, () => {
            WestAudio.playRevolverCock();
            this.betMode = "TRIFECTA";
            this.trifectaFirstHorse = coldTop1;
            this.trifectaSecondHorse = coldTop2;
            this.trifectaThirdHorse = coldTop3;
            this.reinitHorsesForCurrentMode();
            mask.destroy();
            this.showToast(`已为您填入千倍三重彩组合：${coldTop1}➔${coldTop2}➔${coldTop3}！`, WestColors.BANDANA_RED);
            void this.show("race");
        }, true, 14);

        // 关闭按钮
        this.saloonButton(modal, "❌ 合上晨报", 0, -350, 180, 36, () => {
            WestAudio.playLeatherPress("COMMON");
            mask.destroy();
        }, false, 13);
    }

    /** 读取近期 8 期赛果冠军记录，供走势图使用。 */
    private async loadRecentHistory(): Promise<void> {
        try {
            const res = await ApiClient.get<{ items: Array<{ winnerHorseNo: number | null; isSkipped?: boolean }> }>("/api/race/history?limit=8");
            if (res.data?.items) {
                this.recentWinners = res.data.items
                    .filter((item) => !item.isSkipped && item.winnerHorseNo !== null && item.winnerHorseNo !== undefined)
                    .map((item) => item.winnerHorseNo as number);
            }
        } catch {
            // ignore network fail
        }
    }

    /** 构建西部金库与钱包流水页面 (WALK-IN VAULT)。 */
    private async buildWallet(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "none");

        const vaultBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部金库牌匾
        const titleBox = this.chalkboardBox(vaultBox, 0, 475, 660, 42, 6);
        this.text(titleBox, "💰 怀俄明富国金库 · COYOTE VAULT 💰", 0, 0, 20, WestColors.GOLD_BRIGHT);
        this.text(vaultBox, "纯金金条熔铸储备 · 柯尔特特区联邦承兑", 0, 436, 14, WestColors.TEXT_PARCHMENT);

        // 2. 核心金库大卡片
        const balanceCard = this.woodBox(vaultBox, 0, 345, 660, 120, 10, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
        this.text(balanceCard, "🪙 当前金库可用储备金", 0, 30, 16, WestColors.PARCHMENT_LIGHT);
        this.text(balanceCard, `${this.formatMoney(this.player?.balance ?? 0)} 🪙`, 0, -10, 32, WestColors.GOLD_BRIGHT);

        // 3. 快捷淘金充能 / 赏金提请按钮（通过 loadPlayer 触发服务端破产救济结算与余额同步）
        this.westernButton(
            vaultBox,
            "🌾 申领救济 / 刷新金库",
            -165,
            240,
            300,
            50,
            () => {
                void (async () => {
                    try {
                        await this.loadPlayer();
                        const relief = this.player?.relief;
                        if (relief && relief.status === "GRANTED") {
                            this.message = `🌾 破产救济金已发放到账: +${relief.amount} 🪙`;
                        } else {
                            this.message = "金库余额已同步至最新链上状态";
                        }
                        void this.show("wallet");
                    } catch (err) {
                        this.message = this.errorMessage(err, "金库同步失败");
                    }
                })();
            },
            true,
            16,
        );

        this.saloonButton(
            vaultBox,
            "🍺 前往杂货铺补给",
            165,
            240,
            300,
            50,
            () => {
                void this.show("shop");
            },
            false,
            16,
        );

        // 4. 流水小票记录
        const recordBox = this.chalkboardBox(vaultBox, 0, 175, 660, 34, 6);
        this.text(recordBox, "📜 最近金库收支流水明细 (TRANSACTIONS)", 0, 0, 16, WestColors.GOLD_BRIGHT);

        try {
            const txRes = await ApiClient.get<{
                items: Array<{
                    id: number;
                    transactionType: string;
                    amount: number;
                    balanceAfter: number;
                    referenceNo?: string;
                    createdAt?: string;
                }>;
            }>("/api/wallet/transactions?page=1&pageSize=6");

            const items = txRes.data?.items ?? [];
            if (items.length === 0) {
                this.text(vaultBox, "暂无流水记录", 0, 40, 20, WestColors.TEXT_MUTED);
            } else {
                const txY = [120, 50, -20, -90, -160, -230];
                items.slice(0, 6).forEach((tx, idx) => {
                    const y = txY[idx];
                    const isPlus = tx.amount >= 0;
                    const card = this.wantedPosterBox(vaultBox, 0, y, 660, 56, 6);
                    const tag = isPlus ? `+${this.formatMoney(tx.amount)} 🪙` : `${this.formatMoney(tx.amount)} 🪙`;
                    const color = isPlus ? WestColors.DESERT_SAGE : WestColors.BANDANA_RED;
                    this.text(card, `[${tx.transactionType}] ${tag}`, -140, 0, 16, color);
                    this.text(card, `结余: ${this.formatMoney(tx.balanceAfter)} 🪙`, 160, 0, 15, WestColors.INK_DARK);
                });
            }
        } catch {
            this.text(vaultBox, "加载流水失败", 0, 40, 20, WestColors.BANDANA_RED);
        }

        // 5. 金库信用与公证背书卡（充实下半区空间，消除180px死寂荒原）
        const trustCard = this.wantedPosterBox(vaultBox, 0, -315, 660, 54, 8);
        this.text(trustCard, "🛡️ 富国金库由怀俄明州银行公会承兑 · 资金动向全链条加密防伪", 0, 0, 13, WestColors.INK_MUTED);

        // 6. 底部返回大厅
        this.saloonButton(
            vaultBox,
            "🚪 返回大厅 (BACK)",
            0,
            -395,
            320,
            48,
            () => { void this.show("lobby"); },
            false,
            17,
        );

        // 7. 西部格言
        this.text(
            vaultBox,
            "🌵 柯尔特特区富国金库信托 · 怀俄明州银行公会特许经营 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 构建结算结果页面 (名次名单 + 冠亚军与连赢荣誉卡片 + 牛仔兑奖小票) */
    private async buildResult(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "battle");

        // 1. 赛后名册大告示板
        const isEn = I18n.getLocale() === "en-US";
        const resultBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 顶部黑板标题
        const titleBox = this.chalkboardBox(resultBox, 0, 475, 660, 42, 6);
        this.text(titleBox, isEn ? "🐎 AFTER-RACE REPORT · OFFICIAL DERBY 🐎" : "🐎 赛后结案赏金榜 · AFTER-RACE REPORT 🐎", 0, 0, isEn ? 18 : 20, WestColors.GOLD_BRIGHT);
        this.text(resultBox, isEn ? "Issued by Wyoming Notary Office · Official Derby Ledger" : "怀俄明柯尔特特区公证署签发 · 边境赛况公证名册", 0, 436, isEn ? 12 : 14, WestColors.TEXT_PARCHMENT);

        const roundId = this.resultRoundId > 0 ? this.resultRoundId : (this.round?.id ?? 0);
        if (roundId <= 0) {
            this.text(resultBox, I18n.t("result.noResult"), 0, 100, 26, WestColors.TEXT_PARCHMENT);
            this.saloonButton(resultBox, `🐎 ${I18n.t("common.backLobby")}`, 0, -255, 320, 52, () => {
                void this.show("lobby");
            }, false, 18);
            return;
        }

        try {
            const response = await ApiClient.get<{
                winnerHorseNo: number | null;
                isSkipped?: boolean;
                resultSeed?: string | null;
                resultSeedCommitment?: string | null;
                resultAlgorithmVersion?: string | null;
                results: Array<{
                    horseNo: number;
                    rank: number | null;
                    finishTime: number | null;
                    isBlackHorse: boolean;
                }>;
            }>(`/api/race/${roundId}/result`);

            // 更新近期 8 期赛果走势记录
            if (response.data.winnerHorseNo) {
                await this.loadRecentHistory();
            }

            // 防御无人下注时跳过比赛的情况
            if (!response.data.winnerHorseNo || response.data.isSkipped || response.data.results.length === 0) {
                const skipCard = this.wantedPosterBox(resultBox, 0, 350, 660, 76, 8);
                this.text(
                    skipCard,
                    `⚠️ ${I18n.t("result.skipped")}`,
                    0,
                    0,
                    22,
                    WestColors.BANDANA_RED,
                );
            } else {
                const rankResults = [...response.data.results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
                const rank1 = rankResults.find((r) => (r.rank ?? 0) === 1);
                const rank2 = rankResults.find((r) => (r.rank ?? 0) === 2);
                const winnerNo = rank1?.horseNo ?? response.data.winnerHorseNo;
                const secondNo = rank2?.horseNo;
                const quinellaCombo = (winnerNo && secondNo)
                    ? `${Math.min(winnerNo, secondNo)}-${Math.max(winnerNo, secondNo)}`
                    : null;

                // 2. 冠亚军与连赢荣誉卡片 (红领巾缎带底色 + 镀金火漆印章)
                const champCard = this.woodBox(resultBox, 0, 405, 660, 74, 12, WestColors.BANDANA_RED, WestColors.GOLD_METALLIC);

                const sealCutout = new Node("ChampWaxSealCutout");
                sealCutout.layer = champCard.layer || Layers.Enum.UI_2D;
                champCard.addChild(sealCutout);
                sealCutout.setPosition(-265, 0, 0);
                sealCutout.addComponent(UITransform).setContentSize(64, 64);
                applyWestTexture(sealCutout, WEST_TEXTURES.WAX_SEAL);

                const comboSuffix = quinellaCombo
                    ? (isEn ? ` · 🎰 Quinella: [${quinellaCombo}]` : ` · 🎰 连赢: [${quinellaCombo}]`)
                    : "";
                const champText = isEn
                    ? `🏆 1st: No.${winnerNo} | 🥈 2nd: No.${secondNo ?? "-"}${comboSuffix}`
                    : `🏆 冠: ${winnerNo}号 | 🥈 亚: ${secondNo ?? "-"}号${comboSuffix}`;
                this.text(
                    champCard,
                    champText,
                    25,
                    12,
                    isEn ? 20 : 23,
                    WestColors.GOLD_BRIGHT,
                );
                this.text(
                    champCard,
                    "WESTERN HORSE RACE WINNER & QUINELLA EST. 1888",
                    25,
                    -14,
                    13,
                    WestColors.PARCHMENT_LIGHT,
                );

                // 3. 完赛位次名册 (前三甲勋章 + 4~6名紧凑名册)
                const rank1Item = rankResults.find((r) => (r.rank ?? 0) === 1) ?? rankResults[0];
                const rank2Item = rankResults.find((r) => (r.rank ?? 0) === 2) ?? rankResults[1];
                const rank3Item = rankResults.find((r) => (r.rank ?? 0) === 3) ?? rankResults[2];

                const top3 = [
                    { medal: "🥇 冠军 1st", item: rank1Item, y: 310, bg: WestColors.LEATHER_SADDLE, border: WestColors.GOLD_METALLIC, color: WestColors.GOLD_BRIGHT },
                    { medal: "🥈 亚军 2nd", item: rank2Item, y: 272, bg: WestColors.WOOD_DARK, border: WestColors.BRASS_FRAME, color: WestColors.PARCHMENT_LIGHT },
                    { medal: "🥉 季军 3rd", item: rank3Item, y: 234, bg: WestColors.WOOD_DARK, border: WestColors.WOOD_FRAME, color: WestColors.TEXT_PARCHMENT },
                ];

                top3.forEach((t) => {
                    if (!t.item) return;
                    const rBox = this.woodBox(resultBox, 0, t.y, 660, 34, 6, t.bg, t.border);
                    const darkTag = t.item.isBlackHorse ? ` ⚡[${I18n.t("result.blackHorse")}]` : "";
                    const textStr = isEn
                        ? `${t.medal}: No.${t.item.horseNo} Steed · Time: ${Number(t.item.finishTime ?? 0).toFixed(3)}s${darkTag}`
                        : `${t.medal}: ${t.item.horseNo}号赛马 · 用时: ${Number(t.item.finishTime ?? 0).toFixed(3)}s${darkTag}`;
                    this.text(rBox, textStr, 0, 0, isEn ? 14 : 15, t.color);
                });

                // 4 ~ 6 名紧凑条目
                const others = rankResults.slice(3, 6);
                if (others.length > 0) {
                    const otherBox = this.box(resultBox, 0, 198, 660, 26, WestColors.WOOD_DARK, 4);
                    const othersStr = others.map((o, idx) => {
                        const r = o.rank ?? (idx + 4);
                        return isEn ? `${r}th: No.${o.horseNo}` : `第${r}名: ${o.horseNo}号`;
                    }).join("   |   ");
                    this.text(otherBox, othersStr, 0, 0, 12, WestColors.TEXT_MUTED);
                }
            }

            // 定向获取当前玩家在本轮的下注记录（支持多注单 Decision 1-C / 3-A）
            let myOrders: BetOrderItemDto[] = [];
            try {
                const myBetsRes = await ApiClient.get<{
                    horseNo?: number | null;
                    totalAmount?: number;
                    orders?: BetOrderItemDto[];
                }>(`/api/race/${roundId}/my-bets`);
                if (myBetsRes.data?.orders && myBetsRes.data.orders.length > 0) {
                    myOrders = myBetsRes.data.orders;
                }
            } catch {
                const betsRes = await ApiClient.get<{
                    items: BetOrderItemDto[];
                }>("/api/player/bets?page=1&pageSize=20");
                myOrders = betsRes.data.items?.filter((b) => b.roundId === roundId) ?? [];
            }

            // 重新同步最新钱包余额
            await this.loadPlayer();

            // 4. 牛仔兑奖小票卡片 (牛皮纸票根风格，严整展开5大模式全部明细)
            const ticketCard = this.wantedPosterBox(resultBox, 0, -10, 660, 330, 8);
            if (myOrders.length > 0) {
                const rankResults = [...response.data.results].sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
                const rank1 = rankResults.find((r) => (r.rank ?? 0) === 1);
                const rank2 = rankResults.find((r) => (r.rank ?? 0) === 2);
                const rank3 = rankResults.find((r) => (r.rank ?? 0) === 3);
                const actualWinner = rank1?.horseNo ?? response.data.winnerHorseNo;
                const actualSecond = rank2?.horseNo;
                const actualThird = rank3?.horseNo;
                const actualQuinella = (actualWinner && actualSecond)
                    ? `${Math.min(actualWinner, actualSecond)}-${Math.max(actualWinner, actualSecond)}`
                    : null;
                const actualTrifecta = (actualWinner && actualSecond && actualThird)
                    ? `${actualWinner}-${actualSecond}-${actualThird}`
                    : null;

                const hasBlackHorseInTop2 = Boolean(rank1?.isBlackHorse || rank2?.isBlackHorse);

                // 准确判定 5 种模式独立输赢与结算明细
                const evaluatedOrders = myOrders.map((order) => {
                    const mode = (order.playType || "WIN").toUpperCase();
                    let won = order.status === 2;
                    let modeBadge = "[🏇 独赢]";
                    let targetDesc = `${order.horseNo}号 独挑头马`;

                    if (mode === "PLACE") {
                        modeBadge = "[🛡️ 位置]";
                        targetDesc = `${order.horseNo}号 稳入前二`;
                        if (order.status === 1) {
                            won = (order.horseNo === actualWinner || order.horseNo === actualSecond);
                        }
                    } else if (mode === "QUINELLA") {
                        modeBadge = "[🎰 连赢]";
                        const combo = order.combination ?? (order.secondHorseNo ? `${Math.min(order.horseNo, order.secondHorseNo)}-${Math.max(order.horseNo, order.secondHorseNo)}` : "");
                        targetDesc = `组合[${combo}] 包揽前二`;
                        if (order.status === 1) {
                            won = Boolean(combo && actualQuinella && combo === actualQuinella);
                        }
                    } else if (mode === "EXACTA") {
                        modeBadge = "[🎯 二连单]";
                        const sH = order.secondHorseNo ?? (order.combination ? Number(order.combination.split("-")[1]) : 0);
                        targetDesc = `严选 1st:${order.horseNo} ➔ 2nd:${sH}`;
                        if (order.status === 1) {
                            won = Boolean(actualWinner && actualSecond && order.horseNo === actualWinner && sH === actualSecond);
                        }
                    } else if (mode === "TRIFECTA") {
                        modeBadge = "[👑 三重彩]";
                        const parts = order.combination ? order.combination.split("-") : [];
                        const h1 = order.horseNo;
                        const h2 = order.secondHorseNo ?? (parts[1] ? Number(parts[1]) : 0);
                        const h3 = parts[2] ? Number(parts[2]) : 0;
                        targetDesc = `严选 1st:${h1} ➔ 2nd:${h2} ➔ 3rd:${h3}`;
                        if (order.status === 1) {
                            const orderTri = `${h1}-${h2}-${h3}`;
                            won = Boolean(actualTrifecta && orderTri === actualTrifecta);
                        }
                    } else {
                        // WIN
                        modeBadge = "[🏇 独赢]";
                        targetDesc = `${order.horseNo}号 单挑夺冠`;
                        if (order.status === 1) {
                            won = Boolean(actualWinner && order.horseNo === actualWinner);
                        }
                    }

                    const isJackpot = won && (mode === "QUINELLA") && (hasBlackHorseInTop2 || order.statusReason === "WIN_JACKPOT");
                    const odds = Number(order.lockedOdds || 0);
                    const netPayout = won
                        ? (order.netReward > 0 ? order.netReward : Math.max(0, Math.round(order.betAmount * odds * 0.96 * 100) / 100))
                        : 0;

                    return { order, mode, modeBadge, targetDesc, won, isJackpot, odds, netPayout };
                });

                const wonOrders = evaluatedOrders.filter((r) => r.won);
                const isAnyWon = wonOrders.length > 0;
                const totalBet = myOrders.reduce((sum, o) => sum + o.betAmount, 0);
                const totalNet = wonOrders.reduce((sum, r) => sum + r.netPayout, 0);

                if (isAnyWon) {
                    WestAudio.playGoldCascade("COMMON");
                    WestAudio.speakCowboy("win", "COMMON");
                    this.spawnGoldFoilParticles(resultBox);
                    this.shakeScreen(240, 5);

                    // 顶部彩头横幅
                    const winBanner = this.woodBox(ticketCard, 0, 134, 620, 32, 6, WestColors.SEAL_RED, WestColors.BRASS_HIGHLIGHT);
                    this.text(winBanner, `🎉 🏆 押中赏金！总下注: ${this.formatMoney(totalBet)} 🪙 | 净派彩: +${this.formatMoney(totalNet)} 🪙 (${wonOrders.length}/${myOrders.length}注命中) 🏆 🎉`, 0, 0, isEn ? 13 : 14, WestColors.GOLD_BRIGHT);

                    // 鲜红火漆印章
                    const claimSeal = new Node("ClaimWaxSeal");
                    claimSeal.layer = ticketCard.layer || Layers.Enum.UI_2D;
                    ticketCard.addChild(claimSeal);
                    claimSeal.setPosition(260, 20, 0);
                    claimSeal.addComponent(UITransform).setContentSize(52, 52);
                    WestStyle.drawWaxSealStamp(claimSeal, 24);
                    WestMotion.playWaxStamp(claimSeal);
                } else {
                    const failMode = this.getAudioMode();
                    WestAudio.playMutedGuitar(failMode);
                    WestAudio.playHorseSnort(failMode);
                    WestAudio.speakCowboy("lose", failMode);

                    const loseBanner = this.woodBox(ticketCard, 0, 134, 620, 32, 6, WestColors.WOOD_DARK, WestColors.WOOD_FRAME);
                    this.text(loseBanner, `🌵 本轮共投 ${myOrders.length} 笔未中 · 胜败乃牛仔常事 (总下注: ${this.formatMoney(totalBet)} 🪙) 🌵`, 0, 0, isEn ? 13 : 14, WestColors.TEXT_PARCHMENT);
                }

                // 逐笔条目化展示（不截断、不缩略，5 种玩法模式标识分明）
                const displayOrders = evaluatedOrders.slice(0, 5);
                const rowYs = [95, 55, 15, -25, -65];

                displayOrders.forEach((item, idx) => {
                    const y = rowYs[idx];
                    const rowBox = this.woodBox(ticketCard, 0, y, 620, 32, 6, item.won ? WestColors.WOOD_DARK : WestColors.LEATHER_DARK, item.won ? WestColors.GOLD_METALLIC : WestColors.WOOD_FRAME);

                    // 左侧：模式勋章 + 下注目标
                    this.text(rowBox, `${item.modeBadge} ${item.targetDesc}`, -170, 0, 12, item.won ? WestColors.GOLD_BRIGHT : WestColors.TEXT_PARCHMENT, HorizontalTextAlignment.LEFT);

                    // 中间：下注金币与锁定赔率
                    this.text(rowBox, `本金:${item.order.betAmount}🪙 · x${item.odds.toFixed(1)}`, 40, 0, 11, WestColors.PARCHMENT_LIGHT, HorizontalTextAlignment.CENTER);

                    // 右侧：输赢状态与净入账
                    const statusStr = item.won
                        ? `+${this.formatMoney(item.netPayout)}🪙 ✅ 命中`
                        : `-${this.formatMoney(item.order.betAmount)}🪙 ❌ 未中`;
                    const statusColor = item.won ? WestColors.GOLD_BRIGHT : WestColors.TEXT_MUTED;
                    this.text(rowBox, statusStr, 220, 0, 12, statusColor, HorizontalTextAlignment.RIGHT);
                });

                if (evaluatedOrders.length > 5) {
                    this.text(ticketCard, `... 其余 ${evaluatedOrders.length - 5} 笔注单明细请在下方【我的注单】全量查阅`, 0, -95, 11, WestColors.INK_MUTED);
                }

                // 底部金库状态条
                this.text(
                    ticketCard,
                    isEn
                        ? `Vault Balance: ${this.formatMoney(this.player?.balance ?? 0)} 🪙 | Streak: ${this.player?.currentHitStreak ?? 0}W`
                        : `当前金库结余: ${this.formatMoney(this.player?.balance ?? 0)} 🪙  |  🎯 命中连胜: ${this.player?.currentHitStreak ?? 0}  |  💰 盈利胜局: ${this.player?.totalNetProfitWins ?? 0}`,
                    0,
                    -125,
                    isEn ? 11 : 12,
                    WestColors.INK_DARK,
                );
            } else {
                this.text(
                    ticketCard,
                    isEn ? "🤠 Spectator Mode · Frontier Derby Observed" : "🤠 本轮未押注 · 观摩边境赛况",
                    0,
                    20,
                    isEn ? 17 : 18,
                    WestColors.INK_DARK,
                );
                this.text(
                    ticketCard,
                    isEn ? "Next shootout starts soon. Pick your champion and saddle up!" : "下轮大乱斗即将打响，挑选心仪名驹撕票入场！",
                    0,
                    -12,
                    isEn ? 13 : 14,
                    WestColors.INK_MUTED,
                );
                this.text(
                    ticketCard,
                    isEn ? `🎯 Hit Streak: ${this.player?.currentHitStreak ?? 0} (Best: ${this.player?.maxHitStreak ?? 0}) | 💰 Profit Wins: ${this.player?.totalNetProfitWins ?? 0}` : `🎯 命中连胜: ${this.player?.currentHitStreak ?? 0} (最高: ${this.player?.maxHitStreak ?? 0})  |  💰 净盈利胜局: ${this.player?.totalNetProfitWins ?? 0}胜 (当前盈利连胜: ${this.player?.currentProfitStreak ?? 0})`,
                    0,
                    -40,
                    isEn ? 11 : 12,
                    WestColors.SEAL_RED,
                );
            }

            // 5. 赛果公允性透明核验按钮 (Provably Fair)
            if (response.data.resultSeedCommitment) {
                this.saloonButton(
                    resultBox,
                    `🔍 ${I18n.t("fairness.verifyBtn")} (PROVABLY FAIR)`,
                    0,
                    -165,
                    480,
                    44,
                    () => {
                        void this.buildFairnessModal(
                            root,
                            response.data.resultSeed ?? "",
                            response.data.resultSeedCommitment ?? "",
                            response.data.resultAlgorithmVersion ?? "ResultEngine-V1.2",
                        );
                    },
                    false,
                    15,
                );
            }
        } catch {
            this.text(
                resultBox,
                I18n.t("result.unsettled"),
                0,
                100,
                24,
                WestColors.BANDANA_RED,
            );
        }

        // 6. 底部双行动招牌按钮 (消除底部 240px 空白)
        const rematchBtn = this.westernButton(
            resultBox,
            isEn ? "🏇 Next Round (RACE)" : `🏇 ${I18n.t("race.startRace")} (NEXT ROUND)`,
            -165,
            -245,
            310,
            54,
            () => {
                void this.show("race");
            },
            true,
            isEn ? 16 : 18,
        );

        // [再战边陲] BANDANA_RED 高亮呼吸脉冲动效
        tween(rematchBtn)
            .repeatForever(
                tween(rematchBtn)
                    .to(0.75, { scale: new Vec3(1.05, 1.05, 1.0) }, { easing: "sineInOut" })
                    .to(0.75, { scale: new Vec3(1.0, 1.0, 1.0) }, { easing: "sineInOut" })
            )
            .start();

        this.saloonButton(
            resultBox,
            isEn ? "🐎 Back to Lobby" : `🐎 ${I18n.t("common.backLobby")} (RETURN)`,
            165,
            -245,
            310,
            54,
            () => {
                void this.show("lobby");
            },
            false,
            isEn ? 16 : 18,
        );

        // 7. 个人生涯赛后概览卡（充实下半区空间，消除193px死寂荒原）
        const recapBox = this.wantedPosterBox(resultBox, 0, -340, 660, 74, 8);
        const winRateStr = (Number(this.player?.winRate ?? 0) * 100).toFixed(1);
        this.text(recapBox, `📊 个人竞技生涯概览: 胜率 ${winRateStr}%  |  出战 ${this.player?.totalRoundsParticipated ?? 0}场  |  胜局 ${this.player?.totalRoundsWon ?? 0}场`, 0, 16, 15, WestColors.INK_DARK);
        this.text(recapBox, "每轮赛果皆受链上加密哈希校验 · 胜负结算即时写入特区账簿", 0, -14, 12, WestColors.INK_MUTED);

        // 8. 底部西部格言
        this.text(
            resultBox,
            "🌵 怀俄明柯尔特特区公证署监察 · 赛果链上不可篡改 · 恪守边陲公约 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 赛果公平性验证透明弹窗 (Provably Fair Verifier) - 西部典雅老橡木与黄铜风格。 */
    private async buildFairnessModal(
        root: Node,
        seed: string,
        commitment: string,
        algoVersion: string,
    ): Promise<void> {
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const card = this.grandSaloonBox(mask, 0, 0, 670, 720, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(card, 670, 720, () => mask.destroy());

        // 顶部黑板标题
        const titleBox = this.chalkboardBox(card, 0, 310, 630, 52, 6);
        this.text(titleBox, `🔐 ${I18n.t("fairness.title")}`, 0, 8, 22, WestColors.GOLD_BRIGHT);
        this.text(titleBox, `算法版本: ${algoVersion} · 柯尔特公证署加密体系`, 0, -14, 12, WestColors.TEXT_PARCHMENT);

        // 1. 服务端哈希承诺 (Commitment)
        this.text(card, `📜 ${I18n.t("fairness.commitment")}`, -170, 235, 15, WestColors.GOLD_BRIGHT);
        const commitBox = this.woodBox(card, 0, 195, 610, 48, 6, WestColors.WOOD_MEDIUM, WestColors.WOOD_FRAME);
        const shortCommit = commitment.length > 34 ? `${commitment.slice(0, 32)}...` : commitment;
        this.text(commitBox, shortCommit || "N/A", 0, 0, 14, WestColors.PARCHMENT_LIGHT);

        // 2. 公开随机种子 (Seed)
        this.text(card, `🎲 ${I18n.t("fairness.seed")}`, -190, 135, 15, WestColors.GOLD_BRIGHT);
        const seedBox = this.woodBox(card, 0, 95, 610, 48, 6, WestColors.WOOD_MEDIUM, WestColors.WOOD_FRAME);
        const shortSeed = seed.length > 34 ? `${seed.slice(0, 32)}...` : seed;
        this.text(seedBox, shortSeed || "N/A", 0, 0, 14, WestColors.PARCHMENT_LIGHT);

        // 验证状态牛皮纸卡片
        const statusCard = this.wantedPosterBox(card, 0, 0, 610, 70, 6);
        const statusLabel = this.text(statusCard, "点击下方按钮执行客户端原生 SHA-256 算法比对", 0, 0, 15, WestColors.INK_DARK);

        // 3. 一键校验按钮 (加急悬赏红旗招牌)
        this.westernButton(card, "⚡ 执行 SHA-256 算法核验", 0, -85, 360, 56, async () => {
            if (!seed || !commitment) {
                statusLabel.string = "⚠️ 缺少种子或承诺数据，无法核验";
                statusLabel.color = WestColors.BANDANA_RED;
                return;
            }
            try {
                statusLabel.string = I18n.t("fairness.verifying");
                const hash = await this.sha256(seed);
                if (hash.toLowerCase() === commitment.toLowerCase()) {
                    statusLabel.string = `✅ ${I18n.t("fairness.pass")} · 结果不可预知且无篡改`;
                    statusLabel.color = WestColors.DESERT_SAGE;
                    WestAudio.playGoldCascade();
                } else {
                    statusLabel.string = "❌ 核验失败：计算哈希与承诺不符！";
                    statusLabel.color = WestColors.BANDANA_RED;
                }
            } catch {
                statusLabel.string = "核验异常：当前运行环境不支持 WebCrypto";
                statusLabel.color = WestColors.BANDANA_RED;
            }
        }, true, 18);

        // 4. 关闭按钮
        this.saloonButton(card, I18n.t("fairness.close"), 0, -170, 220, 46, () => {
            mask.destroy();
        }, false, 16);

        // 5. 底部防伪告知
        this.text(card, "🌵 赛果在开赛前已由服务器加密锁定，开赛后公开种子，杜绝任何作弊 🌵", 0, -295, 12, WestColors.TEXT_MUTED);
    }

    /** 客户端 SHA-256 纯计算，利用标准 WebCrypto API。 */
    private async sha256(message: string): Promise<string> {
        if (typeof crypto !== "undefined" && crypto.subtle) {
            const msgBuffer = new TextEncoder().encode(message);
            const hashBuffer = await crypto.subtle.digest("SHA-256", msgBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
        }
        return "";
    }

    /** 每日任务页面（对标 1.png 原型 1004，荒野警长悬赏榜）。 */
    private async buildTasks(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "tasks");

        const boardBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部悬赏榜牌匾
        const titleBox = this.chalkboardBox(boardBox, 0, 475, 660, 42, 6);
        this.text(titleBox, "★ 荒野警长悬赏榜 · DAILY BOUNTIES ★", 0, 0, 20, WestColors.GOLD_BRIGHT);
        this.text(boardBox, "完成每日治安差事与赛马悬赏 · 领取丰厚金币与声望", 0, 436, 14, WestColors.TEXT_PARCHMENT);

        try {
            const response = await ApiClient.get<Array<{
                titleZh: string;
                titleEn?: string | null;
                progress: number;
                targetValue: number;
                isCompleted: boolean;
                isClaimed: boolean;
                playerDailyTaskId: number;
            }>>("/api/tasks/daily");

            const tasks = response.data ?? [];
            const taskY = [360, 268, 176, 84, -8, -100];
            tasks.slice(0, 6).forEach((task, index) => {
                const y = taskY[index];
                const taskBox = this.wantedPosterBox(boardBox, 0, y, 660, 80, 8);
                const title = I18n.getLocale() === "en-US" && task.titleEn ? task.titleEn : task.titleZh;
                this.text(taskBox, `📌 ${title}`, -120, 16, 17, WestColors.INK_DARK);

                // 进度条（牛皮底槽 + 仙人掌绿充能）
                const pct = Math.min(1, task.progress / Math.max(1, task.targetValue));
                const barW = 340;
                const fillW = Math.max(8, pct * barW);
                this.box(taskBox, -120, -16, barW, 14, WestColors.PARCHMENT_BORDER, 7);
                this.box(taskBox, -120 - barW / 2 + fillW / 2, -16, fillW, 14, WestColors.DESERT_SAGE, 7);
                this.text(taskBox, `${task.progress} / ${task.targetValue} · ${(pct * 100).toFixed(0)}%`, -120, -16, 11, WestColors.INK_DARK);

                if (task.isClaimed) {
                    const tag = this.box(taskBox, 235, 0, 130, 46, WestColors.LEATHER_DARK, 8);
                    this.text(tag, I18n.t("tasks.claimed"), 0, 0, 15, WestColors.TEXT_MUTED);
                } else if (task.isCompleted) {
                    this.westernButton(
                        taskBox,
                        this.isSubmitting ? I18n.t("common.submitting") : "领赏 (CLAIM)",
                        235,
                        0,
                        130,
                        46,
                        () => {
                            void this.claimTaskAsync(task.playerDailyTaskId);
                        },
                        true,
                        16,
                    );
                } else {
                    const tag = this.box(taskBox, 235, 0, 130, 46, WestColors.LEATHER_SADDLE, 8);
                    this.text(tag, I18n.t("tasks.inProgress"), 0, 0, 14, WestColors.GOLD_BRIGHT);
                }
            });
        } catch (error) {
            this.text(
                boardBox,
                this.errorMessage(error, I18n.t("tasks.loadFailed", "任务加载失败")),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }

        // 底部工具栏
        this.saloonButton(
            boardBox,
            `🔄 刷新差事 (SYNC)`,
            -165,
            -215,
            310,
            48,
            () => { void this.show("tasks"); },
            false,
            16,
        );
        this.saloonButton(
            boardBox,
            `🚪 返回大厅 (BACK)`,
            165,
            -215,
            310,
            48,
            () => { void this.show("lobby"); },
            false,
            16,
        );

        // 怀俄明治安官悬赏章程指导卡（充实下半区空间，消除150px死寂荒原）
        const bountyTip = this.wantedPosterBox(boardBox, 0, -315, 660, 72, 8);
        this.text(bountyTip, "📜 怀俄明治安官悬赏章程 (BOUNTY CODEX)", 0, 18, 15, WestColors.INK_DARK);
        this.text(bountyTip, "每日完成差事自动累积荒野声望 · 差事完成即刻派发金币 · 次日零点重新排查", 0, -14, 12, WestColors.INK_MUTED);

        // 西部格言
        this.text(
            boardBox,
            "🌵 怀俄明柯尔特特区治安官公署签发 · 每日零点准时更新 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 幂等领取每日任务奖励。 */
    private async claimTaskAsync(taskId: number): Promise<void> {
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;
        let succeeded = false;

        try {
            await ApiClient.post(
                `/api/tasks/daily/${taskId}/claim`,
                { idempotencyKey: this.createUuid() },
            );
            succeeded = true;
            WestAudio.playGoldCascade("COMMON");
            await this.loadPlayer();
            this.message = I18n.t("tasks.claimed");
            this.showToast(`🎉 ${this.message}`, WestColors.GOLD_BRIGHT);
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("tasks.claimFailed", "领取失败"));
            this.showToast(this.message, WestColors.BANDANA_RED);
        } finally {
            this.isSubmitting = false;
        }

        // 仅在领取成功后重建页面刷新已领状态；失败时保留当前页面，避免错误 Toast 随页面销毁而消失。
        if (succeeded) {
            await this.show("tasks");
        }
    }

    /** 渲染功勋/成就系统主界面（荒野荣誉勋衔大厅）。 */
    private async buildFeat(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "feat");

        const featBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部勋衔牌匾
        const titleBox = this.chalkboardBox(featBox, 0, 475, 660, 42, 6);
        this.text(titleBox, "★ 荒野荣誉勋衔 · ACHIEVEMENTS ★", 0, 0, 20, WestColors.GOLD_BRIGHT);

        try {
            const res = await ApiClient.get<AchievementDto[]>("/api/achievement");
            const achievements = res.data ?? [];
            const completedCount = achievements.filter((x) => x.isCompleted).length;
            const totalCount = achievements.length;

            // 进度概览卡片（复古羊皮纸卡）
            const summaryCard = this.wantedPosterBox(featBox, 0, 405, 660, 70, 8);
            this.text(summaryCard, `🎖️ 已达成成就: ${completedCount} / ${totalCount}`, -160, 0, 19, WestColors.INK_DARK);
            const allClaimed = completedCount === totalCount && achievements.every((x) => x.isClaimed);
            this.text(summaryCard, allClaimed ? I18n.t("feat.allClaimed") : `🎖️ 荣誉头衔: ${this.getFeatTitle(completedCount)}`, 160, 0, 17, WestColors.LEATHER_SADDLE);

            // 显示成就卡片列表（最多渲染 6 个）
            const featY = [322, 236, 150, 64, -22, -108];
            achievements.slice(0, 6).forEach((item, index) => {
                const y = featY[index];
                const card = this.wantedPosterBox(featBox, 0, y, 660, 78, 8);

                // 四角深色锻造生铁方钉扣件 (Forged Gunmetal Square Spikes)
                const spikeNode = new Node("CardSpikes");
                spikeNode.layer = card.layer || Layers.Enum.UI_2D;
                card.addChild(spikeNode);
                const spikeG = spikeNode.addComponent(Graphics);
                const halfW = 330;
                const halfH = 39;
                const nailOffset = 8;
                const corners = [
                    { x: -halfW + nailOffset, y: halfH - nailOffset },
                    { x: halfW - nailOffset, y: halfH - nailOffset },
                    { x: -halfW + nailOffset, y: -halfH + nailOffset },
                    { x: halfW - nailOffset, y: -halfH + nailOffset },
                ];
                for (const c of corners) {
                    spikeG.fillColor = new Color(20, 25, 30, 220);
                    spikeG.rect(c.x - 3.5, c.y - 3.5, 7, 7);
                    spikeG.fill();
                    spikeG.fillColor = WestColors.GUNMETAL;
                    spikeG.rect(c.x - 2.5, c.y - 2.5, 5, 5);
                    spikeG.fill();
                }

                // 已达成盖火漆红蜡印，未达成呈现炭笔墨线轮廓
                if (item.isCompleted || item.isClaimed) {
                    const sealNode = new Node("FeatWaxSeal");
                    sealNode.layer = card.layer || Layers.Enum.UI_2D;
                    card.addChild(sealNode);
                    sealNode.setPosition(135, 0, 0);
                    sealNode.addComponent(UITransform).setContentSize(44, 44);
                    WestStyle.drawWaxSealStamp(sealNode, 20);
                    WestMotion.playWaxStamp(sealNode);
                }

                const title = I18n.getLocale() === "en-US" && item.titleEn ? item.titleEn : item.titleZh;
                const desc = I18n.getLocale() === "en-US" && item.descriptionEn ? item.descriptionEn : item.descriptionZh;
                const badge = item.badgeName ? `[${item.badgeName}] ` : "";

                this.text(card, `${badge}${title}`, -120, 16, 17, WestColors.INK_DARK);
                this.text(card, desc, -120, -4, 12, WestColors.INK_MUTED);

                const pct = Math.min(1, item.currentProgress / Math.max(1, item.targetValue));
                const barW = 340;
                const fillW = Math.max(6, pct * barW);
                this.box(card, -120, -22, barW, 10, WestColors.PARCHMENT_BORDER, 5);
                this.box(card, -120 - barW / 2 + fillW / 2, -22, fillW, 10, WestColors.DESERT_SAGE, 5);
                this.text(card, `${item.currentProgress}/${item.targetValue} · 🪙+${item.rewardAmount}`, 100, -22, 12, WestColors.INK_DARK);

                if (item.isClaimed) {
                    const tag = this.box(card, 235, 0, 126, 44, WestColors.LEATHER_DARK, 8);
                    this.text(tag, I18n.t("feat.claimed"), 0, 0, 14, WestColors.TEXT_MUTED);
                } else if (item.isCompleted) {
                    this.westernButton(
                        card,
                        this.isSubmitting ? I18n.t("common.submitting") : "领赏 (CLAIM)",
                        235,
                        0,
                        126,
                        44,
                        () => {
                            void this.claimAchievementAsync(item.playerAchievementId);
                        },
                        true,
                        15,
                    );
                } else {
                    const tag = this.box(card, 235, 0, 126, 44, WestColors.LEATHER_SADDLE, 8);
                    this.text(tag, `${Math.floor(pct * 100)}%`, 0, 0, 15, WestColors.GOLD_BRIGHT);
                }
            });
        } catch (error) {
            this.text(
                featBox,
                this.errorMessage(error, "功勋成就加载失败"),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }

        // 底部工具栏
        this.saloonButton(
            featBox,
            `🔄 刷新勋衔 (SYNC)`,
            -165,
            -215,
            310,
            48,
            () => { void this.show("feat"); },
            false,
            16,
        );
        this.saloonButton(
            featBox,
            `🚪 返回大厅 (BACK)`,
            165,
            -215,
            310,
            48,
            () => { void this.show("lobby"); },
            false,
            16,
        );

        // 荒野勋衔授予章程指导卡（充实下半区空间，消除150px死寂荒原）
        const featTip = this.wantedPosterBox(featBox, 0, -315, 660, 68, 8);
        this.text(featTip, "🎖️ 荒野勋衔授予章程 (COMMISSION RULES)", 0, 16, 15, WestColors.INK_DARK);
        this.text(featTip, "完成连胜胜局与累计参赛可晋升勋衔 · 勋章由特区总督亲自授勋并载入史册", 0, -14, 12, WestColors.INK_MUTED);

        // 西部格言
        this.text(
            featBox,
            "🌵 荣耀属于不屈的开拓者 · 柯尔特大奖赛功勋委员会 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 幂等领取功勋成就奖励。 */
    private async claimAchievementAsync(playerAchievementId: number): Promise<void> {
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        let succeeded = false;
        try {
            const idempotencyKey = `claim:achv:${playerAchievementId}:${Date.now()}`;
            const res = await ApiClient.post<AchievementClaimResponse>(
                `/api/achievement/${playerAchievementId}/claim`,
                { idempotencyKey },
            );
            succeeded = true;
            if (this.player && res.data?.balance !== undefined) {
                this.player.balance = res.data.balance;
            }
            WestAudio.playGoldCascade("COMMON");
            this.message = `🎉 领奖成功！获得 ${res.data?.rewardAmount ?? 0} 🪙`;
            this.showToast(this.message, WestColors.GOLD_BRIGHT);
        } catch (error) {
            this.message = this.errorMessage(error, "领取奖励失败");
            this.showToast(this.message, WestColors.BANDANA_RED);
        } finally {
            this.isSubmitting = false;
        }

        // 仅在领取成功后重建页面刷新已领状态；失败时保留当前页面，避免错误 Toast 随页面销毁而消失。
        if (succeeded) {
            await this.show("feat");
        }
    }

    /** 计算功勋勋衔头衔。 */
    private getFeatTitle(completedCount: number): string {
        if (completedCount >= 10) return "传奇统帅";
        if (completedCount >= 7) return "名誉伯爵";
        if (completedCount >= 4) return "百战骑士";
        if (completedCount >= 1) return "见习骑手";
        return "平民新秀";
    }

    /** 显示好友邀请与裂变返佣弹窗（对标 1.png 邀请体系并闭环负盈利抽成与主动提炼）。 */
    private async showReferralModal(): Promise<void> {
        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modal = this.grandSaloonBox(mask, 0, 0, 660, 880, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modal, 660, 880, () => mask.destroy());

        // 顶部黑板标题牌匾
        const titleBox = this.chalkboardBox(modal, 0, 400, 620, 44, 6);
        this.text(titleBox, `👥 边境悬赏招募令 · 好友引流与负盈利返佣 👥`, 0, 0, 19, WestColors.GOLD_BRIGHT);

        try {
            const res = await ApiClient.get<ReferralSummaryDto>("/api/player/referral");
            const data = res.data;
            const code = data?.inviteCode ?? "RG8888";

            // 1. 专属邀请码卡片 (边境电报打孔纸带样式 Telegraph Ticker Tape)
            const codeCard = new Node("TelegraphCodeCard");
            codeCard.layer = modal.layer || Layers.Enum.UI_2D;
            modal.addChild(codeCard);
            codeCard.setPosition(0, 305, 0);
            codeCard.addComponent(UITransform).setContentSize(600, 95);
            WestStyle.drawTelegraphTape(codeCard, 600, 95);

            this.text(codeCard, "★ 边境电报加密招募令 · TELEGRAPH CODE ★", 0, 24, 15, WestColors.INK_BROWN);
            this.text(codeCard, code, -100, -14, 30, WestColors.BANDANA_RED);
            this.saloonButton(codeCard, "📋 复制电报码", 150, -14, 160, 46, () => {
                WestAudio.playTelegraphBeep();
                try {
                    if (typeof navigator !== "undefined" && navigator.clipboard) {
                        void navigator.clipboard.writeText(code);
                    }
                } catch {
                    // ignore
                }
                this.message = I18n.t("referral.copied", "电报码已复制到剪贴板");
                mask.destroy();
                void this.show(this.page);
            }, true, 16);

            // 2. 下级负盈利抽成与可提炼佣金专区 (千分之5: 0.5% + 赛事规费率，同局押注防对冲跳过)
            const commissionCard = this.woodBox(modal, 0, 145, 600, 160, 8, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
            this.text(commissionCard, "💰 边境暗桩分红 · 下级负盈利抽成 (COMMISSION)", 0, 56, 16, WestColors.GOLD_BRIGHT);

            const unclaimed = Number(data?.unclaimedCommissionAmount ?? 0);
            const claimedTotal = Number(data?.totalClaimedCommissionAmount ?? 0);
            const rateDesc = data?.commissionRateDescription ?? "0.5% (千分之5) + 赛事规费率";

            this.text(commissionCard, `待提炼佣金: ${this.formatMoney(unclaimed)} 🪙`, -120, 16, 20, WestColors.GOLD_BRIGHT);
            this.text(commissionCard, `累计已提炼: ${this.formatMoney(claimedTotal)} 🪙`, 130, 16, 16, WestColors.PARCHMENT_LIGHT);
            this.text(commissionCard, `抽成比例: 固定 ${rateDesc} · 下级净亏损时计提 (同局共同押注防对冲跳过)`, 0, -18, 12, WestColors.PARCHMENT_LIGHT);

            // 一键提炼按钮
            this.westernButton(
                commissionCard,
                unclaimed > 0 ? `🚀 一键提炼未结佣金 (+${this.formatMoney(unclaimed)}🪙)` : "⏳ 暂无可提炼佣金",
                0,
                -52,
                420,
                40,
                () => {
                    if (unclaimed <= 0) {
                        this.message = "当前没有可提炼的佣金";
                        return;
                    }
                    void (async () => {
                        try {
                            const claimRes = await ApiClient.post<ClaimCommissionResponse>("/api/player/referral/claim", {});
                            if (claimRes.data?.newBalance !== undefined && this.player) {
                                this.player.balance = claimRes.data.newBalance;
                            }
                            this.message = `🎉 提炼成功！已将 ${this.formatMoney(claimRes.data?.claimedAmount ?? unclaimed)} 🪙 佣金提取至钱包金库！`;
                            mask.destroy();
                            void this.showReferralModal();
                        } catch (err) {
                            this.message = this.errorMessage(err, "提炼佣金失败");
                        }
                    })();
                },
                unclaimed > 0,
                15,
            );

            // 3. 邀请战绩统计卡片
            const statsCard = this.wantedPosterBox(modal, 0, -20, 600, 75, 8);
            this.text(statsCard, `🤠 已招募下级牛仔: ${data?.invitedCount ?? 0} 人`, -140, 0, 17, WestColors.INK_DARK);
            this.text(statsCard, `🎁 注册引流首充礼: ${this.formatMoney(data?.totalRewardAmount ?? 0)} 🪙`, 140, 0, 16, WestColors.DESERT_SAGE);

            // 4. 绑定引荐人表单
            if (!data?.referredByPlayerId) {
                const bindCard = this.wantedPosterBox(modal, 0, -135, 600, 110, 8);
                this.text(bindCard, "🤝 补填引荐人招募令 (首次绑定立享 200 🪙 启程赏金)", 0, 32, 15, WestColors.INK_DARK);
                const input = this.input(bindCard, I18n.t("referral.bindPlaceholder", "输入好友邀请码"), -90, -15, 260, 44, "");
                this.saloonButton(bindCard, "绑定并领赏", 150, -15, 140, 44, () => {
                    const friendCode = input.string.trim();
                    if (friendCode) {
                        mask.destroy();
                        void this.bindReferralAsync(friendCode);
                    }
                }, true, 15);
            } else {
                const bindDoneCard = this.woodBox(modal, 0, -120, 600, 50, 6, WestColors.WOOD_DARK, WestColors.DESERT_SAGE);
                this.text(bindDoneCard, "✅ 您已绑定引荐人，200 🪙 启程赏金已入账", 0, 0, 16, WestColors.GOLD_BRIGHT);
            }

            // 5. 规则告示黑板
            const ruleCard = this.chalkboardBox(modal, 0, -235, 600, 76, 6);
            this.text(ruleCard, "📌 规则公报：当下级投注产生净亏损时，系统按千分之5加规费率全额拨入可提炼池；", 0, 16, 12, WestColors.CHALK_YELLOW);
            this.text(ruleCard, "为防对冲刷佣，邀请人与被邀请人若在同一局同时下注，该局将跳过计提佣金！", 0, -14, 12, WestColors.CHALK_YELLOW);
        } catch {
            this.text(modal, "加载邀请信息失败", 0, 0, 20, WestColors.SEAL_RED);
        }

        // 关闭按钮
        this.saloonButton(modal, "🚪 离开招募署 (CLOSE)", 0, -355, 240, 50, () => {
            mask.destroy();
        }, false, 17);
    }

    /** 提交绑定好友推荐人。 */
    private async bindReferralAsync(inviteCode: string): Promise<void> {
        if (this.isSubmitting) return;
        this.isSubmitting = true;
        try {
            const idempotencyKey = `bind:ref:${this.player?.playerId}:${Date.now()}`;
            const res = await ApiClient.post<{ success: boolean; noviceBonus: number; newBalance: number; referrerNickname: string }>(
                "/api/player/referral/bind",
                { inviteCode, idempotencyKey },
            );
            if (this.player && res.data?.newBalance !== undefined) {
                this.player.balance = res.data.newBalance;
            }
            this.message = `🎉 成功绑定好友 [${res.data?.referrerNickname ?? ""}]，已发放 ${res.data?.noviceBonus ?? 200} 🪙 新手礼包！`;
            await this.show(this.page);
        } catch (error) {
            this.message = this.errorMessage(error, "绑定邀请码失败");
            await this.show(this.page);
        } finally {
            this.isSubmitting = false;
        }
    }

    /** 获取天气国际化展示文本。 */
    private getWeatherText(weather?: string): string {
        switch (weather?.toUpperCase()) {
            case "RAINY": return I18n.t("race.weatherRainy");
            case "CLOUDY": return I18n.t("race.weatherCloudy");
            case "SUNNY":
            default: return I18n.t("race.weatherSunny");
        }
    }

    /** 获取赛道类型国际化展示文本。 */
    private getTrackText(trackType?: string): string {
        switch (trackType?.toUpperCase()) {
            case "DIRT": return I18n.t("race.trackDirt");
            case "SAND": return I18n.t("race.trackSand");
            case "TURF":
            default: return I18n.t("race.trackTurf");
        }
    }

    /** 马场页面，支持纯血马房、幼驹认领、名驹赞助与谱系名录四大模块。 */
    private async buildStable(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "stable");

        if (this.selectedHorseCatalogId !== null) {
            await this.buildHorseDetailModal(root, this.selectedHorseCatalogId);
            return;
        }

        const stableBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部马场牌匾
        const titleBox = this.chalkboardBox(stableBox, 0, 476, 660, 38, 6);
        this.text(titleBox, "🐴 柯尔特边境纯血马房与公会 · HORSE RANCH 🐴", 0, 0, 19, WestColors.GOLD_BRIGHT);

        // 2. 四大子标签栏 (区分模式三纯血马房与模式一公开赛场赞助)
        // 第一行：模式三专属纯血马房养成系统
        this.saloonButton(
            stableBox,
            "🐴 [自营马房] 纯血马房 (RANCH)",
            -160,
            434,
            300,
            32,
            () => {
                this.stableTab = "MY_RANCH";
                void this.show("stable");
            },
            this.stableTab === "MY_RANCH",
            12,
        );
        this.saloonButton(
            stableBox,
            "🏪 [自营马房] 幼驹认领所 (NURSERY)",
            160,
            434,
            300,
            32,
            () => {
                this.stableTab = "NURSERY";
                void this.show("stable");
            },
            this.stableTab === "NURSERY",
            12,
        );
        // 第二行：模式一公开赛场1~6号名驹赞助与图鉴
        this.saloonButton(
            stableBox,
            "🪙 [赛场公马] 名驹分红赞助 (SPONSOR)",
            -160,
            396,
            300,
            32,
            () => {
                this.stableTab = "SPONSOR";
                void this.show("stable");
            },
            this.stableTab === "SPONSOR",
            12,
        );
        this.saloonButton(
            stableBox,
            "📜 [赛场公马] 1~6号名录 (CATALOG)",
            160,
            396,
            300,
            32,
            () => {
                this.stableTab = "CATALOG";
                void this.show("stable");
            },
            this.stableTab === "CATALOG",
            12,
        );

        this.text(
            stableBox,
            "💡 说明:【自营马房】为玩家专属纯血马养成与巡回赛体系；【赛场公马】为大厅极速竞猜出战公马与分红赞助",
            0,
            368,
            11,
            WestColors.GOLD_METALLIC,
        );

        if (this.stableTab === "MY_RANCH") {
            await this.buildMyRanchView(stableBox);
        } else if (this.stableTab === "NURSERY") {
            await this.buildNurseryView(stableBox);
        } else if (this.stableTab === "CATALOG") {
            await this.buildLegacyCatalogView(stableBox);
        } else {
            await this.buildLegacySponsorView(stableBox);
        }

        // 底部工具栏
        this.saloonButton(
            stableBox,
            "🚪 返回大厅 (BACK)",
            0,
            -440,
            320,
            40,
            () => { void this.show("lobby"); },
            false,
            16,
        );

        this.text(
            stableBox,
            "🌵 纯正怀俄明荒野纯血 · 科学喂养 潜能训练 资格考核 荣耀出赛 🌵",
            0,
            -476,
            13,
            WestColors.TEXT_MUTED,
        );
    }

    /** 绘制五维潜能进度条。 */
    private drawStatBar(parent: Node, label: string, current: number, potential: number, x: number, y: number, width = 280): void {
        this.text(parent, `${label} ${current.toFixed(1)} / ${potential.toFixed(1)}`, x - width / 2, y + 10, 12, WestColors.INK_DARK, HorizontalTextAlignment.LEFT);
        // 背景底槽
        this.box(parent, x, y - 2, width, 8, WestColors.WOOD_DARK, 4);
        // 潜能上限条
        const potRatio = Math.min(1, Math.max(0, potential / 100));
        const potWidth = Math.max(4, width * potRatio);
        this.box(parent, x - (width - potWidth) / 2, y - 2, potWidth, 8, WestColors.DESERT_SAGE, 4);
        // 当前属性条
        const curRatio = Math.min(1, Math.max(0, current / 100));
        const curWidth = Math.max(4, width * curRatio);
        this.box(parent, x - (width - curWidth) / 2, y - 2, curWidth, 8, WestColors.GOLD_BRIGHT, 4);
    }

    /** 模式三：我的纯血马房主视图。 */
    private async buildMyRanchView(stableBox: Node): Promise<void> {
        try {
            const res = await ApiClient.get<{ horses: RanchHorseDto[] }>("/api/ranch/my-horses");
            const horses = res.data?.horses ?? [];

            if (horses.length === 0) {
                const emptyCard = this.wantedPosterBox(stableBox, 0, 100, 660, 300, 10);
                this.text(emptyCard, "🐴 您的纯血马房暂无入厩赛马", 0, 80, 22, WestColors.INK_DARK);
                this.text(emptyCard, "在怀俄明公会，每位马主皆可建立专属纯血马房，", 0, 35, 15, WestColors.INK_MUTED);
                this.text(emptyCard, "通过粗精饲料科学投喂、四大骑术训练、理疗医护与马具装配，", 0, 5, 14, WestColors.INK_MUTED);
                this.text(emptyCard, "挑战 400m 资格考核执照，参与正式官方德比大奖赛！", 0, -25, 14, WestColors.INK_MUTED);

                this.saloonButton(
                    emptyCard,
                    "🏪 前往幼驹认领所 (NURSERY) ➔",
                    0,
                    -85,
                    320,
                    48,
                    () => {
                        this.stableTab = "NURSERY";
                        void this.show("stable");
                    },
                    true,
                    16,
                );
                return;
            }

            // 确保有选中的赛马
            if (this.selectedRanchHorseId === null || !horses.some((h) => h.id === this.selectedRanchHorseId)) {
                this.selectedRanchHorseId = horses[0].id;
            }

            // 1. 水平马匹切换选择栏 (Y = 352)
            const horseBar = this.box(stableBox, 0, 352, 660, 38, WestColors.WOOD_DARK, 6);
            horses.slice(0, 4).forEach((h, idx) => {
                const posX = -220 + idx * 125;
                const isSelected = h.id === this.selectedRanchHorseId;
                this.saloonButton(
                    horseBar,
                    `${h.customName.slice(0, 5)}`,
                    posX,
                    0,
                    118,
                    30,
                    () => {
                        this.selectedRanchHorseId = h.id;
                        void this.show("stable");
                    },
                    isSelected,
                    12,
                );
            });

            // 右侧添加快速添置幼驹按钮
            this.saloonButton(
                horseBar,
                "+ 添置幼驹",
                260,
                0,
                96,
                30,
                () => {
                    this.stableTab = "NURSERY";
                    void this.show("stable");
                },
                false,
                12,
            );

            // 2. 获取当前选中的马匹详情
            const detailRes = await ApiClient.get<RanchHorseDto>(`/api/ranch/horses/${this.selectedRanchHorseId}`);
            const horse = detailRes.data;

            // 3. 卡片 A: 赛马身份与生涯战绩 (Y = 250, H = 125)
            const profileCard = this.wantedPosterBox(stableBox, 0, 250, 660, 125, 8);
            const genderStr = horse.gender === "STALLION" ? "♂ 牡马" : "♀ 牝马";
            const stageNames: Record<string, string> = {
                FOAL: "幼驹期 🍼",
                JUVENILE: "青年期 🌱",
                MATURE: "成年期 🏇",
                PRO_RACER: "职业赛马 🏅",
            };
            const stageStr = stageNames[horse.growthStage] || horse.growthStage;
            const tierNames: Record<string, string> = {
                WILD: "荒野改良",
                PLAINS_TB: "平原纯血",
                ROYAL: "皇家纯血",
                MYTHIC: "传说名驹 ★★★",
            };
            const tierStr = tierNames[horse.pedigreeTier] || horse.pedigreeTier;

            // 专属 2D 写实赛马活体展示区 (Ranch2DHorseLiveStage)
            const horseStageNode = new Node("Ranch2DHorseLiveStage");
            horseStageNode.layer = profileCard.layer || Layers.Enum.UI_2D;
            profileCard.addChild(horseStageNode);
            horseStageNode.setPosition(-265, -5, 0);
            horseStageNode.addComponent(UITransform).setContentSize(96, 96);

            // 怀俄明原木马厩底托与草坪
            const hsg = horseStageNode.addComponent(Graphics);
            hsg.fillColor = new Color(74, 52, 38, 220);
            hsg.roundRect(-46, -46, 92, 92, 6);
            hsg.fill();
            hsg.fillColor = new Color(135, 155, 95, 230);
            hsg.roundRect(-42, -42, 84, 84, 4);
            hsg.fill();
            hsg.strokeColor = WestColors.BRASS_FRAME;
            hsg.lineWidth = 1.6;
            hsg.roundRect(-42, -42, 84, 84, 4);
            hsg.stroke();

            // 挂载写实 2D 赛马表现组件（依马匹特征与成长形态呈现，带待机呼吸律动）
            const horseNo = (Math.abs(Number(this.selectedRanchHorseId || 1) - 1) % 12) + 1;
            const liveVisual = horseStageNode.addComponent(HorseVisual2D);
            liveVisual.setHorseNo(horseNo);
            liveVisual.setAction("Stand", 0.8);

            // 点击该展示区直接打开三视图与油画大图
            const stageBtn = horseStageNode.addComponent(Button);
            stageBtn.node.on(Button.EventType.CLICK, () => {
                HorseGalleryModal.show(horseNo, this.node);
            }, this);

            // 文字信息调整排版（X = -45 起始）
            this.text(profileCard, `🏇 ${horse.customName} (${horse.horseCode}) · [${tierStr}] · ${stageStr}`, -45, 36, 16, WestColors.INK_DARK);
            const trialBest = horse.qualificationTime ? `${Number(horse.qualificationTime).toFixed(2)}s` : "尚未考核";
            this.text(profileCard, `性别: ${genderStr} · 毛色: ${horse.coatColor} · 最佳400m: ${trialBest}`, -45, 10, 13, WestColors.INK_MUTED);
            this.text(profileCard, `战绩: ${horse.totalCareerRaces}战 ${horse.totalCareerWins}胜 · 赢得总奖金: ${this.formatMoney(horse.accumulatedPurse)} 🪙`, -45, -14, 13, WestColors.DESERT_SAGE);
            const statusNotice = horse.subStatus === "SICK" || horse.subStatus === "COLIC"
                ? "⚠️ 积食腹痛！需理疗草本泥敷！"
                : horse.subStatus === "INJURED"
                ? "⚠️ 蹄腿损伤！急需专业钉蹄！"
                : horse.subStatus === "RETIRED"
                ? "🏛️ 已退役入库"
                : "✅ 状态健旺";
            this.text(profileCard, `公会状态: ${statusNotice}`, -45, -38, 12, horse.subStatus === "IDLE" || horse.subStatus === "HEALTHY" ? WestColors.INK_MUTED : WestColors.BANDANA_RED);

            // 资格赛徽章与三视图图鉴入口
            const badgeBox = this.chalkboardBox(profileCard, 240, 10, 140, 75, 8);
            if (horse.isLicensedRacer) {
                this.text(badgeBox, "🏅", 0, 16, 24, WestColors.GOLD_BRIGHT);
                this.text(badgeBox, "执照已签发", 0, -8, 12, WestColors.GOLD_BRIGHT);
                this.text(badgeBox, horse.licenseCertCode ?? "职业资质", 0, -24, 10, WestColors.PARCHMENT_LIGHT);
            } else {
                this.text(badgeBox, "⏳", 0, 16, 24, WestColors.INK_MUTED);
                this.text(badgeBox, "尚未通过考核", 0, -8, 12, WestColors.BANDANA_RED);
                this.text(badgeBox, "需跑进 24.50s", 0, -24, 10, WestColors.PARCHMENT_LIGHT);
            }

            // 养马 2D 古典画作与解剖三视图入口按钮
            this.saloonButton(
                profileCard,
                "🖼️ 查看2D画作与三视图",
                240,
                -42,
                140,
                24,
                () => {
                    HorseGalleryModal.show(horseNo, this.node);
                },
                false,
                11
            );

            // 4. 卡片 B: 五维潜能属性面板 (Y = 112, H = 125)
            const statsCard = this.wantedPosterBox(stableBox, 0, 112, 660, 125, 8);
            this.text(statsCard, "📊 五维竞技潜能 (当前实值 / 潜能上限)", 0, 44, 14, WestColors.INK_DARK);
            // 左列
            this.drawStatBar(statsCard, "⚡ 速度", Number(horse.speedStat), Number(horse.speedPotential), -160, 16, 280);
            this.drawStatBar(statsCard, "🏃 耐力", Number(horse.staminaStat), Number(horse.staminaPotential), -160, -22, 280);
            // 右列
            this.drawStatBar(statsCard, "💥 爆发", Number(horse.burstStat), Number(horse.burstPotential), 160, 16, 280);
            this.drawStatBar(statsCard, "🌪️ 柔韧", Number(horse.agilityStat), Number(horse.agilityPotential), 160, -22, 280);

            // 5. 卡片 C: 生理代谢与装备 (Y = -22, H = 120)
            const bioCard = this.wantedPosterBox(stableBox, 0, -22, 660, 120, 8);
            const colicWarn = horse.hungerLevel >= 85 ? " (饱腹过高⚠️)" : "";
            const fatigueWarn = horse.staminaEnergy <= 20 ? " (体力匮乏⚠️)" : "";
            this.text(bioCard, `🌾 饱腹: ${horse.hungerLevel}/100${colicWarn} · ⚡ 体力: ${horse.staminaEnergy}/100${fatigueWarn} · 💖 状态: ${horse.conditionLevel}/100`, 0, 36, 13, WestColors.INK_DARK);
            this.text(bioCard, `🛡️ 蹄铁磨损: ${horse.hoofWear}/100 · ❤️ 健康: ${horse.healthPoints}/100 · 🤝 亲密度: ${horse.intimacyLevel}/100`, 0, 12, 13, WestColors.INK_DARK);

            // 装备槽
            const saddleName = horse.saddleItemId ? "已装配" : "空置";
            const stirrupName = horse.stirrupItemId ? "已装配" : "空置";
            const shoeName = horse.horseshoeItemId ? "已装配" : "空置";
            this.text(bioCard, `🛡️ 马鞍: [${saddleName}]  |  🦿 马镫: [${stirrupName}]  |  🧲 蹄铁: [${shoeName}]`, 0, -18, 13, WestColors.LEATHER_SADDLE);
            this.text(bioCard, "装备马具可全方位激活速度、耐力与稳定性加成", 0, -38, 11, WestColors.INK_MUTED);

            // 6. 核心操作交互按钮组 (两排)
            // 第一排 (Y = -110): 投喂、训练、医护
            this.saloonButton(
                stableBox,
                "🌾 粗精投喂",
                -210,
                -110,
                200,
                38,
                () => { void this.openRanchFeedModal(horse); },
                true,
                14,
            );
            this.saloonButton(
                stableBox,
                "🏇 四大训练",
                0,
                -110,
                200,
                38,
                () => { void this.openRanchTrainModal(horse); },
                true,
                14,
            );
            this.saloonButton(
                stableBox,
                "🛁 理疗医护",
                210,
                -110,
                200,
                38,
                () => { void this.openRanchCareModal(horse); },
                false,
                14,
            );

            // 第二排 (Y = -158): 马具装配、400m试跑、公会回购
            this.saloonButton(
                stableBox,
                "🛡️ 马具装配",
                -210,
                -158,
                200,
                38,
                () => { void this.openRanchEquipModal(horse); },
                false,
                14,
            );
            this.saloonButton(
                stableBox,
                "⏱️ 400m资格试跑",
                0,
                -158,
                200,
                38,
                () => { this.openRanchTrialModal(horse); },
                !horse.isLicensedRacer,
                14,
            );
            this.saloonButton(
                stableBox,
                "🏷️ 公会保底回购",
                210,
                -158,
                200,
                38,
                () => { this.openRanchBuybackModal(horse); },
                false,
                14,
            );

            // 西部培育指南小卡 (Y = -215)
            const guideBox = this.wantedPosterBox(stableBox, 0, -215, 660, 52, 6);
            this.text(guideBox, "💡 边境马主须知: 投喂粗饲料增加饱腹，精饲料强化体能，但连续饱食将引发积食 Colic！", 0, 8, 12, WestColors.INK_DARK);
            this.text(guideBox, "四大专项训练受马匹潜能极限约束，过度训练会积累疲劳，试跑跑进 24.50 秒即可获得出赛执照！", 0, -10, 11, WestColors.INK_MUTED);

        } catch (err) {
            this.text(stableBox, this.errorMessage(err, "纯血马房加载失败"), 0, 50, 18, WestColors.BANDANA_RED);
        }
    }

    /** 模式三：幼驹认领所 (NURSERY)。从数据库动态目录加载。 */
    private async buildNurseryView(stableBox: Node): Promise<void> {
        const nurseryIntro = this.chalkboardBox(stableBox, 0, 350, 660, 44, 6);
        this.text(nurseryIntro, "🏪 怀俄明公会纯血幼驹认领所 · 挑选血统基因并命名入厩", 0, 0, 15, WestColors.GOLD_BRIGHT);

        const catalog = await this.fetchRanchCatalog();
        const tiers = catalog?.foalTiers && catalog.foalTiers.length > 0
            ? catalog.foalTiers.map((t, idx) => {
                const randomNames = t.randomNames && t.randomNames.length > 0
                    ? t.randomNames
                    : ["疾风猎手", "荒野之火", "雷霆印第安", "黄金狂飙", "黑夜幽灵", "银鞍骑士", "暴风追逐者"];
                return {
                    tier: t.tierCode,
                    name: t.tierNameZh,
                    price: Number(t.adoptPrice),
                    potential: `${Number(t.minPotential)} ~ ${Number(t.maxPotential)}`,
                    desc: t.descriptionZh || `基础属性: 速度${t.baseSpeed}/耐力${t.baseStamina}/爆发${t.baseBurst}`,
                    y: 260 - idx * 105,
                    randomNames,
                };
            })
            : [
                {
                    tier: "WILD",
                    name: "普罗旺斯混血幼驹",
                    price: 1000,
                    potential: "50 ~ 65",
                    desc: "边境常见的耐劳品种，适应力极强，是新手马主的坚实起点。",
                    y: 260,
                    randomNames: ["疾风猎手", "荒野之火", "雷霆印第安"],
                },
                {
                    tier: "PLAINS_TB",
                    name: "肯塔基良种幼驹",
                    price: 3000,
                    potential: "65 ~ 78",
                    desc: "骨骼精壮步伐矫健，在起跑爆发与冲刺速度上具备优异天赋。",
                    y: 155,
                    randomNames: ["黄金狂飙", "黑夜幽灵", "银鞍骑士"],
                },
                {
                    tier: "ROYAL",
                    name: "阿拉伯纯血良驹",
                    price: 8000,
                    potential: "78 ~ 90",
                    desc: "优雅体态与惊人肺活量，耐力超群，长途德比赛道的主宰者。",
                    y: 50,
                    randomNames: ["暴风追逐者", "红鬃闪电", "狂澜独角兽"],
                },
                {
                    tier: "MYTHIC",
                    name: "怀俄明传说纯血神驹",
                    price: 20000,
                    potential: "90 ~ 100",
                    desc: "荒野淬炼的旷世神驹，五维潜能接近甚至达到巅峰极值！",
                    y: -55,
                    randomNames: ["终焉天谴", "无冕之王", "北极星辉"],
                },
            ];

        let busy = false;
        tiers.forEach((item) => {
            const card = this.wantedPosterBox(stableBox, 0, item.y, 660, 92, 8);

            // 幼驹 2D 活体徽章节点（点击查看小马驹三视图与成长发育）
            const foalIconNode = new Node("Foal2DIcon");
            foalIconNode.layer = card.layer || Layers.Enum.UI_2D;
            card.addChild(foalIconNode);
            foalIconNode.setPosition(-275, 0, 0);
            foalIconNode.addComponent(UITransform).setContentSize(56, 56);
            const fg = foalIconNode.addComponent(Graphics);
            fg.fillColor = WestColors.WOOD_DARK;
            fg.circle(0, 0, 26);
            fg.fill();
            fg.fillColor = new Color(195, 160, 110, 240);
            fg.circle(0, 0, 22);
            fg.fill();
            fg.strokeColor = WestColors.GOLD_METALLIC;
            fg.lineWidth = 1.6;
            fg.circle(0, 0, 22);
            fg.stroke();
            this.text(foalIconNode, "🍼", 0, 0, 18);
            const foalBtn = foalIconNode.addComponent(Button);
            foalBtn.node.on(Button.EventType.CLICK, () => {
                HorseGalleryModal.show(1, this.node);
            }, this);

            this.text(card, `🐴 ${item.name} (${item.tier})`, -95, 24, 16, WestColors.INK_DARK);
            this.text(card, `潜能基线: ${item.potential} · 描述: ${item.desc}`, -95, -2, 12, WestColors.INK_MUTED);
            this.text(card, `公会官方标价: ${this.formatMoney(item.price)} 🪙`, -95, -24, 13, WestColors.GOLD_METALLIC);

            this.saloonButton(
                card,
                `认领入厩 (${item.price}🪙)`,
                210,
                0,
                180,
                46,
                async () => {
                    if (busy) return;
                    busy = true;
                    try {
                        const randomNames = item.randomNames;
                        const defaultName = randomNames[Math.floor(Math.random() * randomNames.length)];
                        const adoptRes = await ApiClient.adoptFoal(defaultName, item.tier);
                        if (adoptRes.data?.id) {
                            this.selectedRanchHorseId = adoptRes.data.id;
                        }
                        this.showToast(`🎉 恭喜成功认购【${defaultName}】入厩纯血马房！`, WestColors.GOLD_BRIGHT);
                        WestAudio.playGoldCascade("COMMON");
                        WestAudio.playHorseNeigh("COMMON");
                        await this.loadPlayer();
                        this.stableTab = "MY_RANCH";
                        void this.show("stable");
                    } catch (err) {
                        this.showToast(this.errorMessage(err, "认领失败"), WestColors.BANDANA_RED);
                    } finally {
                        busy = false;
                    }
                },
                item.price >= 8000,
                13,
            );
        });

        // 底部提示
        const tipCard = this.wantedPosterBox(stableBox, 0, -165, 660, 56, 6);
        this.text(tipCard, "📜 认领后幼驹将获得唯一编号与不可篡改的血统基因档案，认领款项扣除归入公会奖池。", 0, 0, 13, WestColors.INK_DARK);
    }

    /** 弹窗：投喂饲料 (FEED)。从数据库动态目录加载。 */
    private async openRanchFeedModal(horse: RanchHorseDto): Promise<void> {
        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 680, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 680, () => mask.destroy());

        this.text(modalBox, `🌾 为【${horse.customName}】选配草粮`, 0, 290, 22, WestColors.GOLD_BRIGHT);
        this.text(modalBox, `当前饱腹: ${horse.hungerLevel}/100 · 状态: ${horse.conditionLevel}/100`, 0, 255, 14, WestColors.PARCHMENT_LIGHT);

        const catalog = await this.fetchRanchCatalog();
        const feedY = [170, 75, -20, -115];
        const feeds = catalog?.feeds && catalog.feeds.length > 0
            ? catalog.feeds.slice(0, 4).map((f) => ({
                type: f.feedCode,
                name: `${f.feedCategory === "CONCENTRATE" ? "🌽" : "🌾"} ${f.feedNameZh} (${f.feedCategory === "CONCENTRATE" ? "精饲料" : "粗饲料"})`,
                cost: Number(f.coinCost),
                sat: Number(f.hungerFill),
                exp: Number(f.expGain),
                desc: f.descriptionZh || `饱腹+${f.hungerFill} EXP+${f.expGain}`,
            }))
            : [
                { type: "FEED_TIMOTHY", name: "🌾 优质梯牧草 (粗饲料)", cost: 10, sat: 35, exp: 50, desc: "基础粗纤维，调子维持平稳，促进肠胃健康蠕动" },
                { type: "FEED_ALFALFA", name: "🌿 压缩苜蓿草捆 (粗饲料)", cost: 25, sat: 40, exp: 120, desc: "适口性优良，调子微升，满足幼马旺盛食量" },
                { type: "FEED_OATS", name: "🌽 熟化压片燕麦 (精饲料)", cost: 40, sat: 25, exp: 200, desc: "高爆发碳水能量，微升兴奋度，连续投喂有积食风险" },
                { type: "FEED_PROTEIN", name: "🍪 复合强化蛋白饼 (精饲料)", cost: 80, sat: 30, exp: 450, desc: "顶尖纯血营养配方，绝好调概率+15%，肌肉强化" },
            ];

        let feedBusy = false;
        feeds.forEach((f, idx) => {
            const y = feedY[idx];
            const itemBox = this.wantedPosterBox(modalBox, 0, y, 610, 76, 8);
            this.text(itemBox, `${f.name} · ${f.cost}🪙`, -90, 16, 15, WestColors.INK_DARK);
            this.text(itemBox, `饱腹+${f.sat} EXP+${f.exp} · ${f.desc}`, -90, -14, 11, WestColors.INK_MUTED);

            this.saloonButton(
                itemBox,
                "投喂",
                215,
                0,
                110,
                42,
                async () => {
                    if (feedBusy) return;
                    feedBusy = true;
                    try {
                        const res = await ApiClient.post<{ code: number; message: string; data: FeedResultDto }>(
                            "/api/ranch/feed",
                            { horseId: horse.id, feedCode: f.type },
                        );
                        const updated = res.data?.data || res.data;
                        const colicNotice = updated.colicTriggered ? "⚠️ 注意：连续喂食精料引发积食腹痛！请去医护调养！" : "";
                        this.showToast(`🌾 投喂成功！饱腹升至 ${updated.newHunger}，经验+${f.exp} ${colicNotice}`, WestColors.GOLD_BRIGHT);
                        WestAudio.playHorseNeigh("COMMON");
                        await this.loadPlayer();
                        mask.destroy();
                        void this.show("stable");
                    } catch (err) {
                        this.showToast(this.errorMessage(err, "投喂失败"), WestColors.BANDANA_RED);
                    } finally {
                        feedBusy = false;
                    }
                },
                true,
                13,
            );
        });

        // 警告文案
        this.text(modalBox, "⚠️ 饱腹度上限为 100。最近 3 小时连续投喂精饲料将有 25% 几率引发积食微恙！", 0, -195, 12, WestColors.BANDANA_RED);

        // 关闭按钮
        this.saloonButton(modalBox, "🚪 关闭 (CLOSE)", 0, -260, 240, 46, () => {
            mask.destroy();
        });
    }

    /** 弹窗：四大专项训练 (TRAIN)。从数据库动态目录加载。 */
    private async openRanchTrainModal(horse: RanchHorseDto): Promise<void> {
        if (horse.growthStage === "FOAL") {
            this.showToast("🍼 幼驹骨骼尚未发育成熟 (Lv.1~9)，严禁体能训练！请先投喂草粮至 Lv.10 突破！", WestColors.BANDANA_RED);
            return;
        }

        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 680, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 680, () => mask.destroy());

        this.text(modalBox, `🏇 四大专项训练 · 【${horse.customName}】`, 0, 290, 22, WestColors.GOLD_BRIGHT);
        this.text(modalBox, `当前精力: ${horse.staminaEnergy}/100 (每次消耗精力，精力不足禁止训练) · 属性受潜能绝对封顶`, 0, 255, 13, WestColors.PARCHMENT_LIGHT);

        const catalog = await this.fetchRanchCatalog();
        const trainY = [170, 70, -30, -130];
        const trainings = catalog?.trainings && catalog.trainings.length > 0
            ? catalog.trainings.slice(0, 4).map((t) => ({
                type: t.trainingType,
                name: `${t.trainingType === "SPRINT" ? "⚡" : t.trainingType === "LOPE" ? "🏃" : t.trainingType === "CORNER" ? "🌪️" : "⛰️"} ${t.trainingNameZh} (${t.trainingType})`,
                cost: Number(t.coinCost),
                effect: `速+${t.speedDelta} 耐+${t.staminaDelta} 爆+${t.burstDelta} 敏+${t.agilityDelta} 磨损+${t.hoofWearDelta}`,
                desc: t.descriptionZh || `精力消耗:${t.energyCost}, 调子消耗:${t.conditionLoss}`,
            }))
            : [
                { type: "SPRINT", name: "⚡ 短程爆发冲刺 (Sprint)", cost: 30, effect: "速度+0.80, 爆发+0.40, 调子-5, 磨损+8", desc: "强化四肢肌腱爆发力，大幅提升直道最高冲刺时速" },
                { type: "LOPE", name: "🏃 环道负重耐力 (Lope)", cost: 25, effect: "耐力+0.90, 调子-4, 磨损+6", desc: "提升持久续航与心肺能力，中后程维持极速不失速" },
                { type: "CORNER", name: "🌪️ 弯道机动折返 (Corner)", cost: 35, effect: "灵敏+1.00, 速度+0.30, 调子-5, 磨损+10", desc: "熟悉过弯离心力对抗，大幅减少弯道减速损耗" },
                { type: "HILL", name: "⛰️ 坡地越野耐挫 (Hill)", cost: 40, effect: "爆发+0.80, 耐力+0.50, 调子-6, 磨损+12", desc: "模拟起伏坡道对抗，全面提升出闸启爆与抗逆性" },
            ];

        let trainBusy = false;
        trainings.forEach((t, idx) => {
            const y = trainY[idx];
            const itemBox = this.wantedPosterBox(modalBox, 0, y, 610, 78, 8);
            this.text(itemBox, `${t.name} · ${t.cost}🪙`, -90, 18, 15, WestColors.INK_DARK);
            this.text(itemBox, `收益: ${t.effect} · ${t.desc}`, -90, -14, 11, WestColors.INK_MUTED);

            this.saloonButton(
                itemBox,
                "开始训练",
                215,
                0,
                110,
                42,
                async () => {
                    if (trainBusy) return;
                    trainBusy = true;
                    try {
                        await ApiClient.post<TrainResultDto>("/api/ranch/train", {
                            horseId: horse.id,
                            trainingType: t.type,
                        });
                        this.showToast(`🏇 训练完成！赛马各项专业技能获得提升！`, WestColors.GOLD_BRIGHT);
                        WestAudio.playHorseNeigh("COMMON");
                        await this.loadPlayer();
                        mask.destroy();
                        void this.show("stable");
                    } catch (err) {
                        this.showToast(this.errorMessage(err, "训练失败"), WestColors.BANDANA_RED);
                    } finally {
                        trainBusy = false;
                    }
                },
                true,
                13,
            );
        });

        // 关闭按钮
        this.saloonButton(modalBox, "🚪 结束训练返回 (CLOSE)", 0, -260, 260, 46, () => {
            mask.destroy();
        });
    }

    /** 弹窗：理疗医护 (CARE)。从数据库动态目录加载。 */
    private async openRanchCareModal(horse: RanchHorseDto): Promise<void> {
        if (horse.growthStage === "FOAL") {
            this.showToast("🍼 幼驹阶段骨骼未成熟，无需钉蹄与专业理疗，只需优质饲草静养！", WestColors.BANDANA_RED);
            return;
        }

        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 730, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 730, () => mask.destroy());

        this.text(modalBox, `🛁 医护理疗中心 · 【${horse.customName}】`, 0, 320, 22, WestColors.GOLD_BRIGHT);
        this.text(modalBox, `蹄磨损: ${horse.hoofWear}/100 · 健康: ${horse.healthPoints}/100 · 亲密: ${horse.intimacyLevel}/100`, 0, 285, 14, WestColors.PARCHMENT_LIGHT);

        const catalog = await this.fetchRanchCatalog();
        const careY = [215, 130, 45, -40, -125];
        const cares = catalog?.cares && catalog.cares.length > 0
            ? catalog.cares.slice(0, 5).map((c) => ({
                type: c.careType,
                name: `${c.careType === "GROOM" ? "🪮" : c.careType === "HANDWALK" ? "🚶" : c.careType === "FARRIER" ? "🔨" : c.careType === "PROBIOTIC" ? "🧪" : "🌿"} ${c.careNameZh}`,
                cost: Number(c.coinCost),
                desc: c.descriptionZh || `调子+${c.conditionBonus}, 健康+${c.healthBonus}, 磨损-${c.hoofWearRelief}`,
            }))
            : [
                { type: "GROOM", name: "🪮 软毛刷日常梳理", cost: 5, desc: "亲密度+10, 调子+5 · 清除浮尘，舒缓肌肉，建立马主人格信任" },
                { type: "HANDWALK", name: "🚶 牵引漫步放松", cost: 10, desc: "体力精力+15 · 降低心率疲劳，恢复体力精力" },
                { type: "FARRIER", name: "🔨 钉蹄修整与平整", cost: 25, desc: "蹄铁磨损-40, 健康+10 · 铲除碎石硬泥，平整蹄铁力学" },
                { type: "PROBIOTIC", name: "🧪 益生菌调理冲剂", cost: 30, desc: "调子+30, 健康+15 · 专治积食腹痛，解除 Colic 患病状态" },
                { type: "PHYSIOMUD", name: "🌿 理疗推拿与草本泥敷", cost: 50, desc: "调子直升100(绝好调), 健康100, 蹄磨损-30 · 清除疲劳与伤病" },
            ];

        let careBusy = false;
        cares.forEach((c, idx) => {
            const y = careY[idx];
            const itemBox = this.wantedPosterBox(modalBox, 0, y, 610, 72, 8);
            this.text(itemBox, `${c.name} · ${c.cost}🪙`, -90, 15, 15, WestColors.INK_DARK);
            this.text(itemBox, c.desc, -90, -14, 12, WestColors.INK_MUTED);

            this.saloonButton(
                itemBox,
                "护理",
                215,
                0,
                110,
                38,
                async () => {
                    if (careBusy) return;
                    careBusy = true;
                    try {
                        await ApiClient.post<CareResultDto>("/api/ranch/care", {
                            horseId: horse.id,
                            careType: c.type,
                        });
                        this.showToast(`✨ 护理完成！爱驹调子与健康得到有效恢复！`, WestColors.GOLD_BRIGHT);
                        WestAudio.playHorseNeigh("COMMON");
                        await this.loadPlayer();
                        mask.destroy();
                        void this.show("stable");
                    } catch (err) {
                        this.showToast(this.errorMessage(err, "护理失败"), WestColors.BANDANA_RED);
                    } finally {
                        careBusy = false;
                    }
                },
                true,
                13,
            );
        });

        // 关闭按钮
        this.saloonButton(modalBox, "🚪 关闭 (CLOSE)", 0, -285, 240, 46, () => {
            mask.destroy();
        });
    }

    /** 弹窗：马具装配 (EQUIP)。 */
    private async openRanchEquipModal(horse: RanchHorseDto): Promise<void> {
        if (horse.level < 20 && horse.growthStage !== "MATURE" && horse.growthStage !== "PRO_RACER") {
            this.showToast("📏 赛马尚未成年 (需达到 Lv.20)，体型无法装配赛道专业马具！", WestColors.BANDANA_RED);
            return;
        }

        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 720, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 720, () => mask.destroy());

        this.text(modalBox, `🛡️ 马具装配 · 【${horse.customName}】`, 0, 315, 22, WestColors.GOLD_BRIGHT);

        try {
            const eqRes = await ApiClient.get<{ catalog: RanchEquipmentDto[]; inventory: PlayerEquipmentDto[] }>("/api/ranch/equipment");
            const inventory = eqRes.data?.inventory ?? [];

            // 1. 已穿戴装备展示槽 (Y = 220)
            const currentSlots = this.wantedPosterBox(modalBox, 0, 220, 610, 110, 8);
            this.text(currentSlots, "【当前穿戴槽位】", 0, 38, 14, WestColors.INK_DARK);

            const saddleItem = inventory.find((it) => it.id === horse.saddleItemId) ?? null;
            const stirrupItem = inventory.find((it) => it.id === horse.stirrupItemId) ?? null;
            const shoeItem = inventory.find((it) => it.id === horse.horseshoeItemId) ?? null;

            const slots: Array<{ slot: string; label: string; current: PlayerEquipmentDto | null; x: number }> = [
                { slot: "SADDLE", label: "马鞍 (Saddle)", current: saddleItem, x: -180 },
                { slot: "STIRRUP", label: "马镫 (Stirrup)", current: stirrupItem, x: 0 },
                { slot: "HORSESHOE", label: "蹄铁 (Horseshoe)", current: shoeItem, x: 180 },
            ];

            slots.forEach((s) => {
                const sName = s.current ? s.current.itemName : "未装配";
                const durText = s.current ? ` (耐久:${s.current.currentDurability})` : "";
                this.text(currentSlots, s.label, s.x, 14, 12, WestColors.INK_MUTED);
                this.text(currentSlots, `${sName}${durText}`, s.x, -8, 12, s.current ? WestColors.INK_DARK : WestColors.BANDANA_RED);
                if (s.current) {
                    this.saloonButton(
                        currentSlots,
                        "卸下",
                        s.x - 36,
                        -32,
                        60,
                        24,
                        async () => {
                            try {
                                await ApiClient.unequipItem(horse.id, s.slot);
                                this.showToast(`卸下 ${s.label} 成功`, WestColors.GOLD_BRIGHT);
                                mask.destroy();
                                void this.show("stable");
                            } catch (err) {
                                this.showToast(this.errorMessage(err, "卸下失败"), WestColors.BANDANA_RED);
                            }
                        },
                        false,
                        11,
                    );
                    this.saloonButton(
                        currentSlots,
                        "修理",
                        s.x + 36,
                        -32,
                        60,
                        24,
                        async () => {
                            try {
                                const repRes = await ApiClient.repairEquipment(s.current!.id);
                                this.showToast(`🔨 铁匠铺修缮完成！耐久已恢复至 ${repRes.data?.newDurability ?? 100}！`, WestColors.GOLD_BRIGHT);
                                WestAudio.playChipClink();
                                await this.loadPlayer();
                                mask.destroy();
                                void this.show("stable");
                            } catch (err) {
                                this.showToast(this.errorMessage(err, "修理失败"), WestColors.BANDANA_RED);
                            }
                        },
                        true,
                        11,
                    );
                }
            });

            // 2. 背包中可用装备列表 (Y 范围 100 到 -180)
            this.text(modalBox, "📦 背包已有闲置马具 (直接免费装配，或消耗30%金币修理翻新):", 0, 135, 14, WestColors.PARCHMENT_LIGHT);

            const unequipped = inventory.filter((it) => !it.isEquipped);
            if (unequipped.length === 0) {
                const emptyEq = this.wantedPosterBox(modalBox, 0, 20, 610, 120, 8);
                this.text(emptyEq, "背包暂无闲置马具", 0, 10, 16, WestColors.INK_DARK);
                this.text(emptyEq, "所有马具均已装配至赛马，卸下已有马具即可在此换装！", 0, -18, 13, WestColors.INK_MUTED);
            } else {
                const eqY = [70, -10, -90, -170];
                unequipped.slice(0, 4).forEach((eq, idx) => {
                    const y = eqY[idx];
                    const itemBox = this.wantedPosterBox(modalBox, 0, y, 610, 64, 6);
                    this.text(itemBox, `🛡️ ${eq.itemName} · 部位: ${eq.slotCategory}`, -110, 12, 14, WestColors.INK_DARK);
                    this.text(itemBox, `当前耐久: ${eq.currentDurability} · 编号: ${eq.itemCode}`, -110, -12, 12, WestColors.DESERT_SAGE);

                    this.saloonButton(
                        itemBox,
                        "装配",
                        160,
                        0,
                        80,
                        36,
                        async () => {
                            try {
                                await ApiClient.post<PlayerEquipmentDto>("/api/ranch/equip", {
                                    horseId: horse.id,
                                    equipmentItemId: eq.id, // 传入背包实例ID，零扣费直接装配
                                });
                                this.showToast(`🛡️ 成功装配【${eq.itemName}】！属性已生效！`, WestColors.GOLD_BRIGHT);
                                WestAudio.playGoldCascade("COMMON");
                                mask.destroy();
                                void this.show("stable");
                            } catch (err) {
                                this.showToast(this.errorMessage(err, "装配失败"), WestColors.BANDANA_RED);
                            }
                        },
                        true,
                        12,
                    );

                    this.saloonButton(
                        itemBox,
                        "修理",
                        250,
                        0,
                        70,
                        36,
                        async () => {
                            try {
                                const repRes = await ApiClient.repairEquipment(eq.id);
                                this.showToast(`🔨 修理成功！耐久已恢复至 ${repRes.data?.newDurability ?? 100}！`, WestColors.GOLD_BRIGHT);
                                WestAudio.playChipClink();
                                await this.loadPlayer();
                                mask.destroy();
                                void this.show("stable");
                            } catch (err) {
                                this.showToast(this.errorMessage(err, "修理失败"), WestColors.BANDANA_RED);
                            }
                        },
                        false,
                        12,
                    );
                });
            }
        } catch (err) {
            this.text(modalBox, this.errorMessage(err, "加载马具列表失败"), 0, 20, 16, WestColors.BANDANA_RED);
        }

        // 关闭按钮
        this.saloonButton(modalBox, "🚪 关闭 (CLOSE)", 0, -280, 240, 46, () => {
            mask.destroy();
        });
    }

    /** 弹窗：400m 资格考核试跑 (TRIAL)。 */
    private openRanchTrialModal(horse: RanchHorseDto): void {
        if (horse.isLicensedRacer) {
            this.showToast(`🏅 爱驹已取得职业执照 (证书号: ${horse.licenseCertCode ?? "WY-PRO"})，无需重复考核！`, WestColors.GOLD_BRIGHT);
            return;
        }

        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 720, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 720, () => mask.destroy());

        this.text(modalBox, `⏱️ 400m 物理模拟资格试跑 · 【${horse.customName}】`, 0, 310, 20, WestColors.GOLD_BRIGHT);

        const card = this.wantedPosterBox(modalBox, 0, 150, 610, 230, 10);
        this.text(card, "📜 怀俄明公会赛马职业资格考核公约", 0, 85, 16, WestColors.INK_DARK);
        this.text(card, "跑进 24.50 秒以内即可获得正式职业赛马执照 (通过后缴纳 200🪙 证书规费)！", 0, 55, 13, WestColors.BANDANA_RED);

        const isLvOk = horse.level >= 20;
        const isHealthOk = horse.healthPoints >= 100 && horse.hoofWear < 50;
        const isEquipOk = !!horse.saddleItemId && !!horse.stirrupItemId && !!horse.horseshoeItemId;
        const isEligible = isLvOk && isHealthOk && isEquipOk;

        this.text(card, `1. 成年体型 (Lv.20+): ${isLvOk ? "✅ 已达标" : `❌ 当前 Lv.${horse.level} (未成年)`}`, -140, 20, 13, isLvOk ? WestColors.DESERT_SAGE : WestColors.BANDANA_RED);
        this.text(card, `2. 兽医体检 (健康100/磨损<50): ${isHealthOk ? "✅ 体检合格" : `❌ 健康${horse.healthPoints}/磨损${horse.hoofWear}`}`, -140, -5, 13, isHealthOk ? WestColors.DESERT_SAGE : WestColors.BANDANA_RED);
        this.text(card, `3. 马具齐备 (鞍/镫/铁齐全): ${isEquipOk ? "✅ 三件套齐全" : "❌ 尚未穿齐专业马具"}`, -140, -30, 13, isEquipOk ? WestColors.DESERT_SAGE : WestColors.BANDANA_RED);

        const bestTimeStr = horse.qualificationTime ? `${Number(horse.qualificationTime).toFixed(2)} 秒` : "尚无记录";
        this.text(card, `战绩: 最佳耗时: ${bestTimeStr} · 执照: ${horse.isLicensedRacer ? "🏅 已持证上岗" : "⏳ 尚未取得"}`, 0, -65, 13, horse.isLicensedRacer ? WestColors.GOLD_METALLIC : WestColors.INK_MUTED);

        // 动态展示区域容器
        const trialResultBox = this.chalkboardBox(modalBox, 0, -30, 610, 100, 8);
        const tipLabel = this.text(trialResultBox, isEligible ? "已达准入条件！单次试跑消耗 15 点精力、5% 蹄铁磨损、3 调子 (通过核发证书扣 200 🪙)\\n点击下方【启闸试跑】即刻测算 400m 成绩！" : "⚠️ 尚未满足全部硬性准入条件 (需 Lv.20+、健康度 100 且配齐三件套)！", 0, 0, 13, isEligible ? WestColors.GOLD_BRIGHT : WestColors.PARCHMENT_LIGHT);

        // 启闸按钮
        this.saloonButton(
            modalBox,
            isEligible ? "🚀 启闸物理试跑 (通过核发证书)" : "🔒 尚未满足准入条件",
            0,
            -150,
            320,
            48,
            async () => {
                if (!isEligible) {
                    this.showToast("必须满足成年体型 Lv.20+、健康度 100 且装配三件套方可试跑！", WestColors.BANDANA_RED);
                    return;
                }
                try {
                    tipLabel.string = "🏇 启跑闸门开启！赛马正在 400 米直道飞驰测算中...";
                    WestAudio.playHorseNeigh("COMMON");

                    const res = await ApiClient.post<TrialResultDto>(
                        "/api/ranch/qualification-trial",
                        { horseId: horse.id },
                    );
                    const trial = res.data;
                    await this.loadPlayer();

                    const statusStr = trial.isPassed 
                        ? "🏅 恭喜！成功跑进 24.50s，获得职业赛马执照！" 
                        : "⏱️ 未达 24.50s 及格线，赛马进入 4 小时技术冷静期！";
                    tipLabel.string = `最终耗时: ${Number(trial.trialTime).toFixed(2)} 秒 (考核标准: ${trial.standardBenchmark}s)\n执照证书号: ${trial.licenseCertCode ?? "未签发"}\n${statusStr}`;

                    if (trial.isPassed) {
                        WestAudio.playGoldCascade("COMMON");
                    }
                } catch (err) {
                    const errMsg = this.errorMessage(err, "试跑失败");
                    tipLabel.string = `⚠️ ${errMsg}`;
                    this.showToast(errMsg, WestColors.BANDANA_RED);
                }
            },
            isEligible,
            14,
        );

        // 关闭按钮
        this.saloonButton(modalBox, "🚪 关闭试跑场 (CLOSE)", 0, -250, 240, 46, () => {
            mask.destroy();
            void this.show("stable");
        });
    }

    /** 弹窗：公会保底回购 (BUYBACK)。 */
    private openRanchBuybackModal(horse: RanchHorseDto): void {
        if (horse.subStatus === "RETIRED") {
            this.showToast("该赛马已退役！", WestColors.BANDANA_RED);
            return;
        }
        if (horse.subStatus === "IN_RACE" || horse.subStatus === "AUCTION_LOCKED" || horse.subStatus === "TRANSFER_LOCKED") {
            this.showToast(`赛马当前处于 ${horse.subStatus} 锁定中，不可申请回购！`, WestColors.BANDANA_RED);
            return;
        }

        const root = this.pageRoot!;
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        this.bindClick(mask, () => mask.destroy());
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 520, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 520, () => mask.destroy());

        this.text(modalBox, `🏷️ 公会官方保底回购`, 0, 210, 22, WestColors.GOLD_BRIGHT);

        const card = this.wantedPosterBox(modalBox, 0, 70, 610, 200, 10);
        this.text(card, `赛马: 【${horse.customName}】 (${horse.horseCode})`, 0, 65, 17, WestColors.INK_DARK);
        this.text(card, `血统品级: ${horse.pedigreeTier} · 等级: Lv.${horse.level} · 胜场: ${horse.totalCareerWins}`, 0, 35, 14, WestColors.INK_MUTED);

        // 严格遵循 PRD 公式: BasePrice + (Level * 25) + (CareerWins * 100) + (AccumulatedPurse * 0.05)
        const basePrices: Record<string, number> = {
            WILD: 150,
            PLAINS_TB: 400,
            ROYAL: 1200,
            MYTHIC: 3500,
        };
        const baseVal = basePrices[horse.pedigreeTier] || 150;
        const totalEstimate = baseVal + (horse.level * 25) + (horse.totalCareerWins * 100) + Math.floor(Number(horse.accumulatedPurse) * 0.05);

        this.text(card, `公会公证保底回购款: ${this.formatMoney(totalEstimate)} 🪙`, 0, -5, 18, WestColors.GOLD_METALLIC);
        this.text(card, "确认出售后，该马匹将由公会官方统一回收入库并永久退役，", 0, -45, 13, WestColors.BANDANA_RED);
        this.text(card, "回购款项将即刻打入您的钱包资产，所有已装配马具将自动归还仓库！", 0, -70, 13, WestColors.BANDANA_RED);

        // 确认出售按钮
        this.saloonButton(
            modalBox,
            `确认出售并换取 ${totalEstimate}🪙`,
            0,
            -95,
            300,
            46,
            async () => {
                try {
                    await ApiClient.post("/api/ranch/buyback", { horseId: horse.id });
                    this.showToast(`🎉 成功以保底价出售！资金入账！`, WestColors.GOLD_BRIGHT);
                    WestAudio.playGoldCascade("COMMON");
                    await this.loadPlayer();
                    this.selectedRanchHorseId = null;
                    mask.destroy();
                    void this.show("stable");
                } catch (err) {
                    this.showToast(this.errorMessage(err, "回购出售失败"), WestColors.BANDANA_RED);
                }
            },
            true,
            14,
        );

        // 取消按钮
        this.saloonButton(modalBox, "取消离开", 0, -170, 200, 42, () => {
            mask.destroy();
        });
    }

    /** 模式一：全服名驹谱系名录视图 (CATALOG)。 */
    private async buildLegacyCatalogView(stableBox: Node): Promise<void> {
        try {
            const pageSize = 6;
            const response = await ApiClient.get<{
                page: number;
                pageSize: number;
                total: number;
                items: HorseCatalogItemDto[];
            }>(`/api/stable/horses?page=${this.stablePage}&pageSize=${pageSize}`);

            const horseY = [340, 260, 180, 100, 20, -60];
            const horses = response.data.items ?? [];
            horses.forEach((horse, index) => {
                const y = horseY[index];
                const card = this.wantedPosterBox(stableBox, 0, y, 660, 68, 8);
                const name = I18n.getLocale() === "en-US" && horse.nameEn ? horse.nameEn : horse.nameZh;
                const winRateText = (Number(horse.winRate) * 100).toFixed(1);

                this.text(card, `🏇 ${(this.stablePage - 1) * pageSize + index + 1}. ${name} (${horse.horseCode})`, -145, 13, 16, WestColors.INK_DARK);
                this.text(card, `出战 ${horse.totalRaces} 场 · 胜场 ${horse.winCount} 次 · 胜率 ${winRateText}%`, -145, -13, 12, WestColors.INK_MUTED);

                this.saloonButton(
                    card,
                    "谱系",
                    180,
                    0,
                    86,
                    40,
                    () => {
                        this.selectedHorseCatalogId = horse.horseId;
                        void this.show("stable");
                    },
                    false,
                    13,
                );

                this.saloonButton(
                    card,
                    "赞助(1000🪙)",
                    275,
                    0,
                    96,
                    40,
                    async () => {
                        try {
                            await ApiClient.post("/api/stable/adopt", { horseCatalogId: horse.horseId });
                            this.showToast(`🎉 恭喜赞助【${name}】！已加入出战分红名单！`, WestColors.GOLD_BRIGHT);
                            WestAudio.playGoldCascade("COMMON");
                            await this.loadPlayer();
                            this.stableTab = "SPONSOR";
                            void this.show("stable");
                        } catch (err) {
                            this.showToast(this.errorMessage(err, "赞助失败"), WestColors.BANDANA_RED);
                        }
                    },
                    true,
                    11,
                );
            });

            // 分页控制栏 (Y = -135)
            const totalPages = Math.max(
                1,
                Math.ceil(response.data.total / response.data.pageSize),
            );

            this.saloonButton(
                stableBox,
                "◀ 上一页",
                -150,
                -135,
                140,
                38,
                () => {
                    if (this.stablePage > 1) {
                        this.stablePage -= 1;
                        void this.show("stable");
                    }
                },
                false,
                15,
            );

            this.text(stableBox, `${this.stablePage} / ${totalPages}`, 0, -135, 17, WestColors.GOLD_BRIGHT);

            this.saloonButton(
                stableBox,
                "下一页 ▶",
                150,
                -135,
                140,
                38,
                () => {
                    if (this.stablePage < totalPages) {
                        this.stablePage += 1;
                        void this.show("stable");
                    }
                },
                false,
                15,
            );

            // 指导提示卡片
            const stableTip = this.wantedPosterBox(stableBox, 0, -210, 660, 56, 8);
            this.text(stableTip, "🐎 怀俄明柯尔特名驹谱系与出赛公证书", 0, 10, 14, WestColors.INK_DARK);
            this.text(stableTip, "名下赞助良驹出赛前三名自动派发分红 · 投喂胡萝卜维持绝好调", 0, -12, 12, WestColors.INK_MUTED);
        } catch (error) {
            this.text(
                stableBox,
                this.errorMessage(error, I18n.t("stable.loadFailed", "马场加载失败")),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }
    }

    /** 模式一：名驹赞助与分红视图 (SPONSOR)。 */
    private async buildLegacySponsorView(stableBox: Node): Promise<void> {
        try {
            const myRes = await ApiClient.get<{
                unclaimedDividends: number;
                horses: Array<{
                    stableId: number;
                    horseCatalogId: number;
                    customName: string;
                    nameZh: string;
                    conditionLevel: number;
                    careCountToday: number;
                    totalCareerRaces: number;
                    totalCareerWins: number;
                    accumulatedPurse: number;
                }>;
            }>("/api/stable/my");

            const unclaimed = myRes.data?.unclaimedDividends ?? 0;
            const myHorses = myRes.data?.horses ?? [];

            // 待提领出战分红卡片 (Y = 340, H = 76)
            const divCard = this.woodBox(stableBox, 0, 340, 660, 76, 10, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
            this.text(divCard, `🪙 待提领赞助分红: ${this.formatMoney(unclaimed)} 🪙`, -120, 14, 18, WestColors.GOLD_BRIGHT);
            this.text(divCard, "前三名获公证分红: 🥇200🪙 · 🥈100🪙 · 🥉50🪙", -120, -14, 13, WestColors.PARCHMENT_LIGHT);

            this.saloonButton(
                divCard,
                "💰 一键提领",
                210,
                0,
                170,
                46,
                async () => {
                    try {
                        const claimRes = await ApiClient.post<{ code: number; message?: string; data?: { claimedAmount: number } }>("/api/stable/claim-dividends", {});
                        const claimed = claimRes.data?.data?.claimedAmount ?? 0;
                        this.showToast(`🎉 成功提领 ${this.formatMoney(claimed)} 🪙 入库！`, WestColors.GOLD_BRIGHT);
                        WestAudio.playGoldCascade("COMMON");
                        await this.loadPlayer();
                        void this.show("stable");
                    } catch (err) {
                        this.showToast(this.errorMessage(err, "暂无待提领分红"), WestColors.BANDANA_RED);
                    }
                },
                unclaimed > 0,
                15,
            );

            if (myHorses.length === 0) {
                const emptyCard = this.wantedPosterBox(stableBox, 0, 140, 660, 220, 10);
                this.text(emptyCard, "🐴 暂无赞助出赛的名驹", 0, 50, 22, WestColors.INK_DARK);
                this.text(emptyCard, "请切换至【名驹谱系名录】挑选并赞助良驹（1,000🪙），", 0, 10, 15, WestColors.INK_MUTED);
                this.text(emptyCard, "享受名驹出赛前三名分红收益，并可每日喂养加州胡萝卜维持绝好调！", 0, -20, 13, WestColors.INK_MUTED);

                this.saloonButton(
                    emptyCard,
                    "🏇 前往谱系名录挑选 ➔",
                    0,
                    -65,
                    280,
                    46,
                    () => {
                        this.stableTab = "CATALOG";
                        void this.show("stable");
                    },
                    true,
                    16,
                );
            } else {
                const myY = [240, 145, 50, -45];
                myHorses.slice(0, 4).forEach((horse, idx) => {
                    const y = myY[idx];
                    const card = this.wantedPosterBox(stableBox, 0, y, 660, 84, 8);
                    const condDesc = horse.conditionLevel >= 90 ? "绝好调 🔥" : horse.conditionLevel >= 60 ? "良好" : "疲倦";

                    this.text(card, `🏇 ${horse.customName} (${horse.nameZh}) · 状态: ${horse.conditionLevel}/100 (${condDesc})`, -115, 20, 16, WestColors.INK_DARK);
                    this.text(card, `今日抚育: ${horse.careCountToday} 次 · 出战: ${horse.totalCareerRaces} 场 · 夺冠: ${horse.totalCareerWins} 次`, -115, -4, 13, WestColors.INK_MUTED);
                    this.text(card, `历史累计赢得奖金分红: ${this.formatMoney(horse.accumulatedPurse)} 🪙`, -115, -24, 12, WestColors.DESERT_SAGE);

                    this.saloonButton(
                        card,
                        "🥕 喂胡萝卜(50🪙)",
                        205,
                        14,
                        190,
                        34,
                        async () => {
                            try {
                                await ApiClient.post("/api/stable/feed", { horseCatalogId: horse.horseCatalogId });
                                this.showToast(`🥕 喂食成功！【${horse.customName}】状态提升至 100 绝好调！`, WestColors.GOLD_BRIGHT);
                                WestAudio.playHorseNeigh("COMMON");
                                await this.loadPlayer();
                                void this.show("stable");
                            } catch (err) {
                                this.showToast(this.errorMessage(err, "喂食失败"), WestColors.BANDANA_RED);
                            }
                        },
                        true,
                        12,
                    );

                    this.saloonButton(
                        card,
                        "谱系档案",
                        205,
                        -22,
                        190,
                        28,
                        () => {
                            this.selectedHorseCatalogId = horse.horseCatalogId;
                            void this.show("stable");
                        },
                        false,
                        12,
                    );
                });
            }
        } catch (error) {
            this.text(
                stableBox,
                this.errorMessage(error, "名驹赞助加载失败"),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }
    }

    /** 马匹详细资料弹窗。 */
    private async buildHorseDetailModal(root: Node, horseId: number): Promise<void> {
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        const closeModal = () => {
            this.selectedHorseCatalogId = null;
            mask.destroy();
            void this.show("stable");
        };
        this.bindClick(mask, closeModal);
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 720, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 720, closeModal);

        this.text(modalBox, `🐴 ${I18n.t("stable.detailTitle")}`, 0, 310, 24, WestColors.GOLD_BRIGHT);

        try {
            const response = await ApiClient.get<HorseCatalogItemDto>(
                `/api/stable/horses/${horseId}`,
            );
            const horse = response.data;
            const name = I18n.getLocale() === "en-US" && horse.nameEn ? horse.nameEn : horse.nameZh;
            const desc = I18n.getLocale() === "en-US" && horse.descriptionEn
                ? horse.descriptionEn
                : horse.descriptionZh;

            const sheet = this.wantedPosterBox(modalBox, 0, 20, 610, 520, 10);

            this.text(sheet, `🐎 ${name} (${horse.horseCode}) 🐎`, 0, 215, 24, WestColors.INK_DARK);
            this.text(sheet, desc ? desc.slice(0, 48) : "柯尔特纯正荒野血统特级赛马", 0, 185, 14, WestColors.INK_MUTED);

            // 物理机械仪表盘与套马索雷达：速度表 (左) + 套马索雷达 (中) + 耐力子弹带 (右)
            const speedPct = Math.min(0.95, 0.65 + Number(horse.rank1Probability || 0.15) * 0.8);
            const bullets = Math.min(6, Math.max(3, Math.round(Number(horse.winRate || 0.2) * 10) + 2));

            const speedGaugeNode = new Node("HorseDetailSpeedGauge");
            speedGaugeNode.layer = sheet.layer || Layers.Enum.UI_2D;
            sheet.addChild(speedGaugeNode);
            speedGaugeNode.setPosition(-190, 115, 0);
            speedGaugeNode.addComponent(UITransform).setContentSize(76, 76);
            WestStyle.drawSpeedometerGauge(speedGaugeNode, 76, speedPct);
            this.text(sheet, `极速: ${(speedPct * 100).toFixed(0)}km/h`, -190, 68, 12, WestColors.INK_DARK);

            // 套马索风格属性雷达图 (Lasso Rope Radar P1)
            const radarNode = new Node("HorseDetailLassoRadar");
            radarNode.layer = sheet.layer || Layers.Enum.UI_2D;
            sheet.addChild(radarNode);
            radarNode.setPosition(-55, 115, 0);
            radarNode.addComponent(UITransform).setContentSize(96, 96);
            const winRateNum = Number(horse.winRate || 0.2);
            const rank1Prob = Number(horse.rank1Probability || 0.15);
            WestStyle.drawLassoRadar(radarNode, 86, [
                speedPct,
                bullets / 6,
                Math.min(0.95, rank1Prob * 3.2 + 0.2),
                Math.min(0.95, winRateNum * 2.8 + 0.15),
                0.85,
            ]);

            const bulletBeltNode = new Node("HorseDetailBulletBelt");
            bulletBeltNode.layer = sheet.layer || Layers.Enum.UI_2D;
            sheet.addChild(bulletBeltNode);
            bulletBeltNode.setPosition(130, 125, 0);
            bulletBeltNode.addComponent(UITransform).setContentSize(130, 26);
            WestStyle.drawBulletBelt(bulletBeltNode, 130, 26, bullets, 6);
            this.text(sheet, `耐力: ${bullets}/6 · 胜率: ${(Number(horse.winRate) * 100).toFixed(1)}%`, 130, 95, 12, WestColors.INK_DARK);
            this.text(sheet, `战绩: 出战 ${horse.totalRaces} 场 · 夺冠 ${horse.winCount} 次`, 130, 72, 12, WestColors.INK_MUTED);

            // 黑板粉笔赔率与名次概率预估板 (Chalkboard Probability)
            const probBoard = this.chalkboardBox(sheet, 0, -28, 570, 130, 8);
            this.text(probBoard, "📊 怀俄明公证处 · 各名次概率预估 (PROBABILITY)", 0, 42, 14, WestColors.GOLD_BRIGHT);
            this.text(
                probBoard,
                `1名: ${(Number(horse.rank1Probability) * 100).toFixed(1)}%  |  2名: ${(Number(horse.rank2Probability) * 100).toFixed(1)}%  |  3名: ${(Number(horse.rank3Probability) * 100).toFixed(1)}%`,
                0,
                14,
                15,
                WestColors.CHALK_YELLOW,
            );
            this.text(
                probBoard,
                `4名: ${(Number(horse.rank4Probability) * 100).toFixed(1)}%  |  5名: ${(Number(horse.rank5Probability) * 100).toFixed(1)}%  |  6名: ${(Number(horse.rank6Probability) * 100).toFixed(1)}%`,
                0,
                -14,
                15,
                WestColors.CHALK_YELLOW,
            );
            this.text(
                probBoard,
                `历史战果: 冠×${horse.rank1Count}  亚×${horse.rank2Count}  季×${horse.rank3Count}  四×${horse.rank4Count}  五×${horse.rank5Count}  六×${horse.rank6Count}`,
                0,
                -42,
                12,
                WestColors.SHELL_SILVER,
            );

            this.text(sheet, `🏅 怀俄明柯尔特特区赛马协会公证认证 · 编号 ${horse.horseCode}`, 0, -195, 13, WestColors.INK_MUTED);
        } catch (error) {
            this.text(
                modalBox,
                this.errorMessage(error, "获取马匹详情失败"),
                0,
                0,
                22,
                WestColors.SEAL_RED,
            );
        }

        this.saloonButton(modalBox, "🚪 关闭档案 (CLOSE)", 0, -290, 240, 50, () => {
            this.selectedHorseCatalogId = null;
            void this.show("stable");
        }, true, 18);
    }

    /**
     * 角色与马匹属性界面（重构为“柯尔特赏金猎人档案 & 马具台”）。
     * 左侧高对比立绘剪影，右侧黄铜机械速度表、耐力子弹带与状态指示。
     */
    private async buildCharacters(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "battle");

        // 1. 实木主画板容器
        const dossierBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 顶部牌匾
        const titleBox = this.chalkboardBox(dossierBox, 0, 475, 660, 44, 6);
        this.text(titleBox, "🤠 柯尔特赏金猎人档案 · BOUNTY HUNTER DOSSIER 🤠", 0, 0, 19, WestColors.GOLD_BRIGHT);

        try {
            const response = await ApiClient.get<CharacterDto[]>("/api/characters");
            const characters = response.data.slice(0, 4);

            const cardY = [365, 225, 85, -55];
            characters.forEach((character, index) => {
                const y = cardY[index];
                const card = this.wantedPosterBox(dossierBox, 0, y, 660, 126, 10);

                // 左侧头像立绘框 (w: 116, h: 110)
                const avatarFrame = this.woodBox(card, -250, 0, 116, 110, 6, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
                const icon = character.isEquipped ? "🤠" : "🏇";
                this.text(avatarFrame, icon, 0, 0, 38);

                // 中间：猎人基本档案与 PRD 2.3 专属骑师执照特性 (Jockey Passive Traits)
                const traitMap: Record<string, { nick: string; trait: string; desc: string }> = {
                    "见习骑手": { nick: "老牛仔·亚瑟", trait: "【精打细算】", desc: "获胜注单手续费从12%降至10%(每日限10局)" },
                    "明星驯马师": { nick: "赏金猎人·克林特", trait: "【风雨无阻】", desc: "雨天/泥泞赛道跑速下限提升+2%" },
                    "精英巡回骑手": { nick: "红发女郎·贝拉", trait: "【黑马狂欢】", desc: "命中赔率≥20冷门组合加赠5%奖金" },
                    "皇家近卫骑手": { nick: "警长·怀亚特", trait: "【逢凶化吉】", desc: "连续3场全输自动返还15%本金" },
                    "疾风女骑师": { nick: "疾风女骑师", trait: "【追风绝杀】", desc: "Photo Finish 终点微距压线判定加成" },
                };
                const trait = traitMap[character.nameZh] ?? { nick: character.nameZh, trait: "【边境骑师】", desc: "全天候熟稔泥道与沙地" };

                const status = character.isOwned
                    ? `Lv.${character.level} (经验 ${character.exp})`
                    : "🔒 未签约猎人";
                this.text(card, `${trait.nick} (${character.nameZh})`, -95, 34, 16, WestColors.INK_DARK, HorizontalTextAlignment.LEFT, 260);
                this.text(card, `${trait.trait} ${trait.desc}`, -95, 6, 11, WestColors.BANDANA_RED, HorizontalTextAlignment.LEFT, 260);
                this.text(card, status, -95, -24, 12, WestColors.INK_MUTED, HorizontalTextAlignment.LEFT, 260);

                // 右侧：黄铜机械速度表 (Speedometer) + 耐力子弹带 (Bullet Belt)
                const speedGauge = new Node(`CharSpeedGauge${index}`);
                speedGauge.layer = card.layer || Layers.Enum.UI_2D;
                card.addChild(speedGauge);
                speedGauge.setPosition(65, 0, 0);
                speedGauge.addComponent(UITransform).setContentSize(72, 72);
                const speedVal = 0.70 + (index * 0.08) % 0.28;
                WestStyle.drawSpeedometerGauge(speedGauge, 72, speedVal);
                this.text(card, "极限爆发", 65, -44, 11, WestColors.INK_DARK);

                const bulletBelt = new Node(`CharBulletBelt${index}`);
                bulletBelt.layer = card.layer || Layers.Enum.UI_2D;
                card.addChild(bulletBelt);
                bulletBelt.setPosition(195, 18, 0);
                bulletBelt.addComponent(UITransform).setContentSize(130, 22);
                const activeBullets = character.isEquipped ? 6 : character.isOwned ? 4 : 2;
                WestStyle.drawBulletBelt(bulletBelt, 130, 22, activeBullets, 6);
                this.text(card, `耐力 ${activeBullets}/6`, 195, -2, 11, WestColors.INK_DARK);

                // 出战 / 签约按钮
                if (character.isEquipped) {
                    const tag = this.box(card, 195, -34, 120, 32, WestColors.DESERT_SAGE, 8);
                    this.text(tag, "✓ 正在出战", 0, 0, 14, WestColors.GOLD_BRIGHT);
                } else if (character.isOwned) {
                    this.saloonButton(
                        card,
                        this.isSubmitting ? "切换中..." : "🏇 策马出战",
                        195,
                        -34,
                        120,
                        32,
                        () => {
                            this.shakeScreen(150, 3);
                            void this.equipCharacterAsync(character.characterId);
                        },
                        true,
                        13,
                    );
                } else {
                    const tag = this.box(card, 195, -34, 120, 32, WestColors.WOOD_DARK, 8);
                    this.text(tag, "🔒 敬请期待", 0, 0, 13, WestColors.TEXT_MUTED);
                }
            });

            // 资产与装扮背包 (Harness & Armory Backpack，Y = -200, 杜绝与卡片3重合)
            const assets = await ApiClient.get<{
                cosmetics: Array<{ nameZh: string; slotType: string; isEquipped: boolean }>;
                items: Array<{ nameZh: string; quantity: number }>;
            }>("/api/player/assets");

            const assetBox = this.grandSaloonBox(dossierBox, 0, -200, 660, 106, 8, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
            this.text(assetBox, "🎒 边境鞍具与马刺行囊 · HARNESS & ARMORY", 0, 30, 15, WestColors.GOLD_BRIGHT);
            const cosmeticsStr = assets.data.cosmetics.map((x) => `${x.nameZh}${x.isEquipped ? "(已穿戴)" : ""}`).join("、") || "暂无";
            const itemsStr = assets.data.items.map((x) => `${x.nameZh}×${x.quantity}`).join("、") || "暂无";
            this.text(
                assetBox,
                `鞍具装扮: ${cosmeticsStr}  |  道具资产: ${itemsStr}`,
                0,
                4,
                13,
                WestColors.PARCHMENT_LIGHT,
                undefined,
                620,
            );
            this.text(
                assetBox,
                "★ 专属骑师执照特性已全面激活 · 各角色享独立被动技能加成 ★",
                0,
                -26,
                11,
                WestColors.GOLD_BRIGHT,
                undefined,
                620,
            );
        } catch (error) {
            this.text(
                dossierBox,
                this.errorMessage(error, I18n.t("characters.loadFailed", "角色/资产加载失败")),
                0,
                0,
                22,
                WestColors.SEAL_RED,
            );
        }

        // 底部返回按钮
        this.saloonButton(
            dossierBox,
            "🚪 返回主城 (BACK TO LOBBY)",
            0,
            -340,
            320,
            50,
            () => {
                void this.show("lobby");
            },
            true,
            17,
        );

        // 西部格言
        this.text(
            dossierBox,
            "🌵 \"优秀的骑手不仅懂枪，更懂得聆听马蹄下的黄沙\" 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 切换当前展示角色。 */
    private async equipCharacterAsync(characterId: number): Promise<void> {
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;

        try {
            await ApiClient.put("/api/player/character", { characterId });
            await this.loadPlayer();
            this.message = I18n.t("characters.equippedSuccess", "角色已装备");
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("characters.equipFailed", "角色装备失败"));
        } finally {
            this.isSubmitting = false;
        }

        await this.show("characters");
    }

    /** 玩家胜率榜和马匹胜率榜（怀俄明柯尔特名人堂与风云榜）。 */
    private async buildRanking(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "rank");

        const rankBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部名人堂牌匾
        const titleBox = this.chalkboardBox(rankBox, 0, 475, 660, 42, 6);
        this.text(titleBox, "🥇 怀俄明柯尔特名人堂 · LEADERBOARDS 🥇", 0, 0, 20, WestColors.GOLD_BRIGHT);

        try {
            const [playersRes, horsesRes] = await Promise.all([
                ApiClient.get<Array<{
                    nickname: string;
                    totalRounds: number;
                    totalWins: number;
                    winRate: number;
                }>>("/api/leaderboards/players?limit=5"),
                ApiClient.get<Array<{
                    nameZh: string;
                    nameEn?: string;
                    totalRaces: number;
                    winCount: number;
                    winRate: number;
                }>>("/api/leaderboards/horses?limit=5"),
            ]);

            // Section 1: 骑师榜
            const pBar = this.woodBox(rankBox, 0, 428, 660, 32, 6, WestColors.WOOD_DARK, WestColors.WOOD_FRAME);
            this.text(pBar, "🤠 金牌骑师胜率榜 (TOP JOCKEYS)", 0, 0, 15, WestColors.GOLD_BRIGHT);

            const pY = [376, 326, 276, 226, 176];
            playersRes.data.slice(0, 5).forEach((item, index) => {
                const y = pY[index];
                const isMe = this.player && item.nickname === this.player.nickname;
                const prefix = isMe ? "[★我的] " : "";
                const rBox = this.wantedPosterBox(rankBox, 0, y, 660, 44, 6);
                const medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "";
                this.text(
                    rBox,
                    `${medal}${prefix}${index + 1}. ${item.nickname}  |  胜场: ${item.totalWins}/${item.totalRounds}  |  胜率: ${(Number(item.winRate) * 100).toFixed(1)}%`,
                    0,
                    0,
                    15,
                    isMe ? WestColors.LEATHER_SADDLE : WestColors.INK_DARK,
                );
            });

            // Section 2: 良驹榜
            const hBar = this.woodBox(rankBox, 0, 126, 660, 32, 6, WestColors.WOOD_DARK, WestColors.WOOD_FRAME);
            this.text(hBar, "🐎 边境冠军良驹榜 (CHAMPION HORSES)", 0, 0, 15, WestColors.GOLD_BRIGHT);

            const hY = [74, 24, -26, -76, -126];
            horsesRes.data.slice(0, 5).forEach((item, index) => {
                const y = hY[index];
                const hBox = this.wantedPosterBox(rankBox, 0, y, 660, 44, 6);
                const hName = I18n.getLocale() === "en-US" && item.nameEn ? item.nameEn : item.nameZh;
                const medal = index === 0 ? "🥇 " : index === 1 ? "🥈 " : index === 2 ? "🥉 " : "";
                this.text(
                    hBox,
                    `${medal}${index + 1}. ${hName}  |  总场: ${item.totalRaces}  |  胜场: ${item.winCount}  |  胜率: ${(Number(item.winRate) * 100).toFixed(1)}%`,
                    0,
                    0,
                    15,
                    WestColors.INK_DARK,
                );
            });

            // Section 3: 个人自身战绩
            const myStatsBox = this.woodBox(rankBox, 0, -195, 660, 64, 8, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
            const playerWinRate = (Number(this.player?.winRate ?? 0) * 100).toFixed(1);
            this.text(
                myStatsBox,
                `🌟 我的生涯战绩: 出战 ${this.player?.totalRoundsParticipated ?? 0}场  胜出 ${this.player?.totalRoundsWon ?? 0}场  (胜率 ${playerWinRate}%)`,
                0,
                0,
                17,
                WestColors.GOLD_BRIGHT,
            );
        } catch (error) {
            this.text(
                rankBox,
                this.errorMessage(error, I18n.t("ranking.loadFailed", "排行榜加载失败")),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }

        // 底部工具栏
        this.saloonButton(
            rankBox,
            `🚪 返回大厅 (BACK)`,
            0,
            -275,
            320,
            48,
            () => { void this.show("lobby"); },
            false,
            17,
        );

        // 名人堂联合公证认证卡（充实下半区空间，消除150px死寂荒原）
        const rankNoticeCard = this.wantedPosterBox(rankBox, 0, -355, 660, 64, 8);
        this.text(rankNoticeCard, "🏆 怀俄明骑警总署与柯尔特马会联合公证认证", 0, 14, 15, WestColors.INK_DARK);
        this.text(rankNoticeCard, "名人堂胜率榜每 10 分钟自动校准 · 仅计入正式完赛之公证赛事数据", 0, -14, 12, WestColors.INK_MUTED);

        // 西部格言
        this.text(
            rankBox,
            "🌵 边境传奇永不磨灭 · 唯有最快之骑手方能留名怀俄明 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 商城页面：边境杂货铺与马具邮购目录。 */
    private async buildShop(): Promise<void> {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "shop");

        const shopBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部商城牌匾
        const titleBox = this.chalkboardBox(shopBox, 0, 475, 660, 42, 6);
        this.text(titleBox, "🛒 边境杂货铺与马具邮购 · GENERAL STORE 🛒", 0, 0, 20, WestColors.GOLD_BRIGHT);
        this.text(shopBox, "官方马具补给与纯正西部装备 · 仅限游戏内金币交易", 0, 436, 14, WestColors.TEXT_PARCHMENT);

        try {
            const [response, charResponse, assetsResponse] = await Promise.all([
                ApiClient.get<Array<{
                    id: number;
                    titleZh: string;
                    priceAmount: number;
                    productType: string;
                }>>("/api/shop/products"),
                ApiClient.get<CharacterDto[]>("/api/characters").catch(() => ({ data: [] as CharacterDto[] })),
                ApiClient.get<{
                    cosmetics: Array<{ nameZh: string }>;
                    items: Array<{ nameZh: string }>;
                }>("/api/player/assets").catch(() => ({ data: { cosmetics: [], items: [] } })),
            ]);

            const ownedCharNames = new Set(charResponse.data.filter(c => c.isOwned).map(c => c.nameZh));
            const ownedCosmeticNames = new Set(assetsResponse.data.cosmetics.map(c => c.nameZh));

            const prods = response.data ?? [];
            const prodY = [360, 272, 184, 96, 8, -80];
            prods.slice(0, 6).forEach((product, index) => {
                const y = prodY[index];
                const card = this.wantedPosterBox(shopBox, 0, y, 660, 76, 8);

                const isOwned = (product.productType === "CHARACTER" && ownedCharNames.has(product.titleZh)) ||
                    (product.productType === "COSMETIC" && ownedCosmeticNames.has(product.titleZh));

                this.text(card, `🎁 ${product.titleZh}`, -130, 16, 18, WestColors.INK_DARK);
                this.text(card, isOwned ? "已存入边境行囊 · 无需重复购置" : "边境特许装备 · 立即提升竞技体验", -130, -14, 12, WestColors.INK_MUTED);

                this.text(card, `🪙 ${this.formatMoney(product.priceAmount)}`, 85, 0, 17, WestColors.LEATHER_SADDLE);

                if (isOwned) {
                    const tag = this.box(card, 235, 0, 126, 42, WestColors.WOOD_DARK, 8);
                    this.text(tag, "✓ 已拥有", 0, 0, 14, WestColors.TEXT_MUTED);
                } else {
                    this.westernButton(
                        card,
                        this.isSubmitting ? I18n.t("common.submitting") : "收下 (BUY)",
                        235,
                        0,
                        126,
                        46,
                        () => {
                            this.showPurchaseConfirmModal(product.id, product.titleZh, product.priceAmount);
                        },
                        true,
                        15,
                    );
                }
            });
        } catch (error) {
            this.text(
                shopBox,
                this.errorMessage(error, I18n.t("shop.loadFailed", "商城加载失败")),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }

        // 合规提示条
        const complianceBox = this.wantedPosterBox(shopBox, 0, -155, 660, 36, 6);
        this.text(complianceBox, "⚠️ 商城商品均使用游戏内 COIN 购买，不提供任何充值与法币结算。", 0, 0, 13, WestColors.INK_MUTED);

        // 底部工具栏
        this.saloonButton(
            shopBox,
            `🚪 返回大厅 (BACK)`,
            0,
            -230,
            320,
            48,
            () => { void this.show("lobby"); },
            false,
            17,
        );

        // 金库物资与补给概要栏（充实下半区空间，杜绝死寂荒原）
        const shopSupplyCard = this.woodBox(shopBox, 0, -320, 660, 72, 8, WestColors.LEATHER_SADDLE, WestColors.GOLD_METALLIC);
        this.text(shopSupplyCard, `🪙 当前金库可用储备: ${this.formatMoney(this.player?.balance ?? 0)} 金币`, 0, 16, 17, WestColors.GOLD_BRIGHT);
        this.text(shopSupplyCard, "荒野杂货铺提供正品马具、缰绳与猎人契约，所有装备实时入账", 0, -14, 13, WestColors.PARCHMENT_LIGHT);

        // 西部格言
        this.text(
            shopBox,
            "🌵 怀俄明柯尔特特区总督府监制 · 货真价实童叟无欺 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 幂等购买商城商品并重新读取玩家余额。 */
    private async purchaseAsync(productId: number): Promise<void> {
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;

        try {
            await ApiClient.post("/api/shop/orders", {
                productId,
                quantity: 1,
                idempotencyKey: this.createUuid(),
            });
            await this.loadPlayer();
            this.message = I18n.t("shop.bought");
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("shop.buyFailed", "购买失败"));
        } finally {
            this.isSubmitting = false;
        }

        await this.show("shop");
    }

    /** 玩家下注历史页面（荒野押注卷宗）。 */
    private async buildBets(): Promise<void> {
        const root = this.pageRoot!;
        const isEn = I18n.getLocale() === "en-US";
        this.buildTopHud(root);
        this.buildBottomNav(root, "battle");

        if (this.selectedBetOrderNo !== null) {
            await this.buildBetDetailModal(root, this.selectedBetOrderNo);
            return;
        }

        const betsBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部牌匾
        const titleBox = this.chalkboardBox(betsBox, 0, 475, 660, 42, 6);
        this.text(titleBox, isEn ? "📜 WAGER ARCHIVES · TICKETS 📜" : "📜 荒野押注卷宗 · WAGER ARCHIVES 📜", 0, 0, isEn ? 18 : 20, WestColors.GOLD_BRIGHT);
        this.text(betsBox, isEn ? "Notarized betting receipts and payout ledger" : "所有轮次马票撕票凭证 · 链上结算与派彩回执", 0, 436, isEn ? 12 : 14, WestColors.TEXT_PARCHMENT);

        try {
            const response = await ApiClient.get<{
                page: number;
                pageSize: number;
                total: number;
                items: BetOrderItemDto[];
            }>("/api/player/bets?page=1&pageSize=7");

            const items = response.data.items ?? [];
            if (items.length === 0) {
                this.text(betsBox, isEn ? "No betting records found" : "暂无下注历史记录", 0, 100, 22, WestColors.TEXT_MUTED);
            } else {
                const betY = [355, 275, 195, 115, 35, -45, -125];
                items.slice(0, 7).forEach((bet, index) => {
                    const y = betY[index];
                    const isWin = bet.status === BetOrderStatus.Won;
                    const isLoss = bet.status === BetOrderStatus.Lost;
                    const isRefund = bet.status === BetOrderStatus.Refunded;
                    const isCancelled = bet.status === BetOrderStatus.Cancelled;
                    const statusTag = isWin
                        ? (isEn ? "[WON 🏆]" : "[中奖 🏆]")
                        : isLoss
                        ? (isEn ? "[LOST ❌]" : "[未中 ❌]")
                        : isRefund
                        ? (isEn ? "[REFUND ↩️]" : "[已退款 ↩️]")
                        : isCancelled
                        ? (isEn ? "[CANCEL 🚫]" : "[已撤单 🚫]")
                        : (isEn ? "[PENDING ⏳]" : "[待结 ⏳]");
                    const statusColor = isWin
                        ? WestColors.DESERT_SAGE
                        : isLoss
                        ? WestColors.BANDANA_RED
                        : isRefund
                        ? WestColors.GOLD_BRIGHT
                        : isCancelled
                        ? WestColors.INK_MUTED
                        : WestColors.LEATHER_SADDLE;

                    const betCard = this.wantedPosterBox(betsBox, 0, y, 660, 70, 8);
                    let targetStr = isEn ? `No.${bet.horseNo} Horse` : `${bet.horseNo}号马`;
                    if (bet.playType === "TRIFECTA") {
                        targetStr = isEn ? `👑 Trifecta[${bet.combination ?? `${bet.horseNo}-${bet.secondHorseNo}`}]` : `👑 三重彩[${bet.combination ?? `${bet.horseNo}-${bet.secondHorseNo}`}]`;
                    } else if (bet.playType === "EXACTA") {
                        targetStr = isEn ? `🎯 Exacta[${bet.combination ?? `${bet.horseNo}-${bet.secondHorseNo}`}]` : `🎯 二连单[${bet.combination ?? `${bet.horseNo}-${bet.secondHorseNo}`}]`;
                    } else if (bet.playType === "QUINELLA" || Boolean(bet.combination)) {
                        targetStr = isEn ? `🎰 Quinella[${bet.combination ?? `${bet.horseNo}-${bet.secondHorseNo}`}]` : `🎰 连赢[${bet.combination ?? `${bet.horseNo}-${bet.secondHorseNo}`}]`;
                    } else if (bet.playType === "PLACE") {
                        targetStr = isEn ? `🛡️ Place[No.${bet.horseNo}]` : `🛡️ 位置[${bet.horseNo}号马]`;
                    }
                    this.text(
                        betCard,
                        `${statusTag} ${isEn ? `Round #${bet.roundId}` : `第${bet.roundId}轮`} · ${targetStr}`,
                        -130,
                        14,
                        isEn ? 15 : 17,
                        statusColor,
                    );
                    this.text(
                        betCard,
                        isEn ? `Bet: ${this.formatMoney(bet.betAmount)} 🪙  |  Payout: ${this.formatMoney(bet.netReward)} 🪙` : `下注: ${this.formatMoney(bet.betAmount)} 🪙  |  奖金: ${this.formatMoney(bet.netReward)} 🪙`,
                        -130,
                        -14,
                        isEn ? 13 : 14,
                        WestColors.INK_MUTED,
                    );

                    this.saloonButton(
                        betCard,
                        isEn ? "Details" : "明细 (DOC)",
                        235,
                        0,
                        126,
                        46,
                        () => {
                            this.selectedBetOrderNo = bet.orderNo;
                            void this.show("bets");
                        },
                        false,
                        15,
                    );
                });
            }
        } catch (error) {
            this.text(
                betsBox,
                this.errorMessage(error, I18n.t("bets.loadFailed", "下注记录加载失败")),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }

        // 底部工具栏
        this.saloonButton(
            betsBox,
            isEn ? "🚪 Back to Lobby" : "🚪 返回大厅 (BACK)",
            0,
            -285,
            320,
            48,
            () => { void this.show("lobby"); },
            false,
            17,
        );

        // 下注公证审计章程卡（充实下半区空间，消除150px死寂荒原）
        const betsAuditCard = this.wantedPosterBox(betsBox, 0, -370, 660, 64, 8);
        this.text(betsAuditCard, isEn ? "⚖️ Wyoming Colt District Betting Audit Charter" : "⚖️ 怀俄明柯尔特特区下注公证审计章程", 0, 14, isEn ? 14 : 15, WestColors.INK_DARK);
        this.text(betsAuditCard, isEn ? "Locked irreversibly before gates open · Winnings credited to vault" : "所有注单在开闸前不可逆锁定赔率与稀释因子 · 派彩即时自动结算至金库", 0, -14, 12, WestColors.INK_MUTED);

        // 西部格言
        this.text(
            betsBox,
            isEn ? "🌵 Frontier Notarized Racing · Every Wager Audited 🌵" : "🌵 边境特区公证赛马 · 每一笔押注皆有据可查 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 注单详情钻取卡片（复古牛皮纸账目）。 */
    private async buildBetDetailModal(root: Node, orderNo: string): Promise<void> {
        const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
        const closeModal = () => {
            this.selectedBetOrderNo = null;
            mask.destroy();
            void this.show("bets");
        };
        this.bindClick(mask, closeModal);
        const modalBox = this.grandSaloonBox(mask, 0, 0, 660, 740, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);
        this.addModalCloseBtn(modalBox, 660, 740, closeModal);
        const isEn = I18n.getLocale() === "en-US";

        this.text(modalBox, `📜 ${I18n.t("bets.detailTitle")}`, 0, 325, 24, WestColors.GOLD_BRIGHT);

        try {
            const response = await ApiClient.get<BetDetailDto>(
                `/api/player/bets/${orderNo}`,
            );
            const { order, race } = response.data;
            let targetDesc = isEn ? `No.${order.horseNo} Horse` : `${order.horseNo} 号马`;
            if (order.playType === "TRIFECTA") {
                targetDesc = isEn ? `👑 Trifecta [${order.combination ?? `${order.horseNo}-${order.secondHorseNo}`}]` : `👑 三重彩组合 [${order.combination ?? `${order.horseNo}-${order.secondHorseNo}`}]`;
            } else if (order.playType === "EXACTA") {
                targetDesc = isEn ? `🎯 Exacta [${order.combination ?? `${order.horseNo}-${order.secondHorseNo}`}]` : `🎯 二连单精确 [${order.combination ?? `${order.horseNo}-${order.secondHorseNo}`}]`;
            } else if (order.playType === "QUINELLA" || Boolean(order.combination)) {
                targetDesc = isEn ? `🎰 Quinella [${order.combination ?? `${order.horseNo}-${order.secondHorseNo}`}]` : `🎰 连赢组合 [${order.combination ?? `${order.horseNo}-${order.secondHorseNo}`}]`;
            } else if (order.playType === "PLACE") {
                targetDesc = isEn ? `🛡️ Place [No.${order.horseNo}]` : `🛡️ 位置保底 [${order.horseNo}号马]`;
            }
            const sheet = this.wantedPosterBox(modalBox, 0, 25, 610, 540, 10);

            this.text(sheet, `${I18n.t("bets.orderNo")}${order.orderNo}`, 0, 230, 16, WestColors.INK_MUTED);
            this.text(sheet, isEn ? `Round: #${order.roundId}  |  Target: ${targetDesc}` : `轮次: 第 ${order.roundId} 轮  |  押注标的: ${targetDesc}`, 0, 190, isEn ? 16 : 19, WestColors.INK_DARK);
            this.text(sheet, isEn ? `Bet Amount: ${this.formatMoney(order.betAmount)} 🪙  |  Locked Odds: x${Number(order.lockedOdds).toFixed(2)}` : `${I18n.t("bets.betAmount")}${this.formatMoney(order.betAmount)} 🪙  |  锁定赔率: x${Number(order.lockedOdds).toFixed(2)}`, 0, 148, isEn ? 16 : 18, WestColors.INK_DARK);
            this.text(sheet, isEn ? `Gross Reward: ${this.formatMoney(order.grossReward)} 🪙` : `预期毛奖: ${this.formatMoney(order.grossReward)} 🪙`, 0, 106, isEn ? 16 : 18, WestColors.INK_DARK);
            this.text(
                sheet,
                isEn ? `Rake Fee: ${this.formatMoney(order.feeAmount)} 🪙 (${(Number(order.feeRate) * 100).toFixed(1)}%)` : `阶梯抽成: ${this.formatMoney(order.feeAmount)} 🪙 (${(Number(order.feeRate) * 100).toFixed(1)}%)`,
                0,
                64,
                isEn ? 16 : 18,
                WestColors.LEATHER_SADDLE,
            );
            this.text(sheet, isEn ? `Net Bounty: ${this.formatMoney(order.netReward)} 🪙` : `最终净派彩: ${this.formatMoney(order.netReward)} 🪙`, 0, 22, isEn ? 18 : 20, WestColors.DESERT_SAGE);

            const statusText = order.status === BetOrderStatus.Won
                ? (isEn ? "Won 🏆" : "已中奖 🏆")
                : order.status === BetOrderStatus.Lost
                ? (isEn ? "Lost ❌" : "未中奖 ❌")
                : order.status === BetOrderStatus.Refunded
                ? (isEn ? "Refunded ↩️" : "已全额退款 ↩️")
                : order.status === BetOrderStatus.Cancelled
                ? (isEn ? "Cancelled 🚫" : "已撤销作废 🚫")
                : (isEn ? "Pending ⏳" : "待结算 ⏳");
            const statusColor = order.status === BetOrderStatus.Won
                ? WestColors.DESERT_SAGE
                : order.status === BetOrderStatus.Lost
                ? WestColors.BANDANA_RED
                : order.status === BetOrderStatus.Refunded
                ? WestColors.GOLD_BRIGHT
                : order.status === BetOrderStatus.Cancelled
                ? WestColors.INK_MUTED
                : WestColors.LEATHER_SADDLE;
            this.text(sheet, isEn ? `Settlement: ${statusText}` : `结算状态: ${statusText}`, 0, -20, 19, statusColor);

            if (race?.horses && race.horses.length > 0) {
                this.text(sheet, isEn ? "Final Ranks & Finish Times:" : "各马最终名次与完赛耗时:", 0, -65, 15, WestColors.INK_MUTED);
                const sorted = [...race.horses].sort(
                    (a, b) => (a.finalRank ?? 99) - (b.finalRank ?? 99),
                );
                sorted.forEach((h, idx) => {
                    const time = h.finishTime !== null && h.finishTime !== undefined
                        ? `${Number(h.finishTime).toFixed(2)}s`
                        : "-";
                    const line = isEn ? `Rank ${h.finalRank ?? "-"}: No.${h.horseNo} (${time})` : `${h.finalRank ?? "-"}名: ${h.horseNo}号 (${time})`;
                    const yOffset = -105 - Math.floor(idx / 2) * 32;
                    const xOffset = idx % 2 === 0 ? -140 : 140;
                    this.text(sheet, line, xOffset, yOffset, 14, WestColors.INK_DARK);
                });
            }
        } catch (error) {
            this.text(
                modalBox,
                this.errorMessage(error, isEn ? "Failed to load bet details" : "获取注单详情失败"),
                0,
                0,
                22,
                WestColors.BANDANA_RED,
            );
        }

        this.saloonButton(modalBox, isEn ? "🚪 Close" : "🚪 关闭凭证 (CLOSE)", 0, -305, 240, 50, () => {
            this.selectedBetOrderNo = null;
            void this.show("bets");
        }, true, 18);
    }

    /** 公告与规则页面（边境治安官告示牌）。 */
    private async buildNotices(): Promise<void> {
        const root = this.pageRoot!;
        const isEn = I18n.getLocale() === "en-US";
        this.buildTopHud(root);
        this.buildBottomNav(root, "none");

        const noticeBox = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

        // 1. 顶部公告牌匾
        const titleBox = this.chalkboardBox(noticeBox, 0, 475, 660, 42, 6);
        this.text(titleBox, isEn ? "📢 GAZETTES & EDICTS 📢" : "📢 边境公报与特区政令 · GAZETTES 📢", 0, 0, isEn ? 18 : 20, WestColors.GOLD_BRIGHT);
        this.text(noticeBox, isEn ? "Issued by Colt Sheriff Office · Rules & Bulletins" : "柯尔特特区治安官公署签发 · 规则指引与安全公报", 0, 436, isEn ? 12 : 14, WestColors.TEXT_PARCHMENT);

        try {
            const response = await ApiClient.get<NoticeDto[]>(
                "/api/notices/active",
            );

            const notices = response.data ?? [];
            if (notices.length === 0) {
                this.text(noticeBox, I18n.t("notices.empty", "暂无系统公告"), 0, 100, 22, WestColors.TEXT_MUTED);
            } else {
                const isZh = I18n.getLocale() === "zh-CN";
                const nY = [355, 260, 165, 70, -25];
                notices.slice(0, 5).forEach((notice, index) => {
                    const y = nY[index];
                    const nCard = this.wantedPosterBox(noticeBox, 0, y, 660, 80, 8);
                    const titlePrefix = notice.isForced ? (isEn ? "🔥 [URGENT] " : "🔥 [加急] ") : "📌 ";
                    const title = (isZh ? notice.titleZh : notice.titleEn) || notice.titleZh || "";
                    const content = (isZh ? notice.contentZh : notice.contentEn) || notice.contentZh || "";

                    this.text(nCard, `${titlePrefix}${title}`, -130, 16, 17, WestColors.INK_DARK);
                    this.text(nCard, content.slice(0, 36) + (content.length > 36 ? "..." : ""), -130, -14, 12, WestColors.INK_MUTED);

                    const readBtnText = notice.isRead ? (isZh ? "已阅" : "Read") : (isZh ? "查阅" : "Read");
                    this.saloonButton(
                        nCard,
                        readBtnText,
                        235,
                        0,
                        126,
                        44,
                        () => {
                            void this.readNoticeAsync(notice.noticeId);
                        },
                        !notice.isRead,
                        15,
                    );
                });
            }
        } catch (error) {
            this.text(
                noticeBox,
                this.errorMessage(error, I18n.t("notices.loadFailed", "公告加载失败")),
                0,
                100,
                22,
                WestColors.BANDANA_RED,
            );
        }

        // 底部工具栏
        this.saloonButton(
            noticeBox,
            isEn ? "🚪 Back to Lobby" : "🚪 返回大厅 (BACK)",
            0,
            -215,
            320,
            48,
            () => { void this.show("lobby"); },
            false,
            17,
        );

        // 特区政令条例指导卡（充实下半区空间，消除150px死寂荒原）
        const noticeTip = this.wantedPosterBox(noticeBox, 0, -315, 660, 68, 8);
        this.text(noticeTip, isEn ? "📢 Wyoming Frontier Edict Ordinance" : "📢 怀俄明柯尔特特区政令公报条例", 0, 16, isEn ? 14 : 15, WestColors.INK_DARK);
        this.text(noticeTip, isEn ? "All bulletins protected by Frontier Tribunal · Comply with urgent edicts" : "特区公报受边陲治安法庭监护 · 凡加急政令发布期间，请玩家依令行事", 0, -14, 12, WestColors.INK_MUTED);

        // 西部格言
        this.text(
            noticeBox,
            isEn ? "🌵 Wyoming Press Bureau · Guarding Frontier Order 🌵" : "🌵 怀俄明柯尔特特区新闻署呈送 · 守护边境公平秩序 🌵",
            0,
            -465,
            14,
            WestColors.TEXT_MUTED,
        );
    }

    /** 检查是否有未读强制公告，有则弹出阻断式全屏模态框提示。 */
    private async checkForcedNoticeModalAsync(root: Node): Promise<void> {
        try {
            const response = await ApiClient.get<NoticeDto[]>("/api/notices/active");
            const unreadForced = response.data.find((n) => n.isForced && !n.isRead);
            if (!unreadForced) {
                return;
            }

            const isZh = I18n.getLocale() === "zh-CN";
            const title = (isZh ? unreadForced.titleZh : unreadForced.titleEn) || unreadForced.titleZh || "";
            const content = (isZh ? unreadForced.contentZh : unreadForced.contentEn) || unreadForced.contentZh || "";

            const mask = this.box(root, 360, 640, 720, 1280, new Color(0, 0, 0, 220), 0);
            const card = this.woodBox(mask, 0, 0, 640, 480, 16, WestColors.WOOD_DARK, WestColors.BRASS_FRAME);

            this.text(card, `📢 ${I18n.t("notices.forcedTitle")}`, 0, 180, 26, WestColors.BANDANA_RED);
            this.text(card, title, 0, 130, 22, WestColors.GOLD_BRIGHT);

            const contentBox = this.parchmentBox(card, 0, 20, 580, 180, 10);
            this.text(contentBox, content, 0, 0, 18, WestColors.INK_DARK);

            this.button(
                card,
                I18n.t("notices.confirmRead"),
                0,
                -160,
                300,
                52,
                async () => {
                    try {
                        await ApiClient.post(`/api/notices/${unreadForced.noticeId}/read`, {});
                    } catch {
                        // ignore network error
                    }
                    mask.destroy();
                },
                WestColors.BANDANA_RED,
                WestColors.GOLD_BRIGHT,
                20,
            );
        } catch {
            // 静默处理，避免干扰大厅正常展示
        }
    }

    /** 将玩家点击的公告标记为已读；强制公告仍由服务端决定是否需要继续提示。 */
    private async readNoticeAsync(noticeId: number): Promise<void> {
        try {
            await ApiClient.post(`/api/notices/${noticeId}/read`, {});
            this.message = I18n.t("notices.read", "公告已读");
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("notices.readFailed", "公告状态保存失败"));
        }

        await this.show("notices");
    }

    /** 设置页面（马具调校、系统偏好、金库密匙、退出登录）。 */
    private buildSettings(): void {
        const root = this.pageRoot!;
        this.buildTopHud(root);
        this.buildBottomNav(root, "battle");

        // 1. 边境电报站实木框架 (DENIM_BLUE 主调 + CREAM 浅底，总高 1030 居中)
        const box = this.grandSaloonBox(root, 360, 642, 696, 1030, 14, WestColors.DENIM_BLUE, WestColors.CREAM);
        const isEn = I18n.getLocale() === "en-US";

        // 1. 顶部黑板标题牌匾 (Y = 475, H = 40)
        const titleBox = this.chalkboardBox(box, 0, 475, 660, 40, 6);
        this.text(titleBox, I18n.t("settings.stationTitle"), 0, 0, isEn ? 16 : 18, WestColors.GOLD_BRIGHT);

        // 2. 玩家身份与版本卡片 (Y = 422, H = 50)
        const playerId = this.player?.playerId ?? 0;
        const infoCard = this.wantedPosterBox(box, 0, 422, 660, 50, 6);
        const nickLabel = isEn ? "Jockey: " : "昵称: ";
        const verLabel = isEn ? "Version: " : "版本: ";
        this.text(
            infoCard,
            `UID: ${playerId}  |  ${nickLabel}${this.player?.nickname ?? (isEn ? "Cowboy" : "牛仔")}  |  ${verLabel}v${ClientConfig.clientVersion}`,
            0,
            6,
            isEn ? 13 : 14,
            WestColors.INK_DARK,
        );
        this.text(
            infoCard,
            I18n.t("settings.registered"),
            0,
            -12,
            isEn ? 10 : 11,
            WestColors.INK_MUTED,
        );

        // 3. 边境留声机与音效音量调节卡片 (Y = 345, H = 100)
        const audioCard = this.wantedPosterBox(box, 0, 345, 660, 100, 8);
        this.text(audioCard, I18n.t("settings.audioTuner"), 0, 34, isEn ? 12 : 13, WestColors.INK_DARK);

        // BGM 这一行 (Y = 6)
        const curBgm = Math.round(WestAudio.getBgmVolume() * 100);
        this.text(audioCard, `🎵 ${I18n.t("settings.bgmMusic")} (${curBgm}%):`, isEn ? -205 : -195, 6, isEn ? 12 : 13, WestColors.INK_DARK);
        const muteText = I18n.t("settings.mute");
        const bgmSteps = [
            { label: muteText, val: 0, x: -65 },
            { label: "30%", val: 0.3, x: 10 },
            { label: "70%", val: 0.7, x: 85 },
            { label: "100%", val: 1.0, x: 160 },
        ];
        for (const step of bgmSteps) {
            const isMatch = Math.abs(WestAudio.getBgmVolume() - step.val) < 0.1;
            this.saloonButton(
                audioCard,
                step.label,
                step.x,
                6,
                65,
                26,
                () => {
                    WestAudio.setBgmVolume(step.val);
                    this.musicEnabled = step.val > 0;
                    void this.show("settings");
                },
                isMatch,
                isEn ? 10 : 11,
            );
        }

        // SFX 这一行 (Y = -24)
        const curSfx = Math.round(WestAudio.getSfxVolume() * 100);
        this.text(audioCard, `🔊 ${I18n.t("settings.sfxSound")} (${curSfx}%):`, isEn ? -205 : -195, -24, isEn ? 12 : 13, WestColors.INK_DARK);
        const sfxSteps = [
            { label: muteText, val: 0, x: -65 },
            { label: "30%", val: 0.3, x: 10 },
            { label: "70%", val: 0.7, x: 85 },
            { label: "100%", val: 1.0, x: 160 },
        ];
        for (const step of sfxSteps) {
            const isMatch = Math.abs(WestAudio.getSfxVolume() - step.val) < 0.1;
            this.saloonButton(
                audioCard,
                step.label,
                step.x,
                -24,
                65,
                26,
                () => {
                    WestAudio.setSfxVolume(step.val);
                    this.soundFxEnabled = step.val > 0;
                    if (step.val > 0) {
                        WestAudio.playRevolverCock();
                    }
                    void this.show("settings");
                },
                isMatch,
                isEn ? 10 : 11,
            );
        }

        // 4. 【v2.1 独创】日光与篝火双主题卡片 (Y = 265, H = 60)
        const themeCard = this.wantedPosterBox(box, 0, 265, 660, 60, 6);
        this.text(themeCard, I18n.t("settings.themeTitle"), 0, 14, isEn ? 12 : 13, WestColors.INK_DARK);

        const currentTheme = WestThemeManager.getUserMode();
        const themeModes: { key: ThemeMode; label: string; x: number }[] = [
            { key: "auto", label: I18n.t("settings.themeAuto"), x: -210 },
            { key: "daylight", label: I18n.t("settings.themeDaylight"), x: 0 },
            { key: "campfire", label: I18n.t("settings.themeCampfire"), x: 210 },
        ];
        for (const tm of themeModes) {
            this.saloonButton(
                themeCard,
                tm.label,
                tm.x,
                -12,
                195,
                28,
                () => {
                    WestThemeManager.setMode(tm.key);
                    this.currentSceneBg = "";
                    this.message = tm.key === "daylight"
                        ? (isEn ? "☀️ Switched to Daylight Mode" : "☀️ 已切换至日光清爽模式")
                        : tm.key === "campfire"
                            ? (isEn ? "🔥 Switched to Campfire Night Mode" : "🔥 已切换至篝火护眼模式")
                            : (isEn ? "⏰ Auto Day/Night Theme enabled" : "⏰ 已设为跟随时间模式");
                    void this.show("settings");
                },
                currentTheme === tm.key,
                isEn ? 11 : 12,
            );
        }

        // 5. 【v2.1 独创】性能预算与画质分级卡片 (Y = 195, H = 60)
        const perfCard = this.wantedPosterBox(box, 0, 195, 660, 60, 6);
        this.text(perfCard, I18n.t("settings.perfTitle"), 0, 14, isEn ? 12 : 13, WestColors.INK_DARK);

        const currentTier = WestPerformance.getTier();
        const tiers: { key: QualityTier; label: string; x: number }[] = [
            { key: "high", label: I18n.t("settings.perfHigh"), x: -230 },
            { key: "medium", label: I18n.t("settings.perfMedium"), x: -76 },
            { key: "low", label: I18n.t("settings.perfLow"), x: 76 },
            { key: "power_save", label: I18n.t("settings.perfPowerSave"), x: 230 },
        ];
        for (const t of tiers) {
            this.saloonButton(
                perfCard,
                t.label,
                t.x,
                -12,
                142,
                28,
                () => {
                    WestPerformance.setTier(t.key);
                    this.message = isEn ? `⚙️ Graphics Tier: ${t.label}` : `⚙️ 画质已调节为: ${t.label}`;
                    void this.show("settings");
                },
                currentTier === t.key,
                isEn ? 10 : 12,
            );
        }

        // 6. 多语言切换卡片 (Y = 125, H = 60)
        const langCard = this.wantedPosterBox(box, 0, 125, 660, 60, 6);
        this.text(langCard, I18n.t("settings.langTitle"), 0, 14, isEn ? 12 : 13, WestColors.INK_DARK);

        const isZh = I18n.getLocale() === "zh-CN";
        this.saloonButton(
            langCard,
            "🇨🇳 简体中文 (ZH)",
            -155,
            -13,
            290,
            32,
            () => {
                void this.saveSettingsAsync("zh-CN");
            },
            isZh,
            13,
        );
        this.saloonButton(
            langCard,
            "🇺🇸 English (EN)",
            155,
            -13,
            290,
            32,
            () => {
                void this.saveSettingsAsync("en-US");
            },
            !isZh,
            13,
        );

        // 7. 安全中心与密码更替卡片 (Y = -35, H = 205, 彻底消除与语言卡片的重叠)
        const pwdCard = this.wantedPosterBox(box, 0, -35, 660, 205, 8);
        this.text(pwdCard, I18n.t("settings.safeCombo"), 0, 82, isEn ? 13 : 14, WestColors.INK_DARK);
        this.text(pwdCard, I18n.t("settings.pwdHint"), 0, 64, isEn ? 10 : 11, WestColors.INK_MUTED);

        const oldPassword = this.input(
            pwdCard,
            I18n.t("settings.oldPwdPlaceholder"),
            0,
            28,
            500,
            34,
            "",
            true,
        );
        const newPassword = this.input(
            pwdCard,
            I18n.t("settings.newPwdPlaceholder"),
            0,
            -10,
            500,
            34,
            "",
            true,
        );
        const confirmPassword = this.input(
            pwdCard,
            I18n.t("settings.confirmNewPwdPlaceholder"),
            0,
            -48,
            500,
            34,
            "",
            true,
        );

        this.saloonButton(
            pwdCard,
            this.isSubmitting ? I18n.t("common.submitting") : I18n.t("settings.updatePwdBtn"),
            0,
            -82,
            isEn ? 330 : 310,
            32,
            () => {
                WestAudio.playRevolverCock();
                void this.changePasswordAsync(
                    oldPassword.string,
                    newPassword.string,
                    confirmPassword.string,
                );
            },
            true,
            isEn ? 13 : 14,
        );

        if (this.message) {
            this.text(box, this.message, 0, -156, 14, this.message.includes("失败") || this.message.includes("failed") ? WestColors.BANDANA_RED : WestColors.DESERT_SAGE);
        }

        // 8. 底部行动条 (退出登录 & 返回大厅，Y = -215)
        this.saloonButton(
            box,
            `🚪 ${I18n.t("settings.logout")}`,
            -165,
            -215,
            310,
            46,
            () => {
                void ApiClient.logout();
                this.signalr?.stop();
                this.message = I18n.t("settings.loggedOut", "已退出登录");
                void this.show("login");
            },
            false,
            isEn ? 13 : 15,
        );

        this.saloonButton(
            box,
            `🐎 ${I18n.t("common.backLobby")}`,
            165,
            -215,
            310,
            46,
            () => {
                void this.show("lobby");
            },
            false,
            isEn ? 13 : 15,
        );

        // 9. 西部格言 (Y = -265)
        this.text(
            box,
            I18n.t("settings.frontierRule"),
            0,
            -265,
            isEn ? 11 : 12,
            WestColors.TEXT_MUTED,
        );
    }

    /** 保存玩家语言与通知设置，并立即切换本地词典与界面。 */
    private async saveSettingsAsync(language: "zh-CN" | "en-US"): Promise<void> {
        I18n.setLocale(language);
        if (this.player) {
            this.player.locale = language;
        }

        try {
            await ApiClient.put("/api/player/settings", {
                language,
                allowPushNotice: true,
                allowResultAnimation: true,
            });
            this.message = language === "zh-CN"
                ? "语言已切换为简体中文 (ZH)"
                : "Language switched to English (EN)";
        } catch {
            this.message = language === "zh-CN"
                ? "本地已切换为中文 (离线/未保存至服务端)"
                : "Switched to English locally (offline/unsaved)";
        }

        await this.show("settings");
    }

    /** 调用服务端修改密码；服务端成功后客户端清除旧令牌。 */
    private async changePasswordAsync(
        oldPassword: string,
        newPassword: string,
        confirmNewPassword: string,
    ): Promise<void> {
        if (this.isSubmitting) {
            return;
        }
        this.isSubmitting = true;

        try {
            await ApiClient.post("/api/auth/change-password", {
                oldPassword,
                newPassword,
                confirmNewPassword,
            });
            ApiClient.clearTokens();
            this.message = I18n.t("settings.pwdSuccess", "密码修改成功，请重新登录");
            await this.show("login");
        } catch (error) {
            this.message = this.errorMessage(error, I18n.t("settings.pwdFailed", "密码修改失败"));
            await this.show("settings");
        } finally {
            this.isSubmitting = false;
        }
    }

    /** 从服务端加载当前玩家摘要。 */
    private async loadPlayer(): Promise<void> {
        const response = await ApiClient.get<PlayerSummary>("/api/player/me");
        this.player = response.data;
        if (this.player && (this.player.locale === "zh-CN" || this.player.locale === "en-US")) {
            I18n.setLocale(this.player.locale as "zh-CN" | "en-US");
        }
    }

    /** 与服务端时间同步，动画和倒计时只使用校准后的时间。 */
    private async syncTime(): Promise<void> {
        const before = Date.now();
        const response = await ApiClient.get<{ serverTime: string }>(
            "/api/race/time",
        );
        const after = Date.now();
        const serverMs = new Date(response.data.serverTime).getTime();
        this.serverOffsetMs = serverMs - Math.floor((before + after) / 2);
    }

    /** 创建不依赖数据库的幂等键。 */
    private createUuid(): string {
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.randomUUID === "function"
        ) {
            return crypto.randomUUID();
        }

        return `${Date.now().toString(16)}-${Math.random()
            .toString(16)
            .slice(2)}`;
    }

    /** 统一用户可见错误文本，避免页面重复解析 HTTP 响应。 */
    private errorMessage(error: unknown, fallback: string): string {
        if (error instanceof Error && error.message) {
            const msg = error.message;
            if (
                msg.includes("Failed to fetch") ||
                msg.includes("NetworkError") ||
                msg.includes("network") ||
                msg.includes("ECONNREFUSED")
            ) {
                return `网络异常：无法连接后端服务(${ClientConfig.apiBaseUrl})，请确认 API 服务已启动`;
            }
            if (
                msg.includes("401") ||
                msg.includes("未登录") ||
                msg.includes("PLAYER_NOT_FOUND") ||
                msg.includes("登录状态已失效")
            ) {
                return "登录状态已失效，请重新登录";
            }
            return msg;
        }
        return fallback;
    }

    /** 金额统一按两位小数展示。 */
    private formatMoney(value: number): string {
        return Number(value).toFixed(2);
    }

    /** 将服务端状态值映射成用户可见国际化文本。 */
    private stateText(state: RaceState): string {
        switch (state) {
            case RaceState.Betting:
                return I18n.t("race.stateBetting");
            case RaceState.Closed:
                return I18n.t("race.stateClosed");
            case RaceState.Preparing:
                return I18n.t("race.statePreparing");
            case RaceState.Racing:
                return I18n.t("race.stateRacing");
            case RaceState.Settlement:
                return I18n.t("race.stateSettlement");
            case RaceState.Finished:
                return I18n.t("race.stateFinished");
            case RaceState.Cancelled:
                return I18n.t("race.stateCancelled");
            default:
                return I18n.t("race.stateDefault", "等待");
        }
    }

    /** 创建统一返回按钮。 */
    private backButton(root: Node, y = 220): void {
        this.button(root, I18n.t("common.backLobby"), 360, y, 260, 65, () => {
            void this.show("lobby");
        });
    }
}

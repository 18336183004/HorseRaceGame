import {
    ApiEnvelope,
    BuybackResultDto,
    CareResultDto,
    DoubleDownResponseDto,
    FeedResultDto,
    MaintenanceDto,
    PaddockInfoDto,
    PlayerEquipmentDto,
    RanchEquipmentDto,
    RanchHorseDto,
    RepairEquipmentResultDto,
    TrainResultDto,
    TrialResultDto,
    RanchCatalogDto,
    RaceConfigDto,
} from "./ApiTypes";
import { ClientConfig } from "./ClientConfig";

/**
 * 集中处理 HTTP 请求、访问令牌轮换、超时和服务端错误。
 * 业务页面不得自行拼接 Authorization 头，也不得重复实现 refresh 流程。
 */
export class ApiClient {
    /** 返回集中配置的 API 基础地址。 */
    public static getBaseUrl(): string {
        return ClientConfig.apiBaseUrl;
    }

    /** 获取比赛全局动态配置与环境列表字典。 */
    public static async getRaceConfig(): Promise<ApiEnvelope<RaceConfigDto>> {
        return this.get<RaceConfigDto>("/api/race/config");
    }

    /** 读取赛前亮相圈贴士、赛道天气与骑师推荐。 */
    public static async getPaddockInfo(): Promise<ApiEnvelope<PaddockInfoDto>> {
        return this.get<PaddockInfoDto>("/api/race/paddock-info");
    }

    /** 比赛中途（15秒节点）对进行中的注单发起追投加倍。 */
    public static async doubleDown(orderNo: string, idempotencyKey: string): Promise<ApiEnvelope<DoubleDownResponseDto>> {
        return this.post<DoubleDownResponseDto>("/api/race/inplay/double-down", {
            orderNo,
            idempotencyKey,
        });
    }

    // ==================== 模式三：西部纯血马房 API ====================

    /** 获取牧场全量配置字典（幼驹档位、草料、训练、理疗和资格赛规则） */
    public static async getRanchCatalog(): Promise<ApiEnvelope<RanchCatalogDto>> {
        return this.get<RanchCatalogDto>("/api/ranch/catalog");
    }

    /** 认购并领养新幼驹 */
    public static async adoptFoal(customName?: string, pedigreeTier?: string, idempotencyKey?: string): Promise<ApiEnvelope<RanchHorseDto>> {
        return this.post<RanchHorseDto>("/api/ranch/horses/adopt", {
            customName: customName || undefined,
            pedigreeTier: pedigreeTier || "WILD",
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 获取当前玩家名下的所有马匹 */
    public static async getMyHorses(): Promise<ApiEnvelope<RanchHorseDto[]>> {
        return this.get<RanchHorseDto[]>("/api/ranch/horses");
    }

    /** 获取指定马匹详情 */
    public static async getHorseDetails(horseId: number): Promise<ApiEnvelope<RanchHorseDto>> {
        return this.get<RanchHorseDto>(`/api/ranch/horses/${horseId}`);
    }

    /** 饲料投喂 */
    public static async feedHorse(horseId: number, feedCode: string, idempotencyKey?: string): Promise<ApiEnvelope<FeedResultDto>> {
        return this.post<FeedResultDto>("/api/ranch/feed", {
            horseId,
            feedCode,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 专项训练 */
    public static async trainHorse(horseId: number, trainingType: string, idempotencyKey?: string): Promise<ApiEnvelope<TrainResultDto>> {
        return this.post<TrainResultDto>("/api/ranch/train", {
            horseId,
            trainingType,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 医护与钉蹄理疗 */
    public static async careHorse(horseId: number, careType: string, idempotencyKey?: string): Promise<ApiEnvelope<CareResultDto>> {
        return this.post<CareResultDto>("/api/ranch/care", {
            horseId,
            careType,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 获取马具商城目录与背包 */
    public static async getEquipmentShopAndInventory(): Promise<ApiEnvelope<{ shopCatalog: RanchEquipmentDto[]; inventory: PlayerEquipmentDto[] }>> {
        return this.get<{ shopCatalog: RanchEquipmentDto[]; inventory: PlayerEquipmentDto[] }>("/api/ranch/equipment/shop");
    }

    /** 购买并装配马具 */
    public static async buyAndEquipItem(horseId: number, equipmentItemId: number, idempotencyKey?: string): Promise<ApiEnvelope<PlayerEquipmentDto>> {
        return this.post<PlayerEquipmentDto>("/api/ranch/equipment/equip", {
            horseId,
            equipmentItemId,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 卸下马具 */
    public static async unequipItem(horseId: number, slotCategory: string): Promise<ApiEnvelope<{ unequipped: boolean; success?: boolean }>> {
        return this.post<{ unequipped: boolean; success?: boolean }>("/api/ranch/equipment/unequip", {
            horseId,
            slotCategory,
        });
    }

    /** 铁匠铺修理马具 (30% 原价) */
    public static async repairEquipment(equipmentId: number, idempotencyKey?: string): Promise<ApiEnvelope<RepairEquipmentResultDto>> {
        return this.post<RepairEquipmentResultDto>("/api/ranch/equipment/repair", {
            equipmentId,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 申请 400m 资格审查模拟试跑 */
    public static async runTrial(horseId: number, idempotencyKey?: string): Promise<ApiEnvelope<TrialResultDto>> {
        return this.post<TrialResultDto>("/api/ranch/trials/run", {
            horseId,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    /** 申请马事公会保底回购退役 */
    public static async buybackHorse(horseId: number, idempotencyKey?: string): Promise<ApiEnvelope<BuybackResultDto>> {
        return this.post<BuybackResultDto>("/api/ranch/buyback", {
            horseId,
            idempotencyKey: idempotencyKey || undefined,
        });
    }

    public static onSessionExpired: (() => void) | null = null;
    public static onMaintenance: ((notice: { message: string; maintenanceEndAt?: string }) => void) | null = null;

    private static accessToken = "";
    private static refreshToken = "";
    private static refreshPromise: Promise<boolean> | null = null;

    /** 从本地存储恢复会话令牌。 */
    public static restoreToken(): void {
        if (typeof localStorage === "undefined") {
            return;
        }

        this.accessToken = localStorage.getItem("racegame.accessToken") ?? "";
        this.refreshToken = localStorage.getItem("racegame.refreshToken") ?? "";
    }

    /** 保存服务端签发的访问令牌和刷新令牌。 */
    public static setTokens(accessToken: string, refreshToken?: string): void {
        this.accessToken = accessToken || "";

        if (refreshToken !== undefined) {
            this.refreshToken = refreshToken || "";
        }

        if (typeof localStorage === "undefined") {
            return;
        }

        localStorage.setItem("racegame.accessToken", this.accessToken);
        if (refreshToken !== undefined) {
            localStorage.setItem("racegame.refreshToken", this.refreshToken);
        }
    }

    /** 在清理本地会话前尝试撤销服务端 Refresh Token。失败也继续本地退出，避免网络故障阻塞用户。 */
    public static async logout(): Promise<void> {
        const refreshToken = this.refreshToken;
        try {
            if (this.accessToken && refreshToken) {
                await this.request("/api/auth/logout", "POST", { refreshToken }, true);
            }
        } catch {
            // 本地退出优先；服务端会话可由过期时间和刷新轮换机制自然失效。
        } finally {
            this.clearTokens();
        }
    }

    /** 清除当前玩家本地会话。 */
    public static clearTokens(): void {
        this.accessToken = "";
        this.refreshToken = "";

        if (typeof localStorage !== "undefined") {
            localStorage.removeItem("racegame.accessToken");
            localStorage.removeItem("racegame.refreshToken");
        }
    }

    /** 返回当前访问令牌。 */
    public static getAccessToken(): string {
        return this.accessToken;
    }

    /** 返回当前刷新令牌。 */
    public static getRefreshToken(): string {
        return this.refreshToken;
    }

    /** 发起 GET 请求，并在 401 时自动执行一次 Refresh Token 轮换。 */
    public static async get<T>(path: string, retry = true): Promise<ApiEnvelope<T>> {
        const response = await this.request(path, "GET", undefined);

        if (response.status === 401 && retry && this.refreshToken) {
            if (await this.refresh()) {
                return this.get<T>(path, false);
            }
        }

        if (response.status === 401 || (response.status === 404 && path.startsWith("/api/player/me"))) {
            this.clearTokens();
            this.onSessionExpired?.();
        }

        return this.parseResponse<T>(response);
    }

    /** 发起 JSON POST 请求，并在 401 时自动执行一次 Refresh Token 轮换。 */
    public static async post<T>(
        path: string,
        body: unknown,
        retry = true,
    ): Promise<ApiEnvelope<T>> {
        const response = await this.request(path, "POST", body);

        if (response.status === 401 && retry && this.refreshToken) {
            if (await this.refresh()) {
                return this.post<T>(path, body, false);
            }
        }

        if (response.status === 401) {
            this.clearTokens();
            this.onSessionExpired?.();
        }

        return this.parseResponse<T>(response);
    }

    /** 发起 JSON PUT 请求，并在 401 时自动执行一次 Refresh Token 轮换。 */
    public static async put<T>(
        path: string,
        body: unknown,
        retry = true,
    ): Promise<ApiEnvelope<T>> {
        const response = await this.request(path, "PUT", body);

        if (response.status === 401 && retry && this.refreshToken) {
            if (await this.refresh()) {
                return this.put<T>(path, body, false);
            }
        }

        if (response.status === 401) {
            this.clearTokens();
            this.onSessionExpired?.();
        }

        return this.parseResponse<T>(response);
    }

    /** 单飞刷新：多个同时过期的请求只允许一个 Refresh Token 请求执行。 */
    public static async refresh(): Promise<boolean> {
        if (!this.refreshToken) {
            return false;
        }

        if (this.refreshPromise) {
            return this.refreshPromise;
        }

        this.refreshPromise = this.refreshInternal();

        try {
            return await this.refreshPromise;
        } finally {
            this.refreshPromise = null;
        }
    }

    private static async refreshInternal(): Promise<boolean> {
        try {
            const response = await this.request(
                "/api/auth/refresh",
                "POST",
                {
                    refreshToken: this.refreshToken,
                    clientPlatform: "cocos",
                    clientVersion: ClientConfig.clientVersion,
                },
                false,
            );

            if (!response.ok) {
                this.clearTokens();
                this.onSessionExpired?.();
                return false;
            }

            const payload = await this.parseResponse<{ accessToken: string; refreshToken: string }>(
                response,
            );

            this.setTokens(payload.data.accessToken, payload.data.refreshToken);
            return true;
        } catch {
            this.clearTokens();
            this.onSessionExpired?.();
            return false;
        }
    }

    private static async request(
        path: string,
        method: "GET" | "POST" | "PUT",
        body?: unknown,
        includeAuth = true,
    ): Promise<Response> {
        const controller = typeof AbortController !== "undefined"
            ? new AbortController()
            : undefined;

        const timer = controller
            ? setTimeout(() => controller.abort(), 10000)
            : undefined;

        try {
            const headers: Record<string, string> = {
                Accept: "application/json",
            };

            if (body !== undefined) {
                headers["Content-Type"] = "application/json";
            }

            if (includeAuth && this.accessToken) {
                headers.Authorization = `Bearer ${this.accessToken}`;
            }

            return await fetch(ClientConfig.apiBaseUrl + path, {
                method,
                headers,
                body: body === undefined ? undefined : JSON.stringify(body),
                signal: controller?.signal,
            });
        } catch (error) {
            if (error instanceof Error && error.name === "AbortError") {
                throw new Error("请求超时，请检查网络连接");
            }
            throw error;
        } finally {
            if (timer !== undefined) {
                clearTimeout(timer);
            }
        }
    }

    private static async parseResponse<T>(response: Response): Promise<ApiEnvelope<T>> {
        const text = await response.text();
        let payload: ApiEnvelope<T> | null = null;

        if (text) {
            try {
                payload = JSON.parse(text) as ApiEnvelope<T>;
            } catch {
                payload = null;
            }
        }

        if (!response.ok) {
            if (response.status === 503) {
                const maintenanceMsg = payload?.message ?? "系统维护中，请稍后重试";
                const maintData = payload?.data as MaintenanceDto | undefined;
                const endAt = maintData?.maintenanceEndAt ?? undefined;
                this.onMaintenance?.({ message: maintenanceMsg, maintenanceEndAt: endAt });
                throw new Error(maintenanceMsg);
            }
            const isSessionExpired = response.status === 401 || (response.status === 404 && response.url && response.url.includes("/api/player/me"));
            const message = payload?.message ?? (isSessionExpired ? "登录状态已失效，请重新登录" : `HTTP ${response.status}`);
            throw new Error(message);
        }

        if (!payload || (payload.code !== 0 && payload.code !== "0")) {
            throw new Error(payload?.message ?? "服务器返回了无效响应");
        }

        return payload;
    }
}

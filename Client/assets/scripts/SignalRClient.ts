import { RaceEventPayload } from "./ApiTypes";

/**
 * 无第三方依赖的 SignalR JSON/WebSocket 客户端。
 * 只实现当前项目需要的 handshake、invocation、断线重连和轮次分组加入。
 */
export type SignalRHandler = (payload: RaceEventPayload) => void;
export type SignalRConnectionState = "CONNECTED" | "RECONNECTING" | "DISCONNECTED";

/** 管理单个玩家的比赛实时连接。 */
export class SignalRClient {
    private static readonly RecordSeparator = "\u001e";
    private socket: WebSocket | null = null;
    private stopped = false;
    private reconnectDelay = 500;
    private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    /** Ping 超时看门狗：30s 内未收到服务端 type=6 Ping 则主动断连触发重连 */
    private pingTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
    private static readonly PING_TIMEOUT_MS = 30000;
    private roundId: number | null = null;
    private readonly handlers = new Map<string, SignalRHandler[]>();
    private connectPromise: Promise<void> | null = null;
    private connectionState: SignalRConnectionState = "DISCONNECTED";
    private latencyMs = 35;
    private lastPingTimestamp = 0;

    public getConnectionState(): SignalRConnectionState {
        return this.connectionState;
    }

    public getLatencyMs(): number {
        return this.latencyMs;
    }

    public isConnected(): boolean {
        return this.connectionState === "CONNECTED" && this.socket?.readyState === WebSocket.OPEN;
    }

    public constructor(
        private readonly url: string,
        private readonly accessTokenProvider: () => string,
    ) {}

    /** 注册事件处理器。 */
    public on(name: string, handler: SignalRHandler): this {
        const handlers = this.handlers.get(name) ?? [];
        handlers.push(handler);
        this.handlers.set(name, handlers);
        return this;
    }

    /** 注销事件处理器。未指定 handler 时移除该事件下的全部处理器。 */
    public off(name: string, handler?: SignalRHandler): this {
        if (!handler) {
            this.handlers.delete(name);
            return this;
        }

        const handlers = this.handlers.get(name);
        if (handlers) {
            const index = handlers.indexOf(handler);
            if (index !== -1) {
                handlers.splice(index, 1);
            }
            if (handlers.length === 0) {
                this.handlers.delete(name);
            }
        }
        return this;
    }

    /** 清空所有已注册的事件处理器。 */
    public clearHandlers(): this {
        this.handlers.clear();
        return this;
    }

    /** 启动连接并可选加入指定轮次分组。 */
    public async start(roundId?: number): Promise<void> {
        if (roundId !== undefined) {
            this.roundId = roundId;
        }

        const rawToken = this.accessTokenProvider?.() ?? "";
        if (!rawToken) {
            // 未登录或缺少 Token 时静默放弃连接，不发起无效握手
            return;
        }

        this.stopped = false;
        await this.connect();
    }

    /** 主动关闭连接并清理定时器，不再自动重连。 */
    public stop(): void {
        this.stopped = true;
        this.connectionState = "DISCONNECTED";
        this.clearPingTimeout();
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
            this.reconnectTimer = null;
        }
        this.socket?.close();
        this.socket = null;
    }

    /** 更新当前轮次；连接已经建立时立即重新加入分组。 */
    public setRound(roundId: number): void {
        const oldRoundId = this.roundId;
        this.roundId = roundId;

        if (this.socket?.readyState === WebSocket.OPEN) {
            if (oldRoundId !== null && oldRoundId !== roundId) {
                this.invoke("LeaveRound", [oldRoundId]);
            }
            this.invoke("JoinRound", [roundId]);
        }
    }

    private connect(): Promise<void> {
        if (this.socket?.readyState === WebSocket.OPEN) {
            return Promise.resolve();
        }

        if (this.connectPromise) {
            return this.connectPromise;
        }

        const promise = new Promise<void>((resolve, reject) => {
            const rawToken = this.accessTokenProvider?.() ?? "";
            if (!rawToken) {
                resolve();
                return;
            }
            const token = encodeURIComponent(rawToken);
            const separator = this.url.includes("?") ? "&" : "?";
            const wsUrl = this.url.replace(/^http/i, "ws") +
                `${separator}access_token=${token}`;

            let socket: WebSocket;
            try {
                socket = new WebSocket(wsUrl);
            } catch (err) {
                this.connectionState = "DISCONNECTED";
                reject(err instanceof Error ? err : new Error("SignalR WebSocket初始化失败"));
                return;
            }
            this.socket = socket;
            let opened = false;
            const connectStartTime = Date.now();
            this.connectionState = "RECONNECTING";

            socket.onopen = () => {
                opened = true;
                this.connectionState = "CONNECTED";
                this.latencyMs = Math.max(1, Math.min(999, Date.now() - connectStartTime));
                this.reconnectDelay = 500;
                this.resetPingTimeout(socket);
                socket.send(JSON.stringify({ protocol: "json", version: 1 }) + SignalRClient.RecordSeparator);

                if (this.roundId !== null) {
                    this.invoke("JoinRound", [this.roundId]);
                }

                this.emit("Connected", { latencyMs: this.latencyMs });
                resolve();
            };

            socket.onmessage = (event) => {
                this.handleMessage(String(event.data));
            };

            socket.onerror = () => {
                if (!opened) {
                    this.connectionState = "DISCONNECTED";
                    reject(new Error("SignalR连接失败"));
                }
            };

            socket.onclose = () => {
                this.clearPingTimeout();
                if (this.socket === socket) {
                    this.socket = null;
                }
                this.connectionState = this.stopped ? "DISCONNECTED" : "RECONNECTING";
                this.emit("Disconnected", {});

                const currentToken = this.accessTokenProvider?.() ?? "";
                if (!this.stopped && currentToken) {
                    this.scheduleReconnect();
                }
            };
        });

        this.connectPromise = promise.finally(() => {
            this.connectPromise = null;
        });

        return this.connectPromise;
    }

    private scheduleReconnect(): void {
        this.connectionState = "RECONNECTING";
        this.emit("Reconnecting", {});
        if (this.reconnectTimer !== null) {
            clearTimeout(this.reconnectTimer);
        }

        const delay = this.reconnectDelay;
        this.reconnectDelay = Math.min(this.reconnectDelay * 2, 5000);

        this.reconnectTimer = setTimeout(() => {
            this.reconnectTimer = null;
            if (!this.stopped) {
                void this.connect();
            }
        }, delay);
    }

    private invoke(target: string, args: unknown[]): void {
        if (!this.socket || this.socket.readyState !== WebSocket.OPEN) {
            return;
        }

        this.socket.send(
            JSON.stringify({
                type: 1,
                target,
                arguments: args,
            }) + SignalRClient.RecordSeparator,
        );
    }

    private handleMessage(raw: string): void {
        for (const frame of raw.split(SignalRClient.RecordSeparator)) {
            if (!frame) {
                continue;
            }

            try {
                const message = JSON.parse(frame) as {
                    type?: number;
                    target?: string;
                    arguments?: unknown[];
                    error?: string;
                };

                if (message.type === 6 && this.socket?.readyState === WebSocket.OPEN) {
                    const now = Date.now();
                    if (this.lastPingTimestamp > 0) {
                        const sample = Math.max(8, Math.min(600, Math.round((now - this.lastPingTimestamp) / 300)));
                        this.latencyMs = Math.round(this.latencyMs * 0.7 + sample * 0.3);
                    }
                    this.lastPingTimestamp = now;
                    // 回应 Pong 并重置看门狗计时器
                    this.socket.send(JSON.stringify({ type: 6 }) + SignalRClient.RecordSeparator);
                    this.resetPingTimeout(this.socket);
                    this.emit("PingLatency", { latencyMs: this.latencyMs });
                } else if (message.type === 1 && message.target) {
                    const payload = message.arguments?.[0];
                    this.emit(message.target, this.toEventPayload(payload));
                } else if (message.type === 3 && message.error) {
                    this.emit("Error", { serverTime: undefined });
                }
            } catch {
                this.emit("Error", {});
            }
        }
    }

    private toEventPayload(payload: unknown): RaceEventPayload {
        if (!payload || typeof payload !== "object") {
            return {};
        }

        const value = payload as Record<string, unknown>;
        return {
            roundId: typeof value.roundId === "number" ? value.roundId : undefined,
            roundNo: typeof value.roundNo === "string" ? value.roundNo : undefined,
            state: typeof value.state === "number" ? value.state : undefined,
            serverTime: typeof value.serverTime === "string" ? value.serverTime : undefined,
            message: typeof value.message === "string" ? value.message : undefined,
            reason: typeof value.reason === "string" ? value.reason : undefined,
            maintenanceStartAt: typeof value.maintenanceStartAt === "string" ? value.maintenanceStartAt : null,
            maintenanceEndAt: typeof value.maintenanceEndAt === "string" ? value.maintenanceEndAt : null,
            winnerHorseNo: typeof value.winnerHorseNo === "number" ? value.winnerHorseNo : null,
            secondHorseNo: typeof value.secondHorseNo === "number" ? value.secondHorseNo : null,
            quinellaCombination: typeof value.quinellaCombination === "string" ? value.quinellaCombination : null,
            bettingStartAt: typeof value.bettingStartAt === "string" ? value.bettingStartAt : undefined,
            bettingEndAt: typeof value.bettingEndAt === "string" ? value.bettingEndAt : undefined,
            prepareStartAt: typeof value.prepareStartAt === "string" ? value.prepareStartAt : null,
            raceStartAt: typeof value.raceStartAt === "string" ? value.raceStartAt : null,
            raceEndAt: typeof value.raceEndAt === "string" ? value.raceEndAt : null,
            horses: Array.isArray(value.horses) ? value.horses as RaceEventPayload["horses"] : undefined,
            durationMs: typeof value.durationMs === "number" ? value.durationMs : undefined,
            gapTime: typeof value.gapTime === "number" ? value.gapTime : undefined,
            horse1: typeof value.horse1 === "number" ? value.horse1 : undefined,
            horse2: typeof value.horse2 === "number" ? value.horse2 : undefined,
            totalPool: typeof value.totalPool === "number" ? value.totalPool : undefined,
            rainBonusPerUser: typeof value.rainBonusPerUser === "number" ? value.rainBonusPerUser : undefined,
        };
    }

    private emit(name: string, payload: RaceEventPayload): void {
        for (const handler of this.handlers.get(name) ?? []) {
            try {
                handler(payload);
            } catch {
                // 单个页面处理器异常不能中断其他实时订阅。
            }
        }
    }

    /**
     * 重置/启动 Ping 超时看门狗。
     * 每次收到 type=6 Ping 时调用，重新计时 30s。
     * 超时未收到 Ping 则强制关闭 socket，触发现有的重连机制。
     */
    private resetPingTimeout(socket: WebSocket): void {
        this.clearPingTimeout();
        this.pingTimeoutTimer = setTimeout(() => {
            this.pingTimeoutTimer = null;
            if (!this.stopped && socket.readyState === WebSocket.OPEN) {
                // 静默关闭，onclose 回调会触发 scheduleReconnect
                socket.close(4000, "Ping timeout");
            }
        }, SignalRClient.PING_TIMEOUT_MS);
    }

    private clearPingTimeout(): void {
        if (this.pingTimeoutTimer !== null) {
            clearTimeout(this.pingTimeoutTimer);
            this.pingTimeoutTimer = null;
        }
    }
}

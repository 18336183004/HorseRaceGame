import { Component, Label, _decorator } from "cc";
import { ApiClient } from "./ApiClient";
import { ClientConfig } from "./ClientConfig";
import { HorseManager } from "./HorseManager";
import {
    PlaceBetResponse,
    RaceRoundDto,
    RaceState,
} from "./ApiTypes";
import { SignalRClient } from "./SignalRClient";

const { ccclass, property } = _decorator;

/**
 * 可选的场景式比赛控制器。
 * GameApp 使用动态轻量 UI；如果正式场景改回节点绑定，可以直接使用本组件。
 */
@ccclass("RaceManager")
export class RaceManager extends Component {
    @property(Label)
    public stateLabel: Label | null = null;

    @property(Label)
    public countdownLabel: Label | null = null;

    @property(Label)
    public balanceLabel: Label | null = null;

    @property(Label)
    public messageLabel: Label | null = null;

    @property(HorseManager)
    public horseManager: HorseManager | null = null;

    private round: RaceRoundDto | null = null;
    private serverOffsetMs = 0;
    private signalr: SignalRClient | null = null;
    private signalrRoundId = 0;
    private animationLoadedRound = 0;

    /** 启动比赛控制器并恢复登录状态。 */
    public async startRace(): Promise<void> {
        ApiClient.restoreToken();

        if (!ApiClient.getAccessToken() && ApiClient.getRefreshToken()) {
            await ApiClient.refresh();
        }

        try {
            await this.syncTime();
            await this.refresh();
        } catch (error) {
            this.message(this.errorMessage(error, "比赛初始化失败"));
        }
    }

    /** 场景销毁时停止实时连接和轮次刷新，避免后台继续占用网络资源。 */
    protected onDestroy(): void {
        this.signalr?.stop();
        this.signalr = null;
        this.round = null;
    }

    /** 阶段倒计时与马匹动画表现计算；不在此处发起网络请求。 */
    public update(_deltaTime: number): void {
        if (!this.round) {
            return;
        }

        const now = Date.now() + this.serverOffsetMs;
        const target = this.getTarget();
        const seconds = target === null
            ? 0
            : Math.max(0, Math.ceil((target.getTime() - now) / 1000));

        if (this.countdownLabel) {
            this.countdownLabel.string = `${seconds}s`;
        }

        if (this.stateLabel) {
            this.stateLabel.string = this.stateText(this.round.state);
        }

        if (this.round.state === RaceState.Racing) {
            this.horseManager?.sync(now);
        }
    }

    /** 提交一笔服务端权威下注。 */
    public async placeBet(
        horseNo: number,
        amount: number,
    ): Promise<PlaceBetResponse | null> {
        if (!this.round || this.round.state !== RaceState.Betting) {
            this.message("当前不可下注");
            return null;
        }

        try {
            const response = await ApiClient.post<PlaceBetResponse>(
                "/api/race/bet",
                {
                    roundId: this.round.id,
                    horseNo,
                    amount,
                    idempotencyKey: this.createUuid(),
                },
            );

            this.message(`下注成功：${response.data.orderNo}`);

            if (this.balanceLabel) {
                this.balanceLabel.string = response.data.balance.toFixed(2);
            }

            return response.data;
        } catch (error) {
            this.message(this.errorMessage(error, "下注失败"));
            return null;
        }
    }

    private async refresh(): Promise<void> {
        try {
            const response = await ApiClient.get<RaceRoundDto | null>(
                "/api/race/current",
            );

            if (!response.data) {
                return;
            }

            this.round = response.data;
            this.connectSignalR();

            if (this.round.state === RaceState.Racing) {
                await this.loadAnimation();
            }
        } catch {
            this.message("网络暂时不可用，正在重试");
        }
    }

    private async loadAnimation(): Promise<void> {
        if (
            !this.round ||
            this.animationLoadedRound === this.round.id ||
            !this.round.raceStartAt
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

            this.horseManager?.play(
                response.data.animations,
                new Date(response.data.raceStartAt).getTime(),
            );
            this.animationLoadedRound = this.round.id;
        } catch {
            this.message("比赛动画参数加载失败");
        }
    }

    private connectSignalR(): void {
        if (!this.round || !ApiClient.getAccessToken()) {
            return;
        }

        if (
            this.signalr &&
            this.signalrRoundId === this.round.id
        ) {
            return;
        }

        this.signalr?.stop();
        this.signalr = new SignalRClient(
            `${ApiClient.getBaseUrl()}/raceHub`,
            () => ApiClient.getAccessToken(),
        );
        this.signalrRoundId = this.round.id;

        const refresh = async (): Promise<void> => {
            await this.refresh();
        };

        this.signalr
            .on("RaceBettingStarted", refresh)
            .on("RacePreparing", refresh)
            .on("RaceStarted", refresh)
            .on("RaceFinished", refresh)
            .on("RaceSettled", refresh)
            .on("RaceSkipped", refresh);

        void this.signalr.start(this.round.id).catch(() => undefined);
    }

    private async syncTime(): Promise<void> {
        const before = Date.now();
        const response = await ApiClient.get<{ serverTime: string }>(
            "/api/race/time",
        );
        const after = Date.now();

        this.serverOffsetMs =
            new Date(response.data.serverTime).getTime() -
            Math.floor((before + after) / 2);
    }

    private getTarget(): Date | null {
        if (!this.round) {
            return null;
        }

        if (this.round.state === RaceState.Betting) {
            return new Date(this.round.bettingEndAt);
        }

        if (
            this.round.state === RaceState.Preparing &&
            this.round.raceStartAt
        ) {
            return new Date(this.round.raceStartAt);
        }

        if (
            this.round.state === RaceState.Racing &&
            this.round.raceEndAt
        ) {
            return new Date(this.round.raceEndAt);
        }

        return null;
    }

    private stateText(state: RaceState): string {
        switch (state) {
            case RaceState.Betting:
                return "下注中";
            case RaceState.Preparing:
                return "准备";
            case RaceState.Racing:
                return "比赛中";
            case RaceState.Settlement:
                return "结算";
            case RaceState.Finished:
                return "已完成";
            case RaceState.Cancelled:
                return "已取消";
            default:
                return "等待";
        }
    }

    private message(text: string): void {
        if (this.messageLabel) {
            this.messageLabel.string = text;
        }
    }

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

    private errorMessage(error: unknown, fallback: string): string {
        return error instanceof Error && error.message
            ? error.message
            : fallback;
    }
}

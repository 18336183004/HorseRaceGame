import { Component, _decorator } from "cc";
import { HorseController } from "./HorseController";

const { ccclass } = _decorator;

/**
 * 六匹马的表现层容器。
 * 不计算赛果，只负责把服务端动画参数分发给对应 HorseController。
 */
@ccclass("HorseManager")
export class HorseManager extends Component {
    private readonly horses = new Map<number, HorseController>();

    /** 注册指定赛道的马匹控制器。 */
    public register(horseNo: number, controller: HorseController): void {
        this.horses.set(horseNo, controller);
    }

    /** 使用服务端结果启动全部马匹动画。 */
    public play(
        items: Array<{ horseNo: number; finishTime: number; runningStyle?: string }>,
        raceStartMs: number,
        seed = 0,
        isQuinellaMode = false,
    ): void {
        for (const item of items) {
            this.horses
                .get(item.horseNo)
                ?.init(item.finishTime, raceStartMs, item.horseNo, seed, isQuinellaMode, item.runningStyle);
        }
    }

    /** 每帧同步表现进度；这里只读取时间，不发网络请求。 */
    public sync(nowMs: number): void {
        for (const controller of this.horses.values()) {
            controller.syncToServer(nowMs);
        }
    }

    /** 将所有马直接移动到终点。 */
    public stopAll(): void {
        for (const controller of this.horses.values()) {
            controller.stopAtFinish();
        }
    }

    /** 将所有马复位到起点。 */
    public reset(): void {
        for (const controller of this.horses.values()) {
            controller.reset();
        }
    }
}

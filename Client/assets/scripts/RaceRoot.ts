import { Component, Layers, UITransform, _decorator } from "cc";
import { GameApp } from "./GameApp";

const { ccclass, property } = _decorator;

/**
 * 客户端根组件。
 *
 * 正式场景可以把 GameApp 作为编辑器属性绑定；如果没有绑定，
 * 组件会在启动时自动补齐，保证轻量原型场景无需额外节点脚本。
 *
 * 同时确保节点拥有 UITransform 组件（720×1280, anchor 0.5×0.5），
 * 这是 Cocos 3.8 2D UI 层级中坐标传播和触控命中检测的必要条件。
 */
@ccclass("RaceRoot")
export class RaceRoot extends Component {
    /** 可选的游戏主控制器绑定。 */
    @property(GameApp)
    public gameApp: GameApp | null = null;

    /** 启动时确保 GameApp 存在、节点处于 UI_2D 渲染层并拥有 UITransform。 */
    public start(): void {
        this.node.layer = Layers.Enum.UI_2D;

        // 确保 RaceRoot 节点拥有 UITransform，否则子节点触控坐标变换不正确
        if (!this.node.getComponent(UITransform)) {
            const uiTrans = this.node.addComponent(UITransform);
            uiTrans.setContentSize(720, 1280);
            uiTrans.setAnchorPoint(0.5, 0.5);
        }

        if (!this.gameApp) {
            this.gameApp = this.node.addComponent(GameApp);
        }
    }
}

# Cocos Creator 3.8.8 场景节点结构 V2.0

## 1. 实际场景

当前 `Client/assets/Main.scene.scene` 是轻量启动场景，核心业务 UI 在 `GameApp` 运行时动态创建，不要求把所有页面预制成静态节点。

```text
Scene
└─ Canvas
   ├─ Camera
   └─ RaceRoot
      └─ GameApp
```

## 2. 运行时页面

`GameApp` 创建以下页面：

- Login / Register
- Lobby
- Wallet
- Race
- Result
- Tasks
- Stable
- Characters
- Ranking
- Shop
- Bets
- Notices
- Settings

## 3. 兼容约束

- 设计分辨率：720×1280；
- Cocos Creator：3.8.8；
- `RaceRoot` 必须挂载 `RaceRoot.ts`；
- `GameApp` 负责动态 UI；
- 赛马节点由 `HorseController`/`RaceManager` 动态生成或绑定；
- 服务端赛果、赔率、余额不得由场景脚本自行决定。

## 4. 原型融合

上传原型中的顶部 HUD、中心赛场、底部五 Tab、马匹卡片、结果弹窗等均属于运行时 UI，不应再通过修改 `Main.scene.scene` 硬编码业务逻辑。

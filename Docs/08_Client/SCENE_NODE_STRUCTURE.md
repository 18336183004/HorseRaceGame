# Cocos Creator 3.8.8 场景节点与 3D 渲染管线结构 V2.0

## 1. 实际场景节点结构

`Client/assets/Main.scene.scene` 采用 3D 赛马竞技场与 2D UI 混合分层渲染管线：

```text
Scene
├─ Main Light (DirectionalLight, DEFAULT 3D日光光照)
├─ Main Camera (Camera, 透视投影 45° FOV, 优先级 0, 渲染 DEFAULT 层 3D 赛场)
├─ Arena3DRoot (RaceTrack3D 赛道/看台/闸门/终点桁架 + 6 匹 HorseEntity3D 纯血马实体)
└─ Canvas (2D 屏幕画布, 优先级 1073741824, clearFlags: DEPTH_ONLY, 仅渲染 UI_2D)
   ├─ Camera (2D 正交相机, 负责上层 UI 叠加)
   └─ RaceRoot (挂载 RaceRoot.ts)
      └─ GameApp (负责 2D 业务界面、下注面板、弹窗与 3D 导播运镜驱动)
```

## 2. 3D 渲染管线与动态导播系统

- **3D 赛马实体 (`HorseEntity3D`)**：
  采用 18~20 世纪纯血赛马解剖学多面体骨架，四肢多级铰接动力学关节，支持 Gallop/Sprint/Trot/Stand/Rear/Graze/Buck/Sliding_Stop 步态，包含 1~20 匹权威被毛、鬃尾、马蹄角质与骑师彩衣配色，真实 3D 蹄下沙尘粒子。
- **3D 赛马跑道 (`RaceTrack3D`)**：
  6 条物理道次、Turf/Dirt/Sand 材质切换、经典双层白色木护栏、起跑六联装机械闸箱、终点跨赛道金属龙门架与红外激光标尺、外场观礼大看台。
- **3D 导播运镜 (`CameraDirector3D`)**：
  支持广播全景 (Panoramic)、领头马跟拍 (Chase)、鸟瞰全局 (Overview)、终点定格 (Photo Finish) 4 大镜头平滑切换与跟随。
- **3D 图鉴/马房展台 (`HorseVisual3D`)**：
  采用独立 3D 舞台渲染管线 (`Showcase3DStage`) 与 512x512 高保真 `RenderTexture`，离屏渲染映射至 2D UI 节点的 `Sprite` 组件，支持 360° 触控拖拽水平旋转检赏、多姿态演绎与匀速慢自转。
- **3D/2D 模式无缝切换与视口映射**：
  在 720×1280 设计分辨率下，赛场视口由 `Main Camera` 视窗矩形 `cam.rect = Rect(12/720, 704/1280, 696/720, 360/1280)` 裁剪于竞技场视窗；其他分辨率按实际可见宽高换算。`RaceTrack2D` 与 `GameApp` 联动提供一键 `🎲 3D赛场` 与 `⚡ 2D经典` 模式切换。

## 3. 运行时页面

`GameApp` 负责以下 2D 悬浮 UI 页面：

- Login / Register
- Lobby
- Wallet
- Race (悬浮于 3D 赛场上方，提供解说、排位看板、运镜与 3D/2D 切换)
- Result
- Tasks
- Stable (集成 3D 展台 RenderTexture 互动)
- Characters
- Ranking
- Shop
- Bets
- Notices
- Settings

### Race 页面布局

`GameApp.ts` 中的 `RACE_PAGE_LAYOUT` 统一管理赛场布局，背景透明窗口、2D 赛道与 3D 相机共用赛场边界。页面节点保持原有名称与层级。

| 区域 | 设计坐标 / 尺寸 | 说明 |
| --- | --- | --- |
| `TopHudContainer` | 沿用顶部安全区定位 | 玩家资料、余额、设置 |
| `SaloonHeaderBar` | 中心 `(360, 1148)`，`696×64` | 两行轮次信息、独立倒计时、近期赛果 |
| `RaceToolsSubBar` | 中心 `(360, 1092)`，`696×38` | 晨报、奖池、公平核验、派彩说明 |
| `ArenaTrackBox` | 中心 `(360, 884)`，`696×360` | 2D / 3D 赛场共享窗口，底边 `704` |
| `InPlayInteractiveBar` / `InPlayDoubleDownBtn` | 中心高度 `684` | 助威位于左右，追投居中，触控区域互不覆盖 |
| `SaloonBettingDesk` | 中心 `(360, 388)`，`696×552` | 玩法 → 倍数 → 选号 → 预估 → 筹码 → 金额与确认 → 辅助入口 → 消息 |
| `BottomNavContainer` | 沿用底部安全区定位 | 常驻导航；下注台随底部安全区缩放并避让 |

独赢、位置使用两列三行卡片，列间距 `12`、行间距 `8`。连赢组合与赔率改为同一行；二连单、三重彩保留各自的名次选择行。规则按钮统一位于玩法栏，图鉴和骑师推介统一位于选号标题行。未选号提示与收益预估共用账单区域，彩金资格与系统消息共用底部消息栏，避免叠加遮挡。马名、赔率预估、解说和动态消息使用有明确尺寸的单行文本区域。

## 4. 兼容约束

- 设计分辨率：720×1280；
- Cocos Creator：3.8.8；
- 3D 与 2D 层级隔离：3D 物体处于 `Layers.Enum.DEFAULT`，UI 处于 `Layers.Enum.UI_2D`；
- 2D 相机 `clearFlags` 设为 `DEPTH_ONLY`，确保 3D 赛场画面不被背景颜色冲刷；
- 独立 3D 展台使用 `RenderTexture` 隔绝世界坐标系缩放差异，防止 3D 实体与 2D UI 坐标混淆；
- 服务端赛果、赔率、余额由后端权威决定，客户端严格进行表现层插值与运镜。

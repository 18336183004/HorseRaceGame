# 赛马美术批量生产套件 (horse_art_batch)

面向需求「**一次性生成 180 张图（20 匹成年马正/侧/背、20 匹小马各 4 阶段）**」的一体化流水线。

## 180 张的精确构成

| 类别 | 数量 | 说明 |
|---|---|---|
| 成年马 正/侧/背 单图 | 20 × 3 = 60 | `Hxx_*_Ortho_Front/Side/Back.png`，AI 原创 |
| 成年马 油画展示立绘 | 20 | `Hxx_*_Showcase.png`，AI 原创 |
| 成年马 透明跑道精灵 | 20 | `Hxx_*_Sprite.png`，**由侧视图自动抠图生成** |
| 小马 4 生长阶段单图 | 20 × 4 = 80 | `Fxx_*_Stage{1-4}_*.png`，AI 原创 |
| **合计** | **180** | 数据源 = `Database/DeployInit/002_seed_data.sql` |

> 游戏数据库实际注册 **40 匹小马**（`ranch_horses` 表）。本套件默认首批 20 匹 = 180 张；
> 若要覆盖全部 40 匹，用 `--foals 40`（共 260 张）。
> 成年马共 20 匹（`horse_catalogs` 表，H01–H20），其中 **H13–H20 目前仍复用旧图，本次需生成独有立绘**。

## 目录

- `horse_art_batch.py` —— 主脚本（数据、清单、提示词、后处理、注册表输出）
- `manifest_adults.csv` —— 20 匹成年马完整美术清单（含每张图文件名）
- `manifest_foals.csv` —— 小马清单（默认 20 匹 × 4 阶段）
- `prompts/*.md` —— 每匹马一个中英双语 AI 生图提示词（40 个）
- `input/` —— AI 生成图放置目录（`adults/`、`foals/`、`grids/`）

## 使用步骤

### 1. 生成清单与提示词

```bash
python tools/horse_art_batch/horse_art_batch.py --build-manifests --foals 20
python tools/horse_art_batch/horse_art_batch.py --build-prompts    --foals 20
```

得到 `manifest_adults.csv`、`manifest_foals.csv` 与 `prompts/` 下 40 个提示词。

### 2. 用 AI 工具生成图片

- 把 `prompts/H01_CrimsonMeteor.md` … 等提示词逐张喂给 AI 生图工具（ChatGPT / Midjourney / SD 均可）。
- 每匹马生成 4 张图：正面、侧面、背面、展示立绘；小马生成 4 阶段侧面图。
- 也可以让 AI 一次输出 3×4 网格图集，再用切分命令切成单图。

### 2.5 先试跑一匹（强烈建议）

不要一次生成 180 张。先用 **H13（天火之翼）** 试跑全流程，确认管线无误后再批量：

```bash
# 把 H13 的 4 张图放入 input/adults/ 后：
python Tools/horse_art_batch/horse_art_batch.py --process --foals 20 --only H13 --trim --derive
python Tools/horse_art_batch/horse_art_batch.py --verify  --foals 20 --only H13
```

验证 `Client/assets/textures/horses/` 下出现 `H13_SkyFire_Ortho_Front/Side/Back.png`、
`H13_SkyFire_Showcase.png`、`H13_SkyFire_Sprite.png` 与拼合好的 `H13_SkyFire_Ortho.png` 后，
再放开批量处理（去掉 `--only`）。

### 3. 切分图集（可选）

```bash
python tools/horse_art_batch/horse_art_batch.py \
  --split-grid --grid input/grids/sheet1.png --rows 3 --cols 4 --out input/adults
```

### 4. 后处理归档

把 AI 单图按清单文件名放入 `input/adults/` 与 `input/foals/`，然后：

```bash
python tools/horse_art_batch/horse_art_batch.py --process --foals 20 --trim --derive
```

脚本会自动：
- 裁掉白边、统一尺寸；
- 由侧面图**抠出透明跑道精灵** `*_Sprite.png`；
- 由正/侧/背三张图**拼合成 Ortho 三视图版式图** `*_Ortho.png`（img.png 同款版式）；
- 归档到 `Client/assets/textures/horses/` 与 `Client/assets/textures/foals/`。

### 5. 校验 180 张是否齐备

```bash
python tools/horse_art_batch/horse_art_batch.py --verify --foals 20
```

### 6. 注册表预埋

```bash
python tools/horse_art_batch/horse_art_batch.py --emit-registry
```

输出 `HorseAssetRegistry.ts` 中 H13–H20 的条目代码，粘贴到 `HORSES` 数组末尾即可。
（同时把 `HorseGalleryModal.ts` 中的 `Math.min(12, horseNo)` 改为 `Math.min(20, horseNo)`。）

## 与既有工具的关系

- `tools/extract_horse_assets.py` —— 旧流程：从单张 ChatGPT 图集切出 H01–H12 + F01 四阶段。
- `tools/verify_assets.py` —— 校验 `HorseSprites.ts` data URI 与 PNG 是否一致。
- 本套件是**批量扩展版**：数据源改为数据库权威清单，覆盖 20 成年马 + 40 小马，
  并新增抠精灵、拼三视图、清单导出、批量提示词等能力。

## 运行时图片加载说明

当前 `HorseSprites.ts` 把 H01–H12 与 F01 四阶段的图片以 **base64 data URI 内嵌**，运行时画廊
`HorseGalleryModal` 直接使用 data URI，不经过 `resources.load`。因此新生成的 H13–H20 与小马图要
在运行时生效，需二选一：

1. **推荐（长期）**：把 `Client/assets/textures/horses/` 迁移到 `Client/assets/resources/textures/horses/`，
   并让 `HorseSprites.applyHorseShowcase/applyHorseOrtho/applyFoalStage` 先尝试
   `resources.load("textures/horses/...")`，失败再回退 data URI；
2. **快速（短期）**：用脚本把新 PNG 转成 data URI 追加进 `HorseSprites.ts`（文件会膨胀到 MB 级）。
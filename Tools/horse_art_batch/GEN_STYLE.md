# 赛马图鉴 AI 生图统一规范（修订版 · 参照高质量设定稿细化）

## 质量目标（从设定稿提炼）
- **完成度**：游戏级角色概念图的材质/光影，叠加 18–20 世纪欧洲纯血马图鉴的解剖准确度
- **身份一致**：同一匹马的 Front / Side / Back / Showcase 必须共享同一套毛色、鬃尾色、白章与蹄色
- **体态**：成年赛马默认冲刺/轻型纯血比例（高鬐甲、深窄胸、清瘦四肢），避免重型驮马脸/粗腿
- **鬃尾**：丝缕分明、有体积与走向；禁止糊成一片色块
- **背景**：Ortho 用干净纯白（便于抠图与拼三视图）；Showcase 用暖色画廊虚化
- **特效克制**：个体设定色可以「体色高光 + 鬃尾色」表达气质（如赤焰=赤栗+铜橙鬃尾），禁止卡通火焰描边/霓虹光污染

## 硬性约束（每次 prompt 必须包含）
- **EXACTLY ONE horse in the frame** — 禁止多马、禁止九宫格、禁止图鉴排版、禁止侧视/正视/后视拼图
- **No Chinese text, no charts, no labels, no watermark, no captions**
- **No scenery**（Showcase 除外：暖色古典画廊虚化背景）
- **No rider**（仅 Stage4 赛马阶段允许超轻马鞍 + 号码布 + 护腿绑带；成年 Showcase 可选极简皮笼头，无鞍）
- Text: none
- style: high-end equine concept art grounded in 18-20th century European classical thoroughbred natural-history plate accuracy; clean studio presentation
- quality: **high**（质量向设定稿看齐；draft 可临时用 medium）
- **跨视图身份句**（Adults 必写）：`Keep coat color, mane/tail color, white markings and hoof color IDENTICAL across all views of this horse.`
- **output 必须是绝对路径**，例如：
  `D:/project/HorseRaceGame.git/Tools/horse_art_batch/input/adults/H01_CrimsonMeteor_Ortho_Side.png`
  相对路径会被 image_gen 忽略。

## 尺寸
- Ortho Front/Side/Back：1024x1024
- Showcase：1536x1024
- Foal stages：1024x1024
- 三视图设定稿（文档用，可选）：1536x1024
- format: png, background: opaque

## Prompt 模板

```
Slug: illustration
Asset use: racehorse encyclopedia plate / game gallery asset
Primary request: EXACTLY ONE adult thoroughbred racehorse, {POSE}
Subject: This individual horse MUST be {COAT}. {MANE_TAIL}. {BODY_NOTE}
Style anchor: high-end realistic equine concept art with 18-20th century European classical purebred horse natural-history plate anatomy; polished coat sheen; clean pure white studio background
Composition: {POSE_RULES}, full body of this one horse only, centered, ~10% margin
Lighting: soft even studio light with warm rim highlights along crest, shoulder, and hindquarter muscle ridges
Identity lock: Keep coat, mane/tail color, white markings and hoof color IDENTICAL across all views of this horse.
Text: none — no letters, no numbers, no Chinese characters, no logos, no captions, no watermarks
Constraints: exactly one horse; accurate racehorse equine anatomy (lean athletic build, high withers, deep narrow chest); all four hooves on ground
Avoid: multiple horses, comparison grids, orthographic multi-view sheets, charts, Chinese UI text, cartoon, chibi, scenery, rider, watermark, black mane when the coat table specifies a colored mane, draft-horse bulk, muddy undersaturated coat
```

POSE_RULES:
- Front: pure frontal view, head facing camera, ears forward; deep narrow racehorse chest (not draft-wide); symmetric belly; white markings visible
- Side: pure left profile, head facing right, standing still; withers-back-croup classical racehorse topline
- Back: pure rear view of the rump and hindquarters only, head hidden by body; symmetric hocks and tail set
- Showcase: three-quarter view oil painting, warm classical gallery background softly blurred; optional minimal dark leather bridle, no saddle, no rider
- Design sheet (optional doc asset): large side view left; front + back top-right; top view bottom-right; clean white bg; fine divider lines; Chinese view labels allowed ONLY on this doc sheet, never on pipeline singles

## 成年马毛色（必须一字不差写入 Subject）+ 鬃尾/标记锁

| fileBase | COAT | MANE_TAIL / MARKS |
|---|---|---|
| H01_CrimsonMeteor | glossy rich crimson chestnut with a long white blaze on the face | fiery copper-orange mane and tail with golden tips; four white socks; dark polished hooves; NEVER black mane |
| H02_EmeraldWind | silver-white dapple grey with fine dapples | pale silver mane and tail; refined light hooves |
| H03_GoldenArrow | golden palomino | pure white flowing mane and tail; golden coat sheen |
| H04_ShadowHunter | jet black with no white markings | black mane/tail; dark hooves; no white anywhere |
| H05_SilverMoon | pure white-grey moonlight coat | silvery-white mane and tail; soft pinkish skin sheen |
| H06_BlueTide | blue roan: darker head, deep blue-grey roan body | darker mane/tail on blue-grey roan body |
| H07_PurpleLightning | liver chestnut with a subtle violet sheen | darker liver-chestnut mane/tail; tight refined limbs |
| H08_StormRun | classic bay | black mane/tail; four white socks; black lower legs |
| H09_ThunderBreak | dark brown-bay with a white star on the forehead | near-black mane/tail; single white star |
| H10_SunWarrior | blood bay, massive arched stallion neck | black mane/tail; powerful arched crest |
| H11_JadeDream | dun-roan with sand-gold sheen | muted sand-gold mane/tail; optional dark dorsal line |
| H12_AuroraStar | dark bay with a diamond-shaped white star | dark mane/tail; diamond white star on forehead |
| H13_SkyFire | amber chestnut gleaming gold | warm gold-amber mane/tail matching coat glow |
| H14_PlainsOverlord | wild sun-bleached chestnut, coarse untamed coat | coarse sun-bleached chestnut mane/tail; untamed |
| H15_SilverBeam | platinum-silver coat | flying silver-white mane and tail |
| H16_ObsidianStorm | charcoal black, obsidian-like muscle density | dense black mane/tail; hard polished hooves |
| H17_MoonWalker | calm slate grey | slate-grey mane/tail; calm even tone |
| H18_RagingHorn | bronze dark bay with metallic sheen | bronze-dark mane/tail with metallic rim light |
| H19_GoldenEagle | gilded chestnut | golden flowing mane and tail |
| H20_AbyssalPhantom | deep indigo black | indigo-black mane/tail; cold rim highlights |

## 小马毛色

| fileBase | COAT |
|---|---|
| F01_WildBreeze | bay (reddish-brown body, black mane/tail/legs) |
| F02_DesertGazelle | chestnut |
| F03_LittleTumbleweed | dun sandy tan |
| F04_SpeckledLark | roan mixed coat |
| F05_RedRockFoal | bay |
| F06_CanyonEcho | jet black |
| F07_MorningDew | grey silver-dappled |
| F08_GoldenSand | golden palomino, white mane/tail |
| F09_DuskFlame | chestnut |
| F10_PrairieAntelope | bay |
| F11_WyomingDawn | bay |
| F12_PrairieSun | chestnut |
| F13_SnowpeakShadow | grey |
| F14_CopperHoof | buckskin tan-gold with black points |
| F15_GoldenManeCub | palomino golden with white mane |
| F16_SwallowSpin | jet black |
| F17_Pinewind | bay |
| F18_RussetStar | roan |
| F19_FieldDreamer | chestnut |
| F20_Snowdapple | grey |

## 小马阶段体态（同一毛色，仅体态变化）

1. Stage1_Foal: true foal 0-1y — large head, short body, long legs, fluffy downy coat, round belly, NOT an adult horse
2. Stage2_Yearling: yearling 1-2y — gangly, croup slightly higher than withers, frame stretching
3. Stage3_Adult: mature 3-5y — balanced adult proportions
4. Stage4_Pro: racehorse 5y+ — lean muscle, lightweight racing saddle + number cloth + leg wraps

Composition for foals: EXACTLY ONE horse, pure left profile, head facing right, parchment white studio background.

## 绝对路径目录
- Adults: `D:/project/HorseRaceGame.git/Tools/horse_art_batch/input/adults/`
- Foals: `D:/project/HorseRaceGame.git/Tools/horse_art_batch/input/foals/`

# 赛马游戏模式三：西部纯血马房养成、繁育与职业巡回赛需求规格说明书 (PRD V2.1)

> **版本**：v1.1 / V2.1 统一需求基线 (2026-09-16 二次审核通过)  
> **文档代号**：`DOC-REQ-MODE3-RANCH-V2.1`  
> **归档路径**：`Docs/02_Requirements/HORSE_RANCH_MODE_REQUIREMENTS.md`  
> **设计基线**：遵循 [PROJECT_STANDARDS.md](file:///d:/project/HorseRaceGame.git/Docs/PROJECT_STANDARDS.md) 与 [PRODUCT_BIBLE_V2.0.md](file:///d:/project/HorseRaceGame.git/Docs/00_Product/PRODUCT_BIBLE_V2.0.md)，彻底消除 R01~R20 描述性歧义，确立全链路“状态机 + 数值公式 + 数据库约束 + 统一API契约 + Worker机制 + 异常边界 + 验收标准”的开发与验收合同。

---

## 目录
1. [一、模式定位与全局架构关系](#一模式定位与全局架构关系)
2. [二、赛马生命周期与状态机全矩阵](#二赛马生命周期与状态机全矩阵)
3. [三、成长阶梯、经验表与成年等级规则 (R01, R04)](#三成长阶梯经验表与成年等级规则-r01-r04)
4. [四、属性体系、潜能上限与训练增量公式 (R02)](#四属性体系潜能上限与训练增量公式-r02)
5. [五、饲料营养、消化代谢与日常护理恢复 (R03)](#五饲料营养消化代谢与日常护理恢复-r03)
6. [六、成年马具装备系统与可计算加成 (R05)](#六成年马具装备系统与可计算加成-r05)
7. [七、资格审查试跑算法与证书签发 (R06)](#七资格审查试跑算法与证书签发-r06)
8. [八、职业巡回杯赛系统与比赛性能模拟模型 (R11, R12, R19)](#八职业巡回杯赛系统与比赛性能模拟模型-r11-r12-r19)
9. [九、G1 赛季排位与积分排名系统 (R10)](#九g1-赛季排位与积分排名系统-r10)
10. [十、繁育遗传体系、突变模型与近亲检测算法 (R07, R08, R09)](#十繁育遗传体系突变模型与近亲检测算法-r07-r08-r09)
11. [十一、妊娠周期与安胎分娩状态机 (R15)](#十一妊娠周期与安胎分娩状态机-r15)
12. [十二、公开拍卖行与并发竞价机制 (R13, R16)](#十二公开拍卖行与并发竞价机制-r13-r16)
13. [十三、点对点契约转让与原子交换 (R14)](#十三点对点契约转让与原子交换-r14)
14. [十四、系统保底回购定价机制](#十四系统保底回购定价机制)
15. [十五、Worker 实时任务系统与断电恢复机制 (R15)](#十五worker-实时任务系统与断电恢复机制-r15)
16. [十六、PostgreSQL 数据库完整表结构与 DDL 约束 (R20)](#十六postgresql-数据库完整表结构与-ddl-约束-r20)
17. [十七、统一服务端 API 契约与全域错误码 (R17)](#十七统一服务端-api-契约与全域错误码-r17)
18. [十八、客户端体验、8 态规范与断线重连 (R18)](#十八客户端体验8-态规范与断线重连-r18)
19. [十九、安全防作弊与后台配置中心](#十九安全防作弊与后台配置中心)
20. [二十、测试矩阵与交付验收标准](#二十测试矩阵与交付验收标准)

---

## 一、模式定位与全局架构关系

### 1.1 模式定位与分期演进规划 (Milestones)
模式三（Frontier Thoroughbred Ranch & Pro Derby Circuit）为玩家专属马房模拟与职业竞技世界。系统按以下阶段稳步演进交付：
- **Phase 1（核心养成与资格考核闭环 - 已完成）**：涵盖幼驹/青年调教、五维潜能封顶、装备槽装配与损耗、400m 资格审查试跑与官方执照编号核发、公会保底回购；
- **Phase 2（纯血繁育与安胎分娩）**：涵盖三代近亲系数检测、公马配种冷却、母马 24h 三期妊娠状态机；
- **Phase 3（职业巡回排位赛）**：涵盖 Maiden / G3 / G2 / G1 杯赛准入、物理仿真排位模拟与奖金分配；
- **Phase 4（拍卖行与点对点交易契约）**：涵盖基于 `wallets.frozen_balance` 的原子竞价、加价幅度、压哨延长与 P2P 签约交割。

### 1.2 全局对象流转
严格遵循《产品圣经 V2.1》对象关系链：
$$\text{Account} \longrightarrow \text{Player} \longrightarrow \text{Wallet} \longrightarrow \text{Ranch Data} \longrightarrow \text{Horse / Equipment Asset} \longrightarrow \text{Wallet Transaction / Audit}$$
- **数据解耦**：模式三业务通过领域服务调用钱包接口扣款/增款，严禁直接 `UPDATE wallets SET balance = ...`；
- **不可伪造**：所有马匹资质、成绩、血统、比赛结果均由服务端权威生成，客户端仅做状态渲染。

---

## 二、赛马生命周期与状态机全矩阵

### 2.1 主生命周期阶段 (Growth Stages)

```
 [FOAL 幼驹] ──(Lv.10 突破)──> [JUVENILE 青年马] ──(Lv.20 成年)──> [MATURE 成年马] ──(资格审查通过)──> [PRO_RACER 职业马]
 (仅限喂食)                  (训练/护理/调教)                 (装配/配种/考核)                 (出赛/拍卖/P2P)
```

### 2.2 伴生生理与业务子状态 (Sub-States)

马匹在生命周期各阶段，可处于以下子状态或异常态：
- `IDLE`：空闲待命，可接受常规指令；
- `IN_RACE`：已锁马或正在进行职业赛事，禁止一切修改与流转；
- `AUCTION_LOCKED`：已挂牌全服拍卖行并在竞价有效期内，所有权与属性锁定；
- `TRANSFER_LOCKED`：已发起 P2P 私下转让契约并等待买家确认，属性锁定；
- `PREGNANT`：妊娠母马，受胎至分娩期间，严禁剧烈训练与比赛；
- `RESTING`：配种后公马体力恢复期或高强度训练后的冷却休整；
- `INJURED`：训练或比赛意外受伤（如蹄甲裂开、肌腱炎），必须进行理疗后方可复原；
- `SICK`：积食腹痛或感冒微恙，必须喂食益生菌或兽医治疗；
- `RETIRED`：已被官方保底回购或马主永久退役注销，状态终结不可逆。

### 2.3 状态互斥矩阵 (Exclusion Rules)

任何业务操作前，服务端领域层与数据库 CHECK 约束必须强制执行状态互斥：

| 状态组合 | 是否允许 | 强制约束规则说明 |
| :--- | :---: | :--- |
| `IN_RACE` + `AUCTION_LOCKED` | ❌ **绝对禁止** | 参赛中的马匹不得挂牌拍卖；拍卖中的马匹不得报名赛事 |
| `IN_RACE` + `PREGNANT` | ❌ **绝对禁止** | 孕期母马生理保护，严禁进入赛事报名单 |
| `AUCTION_LOCKED` + `TRANSFER_LOCKED` | ❌ **绝对禁止** | 不得同时挂牌公开市场与点对点私人协议 |
| `PREGNANT` + 青年马专项训练 | ❌ **绝对禁止** | 妊娠状态仅允许安胎慢走与营养补给，禁止高强度体能消耗 |
| `RETIRED` + 任意主动业务操作 | ❌ **绝对禁止** | 退役马匹数据归档，不可再喂食、训练、配种、报名或交易 |
| `INJURED` / `SICK` + 参赛 / 考核 | ❌ **绝对禁止** | 健康度未达 100/100 严禁参与 400m 考核与官方杯赛 |

### 2.4 全阶段操作权限矩阵

| 操作行为 | FOAL (幼驹) | JUVENILE (青年) | MATURE (成年) | PRO_RACER (职业) | 核心限制条件 |
| :--- | :---: | :---: | :---: | :---: | :--- |
| **饲料投喂 (Feed)** | ✅ 允许 | ✅ 允许 | ✅ 允许 | ✅ 允许 | 饱腹度 $< 100$ |
| **专项训练 (Train)** | ❌ 禁止 | ✅ 允许 | 规则化微调 | 规则化保持 | 仅限非伤病、体力 $\ge 25$、未妊娠 |
| **梳理安抚 (Groom)** | ❌ 禁止 | ✅ 允许 | ✅ 允许 | ✅ 允许 | 恢复精力与亲密度 |
| **钉蹄修整 (Farrier)** | ❌ 禁止 | ✅ 允许 | ✅ 允许 | ✅ 允许 | 蹄铁磨损度 $\ge 20$ 时生效 |
| **理疗推拿 (Physio)** | ❌ 禁止 | ✅ 允许 | ✅ 允许 | ✅ 允许 | 调子 $< 100$ 或处于疲劳/伤病 |
| **马具装配 (Equip)** | ❌ 禁止 | ❌ 禁止 | ✅ 允许 | ✅ 允许 | 仅限成年体型，需对应装备槽位 |
| **资格审查 (License)**| ❌ 禁止 | ❌ 禁止 | ✅ 允许 | 已拥有 | Lv.20+、健康度 100、三件套齐备 |
| **职业出征 (Pro Race)**| ❌ 禁止 | ❌ 禁止 | ❌ 禁止 | ✅ 允许 | 具备执照且处于空闲 `IDLE` 状态 |
| **繁育配种 (Breed)** | ❌ 禁止 | ❌ 禁止 | ✅ 允许 | ✅ 允许 | Lv.20+、公马休整结束、母马未孕 |
| **拍卖行挂牌 (Auction)**| ❌ 禁止 | ❌ 禁止 | ❌ 禁止 | ✅ 允许 | **必须是拥有执照的职业赛马** |
| **私下转让 (P2P)** | ❌ 禁止 | ❌ 禁止 | ❌ 禁止 | ✅ 允许 | **必须是拥有执照的职业赛马** |
| **系统回购 (Buyback)** | ✅ 允许 | ✅ 允许 | ✅ 允许 | ✅ 允许 | 全阶段保底回收流动性 |

---

## 三、成长阶梯、经验表与成年等级规则 (R01, R04)

### 3.1 完整经验升级配置表 (EXP Level Table)

严禁代码中硬编码等级曲线。经验表由后台系统统一配置并下发：

| 等级区间 | 起始等级 $\to$ 目标等级 | 升级所需经验 (Required EXP) | 累计总经验 (Cumulative EXP) | 阶段突破与奖励 |
| :--- | :---: | :---: | :---: | :--- |
| **幼驹阶段** | 1 $\to$ 2 | 100 | 100 | 初始新手引导 |
| | 2 $\to$ 3 | 120 | 220 | 解锁粗料·苜蓿草捆 |
| | 3 $\to$ 4 | 150 | 370 | 基础五维潜能显现 |
| | 4 $\to$ 5 | 190 | 560 | 解锁精料·熟化压片燕麦 |
| | 5 $\to$ 6 | 240 | 800 | 亲密度上限提升 |
| | 6 $\to$ 7 | 300 | 1,100 | 解锁精料·强化蛋白饼 |
| | 7 $\to$ 8 | 370 | 1,470 | 体况调子稳定性增强 |
| | 8 $\to$ 9 | 450 | 1,920 | 骨骼发育定型提示 |
| | 9 $\to$ 10 | 550 | 2,470 | **晋阶突破：断奶晋升青年马立绘** |
| **青年阶段** | 10 $\to$ 11 | 650 | 3,120 | 解锁四大专项骑术训练 |
| | 11 $\to$ 12 | 750 | 3,870 | 解锁钉蹄与软毛刷梳理 |
| | 12 $\to$ 13 | 880 | 4,750 | 解锁理疗推拿与草本泥敷 |
| | 13 $\to$ 14 | 1,020 | 5,770 | 跑法倾向定型评估 |
| | 14 $\to$ 15 | 1,180 | 6,950 | 训练属性获得效率提升 10% |
| | 15 $\to$ 16 | 1,350 | 8,300 | 解锁高级营养补充剂 |
| | 16 $\to$ 17 | 1,550 | 9,850 | 弯道与起跑机动大幅提升 |
| | 17 $\to$ 18 | 1,800 | 11,650 | 泥泞赛道适应性强化 |
| | 18 $\to$ 19 | 2,100 | 13,750 | 准备成年体检 |
| | 19 $\to$ 20 | 2,500 | 16,250 | **完全成年突破：解锁马具与繁育** |
| **成年/职业**| 20 $\to$ 21+ | 3,500 / 级 (递增500) | - | 方案 C：仅累积声望与外观荣誉 |

### 3.2 升级事务与连升规则
每次获得 EXP（来自饲料或训练）：
1. 服务端执行累加：`CurrentExp = CurrentExp + GainExp`；
2. 循环判断：若 `CurrentExp >= RequiredExp` 且未达阶段锁定，则 `Level = Level + 1`，`CurrentExp = CurrentExp - RequiredExp`；
3. **单事务一致性**：跨级必须在单个数据库事务内完成，写入 `ranch_horse_stat_logs`，杜绝重复发放晋阶礼包。

### 3.3 成年等级上限与属性规则（方案 C）
- **等级定义**：赛马达到 **Lv.20** 即宣告生理完全成熟；
- **属性封顶原则**：五维基础属性受马匹先天基因潜能（`Potential`）严格约束，**在 Lv.20 之后五维基础属性不可无限增长**；
- **Lv.20+ 价值**：成年马与职业赛马继续参加高阶巡回赛可获得“生涯经验（Prestige EXP）”，用于提升马房声望、解锁专属马衣马冠外观及排行榜展示称号，彻底杜绝“老马数值通胀碾压一切”的恶性循环。

---

## 四、属性体系、潜能上限与训练增量公式 (R02)

### 4.1 五维属性与上下限规范
赛马包含以下五维核心能力，取值范围精确至小数点后两位：
- **速度 (Speed)**：决定平地中段最高时速（范围：$30.00 \sim 100.00$）；
- **耐力 (Stamina)**：决定高速奔跑时的体力消耗速率（范围：$30.00 \sim 100.00$）；
- **爆发 (Burst)**：决定出闸起跑加速度与末段 200m 冲刺极速（范围：$30.00 \sim 100.00$）；
- **灵敏 (Agility)**：决定内外道变线敏捷与弯道减速损耗减免（范围：$30.00 \sim 100.00$）；
- **心理 (Temperament)**：决定受惊抗性、领跑/跟跑战术执行定力（范围：$30.00 \sim 100.00$）。

### 4.2 最终综合能力解算公式 (Final Stat Formula)
在任意时刻参与试跑或正式比赛时，马匹的最终实战能力值由以下闭环公式计算：

$$\text{FinalStat} = \text{Clamp}\Big( (\text{BaseStat} \times M_{\text{cond}} \times M_{\text{injury}} \times M_{\text{track}} \times M_{\text{temp}}) + B_{\text{equip}} + B_{\text{buff}}, \; 10.00, \; 120.00 \Big)$$

其中各项系数定义如下：
1. **调子修正系数 ($M_{\text{cond}}$)**：
   - 绝好调 (Peak, 90~100)：$M_{\text{cond}} = 1.05$；
   - 良好 (Good, 60~89)：$M_{\text{cond}} = 1.00$；
   - 疲倦 (Tired, 40~59)：$M_{\text{cond}} = 0.92$；
   - 微恙 (Poor, 0~39)：$M_{\text{cond}} = 0.80$。
2. **伤病惩罚系数 ($M_{\text{injury}}$)**：无伤为 $1.00$，轻度损伤为 $0.85$，未修蹄（磨损 $\ge 80$）时为 $0.90$。
3. **赛道适应乘数 ($M_{\text{track}}$)**：根据马匹草地/泥地适性及所穿蹄铁计算，基准为 $0.95 \sim 1.05$。
4. **性情定力乘数 ($M_{\text{temp}}$)**：根据比赛现场噪音与看台紧张度，取值 $0.98 \sim 1.02$。
5. **装备加成 ($B_{\text{equip}}$)**：马鞍、马镫、蹄铁提供的绝对属性增益点数。
6. **临时状态增益 ($B_{\text{buff}}$)**：赛前专业理疗或战术激励带来的点数加成。

### 4.3 潜能上限绝对法则 (Potential Cap)
$$\forall k \in \{\text{Speed}, \text{Stamina}, \text{Burst}, \text{Agility}, \text{Temperament}\}, \quad \text{BaseStat}_k \le \text{Potential}_k$$
- 训练过程只能使 `BaseStat` 逼近 `Potential`，绝不能突破 `Potential`；
- 只有通过代际繁育与良性基因突变（Mutation），方可在诞生新马驹时突破父代潜能上限。

### 4.4 青年马四大专项训练增量矩阵

青年马每天拥有 100 点精力，每次训练消耗 **25 体力 + 对应金币**，增益严格受潜能截断：

| 训练项目 | 规费消耗 | EXP获得 | 蹄铁磨损 | 主要属性增量 ($\Delta$) | 次要属性增量 ($\Delta$) | 疲劳调子影响 |
| :--- | :---: | :---: | :---: | :--- | :--- | :--- |
| **短程爆发冲刺 (Sprint)** | 30 🪙 | +100 | +8 | 速度 $+0.60 \sim +1.00$ | 爆发 $+0.30 \sim +0.60$ | 调子 $-5$，乳酸积累 |
| **环道负重耐力 (Lope)** | 25 🪙 | +100 | +6 | 耐力 $+0.70 \sim +1.20$ | 心理 $+0.20 \sim +0.40$ | 调子 $-4$，心肺增强 |
| **弯道机动折返 (Corner)** | 35 🪙 | +120 | +10 | 灵敏 $+0.80 \sim +1.30$ | 速度 $+0.20 \sim +0.40$ | 调子 $-5$，重心稳固 |
| **坡地越野耐挫 (Hill)** | 40 🪙 | +140 | +12 | 爆发 $+0.70 \sim +1.10$ | 耐力 $+0.40 \sim +0.70$ | 调子 $-6$，抗逆性升 |

> **训练审计记录**：每次训练必须原子写入 `ranch_training_logs`，记录操作前后数值及 `idempotency_key`。

---

## 五、饲料营养、消化代谢与日常护理恢复 (R03)

### 5.1 饲料投喂与参数表

| 饲料代码 | 饲料名称 | 分类 | 购买单价 | EXP增量 | 饱腹度即时增加 | 调子影响与健康加成 |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| `FEED_TIMOTHY` | 优质梯牧草 | 粗料 | 10 🪙 | +50 | +35 | 调子正常维持，肠胃蠕动平稳 |
| `FEED_ALFALFA` | 苜蓿草捆 | 粗料 | 25 🪙 | +120 | +40 | 调子微升，适口性好 |
| `FEED_OATS` | 熟化压片燕麦 | 精料 | 40 🪙 | +200 | +25 | 兴奋度微升，爆发潜能微增 |
| `FEED_PROTEIN` | 复合强化蛋白饼 | 精料 | 80 🪙 | +450 | +30 | 绝好调概率+15%，肌肉强化 |

### 5.2 饱腹度代谢与离线追赶算法 (Metabolism Catch-up)
- **饱腹度上限**：最大为 100。若当前饱腹度 + 饲料饱腹增量 $> 100$，拒绝投喂并返回 `RANCH_FEED_STOMACH_FULL` 错误；
- **自然消化速率**：每小时代谢 20 点饱腹度（即 5 小时完全空腹）；
- **离线追赶结算**：采用“登录/查询时惰性计算 + 后台 Worker 心跳定时刷新”双重机制：
  $$\Delta \text{Hours} = \min\left( \frac{\text{CurrentUTC} - \text{LastDigestionUTC}}{3600}, \; 24.0 \right)$$
  $$\text{NewHungerLevel} = \max\Big(0, \; \text{HungerLevel} - \lfloor \Delta \text{Hours} \times 20 \rfloor\Big)$$
  离线超过 24 小时停止追赶，最多将饱腹度归零，不产生额外负面惩罚。

### 5.3 连续精料积食风险判定
- **滑动窗口定义**：服务端在 `ranch_feed_logs` 中拉取最近 3 小时内投喂记录。若连续 3 次投喂均为精料（`FEED_OATS` 或 `FEED_PROTEIN`），触发肠胃超载判定；
- **随机风险生成**：服务端采用加密随机数（带审计种子记录），以 **25% 概率** 判定为“积食腹痛（Colic）”；
- **惩罚与救治**：马匹调子暴跌至 20（微恙），禁止进行专项训练，需在兽医处消耗 30 🪙 购买益生菌冲剂解除。

### 5.4 每日体力重置与恢复规则
- **每日刷新基准**：每天 UTC 00:00，所有未处于伤病/妊娠中的青年马体力能量强制重置为 **100**；
- **主动恢复行为**：
  - **软毛刷梳理 (Grooming)**：消耗 5 🪙，亲密度 +10，调子 +5；
  - **牵引漫步 (Hand Walking)**：消耗 10 🪙，冷却 2 小时，恢复 15 点体力能量，降低心率疲劳；
  - **理疗推拿与草本泥敷 (Physiotherapy)**：消耗 50 🪙，瞬间清除疲劳，调子直升至 100（绝好调）。

---

## 六、成年马具装备系统与可计算加成 (R05)

### 6.1 装备字典定义 (`ranch_equipment_items`)

成年马拥有三大装备槽位：**马鞍 (Saddle)**、**马镫 (Stirrup)**、**赛道蹄铁 (Horseshoe)**。装备属性完全数值化：

| 装备代码 | 槽位 | 装备名称 | 重量 | 速度加成 | 耐力加成 | 爆发加成 | 灵敏加成 | 赛道适应修正 | 最大耐久 |
| :--- | :---: | :--- | :---: | :---: | :---: | :---: | :---: | :--- | :---: |
| `SAD_STD_01` | SADDLE | 标准加利福尼亚轻型鞍 | 4.0kg | +0.00 | +0.00 | +0.00 | +0.00 | 全赛道无修正 | 100 |
| `SAD_LEA_02` | SADDLE | 手工赛级真皮减负鞍 | 2.5kg | +0.80 | +0.50 | +1.20 | +0.50 | 负重轻，末程冲刺+1.2% | 80 |
| `STP_BRS_01` | STIRRUP | 黄铜深槽重心稳定镫 | 1.2kg | +0.00 | +0.30 | +0.00 | +1.50 | 弯道重心损失减免 1.5% | 120 |
| `SHU_ALU_01` | HORSESHOE| 铝合金草地轻量蹄铁 | 0.8kg | +1.00 | +0.00 | +0.80 | +0.00 | 草地(Turf)+3.0%, 沙地-2.0%| 50 |
| `SHU_CLK_02` | HORSESHOE| 深齿防滑泥地抓地铁 | 1.5kg | -0.50 | +1.00 | +0.50 | +1.00 | 泥泞(Mud)+5.0%, 草地-2.0%| 60 |

### 6.2 装备耐久损耗与损坏逻辑
- 每次出战职业巡回赛或执行资格试跑，装备扣除 **2 点耐久度**；
- 当装备耐久度降至 0 时，装备失效（加成归零），需在铁匠铺消耗原价 30% 金币进行修理，或直接更换。

---

## 七、资格审查试跑算法与证书签发 (R06)

### 7.1 准入硬性指标
1. **等级与体型**：必须达到 **Lv.20** 成年体型；
2. **兽医体格检查**：健康度必须为 **100/100**，无未愈伤病，蹄铁磨损度 $< 50$；
3. **装备齐备性**：必须同时装配有效马鞍、马镫与赛道蹄铁。

### 7.2 400m 模拟试跑物理算法
试跑成绩由离散动力学模型确定性计算（以毫秒为单位）：

$$T_{400} = T_{\text{base}} - \left( \frac{\text{FinalSpeed} \times 0.08 + \text{FinalBurst} \times 0.06 + \text{FinalAgility} \times 0.02}{10} \right) + \text{RandomVariance}(-0.15, +0.15)$$

- **基准标准线 ($T_{\text{standard}}$)**：后台可配置，默认 **24.500 秒**；
- **通过判定**：若 $T_{400} \le T_{\text{standard}}$，则判定通过考核；否则判定未通过。

### 7.3 规费收取与防刷冷却机制
- **扣费时机（推荐方案）**：试跑过程仅消耗马匹体力与磨损；**仅在试跑通过且正式确认签发执照时，一次性扣除 200 🪙 官方执照规费**；若试跑未通过，不扣除 200 🪙 规费；
- **失败冷却期**：若未达标，需休养调教 **4 小时冷却时间**，方可发起下一次试跑挑战。

### 7.4 官方执照证书生成规则
考核通过后，服务端生成全服唯一证书编码：
$$\text{CertCode} = \text{"WY-"} + \text{DateTime.UtcNow.ToString("yyyyMMdd")} + \text{"-"} + \text{Crc16(HorseId, OwnerId).ToString("X4")}$$
马匹身份永久变更为 **`PRO_RACER`**，激活全服公开巡回赛报名与公开市场流转权限。

---

## 八、职业巡回杯赛系统与比赛性能模拟模型 (R11, R12, R19)

### 8.1 赛事状态机与生命周期

```
 [SCHEDULED 计划排期] ──> [REGISTRATION 开放报名] ──> [LOCKED 锁马截止] ──> [MATCHED 撮合分组]
                                                            │ (人数不足取消)
                                                            ▼
 [SETTLED 奖金与积分结算] <── [FINISHED 比赛完赛] <── [RUNNING 模拟运行]   [CANCELLED 退还报名费]
```

### 8.2 报名规则与缺人处理机制 (R12)
1. **准入分级与规费**：
   - **Maiden 新秀赛**：仅限出战 0 胜职业马，报名费 30 🪙；
   - **G3 铜马锦标**：胜场 $\ge 1$，报名费 80 🪙；
   - **G2 金杯锦标**：胜场 $\ge 3$ 且曾获 G3 前二，报名费 200 🪙；
   - **G1 怀俄明德比总决赛**：仅限全服排名前 12 名顶尖名驹，报名费 500 🪙。
2. **缺人取消机制（严格杜绝 Bot）**：
   - 每场比赛标准编排 6~8 匹马；
   - 报名截止时，**若报名马匹不足 6 匹，系统立即将赛事置为 `CANCELLED`，绝对不引入虚假 Bot 机器人参赛，100% 原路退还马主报名费**，解除马匹锁定。

### 8.3 比赛性能综合解算模型 (Race Formula R19)

比赛模拟分为四阶段推进：**起跑出闸 (Gate Break)** $\to$ **途中跑巡航 (Middle Pace)** $\to$ **大弯道机动 (Cornering)** $\to$ **冲刺终点线 (Final Sprint)**。

$$\text{TotalPerformanceScore} = W_{\text{speed}} \cdot S_{\text{mid}} + W_{\text{burst}} \cdot S_{\text{burst}} + W_{\text{stamina}} \cdot S_{\text{endur}} + W_{\text{agil}} \cdot S_{\text{turn}} + W_{\text{temp}} \cdot S_{\text{nerve}} + S_{\text{track}} + S_{\text{rand}}$$

1. **起跑反应时间 ($T_{\text{gate}}$)**：
   $$T_{\text{gate}} = 0.35 - (\text{FinalBurst} \times 0.0018) + \text{Random}(-0.03, +0.03) \quad (\text{单位: 秒})$$
2. **途中巡航与体力衰耗**：
   每米体力消耗速率随赛程距离 $D$ 与马匹耐力解算：若中段耐力耗尽，马匹触发失速衰减惩罚（速度下降 15%）。
3. **受惊失控突发事件 (Spooked Event)**：
   若现场随机干扰值 $> \text{FinalTemperament} \times 1.2$，马匹陷入受惊偏线，成绩增加 $0.50 \sim 1.20$ 秒。
4. **同时间裁决与精准排序**：
   服务端生成完赛总用时（精确至微秒）。若出现完全一致时间，依次比对：出闸反应时间短者优先 $\to$ 历史胜率高者优先 $\to$ 马匹注册 ID 小者优先，保证名次唯一无并列歧义。

### 8.4 赛事奖金分配标准（明确采纳方案 A - R11）
- **总奖池构成**：$\text{GrossPurse} = \sum \text{RegistrationFees}$；
- **平台公证费扣除**：系统首先抽取 **3.0%** 平台公证与赛事税金：
  $$\text{NetPurse} = \text{GrossPurse} \times 97.0\%$$
- **排位净奖金分配比例**：
  - 🥇 **第一名（冠军）**：$\text{NetPurse} \times 55\%$；
  - 🥈 **第二名（亚军）**：$\text{NetPurse} \times 25\%$；
  - 🥉 **第三名（季军）**：$\text{NetPurse} \times 12\%$；
  - 🏅 **第四名 ~ 第六名**：平分剩余 $\text{NetPurse} \times 8\%$（每匹马各得 $\text{NetPurse} \times 2.666...\%$）。

---

## 九、G1 赛季排位与积分排名系统 (R10)

### 9.1 积分计算公式
每次参加官方锦标赛完赛后，马匹获取 G 级积分：
$$\text{RacePoints} = \text{ClassBasePoint} \times \text{RankMultiplier} \times \text{FieldStrengthModifier}$$

| 赛事级别 | 基础分 (ClassBasePoint) | 冠军倍率 (1st) | 亚军倍率 (2nd) | 季军倍率 (3rd) | 完赛出场积分 (4th~6th) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Maiden 新秀赛** | 10 | 1.0 (10分) | 0.5 (5分) | 0.2 (2分) | 0 分 |
| **G3 铜马级** | 50 | 2.0 (100分) | 1.2 (60分) | 0.6 (30分) | 5 分 |
| **G2 金杯级** | 150 | 2.5 (375分) | 1.5 (225分) | 0.8 (120分) | 15 分 |
| **G1 德比总决**| 500 | 3.0 (1500分) | 1.8 (900分) | 1.0 (500分) | 50 分 |

### 9.2 赛季运作、衰减与并列破平
- **赛季周期**：以自然月为一个赛季周期（每月 1 日 00:00:00 至最后一日 23:59:59）；
- **全服前 12 名选拔**：每周日德比大赛，拉取全服当前赛季积分排行榜前 12 名受邀出征；
- **同分破平规则**：若积分相同，优先比较 G1 冠军数 $\to$ G2 冠军数 $\to$ 生涯总奖金 $\to$ 马匹注册时间（先到者先）；
- **赛季重置与继承衰减**：赛季末结算高额称号与金币奖励后，所有马匹积分衰减 50% 结转入下一赛季底分，其余清空。

---

## 十、繁育遗传体系、突变模型与近亲检测算法 (R07, R08, R09)

### 10.1 性别概率规范 (R08)
- 新生马驹性别由服务端加密安全随机发生器生成，概率配置化，基准为：
  $$P(\text{Stallion 公马}) = 50.0\%, \quad P(\text{Mare 母马}) = 50.0\%$$

### 10.2 基因突变模型 (MutationBonus R07)
小马驹潜能继承基础公式：
$$\text{OffspringPotential}_k = \text{Clamp}\left( \left(\frac{\text{SirePotential}_k + \text{DamPotential}_k}{2}\right) \times (1 + \text{Variance}) + \text{MutationBonus}_k, \; 40.00, \; \text{TierCap} \right)$$
其中 `MutationBonus` 拆解为四个可计算参数：
1. **突变几率 ($\text{MutationChance}$)**：荒野级 0%，平原纯血 5%，皇家级 15%，神殿级 25%；
2. **突变增量 ($\text{MutationValue}$)**：若触发突变，增量在 $[+1.50, \; +4.00]$ 点之间随机生成；未触发突变为 0；
3. **作用属性范围 ($\text{MutationStatScope}$)**：随机抽取五维中 1~2 项属性生效；
4. **血统上限截断 ($\text{TierCap}$)**：即使突变，潜能绝对不得突破该血统层级上限（荒野级 69，平原级 84，皇家级 94，神殿级 100）。

### 10.3 三代近亲血统判定算法 (Inbreeding Detection R09)
为保障血统多样性与赛马健康，系统禁止三代以内共用祖先配种：

```
                    ┌─── Grandparent (父祖父) ─── Great-Grandparent * 4
        ┌─── Sire ──┤
        │           └─── Grandparent (父祖母) ─── Great-Grandparent * 4
Offspring
        │           ┌─── Grandparent (母外祖父) ── Great-Grandparent * 4
        └─── Dam ───┤
                    └─── Grandparent (母外祖母) ── Great-Grandparent * 4
```

- **算法实现定义**：
  1. 输入待配对的 `SireId` 与 `DamId`；
  2. 递归检索构建双方前三代祖先节点集合：
     $$\text{Ancestors}(\text{Horse}) = \{\text{Parents (2)}\} \cup \{\text{Grandparents (4)}\} \cup \{\text{Great-Grandparents (8)}\}$$
  3. 判断交集：
     $$\text{Intersection} = \text{Ancestors}(\text{SireId}) \cap \text{Ancestors}(\text{DamId})$$
  4. 处罚规则：若 $\text{Intersection} \ne \emptyset$（包含父女、母子、兄妹、半兄妹、叔侄等关系），判定为**近亲交配**：
     - 系统在 UI 弹出严厉警告；
     - 若玩家强制交配，新生小马驹触发**近亲基因退化**：五维潜能上限直接**强制衰减 40%**，且健康度初始值上限仅为 60。

---

## 十一、妊娠周期与安胎分娩状态机 (R15)

母马受孕后进入真实时间 24 小时完整妊娠周期，由 Worker 任务自动化调度推进：

```
 [BREEDING_CREATED 配种成功] ──(2h着床)──> [PREGNANCY_CONFIRMED 确诊受孕]
                                                │
                                                ▼
 [FOALED 成功分娩产驹] <──(24h临产)── [TRIMESTER_3 晚期待产] <──(18h)── [TRIMESTER_2 胎心监护] <──(6h)── [TRIMESTER_1 超声检查]
         │
         ▼ (若护理失误或严重滑胎)
     [ABORTED 妊娠终止]
```

### 11.1 各阶段监护任务与护理评分
- **孕早期 (0~6h)**：玩家需消耗 50 🪙 执行超声检查；若未检查，滑胎风险提高 5%；
- **孕中期 (6~18h)**：玩家需进行胎动与钙质补充，产前护理得分 $+20$；
- **孕晚期 (18~24h)**：玩家需预订 100 🪙 无菌待产包；
- **产前综合得分 (CareScore)**：满分 100，得分直接影响新生马驹初始潜能浮动波动系数。

---

## 十二、公开拍卖行与并发竞价机制 (R13, R16)

### 12.1 拍卖完整状态机

```
 [DRAFT 草稿] ──> [ACTIVE 挂牌竞价中] ──(买家一口价)──> [BUYOUT_PENDING] ──> [SOLD 交易达成] ──> [SETTLED 划账完成]
                        │                                                   ▲
                        ├──(到期最高出价结算)─────────────────────────────────┤
                        ├──(到期无人出价)──> [EXPIRED 逾期流拍]
                        └──(无出价时卖家下架)──> [CANCELLED 撤销]
```

### 12.2 并发竞价与行级排他锁 (Concurrency Invariant)
1. 出价者发起竞拍，请求必须携带唯一 `idempotencyKey`；
2. 服务端开启事务，使用 PostgreSQL `SELECT * FROM ranch_auctions WHERE id = @Id FOR UPDATE` 锁住当前拍品；
3. 校验出价金额：必须大于当前最高价 + 最低加价幅度（$\ge \text{current\_bid} + \text{min\_increment}$）；
4. **保证金原子切换**：
   - 锁定新出价者钱包并执行 `RANCH_AUCTION_FREEZE` 扣减可用余额至冻结余额；
   - **立即解冻原最高出价者资金**：调用 `RANCH_AUCTION_UNFREEZE` 瞬间将原最高出价退回原买家可用余额，并下发实时超越通知；
   - 更新最高出价者 UID 与当前价，提交事务。

### 12.3 最后时刻竞价自动延长规则 (Anti-Snipe R13)
- 为杜绝网络外挂最后一秒恶意“压哨偷跑”，系统启用动态延时保护：
  - **若在拍卖结束前 30 秒内（即 `expires_at - now < 30s`）出现有效新出价**；
  - **系统自动将 `expires_at` 延长 30 秒**；
  - **单场拍卖最多累计延长 5 次（最高延长 150 秒）**，超过 5 次后以最终真实到期时间为准截标。

---

## 十三、点对点契约转让与原子交换 (R14)

### 13.1 P2P 完整交易状态机

```
 [CREATED 契约创建] ──> [BUYER_PENDING 等待买家确认] ──> [CONFIRMED 双方同意] ──> [SETTLEMENT_PENDING] ──> [COMPLETED 完成]
                             │
                             ├──(买家主动拒绝)──> [REJECTED 拒绝解除锁]
                             ├──(超时未确认24h)──> [EXPIRED 超时解除锁]
                             └──(卖家撤销)──────> [CANCELLED 撤销]
```

### 13.2 原子转移安全保证
- 创建契约时，马匹立即被加上 `TRANSFER_LOCKED` 锁，禁止挂牌拍卖或参赛；
- 买家输入安全支付密码确认后，数据库在单事务内执行：
  - 校验买家可用余额 $\ge$ 协商契约价；
  - 扣除买家金币，增加卖家金币，写入双方流水；
  - 转移 `ranch_horses.owner_player_id = buyer_id`；
  - 清空马具挂载（马具归还原马主仓库）；
  - 变更状态为 `COMPLETED`，解除马匹转移锁。

---

## 十四、系统保底回购定价机制

任何阶段的马匹若马主欲清理淘汰，马事公会提供保底回购变现兜底：

$$\text{BuybackPrice} = \text{BasePrice}(\text{Tier}) + (\text{Level} \times 25) + (\text{CareerWins} \times 100) + (\text{AccumulatedPurse} \times 0.05)$$

| 血统级别 (Pedigree Tier) | 基础回购金 (BasePrice) |
| :--- | :---: |
| 怀俄明荒野改良马 (Frontier Trail) | 150 🪙 |
| 柯尔特平原纯血马 (Colt Plains TB) | 400 🪙 |
| 皇家冠军御厩纯血 (Royal Champion) | 1,200 🪙 |
| 传奇名驹神殿血统 (Mythic Hall of Fame)| 3,500 🪙 |

---

## 十五、Worker 实时任务系统与断电恢复机制 (R15)

### 15.1 后台任务统一调度表 (`background_jobs`)
系统部署持久化任务队列表，任何定时或延迟推进均落库调度：

| 任务类型 (`job_type`) | 执行周期/触发点 | 业务职责 | 幂等与断电恢复保障 |
| :--- | :---: | :--- | :--- |
| `JOB_DIGESTION` | 每小时心跳 | 扫描活跃马匹结算饱腹度代谢 | 记录最后计算时间戳，支持追赶 |
| `JOB_DAILY_RESET` | 每日 UTC 00:00 | 刷新青年马每日 100 体力 | 幂等判定日期唯一键 |
| `JOB_PREGNANCY_STEP`| 每 10 分钟轮询 | 检查妊娠孕期阶段变迁与分娩就绪 | 基于 `due_at` 触发，不漏单 |
| `JOB_AUCTION_EXPIRE`| 每 5 秒轮询 | 检查到期拍卖，触发买家结算或流拍 | 行锁并发处理，状态防重 |
| `JOB_CIRCUIT_START` | 赛前 1 分钟 | 锁马撮合，不足 6 人执行退费 | 单向状态推进 `LOCKED` |
| `JOB_CIRCUIT_SETTLE`| 赛后即时触发 | 执行物理模拟，核发名次奖金与积分 | 事务写结算表与资金账本 |

### 15.2 重启与宕机自愈机制
- **分布式排他锁**：Worker 节点抢占 Redis 租约锁（或 PostgreSQL Advisory Lock），避免多实例重复拉取；
- **崩溃补偿执行**：Worker 进程因宿主机断电或重启后，启动自检阶段首先拉取 `status = 'PENDING'` 且 `scheduled_at <= NOW()` 的超时未完结 Job，按优先级重放补偿。

### 15.3 Worker 拓扑与进程隔离机制 (Dual-Worker Architecture)
为了确保高频模式一（180s 极速竞猜）与模式三长周期异步任务互不干扰，Worker 层采用双后台服务分离架构：
1. **`RaceRoundWorker` (现存)**：
   - 职责：专职负责模式一 `race_rounds` 状态机推进（Betting -> Closed -> Preparing -> Racing -> Settlement -> Finished）与即时结算；
   - 分布式锁：`lock:race:advance`。
2. **`RanchJobWorker` (新增 BackgroundService)**：
   - 职责：专职消费 `background_jobs` 持久化队列表，分发处理代谢消耗 (`JOB_DIGESTION`)、体力重置 (`JOB_DAILY_RESET`)、妊娠推进 (`JOB_PREGNANCY_STEP`)、拍卖截标 (`JOB_AUCTION_EXPIRE`) 与巡回赛撮合 (`JOB_CIRCUIT_START`)；
   - 分布式锁：`lock:ranch:jobs`；
   - 容灾恢复：Worker 启动时先扫描 `status = 'PENDING' AND scheduled_at <= NOW()` 进行断电自愈补偿。

---

## 十六、PostgreSQL 数据库完整表结构与 DDL 约束 (R20)

### 16.0 数据库脚本交付归档规范 (Migration Alignment)
所有模式三表结构与种子数据严格按照仓库既有规范递增归档至 `Database/DeployInit/`：
1. `Database/DeployInit/014_wallet_frozen_balance.sql`：为现有 `wallets` 补充 `frozen_balance` 字段，以支持竞价保证金冻结；
2. `Database/DeployInit/015_ranch_core_tables.sql`：新增 `ranch_horses` 至 `ranch_p2p_transfers` 等 9 类核心资产与业务表；
3. `Database/DeployInit/016_background_jobs_queue.sql`：新增 `background_jobs` 持久化作业队列表与调度索引。

所有表均遵循 PostgreSQL 16 标准，金额采用 `NUMERIC(18, 2)`，时间使用 `TIMESTAMPTZ`。

```sql
-- 1. 牧场马匹主表
CREATE TABLE ranch_horses (
    id BIGSERIAL PRIMARY KEY,
    owner_player_id BIGINT NOT NULL REFERENCES players(id),
    horse_code VARCHAR(32) NOT NULL UNIQUE,
    custom_name VARCHAR(32) NOT NULL,
    gender VARCHAR(8) NOT NULL CHECK (gender IN ('STALLION', 'MARE')),
    growth_stage VARCHAR(16) NOT NULL CHECK (growth_stage IN ('FOAL', 'JUVENILE', 'MATURE', 'PRO_RACER')),
    level INT NOT NULL DEFAULT 1 CHECK (level >= 1),
    current_exp INT NOT NULL DEFAULT 0 CHECK (current_exp >= 0),
    max_exp INT NOT NULL DEFAULT 100,
    pedigree_tier VARCHAR(24) NOT NULL CHECK (pedigree_tier IN ('WILD', 'PLAINS_TB', 'ROYAL', 'MYTHIC')),
    sire_id BIGINT REFERENCES ranch_horses(id),
    dam_id BIGINT REFERENCES ranch_horses(id),
    generation INT NOT NULL DEFAULT 1,
    coat_color VARCHAR(16) NOT NULL DEFAULT 'BAY',
    running_style VARCHAR(16) NOT NULL DEFAULT 'STALKER',
    
    -- 五维能力与潜能 (CHECK 范围约束)
    speed_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (speed_stat >= 0 AND speed_stat <= 120),
    speed_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (speed_potential >= speed_stat),
    stamina_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (stamina_stat >= 0 AND stamina_stat <= 120),
    stamina_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (stamina_potential >= stamina_stat),
    burst_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (burst_stat >= 0 AND burst_stat <= 120),
    burst_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (burst_potential >= burst_stat),
    agility_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (agility_stat >= 0 AND agility_stat <= 120),
    agility_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (agility_potential >= agility_stat),
    temperament_stat NUMERIC(6, 2) NOT NULL DEFAULT 40.00 CHECK (temperament_stat >= 0 AND temperament_stat <= 120),
    temperament_potential NUMERIC(6, 2) NOT NULL DEFAULT 75.00 CHECK (temperament_potential >= temperament_stat),
    
    -- 生理状态与指标
    hunger_level INT NOT NULL DEFAULT 0 CHECK (hunger_level >= 0 AND hunger_level <= 100),
    stamina_energy INT NOT NULL DEFAULT 100 CHECK (stamina_energy >= 0 AND stamina_energy <= 100),
    condition_level INT NOT NULL DEFAULT 100 CHECK (condition_level >= 0 AND condition_level <= 100),
    hoof_wear INT NOT NULL DEFAULT 0 CHECK (hoof_wear >= 0 AND hoof_wear <= 100),
    intimacy_level INT NOT NULL DEFAULT 10 CHECK (intimacy_level >= 0 AND intimacy_level <= 100),
    health_points INT NOT NULL DEFAULT 100 CHECK (health_points >= 0 AND health_points <= 100),
    
    -- 装备槽位挂载
    saddle_item_id BIGINT NULL,
    stirrup_item_id BIGINT NULL,
    horseshoe_item_id BIGINT NULL,
    
    -- 资质与竞技履历
    is_licensed_racer BOOLEAN NOT NULL DEFAULT FALSE,
    qualification_time NUMERIC(6, 3) NULL,
    license_cert_code VARCHAR(48) NULL UNIQUE,
    total_career_races INT NOT NULL DEFAULT 0,
    total_career_wins INT NOT NULL DEFAULT 0,
    accumulated_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    season_points INT NOT NULL DEFAULT 0,
    
    -- 繁育与生理冷却
    is_pregnant BOOLEAN NOT NULL DEFAULT FALSE,
    breeding_cooldown_until TIMESTAMPTZ NULL,
    last_digested_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    -- 状态锁
    sub_status VARCHAR(24) NOT NULL DEFAULT 'IDLE' CHECK (sub_status IN ('IDLE', 'IN_RACE', 'AUCTION_LOCKED', 'TRANSFER_LOCKED', 'PREGNANT', 'RESTING', 'INJURED', 'SICK', 'RETIRED')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_horses_owner ON ranch_horses(owner_player_id);
CREATE INDEX idx_horses_pro_pts ON ranch_horses(is_licensed_racer, season_points DESC);

-- 2. 装备字典与装备实例表
CREATE TABLE ranch_equipment_items (
    id BIGSERIAL PRIMARY KEY,
    item_code VARCHAR(32) NOT NULL UNIQUE,
    item_name VARCHAR(48) NOT NULL,
    slot_category VARCHAR(16) NOT NULL CHECK (slot_category IN ('SADDLE', 'STIRRUP', 'HORSESHOE')),
    weight_kg NUMERIC(4, 2) NOT NULL DEFAULT 2.00,
    speed_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    stamina_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    burst_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    agility_bonus NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    turf_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    dirt_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    muddy_modifier NUMERIC(4, 2) NOT NULL DEFAULT 1.00,
    max_durability INT NOT NULL DEFAULT 100,
    price_coin NUMERIC(18, 2) NOT NULL DEFAULT 200.00,
    is_enabled BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE ranch_horse_equipment (
    id BIGSERIAL PRIMARY KEY,
    owner_player_id BIGINT NOT NULL REFERENCES players(id),
    equipment_item_id BIGINT NOT NULL REFERENCES ranch_equipment_items(id),
    equipped_horse_id BIGINT REFERENCES ranch_horses(id),
    current_durability INT NOT NULL,
    is_equipped BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 投喂日志表
CREATE TABLE ranch_feed_logs (
    id BIGSERIAL PRIMARY KEY,
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    feed_code VARCHAR(32) NOT NULL,
    coin_cost NUMERIC(18, 2) NOT NULL,
    exp_gained INT NOT NULL,
    hunger_before INT NOT NULL,
    hunger_after INT NOT NULL,
    condition_before INT NOT NULL,
    condition_after INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 训练日志表
CREATE TABLE ranch_training_logs (
    id BIGSERIAL PRIMARY KEY,
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    training_type VARCHAR(32) NOT NULL,
    stamina_energy_cost INT NOT NULL,
    coin_cost NUMERIC(18, 2) NOT NULL,
    exp_gained INT NOT NULL,
    speed_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    stamina_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    burst_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    agility_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    temperament_delta NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    hoof_wear_delta INT NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 资格审核考核记录表
CREATE TABLE ranch_qualification_trials (
    id BIGSERIAL PRIMARY KEY,
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    trial_time_seconds NUMERIC(6, 3) NOT NULL,
    standard_benchmark NUMERIC(6, 3) NOT NULL DEFAULT 24.500,
    is_passed BOOLEAN NOT NULL,
    fee_charged NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. 职业巡回赛事主表与报名单
CREATE TABLE ranch_races (
    id BIGSERIAL PRIMARY KEY,
    race_code VARCHAR(32) NOT NULL UNIQUE,
    race_title VARCHAR(64) NOT NULL,
    race_class VARCHAR(16) NOT NULL CHECK (race_class IN ('MAIDEN', 'G3', 'G2', 'G1')),
    track_surface VARCHAR(16) NOT NULL CHECK (track_surface IN ('TURF', 'DIRT', 'MUDDY')),
    distance_meters INT NOT NULL CHECK (distance_meters >= 800),
    entry_fee NUMERIC(18, 2) NOT NULL,
    gross_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    commission_fee NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    net_purse NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    min_entrants INT NOT NULL DEFAULT 6,
    max_entrants INT NOT NULL DEFAULT 8,
    status VARCHAR(24) NOT NULL DEFAULT 'SCHEDULED' CHECK (status IN ('SCHEDULED', 'REGISTRATION', 'LOCKED', 'MATCHED', 'RUNNING', 'FINISHED', 'SETTLED', 'CANCELLED')),
    registration_start_at TIMESTAMPTZ NOT NULL,
    registration_end_at TIMESTAMPTZ NOT NULL,
    race_started_at TIMESTAMPTZ NULL,
    settled_at TIMESTAMPTZ NULL
);

CREATE TABLE ranch_race_entries (
    id BIGSERIAL PRIMARY KEY,
    race_id BIGINT NOT NULL REFERENCES ranch_races(id),
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    player_id BIGINT NOT NULL REFERENCES players(id),
    gate_number INT NULL,
    final_rank INT NULL,
    finish_time_microseconds BIGINT NULL,
    prize_awarded NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    points_awarded INT NOT NULL DEFAULT 0,
    registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (race_id, horse_id)
);

-- 7. 繁育档案表
CREATE TABLE ranch_breeding_records (
    id BIGSERIAL PRIMARY KEY,
    dam_horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    sire_horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    dam_owner_id BIGINT NOT NULL REFERENCES players(id),
    sire_owner_id BIGINT NOT NULL REFERENCES players(id),
    stud_fee NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    bred_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    due_at TIMESTAMPTZ NOT NULL,
    is_inbred BOOLEAN NOT NULL DEFAULT FALSE,
    prenatal_score INT NOT NULL DEFAULT 100,
    trimester1_done BOOLEAN NOT NULL DEFAULT FALSE,
    trimester2_done BOOLEAN NOT NULL DEFAULT FALSE,
    trimester3_done BOOLEAN NOT NULL DEFAULT FALSE,
    status VARCHAR(24) NOT NULL DEFAULT 'GESTATION' CHECK (status IN ('GESTATION', 'FOALED', 'ABORTED')),
    offspring_horse_id BIGINT REFERENCES ranch_horses(id),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 8. 拍卖行主表与竞价流水
CREATE TABLE ranch_auctions (
    id BIGSERIAL PRIMARY KEY,
    seller_player_id BIGINT NOT NULL REFERENCES players(id),
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    start_bid_price NUMERIC(18, 2) NOT NULL,
    current_bid_price NUMERIC(18, 2) NOT NULL,
    buyout_price NUMERIC(18, 2) NULL,
    min_increment NUMERIC(18, 2) NOT NULL DEFAULT 50.00,
    highest_bidder_id BIGINT REFERENCES players(id),
    extended_count INT NOT NULL DEFAULT 0,
    started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    settled_at TIMESTAMPTZ NULL,
    commission_fee NUMERIC(18, 2) NOT NULL DEFAULT 0.00,
    status VARCHAR(24) NOT NULL DEFAULT 'ACTIVE' CHECK (status IN ('ACTIVE', 'BUYOUT_PENDING', 'SOLD', 'EXPIRED', 'CANCELLED', 'SETTLED'))
);

CREATE TABLE ranch_auction_bids (
    id BIGSERIAL PRIMARY KEY,
    auction_id BIGINT NOT NULL REFERENCES ranch_auctions(id),
    bidder_player_id BIGINT NOT NULL REFERENCES players(id),
    bid_amount NUMERIC(18, 2) NOT NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 9. 点对点转让契约表
CREATE TABLE ranch_p2p_transfers (
    id BIGSERIAL PRIMARY KEY,
    seller_player_id BIGINT NOT NULL REFERENCES players(id),
    buyer_player_id BIGINT NOT NULL REFERENCES players(id),
    horse_id BIGINT NOT NULL REFERENCES ranch_horses(id),
    agreed_price NUMERIC(18, 2) NOT NULL,
    status VARCHAR(24) NOT NULL DEFAULT 'BUYER_PENDING' CHECK (status IN ('BUYER_PENDING', 'CONFIRMED', 'COMPLETED', 'REJECTED', 'EXPIRED', 'CANCELLED')),
    expires_at TIMESTAMPTZ NOT NULL,
    completed_at TIMESTAMPTZ NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 10. 后台任务作业表
CREATE TABLE background_jobs (
    id BIGSERIAL PRIMARY KEY,
    job_type VARCHAR(48) NOT NULL,
    business_id VARCHAR(64) NOT NULL,
    scheduled_at TIMESTAMPTZ NOT NULL,
    attempt_count INT NOT NULL DEFAULT 0,
    max_retries INT NOT NULL DEFAULT 3,
    status VARCHAR(16) NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED')),
    last_error TEXT NULL,
    executed_at TIMESTAMPTZ NULL,
    idempotency_key VARCHAR(128) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_jobs_schedule ON background_jobs(status, scheduled_at);
```

---

## 十七、统一服务端 API 契约与全域错误码 (R17)

### 17.1 统一请求与响应信封

```json
// 成功响应 (HTTP 200)
{
  "code": 0,
  "message": "ok",
  "data": { ... },
  "traceId": "c8f13b94-20260916-01",
  "idempotencyKey": "idem-ranch-feed-889102-1",
  "serverTime": "2026-09-16T10:30:00.124Z"
}

// 业务错误响应 (HTTP 400 / 403 / 409 / 422)
{
  "code": 30104,
  "message": "Horse is currently locked in an active race and cannot be trained.",
  "data": null,
  "traceId": "c8f13b94-20260916-02",
  "serverTime": "2026-09-16T10:30:01.050Z"
}
```

### 17.1.1 API 信封向下兼容标准与双契约结构
为兼容现存 Cocos 客户端 `ApiClient.ts` 的基础解析逻辑（`code === 0` 与 `data`），服务端接口全面遵循以下向下兼容规则：
1. **基础三件套必须存在**：`code` (0为成功，非0为错误码)、`message` (人类可读信息)、`data` (成功载荷或 null)；
2. **错误码双契约输出**：
   - 响应信封顶层增设 `errorCode: string`（如 `"RANCH_FEED_STOMACH_FULL"`），与 5 位数字 `code`（如 `30002`）同步下发；
   - 客户端既可使用数值 `code` 做全局分支拦截，也可根据 `errorCode` 字符串执行国际化多语言（`I18n.t(res.errorCode)`）精准翻译；
3. **扩展追踪字段安全可选**：`traceId`、`idempotencyKey`、`serverTime` 作为顶层附加元数据返回，老客户端忽略不影响解析。

### 17.2 全域标准化错误码字典

| 模块域 | 错误代码 | 错误标识 (Enum) | 错误原因与前端提示 |
| :--- | :---: | :--- | :--- |
| **Auth** | 10001 | `AUTH_UNAUTHORIZED` | 会话已过期或未登录 |
| **Wallet**| 20001 | `WALLET_INSUFFICIENT_BALANCE` | 可用金币余额不足 |
| | 20002 | `WALLET_CONCURRENCY_CONFLICT` | 钱包发生并发更新冲突，请稍候重试 |
| | 20003 | `WALLET_FROZEN_FAILED` | 拍卖竞价资金冻结失败 |
| **Ranch** | 30001 | `RANCH_HORSE_NOT_FOUND` | 马匹不存在或已被转让 |
| | 30002 | `RANCH_FEED_STOMACH_FULL` | 饱腹度已达 100%，暂时无法进食 |
| | 30003 | `RANCH_TRAIN_ENERGY_EMPTY` | 青年马今日体力耗尽，请明日再来或牵引漫步 |
| | 30004 | `RANCH_HORSE_STATE_LOCKED` | 马匹处于参赛/拍卖/妊娠中，操作被锁定 |
| | 30005 | `RANCH_EQUIP_SLOT_MISMATCH` | 装备槽位不匹配或马匹未成年 |
| | 30006 | `RANCH_LICENSE_TRIAL_FAILED` | 400m 模拟试跑未达标，请加强调教后重试 |
| | 30007 | `RANCH_BUYBACK_NOT_OWNER` | 只有马匹合法拥有者方可申请马会回购 |
| **Race** | 40001 | `RACE_REGISTRATION_CLOSED` | 巡回赛事报名已截止 |
| | 40002 | `RACE_NOT_QUALIFIED` | 未获得职业执照或胜场不满足进阶赛门槛 |
| | 40003 | `RACE_ALREADY_ENTERED` | 该马匹已报名本场比赛，严禁重复提交 |
| **Breed** | 50001 | `BREED_IN_COOLDOWN` | 种公马或繁育母马处于交配冷却期中 |
| | 50002 | `BREED_SAME_GENDER` | 选配双方必须为一公一母 |
| | 50003 | `BREED_INCEST_WARNING` | 触发三代近亲警告，若继续将遭受基因退化惩罚 |
| **Auction**| 60001 | `AUCTION_BID_TOO_LOW` | 出价低于当前最高价或未达到最低加价幅度 |
| | 60002 | `AUCTION_EXPIRED` | 该拍品竞价时间已截止 |
| | 60003 | `AUCTION_OUTBID_SELF` | 您已是当前最高出价者，无需重复出价 |
| **Trade** | 70001 | `TRADE_CONTRACT_EXPIRED` | 点对点协议已超时失效 |
| | 70002 | `TRADE_PASSWORD_ERROR` | 二级交易密码错误 |

---

## 十八、客户端体验、8 态规范与断线重连 (R18)

### 18.1 页面 8 态规范矩阵
客户端所有马房交互页面（马房大厅、投喂界面、训练场、装备库、巡回赛大厅、拍卖行、繁育所）必须完整实现以下 8 态：

| 状态 | 触发条件 | 视觉与交互规范 |
| :--- | :--- | :--- |
| **1. Loading** | 发起 API 请求中 | 展现西部转轮加载动效，屏蔽全屏重复点击 |
| **2. Empty** | 无马匹/无赛程/无拍品 | 展示空置西部马厩插画，提供直达购买/引导按钮 |
| **3. Error** | 网络超时/500异常 | 弹出羊皮纸风格错误弹窗，明确原因与客服反馈代码 |
| **4. Retry** | 重试恢复机制 | 网络抖动时自动静默重试 3 次，失败后提供【点击重试】按钮 |
| **5. Disabled**| 饱腹满/体力空/金币不足 | 按钮置灰暗淡，并在点击时弹出明确提示气泡 |
| **6. Confirm**| 200🪙规费/拍卖大额出价 | 弹出双重二次确认对话框，展示明细后才可提交 |
| **7. Success**| 升级/过审/夺冠/竞价成功 | 全屏金币雨或德比金杯动画，播放庆祝音效 |
| **8. Reconnect**| 移动端网络切后台断线 | 恢复前台时自动对齐 `serverTime` 并静默刷新资产 |

---

## 十九、安全防作弊与后台配置中心

1. **防脚本刷接口**：写操作强制附带单次有效 `idempotencyKey` 与短时间戳防重放；
2. **防自买自卖与关联账号**：拍卖出价校验 IP、设备指纹与账号注册关联树，相同指纹禁止出价；
3. **后台版本化配置中心**：所有饲料价格、训练属性增量、400m 准入基线均入库版本化管理，修改记录必须保留操作员、生效时间与审批审计。

---

## 二十、测试矩阵与交付验收标准

开发与测试团队必须依据以下矩阵逐项验收并签署上线：

- [ ] **TC-R01 经验升级断言**：小马驹投喂梯牧草至 2,470 EXP，单事务连升至 Lv.10 并触发晋升礼炮；
- [ ] **TC-R02 潜能天花板断言**：当 `speed_stat` 达到 `speed_potential` 时，继续短程冲刺训练速度增量为 0；
- [ ] **TC-R03 每日体力重置断言**：青年马体力耗尽后，跨越 UTC 00:00 自动恢复至 100；
- [ ] **TC-R04 成年等级方案C断言**：马匹升至 Lv.20 后五维基础属性锁定，出赛仅增益声誉；
- [ ] **TC-R05 装备数值加成断言**：穿戴铝合金草地轻铁在草地巡回赛表现积分提升 3%，沙地下降 2%；
- [ ] **TC-R06 资格审核断言**：400m 跑出 24.10 秒合格扣除 200 🪙 并签发编号；跑出 25.00 秒不扣费；
- [ ] **TC-R07 突变与血统断言**：神殿血统繁育触发 25% 突变，五维某项潜能突破父代均值；
- [ ] **TC-R08 性别比例断言**：高并发压测 10,000 次分娩，公母性别比例稳定在 $50\% \pm 1.5\%$；
- [ ] **TC-R09 三代近亲拦截断言**：公马与其直系女儿配对，系统精准判定为近亲并施加 40% 潜能惩罚；
- [ ] **TC-R10 赛事奖金方案A断言**：8 匹马总报名费 640 🪙，扣除 3% 税金 19.20 🪙，第 1 名精准入账 341.44 🪙；
- [ ] **TC-R11 缺人自动取消断言**：巡回赛报名截止仅 5 匹马，赛事自动取消，5 匹马 100% 退还报名费；
- [ ] **TC-R12 拍卖压哨延长断言**：拍卖倒计时 15 秒时出价，拍卖到期时间自动后延 30 秒；
- [ ] **TC-R13 并发竞价行锁断言**：10 个并发线程同时出价同一拍品，仅 1 笔最高价成功，其余被超越保证金无残留；
- [ ] **TC-R14 Worker 重启恢复断言**：在妊娠分娩定时器触发瞬间 Kill 进程，Worker 重启后自动补积分娩新生幼驹。

namespace RaceGame.Domain.Entities;


/// <summary>定义 RaceRuleConfig 领域持久化数据结构及其业务状态字段。</summary>
public class RaceRuleConfig
{
    public long Id { get; set; }

    public string ConfigCode { get; set; } = string.Empty;

    public int Version { get; set; } = 1;

    public bool IsActive { get; set; }

    public bool IsPublished { get; set; }

    public decimal MinBetAmount { get; set; } = 2m;

    public decimal InitialWalletBalance { get; set; } = 1000m;

    public int ReliefWaitSeconds { get; set; } = 7200;

    public int ReliefDailyLimit { get; set; } = 5;

    public int BettingDurationSeconds { get; set; } = 180;

    public int PrepareDurationSeconds { get; set; } = 15;

    public int RaceDurationSeconds { get; set; } = 30;

    public int PostRaceIntervalSeconds { get; set; } = 75;

    public string? OddsAlgorithmVersion { get; set; }

    public string? ResultAlgorithmVersion { get; set; }

    public string? BlackHorseAlgorithmVersion { get; set; }

    public string? RoundingVersion { get; set; }

    public string? FeeScheduleJson { get; set; }

    public string? ConfigPayloadJson { get; set; }

    /// <summary>计划系统维护开始时间 (UTC)。</summary>
    public DateTime? MaintenanceStartAt { get; set; }

    /// <summary>计划系统维护结束时间 (UTC)。</summary>
    public DateTime? MaintenanceEndAt { get; set; }

    /// <summary>是否开启维护时间窗口拦截。</summary>
    public bool IsMaintenanceEnabled { get; set; }

    /// <summary>维护前多少分钟向在线玩家弹窗预警。</summary>
    public int MaintenanceNoticeMinutes { get; set; } = 30;

    /// <summary>系统停机维护原因文本。</summary>
    public string? MaintenanceReason { get; set; }

    /// <summary>单轮比赛最大总赔付限额（用于浮动彩池稀释赔率控制）。</summary>
    public decimal MaxRoundPayoutLiability { get; set; } = 500000.00m;

    /// <summary>下级负盈利返佣固定比例（默认千分之5即 0.005m）。</summary>
    public decimal ReferralCommissionRate { get; set; } = 0.005m;

    /// <summary>冲线冠亚军微差绝杀阈值（秒，小于等于该值触发 Photo Finish 慢动作，默认 0.18s）。</summary>
    public decimal PhotoFinishThresholdSeconds { get; set; } = 0.1800m;

    /// <summary>关联的全服累积大奖池代码标识。</summary>
    public string JackpotPoolCode { get; set; } = "MEGA_COIN_POOL";

    /// <summary>每笔有效下注注入全服累积大奖池的抽水比例（如 0.0150 代表 1.5%）。</summary>
    public decimal JackpotContributionRate { get; set; } = 0.0150m;

    /// <summary>全服大奖池保底种子启动金额。</summary>
    public decimal JackpotSeedAmount { get; set; } = 100000.00m;

    /// <summary>大奖爆出时中奖者瓜分比例（默认 0.7000 代表 70%）。</summary>
    public decimal JackpotWinnerShareRate { get; set; } = 0.7000m;

    /// <summary>大奖爆出时全服在线下注玩家普天同庆平分比例（默认 0.3000 代表 30%）。</summary>
    public decimal JackpotRainShareRate { get; set; } = 0.3000m;

    /// <summary>参与全服超级大奖彩金雨分红的当轮最低累计投注金额门槛（默认 50.00 币）。</summary>
    public decimal JackpotRainMinBetAmount { get; set; } = 50.00m;

    /// <summary>冲线微距绝杀 Photo Finish 慢动作提前触发的提前量（秒，默认 3.0 秒）。</summary>
    public decimal PhotoFinishLeadSeconds { get; set; } = 3.00m;

    /// <summary>触发冷门爆大奖的最低组合锁定赔率门槛（默认 500.00）。</summary>
    public decimal JackpotMinTriggerOdds { get; set; } = 500.00m;

    /// <summary>比赛中途开放冲刺加倍追投的起始秒数（第 15 秒）。</summary>
    public int InPlayWindowStartSecond { get; set; } = 15;

    /// <summary>比赛中途冲刺加倍追投的有效时间窗口长度（秒，默认 3 秒）。</summary>
    public int InPlayWindowDurationSeconds { get; set; } = 3;

    /// <summary>冲刺加倍注单获胜后额外加赠的净利润比例（默认 0.5000 即 +50%）。</summary>
    public decimal InPlayBoostProfitRate { get; set; } = 0.5000m;

    /// <summary>是否启用比赛过程中的动态解说字幕与语音广播。</summary>
    public bool IsCommentaryEnabled { get; set; } = true;

    /// <summary>是否在下注期开启赛前情报观察室与专家推荐早报。</summary>
    public bool IsTipsterEnabled { get; set; } = true;

    /// <summary>是否开启全员准备完毕提前开赛机制。</summary>
    public bool IsReadySkipEnabled { get; set; } = true;

    /// <summary>提前开赛机制触发后倒计时缩减至的剩余秒数（默认 10 秒）。</summary>
    public int ReadySkipRemainingSeconds { get; set; } = 10;

    /// <summary>连赢（Quinella）彩池返还率（默认 0.8600 即 86%）。</summary>
    public decimal PayoutQuinellaRatio { get; set; } = 0.8600m;

    /// <summary>位置（Place）彩池返还率（默认 0.8800 即 88%）。</summary>
    public decimal PayoutPlaceRatio { get; set; } = 0.8800m;

    /// <summary>二连单（Exacta）彩池返还率（默认 0.8400 即 84%）。</summary>
    public decimal PayoutExactaRatio { get; set; } = 0.8400m;

    /// <summary>黑马获胜权重加成乘数（默认 2.00 倍）。</summary>
    public decimal BlackHorseBoostMultiplier { get; set; } = 2.00m;

    /// <summary>微差绝杀剧本触发几率（默认 0.3500 即 35%）。</summary>
    public decimal PhotoFinishProbability { get; set; } = 0.3500m;

    /// <summary>每轮参赛马匹数量（默认 6 匹）。</summary>
    public int HorseCountPerRound { get; set; } = 6;

    /// <summary>马匹历史综合表现能力评分权重 JSON（rank1~rank6及winRate权重）。</summary>
    public string ScoreWeightsJson { get; set; } = "{\"rank1\":6,\"rank2\":5,\"rank3\":4,\"rank4\":3,\"rank5\":2,\"rank6\":1,\"winRate\":6}";

    /// <summary>专属马房出赛名次分红奖励阶梯 JSON（默认第1名200，第2名100，第3名50）。</summary>
    public string StableDividendScheduleJson { get; set; } = "{\"1\":200.00,\"2\":100.00,\"3\":50.00}";

    /// <summary>复合玩法赔率公式与范围夹紧参数 JSON。</summary>
    public string PlayTypeOddsCoefficientsJson { get; set; } = "{\"PLACE\":{\"factor\":0.40,\"min\":1.15,\"max\":4.50},\"QUINELLAPLACE\":{\"factor\":0.22,\"min\":1.50,\"max\":150.0},\"EXACTA\":{\"factor\":0.65,\"min\":3.0,\"max\":500.0},\"TRIO\":{\"factor\":0.15,\"min\":4.0,\"max\":1000.0},\"TRIFECTA\":{\"factor\":0.50,\"min\":6.0,\"max\":2000.0},\"TIERCE\":{\"factor\":0.50,\"min\":6.0,\"max\":2000.0}}";

    /// <summary>职业资质考核试跑达标基准（秒，默认 24.500s）。</summary>
    public decimal QualificationTrialBenchmark { get; set; } = 24.500m;

    /// <summary>职业资质考核试跑初始基准时长（秒，默认 25.800s）。</summary>
    public decimal QualificationTrialBaseTime { get; set; } = 25.800m;

    /// <summary>职业资质考核官方证书规费（默认 200.00 币）。</summary>
    public decimal QualificationLicenseFee { get; set; } = 200.00m;

    /// <summary>考核未达标再次申请冷却时长（小时，默认 4 小时）。</summary>
    public int QualificationCooldownHours { get; set; } = 4;

    /// <summary>系统保底回收价格与结算公式系数 JSON。</summary>
    public string SystemBuybackConfigJson { get; set; } = "{\"basePrices\":{\"WILD\":150.00,\"PLAINS_TB\":400.00,\"ROYAL\":1200.00,\"MYTHIC\":3500.00},\"levelBonus\":25.00,\"winBonus\":100.00,\"purseRate\":0.05}";

    public DateTime? EffectiveStartAt { get; set; }

    public DateTime? EffectiveEndAt { get; set; }

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

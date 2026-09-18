namespace RaceGame.Domain.Constants;

/// <summary>
/// 集中定义数据库与服务端流程共同使用的稳定业务代码。
/// 这些值会进入持久化记录或跨用例查询条件，修改时必须同时评估历史数据兼容性。
/// </summary>
public static class GameBusinessCodes
{
    /// <summary>默认规则配置的稳定代码。</summary>
    public const string DefaultRaceRuleConfigCode = "default";

    /// <summary>金币商城使用的虚拟币代码。</summary>
    public const string CoinCurrency = "COIN";

    /// <summary>钱包初始化赠送流水类型。</summary>
    public const string InitialGrantTransaction = "INIT_GRANT";

    /// <summary>下注扣款流水类型。</summary>
    public const string BetTransaction = "BET";

    /// <summary>比赛派奖流水类型。</summary>
    public const string RaceRewardTransaction = "RACE_REWARD";

    /// <summary>赛事取消全额退款流水类型。</summary>
    public const string BetRefundTransaction = "BET_REFUND";

    /// <summary>商城消费流水类型。</summary>
    public const string ShopPurchaseTransaction = "SHOP_PURCHASE";

    /// <summary>每日任务金币奖励流水类型。</summary>
    public const string DailyTaskRewardTransaction = "DAILY_TASK_REWARD";

    /// <summary>破产补偿金币流水类型。</summary>
    public const string ReliefGrantTransaction = "RELIEF_GRANT";

    /// <summary>局内冲刺加倍追投扣款流水类型。</summary>
    public const string InPlayDoubleDownTransaction = "IN_PLAY_DOUBLE_DOWN";

    /// <summary>全服超级累积大奖头奖派彩流水类型。</summary>
    public const string MegaJackpotWinTransaction = "MEGA_JACKPOT_WIN";

    /// <summary>全服超级累积大奖彩金雨普发流水类型。</summary>
    public const string MegaJackpotRainTransaction = "MEGA_JACKPOT_RAIN";

    /// <summary>下注订单引用类型。</summary>
    public const string BetOrderReference = "BET_ORDER";

    /// <summary>赛事轮次引用类型。</summary>
    public const string RaceRoundReference = "RACE_ROUND";

    /// <summary>商城订单引用类型。</summary>
    public const string ShopOrderReference = "SHOP_ORDER";

    /// <summary>每日任务领奖引用类型。</summary>
    public const string DailyTaskClaimReference = "DAILY_TASK_CLAIM";

    /// <summary>玩家引用类型。</summary>
    public const string PlayerReference = "PLAYER";

    /// <summary>已创建、等待处理的订单状态。</summary>
    public const string PendingStatus = "PENDING";

    /// <summary>业务处理完成状态。</summary>
    public const string CompletedStatus = "COMPLETED";

    /// <summary>业务处理失败状态。</summary>
    public const string FailedStatus = "FAILED";

    /// <summary>商城物品履约类型。</summary>
    public const string ItemDelivery = "ITEM";

    /// <summary>商城角色履约类型。</summary>
    public const string CharacterDelivery = "CHARACTER";

    /// <summary>商城装扮履约类型。</summary>
    public const string CosmeticDelivery = "COSMETIC";

    /// <summary>比赛场数每日任务类型。</summary>
    public const string DailyRaceCountTask = "RACE_COUNT";

    /// <summary>比赛胜场每日任务类型。</summary>
    public const string DailyRaceWinTask = "RACE_WIN";

    /// <summary>比赛负场每日任务类型。</summary>
    public const string DailyRaceLossTask = "RACE_LOSS";

    /// <summary>金币奖励类型。</summary>
    public const string CoinReward = "COIN";

    /// <summary>物品奖励类型。</summary>
    public const string ItemReward = "ITEM";

    /// <summary>角色完成一轮比赛获得的基础经验；正式运营可由角色等级配置覆盖。</summary>
    public const int CharacterRaceExperience = 10;

    /// <summary>余额归零后的补偿等待时长。</summary>
    public const int ReliefDelayHours = 2;

    /// <summary>每个伦敦自然日允许成功领取的补偿次数上限。</summary>
    public const int ReliefDailyLimit = 5;

    /// <summary>每次破产补偿发放的默认游戏币数量。</summary>
    public const decimal ReliefAmount = 1000m;

    /// <summary>金额计算的默认舍入协议版本。</summary>
    public const string DefaultRoundingVersion = "money:v1";

    /// <summary>默认赔率算法版本。</summary>
    public const string DefaultOddsAlgorithmVersion = "odds:v1";

    /// <summary>默认赛果算法版本。</summary>
    public const string DefaultResultAlgorithmVersion = "result:v1";

    /// <summary>默认黑马算法版本。</summary>
    public const string DefaultBlackHorseAlgorithmVersion = "blackhorse:v1";
}

/// <summary>
/// 提供数据库尚未发布规则配置时的安全开发基线。
/// 正常运行应优先读取已发布的 <c>race_rule_configs</c>，这些值只负责兼容空配置数据库。
/// </summary>
public static class GameRuleDefaults
{
    /// <summary>单笔下注最低金额。</summary>
    public const decimal MinimumBetAmount = 2m;
    /// <summary>新玩家初始游戏币余额。</summary>
    public const decimal InitialWalletBalance = 1000m;
    /// <summary>默认下注阶段时长（秒）。</summary>
    public const int BettingDurationSeconds = 180;
    /// <summary>默认准备阶段时长（秒）。</summary>
    public const int PrepareDurationSeconds = 15;
    /// <summary>默认比赛阶段时长（秒）。</summary>
    public const int RaceDurationSeconds = 30;
    /// <summary>默认轮间隔时长（秒）。</summary>
    public const int PostRaceIntervalSeconds = 75;
    /// <summary>每轮固定参赛马匹数量。</summary>
    public const int HorseCountPerRound = 6;
    /// <summary>合法马号下限。</summary>
    public const int MinimumHorseNumber = 1;
    /// <summary>合法马号上限。</summary>
    public const int MaximumHorseNumber = 6;
    /// <summary>金额默认保留的小数位数。</summary>
    public const int MoneyDecimalPlaces = 2;
    /// <summary>业务日使用的 IANA 时区。</summary>
    public const string LondonTimeZone = "Europe/London";
}

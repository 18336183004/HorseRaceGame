namespace RaceGame.Domain.Entities;


/// <summary>定义 BetOrder 领域持久化数据结构及其业务状态字段。</summary>
public class BetOrder
{
    public long Id { get; set; }

    public string OrderNo { get; set; } = string.Empty;

    public long PlayerId { get; set; }

    public long RoundId { get; set; }

    /// <summary>玩法类型：WIN (单马独赢) / QUINELLA (街机连赢组合)。</summary>
    public string PlayType { get; set; } = "WIN";

    /// <summary>选择的主马号（在 QUINELLA 中代表组合中较小马号）。</summary>
    public int HorseNo { get; set; }

    /// <summary>连赢模式下的第二匹马号（较大马号）。单马模式为 null。</summary>
    public int? SecondHorseNo { get; set; }

    /// <summary>连赢组合标识，形如 "1-2"、"2-4"。</summary>
    public string? Combination { get; set; }

    /// <summary>三重彩或三连碰模式下的第三匹马号。</summary>
    public int? ThirdHorseNo { get; set; }

    /// <summary>是否在开赛中途触发了冲刺加倍追投。</summary>
    public bool IsDoubleDown { get; set; }

    /// <summary>冲刺加倍追投追加的投注金额。</summary>
    public decimal DoubleDownAmount { get; set; }

    public decimal BetAmount { get; set; }

    public decimal LockedOdds { get; set; }

    public decimal PotentialReward { get; set; }

    public decimal GrossReward { get; set; }

    public decimal FeeRate { get; set; }

    public decimal FeeAmount { get; set; }

    public decimal NetReward { get; set; }

    public string? RoundingVersion { get; set; }

    /// <summary>注单生命周期状态。</summary>
    public RaceGame.Domain.Enums.BetOrderStatus Status { get; set; } = RaceGame.Domain.Enums.BetOrderStatus.Pending;

    public string? StatusReason { get; set; }

    /// <summary>该注单结算时实际执行的浮动彩池稀释因子（<= 1.0）。</summary>
    public decimal DilutionFactor { get; set; } = 1.0m;

    public string IdempotencyKey { get; set; } = string.Empty;

    /// <summary>Canonical business request fingerprint used to reject idempotency-key reuse with different parameters.</summary>
    public string? RequestHash { get; set; }

    public long? BetTransactionId { get; set; }

    public long? RewardTransactionId { get; set; }

    public long? FeeTransactionId { get; set; }

    /// <summary>赛事异常取消全额退款对应的钱包流水 ID。</summary>
    public long? RefundTransactionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? SettledAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

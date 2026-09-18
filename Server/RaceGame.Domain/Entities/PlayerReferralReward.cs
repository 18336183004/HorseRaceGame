namespace RaceGame.Domain.Entities;

/// <summary>定义 PlayerReferralReward 好友邀请与裂变返佣数据实体。</summary>
public class PlayerReferralReward
{
    public long Id { get; set; }

    public long ReferrerPlayerId { get; set; }

    public long InvitedPlayerId { get; set; }

    public string RewardType { get; set; } = "STARTER_INVITE";

    public decimal Amount { get; set; }

    public string Status { get; set; } = "GRANTED";

    public long? WalletTransactionId { get; set; }

    public string? IdempotencyKey { get; set; }

    /// <summary>关联的比赛轮次 ID（如果是比赛返佣）。</summary>
    public long? RoundId { get; set; }

    /// <summary>下级在当轮的净亏损基数（负盈利金额）。</summary>
    public decimal NetLossAmount { get; set; }

    /// <summary>当笔返佣抽成比例（0.2% + 当轮手续费率）。</summary>
    public decimal CommissionRate { get; set; }

    /// <summary>主动提炼领取佣金的时间。</summary>
    public DateTime? ClaimedAt { get; set; }

    /// <summary>提炼佣金对应的钱包流水 ID。</summary>
    public long? ClaimTransactionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;

/// <summary>定义 PlayerAchievement 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerAchievement
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long AchievementId { get; set; }

    public long CurrentProgress { get; set; }

    public bool IsCompleted { get; set; }

    public DateTime? CompletedAt { get; set; }

    public bool IsClaimed { get; set; }

    public DateTime? ClaimedAt { get; set; }

    public long? WalletTransactionId { get; set; }

    public string? IdempotencyKey { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

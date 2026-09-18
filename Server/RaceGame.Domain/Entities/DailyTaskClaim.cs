namespace RaceGame.Domain.Entities;


/// <summary>定义 DailyTaskClaim 领域持久化数据结构及其业务状态字段。</summary>
public class DailyTaskClaim
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long PlayerDailyTaskId { get; set; }

    public DateOnly BusinessDate { get; set; }

    public string ClaimStatus { get; set; } = string.Empty;

    public string RewardTypeSnapshot { get; set; } = string.Empty;

    public string? RewardPayloadSnapshot { get; set; }

    public long? WalletTransactionId { get; set; }

    public long? ItemTransactionId { get; set; }

    public string IdempotencyKey { get; set; } = string.Empty;

    public string? FailureCode { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

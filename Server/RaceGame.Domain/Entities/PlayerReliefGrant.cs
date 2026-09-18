namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerReliefGrant 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerReliefGrant
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public DateOnly BusinessDate { get; set; }

    public DateTime ScheduledAt { get; set; }

    public DateTime GrantAt { get; set; }

    public decimal Amount { get; set; } = 1000m;

    public string Status { get; set; } = string.Empty;

    public long? TriggerTransactionId { get; set; }

    public string IdempotencyKey { get; set; } = string.Empty;

    public long? GrantedTransactionId { get; set; }

    public int AttemptCount { get; set; }

    public DateTime? LastAttemptAt { get; set; }

    public string? FailureReason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

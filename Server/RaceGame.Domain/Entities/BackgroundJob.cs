namespace RaceGame.Domain.Entities;

/// <summary>
/// 后台持久化作业队列表实体。
/// </summary>
public class BackgroundJob
{
    public long Id { get; set; }

    public string JobType { get; set; } = string.Empty;

    public string BusinessId { get; set; } = string.Empty;

    public DateTime ScheduledAt { get; set; }

    public int AttemptCount { get; set; }

    public int MaxRetries { get; set; } = 3;

    /// <summary>状态：PENDING / RUNNING / COMPLETED / FAILED</summary>
    public string Status { get; set; } = "PENDING";

    public string? LastError { get; set; }

    public DateTime? ExecutedAt { get; set; }

    public string IdempotencyKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

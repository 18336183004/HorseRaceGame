namespace RaceGame.Domain.Entities;


/// <summary>定义 JobExecutionLog 领域持久化数据结构及其业务状态字段。</summary>
public class JobExecutionLog
{
    public long Id { get; set; }

    public string JobName { get; set; } = string.Empty;

    public string? JobKey { get; set; }

    public string? ScopeKey { get; set; }

    public string RunStatus { get; set; } = string.Empty;

    public string? OwnerInstance { get; set; }

    public int AttemptNo { get; set; } = 1;

    public string? ErrorMessage { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    public DateTime? FinishedAt { get; set; }
}

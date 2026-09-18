namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerAuthAuditLog 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerAuthAuditLog
{
    public long Id { get; set; }

    public long? PlayerId { get; set; }

    public string? AccountNormalized { get; set; }

    public string ActionType { get; set; } = string.Empty;

    public string Outcome { get; set; } = string.Empty;

    public string? FailureCode { get; set; }

    public string? RequestId { get; set; }

    public string? ClientIp { get; set; }

    public string? UserAgent { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

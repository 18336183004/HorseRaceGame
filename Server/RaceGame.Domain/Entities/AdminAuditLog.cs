namespace RaceGame.Domain.Entities;


/// <summary>定义 AdminAuditLog 领域持久化数据结构及其业务状态字段。</summary>
public class AdminAuditLog
{
    public long Id { get; set; }

    public long? AdminUserId { get; set; }

    public string ActionType { get; set; } = string.Empty;

    public string ResourceType { get; set; } = string.Empty;

    public string? ResourceId { get; set; }

    public string? RequestId { get; set; }

    public string? Reason { get; set; }

    public string? BeforeJson { get; set; }

    public string? AfterJson { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

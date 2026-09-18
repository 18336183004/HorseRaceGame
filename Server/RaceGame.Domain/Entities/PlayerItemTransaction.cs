namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerItemTransaction 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerItemTransaction
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long ItemId { get; set; }

    public string ChangeType { get; set; } = string.Empty;

    public long QuantityChange { get; set; }

    public long QuantityBefore { get; set; }

    public long QuantityAfter { get; set; }

    public string? ReferenceType { get; set; }

    public string? ReferenceId { get; set; }

    public string? IdempotencyKey { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

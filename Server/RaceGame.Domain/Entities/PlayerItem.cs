namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerItem 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerItem
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long ItemId { get; set; }

    public long Quantity { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerCosmetic 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerCosmetic
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long CosmeticId { get; set; }

    public string SlotType { get; set; } = string.Empty;

    public bool IsEquipped { get; set; }

    public DateTime ObtainedAt { get; set; } = DateTime.UtcNow;

    public DateTime? EquippedAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

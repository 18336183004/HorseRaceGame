namespace RaceGame.Domain.Entities;

/// <summary>
/// 玩家拥有的装备实例实体。
/// </summary>
public class RanchHorseEquipment
{
    public long Id { get; set; }

    public long OwnerPlayerId { get; set; }

    public long EquipmentItemId { get; set; }

    public long? EquippedHorseId { get; set; }

    public int CurrentDurability { get; set; } = 100;

    public bool IsEquipped { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public RanchEquipmentItem? EquipmentItem { get; set; }
}

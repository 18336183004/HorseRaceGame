namespace RaceGame.Domain.Entities;

/// <summary>
/// 纯血马具装备字典实体。
/// </summary>
public class RanchEquipmentItem
{
    public long Id { get; set; }

    public string ItemCode { get; set; } = string.Empty;

    public string ItemName { get; set; } = string.Empty;

    /// <summary>槽位分类：SADDLE (马鞍) / STIRRUP (马镫) / HORSESHOE (赛道蹄铁)</summary>
    public string SlotCategory { get; set; } = "SADDLE";

    public decimal WeightKg { get; set; } = 2.00m;

    public decimal SpeedBonus { get; set; }

    public decimal StaminaBonus { get; set; }

    public decimal BurstBonus { get; set; }

    public decimal AgilityBonus { get; set; }

    public decimal TurfModifier { get; set; } = 1.00m;

    public decimal DirtModifier { get; set; } = 1.00m;

    public decimal MuddyModifier { get; set; } = 1.00m;

    public int MaxDurability { get; set; } = 100;

    public decimal PriceCoin { get; set; } = 200.00m;

    public bool IsEnabled { get; set; } = true;
}

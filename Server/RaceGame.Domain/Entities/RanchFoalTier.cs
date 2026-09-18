namespace RaceGame.Domain.Entities;

/// <summary>纯血马房幼驹血统档位实体。</summary>
public class RanchFoalTier
{
    public long Id { get; set; }

    /// <summary>血统标识代码：WILD, PLAINS_TB, ROYAL, MYTHIC</summary>
    public string TierCode { get; set; } = string.Empty;

    public string TierNameZh { get; set; } = string.Empty;

    public string TierNameEn { get; set; } = string.Empty;

    public decimal AdoptPrice { get; set; }

    public decimal MinPotential { get; set; }

    public decimal MaxPotential { get; set; }

    public decimal BaseSpeed { get; set; }

    public decimal BaseStamina { get; set; }

    public decimal BaseBurst { get; set; }

    public decimal BaseAgility { get; set; }

    public decimal BaseTemperament { get; set; }

    public string DescriptionZh { get; set; } = string.Empty;

    public string DescriptionEn { get; set; } = string.Empty;

    /// <summary>幼驹随机马名池 JSON 格式字符串</summary>
    public string RandomNamesJson { get; set; } = "[]";

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

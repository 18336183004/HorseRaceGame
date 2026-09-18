namespace RaceGame.Domain.Entities;

/// <summary>理疗医护字典实体。</summary>
public class RanchCareCatalog
{
    public long Id { get; set; }

    /// <summary>护理类型代码：GROOM, HANDWALK, FARRIER, PROBIOTIC, PHYSIOMUD</summary>
    public string CareType { get; set; } = string.Empty;

    public string CareNameZh { get; set; } = string.Empty;

    public string CareNameEn { get; set; } = string.Empty;

    public decimal CoinCost { get; set; }

    public int CooldownHours { get; set; }

    public int IntimacyBonus { get; set; }

    public int ConditionBonus { get; set; }

    public int HealthBonus { get; set; }

    public int EnergyBonus { get; set; }

    public int HoofWearRelief { get; set; }

    public bool ClearsIllness { get; set; }

    public bool ClearsInjury { get; set; }

    public string DescriptionZh { get; set; } = string.Empty;

    public string DescriptionEn { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

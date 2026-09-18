namespace RaceGame.Domain.Entities;

/// <summary>专项体能训练字典实体。</summary>
public class RanchTrainingCatalog
{
    public long Id { get; set; }

    /// <summary>训练科目代码：SPRINT, LOPE, CORNER, HILL</summary>
    public string TrainingType { get; set; } = string.Empty;

    public string TrainingNameZh { get; set; } = string.Empty;

    public string TrainingNameEn { get; set; } = string.Empty;

    public decimal CoinCost { get; set; }

    public int EnergyCost { get; set; } = 25;

    public int ExpGain { get; set; } = 100;

    public int HoofWearDelta { get; set; } = 8;

    public int ConditionLoss { get; set; } = 5;

    public decimal SpeedDelta { get; set; }

    public decimal StaminaDelta { get; set; }

    public decimal BurstDelta { get; set; }

    public decimal AgilityDelta { get; set; }

    public decimal TemperamentDelta { get; set; }

    public string DescriptionZh { get; set; } = string.Empty;

    public string DescriptionEn { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

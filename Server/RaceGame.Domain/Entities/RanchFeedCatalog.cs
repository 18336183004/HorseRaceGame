namespace RaceGame.Domain.Entities;

/// <summary>草料饲料字典实体。</summary>
public class RanchFeedCatalog
{
    public long Id { get; set; }

    public string FeedCode { get; set; } = string.Empty;

    public string FeedNameZh { get; set; } = string.Empty;

    public string FeedNameEn { get; set; } = string.Empty;

    /// <summary>分类：ROUGHAGE (粗饲料) / CONCENTRATE (精饲料)</summary>
    public string FeedCategory { get; set; } = "ROUGHAGE";

    public decimal CoinCost { get; set; }

    public int HungerFill { get; set; } = 30;

    public int ExpGain { get; set; } = 50;

    public int ConditionBonus { get; set; }

    public decimal BurstBonus { get; set; }

    public decimal TemperamentBonus { get; set; }

    public string DescriptionZh { get; set; } = string.Empty;

    public string DescriptionEn { get; set; } = string.Empty;

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

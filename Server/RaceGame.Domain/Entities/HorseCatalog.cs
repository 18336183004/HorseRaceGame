namespace RaceGame.Domain.Entities;


/// <summary>定义 HorseCatalog 领域持久化数据结构及其业务状态字段。</summary>
public class HorseCatalog
{
    public long Id { get; set; }

    public string HorseCode { get; set; } = string.Empty;

    public string NameZh { get; set; } = string.Empty;

    public string? NameEn { get; set; }

    public string? DescriptionZh { get; set; }

    public string? DescriptionEn { get; set; }

    public string? AvatarAsset { get; set; }

    public string? PortraitAsset { get; set; }

    public string? MetadataJson { get; set; }

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public long TotalRaces { get; set; }

    public long WinCount { get; set; }

    public decimal WinRate { get; set; }

    public long Rank1Count { get; set; }

    public long Rank2Count { get; set; }

    public long Rank3Count { get; set; }

    public long Rank4Count { get; set; }

    public long Rank5Count { get; set; }

    public long Rank6Count { get; set; }

    public decimal Rank1Probability { get; set; }

    public decimal Rank2Probability { get; set; }

    public decimal Rank3Probability { get; set; }

    public decimal Rank4Probability { get; set; }

    public decimal Rank5Probability { get; set; }

    public decimal Rank6Probability { get; set; }

    /// <summary>赛道偏好：TURF (草地), DIRT (泥地), SAND (沙地)</summary>
    public string PreferredTrack { get; set; } = "TURF";

    /// <summary>天气偏好：SUNNY (晴天), RAINY (雨天), CLOUDY (阴天)</summary>
    public string PreferredWeather { get; set; } = "SUNNY";

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

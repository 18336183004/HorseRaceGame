namespace RaceGame.Domain.Entities;

/// <summary>定义 AchievementDefinition 领域持久化数据结构及其业务状态字段（对应 1.png Feat 页面）。</summary>
public class AchievementDefinition
{
    public long Id { get; set; }

    public string AchievementCode { get; set; } = string.Empty;

    public string Category { get; set; } = "CAREER";

    public string TitleZh { get; set; } = string.Empty;

    public string TitleEn { get; set; } = string.Empty;

    public string DescriptionZh { get; set; } = string.Empty;

    public string DescriptionEn { get; set; } = string.Empty;

    public string? IconAsset { get; set; }

    public string? BadgeName { get; set; }

    public long TargetValue { get; set; } = 1;

    public string RewardType { get; set; } = "COIN";

    public string RewardPayload { get; set; } = "{}";

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

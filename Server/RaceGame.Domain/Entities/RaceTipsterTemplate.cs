namespace RaceGame.Domain.Entities;

/// <summary>赛前专家推荐与评语模板实体。</summary>
public class RaceTipsterTemplate
{
    public long Id { get; set; }

    /// <summary>匹配条件：BOTH (场地与天气全契合), TRACK_ONLY, WEATHER_ONLY, DEFAULT</summary>
    public string MatchCondition { get; set; } = string.Empty;

    public int MinStars { get; set; } = 3;

    public int MaxStars { get; set; } = 5;

    public string AnalysisZh { get; set; } = string.Empty;

    public string AnalysisEn { get; set; } = string.Empty;

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

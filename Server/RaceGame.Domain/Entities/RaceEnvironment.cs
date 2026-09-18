namespace RaceGame.Domain.Entities;

/// <summary>比赛环境（天气与跑道）主数据实体。</summary>
public class RaceEnvironment
{
    public long Id { get; set; }

    /// <summary>环境类型：WEATHER (天气) 或 TRACK (跑道)</summary>
    public string EnvironmentType { get; set; } = string.Empty;

    /// <summary>环境代码：如 SUNNY, RAINY, CLOUDY, TURF, DIRT, SAND</summary>
    public string Code { get; set; } = string.Empty;

    public string NameZh { get; set; } = string.Empty;

    public string NameEn { get; set; } = string.Empty;

    public string? DescriptionZh { get; set; }

    public string? DescriptionEn { get; set; }

    /// <summary>马匹契合偏好时的表现力加成倍率（默认 1.0800 即 +8%）</summary>
    public decimal AdaptationBonusRate { get; set; } = 1.0800m;

    /// <summary>随机生成的权重</summary>
    public int SelectionWeight { get; set; } = 100;

    /// <summary>前端表现层对应的主题色/光照标识</summary>
    public string? VisualThemeKey { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

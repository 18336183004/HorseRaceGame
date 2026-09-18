namespace RaceGame.Domain.Entities;

/// <summary>赛况解说台本模板实体。</summary>
public class RaceCommentaryTemplate
{
    public long Id { get; set; }

    /// <summary>阶段标识：START, TURN, STRETCH, FINISH</summary>
    public string Phase { get; set; } = string.Empty;

    /// <summary>关联天气条件（如 RAINY, CLOUDY，为 null 则为通用）</summary>
    public string? WeatherCondition { get; set; }

    /// <summary>是否冲线微差绝杀专用</summary>
    public bool IsPhotoFinish { get; set; }

    /// <summary>默认触发秒数</summary>
    public int TriggerSecond { get; set; } = 1;

    public string TextZh { get; set; } = string.Empty;

    public string TextEn { get; set; } = string.Empty;

    public string? SoundCue { get; set; }

    public bool IsEnabled { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

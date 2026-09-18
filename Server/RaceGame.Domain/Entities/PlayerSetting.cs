namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerSetting 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerSetting
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public string Language { get; set; } = "zh-CN";

    public string TimeZone { get; set; } = "Europe/London";

    public bool AllowPushNotice { get; set; } = true;

    public bool AllowResultAnimation { get; set; } = true;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

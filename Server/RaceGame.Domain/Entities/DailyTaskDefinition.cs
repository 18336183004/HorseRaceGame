namespace RaceGame.Domain.Entities;


/// <summary>定义 DailyTaskDefinition 领域持久化数据结构及其业务状态字段。</summary>
public class DailyTaskDefinition
{
    public long Id { get; set; }

    public string TaskCode { get; set; } = string.Empty;

    public string TaskType { get; set; } = string.Empty;

    public string TitleZh { get; set; } = string.Empty;

    public string? TitleEn { get; set; }

    public string? DescriptionZh { get; set; }

    public string? DescriptionEn { get; set; }

    public int TargetValue { get; set; }

    public string? ConditionPayloadJson { get; set; }

    public string RewardType { get; set; } = string.Empty;

    public string? RewardPayload { get; set; }

    public int Version { get; set; } = 1;

    public bool IsEnabled { get; set; } = true;

    public int SortOrder { get; set; }

    public DateTime? EffectiveStartAt { get; set; }

    public DateTime? EffectiveEndAt { get; set; }

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

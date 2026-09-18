namespace RaceGame.Domain.Entities;


/// <summary>定义 Notice 领域持久化数据结构及其业务状态字段。</summary>
public class Notice
{
    public long Id { get; set; }

    public string NoticeCode { get; set; } = string.Empty;

    public string TitleZh { get; set; } = string.Empty;

    public string? TitleEn { get; set; }

    public string ContentZh { get; set; } = string.Empty;

    public string? ContentEn { get; set; }

    public string NoticeType { get; set; } = string.Empty;

    public int Version { get; set; } = 1;

    public int SortOrder { get; set; }

    public bool IsForced { get; set; }

    public bool IsPublished { get; set; }

    public DateTime? PublishedAt { get; set; }

    public DateTime? StartAt { get; set; }

    public DateTime? EndAt { get; set; }

    public string? TargetPayloadJson { get; set; }

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

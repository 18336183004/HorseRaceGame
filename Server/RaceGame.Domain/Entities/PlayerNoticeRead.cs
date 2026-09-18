namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerNoticeRead 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerNoticeRead
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long NoticeId { get; set; }

    public DateTime ReadAt { get; set; } = DateTime.UtcNow;

    public int? DismissedVersion { get; set; }

    public DateTime? AcknowledgedAt { get; set; }
}

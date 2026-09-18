namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerDailyTask 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerDailyTask
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long TaskDefinitionId { get; set; }

    public DateOnly BusinessDate { get; set; }

    public int Progress { get; set; }

    public bool IsCompleted { get; set; }

    public DateTime? CompletedAt { get; set; }

    public DateTime? ClaimedAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

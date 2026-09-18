namespace RaceGame.Domain.Entities;


/// <summary>定义 RaceRoundStateLog 领域持久化数据结构及其业务状态字段。</summary>
public class RaceRoundStateLog
{
    public long Id { get; set; }

    public long RoundId { get; set; }

    public int? FromState { get; set; }

    public int ToState { get; set; }

    public string TriggerSource { get; set; } = string.Empty;

    public string ExecutionStatus { get; set; } = string.Empty;

    public string? RequestId { get; set; }

    public string? ErrorMessage { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

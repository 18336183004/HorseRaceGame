namespace RaceGame.Domain.Entities;


/// <summary>定义 RaceSettlementRun 领域持久化数据结构及其业务状态字段。</summary>
public class RaceSettlementRun
{
    public long Id { get; set; }

    public long RoundId { get; set; }

    public string RunStatus { get; set; } = string.Empty;

    public string? RunReason { get; set; }

    public string? ExecutionKey { get; set; }

    public int OrdersScannedCount { get; set; }

    public int OrdersSettledCount { get; set; }

    public int FailedOrderCount { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime StartedAt { get; set; } = DateTime.UtcNow;

    public DateTime? FinishedAt { get; set; }
}

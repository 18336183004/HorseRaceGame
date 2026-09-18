namespace RaceGame.Domain.Entities;

/// <summary>
/// 保存比赛级别的业务事件快照。比赛日志只记录轮次/比赛信息，不混入马匹或角色明细。
/// </summary>
public class RaceLog
{
    public long Id { get; set; }
    public long RoundId { get; set; }
    public string RoundNo { get; set; } = string.Empty;
    public string EventType { get; set; } = string.Empty;
    public int State { get; set; }
    public string ExecutionStatus { get; set; } = string.Empty;
    public string? RequestId { get; set; }
    public string? PayloadJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

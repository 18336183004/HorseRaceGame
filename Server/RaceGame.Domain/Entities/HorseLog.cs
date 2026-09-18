namespace RaceGame.Domain.Entities;

/// <summary>
/// 保存单匹马在比赛生命周期中的独立记录。马匹日志不写入角色或玩家资产数据。
/// </summary>
public class HorseLog
{
    public long Id { get; set; }
    public long RoundId { get; set; }
    public long? RaceHorseId { get; set; }
    public long HorseTemplateId { get; set; }
    public int HorseNo { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string ExecutionStatus { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

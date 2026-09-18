namespace RaceGame.Domain.Entities;

/// <summary>
/// 保存玩家角色资产的独立变化记录。比赛日志和马匹日志不得写入此表。
/// </summary>
public class CharacterLog
{
    public long Id { get; set; }
    public long PlayerId { get; set; }
    public long CharacterId { get; set; }
    public long? PlayerCharacterId { get; set; }
    public string EventType { get; set; } = string.Empty;
    public string ExecutionStatus { get; set; } = string.Empty;
    public string? PayloadJson { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

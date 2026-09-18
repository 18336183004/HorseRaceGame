namespace RaceGame.Domain.Entities;


/// <summary>定义 CharacterLevelConfig 领域持久化数据结构及其业务状态字段。</summary>
public class CharacterLevelConfig
{
    public long Id { get; set; }

    public long CharacterId { get; set; }

    public int Level { get; set; }

    public long RequiredExp { get; set; }

    public string? RewardType { get; set; }

    public string? RewardPayload { get; set; }

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

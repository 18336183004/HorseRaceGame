namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerCharacter 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerCharacter
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long CharacterId { get; set; }

    public int Level { get; set; } = 1;

    public long Exp { get; set; }

    public bool IsEquipped { get; set; }

    public DateTime ObtainedAt { get; set; } = DateTime.UtcNow;

    public DateTime? EquippedAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

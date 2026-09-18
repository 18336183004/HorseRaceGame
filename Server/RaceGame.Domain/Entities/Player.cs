namespace RaceGame.Domain.Entities;


/// <summary>定义 Player 领域持久化数据结构及其业务状态字段。</summary>
public class Player
{
    public long Id { get; set; }

    public string AccountId { get; set; } = string.Empty;

    public string AccountNormalized { get; set; } = string.Empty;

    public string Nickname { get; set; } = string.Empty;

    public string? AvatarAsset { get; set; }

    public string Locale { get; set; } = "zh-CN";

    public int Level { get; set; } = 1;

    public long Exp { get; set; }

    public bool IsActive { get; set; } = true;

    public string? InviteCode { get; set; }

    public long? ReferredByPlayerId { get; set; }

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

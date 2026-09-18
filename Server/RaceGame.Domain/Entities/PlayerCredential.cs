namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerCredential 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerCredential
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public string PasswordHash { get; set; } = string.Empty;

    public string PasswordAlgorithm { get; set; } = string.Empty;

    public int PasswordVersion { get; set; } = 1;

    public int FailedLoginCount { get; set; }

    public DateTime? LockedUntil { get; set; }

    public DateTime LastPasswordChangedAt { get; set; } = DateTime.UtcNow;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

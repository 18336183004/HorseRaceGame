namespace RaceGame.Domain.Entities;


/// <summary>定义 AdminUser 领域持久化数据结构及其业务状态字段。</summary>
public class AdminUser
{
    public long Id { get; set; }

    public string Username { get; set; } = string.Empty;

    public string UsernameNormalized { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string PasswordAlgorithm { get; set; } = string.Empty;

    public int PasswordVersion { get; set; } = 1;

    public bool IsActive { get; set; } = true;

    public DateTime LastPasswordChangedAt { get; set; } = DateTime.UtcNow;

    public DateTime? LastLoginAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

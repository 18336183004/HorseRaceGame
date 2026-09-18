namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerSession 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerSession
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public string RefreshTokenHash { get; set; } = string.Empty;

    public string? AccessTokenJti { get; set; }

    public string ClientPlatform { get; set; } = string.Empty;

    public string? ClientVersion { get; set; }

    public string? DeviceId { get; set; }

    public string? ClientIp { get; set; }

    public string? UserAgent { get; set; }

    public DateTime IssuedAt { get; set; } = DateTime.UtcNow;

    public DateTime ExpiresAt { get; set; }

    public DateTime? RevokedAt { get; set; }

    public string? RevokeReason { get; set; }

    public DateTime? LastSeenAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

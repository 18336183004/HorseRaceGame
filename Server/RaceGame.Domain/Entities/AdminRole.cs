namespace RaceGame.Domain.Entities;


/// <summary>定义 AdminRole 领域持久化数据结构及其业务状态字段。</summary>
public class AdminRole
{
    public long Id { get; set; }

    public string RoleCode { get; set; } = string.Empty;

    public string RoleName { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

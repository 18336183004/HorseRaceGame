namespace RaceGame.Domain.Entities;


/// <summary>定义 AdminUserRole 领域持久化数据结构及其业务状态字段。</summary>
public class AdminUserRole
{
    public long Id { get; set; }

    public long AdminUserId { get; set; }

    public long AdminRoleId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

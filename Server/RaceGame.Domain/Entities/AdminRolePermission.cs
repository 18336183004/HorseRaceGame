namespace RaceGame.Domain.Entities;


/// <summary>定义 AdminRolePermission 领域持久化数据结构及其业务状态字段。</summary>
public class AdminRolePermission
{
    public long Id { get; set; }

    public long AdminRoleId { get; set; }

    public long AdminPermissionId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

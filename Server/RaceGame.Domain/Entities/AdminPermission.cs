namespace RaceGame.Domain.Entities;


/// <summary>定义 AdminPermission 领域持久化数据结构及其业务状态字段。</summary>
public class AdminPermission
{
    public long Id { get; set; }

    public string PermissionCode { get; set; } = string.Empty;

    public string PermissionName { get; set; } = string.Empty;

    public string ResourceType { get; set; } = string.Empty;

    public string ActionType { get; set; } = string.Empty;

    public string? Description { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

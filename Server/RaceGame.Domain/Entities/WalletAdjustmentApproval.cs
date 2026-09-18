namespace RaceGame.Domain.Entities;


/// <summary>定义 WalletAdjustmentApproval 领域持久化数据结构及其业务状态字段。</summary>
public class WalletAdjustmentApproval
{
    public long Id { get; set; }

    public long RequestId { get; set; }

    public long AdminUserId { get; set; }

    public string Decision { get; set; } = string.Empty;

    public string? Reason { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

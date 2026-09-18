namespace RaceGame.Domain.Entities;


/// <summary>定义 WalletAdjustmentRequest 领域持久化数据结构及其业务状态字段。</summary>
public class WalletAdjustmentRequest
{
    public long Id { get; set; }

    public string RequestNo { get; set; } = string.Empty;

    public long PlayerId { get; set; }

    public long RequestedByAdminUserId { get; set; }

    public long? ExecutedByAdminUserId { get; set; }

    public string AdjustmentType { get; set; } = string.Empty;

    public decimal AdjustmentAmount { get; set; }

    public decimal? BalanceBefore { get; set; }

    public decimal? BalanceAfter { get; set; }

    public string Reason { get; set; } = string.Empty;

    public string Status { get; set; } = string.Empty;

    public string IdempotencyKey { get; set; } = string.Empty;

    public long? ExecutedTransactionId { get; set; }

    public string? RequestMetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? ApprovedAt { get; set; }

    public DateTime? ExecutedAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

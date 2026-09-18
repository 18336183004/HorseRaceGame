namespace RaceGame.Domain.Entities;


/// <summary>定义 WalletTransaction 领域持久化数据结构及其业务状态字段。</summary>
public class WalletTransaction
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public string TransactionType { get; set; } = string.Empty;

    public decimal Amount { get; set; }

    public decimal BalanceBefore { get; set; }

    public decimal BalanceAfter { get; set; }

    public decimal FeeRate { get; set; }

    public decimal FeeAmount { get; set; }

    public string? ReferenceType { get; set; }

    public string? ReferenceId { get; set; }

    public string? RequestId { get; set; }

    public long? OperatorAdminUserId { get; set; }

    public string? IdempotencyKey { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

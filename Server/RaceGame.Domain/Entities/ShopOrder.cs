namespace RaceGame.Domain.Entities;


/// <summary>定义 ShopOrder 领域持久化数据结构及其业务状态字段。</summary>
public class ShopOrder
{
    public long Id { get; set; }

    public string OrderNo { get; set; } = string.Empty;

    public long PlayerId { get; set; }

    public long ProductId { get; set; }

    public string ProductCodeSnapshot { get; set; } = string.Empty;

    public string ProductTypeSnapshot { get; set; } = string.Empty;

    public string CurrencyTypeSnapshot { get; set; } = string.Empty;

    public string TitleZhSnapshot { get; set; } = string.Empty;

    public string? TitleEnSnapshot { get; set; }

    public int Quantity { get; set; } = 1;

    public decimal UnitPriceAmount { get; set; }

    public decimal TotalPriceAmount { get; set; }

    public string Status { get; set; } = string.Empty;

    public string? FailureCode { get; set; }

    public string IdempotencyKey { get; set; } = string.Empty;

    /// <summary>Canonical purchase request fingerprint used to reject idempotency-key misuse.</summary>
    public string? RequestHash { get; set; }

    public long? PaymentTransactionId { get; set; }

    public string? RequestPayloadJson { get; set; }

    public string? ResultPayloadJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;


/// <summary>定义 ShopOrderDelivery 领域持久化数据结构及其业务状态字段。</summary>
public class ShopOrderDelivery
{
    public long Id { get; set; }

    public long ShopOrderId { get; set; }

    public string DeliveryType { get; set; } = string.Empty;

    public string DeliveryStatus { get; set; } = string.Empty;

    public long? ItemTransactionId { get; set; }

    public long? WalletTransactionId { get; set; }

    public long? PlayerCharacterId { get; set; }

    public long? PlayerCosmeticId { get; set; }

    public string? PayloadJson { get; set; }

    public string? FailureCode { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

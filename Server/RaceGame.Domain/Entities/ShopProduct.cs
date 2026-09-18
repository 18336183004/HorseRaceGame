namespace RaceGame.Domain.Entities;


/// <summary>定义 ShopProduct 领域持久化数据结构及其业务状态字段。</summary>
public class ShopProduct
{
    public long Id { get; set; }

    public string ProductCode { get; set; } = string.Empty;

    public string ProductType { get; set; } = string.Empty;

    public string CurrencyType { get; set; } = string.Empty;

    public string TitleZh { get; set; } = string.Empty;

    public string? TitleEn { get; set; }

    public string? DescriptionZh { get; set; }

    public string? DescriptionEn { get; set; }

    public decimal PriceAmount { get; set; }

    public string? CashSkuCode { get; set; }

    public int? PurchaseLimitDaily { get; set; }

    public int? PurchaseLimitLifetime { get; set; }

    public long? CharacterId { get; set; }

    public long? CosmeticId { get; set; }

    public long? ItemId { get; set; }

    public string? RewardPayload { get; set; }

    public string? MetadataJson { get; set; }

    public string? CoverAsset { get; set; }

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public bool IsVisible { get; set; } = true;

    public DateTime? EffectiveStartAt { get; set; }

    public DateTime? EffectiveEndAt { get; set; }

    public int Version { get; set; } = 1;

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;


/// <summary>定义 CosmeticCatalog 领域持久化数据结构及其业务状态字段。</summary>
public class CosmeticCatalog
{
    public long Id { get; set; }

    public string CosmeticCode { get; set; } = string.Empty;

    public string SlotType { get; set; } = string.Empty;

    public string NameZh { get; set; } = string.Empty;

    public string? NameEn { get; set; }

    public string? DescriptionZh { get; set; }

    public string? DescriptionEn { get; set; }

    public string? IconAsset { get; set; }

    public string? PreviewAsset { get; set; }

    public string? MetadataJson { get; set; }

    public int SortOrder { get; set; }

    public bool IsEnabled { get; set; } = true;

    public bool IsDefault { get; set; }

    public long? CreatedByAdminUserId { get; set; }

    public long? UpdatedByAdminUserId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;

/// <summary>
/// 马主出赛头马分红明细实体。
/// </summary>
public class HorseDividend
{
    public long Id { get; set; }

    /// <summary>比赛轮次 ID。</summary>
    public long RoundId { get; set; }

    /// <summary>赛马模板 ID。</summary>
    public long HorseCatalogId { get; set; }

    /// <summary>获益马主玩家 ID。</summary>
    public long PlayerId { get; set; }

    /// <summary>分红金额。</summary>
    public decimal DividendAmount { get; set; }

    /// <summary>是否已领取入玩家钱包。</summary>
    public bool Claimed { get; set; }

    /// <summary>生成时间 (UTC)。</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

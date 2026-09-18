namespace RaceGame.Domain.Entities;

/// <summary>
/// 全服累积超级大奖池领域持久化实体。
/// </summary>
public class JackpotPool
{
    public long Id { get; set; }

    /// <summary>奖池代码标识 (例如 MEGA_COIN_POOL)。</summary>
    public string PoolCode { get; set; } = string.Empty;

    /// <summary>当前奖池实时累积金币总额。</summary>
    public decimal CurrentAmount { get; set; } = 100000.00m;

    /// <summary>奖池保底启动金额。</summary>
    public decimal SeedAmount { get; set; } = 100000.00m;

    /// <summary>每笔下注注入奖池的抽水比例 (默认 0.0150 即 1.5%)。</summary>
    public decimal TaxRate { get; set; } = 0.0150m;

    /// <summary>历史上累计已派发的大奖总额。</summary>
    public decimal TotalPaidOut { get; set; } = 0.00m;

    /// <summary>最近一次爆奖时间 (UTC)。</summary>
    public DateTime? LastDroppedAt { get; set; }

    /// <summary>更新时间 (UTC)。</summary>
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

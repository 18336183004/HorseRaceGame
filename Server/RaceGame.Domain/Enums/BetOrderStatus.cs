namespace RaceGame.Domain.Enums;

/// <summary>
/// 注单业务生命周期状态强类型枚举。
/// 映射数据库 bet_orders.status 的整数值，保持 100% 向后兼容。
/// </summary>
public enum BetOrderStatus
{
    /// <summary>待结算（已下注锁定）。</summary>
    Pending = 1,

    /// <summary>已中奖结算。</summary>
    Won = 2,

    /// <summary>未中奖。</summary>
    Lost = 3,

    /// <summary>已退款（因比赛异常取消全额返还本金）。</summary>
    Refunded = 4,

    /// <summary>已作废/已取消。</summary>
    Cancelled = 5,
}

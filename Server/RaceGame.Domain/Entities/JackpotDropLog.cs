namespace RaceGame.Domain.Entities;

/// <summary>
/// 全服超级大奖爆出审计明细日志。
/// </summary>
public class JackpotDropLog
{
    public long Id { get; set; }

    /// <summary>触发爆奖的轮次 ID。</summary>
    public long RoundId { get; set; }

    /// <summary>奖池代码标识。</summary>
    public string PoolCode { get; set; } = string.Empty;

    /// <summary>本轮爆奖总金额。</summary>
    public decimal TotalDropAmount { get; set; }

    /// <summary>中奖玩家瓜分金额 (如 70%)。</summary>
    public decimal WinnerShareAmount { get; set; }

    /// <summary>全服在线下注玩家普天同庆平分金额 (如 30%)。</summary>
    public decimal RainShareAmount { get; set; }

    /// <summary>爆奖触发原因说明 (例如 BLACK_SWAN_EXACTA)。</summary>
    public string TriggerReason { get; set; } = string.Empty;

    /// <summary>记录创建时间 (UTC)。</summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

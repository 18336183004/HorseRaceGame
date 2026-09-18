using RaceGame.Domain.Constants;

namespace RaceGame.Application.Common;

/// <summary>
/// 集中执行虚拟币金额舍入，确保下注、商城和任务奖励使用相同协议。
/// </summary>
public static class MoneyMath
{
    /// <summary>
    /// 按项目约定保留两位小数，并使用远离零的中点舍入方式。
    /// </summary>
    /// <param name="amount">需要规范化的金额。</param>
    /// <returns>可写入 NUMERIC(20,2) 的金额。</returns>
    public static decimal Round(decimal amount)
    {
        return Math.Round(amount, GameRuleDefaults.MoneyDecimalPlaces, MidpointRounding.AwayFromZero);
    }
}

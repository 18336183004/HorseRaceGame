namespace RaceGame.Application.Common;

/// <summary>
/// 定义任务等配置型奖励的服务端载荷结构。
/// 金币奖励使用 <see cref="Amount"/>，物品奖励使用 <see cref="ItemId"/> 和 <see cref="Quantity"/>。
/// </summary>
public sealed record RewardPayload(decimal? Amount, long? ItemId, long? Quantity);

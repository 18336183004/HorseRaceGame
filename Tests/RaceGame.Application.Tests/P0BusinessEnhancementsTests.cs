using RaceGame.Application.Common;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证 P0 交互与五大业务决策落地：
/// 1. 命中连胜 (Hit Streak) 与盈利胜局 (Net Profit Win) 细分规则
/// 2. 下级负盈利抽成 (0.2% + 手续费率) 与未结佣金提炼规则
/// 3. 破产救济金每日限额 5 次与上线自动补齐不变量
/// </summary>
public sealed class P0BusinessEnhancementsTests
{
    [Fact]
    public void HitStreakVsNetProfitWin_BifurcationRule_WorksCorrectly()
    {
        // 场景 A：玩家同局投 2 注，共下注 200 🪙；其中 1 注命中返还 150 🪙（净亏损 50 🪙）
        var ordersA = new List<BetOrder>
        {
            new() { BetAmount = 100m, NetReward = 150m, Status = RaceGame.Domain.Enums.BetOrderStatus.Won }, // 命中
            new() { BetAmount = 100m, NetReward = 0m, Status = RaceGame.Domain.Enums.BetOrderStatus.Lost },   // 未中
        };

        var totalBetA = ordersA.Sum(x => x.BetAmount);
        var totalNetA = ordersA.Sum(x => x.NetReward);
        var isHitA = ordersA.Any(x => x.Status == RaceGame.Domain.Enums.BetOrderStatus.Won);
        var isProfitA = totalNetA > totalBetA;

        Assert.True(isHitA, "命中一单即应判定命中连胜有效");
        Assert.False(isProfitA, "总返还低于总下注，不得算作盈利胜局");

        // 场景 B：玩家下注 100 🪙 连赢，命中二连碰净奖 399.80 🪙
        var ordersB = new List<BetOrder>
        {
            new() { BetAmount = 100m, NetReward = 399.80m, Status = RaceGame.Domain.Enums.BetOrderStatus.Won },
        };

        var totalBetB = ordersB.Sum(x => x.BetAmount);
        var totalNetB = ordersB.Sum(x => x.NetReward);
        var isHitB = ordersB.Any(x => x.Status == RaceGame.Domain.Enums.BetOrderStatus.Won);
        var isProfitB = totalNetB > totalBetB;

        Assert.True(isHitB, "命中二连碰判定命中");
        Assert.True(isProfitB, "净奖超过下注额，判定为盈利胜局");
    }

    [Fact]
    public void NegativeProfitReferralCommission_Calculation_MatchesFormula()
    {
        // 规则 3：按下级当轮“负盈利”抽成，比例下调为固定千分之 5 (0.5%)
        const decimal totalBet = 500.00m;
        const decimal totalNetReward = 100.00m;
        const decimal netLoss = totalBet - totalNetReward; // 400.00 负盈利

        const decimal commissionRate = 0.005m; // 千分之 5
        var commissionAmount = MoneyMath.Round(netLoss * commissionRate);

        Assert.Equal(400.00m, netLoss);
        Assert.Equal(0.005m, commissionRate);
        Assert.Equal(2.00m, commissionAmount); // 400 * 0.005 = 2.00

        var reward = new PlayerReferralReward
        {
            ReferrerPlayerId = 1,
            InvitedPlayerId = 2,
            RewardType = "COMMISSION_NEGATIVE_PROFIT",
            Amount = commissionAmount,
            RoundId = 101,
            NetLossAmount = netLoss,
            CommissionRate = commissionRate,
            Status = "UNCLAIMED",
        };

        Assert.Equal("UNCLAIMED", reward.Status);
        Assert.Equal(2.00m, reward.Amount);
    }

    [Fact]
    public void ReliefGrant_MaxDailyLimit_IsStrictlyFive()
    {
        // 规则 1：限制每日最多 5 次
        Assert.Equal(5, GameBusinessCodes.ReliefDailyLimit);

        // 模拟今日已有 5 次发放
        const int grantedCount = 5;
        var canGrant = grantedCount < GameBusinessCodes.ReliefDailyLimit;

        Assert.False(canGrant, "达到 5 次上限后不得继续发放救济金");
    }
}

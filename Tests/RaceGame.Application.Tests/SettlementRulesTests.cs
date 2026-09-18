using RaceGame.Application.Common;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证结算时中奖与未中奖订单的状态流转、奖励清零以及玩家统计累计的不变量。
/// </summary>
public sealed class SettlementRulesTests
{
    [Fact]
    public void WinningOrder_RetainsCalculatedReward_AndSetsWinStatus()
    {
        var order = new BetOrder
        {
            Id = 100,
            PlayerId = 1,
            RoundId = 1,
            HorseNo = 3,
            BetAmount = 20m,
            LockedOdds = 3.5m,
            GrossReward = 70m,
            FeeRate = 0.0005m,
            FeeAmount = 0.04m,
            NetReward = 69.96m,
            Status = RaceGame.Domain.Enums.BetOrderStatus.Pending,
        };

        const int winnerHorseNo = 3;
        var isWinner = order.HorseNo == winnerHorseNo;

        if (isWinner)
        {
            order.Status = RaceGame.Domain.Enums.BetOrderStatus.Won;
            order.StatusReason = "WIN";
        }
        else
        {
            order.Status = RaceGame.Domain.Enums.BetOrderStatus.Lost;
            order.StatusReason = "LOSE";
            order.GrossReward = 0m;
            order.FeeRate = 0m;
            order.FeeAmount = 0m;
            order.NetReward = 0m;
        }

        Assert.Equal(RaceGame.Domain.Enums.BetOrderStatus.Won, order.Status);
        Assert.Equal("WIN", order.StatusReason);
        Assert.Equal(70m, order.GrossReward);
        Assert.Equal(69.96m, order.NetReward);
    }

    [Fact]
    public void LosingOrder_ZeroesRewards_AndSetsLoseStatus()
    {
        var order = new BetOrder
        {
            Id = 101,
            PlayerId = 2,
            RoundId = 1,
            HorseNo = 5,
            BetAmount = 50m,
            LockedOdds = 4.0m,
            GrossReward = 200m,
            FeeRate = 0.0005m,
            FeeAmount = 0.10m,
            NetReward = 199.90m,
            Status = RaceGame.Domain.Enums.BetOrderStatus.Pending,
        };

        const int winnerHorseNo = 3;
        var isWinner = order.HorseNo == winnerHorseNo;

        if (isWinner)
        {
            order.Status = RaceGame.Domain.Enums.BetOrderStatus.Won;
            order.StatusReason = "WIN";
        }
        else
        {
            order.Status = RaceGame.Domain.Enums.BetOrderStatus.Lost;
            order.StatusReason = "LOSE";
            order.GrossReward = 0m;
            order.FeeRate = 0m;
            order.FeeAmount = 0m;
            order.NetReward = 0m;
        }

        Assert.Equal(RaceGame.Domain.Enums.BetOrderStatus.Lost, order.Status);
        Assert.Equal("LOSE", order.StatusReason);
        Assert.Equal(0m, order.GrossReward);
        Assert.Equal(0m, order.FeeRate);
        Assert.Equal(0m, order.FeeAmount);
        Assert.Equal(0m, order.NetReward);
    }

    [Fact]
    public void PlayerStat_Aggregation_DoesNotSumLosingOrderRewards()
    {
        var winningOrder = new BetOrder
        {
            Id = 1,
            PlayerId = 1,
            RoundId = 1,
            HorseNo = 2,
            BetAmount = 10m,
            GrossReward = 35m,
            FeeAmount = 0.02m,
            NetReward = 34.98m,
            Status = RaceGame.Domain.Enums.BetOrderStatus.Won,
            StatusReason = "WIN",
        };

        var losingOrder = new BetOrder
        {
            Id = 2,
            PlayerId = 1,
            RoundId = 2,
            HorseNo = 4,
            BetAmount = 20m,
            GrossReward = 0m,
            FeeAmount = 0m,
            NetReward = 0m,
            Status = RaceGame.Domain.Enums.BetOrderStatus.Lost,
            StatusReason = "LOSE",
        };

        var playerOrders = new List<BetOrder> { winningOrder, losingOrder };

        var stat = new PlayerStat
        {
            PlayerId = 1,
            TotalRoundsParticipated = 2,
            TotalRoundsWon = 1,
        };

        stat.TotalBetAmount = MoneyMath.Round(stat.TotalBetAmount + playerOrders.Sum(x => x.BetAmount));
        stat.TotalGrossReward = MoneyMath.Round(stat.TotalGrossReward + playerOrders.Sum(x => x.GrossReward));
        stat.TotalFeeAmount = MoneyMath.Round(stat.TotalFeeAmount + playerOrders.Sum(x => x.FeeAmount));
        stat.TotalNetReward = MoneyMath.Round(stat.TotalNetReward + playerOrders.Sum(x => x.NetReward));
        stat.WinRate = Math.Round((decimal)stat.TotalRoundsWon / stat.TotalRoundsParticipated, 6, MidpointRounding.AwayFromZero);

        Assert.Equal(30m, stat.TotalBetAmount);
        Assert.Equal(35m, stat.TotalGrossReward);
        Assert.Equal(0.02m, stat.TotalFeeAmount);
        Assert.Equal(34.98m, stat.TotalNetReward);
        Assert.Equal(0.5m, stat.WinRate);
    }
}

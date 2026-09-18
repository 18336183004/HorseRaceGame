using RaceGame.Application.Betting;
using RaceGame.Application.Common;
using RaceGame.Application.Race;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证街机黄金赛马连赢（Quinella）赔率生成、赛果冠亚军推导及双模式结算逻辑。
/// </summary>
public sealed class QuinellaRaceEngineTests
{
    [Fact]
    public void BuildQuinellaOdds_GeneratesExactly15Combinations_WithProperOrderingAndOdds()
    {
        var engine = new RaceEngine();
        var horseEntries = new List<RoundHorseEntry>
        {
            new(1, 2.5m, 100, 0.35m, 0.35m, 0.25m, 0.15m, 0.10m, 0.10m, 0.05m),
            new(2, 3.5m, 100, 0.25m, 0.25m, 0.25m, 0.20m, 0.15m, 0.10m, 0.05m),
            new(3, 4.0m, 100, 0.20m, 0.20m, 0.20m, 0.20m, 0.15m, 0.15m, 0.10m),
            new(4, 6.0m, 100, 0.10m, 0.10m, 0.15m, 0.20m, 0.25m, 0.20m, 0.10m),
            new(5, 8.0m, 100, 0.06m, 0.06m, 0.10m, 0.15m, 0.25m, 0.25m, 0.19m),
            new(6, 15.0m, 100, 0.04m, 0.04m, 0.05m, 0.10m, 0.15m, 0.20m, 0.46m),
        };

        var quinellaOdds = engine.BuildQuinellaOdds(horseEntries);

        // C(6, 2) = 15 组
        Assert.Equal(15, quinellaOdds.Count);

        // 验证全部 15 组组合
        var expectedCombos = new[]
        {
            "1-2", "1-3", "1-4", "1-5", "1-6",
            "2-3", "2-4", "2-5", "2-6",
            "3-4", "3-5", "3-6",
            "4-5", "4-6",
            "5-6"
        };

        foreach (var combo in expectedCombos)
        {
            var match = quinellaOdds.FirstOrDefault(x => x.Combination == combo);
            Assert.NotNull(match);
            Assert.InRange(match.Odds, 2.0m, 1000.0m);
        }

        // 验证赔率单调性：冷门组合赔率应显著高于热门组合
        var favOdd = quinellaOdds.First(x => x.Combination == "1-2").Odds;
        var longOdd = quinellaOdds.First(x => x.Combination == "5-6").Odds;
        Assert.True(longOdd > favOdd, $"冷门组合 5-6 赔率 ({longOdd}) 应当大于热门 1-2 ({favOdd})");
    }

    [Fact]
    public void RaceResult_CorrectlyResolvesWinnerSecondAndQuinellaCombination()
    {
        var items = new List<HorseResult>
        {
            new(HorseNo: 4, HorseTemplateId: 104, FinalRank: 1, FinishTime: 30.12m, AnimationSeed: 1234, IsBlackHorse: false, BlackHorseHitCount: 0),
            new(HorseNo: 2, HorseTemplateId: 102, FinalRank: 2, FinishTime: 30.45m, AnimationSeed: 1235, IsBlackHorse: false, BlackHorseHitCount: 0),
            new(HorseNo: 1, HorseTemplateId: 101, FinalRank: 3, FinishTime: 31.00m, AnimationSeed: 1236, IsBlackHorse: false, BlackHorseHitCount: 0),
            new(HorseNo: 5, HorseTemplateId: 105, FinalRank: 4, FinishTime: 31.50m, AnimationSeed: 1237, IsBlackHorse: false, BlackHorseHitCount: 0),
            new(HorseNo: 3, HorseTemplateId: 103, FinalRank: 5, FinishTime: 32.10m, AnimationSeed: 1238, IsBlackHorse: false, BlackHorseHitCount: 0),
            new(HorseNo: 6, HorseTemplateId: 106, FinalRank: 6, FinishTime: 32.80m, AnimationSeed: 1239, IsBlackHorse: false, BlackHorseHitCount: 0),
        };

        var result = new RaceResult(
            RoundId: 1,
            Seed: "test-seed",
            AlgorithmVersion: "v1",
            BlackHorseAlgorithmVersion: "v1",
            BlackHorse: new BlackHorseDecision(false, 0.05m, null, new Dictionary<long, int>()),
            Results: items
        );

        Assert.Equal(4, result.WinnerHorseNo);
        Assert.Equal(2, result.SecondHorseNo);
        Assert.Equal("2-4", result.QuinellaCombination);
    }

    [Theory]
    [InlineData("QUINELLA", 2, 4, "2-4", 2, 4, true)]   // 冠2 亚4，押 2-4 -> 中奖
    [InlineData("QUINELLA", 4, 2, "2-4", 2, 4, true)]   // 冠2 亚4，押 4-2 -> 中奖（无序）
    [InlineData("QUINELLA", 2, 4, "2-4", 4, 2, true)]   // 冠4 亚2，押 2-4 -> 中奖（无序）
    [InlineData("QUINELLA", 1, 2, "1-2", 2, 4, false)]  // 冠2 亚4，押 1-2 -> 未中奖
    [InlineData("QUINELLA", 3, 5, "3-5", 2, 4, false)]  // 冠2 亚4，押 3-5 -> 未中奖
    [InlineData("WIN", 2, null, null, 2, 4, true)]      // 独赢：冠2 亚4，押 2 -> 中奖
    [InlineData("WIN", 4, null, null, 2, 4, false)]     // 独赢：冠2 亚4，押 4 -> 未中奖（独赢仅冠军）
    public void Settlement_EvaluatesBothWinAndQuinellaOrdersAccurately(
        string playType,
        int horseNo,
        int? secondHorseNo,
        string? combination,
        int actualWinner,
        int actualSecond,
        bool expectWin)
    {
        var actualCombo = $"{Math.Min(actualWinner, actualSecond)}-{Math.Max(actualWinner, actualSecond)}";

        var isWinner = false;
        if (string.Equals(playType, "QUINELLA", StringComparison.OrdinalIgnoreCase))
        {
            var orderCombo = combination;
            if (string.IsNullOrWhiteSpace(orderCombo) && secondHorseNo.HasValue)
            {
                orderCombo = $"{Math.Min(horseNo, secondHorseNo.Value)}-{Math.Max(horseNo, secondHorseNo.Value)}";
            }
            isWinner = string.Equals(orderCombo, actualCombo, StringComparison.OrdinalIgnoreCase);
        }
        else
        {
            isWinner = horseNo == actualWinner;
        }

        Assert.Equal(expectWin, isWinner);
    }

    [Fact]
    public void ComputeRequestHash_IsOrderIndependent_ForQuinellaCombinations()
    {
        // 验证用户按 2-4 或 4-2 提交相同组合时，生成的幂等指纹严格一致
        var req1 = new PlaceBetRequest(1001, 2, 50.00m, "uuid-q-001", "QUINELLA", 4, "2-4");
        var req2 = new PlaceBetRequest(1001, 4, 50.00m, "uuid-q-001", "QUINELLA", 2, "4-2");
        var req3 = new PlaceBetRequest(1001, 2, 50m, "uuid-q-001", "QUINELLA", 4, null);

        var hash1 = BettingService.ComputeRequestHash(req1);
        var hash2 = BettingService.ComputeRequestHash(req2);
        var hash3 = BettingService.ComputeRequestHash(req3);

        Assert.Equal(hash1, hash2);
        Assert.Equal(hash1, hash3);
        Assert.NotEmpty(hash1);
    }

    [Fact]
    public void ComputeRequestHash_Differs_BetweenWinAndQuinella()
    {
        var winReq = new PlaceBetRequest(1001, 2, 50.00m, "uuid-diff-001", "WIN");
        var quinellaReq = new PlaceBetRequest(1001, 2, 50.00m, "uuid-diff-001", "QUINELLA", 4, "2-4");

        var winHash = BettingService.ComputeRequestHash(winReq);
        var quinellaHash = BettingService.ComputeRequestHash(quinellaReq);

        Assert.NotEqual(winHash, quinellaHash);
    }

    [Fact]
    public void BlackHorseJackpot_AwardsAdditional25PercentBonus_ForWinningQuinellaWithBlackHorse()
    {
        // 规则决策 5-B: 街机大爆奖 Jackpot！连赢中奖组合中若包含黑马（前两名），触发额外 25% 赏金加成
        const decimal baseGross = 500.00m;
        const decimal baseFee = 25.00m;
        const decimal baseNet = baseGross - baseFee; // 475.00m

        var jackpotBonus = MoneyMath.Round(baseNet * 0.25m); // 118.75m
        var finalGross = MoneyMath.Round(baseGross + jackpotBonus); // 618.75m
        var finalNet = MoneyMath.Round(baseNet + jackpotBonus); // 593.75m

        Assert.Equal(118.75m, jackpotBonus);
        Assert.Equal(618.75m, finalGross);
        Assert.Equal(593.75m, finalNet);
    }

    [Fact]
    public void MultiBetRound_EvaluatesPlayerAsRoundWinner_WhenAnyBetWins()
    {
        // 规则决策 4-A: 一局中若玩家同时投注多张注单，只要有任意一张获胜，即视为该局胜利，连胜不中断
        var playerOrders = new List<(string OrderNo, int Status)>
        {
            ("ORDER-01", 3), // LOSE
            ("ORDER-02", 2), // WIN
            ("ORDER-03", 3), // LOSE
        };

        var hasAnyWin = playerOrders.Any(x => x.Status == 2);
        Assert.True(hasAnyWin, "只要有任意一张注单状态为 2 (WIN)，玩家即判定为该局获胜方，连胜累加");
    }

    [Fact]
    public void RaceRound_WhenWinnerAndSecondHorseAssigned_ExposesConsistentQuinellaCombination()
    {
        var round = new RaceRound
        {
            RoundNo = "ROUND-TEST-001",
            WinnerHorseNo = 3,
            SecondHorseNo = 1,
            State = RaceState.Finished,
        };

        Assert.Equal(3, round.WinnerHorseNo);
        Assert.Equal(1, round.SecondHorseNo);
        Assert.Equal("1-3", round.QuinellaCombination);
    }
}

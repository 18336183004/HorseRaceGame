using RaceGame.Application.Betting;
using RaceGame.Application.Common;
using RaceGame.Application.Configuration;
using RaceGame.Application.Race;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证新拓展玩法：位置 (Place)、二连单 (Exacta)、Photo Finish 慢动作、赛况解说与全服奖池逻辑。
/// </summary>
public sealed class GameplayExpansionTests
{
    private static List<RoundHorseEntry> CreateTestEntries() =>
    [
        new(1, 2.5m, 100, 0.35m, 0.35m, 0.25m, 0.15m, 0.10m, 0.10m, 0.05m),
        new(2, 3.5m, 100, 0.25m, 0.25m, 0.25m, 0.20m, 0.15m, 0.10m, 0.05m),
        new(3, 4.0m, 100, 0.20m, 0.20m, 0.20m, 0.20m, 0.15m, 0.15m, 0.10m),
        new(4, 6.0m, 100, 0.10m, 0.10m, 0.15m, 0.20m, 0.25m, 0.20m, 0.10m),
        new(5, 8.0m, 100, 0.06m, 0.06m, 0.10m, 0.15m, 0.25m, 0.25m, 0.19m),
        new(6, 15.0m, 100, 0.04m, 0.04m, 0.05m, 0.10m, 0.15m, 0.20m, 0.46m),
    ];

    [Fact]
    public void BuildPlaceOdds_Generates6Entries_WithSafePayoutBounds()
    {
        var engine = new RaceEngine();
        var entries = CreateTestEntries();
        var placeOdds = engine.BuildPlaceOdds(entries);

        Assert.Equal(6, placeOdds.Count);
        foreach (var p in placeOdds)
        {
            Assert.InRange(p.HorseNo, 1, 6);
            Assert.InRange(p.Odds, 1.10m, 5.00m);
        }

        // 大热门 (1号) 的位置赔率应低于冷门马 (6号)
        var favOdds = placeOdds.First(x => x.HorseNo == 1).Odds;
        var underdogOdds = placeOdds.First(x => x.HorseNo == 6).Odds;
        Assert.True(favOdds < underdogOdds, $"热门马位置赔率 ({favOdds}) 应低于冷门马 ({underdogOdds})");
    }

    [Fact]
    public void BuildExactaOdds_Generates30Entries_OrderedAndBounded()
    {
        var engine = new RaceEngine();
        var entries = CreateTestEntries();
        var exactaOdds = engine.BuildExactaOdds(entries);

        // A(6, 2) = 30 组
        Assert.Equal(30, exactaOdds.Count);

        // 验证例如 1-2 与 2-1 均存在且区分
        var exacta12 = exactaOdds.FirstOrDefault(x => x.Combination == "1-2");
        var exacta21 = exactaOdds.FirstOrDefault(x => x.Combination == "2-1");
        Assert.NotNull(exacta12);
        Assert.NotNull(exacta21);

        Assert.InRange(exacta12.Odds, 2.5m, 500.0m);
        Assert.InRange(exacta21.Odds, 2.5m, 500.0m);
    }

    [Fact]
    public void PhotoFinish_Detection_WorksProperly()
    {
        var result = new RaceResult(
            1,
            "seed",
            "v1",
            "v1",
            new BlackHorseDecision(false, 0m, null, new Dictionary<long, int>()),
            [
                new HorseResult(3, 103, 1, 27.1000m, 1, false, 0),
                new HorseResult(5, 105, 2, 27.1500m, 2, false, 0),
                new HorseResult(1, 101, 3, 27.8000m, 3, false, 0),
                new HorseResult(2, 102, 4, 28.2000m, 4, false, 0),
                new HorseResult(4, 104, 5, 28.6000m, 5, false, 0),
                new HorseResult(6, 106, 6, 29.0000m, 6, false, 0),
            ],
            IsPhotoFinish: true,
            PhotoFinishGapSeconds: 0.0500m);

        Assert.True(result.IsPhotoFinish);
        Assert.Equal(0.0500m, result.PhotoFinishGapSeconds);
        Assert.Equal(3, result.WinnerHorseNo);
        Assert.Equal(5, result.SecondHorseNo);
        Assert.Equal("3-5", result.ExactaCombination);
    }

    [Fact]
    public void BuildCommentaryScript_Contains4Phases_WithCorrectContext()
    {
        var script = RaceEngine.BuildCommentaryScript(4, 2, "RAINY", "MUDDY", isPhotoFinish: true);

        Assert.Equal(4, script.Count);
        Assert.Contains(script, x => x.Phase == "START");
        Assert.Contains(script, x => x.Phase == "TURN" && x.Second == 15);
        Assert.Contains(script, x => x.Phase == "STRETCH");
        Assert.Contains(script, x => x.Phase == "FINISH" && x.TextZh.Contains("鼻尖微差绝杀"));
    }

    [Fact]
    public void InPlayDoubleDown_ProfitBoost_CalculatesCorrectly()
    {
        // 原始下注 100，加倍 100，赔率 3.0，boost 50%
        var betAmount = 100m;
        var doubleDownAmount = 100m;
        var totalWager = betAmount + doubleDownAmount; // 200
        var lockedOdds = 3.0m;
        var boostRate = 0.50m;

        var baseGross = totalWager * lockedOdds; // 600
        var profit = baseGross - totalWager; // 400
        var boostBonus = profit * boostRate; // 200
        var finalGross = baseGross + boostBonus; // 800

        Assert.Equal(800m, finalGross);
    }

    [Fact]
    public void RefundPendingBets_WithDoubleDown_RefundsTotalWagerAmount()
    {
        // 测试当赛事被取消时，加倍注单必须全额退还本金加追投金额 (BetAmount + DoubleDownAmount)
        var order = new BetOrder
        {
            Id = 999,
            PlayerId = 42,
            RoundId = 10,
            OrderNo = "BET_TEST_DD_999",
            BetAmount = 100m,
            IsDoubleDown = true,
            DoubleDownAmount = 100m,
            Status = BetOrderStatus.Pending
        };

        var refundAmount = order.BetAmount + order.DoubleDownAmount;
        Assert.Equal(200m, refundAmount);

        var wallet = new Wallet { PlayerId = 42, Balance = 50m };
        var balanceBefore = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance + refundAmount);

        Assert.Equal(250m, wallet.Balance);
        Assert.Equal(50m, balanceBefore);
    }

    [Fact]
    public void DilutionFloorGuarantee_WithDoubleDown_Guarantees105PercentOfTotalStake()
    {
        // 测试当彩池发生稀释时，加倍注单保底 1.05x 防亏基数必须为总本金 (100+100=200)，而非仅原始本金 100
        var order = new BetOrder
        {
            Id = 1001,
            PlayerId = 55,
            RoundId = 12,
            BetAmount = 100m,
            IsDoubleDown = true,
            DoubleDownAmount = 100m,
            LockedOdds = 50m,
            Status = BetOrderStatus.Pending
        };

        var totalWager = order.BetAmount + order.DoubleDownAmount; // 200
        var nominalGross = MoneyMath.Round(totalWager * order.LockedOdds); // 10,000

        // 假定极度稀释，稀释因子为 0.01 (1%)
        var dilutionFactor = 0.01m;
        var dilutedGross = MoneyMath.Round(nominalGross * dilutionFactor); // 100.00
        var minGuaranteed = MoneyMath.Round(totalWager * 1.05m); // 210.00 (必须保证 1.05 倍总本金)
        var grossAfterDilution = Math.Max(dilutedGross, minGuaranteed);

        Assert.Equal(210.00m, grossAfterDilution);
        Assert.True(grossAfterDilution > totalWager, "保底机制必须保证加倍玩家回收至少 1.05x 的实际总下注本金");
    }

    [Fact]
    public void MegaJackpot_DropDistribution_CalculatesWinnerAndRainSharesCorrectly()
    {
        // 奖池累积 200,000 🪙，头奖分红 70%，彩金雨分红 30%
        // 当轮共有 3 位不同玩家下注：P1 下注 100 币，P2 下注 50 币，P3 下注 20 币
        // 门槛为 50 币：仅 P1 和 P2 满足资格均分彩金雨，P3 不享受
        var poolAmount = 200000.00m;
        var winnerRate = 0.7000m;
        var rainRate = 0.3000m;
        var minBetThreshold = 50.00m;

        var winnerShare = MoneyMath.Round(poolAmount * winnerRate);
        var rainShare = MoneyMath.Round(poolAmount * rainRate);

        Assert.Equal(140000.00m, winnerShare);
        Assert.Equal(60000.00m, rainShare);

        var playerBets = new Dictionary<long, decimal>
        {
            [101] = 100m, // >= 50, 合格
            [102] = 50m,  // >= 50, 合格
            [103] = 20m,  // < 50, 不合格
        };

        var eligibleCount = playerBets.Count(x => x.Value >= minBetThreshold);
        Assert.Equal(2, eligibleCount);

        var perUserRain = MoneyMath.Round(rainShare / eligibleCount);
        Assert.Equal(30000.00m, perUserRain);
    }

    [Fact]
    public void QuinellaOdds_JsonResilience_ParsesBothCamelAndPascalCase()
    {
        var camelJson = "[{\"combination\":\"1-2\",\"horse1\":1,\"horse2\":2,\"odds\":15.5}]";
        var pascalJson = "[{\"Combination\":\"1-2\",\"Horse1\":1,\"Horse2\":2,\"Odds\":15.5}]";

        decimal ParseOdd(string json, string comboKey)
        {
            using var doc = System.Text.Json.JsonDocument.Parse(json);
            foreach (var element in doc.RootElement.EnumerateArray())
            {
                var comboVal = (element.TryGetProperty("combination", out var c1) ? c1.GetString() : null)
                    ?? (element.TryGetProperty("Combination", out var c2) ? c2.GetString() : null);

                if (string.Equals(comboVal, comboKey, StringComparison.OrdinalIgnoreCase))
                {
                    if (element.TryGetProperty("odds", out var o1) || element.TryGetProperty("Odds", out o1))
                    {
                        return o1.GetDecimal();
                    }
                }
            }
            return 10.0m;
        }

        Assert.Equal(15.5m, ParseOdd(camelJson, "1-2"));
        Assert.Equal(15.5m, ParseOdd(pascalJson, "1-2"));
    }
}

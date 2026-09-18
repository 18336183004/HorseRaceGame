using RaceGame.Application.Race;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证赛马核心引擎的确定性、随机盐敏锐度以及黑马权重算法。
/// </summary>
public sealed class RaceEngineTests
{
    private static RaceRound CreateMockRound(long roundId = 1, string roundNo = "R202609090001")
    {
        var round = new RaceRound
        {
            Id = roundId,
            RoundNo = roundNo,
            ResultAlgorithmVersion = GameBusinessCodes.DefaultResultAlgorithmVersion,
            BlackHorseAlgorithmVersion = GameBusinessCodes.DefaultBlackHorseAlgorithmVersion,
        };

        for (var i = 1; i <= 6; i++)
        {
            round.Horses.Add(new RaceHorse
            {
                RoundId = roundId,
                HorseNo = i,
                HorseTemplateId = 100 + i,
                Odds = 3.5m + i * 0.5m,
                WinRateSnapshot = 0.10m + i * 0.03m,
                Rank1ProbabilitySnapshot = 0.10m + i * 0.03m,
                Rank2ProbabilitySnapshot = 0.15m,
                Rank3ProbabilitySnapshot = 0.15m,
                Rank4ProbabilitySnapshot = 0.20m,
                Rank5ProbabilitySnapshot = 0.20m,
                Rank6ProbabilitySnapshot = 0.20m,
            });
        }

        return round;
    }

    [Fact]
    public void Generate_WithSameSeedAndSalt_ReturnsIdenticalResult()
    {
        var engine = new RaceEngine();
        var round = CreateMockRound();
        const string salt = "test_salt_aabbccddeeff00112233445566778899";

        var result1 = engine.Generate(round, salt);
        var result2 = engine.Generate(round, salt);

        Assert.Equal(result1.Seed, result2.Seed);
        Assert.Equal(6, result1.Results.Count);
        Assert.Equal(6, result2.Results.Count);

        for (var i = 0; i < 6; i++)
        {
            Assert.Equal(result1.Results[i].HorseNo, result2.Results[i].HorseNo);
            Assert.Equal(result1.Results[i].FinalRank, result2.Results[i].FinalRank);
            Assert.Equal(result1.Results[i].FinishTime, result2.Results[i].FinishTime);
        }
    }

    [Fact]
    public void Generate_WithDifferentSalt_ProducesDifferentSeedAndOutcome()
    {
        var engine = new RaceEngine();
        var round = CreateMockRound();
        const string salt1 = "salt_alpha_11111111111111111111111111111111";
        const string salt2 = "salt_beta_222222222222222222222222222222222";

        var result1 = engine.Generate(round, salt1);
        var result2 = engine.Generate(round, salt2);

        Assert.NotEqual(result1.Seed, result2.Seed);
        // Different seeds will produce different permutations or finish times
        var anyDifference = result1.Results.Where((t, i) => t.HorseNo != result2.Results[i].HorseNo || t.FinishTime != result2.Results[i].FinishTime).Any();
        Assert.True(anyDifference, "Different salts must produce different race progressions");
    }

    [Fact]
    public void Generate_ProducesStrictRanksOneToSixWithoutDuplicateHorses()
    {
        var engine = new RaceEngine();
        var round = CreateMockRound();

        var result = engine.Generate(round, "salt_strict_test");

        var ranks = result.Results.Select(x => x.FinalRank).OrderBy(x => x).ToList();
        Assert.Equal(new[] { 1, 2, 3, 4, 5, 6 }, ranks);

        var horseNos = result.Results.Select(x => x.HorseNo).Distinct().ToList();
        Assert.Equal(6, horseNos.Count);
    }

    [Fact]
    public void BuildRoundHorseEntries_CalculatesValidOddsForCatalog()
    {
        var engine = new RaceEngine();
        var horses = new List<HorseCatalog>();
        for (var i = 1; i <= 6; i++)
        {
            horses.Add(new HorseCatalog
            {
                Id = i,
                HorseCode = $"H0{i}",
                NameZh = $"马匹{i}",
                TotalRaces = 100,
                WinCount = 10 + i * 2,
                WinRate = (10 + i * 2) / 100m,
                Rank1Probability = 0.15m,
                Rank2Probability = 0.15m,
                Rank3Probability = 0.15m,
                Rank4Probability = 0.15m,
                Rank5Probability = 0.20m,
                Rank6Probability = 0.20m,
            });
        }

        var entries = engine.BuildRoundHorseEntries(horses);

        Assert.Equal(6, entries.Count);
        foreach (var entry in entries)
        {
            Assert.True(entry.Odds >= 1.0m, "Odds must be at least 1.0");
        }
    }

    [Fact]
    public void Generate_BlackHorse_TriggerProbability_UsesOddEvenRankWinRateDifference()
    {
        var engine = new RaceEngine();
        var round = new RaceRound
        {
            Id = 99,
            RoundNo = "R202609100099",
            ResultAlgorithmVersion = GameBusinessCodes.DefaultResultAlgorithmVersion,
            BlackHorseAlgorithmVersion = GameBusinessCodes.DefaultBlackHorseAlgorithmVersion,
        };

        // 6匹马不同胜率：按降序排序后名次为:
        // Rank 1: 0.30 (Horse 2)
        // Rank 2: 0.25 (Horse 4)
        // Rank 3: 0.20 (Horse 6)
        // Rank 4: 0.15 (Horse 1)
        // Rank 5: 0.08 (Horse 5)
        // Rank 6: 0.02 (Horse 3)
        // 奇数名次和(1,3,5) = 0.30 + 0.20 + 0.08 = 0.58
        // 偶数名次和(2,4,6) = 0.25 + 0.15 + 0.02 = 0.42
        // 理论差值 = |0.58 - 0.42| = 0.16
        var winRates = new[] { 0.15m, 0.30m, 0.02m, 0.25m, 0.08m, 0.20m };
        for (var i = 1; i <= 6; i++)
        {
            round.Horses.Add(new RaceHorse
            {
                RoundId = 99,
                HorseNo = i,
                HorseTemplateId = 200 + i,
                Odds = 3.0m,
                WinRateSnapshot = winRates[i - 1],
                Rank1ProbabilitySnapshot = 0.16m,
                Rank2ProbabilitySnapshot = 0.16m,
                Rank3ProbabilitySnapshot = 0.16m,
                Rank4ProbabilitySnapshot = 0.16m,
                Rank5ProbabilitySnapshot = 0.18m,
                Rank6ProbabilitySnapshot = 0.18m,
            });
        }

        var result = engine.Generate(round, "salt_blackhorse_test");
        Assert.NotNull(result.BlackHorse);
        Assert.Equal(0.16m, result.BlackHorse.TriggerProbability);
    }

    [Theory]
    [InlineData(15)]
    [InlineData(30)]
    [InlineData(60)]
    public void Generate_ScalesFinishTimesDynamically_BasedOnRaceDurationSeconds(int durationSeconds)
    {
        var engine = new RaceEngine();
        var round = CreateMockRound();
        round.RaceDurationSeconds = durationSeconds;

        var result = engine.Generate(round, $"salt_duration_{durationSeconds}");
        var orderedByRank = result.Results.OrderBy(x => x.FinalRank).ToList();

        Assert.Equal(6, orderedByRank.Count);

        var previousFinishTime = 0m;
        foreach (var horse in orderedByRank)
        {
            // 完赛时间必须严格小于比赛时长 (结束前至少0.1s完成)
            Assert.True(horse.FinishTime <= durationSeconds - 0.1m,
                $"Horse rank {horse.FinalRank} finish time {horse.FinishTime} exceeds limit {durationSeconds - 0.1m}");

            // 第一名应当在 90% 基础时长左右冲线
            if (horse.FinalRank == 1)
            {
                var minExpected = durationSeconds * 0.90m;
                Assert.True(horse.FinishTime >= minExpected,
                    $"Rank 1 finish time {horse.FinishTime} should be at least 90% ({minExpected}) of duration");
            }

            // 名次越靠后，完赛时间必须递增
            Assert.True(horse.FinishTime >= previousFinishTime,
                $"Horse rank {horse.FinalRank} ({horse.FinishTime}) should not finish before rank {horse.FinalRank - 1} ({previousFinishTime})");

            previousFinishTime = horse.FinishTime;
        }
    }
}

using RaceGame.Application.Race;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证天气和赛道类型对马匹赔率与表现加成的自适应算法（对应 1.png 环境系统）。
/// </summary>
public sealed class RaceAdaptabilityTests
{
    private static List<HorseCatalog> CreateMockHorses()
    {
        var list = new List<HorseCatalog>();
        for (var i = 1; i <= 6; i++)
        {
            list.Add(new HorseCatalog
            {
                Id = i,
                HorseCode = $"H00{i}",
                NameZh = $"测试马{i}",
                TotalRaces = 50,
                WinRate = 0.16m,
                Rank1Probability = 0.16m,
                Rank2Probability = 0.16m,
                Rank3Probability = 0.16m,
                Rank4Probability = 0.16m,
                Rank5Probability = 0.16m,
                Rank6Probability = 0.16m,
                PreferredTrack = i % 2 == 0 ? "DIRT" : "TURF",
                PreferredWeather = i % 2 == 0 ? "RAINY" : "SUNNY",
            });
        }
        return list;
    }

    [Fact]
    public void BuildRoundHorseEntries_WithMatchingTrackAndWeather_BoostsFavoredHorseOdds()
    {
        var engine = new RaceEngine();
        var horses = CreateMockHorses();

        // 默认不带环境加权
        var baseEntries = engine.BuildRoundHorseEntries(horses);

        // 引入泥地 + 雨天环境，双数马匹配偏好
        var adaptedEntries = engine.BuildRoundHorseEntries(horses, trackType: "DIRT", weather: "RAINY");

        Assert.Equal(6, baseEntries.Count);
        Assert.Equal(6, adaptedEntries.Count);

        // 匹配偏好的马（2号马），其概率由于适应度提升（加权 1.08 * 1.08），赔率应变低（更容易胜出）
        var horse2Base = baseEntries.First(x => x.HorseCatalogId == 2);
        var horse2Adapted = adaptedEntries.First(x => x.HorseCatalogId == 2);

        Assert.True(horse2Adapted.Odds < horse2Base.Odds,
            $"Favored horse odds should decrease with adaptability advantage: Base={horse2Base.Odds}, Adapted={horse2Adapted.Odds}");

        // 不匹配偏好的马（1号马，偏好草地+晴天），相对赔率应变高
        var horse1Base = baseEntries.First(x => x.HorseCatalogId == 1);
        var horse1Adapted = adaptedEntries.First(x => x.HorseCatalogId == 1);

        Assert.True(horse1Adapted.Odds > horse1Base.Odds,
            $"Unfavored horse odds should increase: Base={horse1Base.Odds}, Adapted={horse1Adapted.Odds}");
    }
}

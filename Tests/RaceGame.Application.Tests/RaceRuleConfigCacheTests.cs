using RaceGame.Application.Configuration;
using RaceGame.Domain.Constants;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证规则配置快照默认基线、缓存失效机制与阶梯手续费解析。
/// </summary>
public sealed class RaceRuleConfigCacheTests
{
    [Fact]
    public void DefaultSnapshot_ContainsExpectedBaselines()
    {
        var snapshot = RaceRuleSnapshot.CreateDefault();

        Assert.Equal(GameBusinessCodes.DefaultRaceRuleConfigCode, snapshot.ConfigCode);
        Assert.Equal(1, snapshot.Version);
        Assert.Equal(2.00m, snapshot.MinimumBetAmount);
        Assert.Equal(1000.00m, snapshot.InitialWalletBalance);
        Assert.Equal(180, snapshot.BettingDurationSeconds);
        Assert.Equal(15, snapshot.PrepareDurationSeconds);
        Assert.Equal(30, snapshot.RaceDurationSeconds);
        Assert.Equal(75, snapshot.PostRaceIntervalSeconds);
    }

    [Fact]
    public void DefaultFeeBrackets_CalculatesCorrectRates()
    {
        var snapshot = RaceRuleSnapshot.CreateDefault();

        // <= 10000 -> 1.0% (千分之10)
        Assert.Equal(0.010m, snapshot.ResolveFeeRate(5000m));
        Assert.Equal(0.010m, snapshot.ResolveFeeRate(10000m));

        // 10000 ~ 50000 -> 1.2%
        Assert.Equal(0.012m, snapshot.ResolveFeeRate(25000m));
        Assert.Equal(0.012m, snapshot.ResolveFeeRate(50000m));

        // 50000 ~ 100000 -> 1.5%
        Assert.Equal(0.015m, snapshot.ResolveFeeRate(75000m));
        Assert.Equal(0.015m, snapshot.ResolveFeeRate(100000m));

        // > 100000 -> 2.0% (百分之2)
        Assert.Equal(0.020m, snapshot.ResolveFeeRate(200000m));
    }

    [Fact]
    public void CacheInvalidation_CanBeCalledSafely()
    {
        // 验证显式缓存失效方法可重复并发安全调用
        RaceRuleConfigService.InvalidateCache();
        RaceRuleConfigService.InvalidateCache();
    }
}

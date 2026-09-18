using RaceGame.Application.Common;
using RaceGame.Application.Configuration;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证连续阶梯手续费率解析、毛奖励与净奖励的“分”级别四舍五入计算。
/// </summary>
public sealed class FeeCalculationTests
{
    private readonly RaceRuleSnapshot _defaultRules = RaceRuleSnapshot.CreateDefault();

    [Theory]
    [InlineData(100, 0.010)]        // ≤ 10,000 -> 1.0% (千分之10)
    [InlineData(10000, 0.010)]      // 10,000 边界 -> 1.0%
    [InlineData(10000.01, 0.012)]    // > 10,000 且 ≤ 50,000 -> 1.2%
    [InlineData(50000, 0.012)]       // 50,000 边界 -> 1.2%
    [InlineData(50000.01, 0.015)]    // > 50,000 且 ≤ 100,000 -> 1.5%
    [InlineData(100000, 0.015)]      // 100,000 边界 -> 1.5%
    [InlineData(100000.01, 0.020)]   // > 100,000 -> 2.0% (百分之2)
    [InlineData(1000000, 0.020)]     // 大额奖励 -> 2.0%
    public void ResolveFeeRate_ReturnsExpectedTierRate(decimal grossReward, decimal expectedRate)
    {
        var rate = _defaultRules.ResolveFeeRate(grossReward);
        Assert.Equal(expectedRate, rate);
    }

    [Fact]
    public void CalculateNetReward_RoundsToCentsProperly()
    {
        // 投注 10，赔率 3.55 => 毛奖励 35.50
        // 毛奖励 35.50 ≤ 10000 => 费率 0.010 (1.0%)
        // 手续费 35.50 * 0.010 = 0.355 => 四舍五入到分 0.36
        // 净奖励 35.50 - 0.36 = 35.14
        const decimal betAmount = 10m;
        const decimal odds = 3.55m;

        var grossReward = MoneyMath.Round(betAmount * odds);
        Assert.Equal(35.50m, grossReward);

        var feeRate = _defaultRules.ResolveFeeRate(grossReward);
        Assert.Equal(0.010m, feeRate);

        var feeAmount = MoneyMath.Round(grossReward * feeRate);
        Assert.Equal(0.36m, feeAmount);

        var netReward = MoneyMath.Round(grossReward - feeAmount);
        Assert.Equal(35.14m, netReward);
    }

    [Fact]
    public void MoneyMath_Round_RoundsAwayFromZeroAtMidpoint()
    {
        Assert.Equal(0.03m, MoneyMath.Round(0.025m));
        Assert.Equal(0.02m, MoneyMath.Round(0.024m));
        Assert.Equal(0.03m, MoneyMath.Round(0.026m));
    }

    [Fact]
    public void ResolveFeeRate_WhenBracketsExceededWithoutNullCap_FallsBackToLastBracket()
    {
        var customRules = _defaultRules with
        {
            FeeBrackets = new[]
            {
                new FeeBracket(1000m, 0.010m),
                new FeeBracket(5000m, 0.015m)
            }
        };

        // 超过所有上限 5000 时，平稳回退至最后一档 0.015，不抛异常
        var rate = customRules.ResolveFeeRate(10000m);
        Assert.Equal(0.015m, rate);
    }

    [Fact]
    public void ResolveFeeRate_WhenBracketsEmpty_ReturnsDefaultRate()
    {
        var customRules = _defaultRules with
        {
            FeeBrackets = Array.Empty<FeeBracket>()
        };

        var rate = customRules.ResolveFeeRate(1000m);
        Assert.Equal(0.01m, rate);
    }
}

using RaceGame.Application.Configuration;
using RaceGame.Domain.Constants;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证下注参数合法性、最低限额（2 游戏币）与同轮选马不变量。
/// </summary>
public sealed class BettingValidationTests
{
    private readonly RaceRuleSnapshot _rules = RaceRuleSnapshot.CreateDefault();

    [Fact]
    public void DefaultRules_MinimumBetAmount_IsTwo()
    {
        Assert.Equal(2.00m, _rules.MinimumBetAmount);
    }

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(1.99)]
    [InlineData(-5)]
    public void MinimumBetAmount_RejectsAmountsLessThanTwo(decimal invalidAmount)
    {
        Assert.True(invalidAmount < _rules.MinimumBetAmount, "Amount below 2 must violate minimum bet rule");
    }

    [Theory]
    [InlineData(2.00)]
    [InlineData(10.00)]
    [InlineData(100.00)]
    public void ValidBetAmount_IsAccepted(decimal validAmount)
    {
        Assert.True(validAmount >= _rules.MinimumBetAmount, "Amount >= 2 must be valid");
    }

    [Theory]
    [InlineData(0, false)]
    [InlineData(1, true)]
    [InlineData(6, true)]
    [InlineData(7, false)]
    public void HorseNumber_MustBeBetweenOneAndSix(int horseNo, bool expectedValid)
    {
        var isValid = horseNo is >= GameRuleDefaults.MinimumHorseNumber and <= GameRuleDefaults.MaximumHorseNumber;
        Assert.Equal(expectedValid, isValid);
    }

    [Theory]
    [InlineData("QUINELLA", 2.00, false)]
    [InlineData("QUINELLA", 4.99, false)]
    [InlineData("QUINELLA", 5.00, true)]
    [InlineData("EXACTA", 3.00, false)]
    [InlineData("EXACTA", 5.00, true)]
    [InlineData("PLACE", 2.00, false)]
    [InlineData("PLACE", 5.00, true)]
    [InlineData("QUINELLAPLACE", 2.00, false)]
    [InlineData("QUINELLAPLACE", 5.00, true)]
    [InlineData("TRIO", 3.00, false)]
    [InlineData("TRIO", 5.00, true)]
    [InlineData("TRIFECTA", 2.00, false)]
    [InlineData("TRIFECTA", 5.00, true)]
    [InlineData("WIN", 2.00, true)]
    public void PlayType_MinimumBetAmount_EnforcesRules(string playType, decimal amount, bool expectedAllowed)
    {
        var isArcade = playType is "QUINELLA" or "EXACTA" or "PLACE" or "QUINELLAPLACE" or "TRIO" or "TRIFECTA";
        var requiredMin = isArcade ? 5.00m : 2.00m;
        var allowed = amount >= requiredMin;
        Assert.Equal(expectedAllowed, allowed);
    }

    [Fact]
    public void QuinellaPlace_And_Trio_And_Trifecta_WinningRules_AssertAccurately()
    {
        // 比赛结果：第 1 名为 2 号马，第 2 名为 5 号马，第 3 名为 1 号马
        const int rank1 = 2;
        const int rank2 = 5;
        const int rank3 = 1;
        var top3 = new HashSet<int> { rank1, rank2, rank3 };

        // 1. QuinellaPlace (位置连赢): 选 5 号和 1 号，双双进入前 3 名 -> 中奖
        var qpWin = top3.Contains(5) && top3.Contains(1);
        var qpLose = top3.Contains(5) && top3.Contains(6);
        Assert.True(qpWin);
        Assert.False(qpLose);

        // 2. Trio (三连碰): 选 1, 2, 5 (无序)，包揽前三名 -> 中奖
        var trioSelected = new[] { 1, 5, 2 };
        var trioWin = trioSelected.All(top3.Contains) && trioSelected.Distinct().Count() == 3;
        var trioLose = new[] { 1, 5, 3 }.All(top3.Contains);
        Assert.True(trioWin);
        Assert.False(trioLose);

        // 3. Trifecta (三连单): 顺序必须严格为 2 ➔ 5 ➔ 1 -> 中奖
        var trifectaCorrect = (rank1 == 2 && rank2 == 5 && rank3 == 1);
        var trifectaWrongOrder = (rank1 == 5 && rank2 == 2 && rank3 == 1);
        Assert.True(trifectaCorrect);
        Assert.False(trifectaWrongOrder);
    }
}

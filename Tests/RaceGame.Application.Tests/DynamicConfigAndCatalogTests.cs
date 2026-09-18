using RaceGame.Application.Configuration;
using Xunit;

namespace RaceGame.Application.Tests;

public sealed class DynamicConfigAndCatalogTests
{
    [Fact]
    public void RaceRuleSnapshot_ResolvesDynamicConfigs_Correctly()
    {
        var snapshot = RaceRuleSnapshot.CreateDefault();

        // 1. 马房分红（排名前 3 名可获得奖金）
        var reward1 = snapshot.ResolveStableDividend(1);
        var reward2 = snapshot.ResolveStableDividend(2);
        var reward3 = snapshot.ResolveStableDividend(3);
        var reward4 = snapshot.ResolveStableDividend(4);

        Assert.True(reward1 > 0m);
        Assert.True(reward2 > 0m);
        Assert.True(reward3 > 0m);
        Assert.Equal(0m, reward4);

        // 2. 评分权重解析
        var (w1, w2, w3, w4, w5, w6, wWin) = snapshot.ResolveScoreWeights();
        Assert.True(w1 >= w2 && w2 >= w3);
        Assert.True(wWin > 0m);

        // 3. 各玩法系数
        var (factorPlace, minPlace, maxPlace) = snapshot.ResolvePlayTypeOddsCoeff("PLACE");
        Assert.True(factorPlace > 0m);
        Assert.True(minPlace < maxPlace);

        var (factorExacta, minExacta, maxExacta) = snapshot.ResolvePlayTypeOddsCoeff("EXACTA");
        Assert.True(factorExacta > 0m);
        Assert.True(minExacta < maxExacta);

        // 4. 回购价格配置
        var (baseWild, lvlBonus, winBonus, purseRate) = snapshot.ResolveBuybackConfig("WILD");
        var (baseMythic, _, _, _) = snapshot.ResolveBuybackConfig("MYTHIC");
        Assert.True(baseMythic > baseWild);
        Assert.True(lvlBonus > 0m);
        Assert.True(winBonus > 0m);
        Assert.True(purseRate > 0m);
    }
}

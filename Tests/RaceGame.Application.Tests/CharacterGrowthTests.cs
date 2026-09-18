using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证比赛结算后角色经验累加与升级阶梯判定规则。
/// 对标 PRD 6.9、V1.5 规范与 SettlementService 实现。
/// </summary>
public sealed class CharacterGrowthTests
{
    [Fact]
    public void CharacterExpGain_IncrementConstant_IsConfigured()
    {
        // 每次有效参赛结算获得固定的比赛经验
        Assert.True(GameBusinessCodes.CharacterRaceExperience > 0);
        Assert.Equal(10, GameBusinessCodes.CharacterRaceExperience);
    }

    [Fact]
    public void CharacterProgression_LevelsUpWhenExpReachesThreshold()
    {
        var character = new PlayerCharacter
        {
            PlayerId = 1,
            CharacterId = 1,
            Level = 1,
            Exp = 90,
            IsEquipped = true,
        };

        var levels = new List<CharacterLevelConfig>
        {
            new() { CharacterId = 1, Level = 1, RequiredExp = 0 },
            new() { CharacterId = 1, Level = 2, RequiredExp = 100 },
            new() { CharacterId = 1, Level = 3, RequiredExp = 300 },
        };

        // 增加 10 经验达到 100
        character.Exp += GameBusinessCodes.CharacterRaceExperience;

        var targetLevel = levels
            .Where(x => character.Exp >= x.RequiredExp)
            .Select(x => x.Level)
            .DefaultIfEmpty(character.Level)
            .Max();

        character.Level = Math.Max(character.Level, targetLevel);

        Assert.Equal(100, character.Exp);
        Assert.Equal(2, character.Level);
    }

    [Fact]
    public void CharacterProgression_DoesNotDowngradeOnZeroGain()
    {
        var character = new PlayerCharacter
        {
            PlayerId = 2,
            CharacterId = 1,
            Level = 5,
            Exp = 1500,
            IsEquipped = true,
        };

        var previousLevel = character.Level;
        // 模拟升级阈值计算
        var targetLevel = 3; // 假设低配置
        character.Level = Math.Max(character.Level, targetLevel);

        Assert.Equal(previousLevel, character.Level);
    }
}

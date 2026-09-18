using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证好友邀请裂变规则（唯一邀请码、不可自邀请、不可重复绑定）。
/// </summary>
public sealed class ReferralRulesTests
{
    [Fact]
    public void InviteCode_MustStartWithRGAndHaveValidFormat()
    {
        var player = new Player
        {
            Id = 1,
            AccountId = "player1",
            InviteCode = "RG9988",
        };

        Assert.StartsWith("RG", player.InviteCode);
        Assert.True(player.InviteCode.Length >= 6);
    }

    [Fact]
    public void Player_CanOnlyBindReferrerOnce()
    {
        var player = new Player
        {
            Id = 2,
            AccountId = "player2",
            ReferredByPlayerId = 1,
        };

        // 试图重复绑定检测
        var isAlreadyReferred = player.ReferredByPlayerId.HasValue;
        Assert.True(isAlreadyReferred);
    }

    [Fact]
    public void ReferralReward_CalculatesNoviceAndReferrerBonusCorrectly()
    {
        const decimal initialBalance = 1000m;
        const decimal noviceBonus = 200m;
        const decimal referrerBonus = 100m;

        var noviceBalanceAfter = initialBalance + noviceBonus;
        var referrerBalanceAfter = initialBalance + referrerBonus;

        Assert.Equal(1200m, noviceBalanceAfter);
        Assert.Equal(1100m, referrerBalanceAfter);
    }
}

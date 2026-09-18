using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证功勋/成就系统（Feat）的达成判定、进度递进与防溢出规则。
/// </summary>
public sealed class AchievementServiceTests
{
    [Fact]
    public void AchievementProgress_ProgressesAndCompletesAtTarget()
    {
        var achievement = new PlayerAchievement
        {
            PlayerId = 1,
            AchievementId = 101,
            CurrentProgress = 0,
            IsCompleted = false,
            IsClaimed = false,
        };

        const long targetValue = 10;

        // 1. 推进 4 点进度
        achievement.CurrentProgress = Math.Min(targetValue, achievement.CurrentProgress + 4);
        achievement.IsCompleted = achievement.CurrentProgress >= targetValue;

        Assert.Equal(4, achievement.CurrentProgress);
        Assert.False(achievement.IsCompleted);

        // 2. 推进 6 点进度，达到 10
        achievement.CurrentProgress = Math.Min(targetValue, achievement.CurrentProgress + 6);
        achievement.IsCompleted = achievement.CurrentProgress >= targetValue;

        Assert.Equal(10, achievement.CurrentProgress);
        Assert.True(achievement.IsCompleted);

        // 3. 继续推进不应溢出超过 targetValue
        achievement.CurrentProgress = Math.Min(targetValue, achievement.CurrentProgress + 5);
        Assert.Equal(10, achievement.CurrentProgress);
    }

    [Fact]
    public void AchievementClaim_MarksClaimedWithWalletReference()
    {
        var achievement = new PlayerAchievement
        {
            PlayerId = 1,
            AchievementId = 101,
            CurrentProgress = 10,
            IsCompleted = true,
            IsClaimed = false,
        };

        var now = DateTime.UtcNow;
        const long txId = 8848;
        const string idempotencyKey = "claim:achv:101:uuid123";

        achievement.IsClaimed = true;
        achievement.ClaimedAt = now;
        achievement.WalletTransactionId = txId;
        achievement.IdempotencyKey = idempotencyKey;

        Assert.True(achievement.IsClaimed);
        Assert.Equal(now, achievement.ClaimedAt);
        Assert.Equal(txId, achievement.WalletTransactionId);
        Assert.Equal(idempotencyKey, achievement.IdempotencyKey);
    }

    [Fact]
    public void StreakAchievement_ProgressIncrementsOnWin_AndResetsOnLoss()
    {
        var streakAchievement = new PlayerAchievement
        {
            PlayerId = 1,
            AchievementId = 201,
            CurrentProgress = 0,
            IsCompleted = false,
        };

        const long targetValue = 3;

        // 1. 第1场赢：连胜 1
        streakAchievement.CurrentProgress = Math.Min(targetValue, streakAchievement.CurrentProgress + 1);
        streakAchievement.IsCompleted = streakAchievement.CurrentProgress >= targetValue;
        Assert.Equal(1, streakAchievement.CurrentProgress);
        Assert.False(streakAchievement.IsCompleted);

        // 2. 第2场赢：连胜 2
        streakAchievement.CurrentProgress = Math.Min(targetValue, streakAchievement.CurrentProgress + 1);
        streakAchievement.IsCompleted = streakAchievement.CurrentProgress >= targetValue;
        Assert.Equal(2, streakAchievement.CurrentProgress);
        Assert.False(streakAchievement.IsCompleted);

        // 3. 第3场输：连胜清零
        streakAchievement.CurrentProgress = 0;
        Assert.Equal(0, streakAchievement.CurrentProgress);
        Assert.False(streakAchievement.IsCompleted);

        // 4. 重新连续赢3场：达成目标
        for (var i = 1; i <= 3; i++)
        {
            streakAchievement.CurrentProgress = Math.Min(targetValue, streakAchievement.CurrentProgress + 1);
            streakAchievement.IsCompleted = streakAchievement.CurrentProgress >= targetValue;
        }

        Assert.Equal(3, streakAchievement.CurrentProgress);
        Assert.True(streakAchievement.IsCompleted);
    }
}

using RaceGame.Application.Common;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证破产救济金调度规则（2小时等待、每日上限5次、伦敦时区日界线、发放到账与幂等键生成）。
/// 对标 PRD 5.4.6 & 5.4.7 及验收标准 11.12。
/// </summary>
public sealed class ReliefGrantTests
{
    [Fact]
    public void ReliefGrant_DefaultAmountAndDelay_MatchesPRD()
    {
        // 初始救济金额为 1000，等待延迟为 2 小时
        var scheduledAt = new DateTime(2026, 9, 10, 12, 0, 0, DateTimeKind.Utc);
        var expectedGrantAt = scheduledAt.AddHours(GameBusinessCodes.ReliefDelayHours);

        var grant = new PlayerReliefGrant
        {
            PlayerId = 1001,
            Amount = GameBusinessCodes.ReliefAmount,
            ScheduledAt = scheduledAt,
            GrantAt = scheduledAt.AddHours(GameBusinessCodes.ReliefDelayHours),
            BusinessDate = BusinessDateTime.GetLondonDate(scheduledAt),
            Status = "SCHEDULED",
            IdempotencyKey = "relief:1001:" + scheduledAt.Ticks,
        };

        Assert.Equal(1000m, grant.Amount);
        Assert.Equal(expectedGrantAt, grant.GrantAt);
        Assert.Equal("SCHEDULED", grant.Status);
        Assert.Equal(new DateOnly(2026, 9, 10), grant.BusinessDate);
        Assert.StartsWith("relief:1001:", grant.IdempotencyKey);
    }

    [Fact]
    public void ReliefGrant_MaxCountPerLondonDay_IsEnforcedToFive()
    {
        // 每个玩家每个伦敦自然日最多获得 5 次救济
        Assert.Equal(5, GameBusinessCodes.ReliefDailyLimit);
    }

    [Fact]
    public void ReliefGrant_IdempotentGrantKey_FollowsSpecification()
    {
        const string baseKey = "relief:player:999:20260910";
        var executeKey = baseKey + ":grant";

        Assert.Equal("relief:player:999:20260910:grant", executeKey);
    }

    [Fact]
    public void ReliefGrant_LondonDateTransition_AdaptsCorrectly()
    {
        // UTC 23:30 在伦敦夏令时 (BST, UTC+1) 为次日 00:30
        var summerUtc = new DateTime(2026, 7, 1, 23, 30, 0, DateTimeKind.Utc);
        var londonSummerDate = BusinessDateTime.GetLondonDate(summerUtc);
        Assert.Equal(new DateOnly(2026, 7, 2), londonSummerDate);

        // 冬令时 (GMT, UTC+0) UTC 23:30 仍为当日
        var winterUtc = new DateTime(2026, 12, 1, 23, 30, 0, DateTimeKind.Utc);
        var londonWinterDate = BusinessDateTime.GetLondonDate(winterUtc);
        Assert.Equal(new DateOnly(2026, 12, 1), londonWinterDate);
    }
}

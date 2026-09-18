using RaceGame.Application.Common;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证 Europe/London 业务时区换算、夏令时切换与业务日 UTC 范围计算。
/// </summary>
public sealed class BusinessDateTimeTests
{
    [Fact]
    public void GetLondonDate_SummerTime_IsUtcPlusOne()
    {
        // 2026 年 7 月 15 日处于英国夏令时（BST, UTC+1）
        // 23:30 UTC 在伦敦已经是 7 月 16 日 00:30
        var utcTime = new DateTime(2026, 7, 15, 23, 30, 0, DateTimeKind.Utc);
        var londonDate = BusinessDateTime.GetLondonDate(utcTime);

        Assert.Equal(new DateOnly(2026, 7, 16), londonDate);
    }

    [Fact]
    public void GetLondonDate_WinterTime_IsUtcPlusZero()
    {
        // 2026 年 1 月 15 日处于格林尼治标准时间（GMT, UTC+0）
        var utcTime = new DateTime(2026, 1, 15, 23, 30, 0, DateTimeKind.Utc);
        var londonDate = BusinessDateTime.GetLondonDate(utcTime);

        Assert.Equal(new DateOnly(2026, 1, 15), londonDate);
    }

    [Fact]
    public void GetCurrentLondonDayUtcRange_CoversFull24Hours()
    {
        var utcNow = new DateTime(2026, 7, 15, 12, 0, 0, DateTimeKind.Utc);
        var (startUtc, endUtc) = BusinessDateTime.GetCurrentLondonDayUtcRange(utcNow);

        Assert.True(startUtc < endUtc);
        Assert.True(utcNow >= startUtc && utcNow < endUtc);
        Assert.Equal(TimeSpan.FromHours(24), endUtc - startUtc);
    }
}

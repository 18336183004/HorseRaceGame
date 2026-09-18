using RaceGame.Domain.Constants;

namespace RaceGame.Application.Common;

/// <summary>
/// 集中处理项目业务自然日（Europe/London）的时间转换与日界线计算。
/// 兼顾跨平台时区标识兼容（IANA / Windows 别名），并自适应夏令时（GMT/BST）。
/// </summary>
public static class BusinessDateTime
{
    private static readonly Lazy<TimeZoneInfo> LondonTimeZoneLazy = new(ResolveLondonTimeZone);

    /// <summary>获取 London 时区实例。</summary>
    public static TimeZoneInfo LondonTimeZone => LondonTimeZoneLazy.Value;

    /// <summary>获取指定 UTC 时间对应的 London 业务自然日。</summary>
    public static DateOnly GetLondonDate(DateTime utcTime)
    {
        var londonTime = TimeZoneInfo.ConvertTimeFromUtc(
            DateTime.SpecifyKind(utcTime, DateTimeKind.Utc),
            LondonTimeZone);
        return DateOnly.FromDateTime(londonTime);
    }

    /// <summary>
    /// 获取指定 London 自然日的 UTC 时间起止范围 [StartUtc, EndUtc)。
    /// 自动适应 23 小时、24 小时或 25 小时的夏令时转换日。
    /// </summary>
    public static (DateTime StartUtc, DateTime EndUtc) GetLondonDayUtcRange(DateOnly londonDate)
    {
        var startLocal = new DateTime(londonDate.Year, londonDate.Month, londonDate.Day, 0, 0, 0, DateTimeKind.Unspecified);
        var nextDay = londonDate.AddDays(1);
        var endLocal = new DateTime(nextDay.Year, nextDay.Month, nextDay.Day, 0, 0, 0, DateTimeKind.Unspecified);

        var startUtc = TimeZoneInfo.ConvertTimeToUtc(startLocal, LondonTimeZone);
        var endUtc = TimeZoneInfo.ConvertTimeToUtc(endLocal, LondonTimeZone);

        return (startUtc, endUtc);
    }

    /// <summary>获取当前 UTC 时间对应 London 业务日的 UTC 时间起止范围 [StartUtc, EndUtc)。</summary>
    public static (DateTime StartUtc, DateTime EndUtc) GetCurrentLondonDayUtcRange(DateTime utcNow)
    {
        var businessDate = GetLondonDate(utcNow);
        return GetLondonDayUtcRange(businessDate);
    }

    private static TimeZoneInfo ResolveLondonTimeZone()
    {
        try
        {
            return TimeZoneInfo.FindSystemTimeZoneById(GameRuleDefaults.LondonTimeZone);
        }
        catch (TimeZoneNotFoundException)
        {
            return TimeZoneInfo.FindSystemTimeZoneById("GMT Standard Time");
        }
    }
}

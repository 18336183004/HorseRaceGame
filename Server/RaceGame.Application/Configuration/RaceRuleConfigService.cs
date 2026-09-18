using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Constants;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Configuration;

/// <summary>
/// 提供业务流程当前应使用的赛马规则快照。
/// 服务优先读取已发布且处于生效窗口内的数据库配置，并在数据库尚未配置时返回集中定义的开发基线。
/// </summary>
public sealed class RaceRuleConfigService(IGameDbContext db)
{
    private static readonly object CacheLock = new();
    private static (RaceRuleSnapshot Snapshot, DateTime ExpiresAtUtc)? _cachedSnapshot;
    private static readonly TimeSpan CacheTtl = TimeSpan.FromSeconds(15);

    /// <summary>显式使规则快照缓存失效（例如后台发布新规则时调用）。</summary>
    public static void InvalidateCache()
    {
        lock (CacheLock)
        {
            _cachedSnapshot = null;
        }
    }

    /// <summary>
    /// 获取指定 UTC 时间点的当前规则快照。
    /// 内置短期内存缓存以减轻高频下注和轮次推进时的数据库往返。
    /// </summary>
    /// <param name="utcNow">用于判断生效窗口的 UTC 时间。</param>
    /// <param name="cancellationToken">数据库查询取消令牌。</param>
    /// <returns>可直接供注册、下注和轮次推进使用的不可变规则快照。</returns>
    public async Task<RaceRuleSnapshot> GetCurrentAsync(DateTime utcNow, CancellationToken cancellationToken = default)
    {
        lock (CacheLock)
        {
            if (_cachedSnapshot is { } cached && cached.ExpiresAtUtc > utcNow)
            {
                return cached.Snapshot;
            }
        }

        var config = await db.RaceRuleConfigs
            .AsNoTracking()
            .Where(x => x.ConfigCode == GameBusinessCodes.DefaultRaceRuleConfigCode)
            .Where(x => x.IsActive && x.IsPublished)
            .Where(x => x.EffectiveStartAt == null || x.EffectiveStartAt <= utcNow)
            .Where(x => x.EffectiveEndAt == null || x.EffectiveEndAt > utcNow)
            .OrderByDescending(x => x.Version)
            .FirstOrDefaultAsync(cancellationToken);

        var snapshot = config is null
            ? RaceRuleSnapshot.CreateDefault()
            : new RaceRuleSnapshot(
                config.ConfigCode,
                config.Version,
                config.MinBetAmount,
                config.InitialWalletBalance,
                config.BettingDurationSeconds,
                config.PrepareDurationSeconds,
                config.RaceDurationSeconds,
                config.PostRaceIntervalSeconds,
                config.OddsAlgorithmVersion ?? GameBusinessCodes.DefaultOddsAlgorithmVersion,
                config.ResultAlgorithmVersion ?? GameBusinessCodes.DefaultResultAlgorithmVersion,
                config.BlackHorseAlgorithmVersion ?? GameBusinessCodes.DefaultBlackHorseAlgorithmVersion,
                config.RoundingVersion ?? GameBusinessCodes.DefaultRoundingVersion,
                ParseFeeBrackets(config.FeeScheduleJson),
                config.MaintenanceStartAt,
                config.MaintenanceEndAt,
                config.IsMaintenanceEnabled,
                config.MaintenanceNoticeMinutes,
                config.MaintenanceReason,
                config.MaxRoundPayoutLiability,
                config.ReferralCommissionRate,
                config.PhotoFinishThresholdSeconds,
                config.JackpotPoolCode,
                config.JackpotContributionRate,
                config.JackpotSeedAmount,
                config.JackpotWinnerShareRate,
                config.JackpotRainShareRate,
                config.JackpotRainMinBetAmount,
                config.PhotoFinishLeadSeconds,
                config.JackpotMinTriggerOdds,
                config.InPlayWindowStartSecond,
                config.InPlayWindowDurationSeconds,
                config.InPlayBoostProfitRate,
                config.IsCommentaryEnabled,
                config.IsTipsterEnabled,
                config.IsReadySkipEnabled,
                config.ReadySkipRemainingSeconds,
                config.PayoutQuinellaRatio,
                config.PayoutPlaceRatio,
                config.PayoutExactaRatio,
                config.BlackHorseBoostMultiplier,
                config.PhotoFinishProbability,
                config.HorseCountPerRound,
                config.ScoreWeightsJson,
                config.StableDividendScheduleJson,
                config.PlayTypeOddsCoefficientsJson,
                config.QualificationTrialBenchmark,
                config.QualificationTrialBaseTime,
                config.QualificationLicenseFee,
                config.QualificationCooldownHours,
                config.SystemBuybackConfigJson);

        lock (CacheLock)
        {
            _cachedSnapshot = (snapshot, utcNow.Add(CacheTtl));
        }

        return snapshot;
    }

    /// <summary>
    /// 将版本化 JSON 手续费配置解析为升序阈值列表。
    /// 无效或空配置不会扩散到资金计算，而是回退到已确认的默认费率区间。
    /// </summary>
    private static IReadOnlyList<FeeBracket> ParseFeeBrackets(string? json)
    {
        if (string.IsNullOrWhiteSpace(json))
        {
            return RaceRuleSnapshot.DefaultFeeBrackets;
        }

        try
        {
            var brackets = JsonSerializer.Deserialize<List<FeeBracket>>(json, JsonOptions);
            return brackets is { Count: > 0 } && brackets.All(x => x.Rate is >= 0m and <= 1m)
                ? brackets.OrderBy(x => x.MaximumGrossReward ?? decimal.MaxValue).ToList()
                : RaceRuleSnapshot.DefaultFeeBrackets;
        }
        catch (JsonException)
        {
            return RaceRuleSnapshot.DefaultFeeBrackets;
        }
    }

    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);
}

/// <summary>
/// 表示一次业务操作锁定的规则版本，避免操作过程中数据库配置变化造成计算不一致。
/// </summary>
public sealed record RaceRuleSnapshot(
    string ConfigCode,
    int Version,
    decimal MinimumBetAmount,
    decimal InitialWalletBalance,
    int BettingDurationSeconds,
    int PrepareDurationSeconds,
    int RaceDurationSeconds,
    int PostRaceIntervalSeconds,
    string OddsAlgorithmVersion,
    string ResultAlgorithmVersion,
    string BlackHorseAlgorithmVersion,
    string RoundingVersion,
    IReadOnlyList<FeeBracket> FeeBrackets,
    DateTime? MaintenanceStartAt = null,
    DateTime? MaintenanceEndAt = null,
    bool IsMaintenanceEnabled = false,
    int MaintenanceNoticeMinutes = 30,
    string? MaintenanceReason = null,
    decimal MaxRoundPayoutLiability = 500000.00m,
    decimal ReferralCommissionRate = 0.005m,
    decimal PhotoFinishThresholdSeconds = 0.1800m,
    string JackpotPoolCode = "MEGA_COIN_POOL",
    decimal JackpotContributionRate = 0.0150m,
    decimal JackpotSeedAmount = 100000.00m,
    decimal JackpotWinnerShareRate = 0.7000m,
    decimal JackpotRainShareRate = 0.3000m,
    decimal JackpotRainMinBetAmount = 50.00m,
    decimal PhotoFinishLeadSeconds = 3.00m,
    decimal JackpotMinTriggerOdds = 500.00m,
    int InPlayWindowStartSecond = 15,
    int InPlayWindowDurationSeconds = 3,
    decimal InPlayBoostProfitRate = 0.5000m,
    bool IsCommentaryEnabled = true,
    bool IsTipsterEnabled = true,
    bool IsReadySkipEnabled = true,
    int ReadySkipRemainingSeconds = 10,
    decimal PayoutQuinellaRatio = 0.8600m,
    decimal PayoutPlaceRatio = 0.8800m,
    decimal PayoutExactaRatio = 0.8400m,
    decimal BlackHorseBoostMultiplier = 2.00m,
    decimal PhotoFinishProbability = 0.3500m,
    int HorseCountPerRound = 6,
    string ScoreWeightsJson = "{\"rank1\":6,\"rank2\":5,\"rank3\":4,\"rank4\":3,\"rank5\":2,\"rank6\":1,\"winRate\":6}",
    string StableDividendScheduleJson = "{\"1\":200.00,\"2\":100.00,\"3\":50.00}",
    string PlayTypeOddsCoefficientsJson = "{\"PLACE\":{\"factor\":0.40,\"min\":1.15,\"max\":4.50},\"QUINELLAPLACE\":{\"factor\":0.22,\"min\":1.50,\"max\":150.0},\"EXACTA\":{\"factor\":0.65,\"min\":3.0,\"max\":500.0},\"TRIO\":{\"factor\":0.15,\"min\":4.0,\"max\":1000.0},\"TRIFECTA\":{\"factor\":0.50,\"min\":6.0,\"max\":2000.0},\"TIERCE\":{\"factor\":0.50,\"min\":6.0,\"max\":2000.0}}",
    decimal QualificationTrialBenchmark = 24.500m,
    decimal QualificationTrialBaseTime = 25.800m,
    decimal QualificationLicenseFee = 200.00m,
    int QualificationCooldownHours = 4,
    string SystemBuybackConfigJson = "{\"basePrices\":{\"WILD\":150.00,\"PLAINS_TB\":400.00,\"ROYAL\":1200.00,\"MYTHIC\":3500.00},\"levelBonus\":25.00,\"winBonus\":100.00,\"purseRate\":0.05}")
{
    /// <summary>已确认产品规则对应的默认连续手续费区间（千分之10到百分之2）。</summary>
    public static IReadOnlyList<FeeBracket> DefaultFeeBrackets { get; } =
    [
        new(10000m, 0.010m),
        new(50000m, 0.012m),
        new(100000m, 0.015m),
        new(null, 0.020m),
    ];

    /// <summary>创建数据库无已发布配置时使用的开发基线。</summary>
    public static RaceRuleSnapshot CreateDefault()
    {
        return new RaceRuleSnapshot(
            GameBusinessCodes.DefaultRaceRuleConfigCode,
            1,
            GameRuleDefaults.MinimumBetAmount,
            GameRuleDefaults.InitialWalletBalance,
            GameRuleDefaults.BettingDurationSeconds,
            GameRuleDefaults.PrepareDurationSeconds,
            GameRuleDefaults.RaceDurationSeconds,
            GameRuleDefaults.PostRaceIntervalSeconds,
            GameBusinessCodes.DefaultOddsAlgorithmVersion,
            GameBusinessCodes.DefaultResultAlgorithmVersion,
            GameBusinessCodes.DefaultBlackHorseAlgorithmVersion,
            GameBusinessCodes.DefaultRoundingVersion,
            DefaultFeeBrackets,
            null,
            null,
            false,
            30,
            null,
            500000.00m,
            0.005m,
            0.1800m,
            "MEGA_COIN_POOL",
            0.0150m,
            100000.00m,
            0.7000m,
            0.3000m,
            50.00m,
            3.00m,
            500.00m,
            15,
            3,
            0.5000m,
            true,
            true,
            true,
            10,
            0.8600m,
            0.8800m,
            0.8400m,
            2.00m,
            0.3500m,
            6,
            "{\"rank1\":6,\"rank2\":5,\"rank3\":4,\"rank4\":3,\"rank5\":2,\"rank6\":1,\"winRate\":6}",
            "{\"1\":200.00,\"2\":100.00,\"3\":50.00}",
            "{\"PLACE\":{\"factor\":0.40,\"min\":1.15,\"max\":4.50},\"QUINELLAPLACE\":{\"factor\":0.22,\"min\":1.50,\"max\":150.0},\"EXACTA\":{\"factor\":0.65,\"min\":3.0,\"max\":500.0},\"TRIO\":{\"factor\":0.15,\"min\":4.0,\"max\":1000.0},\"TRIFECTA\":{\"factor\":0.50,\"min\":6.0,\"max\":2000.0},\"TIERCE\":{\"factor\":0.50,\"min\":6.0,\"max\":2000.0}}",
            24.500m,
            25.800m,
            200.00m,
            4,
            "{\"basePrices\":{\"WILD\":150.00,\"PLAINS_TB\":400.00,\"ROYAL\":1200.00,\"MYTHIC\":3500.00},\"levelBonus\":25.00,\"winBonus\":100.00,\"purseRate\":0.05}");
    }

    /// <summary>根据毛奖励解析对应的连续手续费率。</summary>
    public decimal ResolveFeeRate(decimal grossReward)
    {
        if (FeeBrackets.Count == 0)
        {
            return 0.01m;
        }

        return (FeeBrackets.FirstOrDefault(x => x.MaximumGrossReward is null || grossReward <= x.MaximumGrossReward)
            ?? FeeBrackets.Last()).Rate;
    }

    /// <summary>解析名次出赛分红奖励金额。</summary>
    public decimal ResolveStableDividend(int rank)
    {
        try
        {
            var map = JsonSerializer.Deserialize<Dictionary<string, decimal>>(StableDividendScheduleJson);
            if (map != null && map.TryGetValue(rank.ToString(), out var amt))
            {
                return amt;
            }
        }
        catch { }

        return rank switch
        {
            1 => 200.00m,
            2 => 100.00m,
            3 => 50.00m,
            _ => 0m
        };
    }

    /// <summary>解析马匹综合评分权重。</summary>
    public (decimal r1, decimal r2, decimal r3, decimal r4, decimal r5, decimal r6, decimal wr) ResolveScoreWeights()
    {
        try
        {
            using var doc = JsonDocument.Parse(ScoreWeightsJson);
            var root = doc.RootElement;
            return (
                root.TryGetProperty("rank1", out var p1) ? p1.GetDecimal() : 6m,
                root.TryGetProperty("rank2", out var p2) ? p2.GetDecimal() : 5m,
                root.TryGetProperty("rank3", out var p3) ? p3.GetDecimal() : 4m,
                root.TryGetProperty("rank4", out var p4) ? p4.GetDecimal() : 3m,
                root.TryGetProperty("rank5", out var p5) ? p5.GetDecimal() : 2m,
                root.TryGetProperty("rank6", out var p6) ? p6.GetDecimal() : 1m,
                root.TryGetProperty("winRate", out var pw) ? pw.GetDecimal() : 6m
            );
        }
        catch
        {
            return (6m, 5m, 4m, 3m, 2m, 1m, 6m);
        }
    }

    /// <summary>解析指定玩法的赔率乘数因子与上下限夹紧参数。</summary>
    public (decimal factor, decimal minOdds, decimal maxOdds) ResolvePlayTypeOddsCoeff(string playType)
    {
        var normPlayType = (playType ?? string.Empty).Trim().ToUpperInvariant();
        var lookupKey = normPlayType is "TRIFECTA" or "TIERCE" ? "TRIFECTA" : normPlayType;
        try
        {
            using var doc = JsonDocument.Parse(PlayTypeOddsCoefficientsJson);
            var root = doc.RootElement;
            if (root.TryGetProperty(lookupKey, out var prop) ||
                (normPlayType is "TRIFECTA" or "TIERCE" && root.TryGetProperty("TIERCE", out prop)))
            {
                var factor = prop.TryGetProperty("factor", out var f) ? f.GetDecimal() : 1.0m;
                var min = prop.TryGetProperty("min", out var mn) ? mn.GetDecimal() : 1.01m;
                var max = prop.TryGetProperty("max", out var mx) ? mx.GetDecimal() : 1000m;
                return (factor, min, max);
            }
        }
        catch { }

        return normPlayType switch
        {
            "PLACE" => (0.40m, 1.15m, 4.50m),
            "QUINELLAPLACE" => (0.22m, 1.50m, 150.0m),
            "EXACTA" => (0.65m, 3.0m, 500.0m),
            "TRIO" => (0.15m, 4.0m, 1000.0m),
            "TRIFECTA" or "TIERCE" => (0.50m, 6.0m, 2000.0m),
            _ => (1.0m, 1.01m, 1000m)
        };
    }

    /// <summary>解析保底回收价格配置。</summary>
    public (decimal basePrice, decimal levelBonus, decimal winBonus, decimal purseRate) ResolveBuybackConfig(string tier)
    {
        try
        {
            using var doc = JsonDocument.Parse(SystemBuybackConfigJson);
            var root = doc.RootElement;
            decimal basePrice = 150.00m;
            if (root.TryGetProperty("basePrices", out var bp) && bp.TryGetProperty(tier.ToUpperInvariant(), out var tVal))
            {
                basePrice = tVal.GetDecimal();
            }
            var lvl = root.TryGetProperty("levelBonus", out var l) ? l.GetDecimal() : 25.00m;
            var win = root.TryGetProperty("winBonus", out var w) ? w.GetDecimal() : 100.00m;
            var prs = root.TryGetProperty("purseRate", out var r) ? r.GetDecimal() : 0.05m;
            return (basePrice, lvl, win, prs);
        }
        catch
        {
            decimal bp = tier.ToUpperInvariant() switch
            {
                "PLAINS_TB" => 400.00m,
                "ROYAL" => 1200.00m,
                "MYTHIC" => 3500.00m,
                _ => 150.00m
            };
            return (bp, 25.00m, 100.00m, 0.05m);
        }
    }
}

/// <summary>
/// 表示毛奖励上限及其对应费率；上限为空表示最后一个无上限区间。
/// </summary>
public sealed record FeeBracket(decimal? MaximumGrossReward, decimal Rate);

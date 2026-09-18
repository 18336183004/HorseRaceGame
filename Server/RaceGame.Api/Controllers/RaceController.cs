using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;
using RaceGame.Application.Abstractions;
using RaceGame.Domain.Enums;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 提供当前轮次、动画、赛果和当前玩家指定轮次下注查询。
/// 结果字段根据轮次状态控制，比赛进行中不会泄漏最终名次。
/// </summary>
[ApiController]
[Route("api/race")]
public sealed class RaceController(
    IGameDbContext db,
    RaceGame.Application.Configuration.RaceRuleConfigService ruleConfigService,
    RaceGame.Infrastructure.Redis.IRedisService redis) : ControllerBase
{
    /// <summary>
    /// 玩家提交准备就绪 (Ready & Skip)。
    /// 当参与当前轮次下注的所有玩家均已就绪时，下注倒计时将提前缩短至 10 秒即刻开闸。
    /// </summary>
    [Authorize]
    [HttpPost("ready")]
    public async Task<IActionResult> Ready(
        [FromServices] RaceGame.Application.Realtime.IRaceEventPublisher publisher,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var round = await db.RaceRounds
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        if (round is null || round.State != RaceState.Betting || DateTime.UtcNow >= round.BettingEndAt)
        {
            return BadRequest(new { code = "BETTING_NOT_ACTIVE", message = "当前不处于下注等待阶段" });
        }

        var redisKey = $"race:ready:{round.Id}";
        var readyStr = await redis.GetAsync(redisKey) ?? string.Empty;
        var readySet = readyStr.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToHashSet();
        readySet.Add(playerId.ToString());
        await redis.SetAsync(redisKey, string.Join(',', readySet), TimeSpan.FromMinutes(10));

        // 查询本轮下注的所有玩家
        var bettorIds = await db.BetOrders
            .Where(x => x.RoundId == round.Id)
            .Select(x => x.PlayerId)
            .Distinct()
            .ToListAsync(cancellationToken);

        var readyPlayerIds = readySet.Select(x => long.TryParse(x, out var id) ? id : 0).Where(id => id > 0).ToHashSet();

        // 依据规则规范：比赛不允许提前结束下注倒计时，所有玩家必须完整等待预设倒计时结束，不可快进
        var remainingSeconds = (int)Math.Max(0, (round.BettingEndAt - DateTime.UtcNow).TotalSeconds);

        return Ok(new
        {
            code = 0,
            data = new
            {
                fastForwarded = false,
                remainingSeconds = Math.Max(0, remainingSeconds),
                readyCount = readyPlayerIds.Count,
                totalBettors = bettorIds.Count
            }
        });
    }
    /// <summary>读取当前最新轮次快照与维护预警通知。</summary>
    [HttpGet("current")]
    public async Task<IActionResult> Current(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var rules = await ruleConfigService.GetCurrentAsync(now, cancellationToken);
        var remainingMinutes = (rules.IsMaintenanceEnabled && rules.MaintenanceStartAt.HasValue)
            ? (int)Math.Max(0, Math.Ceiling((rules.MaintenanceStartAt.Value - now).TotalMinutes))
            : (int?)null;

        var inNoticeWindow = rules.IsMaintenanceEnabled && rules.MaintenanceStartAt.HasValue &&
            now < rules.MaintenanceStartAt.Value &&
            (rules.MaintenanceStartAt.Value - now).TotalMinutes <= rules.MaintenanceNoticeMinutes;
        var isMaintenanceActive = rules.IsMaintenanceEnabled && rules.MaintenanceStartAt.HasValue &&
            now >= rules.MaintenanceStartAt.Value &&
            (!rules.MaintenanceEndAt.HasValue || now < rules.MaintenanceEndAt.Value);

        var maintenance = rules.IsMaintenanceEnabled && rules.MaintenanceStartAt.HasValue
            ? new
            {
                isMaintenanceEnabled = true,
                isMaintenanceActive,
                inNoticeWindow,
                maintenanceStartAt = rules.MaintenanceStartAt,
                maintenanceEndAt = rules.MaintenanceEndAt,
                noticeMinutes = rules.MaintenanceNoticeMinutes,
                remainingMinutes,
                minutesUntilStart = remainingMinutes,
                reason = rules.MaintenanceReason,
                maintenanceReason = rules.MaintenanceReason,
            }
            : null;

        var round = await db.RaceRounds
            .AsNoTracking()
            .Include(x => x.Horses)
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var data = await BuildRoundResponseAsync(round, cancellationToken);
        return Ok(new
        {
            code = 0,
            data,
            maintenance,
        });
    }

    /// <summary>获取赛前早报、专家推荐情报与当前全服超级大奖池信息。</summary>
    [HttpGet("paddock-info")]
    public async Task<IActionResult> PaddockInfo(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var rules = await ruleConfigService.GetCurrentAsync(now, cancellationToken);

        var pool = await db.JackpotPools.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PoolCode == rules.JackpotPoolCode, cancellationToken);
        var jackpotPoolAmount = pool?.CurrentAmount ?? rules.JackpotSeedAmount;

        var round = await db.RaceRounds.AsNoTracking()
            .Include(x => x.Horses)
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var recommendations = new List<object>();
        if (round != null)
        {
            var templateIds = round.Horses.Select(x => x.HorseTemplateId).Distinct().ToList();
            var catalogs = await db.HorseCatalogs.AsNoTracking()
                .Where(x => templateIds.Contains(x.Id))
                .ToDictionaryAsync(x => x.Id, cancellationToken);

            var tipsterTemplates = await db.RaceTipsterTemplates.AsNoTracking()
                .Where(x => x.IsEnabled)
                .ToListAsync(cancellationToken);

            foreach (var h in round.Horses.OrderBy(x => x.Odds))
            {
                var cat = catalogs.GetValueOrDefault(h.HorseTemplateId);
                var isTrackMatch = cat != null && string.Equals(cat.PreferredTrack, round.TrackType, StringComparison.OrdinalIgnoreCase);
                var isWeatherMatch = cat != null && string.Equals(cat.PreferredWeather, round.Weather, StringComparison.OrdinalIgnoreCase);

                var stars = 3;
                if (h.Odds <= 3.0m) stars += 1;
                if (isTrackMatch) stars += 1;
                if (isWeatherMatch) stars += 1;
                stars = Math.Clamp(stars, 1, 5);

                var condType = (isTrackMatch, isWeatherMatch) switch
                {
                    (true, true) => "BOTH",
                    (true, false) => "TRACK_ONLY",
                    (false, true) => "WEATHER_ONLY",
                    _ => "DEFAULT"
                };

                var matchedTpl = tipsterTemplates.FirstOrDefault(t => t.MatchCondition == condType)?.AnalysisZh
                    ?? tipsterTemplates.FirstOrDefault(t => t.MatchCondition == "DEFAULT")?.AnalysisZh;

                var analysisZh = matchedTpl != null
                    ? matchedTpl
                        .Replace("{TrackType}", round.TrackType ?? "草地")
                        .Replace("{Weather}", round.Weather ?? "晴朗")
                        .Replace("{WinRate}", h.WinRateSnapshot.ToString("P0"))
                    : (isTrackMatch, isWeatherMatch) switch
                    {
                        (true, true) => $"天候场地双重偏好契合，绝好调出战！锁定胜率 {h.WinRateSnapshot:P0}",
                        (true, false) => $"擅长当前 {round.TrackType} 场地，过弯机动性极强！",
                        (false, true) => $"适应 {round.Weather} 气象环境，步伐轻快稳定！",
                        _ => "稳扎稳打型悍驹，出闸爆发力不可小觑"
                    };

                recommendations.Add(new
                {
                    horseNo = h.HorseNo,
                    starRating = stars,
                    odds = h.Odds,
                    preferredTrack = cat?.PreferredTrack ?? "TURF",
                    preferredWeather = cat?.PreferredWeather ?? "SUNNY",
                    analysisZh
                });
            }
        }

        return Ok(new
        {
            code = 0,
            data = new
            {
                jackpotPoolAmount,
                jackpotPoolCode = rules.JackpotPoolCode,
                weather = round?.Weather ?? "SUNNY",
                trackType = round?.TrackType ?? "TURF",
                isCommentaryEnabled = rules.IsCommentaryEnabled,
                isTipsterEnabled = rules.IsTipsterEnabled,
                inPlayWindowStartSecond = rules.InPlayWindowStartSecond,
                inPlayWindowDurationSeconds = rules.InPlayWindowDurationSeconds,
                inPlayBoostProfitRate = rules.InPlayBoostProfitRate,
                recommendations
            }
        });
    }

    /// <summary>读取最近已完成轮次的公开结果与走势统计，用于大厅和赛场历史走势。</summary>
    [HttpGet("history")]
    public async Task<IActionResult> History(
        [FromQuery] int limit = 8,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 30);

        var items = await db.RaceRounds
            .AsNoTracking()
            .Where(x => x.State == RaceState.Finished)
            .OrderByDescending(x => x.Id)
            .Take(limit)
            .Select(x => new
            {
                roundId = x.Id,
                roundNo = x.RoundNo,
                winnerHorseNo = x.WinnerHorseNo,
                secondHorseNo = x.SecondHorseNo,
                quinellaCombo = x.WinnerHorseNo.HasValue && x.SecondHorseNo.HasValue
                    ? (x.WinnerHorseNo.Value < x.SecondHorseNo.Value
                        ? $"{x.WinnerHorseNo.Value}-{x.SecondHorseNo.Value}"
                        : $"{x.SecondHorseNo.Value}-{x.WinnerHorseNo.Value}")
                    : null,
                isSkipped = x.BetCount == 0 && x.WinnerHorseNo == null,
                finishedAt = x.SettlementAt ?? x.UpdatedAt,
            })
            .ToListAsync(cancellationToken);

        var winnerCounts = new int[6];
        foreach (var item in items)
        {
            if (!item.isSkipped && item.winnerHorseNo is >= 1 and <= 6)
            {
                winnerCounts[item.winnerHorseNo.Value - 1]++;
            }
        }

        var summary = new
        {
            totalRounds = items.Count,
            activeRounds = items.Count(x => !x.isSkipped),
            skippedRounds = items.Count(x => x.isSkipped),
            winnerDistribution = Enumerable.Range(1, 6).ToDictionary(
                horseNo => $"horse_{horseNo}",
                horseNo => winnerCounts[horseNo - 1])
        };

        return Ok(new
        {
            code = 0,
            data = items,
            summary,
            serverTime = DateTime.UtcNow
        });
    }

    /// <summary>按轮次 ID 读取轮次快照。</summary>
    [HttpGet("{id:long}")]
    public async Task<IActionResult> Get(long id, CancellationToken cancellationToken)
    {
        var round = await db.RaceRounds
            .AsNoTracking()
            .Include(x => x.Horses)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (round is null)
        {
            return NotFound(new { code = "RACE_ROUND_NOT_FOUND", message = "轮次不存在" });
        }

        var data = await BuildRoundResponseAsync(round, cancellationToken);
        return Ok(new { code = 0, data });
    }

    /// <summary>
    /// 返回比赛阶段所需的六匹马动画参数。
    /// 只有比赛开始后才允许读取 finishTime，避免下注阶段泄漏赛果。
    /// </summary>
    [HttpGet("{id:long}/animation")]
    public async Task<IActionResult> Animation(long id, CancellationToken cancellationToken)
    {
        var round = await db.RaceRounds
            .AsNoTracking()
            .Include(x => x.Horses)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (round is null)
        {
            return NotFound(new { code = "RACE_ROUND_NOT_FOUND", message = "轮次不存在" });
        }

        if (round.State is not (RaceState.Racing or RaceState.Settlement or RaceState.Finished))
        {
            return Conflict(new
            {
                code = "ANIMATION_NOT_READY",
                message = "比赛尚未开始",
            });
        }

        return Ok(new
        {
            code = 0,
            data = new
            {
                roundId = round.Id,
                raceStartAt = round.RaceStartAt,
                raceEndAt = round.RaceEndAt,
                raceDuration = round.RaceDurationSeconds,
                animations = round.Horses
                    .OrderBy(x => x.HorseNo)
                    .Select(x => new
                    {
                        x.HorseNo,
                        finishTime = x.FinishTime,
                        animation = x.AnimationJson,
                    }),
            },
        });
    }

    /// <summary>读取已经完成结算的正式赛果。</summary>
    [HttpGet("{id:long}/result")]
    public async Task<IActionResult> Result(long id, CancellationToken cancellationToken)
    {
        var round = await db.RaceRounds
            .AsNoTracking()
            .Include(x => x.Horses)
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (round is null)
        {
            return NotFound(new { code = "RACE_ROUND_NOT_FOUND", message = "轮次不存在" });
        }

        if (round.State != RaceState.Finished)
        {
            return Conflict(new
            {
                code = "RESULT_NOT_READY",
                message = "赛果尚未完成结算",
            });
        }

        var isSkipped = round.BetCount == 0 && round.WinnerHorseNo == null;
        return Ok(new
        {
            code = 0,
            data = new
            {
                roundId = round.Id,
                winnerHorseNo = round.WinnerHorseNo,
                secondHorseNo = round.SecondHorseNo,
                quinellaCombination = round.QuinellaCombination,
                raceDuration = round.RaceDurationSeconds,
                isSkipped,
                resultSeed = round.ResultSeed,
                resultSeedCommitment = round.ResultSeedCommitment,
                resultAlgorithmVersion = round.ResultAlgorithmVersion,
                payoutPoolAmount = round.PayoutPoolAmount,
                dilutionFactor = round.DilutionFactor,
                results = round.Horses
                    .Where(x => x.FinalRank != null)
                    .OrderBy(x => x.FinalRank)
                    .Select(x => new
                    {
                        x.HorseNo,
                        rank = x.FinalRank,
                        finishTime = x.FinishTime,
                        isBlackHorse = x.IsBlackHorse,
                        animation = x.AnimationJson,
                    }),
            },
        });
    }

    /// <summary>读取当前玩家在指定轮次的下注汇总与订单。</summary>
    [Authorize]
    [HttpGet("{id:long}/my-bets")]
    public async Task<IActionResult> MyBets(long id, CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var orders = await db.BetOrders
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId && x.RoundId == id)
            .OrderBy(x => x.Id)
            .Select(x => new
            {
                x.OrderNo,
                x.HorseNo,
                x.PlayType,
                x.SecondHorseNo,
                x.Combination,
                x.BetAmount,
                x.IsDoubleDown,
                x.DoubleDownAmount,
                x.LockedOdds,
                x.GrossReward,
                x.FeeAmount,
                x.NetReward,
                x.DilutionFactor,
                status = (int)x.Status,
                x.StatusReason,
                x.CreatedAt,
                x.SettledAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                horseNo = orders.FirstOrDefault()?.HorseNo,
                playType = orders.FirstOrDefault()?.PlayType,
                secondHorseNo = orders.FirstOrDefault()?.SecondHorseNo,
                combination = orders.FirstOrDefault()?.Combination,
                totalAmount = orders.Sum(x => x.BetAmount + x.DoubleDownAmount),
                orders,
            },
        });
    }

    /// <summary>提供统一的 UTC 服务端时间，用于客户端校时。</summary>
    [HttpGet("time")]
    public IActionResult Time()
    {
        return Ok(new
        {
            code = 0,
            data = new { serverTime = DateTime.UtcNow },
        });
    }

    private async Task<object?> BuildRoundResponseAsync(RaceGame.Domain.Entities.RaceRound? round, CancellationToken cancellationToken)
    {
        if (round is null) return null;

        var templateIds = round.Horses.Select(x => x.HorseTemplateId).Distinct().ToList();

        var recentFinishes = await (
            from rh in db.RaceHorses.AsNoTracking()
            join r in db.RaceRounds.AsNoTracking() on rh.RoundId equals r.Id
            where templateIds.Contains(rh.HorseTemplateId) && r.State == RaceState.Finished && rh.FinalRank != null
            orderby rh.RoundId descending
            select new { rh.HorseTemplateId, rh.FinalRank }
        ).Take(120).ToListAsync(cancellationToken);

        var recentRanksByTemplate = templateIds.ToDictionary(
            tid => tid,
            tid => recentFinishes.Where(x => x.HorseTemplateId == tid).Select(x => x.FinalRank!.Value).Take(5).ToList());

        var horseCatalogs = await db.HorseCatalogs.AsNoTracking()
            .Where(x => templateIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        return Map(round, recentRanksByTemplate, horseCatalogs);
    }

    /// <summary>根据当前状态映射公开字段，Finished 之前隐藏最终排名，比赛开始后允许获取动画表现参数。</summary>
    private static object Map(
        RaceGame.Domain.Entities.RaceRound round,
        Dictionary<long, List<int>>? recentRanks = null,
        Dictionary<long, RaceGame.Domain.Entities.HorseCatalog>? catalogs = null)
    {
        var revealResult = round.State == RaceState.Finished;
        var revealAnimation = round.State is RaceState.Racing or RaceState.Settlement or RaceState.Finished;

        return new
        {
            round.Id,
            round.RoundNo,
            state = (int)round.State,
            weather = round.Weather ?? "SUNNY",
            trackType = round.TrackType ?? "TURF",
            round.BettingStartAt,
            round.BettingEndAt,
            round.PrepareStartAt,
            round.RaceStartAt,
            round.RaceEndAt,
            round.SettlementAt,
            winnerHorseNo = revealResult ? round.WinnerHorseNo : null,
            secondHorseNo = revealResult ? round.SecondHorseNo : null,
            quinellaCombination = revealResult ? round.QuinellaCombination : null,
            isPhotoFinish = round.IsPhotoFinish,
            photoFinishGapSeconds = round.PhotoFinishGapSeconds,
            commentaryScriptJson = round.CommentaryScriptJson,
            jackpotDropped = revealResult ? round.JackpotDropped : false,
            jackpotDropAmount = revealResult ? round.JackpotDropAmount : 0m,
            quinellaOdds = ParseQuinellaOdds(round.QuinellaOddsSnapshotJson),
            round.BetCount,
            round.TotalBetAmount,
            payoutPoolAmount = round.PayoutPoolAmount,
            dilutionFactor = round.DilutionFactor,
            resultSeedCommitment = round.ResultSeedCommitment,
            resultSeed = revealResult ? round.ResultSeed : null,
            round.BettingDurationSeconds,
            round.PrepareDurationSeconds,
            round.RaceDurationSeconds,
            round.PostRaceIntervalSeconds,
            round.OddsAlgorithmVersion,
            round.ResultAlgorithmVersion,
            round.BlackHorseAlgorithmVersion,
            horses = round.Horses
                .OrderBy(x => x.HorseNo)
                .Select(x => new
                {
                    x.HorseNo,
                    horseTemplateId = x.HorseTemplateId,
                    x.HorseNameZhSnapshot,
                    x.HorseNameEnSnapshot,
                    x.AvatarAssetSnapshot,
                    x.PortraitAssetSnapshot,
                    x.Odds,
                    preferredTrack = catalogs != null && catalogs.TryGetValue(x.HorseTemplateId, out var cat) ? cat.PreferredTrack : "TURF",
                    preferredWeather = catalogs != null && catalogs.TryGetValue(x.HorseTemplateId, out var cat2) ? cat2.PreferredWeather : "SUNNY",
                    recentRanks = recentRanks != null && recentRanks.TryGetValue(x.HorseTemplateId, out var ranks) ? ranks : new List<int>(),
                    x.TotalRacesSnapshot,
                    x.WinRateSnapshot,
                    x.Rank1ProbabilitySnapshot,
                    x.Rank2ProbabilitySnapshot,
                    x.Rank3ProbabilitySnapshot,
                    x.Rank4ProbabilitySnapshot,
                    x.Rank5ProbabilitySnapshot,
                    x.Rank6ProbabilitySnapshot,
                    finalRank = revealResult ? x.FinalRank : null,
                    finishTime = revealAnimation ? x.FinishTime : null,
                    animation = revealAnimation ? x.AnimationJson : null,
                }),
            result = revealResult ? round.ResultJson : null,
        };
    }

    /// <summary>获取当前比赛全局动态配置与环境列表字典。</summary>
    [HttpGet("config")]
    public async Task<IActionResult> Config(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var rules = await ruleConfigService.GetCurrentAsync(now, cancellationToken);
        var environments = await db.RaceEnvironments.AsNoTracking()
            .Where(x => x.IsEnabled)
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                rules,
                environments = environments.Select(e => new
                {
                    e.Id,
                    e.EnvironmentType,
                    e.Code,
                    e.NameZh,
                    e.NameEn,
                    e.AdaptationBonusRate,
                    e.SelectionWeight,
                    e.VisualThemeKey
                })
            }
        });
    }

    private static object? ParseQuinellaOdds(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return null;
        try
        {
            return System.Text.Json.JsonSerializer.Deserialize<object>(json);
        }
        catch
        {
            return null;
        }
    }
}

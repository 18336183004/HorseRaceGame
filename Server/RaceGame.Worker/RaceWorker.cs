using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RaceGame.Application.Audit;
using RaceGame.Application.Common;
using RaceGame.Application.Configuration;
using RaceGame.Application.Race;
using RaceGame.Application.Realtime;
using RaceGame.Application.Settlement;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using RaceGame.Application.Abstractions;
using RaceGame.Infrastructure.Redis;

namespace RaceGame.Worker;

/// <summary>
/// 轮次状态机。数据库是唯一事实源，Redis 只负责跨实例互斥；SignalR 只负责把已经落库的状态广播给客户端。
/// </summary>
public sealed class RaceWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<RaceWorker> logger,
    IRedisService redis) : BackgroundService
{
    private const string LockKey = "lock:race:advance";
    private static readonly TimeSpan LockTtl = TimeSpan.FromSeconds(10);
    private static readonly TimeSpan LockRenewInterval = TimeSpan.FromSeconds(3);
    private DateTime? _lastMaintenanceKickBroadcastAt;
    private long _lastInPlayWindowRoundId;
    private long _lastPhotoFinishRoundId;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            var token = Guid.NewGuid().ToString("N");
            var locked = false;
            try
            {
                locked = await redis.AcquireLockAsync(LockKey, token, LockTtl);
                if (!locked)
                {
                    await Task.Delay(500, ct);
                    continue;
                }

                using var renewCts = CancellationTokenSource.CreateLinkedTokenSource(ct);
                var renewTask = RenewLockLoopAsync(token, renewCts);
                try
                {
                    await AdvanceOnceAsync(renewCts.Token);
                }
                finally
                {
                    await renewCts.CancelAsync();
                    try { await renewTask; } catch (OperationCanceledException) { }
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                // PostgreSQL 尚未初始化时不要每 500ms 疯狂刷 StackTrace；保留清晰提示并等待后重试。
                if (IsPostgresCatalogError(ex))
                {
                    logger.LogWarning("RaceWorker 暂停推进：PostgreSQL 数据库/目录不可用（SQLSTATE 3D000）。请确认当前配置的数据库已创建，并已按 001 -> 002 -> 003 执行 SQL。错误：{Message}", ex.Message);
                    await Task.Delay(TimeSpan.FromSeconds(5), ct);
                }
                else
                {
                    logger.LogError(ex, "RaceWorker推进轮次失败");
                    await Task.Delay(TimeSpan.FromSeconds(2), ct);
                }
            }
            finally
            {
                if (locked)
                {
                    try { await redis.ReleaseLockAsync(LockKey, token); }
                    catch (Exception ex) { logger.LogWarning(ex, "释放RaceWorker Redis锁失败"); }
                }
            }

            await Task.Delay(500, ct);
        }
    }

    private static bool IsPostgresCatalogError(Exception ex)
    {
        for (Exception? current = ex; current is not null; current = current.InnerException)
        {
            if (current.Message.Contains("3D000", StringComparison.OrdinalIgnoreCase))
                return true;
        }
        return false;
    }

    private async Task RenewLockLoopAsync(string token, CancellationTokenSource renewCts)
    {
        try
        {
            while (!renewCts.Token.IsCancellationRequested)
            {
                await Task.Delay(LockRenewInterval, renewCts.Token);
                if (renewCts.Token.IsCancellationRequested) break;
                if (!await redis.RenewLockAsync(LockKey, token, LockTtl))
                {
                    logger.LogWarning("RaceWorker Redis锁续租失败，可能已由其他实例接管，取消当前轮次推进");
                    await renewCts.CancelAsync();
                    break;
                }
            }
        }
        catch (OperationCanceledException) when (renewCts.Token.IsCancellationRequested) { }
    }

    private async Task AdvanceOnceAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IGameDbContext>();
        var engine = scope.ServiceProvider.GetRequiredService<RaceEngine>();
        var rules = await scope.ServiceProvider.GetRequiredService<RaceRuleConfigService>()
            .GetCurrentAsync(DateTime.UtcNow, ct);
        var settlement = scope.ServiceProvider.GetRequiredService<SettlementService>();
        var publisher = scope.ServiceProvider.GetRequiredService<IRaceEventPublisher>();
        var gameLogService = scope.ServiceProvider.GetRequiredService<GameLogService>();
        var now = DateTime.UtcNow;

        await ProcessReliefGrantsAsync(db, ct);

        // 5. 检查维护时间窗口：若当前时间已到达维护时间，向在线玩家广播强制踢出消息
        var isUnderMaintenance = rules.IsMaintenanceEnabled &&
            rules.MaintenanceStartAt.HasValue &&
            now >= rules.MaintenanceStartAt.Value &&
            (!rules.MaintenanceEndAt.HasValue || now < rules.MaintenanceEndAt.Value);

        if (isUnderMaintenance)
        {
            if (!_lastMaintenanceKickBroadcastAt.HasValue || (now - _lastMaintenanceKickBroadcastAt.Value).TotalSeconds >= 30)
            {
                _lastMaintenanceKickBroadcastAt = now;
                await publisher.PublishAsync(0L, "SystemMaintenanceKick", new
                {
                    message = "系统维护时间已到，强制退出游戏，请等待维护结束后重新登录",
                    maintenanceStartAt = rules.MaintenanceStartAt,
                    maintenanceEndAt = rules.MaintenanceEndAt,
                    reason = rules.MaintenanceReason,
                }, ct);
            }
        }
        else
        {
            _lastMaintenanceKickBroadcastAt = null;
        }

        var round = await db.RaceRounds
            .Include(x => x.Horses)
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(ct);

        if (round is null)
        {
            // 若下一轮赛事的结束时间大于维护时间，且维护尚未过期，自动停止赛事开赛排期
            var isMaintenancePending = rules.IsMaintenanceEnabled &&
                rules.MaintenanceStartAt.HasValue &&
                (!rules.MaintenanceEndAt.HasValue || now < rules.MaintenanceEndAt.Value);

            if (isMaintenancePending && rules.MaintenanceStartAt is { } maintStart)
            {
                var estimatedEnd = now.AddSeconds(rules.BettingDurationSeconds + rules.PrepareDurationSeconds + rules.RaceDurationSeconds + rules.PostRaceIntervalSeconds);
                if (estimatedEnd > maintStart)
                {
                    logger.LogWarning("赛事预计结束时间 {End} 大于系统维护时间 {Maint}，自动停止新赛事排期", estimatedEnd, maintStart);
                    return;
                }
            }

            round = await CreateRoundAsync(db, engine, rules, now, ct);
            gameLogService.AddRaceLog(round, "RACE_CREATED", "SUCCESS", new
            {
                source = "WORKER",
                horseCount = round.Horses.Count,
                rulesVersion = rules.Version,
            });
            foreach (var horse in round.Horses)
            {
                gameLogService.AddHorseLog(horse, "HORSE_ENTERED", "SUCCESS", new
                {
                    odds = horse.Odds,
                    totalRaces = horse.TotalRacesSnapshot,
                    winRate = horse.WinRateSnapshot,
                });
            }
            await db.SaveChangesAsync(ct);
            await PublishAsync(publisher, round, "RaceBettingStarted", ct);
            return;
        }

        if (round.State == RaceState.Betting && now >= round.BettingEndAt)
        {
            if (round.BetCount == 0)
            {
                round.State = RaceState.Finished;
                round.SettlementAt = now;
                round.UpdatedAt = now;
                gameLogService.AddRaceLog(round, "RACE_SKIPPED", "SUCCESS", new
                {
                    reason = "NO_BET",
                    betCount = round.BetCount,
                });
                await db.SaveChangesAsync(ct);
                await PublishAsync(publisher, round, "RaceSkipped", ct);
            }
            else
            {
                round.State = RaceState.Preparing;
                round.PrepareStartAt = now;
                round.RaceStartAt = now.AddSeconds(round.PrepareDurationSeconds);
                round.RaceEndAt = round.RaceStartAt.Value.AddSeconds(round.RaceDurationSeconds);

                // 使用在下注开始前（BettingStart）已生成并承诺的明文随机种子锁定赛果
                var seedToUse = !string.IsNullOrEmpty(round.ResultSeed)
                    ? round.ResultSeed
                    : Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
                var commentaryTemplates = await db.RaceCommentaryTemplates
                    .Where(x => x.IsEnabled)
                    .ToListAsync(ct);
                var result = engine.Generate(
                    round,
                    seedToUse,
                    rules.PhotoFinishThresholdSeconds,
                    rules.PhotoFinishProbability,
                    rules.BlackHorseBoostMultiplier,
                    commentaryTemplates);
                ApplyResult(round, result);
                round.ResultSeedCommitment = ComputeCommitment(result.Seed);
                round.UpdatedAt = now;
                gameLogService.AddRaceLog(round, "RACE_RESULT_GENERATED", "SUCCESS", new
                {
                    resultAlgorithmVersion = round.ResultAlgorithmVersion,
                    blackHorseAlgorithmVersion = round.BlackHorseAlgorithmVersion,
                    resultSeedCommitment = round.ResultSeedCommitment,
                });
                foreach (var horse in round.Horses)
                {
                    gameLogService.AddHorseLog(horse, "HORSE_RESULT_GENERATED", "SUCCESS", new
                    {
                        horse.FinalRank,
                        horse.FinishTime,
                        horse.IsBlackHorse,
                        horse.BlackHorseHitCount,
                    });
                }
                await db.SaveChangesAsync(ct);
                await PublishAsync(publisher, round, "RacePreparing", ct);
            }
            return;
        }

        if (round.State == RaceState.Preparing && round.RaceStartAt is not null && now >= round.RaceStartAt)
        {
            round.State = RaceState.Racing;
            round.UpdatedAt = now;
            gameLogService.AddRaceLog(round, "RACE_STARTED", "SUCCESS", new
            {
                raceStartAt = round.RaceStartAt,
                raceEndAt = round.RaceEndAt,
            });
            await db.SaveChangesAsync(ct);
            await PublishAsync(publisher, round, "RaceStarted", ct);
            return;
        }

        if (round.State == RaceState.Racing && round.RaceStartAt is not null && now < round.RaceEndAt)
        {
            var elapsedSeconds = (now - round.RaceStartAt.Value).TotalSeconds;

            // 1. 广播 15s 局内冲刺加倍追投窗口开启
            if (elapsedSeconds >= rules.InPlayWindowStartSecond &&
                elapsedSeconds < rules.InPlayWindowStartSecond + rules.InPlayWindowDurationSeconds &&
                _lastInPlayWindowRoundId != round.Id)
            {
                _lastInPlayWindowRoundId = round.Id;
                await publisher.PublishAsync(round.Id, "InPlayWindowOpened", new
                {
                    roundId = round.Id,
                    durationMs = (int)(rules.InPlayWindowDurationSeconds * 1000)
                }, ct);
            }

            // 2. 广播终点 Photo Finish 微距绝杀慢镜头
            var leadSec = (double)(rules.PhotoFinishLeadSeconds > 0 ? rules.PhotoFinishLeadSeconds : 2.50m);
            if (round.IsPhotoFinish && elapsedSeconds >= (round.RaceDurationSeconds - leadSec) && _lastPhotoFinishRoundId != round.Id)
            {
                _lastPhotoFinishRoundId = round.Id;
                var ranked = round.Horses.OrderBy(x => x.FinalRank).ToList();
                var h1 = ranked.Count > 0 ? ranked[0].HorseNo : 1;
                var h2 = ranked.Count > 1 ? ranked[1].HorseNo : 2;
                await publisher.PublishAsync(round.Id, "PhotoFinishTriggered", new
                {
                    roundId = round.Id,
                    horse1 = h1,
                    horse2 = h2,
                    gapTime = round.PhotoFinishGapSeconds ?? 0.05m
                }, ct);
            }
        }

        if (round.State == RaceState.Racing && round.RaceEndAt is not null && now >= round.RaceEndAt)
        {
            round.State = RaceState.Settlement;
            round.UpdatedAt = now;
            gameLogService.AddRaceLog(round, "RACE_FINISHED", "SUCCESS", new
            {
                raceEndAt = round.RaceEndAt,
                winnerHorseNo = round.Horses.OrderBy(x => x.FinalRank).First().HorseNo,
            });
            await db.SaveChangesAsync(ct);
            await PublishAsync(publisher, round, "RaceFinished", ct);

            var rankedHorses = round.Horses.OrderBy(x => x.FinalRank).ToList();
            var winner = rankedHorses.Count > 0 ? rankedHorses[0].HorseNo : (round.WinnerHorseNo ?? 1);
            var second = rankedHorses.Count > 1 ? rankedHorses[1].HorseNo : (round.SecondHorseNo ?? 2);
            round.WinnerHorseNo = winner;
            round.SecondHorseNo = second;
            await settlement.SettleAsync(round.Id, winner, ct);

            var finished = await db.RaceRounds.Include(x => x.Horses).FirstAsync(x => x.Id == round.Id, ct);
            gameLogService.AddRaceLog(finished, "RACE_SETTLED", "SUCCESS", new
            {
                winnerHorseNo = finished.WinnerHorseNo,
                secondHorseNo = finished.SecondHorseNo,
                quinellaCombination = finished.QuinellaCombination,
                settlementAt = finished.SettlementAt,
            });
            await db.SaveChangesAsync(ct);
            await PublishAsync(publisher, finished, "RaceSettled", ct);

            if (finished.JackpotDropped)
            {
                await publisher.PublishAsync(finished.Id, "MegaJackpotDropped", new
                {
                    roundId = finished.Id,
                    totalPool = finished.JackpotDropAmount,
                }, ct);
            }
            return;
        }

        if (round.State == RaceState.Finished)
        {
            var nextStart = round.BetCount > 0
                ? round.BettingStartAt.AddSeconds(
                    round.BettingDurationSeconds +
                    round.PrepareDurationSeconds +
                    round.RaceDurationSeconds +
                    round.PostRaceIntervalSeconds)
                : now;
            if (now >= nextStart)
            {
                // 5. 后台管理设置维护时间：如果当前赛事的结束时间大于维护时间且维护尚未过期，那么就自动停止赛事
                var isMaintenancePending = rules.IsMaintenanceEnabled &&
                    rules.MaintenanceStartAt.HasValue &&
                    (!rules.MaintenanceEndAt.HasValue || now < rules.MaintenanceEndAt.Value);

                if (isMaintenancePending && rules.MaintenanceStartAt is { } maintStart)
                {
                    var estimatedEnd = now.AddSeconds(rules.BettingDurationSeconds + rules.PrepareDurationSeconds + rules.RaceDurationSeconds + rules.PostRaceIntervalSeconds);
                    if (estimatedEnd > maintStart)
                    {
                        logger.LogWarning("下一轮赛事预计结束时间 {End} 大于维护时间 {Maint}，自动暂停开赛排期", estimatedEnd, maintStart);
                        return;
                    }
                }

                var next = await CreateRoundAsync(db, engine, rules, now, ct);
                gameLogService.AddRaceLog(next, "RACE_CREATED", "SUCCESS", new
                {
                    source = "WORKER",
                    horseCount = next.Horses.Count,
                    rulesVersion = rules.Version,
                });
                foreach (var horse in next.Horses)
                {
                    gameLogService.AddHorseLog(horse, "HORSE_ENTERED", "SUCCESS", new
                    {
                        odds = horse.Odds,
                        totalRaces = horse.TotalRacesSnapshot,
                        winRate = horse.WinRateSnapshot,
                    });
                }
                await db.SaveChangesAsync(ct);
                await PublishAsync(publisher, next, "RaceBettingStarted", ct);
            }
        }
    }

    /// <summary>
    /// 发放到期的破产补偿。
    /// 补偿以数据库状态为准，同一玩家同一伦敦自然日最多成功 5 次，且不检查当前余额。
    /// </summary>
    private static async Task ProcessReliefGrantsAsync(IGameDbContext db, CancellationToken ct)
    {
        var now = DateTime.UtcNow;
        var grants = await db.PlayerReliefGrants
            .Where(x => x.Status == "SCHEDULED" && x.GrantAt <= now)
            .OrderBy(x => x.GrantAt)
            .ThenBy(x => x.Id)
            .Take(100)
            .ToListAsync(ct);

        foreach (var grant in grants)
        {
            await using var transaction = await db.Database.BeginTransactionAsync(ct);

            var current = await db.PlayerReliefGrants
                .FirstOrDefaultAsync(x => x.Id == grant.Id, ct);

            if (current is null || current.Status != "SCHEDULED" || current.GrantAt > DateTime.UtcNow)
            {
                await transaction.RollbackAsync(ct);
                continue;
            }

            var grantedCount = await db.PlayerReliefGrants.CountAsync(
                x => x.PlayerId == current.PlayerId
                    && x.BusinessDate == current.BusinessDate
                    && x.Status == "GRANTED",
                ct);

            if (grantedCount >= GameBusinessCodes.ReliefDailyLimit)
            {
                current.Status = "LIMIT_REACHED";
                current.LastAttemptAt = DateTime.UtcNow;
                current.AttemptCount++;
                current.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                continue;
            }

            var wallet = await WalletConcurrency.LockAsync(db, current.PlayerId, ct);
            if (wallet is null)
            {
                current.Status = "FAILED";
                current.FailureReason = "WALLET_NOT_FOUND";
                current.LastAttemptAt = DateTime.UtcNow;
                current.AttemptCount++;
                current.UpdatedAt = DateTime.UtcNow;
                await db.SaveChangesAsync(ct);
                await transaction.CommitAsync(ct);
                continue;
            }

            var before = wallet.Balance;
            wallet.Balance = MoneyMath.Round(wallet.Balance + current.Amount);
            wallet.Version++;
            wallet.UpdatedAt = DateTime.UtcNow;

            var transactionRecord = new WalletTransaction
            {
                PlayerId = current.PlayerId,
                TransactionType = GameBusinessCodes.ReliefGrantTransaction,
                Amount = current.Amount,
                BalanceBefore = before,
                BalanceAfter = wallet.Balance,
                ReferenceType = "PLAYER_RELIEF",
                ReferenceId = current.Id.ToString(),
                IdempotencyKey = current.IdempotencyKey + ":grant",
                CreatedAt = DateTime.UtcNow,
            };

            db.WalletTransactions.Add(transactionRecord);
            current.Status = "GRANTED";
            current.LastAttemptAt = DateTime.UtcNow;
            current.AttemptCount++;
            current.UpdatedAt = DateTime.UtcNow;

            await db.SaveChangesAsync(ct);
            current.GrantedTransactionId = transactionRecord.Id;
            await db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }
    }

    private static void ApplyResult(RaceRound round, RaceResult result)
    {
        foreach (var item in result.Results)
        {
            var horse = round.Horses.Single(x => x.HorseNo == item.HorseNo);
            horse.FinalRank = item.FinalRank;
            horse.FinishTime = item.FinishTime;
            horse.IsBlackHorseCandidate = result.BlackHorse.HitCounts.ContainsKey(horse.HorseTemplateId);
            horse.BlackHorseHitCount = item.BlackHorseHitCount;
            horse.IsBlackHorse = item.IsBlackHorse;
            horse.AnimationJson = JsonSerializer.Serialize(new
            {
                item.FinishTime,
                item.AnimationSeed,
                item.IsBlackHorse
            });
        }

        round.WinnerHorseNo = result.WinnerHorseNo;
        round.SecondHorseNo = result.SecondHorseNo;
        round.IsPhotoFinish = result.IsPhotoFinish;
        round.PhotoFinishGapSeconds = result.PhotoFinishGapSeconds;
        round.CommentaryScriptJson = result.CommentaryScript != null ? JsonSerializer.Serialize(result.CommentaryScript) : null;
        round.ResultSeed = result.Seed;
        round.ResultAlgorithmVersion = result.AlgorithmVersion;
        round.BlackHorseAlgorithmVersion = result.BlackHorseAlgorithmVersion;
        round.BlackHorseSnapshotJson = JsonSerializer.Serialize(result.BlackHorse);
        round.ResultJson = JsonSerializer.Serialize(result);
    }

    private static string ComputeCommitment(string seed)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(seed))).ToLowerInvariant();

    private static RaceEnvironment PickWeightedEnvironment(List<RaceEnvironment> list, string defaultCode)
    {
        if (list.Count == 0)
        {
            return new RaceEnvironment { Code = defaultCode, AdaptationBonusRate = 1.08m, SelectionWeight = 100 };
        }
        var totalWeight = list.Sum(x => Math.Max(1, x.SelectionWeight));
        var roll = RandomNumberGenerator.GetInt32(0, totalWeight);
        var cursor = 0;
        foreach (var env in list)
        {
            cursor += Math.Max(1, env.SelectionWeight);
            if (roll < cursor) return env;
        }
        return list[0];
    }

    private static async Task<RaceRound> CreateRoundAsync(
        IGameDbContext db,
        RaceEngine engine,
        RaceRuleSnapshot rules,
        DateTime now,
        CancellationToken ct)
    {
        var catalogs = await db.HorseCatalogs
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);
        var horseCount = rules.HorseCountPerRound > 0 ? rules.HorseCountPerRound : GameRuleDefaults.HorseCountPerRound;
        if (catalogs.Count < horseCount)
            throw new InvalidOperationException($"启用马匹不足{horseCount}匹");

        var selected = catalogs
            .OrderBy(_ => Guid.NewGuid())
            .Take(horseCount)
            .ToList();

        var envs = await db.RaceEnvironments
            .Where(x => x.IsEnabled)
            .ToListAsync(ct);

        var weathers = envs.Where(x => x.EnvironmentType == "WEATHER").ToList();
        var tracks = envs.Where(x => x.EnvironmentType == "TRACK").ToList();

        var pickedWeather = PickWeightedEnvironment(weathers, "SUNNY");
        var pickedTrack = PickWeightedEnvironment(tracks, "TURF");

        var weather = pickedWeather.Code;
        var trackType = pickedTrack.Code;
        var weatherBonus = pickedWeather.AdaptationBonusRate > 0 ? pickedWeather.AdaptationBonusRate : 1.08m;
        var trackBonus = pickedTrack.AdaptationBonusRate > 0 ? pickedTrack.AdaptationBonusRate : 1.08m;
        var weights = rules.ResolveScoreWeights();

        var entries = engine.BuildRoundHorseEntries(selected, trackType, weather, trackBonus, weatherBonus, weights);
        var quinellaOdds = engine.BuildQuinellaOdds(entries, rules.PayoutQuinellaRatio);

        // 二.2: 在下注开始前（BettingStart）就必须生成明文种子并计算公布哈希承诺 Commitment = SHA256(ServerSeed)
        var serverSeed = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();
        var commitment = ComputeCommitment(serverSeed);
        var maxLiability = rules.MaxRoundPayoutLiability > 0 ? rules.MaxRoundPayoutLiability : 500000.00m;

        var round = new RaceRound
        {
            RoundNo = now.ToString("yyyyMMddHHmmssfff"),
            State = RaceState.Betting,
            Weather = weather,
            TrackType = trackType,
            BettingStartAt = now,
            BettingDurationSeconds = rules.BettingDurationSeconds,
            PrepareDurationSeconds = rules.PrepareDurationSeconds,
            RaceDurationSeconds = rules.RaceDurationSeconds,
            PostRaceIntervalSeconds = rules.PostRaceIntervalSeconds,
            BettingEndAt = now.AddSeconds(rules.BettingDurationSeconds),
            OddsAlgorithmVersion = rules.OddsAlgorithmVersion,
            ResultAlgorithmVersion = rules.ResultAlgorithmVersion,
            BlackHorseAlgorithmVersion = rules.BlackHorseAlgorithmVersion,
            ResultSeed = serverSeed,
            ResultSeedCommitment = commitment,
            PayoutPoolAmount = maxLiability,
            DilutionFactor = 1.0m,
            RoundRuleSnapshotJson = JsonSerializer.Serialize(rules),
            OddsSnapshotJson = JsonSerializer.Serialize(entries),
            QuinellaOddsSnapshotJson = JsonSerializer.Serialize(quinellaOdds),
            SelectedHorseSnapshotJson = JsonSerializer.Serialize(selected.Select((horse, index) => new
            {
                horseNo = index + 1,
                horseTemplateId = horse.Id,
                horseCode = horse.HorseCode,
                nameZh = horse.NameZh,
                nameEn = horse.NameEn,
            })),
        };

        for (var i = 0; i < entries.Count; i++)
        {
            var e = entries[i];
            var h = selected.First(x => x.Id == e.HorseCatalogId);
            round.Horses.Add(new RaceHorse
            {
                HorseNo = i + 1,
                HorseTemplateId = e.HorseCatalogId,
                Odds = e.Odds,
                HorseNameZhSnapshot = h.NameZh,
                HorseNameEnSnapshot = h.NameEn,
                AvatarAssetSnapshot = h.AvatarAsset,
                PortraitAssetSnapshot = h.PortraitAsset,
                TotalRacesSnapshot = e.TotalRaces,
                WinCountSnapshot = h.WinCount,
                WinRateSnapshot = e.WinRate,
                Rank1ProbabilitySnapshot = e.Rank1Probability,
                Rank2ProbabilitySnapshot = e.Rank2Probability,
                Rank3ProbabilitySnapshot = e.Rank3Probability,
                Rank4ProbabilitySnapshot = e.Rank4Probability,
                Rank5ProbabilitySnapshot = e.Rank5Probability,
                Rank6ProbabilitySnapshot = e.Rank6Probability
            });
        }

        db.RaceRounds.Add(round);
        await db.SaveChangesAsync(ct);
        return round;
    }

    private static Task PublishAsync(IRaceEventPublisher publisher, RaceRound round, string eventName, CancellationToken ct)
    {
        var payload = new
        {
            roundId = round.Id,
            roundNo = round.RoundNo,
            state = (int)round.State,
            serverTime = DateTime.UtcNow,
            bettingStartAt = round.BettingStartAt,
            bettingEndAt = round.BettingEndAt,
            prepareStartAt = round.PrepareStartAt,
            raceStartAt = round.RaceStartAt,
            raceEndAt = round.RaceEndAt,
            winnerHorseNo = round.State == RaceState.Finished ? round.WinnerHorseNo : null,
            secondHorseNo = round.State == RaceState.Finished ? round.SecondHorseNo : null,
            quinellaCombination = round.State == RaceState.Finished ? round.QuinellaCombination : null,
            isPhotoFinish = round.IsPhotoFinish,
            photoFinishGapSeconds = round.PhotoFinishGapSeconds,
            commentaryScriptJson = round.CommentaryScriptJson,
            jackpotDropped = round.JackpotDropped,
            jackpotDropAmount = round.JackpotDropAmount,
            horses = round.Horses.OrderBy(x => x.HorseNo).Select(x => new
            {
                x.HorseNo,
                x.HorseNameZhSnapshot,
                x.Odds,
                finishTime = round.State is RaceState.Racing or RaceState.Settlement or RaceState.Finished ? x.FinishTime : null,
                animation = round.State is RaceState.Racing or RaceState.Settlement or RaceState.Finished ? x.AnimationJson : null,
                finalRank = round.State == RaceState.Finished ? x.FinalRank : null
            })
        };
        return publisher.PublishAsync(round.Id, eventName, payload, ct);
    }
}

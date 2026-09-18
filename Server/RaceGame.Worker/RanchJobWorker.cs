using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Microsoft.Extensions.Logging;
using RaceGame.Application.Abstractions;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Redis;

namespace RaceGame.Worker;

/// <summary>
/// 模式三：西部纯血马房与后台作业调度工作者 (RanchJobWorker)。
/// 专职消费 background_jobs 持久化队列表，处理饱腹度代谢、每日体力重置与后台维护任务。
/// </summary>
public sealed class RanchJobWorker(
    IServiceScopeFactory scopeFactory,
    ILogger<RanchJobWorker> logger,
    IRedisService redis) : BackgroundService
{
    private const string LockKey = "lock:ranch:jobs";
    private static readonly TimeSpan LockTtl = TimeSpan.FromSeconds(15);
    private DateTime _lastDigestionSweep = DateTime.MinValue;
    private DateTime _lastDailyResetDate = DateTime.MinValue;

    protected override async Task ExecuteAsync(CancellationToken ct)
    {
        logger.LogInformation("RanchJobWorker 已启动，准备消费持久化 background_jobs 任务队列");

        while (!ct.IsCancellationRequested)
        {
            var token = Guid.NewGuid().ToString("N");
            var locked = false;

            try
            {
                locked = await redis.AcquireLockAsync(LockKey, token, LockTtl);
                if (locked)
                {
                    await ProcessJobsAsync(ct);
                    await PeriodicMaintenanceSweepAsync(ct);
                }
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "RanchJobWorker 执行周期异常");
            }
            finally
            {
                if (locked)
                {
                    try
                    {
                        await redis.ReleaseLockAsync(LockKey, token);
                    }
                    catch (Exception ex)
                    {
                        logger.LogWarning(ex, "RanchJobWorker 释放分布式锁失败");
                    }
                }
            }

            try
            {
                await Task.Delay(TimeSpan.FromSeconds(5), ct);
            }
            catch (OperationCanceledException) when (ct.IsCancellationRequested)
            {
                break;
            }
        }

        logger.LogInformation("RanchJobWorker 已安全退出");
    }

    private async Task ProcessJobsAsync(CancellationToken ct)
    {
        using var scope = scopeFactory.CreateScope();
        var db = scope.ServiceProvider.GetRequiredService<IGameDbContext>();

        var now = DateTime.UtcNow;
        var pendingJobs = await db.BackgroundJobs
            .Where(x => x.Status == "PENDING" && x.ScheduledAt <= now)
            .OrderBy(x => x.ScheduledAt)
            .Take(10)
            .ToListAsync(ct);

        if (pendingJobs.Count == 0)
        {
            return;
        }

        foreach (var job in pendingJobs)
        {
            job.Status = "RUNNING";
            job.AttemptCount++;
            await db.SaveChangesAsync(ct);

            try
            {
                await HandleJobAsync(db, job, ct);
                job.Status = "COMPLETED";
                job.ExecutedAt = DateTime.UtcNow;
                job.LastError = null;
            }
            catch (Exception ex)
            {
                logger.LogError(ex, "处理后台任务失败 JobId={JobId}, Type={JobType}", job.Id, job.JobType);
                job.LastError = ex.Message;
                job.Status = job.AttemptCount >= job.MaxRetries ? "FAILED" : "PENDING";
            }

            await db.SaveChangesAsync(ct);
        }
    }

    private async Task HandleJobAsync(IGameDbContext db, BackgroundJob job, CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        switch (job.JobType)
        {
            case "JOB_DIGESTION":
                await PerformDigestionSweepAsync(db, now, ct);
                break;

            case "JOB_DAILY_RESET":
                await PerformDailyResetAsync(db, now, ct);
                break;

            default:
                logger.LogInformation("已处理常规通知任务 JobId={JobId}, Type={JobType}", job.Id, job.JobType);
                break;
        }
    }

    private async Task PeriodicMaintenanceSweepAsync(CancellationToken ct)
    {
        var now = DateTime.UtcNow;

        // 1. 每 30 分钟检查一次饱腹度自然代谢
        if (now - _lastDigestionSweep >= TimeSpan.FromMinutes(30))
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IGameDbContext>();
            await PerformDigestionSweepAsync(db, now, ct);
            _lastDigestionSweep = now;
        }

        // 2. 每日 UTC 00:00 跨天体力能量重置
        if (now.Date > _lastDailyResetDate.Date)
        {
            using var scope = scopeFactory.CreateScope();
            var db = scope.ServiceProvider.GetRequiredService<IGameDbContext>();
            await PerformDailyResetAsync(db, now, ct);
            _lastDailyResetDate = now.Date;
        }
    }

    private static async Task PerformDigestionSweepAsync(IGameDbContext db, DateTime now, CancellationToken ct)
    {
        var twoHoursAgo = now.AddHours(-1);
        var activeHorses = await db.RanchHorses
            .Where(x => x.HungerLevel > 0 && x.LastDigestedAt <= twoHoursAgo && x.SubStatus != "RETIRED")
            .Take(50)
            .ToListAsync(ct);

        foreach (var horse in activeHorses)
        {
            var hours = (now - horse.LastDigestedAt).TotalHours;
            if (hours >= 1.0)
            {
                var digested = (int)(Math.Min(hours, 24.0) * 20);
                horse.HungerLevel = Math.Max(0, horse.HungerLevel - digested);
                horse.LastDigestedAt = now;
            }
        }

        if (activeHorses.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    private static async Task PerformDailyResetAsync(IGameDbContext db, DateTime now, CancellationToken ct)
    {
        var exhaustedHorses = await db.RanchHorses
            .Where(x => x.StaminaEnergy < 100 && x.SubStatus != "RETIRED" && x.SubStatus != "INJURED" && x.SubStatus != "SICK" && x.SubStatus != "PREGNANT")
            .Take(100)
            .ToListAsync(ct);

        foreach (var horse in exhaustedHorses)
        {
            if (now.Date > horse.UpdatedAt.Date)
            {
                horse.StaminaEnergy = 100;
                horse.UpdatedAt = now;
            }
        }

        if (exhaustedHorses.Count > 0)
        {
            await db.SaveChangesAsync(ct);
        }
    }
}

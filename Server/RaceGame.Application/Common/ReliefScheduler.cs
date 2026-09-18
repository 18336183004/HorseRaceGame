using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Abstractions;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;

namespace RaceGame.Application.Common;

/// <summary>
/// 集中处理玩家钱包余额归零时的破产救济倒计时任务调度。
/// 保证无论是下注扣款还是商城消费导致余额刚好变为 0，都能统一触发 2 小时延迟发放 1,000 游戏币的补偿记录。
/// </summary>
public static class ReliefScheduler
{
    /// <summary>
    /// 在余额归零时创建唯一的两小时补偿任务。
    /// 补偿是否发放由 Worker 根据持久化的 GrantAt 决定，等待期间重新获得余额不会取消倒计时。
    /// </summary>
    public static async Task ScheduleIfNeededAsync(
        IGameDbContext db,
        long playerId,
        long triggerTransactionId,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        // 1. 业务决策修正：若玩家尚有任何在途/待结算的比赛注单，则不能申请破产救济
        var hasActiveOrders = await db.BetOrders
            .AnyAsync(x => x.PlayerId == playerId && x.Status == RaceGame.Domain.Enums.BetOrderStatus.Pending, cancellationToken);
        if (hasActiveOrders)
        {
            return;
        }

        // 2. 检查玩家钱包当前余额是否确为 0
        var wallet = await db.Wallets.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);
        if (wallet is not null && wallet.Balance > 0m)
        {
            return;
        }

        // 同一归零流水不重复创建，且等待期内若已有未完成的补偿倒计时则保持单份
        var hasActiveOrDuplicate = await db.PlayerReliefGrants
            .AnyAsync(
                x => x.PlayerId == playerId && (x.TriggerTransactionId == triggerTransactionId || x.Status == "SCHEDULED"),
                cancellationToken);

        if (hasActiveOrDuplicate)
        {
            return;
        }

        var grantAt = utcNow.AddHours(GameBusinessCodes.ReliefDelayHours);
        var businessDate = BusinessDateTime.GetLondonDate(grantAt);

        db.PlayerReliefGrants.Add(new PlayerReliefGrant
        {
            PlayerId = playerId,
            BusinessDate = businessDate,
            ScheduledAt = utcNow,
            GrantAt = grantAt,
            Amount = GameBusinessCodes.ReliefAmount,
            Status = "SCHEDULED",
            TriggerTransactionId = triggerTransactionId,
            IdempotencyKey = $"relief:{playerId}:{triggerTransactionId}",
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        });
    }

    /// <summary>
    /// 处理指定玩家所有已到期的救济金补偿。
    /// 限制每日最多 5 次；满足条件且到达发放时间时自动发放充值到账并记录钱包流水。
    /// 用于 Worker 扫描，以及玩家重新登录或加载个人数据上线时自动触发补偿到账。
    /// </summary>
    public static async Task<int> ProcessPlayerPendingReliefGrantsAsync(
        IGameDbContext db,
        long playerId,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var pendingGrants = await db.PlayerReliefGrants
            .Where(x => x.PlayerId == playerId && x.Status == "SCHEDULED" && x.GrantAt <= utcNow)
            .OrderBy(x => x.GrantAt)
            .ToListAsync(cancellationToken);

        if (pendingGrants.Count == 0)
        {
            return 0;
        }

        var processedCount = 0;
        foreach (var grant in pendingGrants)
        {
            await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

            var current = await db.PlayerReliefGrants
                .FirstOrDefaultAsync(x => x.Id == grant.Id && x.Status == "SCHEDULED", cancellationToken);

            if (current is null || current.GrantAt > utcNow)
            {
                await tx.RollbackAsync(cancellationToken);
                continue;
            }

            var grantedCount = await db.PlayerReliefGrants.CountAsync(
                x => x.PlayerId == playerId && x.BusinessDate == current.BusinessDate && x.Status == "GRANTED",
                cancellationToken);

            if (grantedCount >= GameBusinessCodes.ReliefDailyLimit)
            {
                current.Status = "LIMIT_REACHED";
                current.LastAttemptAt = utcNow;
                current.AttemptCount++;
                current.UpdatedAt = utcNow;
                await db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                continue;
            }

            var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken);
            if (wallet is null)
            {
                current.Status = "FAILED";
                current.FailureReason = "WALLET_NOT_FOUND";
                current.LastAttemptAt = utcNow;
                current.AttemptCount++;
                current.UpdatedAt = utcNow;
                await db.SaveChangesAsync(cancellationToken);
                await tx.CommitAsync(cancellationToken);
                continue;
            }

            // PRD 5.4.9: 等待期间玩家即使通过任务或其他方式重新获得余额，已启动的 2 小时补偿倒计时仍继续，到期后照常发放
            var before = wallet.Balance;
            wallet.Balance = MoneyMath.Round(wallet.Balance + current.Amount);
            wallet.Version++;
            wallet.UpdatedAt = utcNow;

            var transactionRecord = new WalletTransaction
            {
                PlayerId = playerId,
                TransactionType = GameBusinessCodes.ReliefGrantTransaction,
                Amount = current.Amount,
                BalanceBefore = before,
                BalanceAfter = wallet.Balance,
                ReferenceType = "PLAYER_RELIEF",
                ReferenceId = current.Id.ToString(),
                IdempotencyKey = current.IdempotencyKey + ":grant",
                CreatedAt = utcNow,
            };

            db.WalletTransactions.Add(transactionRecord);
            await db.SaveChangesAsync(cancellationToken);

            current.Status = "GRANTED";
            current.GrantedTransactionId = transactionRecord.Id;
            current.LastAttemptAt = utcNow;
            current.UpdatedAt = utcNow;

            await db.SaveChangesAsync(cancellationToken);
            await tx.CommitAsync(cancellationToken);
            processedCount++;
        }

        return processedCount;
    }
}

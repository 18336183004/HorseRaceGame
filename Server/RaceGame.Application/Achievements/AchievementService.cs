using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Abstractions;
using RaceGame.Application.Common;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;

namespace RaceGame.Application.Achievements;

/// <summary>领取成就奖励请求。</summary>
public sealed record ClaimAchievementRequest(string IdempotencyKey);

/// <summary>成就视图 DTO。</summary>
public sealed record AchievementDto(
    long Id,
    long PlayerAchievementId,
    string AchievementCode,
    string Category,
    string TitleZh,
    string TitleEn,
    string DescriptionZh,
    string DescriptionEn,
    string? IconAsset,
    string? BadgeName,
    long CurrentProgress,
    long TargetValue,
    bool IsCompleted,
    DateTime? CompletedAt,
    bool IsClaimed,
    DateTime? ClaimedAt,
    string RewardType,
    decimal RewardAmount);

/// <summary>成就领奖响应。</summary>
public sealed record AchievementClaimResponse(
    long PlayerAchievementId,
    long AchievementId,
    string AchievementCode,
    string RewardType,
    decimal RewardAmount,
    decimal Balance,
    DateTime ServerTime);

/// <summary>
/// 编排成就进度推进、达成判定与奖励发放（对应 1.png Feat 页面）。
/// </summary>
public sealed class AchievementService(IGameDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>获取当前玩家的所有成就列表与达成状态。</summary>
    public async Task<IReadOnlyList<AchievementDto>> GetPlayerAchievementsAsync(
        long playerId,
        CancellationToken ct = default)
    {
        await EnsurePlayerAchievementsAsync(playerId, ct);

        var list = await (
            from pa in db.PlayerAchievements.AsNoTracking().Where(x => x.PlayerId == playerId)
            join def in db.AchievementDefinitions.AsNoTracking() on pa.AchievementId equals def.Id
            where def.IsEnabled
            orderby def.SortOrder, def.Id
            select new
            {
                pa.Id,
                pa.PlayerId,
                pa.AchievementId,
                pa.CurrentProgress,
                pa.IsCompleted,
                pa.CompletedAt,
                pa.IsClaimed,
                pa.ClaimedAt,
                def.AchievementCode,
                def.Category,
                def.TitleZh,
                def.TitleEn,
                def.DescriptionZh,
                def.DescriptionEn,
                def.IconAsset,
                def.BadgeName,
                def.TargetValue,
                def.RewardType,
                def.RewardPayload,
            }
        ).ToListAsync(ct);

        return list.Select(x =>
        {
            var rewardAmount = ParseRewardAmount(x.RewardPayload);
            return new AchievementDto(
                x.AchievementId,
                x.Id,
                x.AchievementCode,
                x.Category,
                x.TitleZh,
                x.TitleEn,
                x.DescriptionZh,
                x.DescriptionEn,
                x.IconAsset,
                x.BadgeName,
                x.CurrentProgress,
                x.TargetValue,
                x.IsCompleted,
                x.CompletedAt,
                x.IsClaimed,
                x.ClaimedAt,
                x.RewardType,
                rewardAmount);
        }).ToList();
    }

    /// <summary>
    /// 推进指定类别的成就进度，并在达到目标时标记完成。
    /// </summary>
    public async Task AdvanceProgressAsync(
        long playerId,
        string category,
        long increment,
        CancellationToken ct = default)
    {
        if (increment <= 0) return;

        await EnsurePlayerAchievementsAsync(playerId, ct);

        var playerAchievements = await (
            from pa in db.PlayerAchievements.Where(x => x.PlayerId == playerId && !x.IsCompleted)
            join def in db.AchievementDefinitions on pa.AchievementId equals def.Id
            where def.IsEnabled && def.Category == category
            select new { Pa = pa, Def = def }
        ).ToListAsync(ct);

        var now = DateTime.UtcNow;
        var changed = false;

        foreach (var item in playerAchievements)
        {
            item.Pa.CurrentProgress = Math.Min(item.Def.TargetValue, item.Pa.CurrentProgress + increment);
            if (item.Pa.CurrentProgress >= item.Def.TargetValue)
            {
                item.Pa.IsCompleted = true;
                item.Pa.CompletedAt = now;
            }
            item.Pa.UpdatedAt = now;
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>
    /// 更新连胜类成就进度。获胜时连胜 +1，未获胜时连胜中断清零。
    /// </summary>
    public async Task UpdateStreakProgressAsync(
        long playerId,
        bool won,
        CancellationToken ct = default)
    {
        await EnsurePlayerAchievementsAsync(playerId, ct);

        var playerAchievements = await (
            from pa in db.PlayerAchievements.Where(x => x.PlayerId == playerId && !x.IsCompleted)
            join def in db.AchievementDefinitions on pa.AchievementId equals def.Id
            where def.IsEnabled && def.Category == "STREAK"
            select new { Pa = pa, Def = def }
        ).ToListAsync(ct);

        var now = DateTime.UtcNow;
        var changed = false;

        foreach (var item in playerAchievements)
        {
            if (won)
            {
                item.Pa.CurrentProgress = Math.Min(item.Def.TargetValue, item.Pa.CurrentProgress + 1);
                if (item.Pa.CurrentProgress >= item.Def.TargetValue)
                {
                    item.Pa.IsCompleted = true;
                    item.Pa.CompletedAt = now;
                }
            }
            else
            {
                // 本轮未押中冠军，连胜中断归零
                item.Pa.CurrentProgress = 0;
            }

            item.Pa.UpdatedAt = now;
            changed = true;
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }
    }

    /// <summary>领取成就奖励，同事务发放金币并保持幂等性。</summary>
    public async Task<AchievementClaimResponse> ClaimAsync(
        long playerId,
        long playerAchievementId,
        ClaimAchievementRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var existingClaim = await db.PlayerAchievements
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, ct);

        if (existingClaim is not null)
        {
            if (existingClaim.PlayerId != playerId || existingClaim.Id != playerAchievementId)
            {
                throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
            }

            var balance = (await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct))?.Balance ?? 0m;
            var def = await db.AchievementDefinitions.AsNoTracking().FirstAsync(x => x.Id == existingClaim.AchievementId, ct);
            return new AchievementClaimResponse(
                existingClaim.Id,
                existingClaim.AchievementId,
                def.AchievementCode,
                def.RewardType,
                ParseRewardAmount(def.RewardPayload),
                balance,
                DateTime.UtcNow);
        }

        var pa = await db.PlayerAchievements
            .FirstOrDefaultAsync(x => x.Id == playerAchievementId && x.PlayerId == playerId, ct)
            ?? throw new BusinessRuleException("ACHIEVEMENT_NOT_FOUND", "成就记录不存在");

        if (!pa.IsCompleted)
        {
            throw new BusinessRuleException("ACHIEVEMENT_NOT_COMPLETED", "成就尚未达成");
        }

        if (pa.IsClaimed)
        {
            throw new BusinessRuleException("ACHIEVEMENT_ALREADY_CLAIMED", "成就奖励已领取");
        }

        var definition = await db.AchievementDefinitions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == pa.AchievementId, ct)
            ?? throw new BusinessRuleException("ACHIEVEMENT_DEFINITION_NOT_FOUND", "成就定义不存在");

        var amount = ParseRewardAmount(definition.RewardPayload);
        var now = DateTime.UtcNow;

        // 锁钱包行并发发放
        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance + amount);
        wallet.Version++;
        wallet.UpdatedAt = now;

        var txEntry = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "ACHIEVEMENT_REWARD",
            Amount = amount,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            ReferenceType = "ACHIEVEMENT",
            ReferenceId = pa.Id.ToString(),
            IdempotencyKey = $"wallet:achv:{pa.Id}",
            CreatedAt = now,
        };
        db.WalletTransactions.Add(txEntry);
        await db.SaveChangesAsync(ct);

        pa.IsClaimed = true;
        pa.ClaimedAt = now;
        pa.WalletTransactionId = txEntry.Id;
        pa.IdempotencyKey = request.IdempotencyKey;
        pa.UpdatedAt = now;

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "uq_player_achievements_idempotency_key"))
        {
            await tx.RollbackAsync(ct);
            return await HandleClaimConflictAsync(playerId, playerAchievementId, request, ct);
        }

        return new AchievementClaimResponse(
            pa.Id,
            pa.AchievementId,
            definition.AchievementCode,
            definition.RewardType,
            amount,
            wallet.Balance,
            now);
    }

    private async Task<AchievementClaimResponse> HandleClaimConflictAsync(
        long playerId,
        long playerAchievementId,
        ClaimAchievementRequest request,
        CancellationToken ct)
    {
        var existingClaim = await db.PlayerAchievements
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, ct)
            ?? throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等领奖已被处理，但无法重新读取记录");

        if (existingClaim.PlayerId != playerId || existingClaim.Id != playerAchievementId)
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
        }

        var balance = (await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct))?.Balance ?? 0m;
        var def = await db.AchievementDefinitions.AsNoTracking().FirstAsync(x => x.Id == existingClaim.AchievementId, ct);
        return new AchievementClaimResponse(
            existingClaim.Id,
            existingClaim.AchievementId,
            def.AchievementCode,
            def.RewardType,
            ParseRewardAmount(def.RewardPayload),
            balance,
            DateTime.UtcNow);
    }

    /// <summary>为玩家补齐未初始化的成就记录。</summary>
    public async Task EnsurePlayerAchievementsAsync(long playerId, CancellationToken ct = default)
    {
        var activeDefs = await db.AchievementDefinitions
            .AsNoTracking()
            .Where(x => x.IsEnabled)
            .ToListAsync(ct);

        var existingIds = (await db.PlayerAchievements
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .Select(x => x.AchievementId)
            .ToListAsync(ct)).ToHashSet();

        var missing = activeDefs.Where(x => !existingIds.Contains(x.Id)).ToList();
        if (missing.Count == 0) return;

        var now = DateTime.UtcNow;
        foreach (var def in missing)
        {
            db.PlayerAchievements.Add(new PlayerAchievement
            {
                PlayerId = playerId,
                AchievementId = def.Id,
                CurrentProgress = 0,
                IsCompleted = false,
                IsClaimed = false,
                CreatedAt = now,
                UpdatedAt = now,
            });
        }

        try
        {
            await db.SaveChangesAsync(ct);
        }
        catch (DbUpdateException)
        {
            // 并发初始化幂等忽略
        }
    }

    private static decimal ParseRewardAmount(string? json)
    {
        if (string.IsNullOrWhiteSpace(json)) return 0m;
        try
        {
            using var doc = JsonDocument.Parse(json);
            if (doc.RootElement.TryGetProperty("amount", out var amt) && amt.TryGetDecimal(out var val))
            {
                return val;
            }
        }
        catch
        {
            // ignore
        }
        return 0m;
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex, string? constraintName = null)
    {
        for (Exception? current = ex; current is not null; current = current.InnerException)
        {
            if (current.Message.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
                current.Message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(constraintName) || current.Message.Contains(constraintName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }
        return false;
    }
}

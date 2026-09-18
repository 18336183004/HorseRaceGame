using System.Data;
using System.Security.Cryptography;
using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Abstractions;
using RaceGame.Application.Common;
using RaceGame.Domain.Entities;

namespace RaceGame.Application.Referrals;

/// <summary>推荐返佣明细视图 DTO。</summary>
public sealed record ReferralRewardDto(
    long Id,
    long ReferrerPlayerId,
    long InvitedPlayerId,
    string InvitedNickname,
    string RewardType,
    decimal Amount,
    string Status,
    DateTime CreatedAt);

/// <summary>玩家推荐裂变概览 DTO。</summary>
public sealed record ReferralSummaryDto(
    string InviteCode,
    long? ReferredByPlayerId,
    int InvitedCount,
    decimal TotalRewardAmount,
    decimal UnclaimedCommissionAmount,
    decimal TotalClaimedCommissionAmount,
    string CommissionRateDescription,
    IReadOnlyList<ReferralRewardDto> RecentRewards);

/// <summary>绑定推荐人请求。</summary>
public sealed record BindReferralRequest(string InviteCode, string IdempotencyKey);

/// <summary>绑定推荐人响应。</summary>
public sealed record BindReferralResponse(
    bool Success,
    decimal NoviceBonus,
    decimal NewBalance,
    string ReferrerNickname);

/// <summary>提炼领取佣金请求。</summary>
public sealed record ClaimCommissionRequest(string IdempotencyKey);

/// <summary>提炼领取佣金响应。</summary>
public sealed record ClaimCommissionResponse(
    bool Success,
    decimal ClaimedAmount,
    decimal NewBalance,
    DateTime ServerTime);

/// <summary>
/// 编排玩家专属邀请码生成、好友绑定与裂变返佣（对应 1.png 邀请体系）。
/// </summary>
public sealed class PlayerReferralService(IGameDbContext db)
{
    private const decimal NoviceStarterBonus = 200m;
    private const decimal ReferrerBonus = 100m;

    /// <summary>获取指定玩家的裂变邀请概览与近况记录。</summary>
    public async Task<ReferralSummaryDto> GetReferralSummaryAsync(long playerId, CancellationToken ct = default)
    {
        var player = await db.Players.FirstOrDefaultAsync(x => x.Id == playerId, ct)
            ?? throw new BusinessRuleException("PLAYER_NOT_FOUND", "玩家不存在");

        if (string.IsNullOrWhiteSpace(player.InviteCode))
        {
            player.InviteCode = await GenerateUniqueInviteCodeAsync(ct);
            player.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(ct);
        }

        var invitedCount = await db.Players
            .AsNoTracking()
            .CountAsync(x => x.ReferredByPlayerId == playerId, ct);

        var rewards = await (
            from r in db.PlayerReferralRewards.AsNoTracking().Where(x => x.ReferrerPlayerId == playerId)
            join invited in db.Players.AsNoTracking() on r.InvitedPlayerId equals invited.Id
            orderby r.Id descending
            select new ReferralRewardDto(
                r.Id,
                r.ReferrerPlayerId,
                r.InvitedPlayerId,
                invited.Nickname,
                r.RewardType,
                r.Amount,
                r.Status,
                r.CreatedAt)
        ).Take(20).ToListAsync(ct);

        var totalRewardAmount = await db.PlayerReferralRewards
            .AsNoTracking()
            .Where(x => x.ReferrerPlayerId == playerId && (x.Status == "GRANTED" || x.Status == "CLAIMED"))
            .SumAsync(x => x.Amount, ct);

        var unclaimedCommissionAmount = await db.PlayerReferralRewards
            .AsNoTracking()
            .Where(x => x.ReferrerPlayerId == playerId && x.Status == "UNCLAIMED")
            .SumAsync(x => x.Amount, ct);

        var totalClaimedCommissionAmount = await db.PlayerReferralRewards
            .AsNoTracking()
            .Where(x => x.ReferrerPlayerId == playerId && x.Status == "CLAIMED")
            .SumAsync(x => x.Amount, ct);

        return new ReferralSummaryDto(
            player.InviteCode,
            player.ReferredByPlayerId,
            invitedCount,
            totalRewardAmount,
            unclaimedCommissionAmount,
            totalClaimedCommissionAmount,
            "下级负盈利 0.2% + 规费比例",
            rewards);
    }

    /// <summary>绑定推荐人邀请码并同事务向双方发放新手与推荐礼包。</summary>
    public async Task<BindReferralResponse> BindReferralAsync(
        long playerId,
        BindReferralRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.InviteCode))
        {
            throw new BusinessRuleException("INVITE_CODE_REQUIRED", "邀请码不能为空");
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }

        var normalizedCode = request.InviteCode.Trim().ToUpperInvariant();

        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // 幂等性复核
        var existingReward = await db.PlayerReferralRewards
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, ct);

        if (existingReward is not null)
        {
            var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
            var referrer = await db.Players.AsNoTracking().FirstOrDefaultAsync(x => x.Id == existingReward.ReferrerPlayerId, ct);
            return new BindReferralResponse(
                true,
                NoviceStarterBonus,
                wallet?.Balance ?? 0m,
                referrer?.Nickname ?? "好友");
        }

        var player = await db.Players.FirstOrDefaultAsync(x => x.Id == playerId, ct)
            ?? throw new BusinessRuleException("PLAYER_NOT_FOUND", "玩家不存在");

        if (player.ReferredByPlayerId.HasValue)
        {
            throw new BusinessRuleException("ALREADY_REFERRED", "您已绑定过邀请人，无法重复绑定");
        }

        var referrerPlayer = await db.Players
            .FirstOrDefaultAsync(x => x.InviteCode == normalizedCode, ct)
            ?? throw new BusinessRuleException("INVITE_CODE_NOT_FOUND", "邀请码无效或不存在");

        if (referrerPlayer.Id == playerId)
        {
            throw new BusinessRuleException("CANNOT_REFER_SELF", "不能绑定自己的邀请码");
        }

        var now = DateTime.UtcNow;
        player.ReferredByPlayerId = referrerPlayer.Id;
        player.UpdatedAt = now;

        // 严格按照玩家 ID 升序依次获取行级锁，彻底消除并发场景下的循环等待死锁
        var firstLockId = Math.Min(playerId, referrerPlayer.Id);
        var secondLockId = Math.Max(playerId, referrerPlayer.Id);

        var firstWallet = await WalletConcurrency.LockAsync(db, firstLockId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", $"玩家 {firstLockId} 钱包不存在");
        var secondWallet = await WalletConcurrency.LockAsync(db, secondLockId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", $"玩家 {secondLockId} 钱包不存在");

        var playerWallet = playerId == firstLockId ? firstWallet : secondWallet;
        var referrerWallet = referrerPlayer.Id == firstLockId ? firstWallet : secondWallet;

        // 1. 发放受邀人新手礼包
        var pBefore = playerWallet.Balance;
        playerWallet.Balance = MoneyMath.Round(playerWallet.Balance + NoviceStarterBonus);
        playerWallet.Version++;
        playerWallet.UpdatedAt = now;

        var noviceTx = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "REFERRAL_NOVICE_BONUS",
            Amount = NoviceStarterBonus,
            BalanceBefore = pBefore,
            BalanceAfter = playerWallet.Balance,
            ReferenceType = "REFERRAL",
            ReferenceId = referrerPlayer.Id.ToString(),
            IdempotencyKey = $"novice:{request.IdempotencyKey}",
            CreatedAt = now,
        };
        db.WalletTransactions.Add(noviceTx);

        // 2. 发放推荐人返佣奖励
        var rBefore = referrerWallet.Balance;
        referrerWallet.Balance = MoneyMath.Round(referrerWallet.Balance + ReferrerBonus);
        referrerWallet.Version++;
        referrerWallet.UpdatedAt = now;

        var referrerTx = new WalletTransaction
        {
            PlayerId = referrerPlayer.Id,
            TransactionType = "REFERRAL_INVITE_REWARD",
            Amount = ReferrerBonus,
            BalanceBefore = rBefore,
            BalanceAfter = referrerWallet.Balance,
            ReferenceType = "REFERRAL",
            ReferenceId = playerId.ToString(),
            IdempotencyKey = $"referrer:{request.IdempotencyKey}",
            CreatedAt = now,
        };
        db.WalletTransactions.Add(referrerTx);
        await db.SaveChangesAsync(ct);

        db.PlayerReferralRewards.Add(new PlayerReferralReward
        {
            ReferrerPlayerId = referrerPlayer.Id,
            InvitedPlayerId = playerId,
            RewardType = "INVITE_STARTER",
            Amount = ReferrerBonus,
            Status = "GRANTED",
            WalletTransactionId = referrerTx.Id,
            IdempotencyKey = request.IdempotencyKey,
            CreatedAt = now,
            UpdatedAt = now,
        });

        try
        {
            await db.SaveChangesAsync(ct);
            await tx.CommitAsync(ct);

            return new BindReferralResponse(
                true,
                NoviceStarterBonus,
                playerWallet.Balance,
                referrerPlayer.Nickname);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "uq_player_referral_rewards_idempotency"))
        {
            await tx.RollbackAsync(ct);
            return await HandleIdempotentConflictAsync(playerId, referrerPlayer.Nickname, ct);
        }
    }

    private async Task<BindReferralResponse> HandleIdempotentConflictAsync(long playerId, string fallbackNickname, CancellationToken ct)
    {
        var wallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
        return new BindReferralResponse(
            true,
            NoviceStarterBonus,
            wallet?.Balance ?? 0m,
            fallbackNickname);
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

    /// <summary>主动提炼并领取所有未结佣金至钱包余额。</summary>
    public async Task<ClaimCommissionResponse> ClaimCommissionAsync(
        long playerId,
        ClaimCommissionRequest request,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }

        var utcNow = DateTime.UtcNow;
        await using var tx = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // 幂等防重：检查是否已有相同 idempotencyKey 的佣金领取流水
        var existingTx = await db.WalletTransactions
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId && x.IdempotencyKey == request.IdempotencyKey, ct);

        if (existingTx is not null)
        {
            var currentWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
            return new ClaimCommissionResponse(true, existingTx.Amount, currentWallet?.Balance ?? 0m, utcNow);
        }

        var unclaimedRewards = await db.PlayerReferralRewards
            .Where(x => x.ReferrerPlayerId == playerId && x.Status == "UNCLAIMED")
            .ToListAsync(ct);

        if (unclaimedRewards.Count == 0)
        {
            throw new BusinessRuleException("NO_UNCLAIMED_COMMISSIONS", "暂无可提炼的未结佣金");
        }

        var totalClaimAmount = MoneyMath.Round(unclaimedRewards.Sum(x => x.Amount));
        if (totalClaimAmount <= 0)
        {
            throw new BusinessRuleException("INVALID_CLAIM_AMOUNT", "未结佣金金额无效");
        }

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        var beforeBalance = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance + totalClaimAmount);
        wallet.Version++;
        wallet.UpdatedAt = utcNow;

        var walletTx = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "COMMISSION_CLAIM",
            Amount = totalClaimAmount,
            BalanceBefore = beforeBalance,
            BalanceAfter = wallet.Balance,
            ReferenceType = "PLAYER_REFERRAL",
            ReferenceId = string.Join(",", unclaimedRewards.Take(5).Select(x => x.Id)),
            IdempotencyKey = request.IdempotencyKey,
            CreatedAt = utcNow,
        };
        db.WalletTransactions.Add(walletTx);
        await db.SaveChangesAsync(ct);

        foreach (var reward in unclaimedRewards)
        {
            reward.Status = "CLAIMED";
            reward.ClaimedAt = utcNow;
            reward.ClaimTransactionId = walletTx.Id;
            reward.UpdatedAt = utcNow;
        }

        await db.SaveChangesAsync(ct);
        await tx.CommitAsync(ct);

        return new ClaimCommissionResponse(true, totalClaimAmount, wallet.Balance, utcNow);
    }

    /// <summary>生成唯一短邀请码（RG + 4位大写字母/数字）。</summary>
    public async Task<string> GenerateUniqueInviteCodeAsync(CancellationToken ct = default)
    {
        const string chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
        for (var attempt = 0; attempt < 10; attempt++)
        {
            var buffer = new char[6];
            buffer[0] = 'R';
            buffer[1] = 'G';
            var bytes = RandomNumberGenerator.GetBytes(4);
            for (var i = 0; i < 4; i++)
            {
                buffer[i + 2] = chars[bytes[i] % chars.Length];
            }
            var code = new string(buffer);
            var exists = await db.Players.AnyAsync(x => x.InviteCode == code, ct);
            if (!exists)
            {
                return code;
            }
        }
        return "RG" + Random.Shared.Next(100000, 999999);
    }
}

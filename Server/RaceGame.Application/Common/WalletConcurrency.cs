using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Entities;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Common;

/// <summary>PostgreSQL 行级钱包锁。所有余额变更事务必须先按此方法锁定钱包行。</summary>
public static class WalletConcurrency
{
    public static Task<Wallet?> LockAsync(
        IGameDbContext db,
        long playerId,
        CancellationToken cancellationToken = default)
        => db.Wallets
            .FromSqlInterpolated($"SELECT * FROM wallets WHERE player_id = {playerId} FOR UPDATE")
            .SingleOrDefaultAsync(cancellationToken);

    /// <summary>
    /// 原子冻结可用余额至冻结余额 (如拍卖行竞价保证金)。
    /// </summary>
    public static async Task FreezeAsync(
        IGameDbContext db,
        Wallet wallet,
        decimal amount,
        string transactionType,
        string referenceType,
        string referenceId,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        if (amount <= 0m) throw new BusinessRuleException("WALLET_INVALID_AMOUNT", "冻结金额必须大于 0");
        if (wallet.Balance < amount) throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", "可用余额不足，资金冻结失败");

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - amount);
        wallet.FrozenBalance = MoneyMath.Round(wallet.FrozenBalance + amount);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = wallet.PlayerId,
            TransactionType = transactionType,
            Amount = -amount,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// 原子解冻资金并归还至可用余额 (如拍卖行竞价被超越)。
    /// </summary>
    public static async Task UnfreezeAsync(
        IGameDbContext db,
        Wallet wallet,
        decimal amount,
        string transactionType,
        string referenceType,
        string referenceId,
        string idempotencyKey,
        CancellationToken ct = default)
    {
        if (amount <= 0m) throw new BusinessRuleException("WALLET_INVALID_AMOUNT", "解冻金额必须大于 0");
        if (wallet.FrozenBalance < amount) throw new BusinessRuleException("WALLET_FROZEN_FAILED", "冻结资金不足，解冻失败");

        var before = wallet.Balance;
        wallet.FrozenBalance = MoneyMath.Round(wallet.FrozenBalance - amount);
        wallet.Balance = MoneyMath.Round(wallet.Balance + amount);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = wallet.PlayerId,
            TransactionType = transactionType,
            Amount = amount,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = referenceType,
            ReferenceId = referenceId,
            IdempotencyKey = idempotencyKey,
            CreatedAt = DateTime.UtcNow
        });
    }
}


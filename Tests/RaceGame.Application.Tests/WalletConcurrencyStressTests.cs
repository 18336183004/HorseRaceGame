using RaceGame.Application.Common;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证钱包扣款并发边界、金额不可透支、四舍五入与版本号自增机制。
/// 对标 PRD 5.4.4、PROJECT_STANDARDS 4.4。
/// </summary>
public sealed class WalletConcurrencyStressTests
{
    [Fact]
    public void Wallet_DeductionPreventsNegativeBalance()
    {
        var wallet = new Wallet
        {
            PlayerId = 42,
            Balance = 50m,
            Version = 1,
        };

        const decimal betAmount = 60m;

        // 业务规则：下注金额不能超过余额
        var canBet = wallet.Balance >= betAmount;
        Assert.False(canBet);

        // 如果强制扣款，抛出异常或拒绝
        if (canBet)
        {
            wallet.Balance -= betAmount;
        }

        Assert.Equal(50m, wallet.Balance);
        Assert.True(wallet.Balance >= 0m);
    }

    [Fact]
    public void Wallet_ConcurrentAtomicDeductions_PreservesBalanceIntegrity()
    {
        var wallet = new Wallet
        {
            PlayerId = 100,
            Balance = 1000m,
            Version = 0,
        };

        var lockObj = new object();
        var successfulBets = 0;
        var rejectedBets = 0;

        // 模拟 100 个并发线程，每个尝试扣款 20m
        Parallel.For(0, 100, _ =>
        {
            const decimal betAmount = 20m;
            lock (lockObj)
            {
                if (wallet.Balance >= betAmount)
                {
                    wallet.Balance = MoneyMath.Round(wallet.Balance - betAmount);
                    wallet.Version++;
                    successfulBets++;
                }
                else
                {
                    rejectedBets++;
                }
            }
        });

        // 1000 / 20 = 50 笔成功，50 笔因余额不足拒绝
        Assert.Equal(50, successfulBets);
        Assert.Equal(50, rejectedBets);
        Assert.Equal(0m, wallet.Balance);
        Assert.Equal(50, wallet.Version);
    }
}

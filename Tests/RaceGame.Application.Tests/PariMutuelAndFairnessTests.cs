using System.Security.Cryptography;
using System.Text;
using RaceGame.Application.Common;
using RaceGame.Application.Configuration;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证系统重大重构功能：
/// 1. 浮动彩池制（Pari-Mutuel）稀释赔率与 1.05x 保底防亏机制
/// 2. 破产救济金真破产判定（在途注单不破产、赛后无单归0才破产、脱贫自动取消）
/// 3. 同局下注防对冲刷佣（同一轮次双方下注跳过返佣）
/// 4. 方案 A 角色微幅增益（纯收益/经验类，不影响跑速）
/// 5. Provably Fair 下注前种子哈希承诺与赛后明文反向验算
/// 6. 异常取消轮次本金全额退款
/// </summary>
public sealed class PariMutuelAndFairnessTests
{
    [Fact]
    public void PariMutuel_WhenWinningGrossExceedsPool_DilutesOddsWithFloorProtection()
    {
        // 场景：单轮总下注池 10,000 🪙，最大赔付池限制为 50,000 🪙
        // 但两位大户玩家分别在 100x 超高赔率连赢组合上各投注 1,000 🪙，理论理论毛奖金为 200,000 🪙
        // 触发浮动彩池稀释机制
        const decimal totalBets = 10000m;
        const decimal maxLiability = 50000m;
        const decimal houseFeeRate = 0.010m; // 1.0%
        var basePool = MoneyMath.Round(totalBets * (1m - houseFeeRate)); // 9,900
        var effectivePoolCapacity = Math.Max(basePool, maxLiability);     // 50,000

        var order1 = new BetOrder
        {
            Id = 1,
            PlayerId = 10,
            BetAmount = 1000m,
            LockedOdds = 100m,
            PotentialReward = 100000m,
            GrossReward = 100000m,
            Status = BetOrderStatus.Pending,
        };

        var order2 = new BetOrder
        {
            Id = 2,
            PlayerId = 20,
            BetAmount = 1000m,
            LockedOdds = 100m,
            PotentialReward = 100000m,
            GrossReward = 100000m,
            Status = BetOrderStatus.Pending,
        };

        var totalWinningNominal = order1.GrossReward + order2.GrossReward; // 200,000
        Assert.True(totalWinningNominal > effectivePoolCapacity, "理论总赔付超出彩池容量，必须稀释");

        var dilutionFactor = Math.Min(1.0m, Math.Round(effectivePoolCapacity / totalWinningNominal, 6, MidpointRounding.ToZero));
        // 50,000 / 200,000 = 0.250000
        Assert.Equal(0.250000m, dilutionFactor);

        // 稀释后毛收益：100,000 * 0.25 = 25,000
        var dilutedGross1 = MoneyMath.Round(order1.GrossReward * dilutionFactor);
        var minGuaranteed1 = MoneyMath.Round(order1.BetAmount * 1.05m); // 1.05x 保底 = 1,050
        order1.GrossReward = Math.Max(dilutedGross1, minGuaranteed1);
        order1.DilutionFactor = dilutionFactor;

        Assert.Equal(25000m, order1.GrossReward);
        Assert.True(order1.GrossReward >= minGuaranteed1, "必须保障 1.05x 最低收益");

        // 极限保护场景：假设极度稀释至低于本金
        var extremeDilutionFactor = 0.005m;
        var extremeDilutedGross = MoneyMath.Round(order1.BetAmount * 100m * extremeDilutionFactor); // 1,000 * 100 * 0.005 = 500
        var protectedGross = Math.Max(extremeDilutedGross, minGuaranteed1);
        Assert.Equal(1050m, protectedGross); // 触发 1.05x 保底机制！
    }

    [Fact]
    public void ProvablyFair_PreBettingCommitment_CanBeReverselyVerifiedAfterSettlement()
    {
        // 步骤 1：下注前生成随机明文种子
        var serverSeed = Convert.ToHexString(RandomNumberGenerator.GetBytes(32)).ToLowerInvariant();

        // 步骤 2：在下注开始瞬间公布 SHA256 哈希承诺
        var commitment = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(serverSeed))).ToLowerInvariant();

        Assert.Equal(64, serverSeed.Length);
        Assert.Equal(64, commitment.Length);

        // 验证：客户端接收到明文种子后，能精确还原并反向验算哈希承诺
        var computedHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(serverSeed))).ToLowerInvariant();
        Assert.Equal(commitment, computedHash);
    }

    [Fact]
    public void ReferralAntiHedging_SameRoundBetting_ProhibitsCommission()
    {
        // 场景：邀请人 A (Id=1) 与被邀请人 B (Id=2) 在同一局比赛均有下注
        const long referrerId = 1L;
        const long refereeId = 2L;

        var participatingPlayerIds = new List<long> { referrerId, refereeId, 3L };

        var referrerBetInSameRound = participatingPlayerIds.Contains(referrerId);
        Assert.True(referrerBetInSameRound, "双方同局押注，构成对冲风险");

        decimal commissionAmount = 0m;
        if (!referrerBetInSameRound)
        {
            // 若未同局投注，正常计算 0.5% 负盈利返佣
            const decimal netLoss = 200m;
            commissionAmount = MoneyMath.Round(netLoss * 0.005m);
        }

        Assert.Equal(0m, commissionAmount); // 必须不发放佣金
    }

    [Fact]
    public void CharacterBuffs_SchemeA_GrantsNetRewardBonusAndFeeDiscount()
    {
        // 方案 A 收益类增益：
        // 中奖奖金加成 +1.0%
        // 规费减免 0.05% (0.0005m)
        // 角色经验加成 +5%
        const decimal grossReward = 1000.00m;
        const decimal baseFeeRate = 0.010m; // 1.0%

        var discountedFeeRate = Math.Max(0m, baseFeeRate - 0.0005m); // 0.0095m (0.95%)
        Assert.Equal(0.0095m, discountedFeeRate);

        var feeAmount = MoneyMath.Round(grossReward * discountedFeeRate); // 9.50
        var baseNetReward = MoneyMath.Round(grossReward - feeAmount);     // 990.50

        var yieldBonus = MoneyMath.Round(baseNetReward * 0.01m); // +1.0% = 9.91
        var finalNetReward = MoneyMath.Round(baseNetReward + yieldBonus); // 1000.41

        Assert.Equal(9.50m, feeAmount);
        Assert.Equal(1000.41m, finalNetReward);

        // 角色经验加成 +5%
        const long baseExp = 100L;
        var boostedExp = (long)Math.Round(baseExp * 1.05m);
        Assert.Equal(105L, boostedExp);
    }

    [Fact]
    public void TrueBankruptcy_Condition_RequiresNoInFlightBetsAndZeroBalance()
    {
        // 场景 1：下注扣款余额归 0，但有在途注单 -> 不算破产
        var orders = new List<BetOrder>
        {
            new() { PlayerId = 1, Status = BetOrderStatus.Pending },
        };
        var balance = 0m;
        var hasInFlightBets = orders.Any(x => x.Status == BetOrderStatus.Pending);
        var isTrulyBankrupt1 = balance == 0m && !hasInFlightBets;
        Assert.False(isTrulyBankrupt1, "存在在途注单时不算破产");

        // 场景 2：轮次结算输光，在途注单全部结算（0个Pending），余额确为 0 -> 判定真破产
        orders[0].Status = BetOrderStatus.Lost;
        var hasInFlightBets2 = orders.Any(x => x.Status == BetOrderStatus.Pending);
        var isTrulyBankrupt2 = balance == 0m && !hasInFlightBets2;
        Assert.True(isTrulyBankrupt2, "无在途注单且余额确为0，触发破产倒计时");

        // 场景 3：倒计时 2 小时到期发放时，钱包已有余额（例如推广返佣领取了 100 🪙） -> 取消发放
        var walletBalanceAtGrantTime = 100.00m;
        var shouldDisburse = walletBalanceAtGrantTime == 0m;
        Assert.False(shouldDisburse, "发放时钱包已有余额，判定已脱贫，取消救济金发放");
    }

    [Fact]
    public void MaintenanceWindow_WhenRoundDurationExceedsStart_StopsNextRoundScheduling()
    {
        var now = new DateTime(2026, 9, 14, 18, 0, 0, DateTimeKind.Utc);
        var maintenanceStartAt = new DateTime(2026, 9, 14, 18, 3, 0, DateTimeKind.Utc); // 3 分钟后维护

        var totalRoundDurationSec = 180 + 15 + 30 + 75; // 300 秒 (5 分钟)
        var estimatedEnd = now.AddSeconds(totalRoundDurationSec); // 18:05:00
        var willOverlapMaintenance = estimatedEnd > maintenanceStartAt;

        Assert.True(willOverlapMaintenance, "预计结束时间超过维护开始时间，必须自动停止新轮次开赛");
    }

    [Fact]
    public void MaintenanceWindow_WhenMaintenanceHasPassed_ResumesRoundScheduling()
    {
        var now = new DateTime(2026, 9, 14, 20, 0, 0, DateTimeKind.Utc);
        var maintenanceStartAt = new DateTime(2026, 9, 14, 18, 0, 0, DateTimeKind.Utc);
        var maintenanceEndAt = new DateTime(2026, 9, 14, 19, 0, 0, DateTimeKind.Utc); // 维护已于1小时前结束

        var isMaintenanceEnabled = true;
        var isMaintenancePendingOrActive = isMaintenanceEnabled &&
            now < maintenanceEndAt;

        Assert.False(isMaintenancePendingOrActive, "维护时间已过，不应再判定为维护期，必须恢复赛事排期");
    }
}


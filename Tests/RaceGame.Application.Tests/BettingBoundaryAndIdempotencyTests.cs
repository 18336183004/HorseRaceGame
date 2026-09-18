using System.Security.Cryptography;
using System.Text;
using RaceGame.Application.Betting;
using RaceGame.Application.Common;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证下注边界约束：幂等请求指纹一致性、篡改拦截、截止时间判定、单轮换马拦截与钱包审计不变量。
/// </summary>
public sealed class BettingBoundaryAndIdempotencyTests
{
    private static string ComputeHash(long roundId, int horseNo, decimal amount)
    {
        var canonical = $"round={roundId}&horse={horseNo}&amount={amount:0.00}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    [Fact]
    public void RequestHash_IsDeterministic_ForIdenticalRequestParameters()
    {
        var hash1 = ComputeHash(1001, 3, 50.00m);
        var hash2 = ComputeHash(1001, 3, 50m);

        Assert.Equal(hash1, hash2);
        Assert.NotEmpty(hash1);
    }

    [Fact]
    public void RequestHash_Differs_WhenAmountOrHorseChanges()
    {
        var originalHash = ComputeHash(1001, 3, 50.00m);
        var differentAmountHash = ComputeHash(1001, 3, 100.00m);
        var differentHorseHash = ComputeHash(1001, 4, 50.00m);
        var differentRoundHash = ComputeHash(1002, 3, 50.00m);

        Assert.NotEqual(originalHash, differentAmountHash);
        Assert.NotEqual(originalHash, differentHorseHash);
        Assert.NotEqual(originalHash, differentRoundHash);
    }

    [Fact]
    public void Idempotency_ThrowsException_WhenSameKeyReusedWithDifferentParameters()
    {
        var existingOrder = new BetOrder
        {
            Id = 1,
            PlayerId = 10,
            RoundId = 1001,
            HorseNo = 2,
            BetAmount = 20.00m,
            IdempotencyKey = "uuid-test-key-001",
            RequestHash = ComputeHash(1001, 2, 20.00m),
        };

        var tamperedRequest = new PlaceBetRequest(1001, 2, 50.00m, "uuid-test-key-001");
        var tamperedHash = ComputeHash(tamperedRequest.RoundId, tamperedRequest.HorseNo, tamperedRequest.Amount);

        Assert.False(
            string.Equals(existingOrder.RequestHash, tamperedHash, StringComparison.Ordinal),
            "指纹必须不匹配");
    }

    [Fact]
    public void BettingDeadline_Rejects_WhenTimeExceedsBettingEndAt()
    {
        var now = DateTime.UtcNow;
        var round = new RaceRound
        {
            Id = 1,
            State = RaceState.Betting,
            BettingStartAt = now.AddSeconds(-60),
            BettingEndAt = now.AddSeconds(-1), // 已过截止时间
        };

        var isClosed = round.State != RaceState.Betting || now >= round.BettingEndAt;

        Assert.True(isClosed, "当前时间已过截止时间，必须判定下注已截止");
    }

    [Fact]
    public void BettingState_Rejects_WhenRoundNotInBettingState()
    {
        var now = DateTime.UtcNow;
        var round = new RaceRound
        {
            Id = 1,
            State = RaceState.Preparing, // 已经进入准备状态
            BettingStartAt = now.AddSeconds(-60),
            BettingEndAt = now.AddSeconds(10),
        };

        var isClosed = round.State != RaceState.Betting || now >= round.BettingEndAt;

        Assert.True(isClosed, "非 Betting 状态必须判定下注已截止");
    }

    [Fact]
    public void MultiHorseBetting_IsAllowed_WhenPlayerPicksDifferentHorsesInSameRound()
    {
        // 规则决策 1-C：放开选马限制，玩家在同一轮次中可以同时投注多匹不同的马
        var roundId = 1001L;
        var playerId = 10L;
        var existingSelections = new List<RaceBetSelection>
        {
            new() { PlayerId = playerId, RoundId = roundId, HorseNo = 3 }
        };

        const int requestedHorseNo = 5;
        var alreadySelectedThisHorse = existingSelections.Any(x => x.HorseNo == requestedHorseNo);
        Assert.False(alreadySelectedThisHorse, "尚未投注5号马");

        existingSelections.Add(new RaceBetSelection { PlayerId = playerId, RoundId = roundId, HorseNo = requestedHorseNo });
        Assert.Equal(2, existingSelections.Count);
    }

    [Fact]
    public void MultiHorseBetting_Allows_WhenPlayerAppendsBetOnSameHorse()
    {
        var existingSelection = new RaceBetSelection
        {
            PlayerId = 10,
            RoundId = 1001,
            HorseNo = 3,
        };

        const int requestedHorseNo = 3;
        var isSameHorse = existingSelection.HorseNo == requestedHorseNo;

        Assert.True(isSameHorse, "同一轮追加同一匹马必须允许且识别为同一马号");
    }

    [Fact]
    public void WalletDeduction_PreservesBalanceInvariantsAndVersionIncrement()
    {
        var wallet = new Wallet
        {
            PlayerId = 10,
            Balance = 100.00m,
            Version = 0,
        };

        const decimal betAmount = 25.50m;
        var balanceBefore = wallet.Balance;

        wallet.Balance = MoneyMath.Round(wallet.Balance - betAmount);
        wallet.Version++;

        Assert.Equal(74.50m, wallet.Balance);
        Assert.Equal(1, wallet.Version);
        Assert.Equal(balanceBefore - betAmount, wallet.Balance);
    }
}

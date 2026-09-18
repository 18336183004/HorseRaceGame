using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Audit;
using RaceGame.Application.Common;
using RaceGame.Application.Configuration;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Betting;

/// <summary>提交下注所需的明确输入契约。支持独赢(WIN)、连赢(QUINELLA)、位置(PLACE)、二连单(EXACTA)、扩连赢(QUINELLAPLACE)、三连碰(TRIO)与三连单(TRIFECTA)。</summary>
public sealed record PlaceBetRequest(
    long RoundId,
    int HorseNo,
    decimal Amount,
    string IdempotencyKey,
    string? PlayType = "WIN",
    int? SecondHorseNo = null,
    string? Combination = null,
    int? ThirdHorseNo = null);

/// <summary>局内 15 秒冲刺加倍追投请求契约。</summary>
public sealed record DoubleDownRequest(
    string OrderNo,
    string IdempotencyKey);

/// <summary>局内冲刺加倍追投响应结果契约。</summary>
public sealed record DoubleDownResponse(
    string OrderNo,
    decimal AdditionalDeducted,
    decimal NewTotalBet,
    decimal CurrentBalance);

/// <summary>下注成功或幂等重放时返回的订单、收益预估和余额。</summary>
public sealed record PlaceBetResponse(
    string OrderNo,
    long PlayerId,
    long RoundId,
    int HorseNo,
    decimal BetAmount,
    decimal LockedOdds,
    decimal GrossReward,
    decimal FeeRate,
    decimal FeeAmount,
    decimal NetReward,
    decimal Balance,
    DateTime ServerTime,
    string PlayType = "WIN",
    int? SecondHorseNo = null,
    string? Combination = null,
    int? ThirdHorseNo = null);

/// <summary>
/// 编排下注校验、选马约束、赔率锁定、钱包扣款和订单持久化。
/// 钱包、流水、订单与轮次汇总在同一事务中提交，钱包行通过 PostgreSQL FOR UPDATE 串行化。
/// </summary>
public sealed class BettingService(IGameDbContext db, RaceRuleConfigService ruleConfigService, GameLogService gameLogService)
{
    /// <summary>
    /// 为认证玩家创建一笔下注订单。
    /// 同一幂等键重试会返回原订单；支持同轮次多次下注不同马匹或连赢组合。
    /// </summary>
    public async Task<PlaceBetResponse> PlaceAsync(
        long playerId,
        PlaceBetRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request);
        var requestHash = ComputeRequestHash(request);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        var existingOrder = await db.BetOrders.FirstOrDefaultAsync(
            x => x.IdempotencyKey == request.IdempotencyKey,
            cancellationToken);

        if (existingOrder is not null)
        {
            if (existingOrder.PlayerId != playerId)
            {
                throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
            }

            if (!string.Equals(existingOrder.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new BusinessRuleException("IDEMPOTENCY_REQUEST_MISMATCH", "幂等键已被不同业务参数复用");
            }

            var existingWallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
                ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");
            var existingBalance = existingWallet.Balance;
            return MapResponse(existingOrder, existingBalance);
        }

        var utcNow = DateTime.UtcNow;
        var rules = await ruleConfigService.GetCurrentAsync(utcNow, cancellationToken);
        var round = await db.RaceRounds
            .Include(x => x.Horses)
            .FirstOrDefaultAsync(x => x.Id == request.RoundId, cancellationToken)
            ?? throw new BusinessRuleException("RACE_ROUND_NOT_FOUND", "轮次不存在");

        if (round.State != RaceState.Betting || utcNow >= round.BettingEndAt)
        {
            throw new BusinessRuleException("BETTING_CLOSED", "下注已截止");
        }

        if (request.Amount < rules.MinimumBetAmount)
        {
            throw new BusinessRuleException("BET_AMOUNT_BELOW_MINIMUM", $"投注金额不能低于最小投注额 {rules.MinimumBetAmount}");
        }

        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");

        if (wallet.Balance < request.Amount)
        {
            throw new BusinessRuleException("INSUFFICIENT_FUNDS", "钱包余额不足");
        }

        var playType = (request.PlayType ?? "WIN").Trim().ToUpperInvariant();
        var isQuinella = playType == "QUINELLA" ||
                         (!string.Equals(playType, "EXACTA", StringComparison.OrdinalIgnoreCase) &&
                          !string.Equals(playType, "PLACE", StringComparison.OrdinalIgnoreCase) &&
                          !string.Equals(playType, "QUINELLAPLACE", StringComparison.OrdinalIgnoreCase) &&
                          !string.Equals(playType, "TRIO", StringComparison.OrdinalIgnoreCase) &&
                          !string.Equals(playType, "TRIFECTA", StringComparison.OrdinalIgnoreCase) &&
                          (request.SecondHorseNo.HasValue || !string.IsNullOrWhiteSpace(request.Combination)));

        var isArcadePlayType = isQuinella || playType is "QUINELLA" or "EXACTA" or "PLACE" or "QUINELLAPLACE" or "TRIO" or "TRIFECTA";
        var requiredMinAmount = isArcadePlayType ? 5.00m : rules.MinimumBetAmount;
        if (request.Amount < requiredMinAmount)
        {
            throw new BusinessRuleException("BET_AMOUNT_BELOW_MINIMUM",
                isArcadePlayType ? "街机复合注式单注最低起投 5 金币" : $"投注金额不能低于最小投注额 {rules.MinimumBetAmount}");
        }

        int primaryHorse;
        int? secondHorse = null;
        int? thirdHorse = null;
        string? comboKey = null;
        decimal lockedOdds;

        if (playType == "PLACE")
        {
            if (request.HorseNo is < GameRuleDefaults.MinimumHorseNumber or > GameRuleDefaults.MaximumHorseNumber)
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "马号无效");
            }
            primaryHorse = request.HorseNo;
            var horse = round.Horses.SingleOrDefault(x => x.HorseNo == primaryHorse)
                ?? throw new BusinessRuleException("ROUND_HORSE_NOT_FOUND", "当前轮次不存在该马匹");
            // 位置赔率：从动态配置解析系数与边界
            var (placeCoeff, placeMin, placeMax) = rules.ResolvePlayTypeOddsCoeff("PLACE");
            lockedOdds = Math.Round(Math.Clamp(horse.Odds * placeCoeff, placeMin, placeMax), 2);
        }
        else if (playType == "QUINELLAPLACE")
        {
            int h1, h2;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length != 2 || !int.TryParse(parts[0], out h1) || !int.TryParse(parts[1], out h2))
                {
                    throw new BusinessRuleException("INVALID_COMBINATION", "位置连赢组合格式错误，应为类似 '1-2' 的格式");
                }
            }
            else if (request.SecondHorseNo.HasValue)
            {
                h1 = request.HorseNo;
                h2 = request.SecondHorseNo.Value;
            }
            else
            {
                throw new BusinessRuleException("SECOND_HORSE_REQUIRED", "位置连赢投注必须指定第二匹马");
            }

            if (h1 == h2 || h1 < GameRuleDefaults.MinimumHorseNumber || h1 > GameRuleDefaults.MaximumHorseNumber ||
                h2 < GameRuleDefaults.MinimumHorseNumber || h2 > GameRuleDefaults.MaximumHorseNumber)
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "位置连赢组合马号必须在 1~6 之间且不能相同");
            }

            primaryHorse = Math.Min(h1, h2);
            secondHorse = Math.Max(h1, h2);
            comboKey = $"{primaryHorse}-{secondHorse}";

            var horseA = round.Horses.SingleOrDefault(x => x.HorseNo == primaryHorse);
            var horseB = round.Horses.SingleOrDefault(x => x.HorseNo == secondHorse);
            var oddsA = horseA?.Odds ?? 5.0m;
            var oddsB = horseB?.Odds ?? 5.0m;
            var (qpCoeff, qpMin, qpMax) = rules.ResolvePlayTypeOddsCoeff("QUINELLAPLACE");
            lockedOdds = Math.Round(Math.Clamp(oddsA * oddsB * qpCoeff, qpMin, qpMax), 2);
        }
        else if (playType == "EXACTA")
        {
            int h1, h2;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length != 2 || !int.TryParse(parts[0], out h1) || !int.TryParse(parts[1], out h2))
                {
                    throw new BusinessRuleException("INVALID_COMBINATION", "二连单组合格式错误，应为类似 '1-2' 的格式");
                }
            }
            else if (request.SecondHorseNo.HasValue)
            {
                h1 = request.HorseNo;
                h2 = request.SecondHorseNo.Value;
            }
            else
            {
                throw new BusinessRuleException("SECOND_HORSE_REQUIRED", "二连单投注必须指定第二匹马");
            }

            if (h1 == h2 || h1 < GameRuleDefaults.MinimumHorseNumber || h1 > GameRuleDefaults.MaximumHorseNumber ||
                h2 < GameRuleDefaults.MinimumHorseNumber || h2 > GameRuleDefaults.MaximumHorseNumber)
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "二连单马号必须在 1~6 之间且不能相同");
            }

            primaryHorse = h1;
            secondHorse = h2;
            comboKey = $"{primaryHorse}-{secondHorse}";

            var horseA = round.Horses.SingleOrDefault(x => x.HorseNo == primaryHorse);
            var horseB = round.Horses.SingleOrDefault(x => x.HorseNo == secondHorse);
            var oddsA = horseA?.Odds ?? 5.0m;
            var oddsB = horseB?.Odds ?? 5.0m;
            var (exactaCoeff, exactaMin, exactaMax) = rules.ResolvePlayTypeOddsCoeff("EXACTA");
            lockedOdds = Math.Round(Math.Clamp(oddsA * oddsB * exactaCoeff, exactaMin, exactaMax), 1);
        }
        else if (playType == "TRIO")
        {
            int h1, h2, h3;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length != 3 || !int.TryParse(parts[0], out h1) || !int.TryParse(parts[1], out h2) || !int.TryParse(parts[2], out h3))
                {
                    throw new BusinessRuleException("INVALID_COMBINATION", "三连碰组合格式错误，应为类似 '1-2-3' 的格式");
                }
            }
            else if (request.SecondHorseNo.HasValue && request.ThirdHorseNo.HasValue)
            {
                h1 = request.HorseNo;
                h2 = request.SecondHorseNo.Value;
                h3 = request.ThirdHorseNo.Value;
            }
            else
            {
                throw new BusinessRuleException("THIRD_HORSE_REQUIRED", "三连碰投注必须指定三匹马");
            }

            var list = new[] { h1, h2, h3 }.Distinct().OrderBy(x => x).ToArray();
            if (list.Length != 3 || list.Any(x => x < GameRuleDefaults.MinimumHorseNumber || x > GameRuleDefaults.MaximumHorseNumber))
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "三连碰必须选择 3 匹不同马号 (1~6)");
            }

            primaryHorse = list[0];
            secondHorse = list[1];
            thirdHorse = list[2];
            comboKey = $"{primaryHorse}-{secondHorse}-{thirdHorse}";

            var oddsA = round.Horses.SingleOrDefault(x => x.HorseNo == primaryHorse)?.Odds ?? 5.0m;
            var oddsB = round.Horses.SingleOrDefault(x => x.HorseNo == secondHorse)?.Odds ?? 5.0m;
            var oddsC = round.Horses.SingleOrDefault(x => x.HorseNo == thirdHorse)?.Odds ?? 5.0m;
            var (trioCoeff, trioMin, trioMax) = rules.ResolvePlayTypeOddsCoeff("TRIO");
            lockedOdds = Math.Round(Math.Clamp(oddsA * oddsB * oddsC * trioCoeff, trioMin, trioMax), 1);
        }
        else if (playType == "TRIFECTA")
        {
            int h1, h2, h3;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length != 3 || !int.TryParse(parts[0], out h1) || !int.TryParse(parts[1], out h2) || !int.TryParse(parts[2], out h3))
                {
                    throw new BusinessRuleException("INVALID_COMBINATION", "三连单组合格式错误，应为类似 '1-2-3' 的格式");
                }
            }
            else if (request.SecondHorseNo.HasValue && request.ThirdHorseNo.HasValue)
            {
                h1 = request.HorseNo;
                h2 = request.SecondHorseNo.Value;
                h3 = request.ThirdHorseNo.Value;
            }
            else
            {
                throw new BusinessRuleException("THIRD_HORSE_REQUIRED", "三连单投注必须指定三匹马");
            }

            if (h1 == h2 || h1 == h3 || h2 == h3 ||
                h1 < GameRuleDefaults.MinimumHorseNumber || h1 > GameRuleDefaults.MaximumHorseNumber ||
                h2 < GameRuleDefaults.MinimumHorseNumber || h2 > GameRuleDefaults.MaximumHorseNumber ||
                h3 < GameRuleDefaults.MinimumHorseNumber || h3 > GameRuleDefaults.MaximumHorseNumber)
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "三连单必须严格指定 3 匹不同名次马号 (1~6)");
            }

            primaryHorse = h1;
            secondHorse = h2;
            thirdHorse = h3;
            comboKey = $"{primaryHorse}-{secondHorse}-{thirdHorse}";

            var oddsA = round.Horses.SingleOrDefault(x => x.HorseNo == primaryHorse)?.Odds ?? 5.0m;
            var oddsB = round.Horses.SingleOrDefault(x => x.HorseNo == secondHorse)?.Odds ?? 5.0m;
            var oddsC = round.Horses.SingleOrDefault(x => x.HorseNo == thirdHorse)?.Odds ?? 5.0m;
            var (trifectaCoeff, trifectaMin, trifectaMax) = rules.ResolvePlayTypeOddsCoeff("TRIFECTA");
            lockedOdds = Math.Round(Math.Clamp(oddsA * oddsB * oddsC * trifectaCoeff, trifectaMin, trifectaMax), 1);
        }
        else if (isQuinella)
        {
            playType = "QUINELLA";
            int h1, h2;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length != 2 || !int.TryParse(parts[0], out h1) || !int.TryParse(parts[1], out h2))
                {
                    throw new BusinessRuleException("INVALID_COMBINATION", "连赢组合格式错误，应为类似 '1-2' 的格式");
                }
            }
            else if (request.SecondHorseNo.HasValue)
            {
                h1 = request.HorseNo;
                h2 = request.SecondHorseNo.Value;
            }
            else
            {
                throw new BusinessRuleException("SECOND_HORSE_REQUIRED", "连赢投注必须指定第二匹马");
            }

            if (h1 == h2 || h1 < GameRuleDefaults.MinimumHorseNumber || h1 > GameRuleDefaults.MaximumHorseNumber ||
                h2 < GameRuleDefaults.MinimumHorseNumber || h2 > GameRuleDefaults.MaximumHorseNumber)
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "连赢组合马号必须在 1~6 之间且不能相同");
            }

            primaryHorse = Math.Min(h1, h2);
            secondHorse = Math.Max(h1, h2);
            comboKey = $"{primaryHorse}-{secondHorse}";

            // 从 round.QuinellaOddsSnapshotJson 中解析锁定赔率
            lockedOdds = 10.0m;
            if (!string.IsNullOrWhiteSpace(round.QuinellaOddsSnapshotJson))
            {
                try
                {
                    using var doc = System.Text.Json.JsonDocument.Parse(round.QuinellaOddsSnapshotJson);
                    foreach (var element in doc.RootElement.EnumerateArray())
                    {
                        var comboVal = (element.TryGetProperty("combination", out var c1) ? c1.GetString() : null)
                            ?? (element.TryGetProperty("Combination", out var c2) ? c2.GetString() : null);

                        if (string.Equals(comboVal, comboKey, StringComparison.OrdinalIgnoreCase))
                        {
                            if (element.TryGetProperty("odds", out var o1) || element.TryGetProperty("Odds", out o1))
                            {
                                lockedOdds = o1.GetDecimal();
                                break;
                            }
                        }
                    }
                }
                catch
                {
                    // 降级保底
                }
            }
        }
        else
        {
            playType = "WIN";
            if (request.HorseNo is < GameRuleDefaults.MinimumHorseNumber or > GameRuleDefaults.MaximumHorseNumber)
            {
                throw new BusinessRuleException("INVALID_HORSE_NUMBER", "马号无效");
            }

            primaryHorse = request.HorseNo;

            var selection = await db.RaceBetSelections.FirstOrDefaultAsync(
                x => x.PlayerId == playerId && x.RoundId == request.RoundId && x.HorseNo == request.HorseNo,
                cancellationToken);

            if (selection is null)
            {
                db.RaceBetSelections.Add(new RaceBetSelection
                {
                    PlayerId = playerId,
                    RoundId = request.RoundId,
                    HorseNo = request.HorseNo,
                    CreatedAt = utcNow,
                    UpdatedAt = utcNow,
                });
            }

            var horse = round.Horses.SingleOrDefault(x => x.HorseNo == request.HorseNo)
                ?? throw new BusinessRuleException("ROUND_HORSE_NOT_FOUND", "当前轮次不存在该马匹");
            lockedOdds = horse.Odds;
        }

        var grossReward = MoneyMath.Round(request.Amount * lockedOdds);
        var feeRate = rules.ResolveFeeRate(grossReward);
        var feeAmount = MoneyMath.Round(grossReward * feeRate);
        var netReward = MoneyMath.Round(grossReward - feeAmount);

        var orderNo = CreateOrderNumber();
        var balanceBefore = wallet.Balance;

        wallet.Balance = MoneyMath.Round(wallet.Balance - request.Amount);
        wallet.Version++;
        wallet.UpdatedAt = utcNow;

        var walletTransaction = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = GameBusinessCodes.BetTransaction,
            Amount = -request.Amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = wallet.Balance,
            ReferenceType = GameBusinessCodes.BetOrderReference,
            ReferenceId = orderNo,
            IdempotencyKey = $"wallet:bet:{request.IdempotencyKey}",
            CreatedAt = utcNow,
        };
        var order = new BetOrder
        {
            OrderNo = orderNo,
            PlayerId = playerId,
            RoundId = request.RoundId,
            PlayType = playType,
            HorseNo = primaryHorse,
            SecondHorseNo = secondHorse,
            ThirdHorseNo = thirdHorse,
            Combination = comboKey,
            BetAmount = request.Amount,
            LockedOdds = lockedOdds,
            PotentialReward = netReward,
            GrossReward = grossReward,
            FeeRate = feeRate,
            FeeAmount = feeAmount,
            NetReward = netReward,
            RoundingVersion = rules.RoundingVersion,
            IdempotencyKey = request.IdempotencyKey,
            RequestHash = requestHash,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };

        gameLogService.AddRaceLog(
            round,
            "BET_PLACED",
            "SUCCESS",
            new
            {
                playerId,
                orderNo,
                playType = playType,
                horseNo = primaryHorse,
                secondHorseNo = secondHorse,
                combination = comboKey,
                amount = request.Amount,
                lockedOdds,
            });

        var primaryHorseEntity = round.Horses.SingleOrDefault(x => x.HorseNo == primaryHorse);
        if (primaryHorseEntity != null)
        {
            gameLogService.AddHorseLog(
                primaryHorseEntity,
                "HORSE_BET_RECEIVED",
                "SUCCESS",
                new
                {
                    playerId,
                    orderNo,
                    amount = request.Amount,
                    playType = isQuinella ? "QUINELLA" : "WIN",
                    combination = comboKey,
                });
        }

        if (isQuinella && secondHorse.HasValue)
        {
            var secondHorseEntity = round.Horses.SingleOrDefault(x => x.HorseNo == secondHorse.Value);
            if (secondHorseEntity != null)
            {
                gameLogService.AddHorseLog(
                    secondHorseEntity,
                    "HORSE_BET_RECEIVED",
                    "SUCCESS",
                    new
                    {
                        playerId,
                        orderNo,
                        amount = request.Amount,
                        playType = "QUINELLA",
                        combination = comboKey,
                    });
            }
        }

        try
        {
            db.WalletTransactions.Add(walletTransaction);
            db.BetOrders.Add(order);
            await db.SaveChangesAsync(cancellationToken);

            order.BetTransactionId = walletTransaction.Id;

            // 使用数据库原子累加，避免两个不同玩家同时下注时出现“最后一次写入覆盖”。
            var roundUpdated = await db.RaceRounds
                .Where(x =>
                    x.Id == request.RoundId
                    && x.State == RaceState.Betting
                    && DateTime.UtcNow < x.BettingEndAt)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.BetCount, x => x.BetCount + 1)
                    .SetProperty(x => x.TotalBetAmount, x => x.TotalBetAmount + request.Amount)
                    .SetProperty(x => x.UpdatedAt, DateTime.UtcNow),
                    cancellationToken);

            if (roundUpdated != 1)
            {
                throw new BusinessRuleException("BETTING_CLOSED", "下注截止或轮次状态已变化");
            }

            // 业务决策修正：玩家下注扣款即使余额归 0 也不触发破产救济倒计时，因其持有在途注单可能中奖；
            // 只有当轮次结算完毕且输光、全局无任何未决在途注单时才判定为真实破产。

            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return MapResponse(order, wallet.Balance);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "uq_bet_orders_idempotency_key"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return await HandleIdempotentConflictAsync(playerId, request, requestHash, cancellationToken);
        }
    }

    /// <summary>
    /// 当并发写入触发幂等键唯一约束冲突时，回查已持久化的下注订单并幂等重放结果。
    /// </summary>
    private async Task<PlaceBetResponse> HandleIdempotentConflictAsync(
        long playerId,
        PlaceBetRequest request,
        string requestHash,
        CancellationToken cancellationToken)
    {
        var existingOrder = await db.BetOrders
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, cancellationToken)
            ?? throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等下注已被处理，但无法重新读取订单");

        if (existingOrder.PlayerId != playerId)
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
        }

        if (!string.Equals(existingOrder.RequestHash, requestHash, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("IDEMPOTENCY_REQUEST_MISMATCH", "幂等键已被不同业务参数复用");
        }

        var wallet = await db.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");

        return MapResponse(existingOrder, wallet.Balance);
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

    public static string ComputeRequestHash(PlaceBetRequest request)
    {
        var isQuinella = string.Equals(request.PlayType, "QUINELLA", StringComparison.OrdinalIgnoreCase) ||
                         request.SecondHorseNo.HasValue ||
                         !string.IsNullOrWhiteSpace(request.Combination);

        int primary;
        int? second = null;
        int? third = null;
        string combo;

        if (string.Equals(request.PlayType, "TRIO", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(request.PlayType, "TRIFECTA", StringComparison.OrdinalIgnoreCase))
        {
            int h1 = request.HorseNo;
            int h2 = request.SecondHorseNo ?? 0;
            int h3 = request.ThirdHorseNo ?? 0;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length == 3 && int.TryParse(parts[0], out var p1) && int.TryParse(parts[1], out var p2) && int.TryParse(parts[2], out var p3))
                {
                    h1 = p1; h2 = p2; h3 = p3;
                }
            }
            if (string.Equals(request.PlayType, "TRIO", StringComparison.OrdinalIgnoreCase))
            {
                var arr = new[] { h1, h2, h3 }.OrderBy(x => x).ToArray();
                primary = arr[0]; second = arr[1]; third = arr[2];
            }
            else
            {
                primary = h1; second = h2; third = h3;
            }
            combo = $"{primary}-{second}-{third}";
        }
        else if (isQuinella || string.Equals(request.PlayType, "QUINELLAPLACE", StringComparison.OrdinalIgnoreCase))
        {
            int h1 = request.HorseNo;
            int h2 = request.SecondHorseNo ?? 0;
            if (!string.IsNullOrWhiteSpace(request.Combination))
            {
                var parts = request.Combination.Trim().Split('-');
                if (parts.Length == 2 && int.TryParse(parts[0], out var p1) && int.TryParse(parts[1], out var p2))
                {
                    h1 = p1;
                    h2 = p2;
                }
            }
            primary = Math.Min(h1, h2);
            second = Math.Max(h1, h2);
            combo = $"{primary}-{second}";
        }
        else if (string.Equals(request.PlayType, "EXACTA", StringComparison.OrdinalIgnoreCase))
        {
            primary = request.HorseNo;
            second = request.SecondHorseNo;
            combo = $"{primary}-{second}";
        }
        else
        {
            primary = request.HorseNo;
            combo = $"{primary}";
        }

        var playType = (request.PlayType ?? "WIN").ToUpperInvariant();
        var canonical = $"round={request.RoundId}&type={playType}&horse={primary}&second={second}&third={third}&combo={combo}&amount={request.Amount:0.00}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    /// <summary>
    /// 比赛进行到第 15~18 秒时，玩家对其有效注单发起冲刺加倍追投。
    /// </summary>
    public async Task<DoubleDownResponse> DoubleDownAsync(
        long playerId,
        DoubleDownRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.OrderNo))
        {
            throw new BusinessRuleException("ORDER_NO_REQUIRED", "必须指定追投订单号");
        }
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        var existingOrder = await db.BetOrders.FirstOrDefaultAsync(
            x => x.OrderNo == request.OrderNo,
            cancellationToken)
            ?? throw new BusinessRuleException("ORDER_NOT_FOUND", "订单不存在");

        if (existingOrder.PlayerId != playerId)
        {
            throw new BusinessRuleException("FORBIDDEN", "无权追投他人订单");
        }

        if (existingOrder.IsDoubleDown)
        {
            var currentWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);
            return new DoubleDownResponse(existingOrder.OrderNo, existingOrder.DoubleDownAmount, existingOrder.BetAmount + existingOrder.DoubleDownAmount, currentWallet?.Balance ?? 0m);
        }

        if (!string.Equals(existingOrder.PlayType, "WIN", StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("PLAY_TYPE_NOT_SUPPORTED", "冲刺加倍追投仅限单马独赢 (WIN) 注单开放");
        }

        var round = await db.RaceRounds.FirstOrDefaultAsync(x => x.Id == existingOrder.RoundId, cancellationToken)
            ?? throw new BusinessRuleException("ROUND_NOT_FOUND", "赛事轮次不存在");

        var targetHorse = await db.RaceHorses.FirstOrDefaultAsync(
            x => x.RoundId == existingOrder.RoundId && x.HorseNo == existingOrder.HorseNo,
            cancellationToken);
        if (targetHorse?.FinalRank is > 3)
        {
            throw new BusinessRuleException("HORSE_NOT_IN_TOP3", "仅限对处于前 3 名领先梯队的赛马发起冲刺加倍");
        }

        if (round.State != RaceState.Racing || round.RaceStartAt == null)
        {
            throw new BusinessRuleException("NOT_IN_RACING_STATE", "冲刺加倍追投仅限比赛冲刺进行中开放");
        }

        var rules = await ruleConfigService.GetCurrentAsync(DateTime.UtcNow, cancellationToken);
        var elapsed = (DateTime.UtcNow - round.RaceStartAt.Value).TotalSeconds;
        var windowStart = rules.InPlayWindowStartSecond;
        var windowEnd = windowStart + rules.InPlayWindowDurationSeconds + 2; // 2s 网络延迟容限

        if (elapsed < windowStart || elapsed > windowEnd)
        {
            throw new BusinessRuleException("INPLAY_WINDOW_CLOSED", $"冲刺加倍追投窗口仅在开赛第 {windowStart}~{windowEnd} 秒开放");
        }

        var doubleAmount = existingOrder.BetAmount;
        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        if (wallet.Balance < doubleAmount)
        {
            throw new BusinessRuleException("INSUFFICIENT_FUNDS", "钱包余额不足以冲刺加倍");
        }

        var balanceBefore = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - doubleAmount);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        var idemKey = $"wallet:dd:{request.IdempotencyKey}";
        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "BET_DOUBLEDOWN",
            Amount = -doubleAmount,
            BalanceBefore = balanceBefore,
            BalanceAfter = wallet.Balance,
            ReferenceType = GameBusinessCodes.BetOrderReference,
            ReferenceId = existingOrder.OrderNo,
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow,
        });

        existingOrder.IsDoubleDown = true;
        existingOrder.DoubleDownAmount = doubleAmount;
        existingOrder.UpdatedAt = DateTime.UtcNow;

        round.TotalBetAmount = MoneyMath.Round(round.TotalBetAmount + doubleAmount);
        round.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        var totalWager = existingOrder.BetAmount + existingOrder.DoubleDownAmount;
        return new DoubleDownResponse(existingOrder.OrderNo, doubleAmount, totalWager, wallet.Balance);
    }

    private static void ValidateRequest(PlaceBetRequest request)
    {
        if (request.RoundId <= 0)
        {
            throw new BusinessRuleException("INVALID_ROUND_ID", "轮次参数无效");
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }
    }

    /// <summary>生成便于业务查询的非顺序下注订单号。</summary>
    private static string CreateOrderNumber()
    {
        return $"BET{Guid.NewGuid():N}"[..23];
    }

    /// <summary>将持久化订单映射为客户端稳定响应。</summary>
    private static PlaceBetResponse MapResponse(BetOrder order, decimal balance)
    {
        return new PlaceBetResponse(
            order.OrderNo,
            order.PlayerId,
            order.RoundId,
            order.HorseNo,
            order.BetAmount,
            order.LockedOdds,
            order.GrossReward,
            order.FeeRate,
            order.FeeAmount,
            order.NetReward,
            balance,
            DateTime.UtcNow,
            order.PlayType,
            order.SecondHorseNo,
            order.Combination,
            order.ThirdHorseNo);
    }
}

using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using RaceGame.Application.Audit;
using RaceGame.Application.Common;
using RaceGame.Application.Tasks;
using RaceGame.Application.Achievements;
using RaceGame.Application.Configuration;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Settlement;

/// <summary>
/// 结算轮次订单、浮动彩池稀释赔率、钱包奖励、方案 A 角色增益、社交返佣防对冲、
/// 真破产救济金调度与玩家/马匹统计，并在同一事务中推进每日比赛任务与功勋成就。
/// </summary>
public sealed class SettlementService(
    IGameDbContext db,
    DailyTaskService dailyTaskService,
    GameLogService gameLogService,
    AchievementService? achievementService = null)
{
    /// <summary>
    /// 幂等结算指定轮次；已完成轮次直接返回，未完成轮次统一更新订单和累计统计。
    /// </summary>
    public async Task SettleAsync(long roundId, int winnerHorseNo, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var round = await db.RaceRounds
            .Include(x => x.Horses)
            .FirstAsync(x => x.Id == roundId, cancellationToken);

        if (round.State == RaceState.Finished)
        {
            return;
        }

        var orders = await db.BetOrders
            .Where(x => x.RoundId == roundId && x.Status == BetOrderStatus.Pending)
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var ordersByPlayer = orders.GroupBy(x => x.PlayerId).ToDictionary(x => x.Key, x => x.ToList());
        var wallets = new Dictionary<long, Wallet>();
        foreach (var playerId in ordersByPlayer.Keys.OrderBy(x => x))
        {
            var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
                ?? throw new BusinessRuleException("WALLET_NOT_FOUND", $"玩家 {playerId} 钱包不存在");
            wallets[playerId] = wallet;
        }

        var secondHorse = round.SecondHorseNo ?? round.Horses.FirstOrDefault(x => x.FinalRank == 2)?.HorseNo;
        var thirdHorse = round.Horses.FirstOrDefault(x => x.FinalRank == 3)?.HorseNo;
        var winningQuinella = secondHorse.HasValue
            ? $"{Math.Min(winnerHorseNo, secondHorse.Value)}-{Math.Max(winnerHorseNo, secondHorse.Value)}"
            : null;

        var top3Set = new HashSet<int> { winnerHorseNo };
        if (secondHorse.HasValue) top3Set.Add(secondHorse.Value);
        if (thirdHorse.HasValue) top3Set.Add(thirdHorse.Value);

        var horse1Obj = round.Horses.FirstOrDefault(x => x.HorseNo == winnerHorseNo);
        var horse2Obj = secondHorse.HasValue ? round.Horses.FirstOrDefault(x => x.HorseNo == secondHorse.Value) : null;
        var hasBlackHorseInTop2 = (horse1Obj?.IsBlackHorse == true) || (horse2Obj?.IsBlackHorse == true);

        // 解析轮次规则快照（包含彩池赔付限额与规费阶梯）
        RaceRuleSnapshot? ruleSnapshot = null;
        if (!string.IsNullOrWhiteSpace(round.RoundRuleSnapshotJson))
        {
            try
            {
                ruleSnapshot = JsonSerializer.Deserialize<RaceRuleSnapshot>(round.RoundRuleSnapshotJson);
            }
            catch { }
        }
        ruleSnapshot ??= RaceRuleSnapshot.CreateDefault();

        var participatingPlayerIds = orders.Select(x => x.PlayerId).Distinct().ToList();

        // 预载已装备角色与模板（用于方案 A 收益与规费增益及 PRD 2.3 骑师执照特性）
        var equippedCharacters = await db.PlayerCharacters
            .Where(x => participatingPlayerIds.Contains(x.PlayerId) && x.IsEquipped)
            .ToListAsync(cancellationToken);
        var equippedCharactersByPlayer = equippedCharacters
            .GroupBy(x => x.PlayerId)
            .ToDictionary(g => g.Key, g => g.First());

        var characterCatalogs = await db.CharacterCatalogs
            .AsNoTracking()
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        // 1. 初步甄别中奖注单与计算理论名义毛奖金
        var winningOrderList = new List<(BetOrder order, decimal nominalGross, bool isJackpot)>();
        foreach (var order in orders)
        {
            var playType = (order.PlayType ?? "WIN").ToUpperInvariant();
            var isQuinellaOrder = playType == "QUINELLA";
            var isExactaOrder = playType == "EXACTA";
            var isPlaceOrder = playType == "PLACE";
            var isQuinellaPlaceOrder = playType == "QUINELLAPLACE";
            var isTrioOrder = playType == "TRIO";
            var isTrifectaOrder = playType == "TRIFECTA";

            bool isWinner;
            if (isPlaceOrder)
            {
                isWinner = order.HorseNo == winnerHorseNo || (secondHorse.HasValue && order.HorseNo == secondHorse.Value);
            }
            else if (isExactaOrder)
            {
                isWinner = order.HorseNo == winnerHorseNo && secondHorse.HasValue && order.SecondHorseNo == secondHorse.Value;
            }
            else if (isQuinellaOrder)
            {
                isWinner = secondHorse.HasValue && (
                    string.Equals(order.Combination, winningQuinella, StringComparison.OrdinalIgnoreCase) ||
                    (order.HorseNo == Math.Min(winnerHorseNo, secondHorse.Value) && order.SecondHorseNo == Math.Max(winnerHorseNo, secondHorse.Value)));
            }
            else if (isQuinellaPlaceOrder)
            {
                // 位置连赢/扩连赢：任选两匹马双双跑入前三名
                isWinner = order.SecondHorseNo.HasValue && top3Set.Contains(order.HorseNo) && top3Set.Contains(order.SecondHorseNo.Value);
            }
            else if (isTrioOrder)
            {
                // 三连碰：任选三匹马包揽前三名 (无序)
                isWinner = order.SecondHorseNo.HasValue && order.ThirdHorseNo.HasValue &&
                           top3Set.Contains(order.HorseNo) &&
                           top3Set.Contains(order.SecondHorseNo.Value) &&
                           top3Set.Contains(order.ThirdHorseNo.Value) &&
                           top3Set.Count == 3;
            }
            else if (isTrifectaOrder)
            {
                // 三连单：严格顺序命中第 1、第 2、第 3 名
                isWinner = secondHorse.HasValue && thirdHorse.HasValue &&
                           order.HorseNo == winnerHorseNo &&
                           order.SecondHorseNo == secondHorse.Value &&
                           order.ThirdHorseNo == thirdHorse.Value;
            }
            else
            {
                isWinner = order.HorseNo == winnerHorseNo;
            }

            if (isWinner)
            {
                var isJackpot = (isQuinellaOrder || isExactaOrder || isTrifectaOrder) && hasBlackHorseInTop2;
                var totalWager = order.BetAmount + order.DoubleDownAmount;
                var nominalGross = MoneyMath.Round(totalWager * order.LockedOdds);

                if (order.IsDoubleDown)
                {
                    // 局内冲刺加倍胜出：利润部分额外加赠配置比例（默认 +50%）
                    var boostBonus = MoneyMath.Round((nominalGross - totalWager) * ruleSnapshot.InPlayBoostProfitRate);
                    nominalGross = MoneyMath.Round(nominalGross + Math.Max(0m, boostBonus));
                }

                if (isJackpot)
                {
                    // 街机大爆奖 Jackpot！连赢命中黑马前两名，奖励额外 25% 爆机奖金加成
                    var jackpotBonus = MoneyMath.Round(nominalGross * 0.25m);
                    nominalGross = MoneyMath.Round(nominalGross + jackpotBonus);
                }
                winningOrderList.Add((order, nominalGross, isJackpot));
            }
            else
            {
                order.Status = BetOrderStatus.Lost;
                order.StatusReason = "LOSE";
                order.GrossReward = 0m;
                order.FeeRate = 0m;
                order.FeeAmount = 0m;
                order.NetReward = 0m;
                order.DilutionFactor = 1.0m;
                order.SettledAt = DateTime.UtcNow;
                order.UpdatedAt = DateTime.UtcNow;
            }
        }

        // 2. 浮动彩池制（Pari-Mutuel）稀释赔率算法
        var totalWinningNominalGross = winningOrderList.Sum(x => x.nominalGross);
        var totalRoundBets = round.TotalBetAmount > 0 ? round.TotalBetAmount : orders.Sum(x => x.BetAmount + x.DoubleDownAmount);
        var maxLiability = ruleSnapshot.MaxRoundPayoutLiability > 0 ? ruleSnapshot.MaxRoundPayoutLiability : 500000.00m;
        var basePool = MoneyMath.Round(totalRoundBets * (1m - 0.010m)); // 扣除基准马会规费 1.0%
        var poolCapacity = Math.Max(basePool, maxLiability);
        round.PayoutPoolAmount = poolCapacity;

        var isDiluted = totalWinningNominalGross > poolCapacity && totalWinningNominalGross > 0;
        var dilutionFactor = isDiluted
            ? Math.Min(1.0m, Math.Round(poolCapacity / totalWinningNominalGross, 6, MidpointRounding.ToZero))
            : 1.0m;
        round.DilutionFactor = dilutionFactor;

        // 预统计老牛仔·亚瑟今日已生效/结算的不同局数（单日限制前 10 局生效）
        var rookiePlayerIds = winningOrderList
            .Select(x => x.order.PlayerId)
            .Distinct()
            .Where(pid => equippedCharactersByPlayer.TryGetValue(pid, out var eq) &&
                          characterCatalogs.TryGetValue(eq.CharacterId, out var c) &&
                          c.CharacterCode == "CHARACTER_ROOKIE_JOCKEY")
            .ToList();

        var rookieGamesToday = new Dictionary<long, int>();
        if (rookiePlayerIds.Count > 0)
        {
            var todayStartUtc = DateTime.UtcNow.Date;
            var pastRoundCounts = await db.BetOrders
                .AsNoTracking()
                .Where(x => rookiePlayerIds.Contains(x.PlayerId) &&
                            x.SettledAt >= todayStartUtc &&
                            x.RoundId != round.Id &&
                            x.Status == BetOrderStatus.Won)
                .GroupBy(x => x.PlayerId)
                .Select(g => new { PlayerId = g.Key, Count = g.Select(x => x.RoundId).Distinct().Count() })
                .ToListAsync(cancellationToken);

            foreach (var r in pastRoundCounts)
            {
                rookieGamesToday[r.PlayerId] = r.Count;
            }
        }

        // 3. 执行中奖注单结算、1.05x 保底机制与方案 A 角色微幅增益
        foreach (var (order, nominalGross, isJackpot) in winningOrderList)
        {
            var grossAfterDilution = nominalGross;
            if (isDiluted)
            {
                var dilutedGross = MoneyMath.Round(nominalGross * dilutionFactor);
                var minGuaranteed = MoneyMath.Round((order.BetAmount + order.DoubleDownAmount) * 1.05m); // 1.05x 保底防亏机制
                grossAfterDilution = Math.Max(dilutedGross, minGuaranteed);
                order.StatusReason = isJackpot ? "WIN_JACKPOT_DILUTED" : "WIN_DILUTED";
            }
            else
            {
                order.StatusReason = isJackpot ? "WIN_JACKPOT" : "WIN";
            }
            order.DilutionFactor = dilutionFactor;
            order.GrossReward = grossAfterDilution;

            // 规费计算与骑师专属执照特性 (Jockey Passive Traits)
            equippedCharactersByPlayer.TryGetValue(order.PlayerId, out var equippedChar);
            var catalog = equippedChar != null && characterCatalogs.TryGetValue(equippedChar.CharacterId, out var cat) ? cat : null;
            var charCode = catalog?.CharacterCode ?? string.Empty;

            var feeRate = ruleSnapshot.ResolveFeeRate(order.GrossReward);

            // 1. 老牛仔·亚瑟 (CHARACTER_ROOKIE_JOCKEY): 【精打细算】每日限制前 10 局生效，手续费扣除从 12% 降至 10% (相当于减免 2% 规费)
            if (charCode == "CHARACTER_ROOKIE_JOCKEY")
            {
                var playedToday = rookieGamesToday.GetValueOrDefault(order.PlayerId, 0);
                if (playedToday < 10)
                {
                    feeRate = Math.Max(0m, feeRate - 0.0200m);
                }
                else if (equippedChar != null)
                {
                    feeRate = Math.Max(0m, feeRate - 0.0005m); // 超过 10 局退化为基础被动减免 0.05%
                }
            }
            else if (equippedChar != null)
            {
                feeRate = Math.Max(0m, feeRate - 0.0005m); // 基础方案 A 规费减免 0.05%
            }

            order.FeeRate = feeRate;
            order.FeeAmount = MoneyMath.Round(order.GrossReward * order.FeeRate);
            order.NetReward = MoneyMath.Round(order.GrossReward - order.FeeAmount);

            // 2. 红发女郎·贝拉 (CHARACTER_ELITE_JOCKEY): 【黑马狂欢】命中赔率 >= 20.0 冷门组合加赠 5% 奖金
            if (charCode == "CHARACTER_ELITE_JOCKEY" && order.LockedOdds >= 20.0m)
            {
                var bellaBonus = MoneyMath.Round(order.NetReward * 0.05m);
                order.NetReward = MoneyMath.Round(order.NetReward + bellaBonus);
                order.GrossReward = MoneyMath.Round(order.GrossReward + bellaBonus);
            }
            // 3. 赏金猎人·克林特 (CHARACTER_STAR_TRAINER): 【风雨无阻】雨天/泥泞赛道额外加赠 2% 奖金
            else if (charCode == "CHARACTER_STAR_TRAINER" &&
                (string.Equals(round.Weather, "RAINY", StringComparison.OrdinalIgnoreCase) ||
                 string.Equals(round.TrackType, "DIRT", StringComparison.OrdinalIgnoreCase)))
            {
                var clintBonus = MoneyMath.Round(order.NetReward * 0.02m);
                order.NetReward = MoneyMath.Round(order.NetReward + clintBonus);
                order.GrossReward = MoneyMath.Round(order.GrossReward + clintBonus);
            }
            // 4. 疾风女骑师 (CHARACTER_SPEED_QUEEN): 【追风绝杀】Photo Finish 鼻尖微距绝杀第一名加赠 50 币
            else if (charCode == "CHARACTER_SPEED_QUEEN" && round.IsPhotoFinish && order.HorseNo == winnerHorseNo)
            {
                var speedBonus = 50.00m;
                order.NetReward = MoneyMath.Round(order.NetReward + speedBonus);
                order.GrossReward = MoneyMath.Round(order.GrossReward + speedBonus);
            }
            else if (equippedChar != null)
            {
                var yieldBonus = MoneyMath.Round(order.NetReward * 0.01m); // 方案 A: 基础中奖收益 +1.0%
                order.NetReward = MoneyMath.Round(order.NetReward + yieldBonus);
                order.GrossReward = MoneyMath.Round(order.GrossReward + yieldBonus);
            }

            var wallet = wallets[order.PlayerId];
            var balanceBefore = wallet.Balance;
            wallet.Balance = MoneyMath.Round(wallet.Balance + order.NetReward);
            wallet.Version++;
            wallet.UpdatedAt = DateTime.UtcNow;

            db.WalletTransactions.Add(new WalletTransaction
            {
                PlayerId = order.PlayerId,
                TransactionType = GameBusinessCodes.RaceRewardTransaction,
                Amount = order.NetReward,
                BalanceBefore = balanceBefore,
                BalanceAfter = wallet.Balance,
                FeeRate = order.FeeRate,
                FeeAmount = order.FeeAmount,
                ReferenceType = GameBusinessCodes.BetOrderReference,
                ReferenceId = order.OrderNo,
                IdempotencyKey = "reward:" + order.Id,
            });

            order.Status = BetOrderStatus.Won;
            order.SettledAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;
        }

        // 4. 记录结算日志
        foreach (var order in orders)
        {
            var isWinner = order.Status == BetOrderStatus.Won;
            var isJackpot = order.StatusReason?.StartsWith("WIN_JACKPOT", StringComparison.OrdinalIgnoreCase) == true;

            db.BetOrderSettlementLogs.Add(new BetOrderSettlementLog
            {
                BetOrderId = order.Id,
                ResultStatus = isWinner ? (order.StatusReason ?? "WIN") : "LOSE",
                GrossRewardSnapshot = isWinner ? order.GrossReward : 0m,
                FeeRateSnapshot = isWinner ? order.FeeRate : 0m,
                FeeAmountSnapshot = isWinner ? order.FeeAmount : 0m,
                NetRewardSnapshot = isWinner ? order.NetReward : 0m,
                MetadataJson = JsonSerializer.Serialize(new
                {
                    roundId,
                    winnerHorseNo,
                    secondHorseNo = secondHorse,
                    winningQuinella,
                    orderPlayType = order.PlayType,
                    orderCombination = order.Combination,
                    lockedOdds = order.LockedOdds,
                    roundingVersion = order.RoundingVersion,
                    isJackpot,
                    dilutionFactor = order.DilutionFactor,
                    isDiluted,
                }),
                CreatedAt = DateTime.UtcNow,
            });
        }

        gameLogService.AddRaceLog(
            round,
            "SETTLEMENT_ORDERS_PROCESSED",
            "SUCCESS",
            new
            {
                orderCount = orders.Count,
                winnerHorseNo,
                winnerOrderCount = orders.Count(x => x.Status == BetOrderStatus.Won),
                isDiluted,
                dilutionFactor,
                payoutPoolAmount = round.PayoutPoolAmount,
            });

        // 3.1 警长·怀亚特 【逢凶化吉】特性检查：当日遭遇连续 3 场全输时，自动返还第 3 场 15% 的下注本金 (每日限 1 次)
        var todayUtc = DateTime.UtcNow.Date;
        foreach (var pId in participatingPlayerIds)
        {
            equippedCharactersByPlayer.TryGetValue(pId, out var eqChar);
            var cat = eqChar != null && characterCatalogs.TryGetValue(eqChar.CharacterId, out var c) ? c : null;
            if (cat?.CharacterCode != "CHARACTER_ROYAL_KNIGHT") continue;

            var playerRoundOrders = orders.Where(x => x.PlayerId == pId).ToList();
            if (playerRoundOrders.Count == 0 || playerRoundOrders.Any(x => x.Status == BetOrderStatus.Won)) continue;

            var alreadyGrantedToday = await db.WalletTransactions
                .AnyAsync(x => x.PlayerId == pId && x.CreatedAt >= todayUtc && x.TransactionType == "JOCKEY_CONSOLATION_REFUND", cancellationToken);
            if (alreadyGrantedToday) continue;

            var recentRoundIds = await db.BetOrders
                .Where(x => x.PlayerId == pId && x.RoundId < round.Id && x.SettledAt >= todayUtc)
                .OrderByDescending(x => x.RoundId)
                .Select(x => x.RoundId)
                .Distinct()
                .Take(2)
                .ToListAsync(cancellationToken);

            if (recentRoundIds.Count == 2)
            {
                var anyWinInRecent = await db.BetOrders
                    .AnyAsync(x => x.PlayerId == pId && recentRoundIds.Contains(x.RoundId) && x.Status == BetOrderStatus.Won, cancellationToken);
                if (!anyWinInRecent)
                {
                    var thisRoundWager = playerRoundOrders.Sum(x => x.BetAmount + x.DoubleDownAmount);
                    var refundAmount = MoneyMath.Round(thisRoundWager * 0.15m);
                    if (refundAmount > 0 && wallets.TryGetValue(pId, out var pWallet))
                    {
                        var before = pWallet.Balance;
                        pWallet.Balance = MoneyMath.Round(pWallet.Balance + refundAmount);
                        pWallet.Version++;
                        pWallet.UpdatedAt = DateTime.UtcNow;

                        db.WalletTransactions.Add(new WalletTransaction
                        {
                            PlayerId = pId,
                            TransactionType = "JOCKEY_CONSOLATION_REFUND",
                            Amount = refundAmount,
                            BalanceBefore = before,
                            BalanceAfter = pWallet.Balance,
                            FeeRate = 0m,
                            FeeAmount = 0m,
                            ReferenceType = "ROUND",
                            ReferenceId = round.Id.ToString(),
                            IdempotencyKey = $"consolation:{round.Id}:{pId}",
                            CreatedAt = DateTime.UtcNow,
                        });
                    }
                }
            }
        }

        // 3.2 专属马房出赛与分红结算 (PRD Section 3.4)
        var allRunningHorses = round.Horses.ToList();
        if (allRunningHorses.Count > 0)
        {
            var templateIds = allRunningHorses.Select(x => x.HorseTemplateId).Distinct().ToList();
            var adoptedStables = await db.PlayerHorseStables
                .Where(x => templateIds.Contains(x.HorseCatalogId))
                .ToListAsync(cancellationToken);

            if (adoptedStables.Count > 0)
            {
                foreach (var stable in adoptedStables)
                {
                    var finishedHorse = allRunningHorses.FirstOrDefault(x => x.HorseTemplateId == stable.HorseCatalogId);
                    if (finishedHorse is null) continue;

                    // 只要参赛，累计出赛场次均加 1
                    stable.TotalCareerRaces += 1;

                    decimal dividendAmount = finishedHorse.FinalRank.HasValue
                        ? ruleSnapshot.ResolveStableDividend(finishedHorse.FinalRank.Value)
                        : 0m;

                    if (finishedHorse.FinalRank == 1)
                    {
                        stable.TotalCareerWins += 1;
                    }

                    if (dividendAmount > 0)
                    {
                        stable.AccumulatedPurse += dividendAmount;

                        db.HorseDividends.Add(new HorseDividend
                        {
                            RoundId = round.Id,
                            HorseCatalogId = stable.HorseCatalogId,
                            PlayerId = stable.PlayerId,
                            DividendAmount = dividendAmount,
                            Claimed = false,
                            CreatedAt = DateTime.UtcNow
                        });
                    }
                }
            }
        }

        // 4. 全服累积超级大奖池抽水注入与大爆奖检测
        var poolCode = string.IsNullOrWhiteSpace(ruleSnapshot.JackpotPoolCode) ? "MEGA_COIN_POOL" : ruleSnapshot.JackpotPoolCode;
        var pool = await db.JackpotPools.FirstOrDefaultAsync(x => x.PoolCode == poolCode, cancellationToken);
        if (pool is null)
        {
            pool = new JackpotPool
            {
                PoolCode = poolCode,
                CurrentAmount = ruleSnapshot.JackpotSeedAmount,
                SeedAmount = ruleSnapshot.JackpotSeedAmount,
                TaxRate = ruleSnapshot.JackpotContributionRate,
                TotalPaidOut = 0m,
                UpdatedAt = DateTime.UtcNow,
            };
            db.JackpotPools.Add(pool);
        }

        var jackpotTax = MoneyMath.Round(totalRoundBets * ruleSnapshot.JackpotContributionRate);
        pool.CurrentAmount = MoneyMath.Round(pool.CurrentAmount + jackpotTax);
        pool.UpdatedAt = DateTime.UtcNow;

        var megaDropOrder = winningOrderList.FirstOrDefault(x => x.order.LockedOdds >= ruleSnapshot.JackpotMinTriggerOdds);
        if (megaDropOrder.order is not null && pool.CurrentAmount > 0)
        {
            var dropAmount = pool.CurrentAmount;
            var winnerShare = MoneyMath.Round(dropAmount * ruleSnapshot.JackpotWinnerShareRate);
            var rainShare = MoneyMath.Round(dropAmount * ruleSnapshot.JackpotRainShareRate);

            db.JackpotDropLogs.Add(new JackpotDropLog
            {
                RoundId = roundId,
                PoolCode = pool.PoolCode,
                TotalDropAmount = dropAmount,
                WinnerShareAmount = winnerShare,
                RainShareAmount = rainShare,
                TriggerReason = $"MEGA_JACKPOT_HIT_{megaDropOrder.order.PlayType}_{megaDropOrder.order.LockedOdds}",
                CreatedAt = DateTime.UtcNow,
            });

            // 1. 头奖得主派彩分红：发放至其钱包并记录流水
            if (winnerShare > 0 && wallets.TryGetValue(megaDropOrder.order.PlayerId, out var winnerWallet))
            {
                var balBefore = winnerWallet.Balance;
                winnerWallet.Balance = MoneyMath.Round(winnerWallet.Balance + winnerShare);
                winnerWallet.Version++;
                winnerWallet.UpdatedAt = DateTime.UtcNow;

                db.WalletTransactions.Add(new WalletTransaction
                {
                    PlayerId = megaDropOrder.order.PlayerId,
                    TransactionType = GameBusinessCodes.MegaJackpotWinTransaction,
                    Amount = winnerShare,
                    BalanceBefore = balBefore,
                    BalanceAfter = winnerWallet.Balance,
                    ReferenceType = GameBusinessCodes.BetOrderReference,
                    ReferenceId = megaDropOrder.order.OrderNo,
                    IdempotencyKey = $"jackpot:win:{roundId}:{megaDropOrder.order.Id}",
                    CreatedAt = DateTime.UtcNow,
                });
            }

            // 2. 普天同庆彩金雨分红：当轮累计下注满门槛（默认 50 币）的活跃玩家均分
            var eligibleRainPlayers = ordersByPlayer
                .Where(kvp => kvp.Value.Sum(o => o.BetAmount + o.DoubleDownAmount) >= ruleSnapshot.JackpotRainMinBetAmount)
                .Select(kvp => kvp.Key)
                .ToList();

            if (rainShare > 0 && eligibleRainPlayers.Count > 0)
            {
                var perUserRain = MoneyMath.Round(rainShare / eligibleRainPlayers.Count);
                if (perUserRain > 0)
                {
                    foreach (var pId in eligibleRainPlayers)
                    {
                        if (wallets.TryGetValue(pId, out var pWallet))
                        {
                            var balBefore = pWallet.Balance;
                            pWallet.Balance = MoneyMath.Round(pWallet.Balance + perUserRain);
                            pWallet.Version++;
                            pWallet.UpdatedAt = DateTime.UtcNow;

                            db.WalletTransactions.Add(new WalletTransaction
                            {
                                PlayerId = pId,
                                TransactionType = GameBusinessCodes.MegaJackpotRainTransaction,
                                Amount = perUserRain,
                                BalanceBefore = balBefore,
                                BalanceAfter = pWallet.Balance,
                                ReferenceType = GameBusinessCodes.RaceRoundReference,
                                ReferenceId = roundId.ToString(),
                                IdempotencyKey = $"jackpot:rain:{roundId}:{pId}",
                                CreatedAt = DateTime.UtcNow,
                            });
                        }
                    }
                }
            }

            pool.TotalPaidOut = MoneyMath.Round(pool.TotalPaidOut + dropAmount);
            pool.CurrentAmount = pool.SeedAmount;
            pool.LastDroppedAt = DateTime.UtcNow;

            round.JackpotDropped = true;
            round.JackpotDropAmount = dropAmount;
        }

        var selections = await db.RaceBetSelections
            .Where(x => x.RoundId == roundId)
            .ToListAsync(cancellationToken);

        var allParticipatingPlayerIds = participatingPlayerIds
            .Union(selections.Select(x => x.PlayerId))
            .Distinct()
            .ToList();

        var stats = await db.PlayerStats
            .Where(x => allParticipatingPlayerIds.Contains(x.PlayerId))
            .ToDictionaryAsync(x => x.PlayerId, cancellationToken);

        foreach (var playerId in allParticipatingPlayerIds)
        {
            if (!stats.TryGetValue(playerId, out var stat))
            {
                stat = new PlayerStat { PlayerId = playerId };
                db.PlayerStats.Add(stat);
                stats[playerId] = stat;
            }

            stat.TotalRoundsParticipated++;

            var playerRoundOrders = orders.Where(x => x.PlayerId == playerId).ToList();
            var totalBet = playerRoundOrders.Sum(x => x.BetAmount + x.DoubleDownAmount);
            var totalNetReward = playerRoundOrders.Sum(x => x.NetReward);
            var totalGrossReward = playerRoundOrders.Sum(x => x.GrossReward);
            var totalFee = playerRoundOrders.Sum(x => x.FeeAmount);

            stat.TotalBetAmount = MoneyMath.Round(stat.TotalBetAmount + totalBet);
            stat.TotalGrossReward = MoneyMath.Round(stat.TotalGrossReward + totalGrossReward);
            stat.TotalFeeAmount = MoneyMath.Round(stat.TotalFeeAmount + totalFee);
            stat.TotalNetReward = MoneyMath.Round(stat.TotalNetReward + totalNetReward);

            // 命中判定（Hit Streak）：只要任意注单命中，即算命中，连胜累加；否则清零
            var isHit = playerRoundOrders.Any(x => x.Status == BetOrderStatus.Won) ||
                        selections.Any(x => x.PlayerId == playerId && x.HorseNo == winnerHorseNo);

            if (isHit)
            {
                stat.TotalRoundsWon++;
                stat.CurrentHitStreak++;
                stat.MaxHitStreak = Math.Max(stat.MaxHitStreak, stat.CurrentHitStreak);
            }
            else
            {
                stat.CurrentHitStreak = 0;
            }

            // 盈利胜局判定（Net Profit Win）：总净收益 > 总投注额
            var isProfit = totalNetReward > totalBet;
            if (isProfit)
            {
                stat.TotalNetProfitWins++;
                stat.CurrentProfitStreak++;
                stat.MaxProfitStreak = Math.Max(stat.MaxProfitStreak, stat.CurrentProfitStreak);
            }
            else
            {
                stat.CurrentProfitStreak = 0;
            }

            stat.WinRate = stat.TotalRoundsParticipated > 0
                ? Math.Round((decimal)stat.TotalRoundsWon / stat.TotalRoundsParticipated, 4, MidpointRounding.AwayFromZero)
                : 0m;
            stat.UpdatedAt = DateTime.UtcNow;
        }

        var winnerPlayerIds = orders.Where(x => x.Status == BetOrderStatus.Won).Select(x => x.PlayerId)
            .Union(selections.Where(x => x.HorseNo == winnerHorseNo).Select(x => x.PlayerId))
            .Distinct()
            .ToList();

        // 5. 社交返佣结算：下级负盈利抽成（固定千分之5即 0.5%），增加同局防对冲刷佣校验
        var participatingPlayersWithReferrer = await db.Players
            .Where(x => allParticipatingPlayerIds.Contains(x.Id) && x.ReferredByPlayerId != null)
            .ToListAsync(cancellationToken);

        foreach (var player in participatingPlayersWithReferrer)
        {
            var referrerId = player.ReferredByPlayerId!.Value;

            // 防对冲套利刷佣金：如果邀请人与被邀请人在同一局均有押注，不发放该局佣金
            var referrerBetInThisRound = allParticipatingPlayerIds.Contains(referrerId);
            if (referrerBetInThisRound)
            {
                gameLogService.AddRaceLog(round, "REFERRAL_COMMISSION_SKIPPED_HEDGING", "INFO", new
                {
                    referrerPlayerId = referrerId,
                    invitedPlayerId = player.Id,
                    roundId,
                    reason = "SAME_ROUND_BET_PROHIBITED",
                });
                continue;
            }

            var playerRoundOrders = orders.Where(x => x.PlayerId == player.Id).ToList();
            var totalBet = playerRoundOrders.Sum(x => x.BetAmount + x.DoubleDownAmount);
            var totalNetReward = playerRoundOrders.Sum(x => x.NetReward);
            var netLoss = totalBet - totalNetReward;

            if (netLoss > 0)
            {
                // 佣金统一下调为千分之 5 (0.5% 即 0.005m)
                var commissionRate = ruleSnapshot.ReferralCommissionRate > 0 ? ruleSnapshot.ReferralCommissionRate : 0.005m;
                var commissionAmount = MoneyMath.Round(netLoss * commissionRate);

                if (commissionAmount > 0)
                {
                    db.PlayerReferralRewards.Add(new PlayerReferralReward
                    {
                        ReferrerPlayerId = referrerId,
                        InvitedPlayerId = player.Id,
                        RewardType = "COMMISSION_NEGATIVE_PROFIT",
                        Amount = commissionAmount,
                        RoundId = roundId,
                        NetLossAmount = netLoss,
                        CommissionRate = commissionRate,
                        Status = "UNCLAIMED",
                        IdempotencyKey = $"commission:{roundId}:{player.Id}:{referrerId}",
                        CreatedAt = DateTime.UtcNow,
                        UpdatedAt = DateTime.UtcNow,
                    });
                }
            }
        }

        await dailyTaskService.RecordRaceResultsAsync(
            allParticipatingPlayerIds,
            winnerPlayerIds,
            DateTime.UtcNow,
            cancellationToken);

        if (achievementService is not null)
        {
            var winningHorse = round.Horses.FirstOrDefault(x => x.HorseNo == winnerHorseNo);
            var isWinningHorseBlackHorse = winningHorse?.IsBlackHorse ?? false;

            foreach (var playerId in allParticipatingPlayerIds)
            {
                await achievementService.AdvanceProgressAsync(playerId, "CAREER", 1, cancellationToken);
                var won = winnerPlayerIds.Contains(playerId);
                await achievementService.UpdateStreakProgressAsync(playerId, won, cancellationToken);
            }
            foreach (var playerId in winnerPlayerIds)
            {
                await achievementService.AdvanceProgressAsync(playerId, "WIN", 1, cancellationToken);

                // 检查该获胜玩家是否有注单命中了黑马（独赢命中第1名黑马，或连赢命中含有黑马的前2名）
                var playerWinningOrders = orders.Where(x => x.PlayerId == playerId && x.Status == BetOrderStatus.Won).ToList();
                var hitBlackHorse = playerWinningOrders.Any(o =>
                    (!string.Equals(o.PlayType, "QUINELLA", StringComparison.OrdinalIgnoreCase) && isWinningHorseBlackHorse) ||
                    (string.Equals(o.PlayType, "QUINELLA", StringComparison.OrdinalIgnoreCase) && hasBlackHorseInTop2));

                if (hitBlackHorse)
                {
                    await achievementService.AdvanceProgressAsync(playerId, "BLACK_HORSE", 1, cancellationToken);
                }
            }
        }

        // 6. 方案 A 角色经验成长结算（+5% 比赛经验加成）
        var baseExp = GameBusinessCodes.CharacterRaceExperience;
        var boostedExp = (long)Math.Round(baseExp * 1.05m); // 方案 A: 角色比赛经验 +5% 微幅增益

        foreach (var playerCharacter in equippedCharacters)
        {
            var previousExp = playerCharacter.Exp;
            playerCharacter.Exp += boostedExp;
            playerCharacter.UpdatedAt = DateTime.UtcNow;

            var levels = await db.CharacterLevelConfigs
                .Where(x => x.CharacterId == playerCharacter.CharacterId)
                .OrderByDescending(x => x.Level)
                .ToListAsync(cancellationToken);

            var targetLevel = levels
                .Where(x => playerCharacter.Exp >= x.RequiredExp)
                .Select(x => x.Level)
                .DefaultIfEmpty(playerCharacter.Level)
                .Max();

            var previousLevel = playerCharacter.Level;
            playerCharacter.Level = Math.Max(playerCharacter.Level, targetLevel);

            // 角色升级自动发放对应等级奖励（金币或道具）并计入流水
            if (targetLevel > previousLevel)
            {
                var newLevels = levels
                    .Where(x => x.Level > previousLevel && x.Level <= targetLevel)
                    .OrderBy(x => x.Level)
                    .ToList();

                foreach (var lvlConfig in newLevels)
                {
                    if (string.Equals(lvlConfig.RewardType, "COIN", StringComparison.OrdinalIgnoreCase))
                    {
                        var coinAmount = ParseRewardAmount(lvlConfig.RewardPayload);
                        if (coinAmount > 0m)
                        {
                            if (!wallets.TryGetValue(playerCharacter.PlayerId, out var pWallet))
                            {
                                pWallet = await WalletConcurrency.LockAsync(db, playerCharacter.PlayerId, cancellationToken)
                                    ?? throw new BusinessRuleException("WALLET_NOT_FOUND", $"玩家 {playerCharacter.PlayerId} 钱包不存在");
                                wallets[playerCharacter.PlayerId] = pWallet;
                            }

                            var balBefore = pWallet.Balance;
                            pWallet.Balance = MoneyMath.Round(pWallet.Balance + coinAmount);
                            pWallet.Version++;
                            pWallet.UpdatedAt = DateTime.UtcNow;

                            db.WalletTransactions.Add(new WalletTransaction
                            {
                                PlayerId = playerCharacter.PlayerId,
                                TransactionType = "CHARACTER_LEVEL_REWARD",
                                Amount = coinAmount,
                                BalanceBefore = balBefore,
                                BalanceAfter = pWallet.Balance,
                                ReferenceType = "CHARACTER_LEVEL",
                                ReferenceId = $"{playerCharacter.CharacterId}:{lvlConfig.Level}",
                                IdempotencyKey = $"char_lvl:{playerCharacter.PlayerId}:{playerCharacter.CharacterId}:{lvlConfig.Level}",
                                CreatedAt = DateTime.UtcNow,
                            });
                        }
                    }
                    else if (string.Equals(lvlConfig.RewardType, "ITEM", StringComparison.OrdinalIgnoreCase))
                    {
                        var (itemCode, qty) = ParseItemReward(lvlConfig.RewardPayload);
                        if (!string.IsNullOrEmpty(itemCode) && qty > 0)
                        {
                            var itemCatalog = await db.ItemCatalogs.FirstOrDefaultAsync(
                                x => x.ItemCode == itemCode, cancellationToken);
                            if (itemCatalog is not null)
                            {
                                var playerItem = await db.PlayerItems.FirstOrDefaultAsync(
                                    x => x.PlayerId == playerCharacter.PlayerId && x.ItemId == itemCatalog.Id, cancellationToken);
                                var itemBefore = playerItem?.Quantity ?? 0;
                                if (playerItem is null)
                                {
                                    playerItem = new PlayerItem
                                    {
                                        PlayerId = playerCharacter.PlayerId,
                                        ItemId = itemCatalog.Id,
                                        Quantity = qty,
                                        CreatedAt = DateTime.UtcNow,
                                        UpdatedAt = DateTime.UtcNow,
                                    };
                                    db.PlayerItems.Add(playerItem);
                                }
                                else
                                {
                                    playerItem.Quantity += qty;
                                    playerItem.UpdatedAt = DateTime.UtcNow;
                                }

                                db.PlayerItemTransactions.Add(new PlayerItemTransaction
                                {
                                    PlayerId = playerCharacter.PlayerId,
                                    ItemId = itemCatalog.Id,
                                    ChangeType = "CHARACTER_LEVEL_REWARD",
                                    QuantityChange = qty,
                                    QuantityBefore = itemBefore,
                                    QuantityAfter = playerItem.Quantity,
                                    ReferenceType = "CHARACTER_LEVEL",
                                    ReferenceId = $"{playerCharacter.CharacterId}:{lvlConfig.Level}",
                                    IdempotencyKey = $"char_lvl_item:{playerCharacter.PlayerId}:{playerCharacter.CharacterId}:{lvlConfig.Level}",
                                    CreatedAt = DateTime.UtcNow,
                                });
                            }
                        }
                    }
                }
            }

            gameLogService.AddCharacterLog(
                playerCharacter.PlayerId,
                playerCharacter.CharacterId,
                playerCharacter.Id,
                "CHARACTER_RACE_EXP",
                "SUCCESS",
                new
                {
                    roundId,
                    expBefore = previousExp,
                    expAfter = playerCharacter.Exp,
                    levelBefore = previousLevel,
                    levelAfter = playerCharacter.Level,
                    expGain = boostedExp,
                });
        }

        var participatingPlayers = await db.Players
            .Where(x => allParticipatingPlayerIds.Contains(x.Id))
            .ToListAsync(cancellationToken);

        foreach (var player in participatingPlayers)
        {
            player.Exp += boostedExp;
            player.UpdatedAt = DateTime.UtcNow;
            var character = equippedCharacters.FirstOrDefault(x => x.PlayerId == player.Id);
            if (character is not null)
            {
                player.Level = Math.Max(player.Level, character.Level);
            }
        }

        // 7. 马匹统计推进
        var horseTemplateIds = round.Horses.Select(x => x.HorseTemplateId).Distinct().ToList();
        var horseCatalogs = await db.HorseCatalogs
            .Where(x => horseTemplateIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        foreach (var raceHorse in round.Horses)
        {
            if (!horseCatalogs.TryGetValue(raceHorse.HorseTemplateId, out var horseCatalog) || raceHorse.FinalRank is null)
            {
                continue;
            }

            horseCatalog.TotalRaces++;
            switch (raceHorse.FinalRank.Value)
            {
                case 1:
                    horseCatalog.Rank1Count++;
                    horseCatalog.WinCount++;
                    break;
                case 2:
                    horseCatalog.Rank2Count++;
                    break;
                case 3:
                    horseCatalog.Rank3Count++;
                    break;
                case 4:
                    horseCatalog.Rank4Count++;
                    break;
                case 5:
                    horseCatalog.Rank5Count++;
                    break;
                case 6:
                    horseCatalog.Rank6Count++;
                    break;
            }

            horseCatalog.WinRate = CalculateProbability(horseCatalog.WinCount, horseCatalog.TotalRaces);
            horseCatalog.Rank1Probability = CalculateProbability(horseCatalog.Rank1Count, horseCatalog.TotalRaces);
            horseCatalog.Rank2Probability = CalculateProbability(horseCatalog.Rank2Count, horseCatalog.TotalRaces);
            horseCatalog.Rank3Probability = CalculateProbability(horseCatalog.Rank3Count, horseCatalog.TotalRaces);
            horseCatalog.Rank4Probability = CalculateProbability(horseCatalog.Rank4Count, horseCatalog.TotalRaces);
            horseCatalog.Rank5Probability = CalculateProbability(horseCatalog.Rank5Count, horseCatalog.TotalRaces);
            horseCatalog.Rank6Probability = CalculateProbability(horseCatalog.Rank6Count, horseCatalog.TotalRaces);
            horseCatalog.UpdatedAt = DateTime.UtcNow;
        }

        foreach (var raceHorse in round.Horses)
        {
            gameLogService.AddHorseLog(
                raceHorse,
                "HORSE_RESULT_SETTLED",
                "SUCCESS",
                new
                {
                    raceHorse.FinalRank,
                    raceHorse.FinishTime,
                    raceHorse.IsBlackHorse,
                    raceHorse.IsBlackHorseCandidate,
                    raceHorse.BlackHorseHitCount,
                    statisticsUpdated = true,
                });
        }

        round.WinnerHorseNo = winnerHorseNo;
        round.SecondHorseNo = secondHorse;
        round.State = RaceState.Finished;
        round.SettlementAt = DateTime.UtcNow;
        round.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        // 8. 绑定中奖流水 ID
        foreach (var settlementLog in db.BetOrderSettlementLogs.Local)
        {
            var order = orders.FirstOrDefault(x => x.Id == settlementLog.BetOrderId);
            if (order is null || (settlementLog.ResultStatus != "WIN" && !settlementLog.ResultStatus.StartsWith("WIN_")))
            {
                continue;
            }

            var rewardTransaction = db.WalletTransactions.Local
                .FirstOrDefault(x =>
                    x.ReferenceType == GameBusinessCodes.BetOrderReference
                    && x.ReferenceId == order.OrderNo
                    && x.TransactionType == GameBusinessCodes.RaceRewardTransaction);

            settlementLog.RewardTransactionId = rewardTransaction?.Id;
        }

        await db.SaveChangesAsync(cancellationToken);

        // 9. 业务决策 2：真破产救济金申请判定
        // 参赛结算输光、当前余额为 0 且全局无任何待决在途注单时才真正启动救济金倒计时
        var reliefScheduled = false;
        foreach (var pId in allParticipatingPlayerIds)
        {
            if (wallets.TryGetValue(pId, out var pWallet) && pWallet.Balance == 0m)
            {
                var hasAnyPending = await db.BetOrders
                    .AnyAsync(x => x.PlayerId == pId && x.Status == BetOrderStatus.Pending, cancellationToken);

                if (!hasAnyPending)
                {
                    var lastTxId = await db.WalletTransactions
                        .Where(x => x.PlayerId == pId)
                        .OrderByDescending(x => x.Id)
                        .Select(x => x.Id)
                        .FirstOrDefaultAsync(cancellationToken);

                    if (lastTxId > 0)
                    {
                        await ReliefScheduler.ScheduleIfNeededAsync(
                            db,
                            pId,
                            lastTxId,
                            DateTime.UtcNow,
                            cancellationToken);
                        reliefScheduled = true;
                    }
                }
            }
        }

        if (reliefScheduled)
        {
            await db.SaveChangesAsync(cancellationToken);
        }

        await transaction.CommitAsync(cancellationToken);
    }

    /// <summary>
    /// 当轮次异常或管理员取消赛事时，执行全额自动退款闭环，保证玩家资金绝对安全。
    /// </summary>
    public async Task<int> RefundRoundAsync(long roundId, string cancelReason, CancellationToken cancellationToken = default)
    {
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var round = await db.RaceRounds
            .FirstOrDefaultAsync(x => x.Id == roundId, cancellationToken);
        if (round is null || round.State == RaceState.Finished)
        {
            return 0;
        }

        round.State = RaceState.Cancelled;
        round.CancelledAt = DateTime.UtcNow;
        round.CancelReason = cancelReason;
        round.UpdatedAt = DateTime.UtcNow;

        var pendingOrders = await db.BetOrders
            .Where(x => x.RoundId == roundId && x.Status == BetOrderStatus.Pending)
            .OrderBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var uniquePlayerIds = pendingOrders
            .Select(x => x.PlayerId)
            .Distinct()
            .OrderBy(x => x)
            .ToList();

        var wallets = new Dictionary<long, Wallet>();
        foreach (var pId in uniquePlayerIds)
        {
            var pWallet = await WalletConcurrency.LockAsync(db, pId, cancellationToken)
                ?? throw new BusinessRuleException("WALLET_NOT_FOUND", $"玩家 {pId} 钱包不存在");
            wallets[pId] = pWallet;
        }

        var refundedCount = 0;
        var orderRefundPairs = new List<(BetOrder Order, WalletTransaction RefundTx)>();
        foreach (var order in pendingOrders)
        {
            var wallet = wallets[order.PlayerId];
            var refundAmount = order.BetAmount + order.DoubleDownAmount;
            var balanceBefore = wallet.Balance;
            wallet.Balance = MoneyMath.Round(wallet.Balance + refundAmount);
            wallet.Version++;
            wallet.UpdatedAt = DateTime.UtcNow;

            var refundTx = new WalletTransaction
            {
                PlayerId = order.PlayerId,
                TransactionType = GameBusinessCodes.BetRefundTransaction,
                Amount = refundAmount,
                BalanceBefore = balanceBefore,
                BalanceAfter = wallet.Balance,
                ReferenceType = GameBusinessCodes.BetOrderReference,
                ReferenceId = order.OrderNo,
                IdempotencyKey = $"refund:{order.Id}",
                CreatedAt = DateTime.UtcNow,
            };

            db.WalletTransactions.Add(refundTx);
            order.Status = BetOrderStatus.Refunded;
            order.StatusReason = "ROUND_CANCELLED";
            order.SettledAt = DateTime.UtcNow;
            order.UpdatedAt = DateTime.UtcNow;

            orderRefundPairs.Add((order, refundTx));
            refundedCount++;
        }

        await db.SaveChangesAsync(cancellationToken);

        // 统一绑定已持久化生成的退款流水主键 ID，防止外键约束引用未入库的 0 ID
        foreach (var (order, refundTx) in orderRefundPairs)
        {
            order.RefundTransactionId = refundTx.Id;
        }

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);
        return refundedCount;
    }

    private static decimal CalculateProbability(long numerator, long denominator)
    {
        return denominator <= 0
            ? 0m
            : Math.Round((decimal)numerator / denominator, 6, MidpointRounding.AwayFromZero);
    }

    private static decimal ParseRewardAmount(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return 0m;
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            if (doc.RootElement.TryGetProperty("amount", out var amountProp) && amountProp.TryGetDecimal(out var val))
            {
                return val;
            }
        }
        catch { }
        return 0m;
    }

    private static (string? itemCode, int quantity) ParseItemReward(string? payloadJson)
    {
        if (string.IsNullOrWhiteSpace(payloadJson)) return (null, 0);
        try
        {
            using var doc = JsonDocument.Parse(payloadJson);
            var code = doc.RootElement.TryGetProperty("itemCode", out var c) ? c.GetString() : null;
            var qty = doc.RootElement.TryGetProperty("quantity", out var q) && q.TryGetInt32(out var v) ? v : 1;
            return (code, qty);
        }
        catch { }
        return (null, 0);
    }
}

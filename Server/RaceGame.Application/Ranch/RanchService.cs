using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Abstractions;
using RaceGame.Application.Common;
using RaceGame.Application.Configuration;
using RaceGame.Domain.Entities;
using System.Data;
using System.Security.Cryptography;
using System.Text;

namespace RaceGame.Application.Ranch;

public class RanchService(IGameDbContext db, RaceRuleConfigService ruleConfigService) : IRanchService
{
    private static readonly int[] FoalExpTable = [100, 120, 150, 190, 240, 300, 370, 450, 550];
    private static readonly int[] JuvenileExpTable = [650, 750, 880, 1020, 1180, 1350, 1550, 1800, 2100, 2500];

    public async Task<RanchCatalogDto> GetRanchCatalogAsync(CancellationToken ct = default)
    {
        var tiers = await db.RanchFoalTiers
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var feeds = await db.RanchFeedCatalogs
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var trainings = await db.RanchTrainingCatalogs
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var cares = await db.RanchCareCatalogs
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ToListAsync(ct);

        var rules = await ruleConfigService.GetCurrentAsync(DateTime.UtcNow, ct);

        var foalTierDtos = tiers.Select(t =>
        {
            var names = new List<string>();
            if (!string.IsNullOrWhiteSpace(t.RandomNamesJson))
            {
                try { names = System.Text.Json.JsonSerializer.Deserialize<List<string>>(t.RandomNamesJson) ?? new(); }
                catch { }
            }
            return new FoalTierCatalogDto(
                t.TierCode,
                t.TierNameZh,
                t.TierNameEn,
                t.AdoptPrice,
                t.MinPotential,
                t.MaxPotential,
                t.BaseSpeed,
                t.BaseStamina,
                t.BaseBurst,
                t.BaseAgility,
                t.BaseTemperament,
                t.DescriptionZh,
                t.DescriptionEn,
                names);
        }).ToList();

        var feedDtos = feeds.Select(f => new FeedCatalogDto(
            f.FeedCode,
            f.FeedNameZh,
            f.FeedNameEn,
            f.FeedCategory,
            f.CoinCost,
            f.HungerFill,
            f.ExpGain,
            f.ConditionBonus,
            f.BurstBonus,
            f.TemperamentBonus,
            f.DescriptionZh,
            f.DescriptionEn)).ToList();

        var trainingDtos = trainings.Select(tr => new TrainingCatalogDto(
            tr.TrainingType,
            tr.TrainingNameZh,
            tr.TrainingNameEn,
            tr.CoinCost,
            tr.EnergyCost,
            tr.ExpGain,
            tr.HoofWearDelta,
            tr.ConditionLoss,
            tr.SpeedDelta,
            tr.StaminaDelta,
            tr.BurstDelta,
            tr.AgilityDelta,
            tr.TemperamentDelta,
            tr.DescriptionZh,
            tr.DescriptionEn)).ToList();

        var careDtos = cares.Select(c => new CareCatalogDto(
            c.CareType,
            c.CareNameZh,
            c.CareNameEn,
            c.CoinCost,
            c.CooldownHours,
            c.IntimacyBonus,
            c.ConditionBonus,
            c.HealthBonus,
            c.EnergyBonus,
            c.HoofWearRelief,
            c.ClearsIllness,
            c.ClearsInjury,
            c.DescriptionZh,
            c.DescriptionEn)).ToList();

        return new RanchCatalogDto(
            foalTierDtos,
            feedDtos,
            trainingDtos,
            careDtos,
            rules.QualificationTrialBenchmark,
            rules.QualificationTrialBaseTime,
            rules.QualificationLicenseFee);
    }

    public async Task<RanchHorseDto> AdoptFoalAsync(
        long playerId,
        string customName,
        string pedigreeTier,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var tierKey = (pedigreeTier ?? "WILD").Trim().ToUpperInvariant();
        var foalTier = await db.RanchFoalTiers.FirstOrDefaultAsync(x => x.TierCode == tierKey && x.IsEnabled, ct)
            ?? await db.RanchFoalTiers.FirstOrDefaultAsync(x => x.TierCode == "WILD", ct)
            ?? new RanchFoalTier
            {
                TierCode = tierKey,
                TierNameZh = "怀俄明荒野改良马",
                AdoptPrice = 1000.00m,
                BaseSpeed = 38.00m,
                BaseStamina = 38.00m,
                BaseBurst = 36.00m,
                BaseAgility = 36.00m,
                BaseTemperament = 40.00m,
                MinPotential = 60.00m,
                MaxPotential = 70.00m
            };

        var tier = foalTier.TierCode;
        var cost = foalTier.AdoptPrice;

        decimal GenFloat(decimal baseVal) => Math.Round(baseVal + (decimal)RandomNumberGenerator.GetInt32(-150, 151) / 100m, 2);
        var baseSpeed = GenFloat(foalTier.BaseSpeed);
        var baseStamina = GenFloat(foalTier.BaseStamina);
        var baseBurst = GenFloat(foalTier.BaseBurst);
        var baseAgility = GenFloat(foalTier.BaseAgility);
        var baseTemp = GenFloat(foalTier.BaseTemperament);
        var potCap = Math.Clamp(Math.Round(foalTier.MinPotential + (decimal)RandomNumberGenerator.GetInt32(0, 100) / 100m * (foalTier.MaxPotential - foalTier.MinPotential), 2), 60.00m, 100.00m);
        // 确保潜能绝对不低于基础五维生成值，防止触发数据库 CHECK (potential >= stat) 异常
        potCap = Math.Max(potCap, Math.Max(baseSpeed, Math.Max(baseStamina, Math.Max(baseBurst, Math.Max(baseAgility, baseTemp)))));

        var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
            ? $"adopt_foal:{playerId}:{DateTime.UtcNow.Ticks}"
            : idempotencyKey.Trim();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingTx = await db.WalletTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
            if (existingTx != null)
            {
                var existingHorse = await db.RanchHorses
                    .Where(x => x.OwnerPlayerId == playerId && x.PedigreeTier == tier)
                    .OrderByDescending(x => x.CreatedAt)
                    .FirstOrDefaultAsync(ct);
                if (existingHorse != null)
                {
                    return ToDto(existingHorse);
                }
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");

        if (wallet.Balance < cost)
        {
            throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"金币不足，认购此幼驹需要 {cost:N0} 金币");
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - cost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "RANCH_BUY_FOAL",
            Amount = -cost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "RANCH_HORSE",
            ReferenceId = tier,
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        var randBytes = new byte[4];
        RandomNumberGenerator.Fill(randBytes);
        var hexSuffix = BitConverter.ToString(randBytes).Replace("-", "").ToUpperInvariant()[..6];
        var horseCode = $"#WY-{DateTime.UtcNow.Year}-{hexSuffix}";

        var genderRand = RandomNumberGenerator.GetInt32(0, 2);
        var gender = genderRand == 0 ? "STALLION" : "MARE";

        string name;
        if (!string.IsNullOrWhiteSpace(customName))
        {
            name = customName.Trim();
        }
        else
        {
            var names = new List<string>();
            if (!string.IsNullOrWhiteSpace(foalTier.RandomNamesJson))
            {
                try { names = System.Text.Json.JsonSerializer.Deserialize<List<string>>(foalTier.RandomNamesJson) ?? new(); }
                catch { }
            }
            if (names.Count > 0)
            {
                name = names[RandomNumberGenerator.GetInt32(0, names.Count)];
            }
            else
            {
                name = foalTier.TierNameZh;
            }
        }

        var horse = new RanchHorse
        {
            OwnerPlayerId = playerId,
            HorseCode = horseCode,
            CustomName = name,
            Gender = gender,
            GrowthStage = "FOAL",
            Level = 1,
            CurrentExp = 0,
            MaxExp = FoalExpTable[0],
            PedigreeTier = tier,
            Generation = 1,
            CoatColor = "BAY",
            RunningStyle = "STALKER",
            SpeedStat = baseSpeed,
            SpeedPotential = potCap,
            StaminaStat = baseStamina,
            StaminaPotential = potCap,
            BurstStat = baseBurst,
            BurstPotential = potCap,
            AgilityStat = baseAgility,
            AgilityPotential = potCap,
            TemperamentStat = baseTemp,
            TemperamentPotential = potCap,
            HungerLevel = 0,
            StaminaEnergy = 100,
            ConditionLevel = 100,
            HoofWear = 0,
            IntimacyLevel = 10,
            HealthPoints = 100,
            SubStatus = "IDLE",
            LastDigestedAt = DateTime.UtcNow,
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        db.RanchHorses.Add(horse);
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return ToDto(horse);
    }

    public async Task<List<RanchHorseDto>> GetMyHorsesAsync(long playerId, CancellationToken ct = default)
    {
        var horses = await db.RanchHorses
            .Where(x => x.OwnerPlayerId == playerId && x.SubStatus != "RETIRED")
            .OrderByDescending(x => x.CreatedAt)
            .ToListAsync(ct);

        var changed = false;
        var now = DateTime.UtcNow;
        foreach (var h in horses)
        {
            if (UpdateDigestionAndEnergy(h, now))
            {
                changed = true;
            }
        }

        if (changed)
        {
            await db.SaveChangesAsync(ct);
        }

        return horses.Select(ToDto).ToList();
    }

    public async Task<RanchHorseDto?> GetHorseDetailsAsync(long playerId, long horseId, CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct);

        if (horse is null)
        {
            return null;
        }

        if (UpdateDigestionAndEnergy(horse, DateTime.UtcNow))
        {
            await db.SaveChangesAsync(ct);
        }

        return ToDto(horse);
    }

    public async Task<FeedResultDto> FeedHorseAsync(
        long playerId,
        long horseId,
        string feedCode,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在或已转让");

        if (horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "RETIRED")
        {
            throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", "赛马当前处于锁定或比赛状态，不可喂养");
        }

        // 投喂前先行惰性代谢追赶
        UpdateDigestionAndEnergy(horse, DateTime.UtcNow);

        var feedCodeUpper = (feedCode ?? "FEED_TIMOTHY").Trim().ToUpperInvariant();
        var feedItem = await db.RanchFeedCatalogs.FirstOrDefaultAsync(x => x.FeedCode == feedCodeUpper && x.IsEnabled, ct)
            ?? await db.RanchFeedCatalogs.FirstOrDefaultAsync(x => x.FeedCode == "FEED_TIMOTHY", ct)
            ?? new RanchFeedCatalog
            {
                FeedCode = feedCodeUpper,
                FeedNameZh = "基础提摩西草",
                CoinCost = 10.00m,
                HungerFill = 35,
                ConditionBonus = 0,
                ExpGain = 50,
                FeedCategory = "ROUGHAGE"
            };

        var cost = feedItem.CoinCost;
        var exp = feedItem.ExpGain;
        var hungerAdd = feedItem.HungerFill;
        var isConcentrate = string.Equals(feedItem.FeedCategory, "CONCENTRATE", StringComparison.OrdinalIgnoreCase);

        if (horse.HungerLevel + hungerAdd > 100)
        {
            throw new BusinessRuleException("RANCH_FEED_STOMACH_FULL", "赛马饱腹度已达上限 (100)，暂时无法继续进食");
        }

        var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
            ? $"feed:{playerId}:{horseId}:{DateTime.UtcNow.Ticks}"
            : idempotencyKey.Trim();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingFeed = await db.RanchFeedLogs
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
            if (existingFeed != null)
            {
                var curWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
                return new FeedResultDto(
                    Success: true,
                    ColicTriggered: false,
                    NewLevel: horse.Level,
                    NewExp: horse.CurrentExp,
                    NewHunger: horse.HungerLevel,
                    NewCondition: horse.ConditionLevel,
                    GrowthStage: horse.GrowthStage,
                    NewBalance: curWallet?.Balance ?? 0m);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        if (wallet.Balance < cost)
        {
            throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"金币不足，投喂需要 {cost:N0} 金币");
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - cost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "RANCH_FEED",
            Amount = -cost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "RANCH_HORSE",
            ReferenceId = horseId.ToString(),
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        // 积食风险判定：最近3小时如果连续3次精料投喂，有 25% 概率积食腹痛
        bool colicTriggered = false;
        if (isConcentrate)
        {
            var threeHoursAgo = DateTime.UtcNow.AddHours(-3);
            var recentFeeds = await db.RanchFeedLogs
                .Where(x => x.HorseId == horseId && x.CreatedAt >= threeHoursAgo)
                .OrderByDescending(x => x.CreatedAt)
                .Take(2)
                .ToListAsync(ct);

            var concentrateCodes = await db.RanchFeedCatalogs
                .Where(x => x.FeedCategory == "CONCENTRATE")
                .Select(x => x.FeedCode)
                .ToListAsync(ct);
            if (concentrateCodes.Count == 0)
            {
                concentrateCodes = ["FEED_OATS", "FEED_PROTEIN"];
            }

            if (recentFeeds.Count >= 2 && recentFeeds.All(f => concentrateCodes.Contains(f.FeedCode)))
            {
                if (RandomNumberGenerator.GetInt32(0, 100) < 25)
                {
                    colicTriggered = true;
                    horse.ConditionLevel = 20;
                    horse.HealthPoints = Math.Max(20, horse.HealthPoints - 15);
                    horse.SubStatus = "SICK";
                }
            }
        }

        var oldHunger = horse.HungerLevel;
        var oldCond = horse.ConditionLevel;
        horse.HungerLevel = Math.Clamp(horse.HungerLevel + hungerAdd, 0, 100);

        if (!colicTriggered)
        {
            if (feedItem.ConditionBonus != 0)
            {
                horse.ConditionLevel = Math.Clamp(horse.ConditionLevel + feedItem.ConditionBonus, 0, 100);
            }
            if (feedItem.TemperamentBonus > 0)
            {
                horse.TemperamentStat = Math.Min(horse.TemperamentPotential, horse.TemperamentStat + feedItem.TemperamentBonus);
            }
            if (feedItem.BurstBonus > 0)
            {
                horse.BurstStat = Math.Min(horse.BurstPotential, horse.BurstStat + feedItem.BurstBonus);
            }
        }

        ApplyExpAndLevelUp(horse, exp);

        db.RanchFeedLogs.Add(new RanchFeedLog
        {
            HorseId = horseId,
            PlayerId = playerId,
            FeedCode = feedCodeUpper,
            CoinCost = cost,
            ExpGained = exp,
            HungerBefore = oldHunger,
            HungerAfter = horse.HungerLevel,
            ConditionBefore = oldCond,
            ConditionAfter = horse.ConditionLevel,
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        horse.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new FeedResultDto(
            Success: true,
            ColicTriggered: colicTriggered,
            NewLevel: horse.Level,
            NewExp: horse.CurrentExp,
            NewHunger: horse.HungerLevel,
            NewCondition: horse.ConditionLevel,
            GrowthStage: horse.GrowthStage,
            NewBalance: wallet.Balance);
    }

    public async Task<TrainResultDto> TrainHorseAsync(
        long playerId,
        long horseId,
        string trainingType,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在");

        // 训练前先行惰性代谢与跨天体力恢复追赶 (确保跨天体力重置为 100)
        UpdateDigestionAndEnergy(horse, DateTime.UtcNow);

        if (horse.GrowthStage == "FOAL")
        {
            throw new BusinessRuleException("RANCH_HORSE_STAGE_MISMATCH", "幼驹阶段骨骼发育未成熟，严禁参加专项体能训练");
        }

        if (horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "PREGNANT" or "INJURED" or "SICK" or "RETIRED")
        {
            throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", $"赛马当前处于 {horse.SubStatus} 状态，禁止训练");
        }

        var trainingTypeUpper = (trainingType ?? "SPRINT").Trim().ToUpperInvariant();
        var trainItem = await db.RanchTrainingCatalogs.FirstOrDefaultAsync(x => x.TrainingType == trainingTypeUpper && x.IsEnabled, ct)
            ?? await db.RanchTrainingCatalogs.FirstOrDefaultAsync(x => x.TrainingType == "SPRINT", ct)
            ?? new RanchTrainingCatalog
            {
                TrainingType = trainingTypeUpper,
                TrainingNameZh = "冲刺突击训练",
                CoinCost = 30.00m,
                ExpGain = 100,
                EnergyCost = 25,
                HoofWearDelta = 8,
                ConditionLoss = 5,
                SpeedDelta = 0.80m,
                BurstDelta = 0.40m
            };

        if (horse.StaminaEnergy < trainItem.EnergyCost)
        {
            throw new BusinessRuleException("RANCH_TRAIN_ENERGY_EMPTY", $"赛马体力精力不足 (需至少 {trainItem.EnergyCost} 点)，请明日重置或牵引漫步恢复");
        }

        var cost = trainItem.CoinCost;
        var exp = trainItem.ExpGain;
        var hoofWear = trainItem.HoofWearDelta;
        var condLoss = trainItem.ConditionLoss;

        var spdGain = trainItem.SpeedDelta;
        var staGain = trainItem.StaminaDelta;
        var brsGain = trainItem.BurstDelta;
        var agiGain = trainItem.AgilityDelta;
        var tempGain = trainItem.TemperamentDelta;

        var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
            ? $"train:{playerId}:{horseId}:{DateTime.UtcNow.Ticks}"
            : idempotencyKey.Trim();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingTrain = await db.RanchTrainingLogs
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
            if (existingTrain != null)
            {
                var curWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
                return new TrainResultDto(
                    Success: true,
                    TrainingType: existingTrain.TrainingType,
                    SpeedDelta: existingTrain.SpeedDelta,
                    StaminaDelta: existingTrain.StaminaDelta,
                    BurstDelta: existingTrain.BurstDelta,
                    AgilityDelta: existingTrain.AgilityDelta,
                    TemperamentDelta: existingTrain.TemperamentDelta,
                    NewStaminaEnergy: horse.StaminaEnergy,
                    NewHoofWear: horse.HoofWear,
                    NewCondition: horse.ConditionLevel,
                    NewLevel: horse.Level,
                    NewExp: horse.CurrentExp,
                    NewBalance: curWallet?.Balance ?? 0m);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        if (wallet.Balance < cost)
        {
            throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"金币不足，训练需要 {cost:N0} 金币");
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - cost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "RANCH_TRAIN",
            Amount = -cost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "RANCH_HORSE",
            ReferenceId = horseId.ToString(),
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        // 属性增益受潜能绝对封顶约束；达到 Lv.20 成年体型后属性封顶锁定 (PRD 3.3 方案 C 与 TC-R04)
        bool isAdultLocked = horse.Level >= 20 || horse.GrowthStage is "MATURE" or "PRO_RACER";
        decimal actualSpd = isAdultLocked ? 0m : Math.Min(spdGain, Math.Max(0m, horse.SpeedPotential - horse.SpeedStat));
        decimal actualSta = isAdultLocked ? 0m : Math.Min(staGain, Math.Max(0m, horse.StaminaPotential - horse.StaminaStat));
        decimal actualBrs = isAdultLocked ? 0m : Math.Min(brsGain, Math.Max(0m, horse.BurstPotential - horse.BurstStat));
        decimal actualAgi = isAdultLocked ? 0m : Math.Min(agiGain, Math.Max(0m, horse.AgilityPotential - horse.AgilityStat));
        decimal actualTmp = isAdultLocked ? 0m : Math.Min(tempGain, Math.Max(0m, horse.TemperamentPotential - horse.TemperamentStat));

        horse.SpeedStat += actualSpd;
        horse.StaminaStat += actualSta;
        horse.BurstStat += actualBrs;
        horse.AgilityStat += actualAgi;
        horse.TemperamentStat += actualTmp;

        horse.StaminaEnergy = Math.Max(0, horse.StaminaEnergy - trainItem.EnergyCost);
        horse.HoofWear = Math.Clamp(horse.HoofWear + hoofWear, 0, 100);
        horse.ConditionLevel = Math.Clamp(horse.ConditionLevel - condLoss, 0, 100);

        // 若蹄铁磨损超过 80%，疲劳加重且扣减健康度，触发伤病闭环
        if (horse.HoofWear >= 80)
        {
            horse.ConditionLevel = Math.Max(0, horse.ConditionLevel - 10);
            horse.HealthPoints = Math.Max(10, horse.HealthPoints - 10);
            if (horse.HealthPoints <= 60 && horse.SubStatus == "IDLE")
            {
                horse.SubStatus = "INJURED";
            }
        }

        ApplyExpAndLevelUp(horse, exp);

        db.RanchTrainingLogs.Add(new RanchTrainingLog
        {
            HorseId = horseId,
            PlayerId = playerId,
            TrainingType = trainingTypeUpper,
            StaminaEnergyCost = trainItem.EnergyCost,
            CoinCost = cost,
            ExpGained = exp,
            SpeedDelta = actualSpd,
            StaminaDelta = actualSta,
            BurstDelta = actualBrs,
            AgilityDelta = actualAgi,
            TemperamentDelta = actualTmp,
            HoofWearDelta = hoofWear,
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        horse.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new TrainResultDto(
            Success: true,
            TrainingType: trainingTypeUpper,
            SpeedDelta: actualSpd,
            StaminaDelta: actualSta,
            BurstDelta: actualBrs,
            AgilityDelta: actualAgi,
            TemperamentDelta: actualTmp,
            NewStaminaEnergy: horse.StaminaEnergy,
            NewHoofWear: horse.HoofWear,
            NewCondition: horse.ConditionLevel,
            NewLevel: horse.Level,
            NewExp: horse.CurrentExp,
            NewBalance: wallet.Balance);
    }

    public async Task<CareResultDto> CareHorseAsync(
        long playerId,
        long horseId,
        string careType,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在");

        if (horse.GrowthStage == "FOAL")
        {
            throw new BusinessRuleException("RANCH_HORSE_STAGE_MISMATCH", "幼驹阶段无需钉蹄与专业理疗，只需优质饲草静养");
        }

        if (horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "RETIRED")
        {
            throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", $"赛马当前处于 {horse.SubStatus} 状态，不可进行医护");
        }

        var normCare = careType.ToUpperInvariant();
        var careItem = await db.RanchCareCatalogs.FirstOrDefaultAsync(x => x.CareType == normCare && x.IsEnabled, ct)
            ?? await db.RanchCareCatalogs.FirstOrDefaultAsync(x => x.CareType == "GROOM", ct)
            ?? new RanchCareCatalog
            {
                CareType = normCare,
                CareNameZh = "基础洗刷毛发",
                CoinCost = 5.00m,
                IntimacyBonus = 10,
                ConditionBonus = 5,
                HealthBonus = 0,
                EnergyBonus = 0,
                HoofWearRelief = 0
            };

        if (careItem.CooldownHours > 0)
        {
            var cooldownHours = careItem.CooldownHours;
            var cooldownCutoff = DateTime.UtcNow.AddHours(-cooldownHours);
            var refType = $"RANCH_CARE_{normCare}";
            var recentCare = await db.WalletTransactions
                .Where(x => x.PlayerId == playerId && x.ReferenceType == refType && x.ReferenceId == horseId.ToString() && x.CreatedAt >= cooldownCutoff)
                .OrderByDescending(x => x.CreatedAt)
                .FirstOrDefaultAsync(ct);

            if (recentCare != null)
            {
                var waitMins = (int)Math.Ceiling((recentCare.CreatedAt.AddHours(cooldownHours) - DateTime.UtcNow).TotalMinutes);
                throw new BusinessRuleException("RANCH_CARE_COOLDOWN", $"{careItem.CareNameZh}尚在冷却中，请等待 {Math.Max(1, waitMins)} 分钟后再进行");
            }
        }

        decimal cost = careItem.CoinCost;

        var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
            ? $"care:{playerId}:{horseId}:{DateTime.UtcNow.Ticks}"
            : idempotencyKey.Trim();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingTx = await db.WalletTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
            if (existingTx != null)
            {
                var curWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
                return new CareResultDto(
                    Success: true,
                    CareType: careType,
                    NewCondition: horse.ConditionLevel,
                    NewStaminaEnergy: horse.StaminaEnergy,
                    NewIntimacy: horse.IntimacyLevel,
                    NewHealthPoints: horse.HealthPoints,
                    SubStatus: horse.SubStatus,
                    NewBalance: curWallet?.Balance ?? 0m);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        if (wallet.Balance < cost)
        {
            throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"金币不足，此项医护需要 {cost:N0} 金币");
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - cost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "RANCH_VET",
            Amount = -cost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = careItem.CooldownHours > 0 ? $"RANCH_CARE_{normCare}" : "RANCH_HORSE",
            ReferenceId = horseId.ToString(),
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        if (careItem.IntimacyBonus > 0) horse.IntimacyLevel = Math.Clamp(horse.IntimacyLevel + careItem.IntimacyBonus, 0, 100);
        if (careItem.ConditionBonus > 0) horse.ConditionLevel = Math.Clamp(horse.ConditionLevel + careItem.ConditionBonus, 0, 100);
        if (careItem.EnergyBonus > 0) horse.StaminaEnergy = Math.Clamp(horse.StaminaEnergy + careItem.EnergyBonus, 0, 100);
        if (careItem.HealthBonus > 0) horse.HealthPoints = Math.Clamp(horse.HealthPoints + careItem.HealthBonus, 0, 100);
        if (careItem.HoofWearRelief > 0) horse.HoofWear = Math.Max(0, horse.HoofWear - careItem.HoofWearRelief);

        if (careItem.ClearsIllness && horse.SubStatus == "SICK")
        {
            horse.SubStatus = "IDLE";
        }
        if (careItem.ClearsInjury && (horse.SubStatus is "INJURED" or "SICK"))
        {
            horse.SubStatus = "IDLE";
        }

        horse.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new CareResultDto(
            Success: true,
            CareType: careType,
            NewCondition: horse.ConditionLevel,
            NewStaminaEnergy: horse.StaminaEnergy,
            NewIntimacy: horse.IntimacyLevel,
            NewHealthPoints: horse.HealthPoints,
            SubStatus: horse.SubStatus,
            NewBalance: wallet.Balance);
    }

    public async Task<(List<RanchEquipmentDto> ShopCatalog, List<PlayerEquipmentDto> Inventory)> GetEquipmentShopAndInventoryAsync(
        long playerId,
        CancellationToken ct = default)
    {
        var catalog = await db.RanchEquipmentItems
            .Where(x => x.IsEnabled)
            .Select(x => new RanchEquipmentDto(
                x.Id,
                x.ItemCode,
                x.ItemName,
                x.SlotCategory,
                x.SpeedBonus,
                x.StaminaBonus,
                x.BurstBonus,
                x.AgilityBonus,
                x.MaxDurability,
                x.PriceCoin))
            .ToListAsync(ct);

        var inventory = await db.RanchHorseEquipments
            .Where(x => x.OwnerPlayerId == playerId)
            .Join(db.RanchEquipmentItems, eq => eq.EquipmentItemId, item => item.Id, (eq, item) => new PlayerEquipmentDto(
                eq.Id,
                eq.EquipmentItemId,
                item.ItemCode,
                item.ItemName,
                item.SlotCategory,
                eq.EquippedHorseId,
                eq.CurrentDurability,
                eq.IsEquipped))
            .ToListAsync(ct);

        return (catalog, inventory);
    }

    public async Task<PlayerEquipmentDto> BuyAndEquipItemAsync(
        long playerId,
        long horseId,
        long equipmentItemId,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在");

        if (horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "RETIRED")
        {
            throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", $"赛马当前处于 {horse.SubStatus} 状态，不可调整马具");
        }

        if (horse.Level < 20 && horse.GrowthStage is "FOAL" or "JUVENILE")
        {
            throw new BusinessRuleException("RANCH_EQUIP_SLOT_MISMATCH", "赛马尚未成年 (需达到 Lv.20)，体型无法装配赛道专业马具");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        // 优先检查是否是玩家背包中已有闲置装备实例
        var existingOwned = await db.RanchHorseEquipments
            .Include(x => x.EquipmentItem)
            .FirstOrDefaultAsync(x => x.OwnerPlayerId == playerId && x.Id == equipmentItemId, ct);

        RanchHorseEquipment eq;
        RanchEquipmentItem item;

        if (existingOwned != null)
        {
            // 背包已有装备：直接装配，无需再次购买扣款
            eq = existingOwned;
            item = eq.EquipmentItem
                ?? await db.RanchEquipmentItems.FirstAsync(x => x.Id == eq.EquipmentItemId, ct);

            // 若该装备原挂载于其他赛马，清理原马槽位
            if (existingOwned.EquippedHorseId.HasValue && existingOwned.EquippedHorseId.Value != horseId)
            {
                var prevHorse = await db.RanchHorses.FirstOrDefaultAsync(x => x.Id == existingOwned.EquippedHorseId.Value, ct);
                if (prevHorse != null)
                {
                    if (prevHorse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED")
                    {
                        throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", "该装备正挂载于处于锁定状态的赛马身上，无法转移");
                    }
                    if (prevHorse.SaddleItemId == eq.Id) prevHorse.SaddleItemId = null;
                    if (prevHorse.StirrupItemId == eq.Id) prevHorse.StirrupItemId = null;
                    if (prevHorse.HorseshoeItemId == eq.Id) prevHorse.HorseshoeItemId = null;
                }
            }

            eq.EquippedHorseId = horseId;
            eq.IsEquipped = true;
        }
        else
        {
            // 商城订购新装备并扣款
            item = await db.RanchEquipmentItems
                .FirstOrDefaultAsync(x => x.Id == equipmentItemId && x.IsEnabled, ct)
                ?? throw new BusinessRuleException("ITEM_NOT_FOUND", "马具装备不存在或已下架");

            var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
                ? $"buy_equip:{playerId}:{equipmentItemId}:{DateTime.UtcNow.Ticks}"
                : idempotencyKey.Trim();

            if (!string.IsNullOrWhiteSpace(idempotencyKey))
            {
                var existingTx = await db.WalletTransactions
                    .AsNoTracking()
                    .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
                if (existingTx != null)
                {
                    var alreadyEq = await db.RanchHorseEquipments
                        .Where(x => x.OwnerPlayerId == playerId && x.EquipmentItemId == item.Id)
                        .OrderByDescending(x => x.CreatedAt)
                        .FirstOrDefaultAsync(ct);
                    if (alreadyEq != null)
                    {
                        return new PlayerEquipmentDto(
                            alreadyEq.Id,
                            alreadyEq.EquipmentItemId,
                            item.ItemCode,
                            item.ItemName,
                            item.SlotCategory,
                            alreadyEq.EquippedHorseId,
                            alreadyEq.CurrentDurability,
                            alreadyEq.IsEquipped);
                    }
                }
            }

            var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
                ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

            if (wallet.Balance < item.PriceCoin)
            {
                throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"金币不足，购买 {item.ItemName} 需要 {item.PriceCoin:N0} 金币");
            }

            var before = wallet.Balance;
            wallet.Balance = MoneyMath.Round(wallet.Balance - item.PriceCoin);
            wallet.Version++;
            wallet.UpdatedAt = DateTime.UtcNow;

            db.WalletTransactions.Add(new WalletTransaction
            {
                PlayerId = playerId,
                TransactionType = "SHOP_PURCHASE",
                Amount = -item.PriceCoin,
                BalanceBefore = before,
                BalanceAfter = wallet.Balance,
                FeeRate = 0m,
                FeeAmount = 0m,
                ReferenceType = "EQUIPMENT_ITEM",
                ReferenceId = item.ItemCode,
                IdempotencyKey = idemKey,
                CreatedAt = DateTime.UtcNow
            });

            eq = new RanchHorseEquipment
            {
                OwnerPlayerId = playerId,
                EquipmentItemId = item.Id,
                EquippedHorseId = horseId,
                CurrentDurability = item.MaxDurability,
                IsEquipped = true,
                CreatedAt = DateTime.UtcNow
            };
            db.RanchHorseEquipments.Add(eq);
            await db.SaveChangesAsync(ct);
        }

        // 检查原槽位并替换卸下
        switch (item.SlotCategory)
        {
            case "SADDLE":
                if (horse.SaddleItemId.HasValue && horse.SaddleItemId.Value != eq.Id)
                {
                    var old = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == horse.SaddleItemId.Value, ct);
                    if (old != null) { old.IsEquipped = false; old.EquippedHorseId = null; }
                }
                horse.SaddleItemId = eq.Id;
                break;
            case "STIRRUP":
                if (horse.StirrupItemId.HasValue && horse.StirrupItemId.Value != eq.Id)
                {
                    var old = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == horse.StirrupItemId.Value, ct);
                    if (old != null) { old.IsEquipped = false; old.EquippedHorseId = null; }
                }
                horse.StirrupItemId = eq.Id;
                break;
            case "HORSESHOE":
                if (horse.HorseshoeItemId.HasValue && horse.HorseshoeItemId.Value != eq.Id)
                {
                    var old = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == horse.HorseshoeItemId.Value, ct);
                    if (old != null) { old.IsEquipped = false; old.EquippedHorseId = null; }
                }
                horse.HorseshoeItemId = eq.Id;
                break;
        }

        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new PlayerEquipmentDto(
            eq.Id,
            item.Id,
            item.ItemCode,
            item.ItemName,
            item.SlotCategory,
            horseId,
            eq.CurrentDurability,
            true);
    }

    public async Task<bool> UnequipItemAsync(long playerId, long horseId, string slotCategory, CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在");

        if (horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "RETIRED")
        {
            throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", $"赛马当前处于 {horse.SubStatus} 状态，不可卸下马具");
        }

        long? targetEqId = slotCategory.ToUpperInvariant() switch
        {
            "SADDLE" => horse.SaddleItemId,
            "STIRRUP" => horse.StirrupItemId,
            "HORSESHOE" => horse.HorseshoeItemId,
            _ => null
        };

        if (!targetEqId.HasValue)
        {
            return false;
        }

        var eq = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == targetEqId.Value, ct);
        if (eq != null)
        {
            eq.IsEquipped = false;
            eq.EquippedHorseId = null;
        }

        switch (slotCategory.ToUpperInvariant())
        {
            case "SADDLE": horse.SaddleItemId = null; break;
            case "STIRRUP": horse.StirrupItemId = null; break;
            case "HORSESHOE": horse.HorseshoeItemId = null; break;
        }

        await db.SaveChangesAsync(ct);
        return true;
    }

    public async Task<RepairEquipmentResultDto> RepairEquipmentAsync(
        long playerId,
        long playerEquipmentId,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var eq = await db.RanchHorseEquipments
            .Include(x => x.EquipmentItem)
            .FirstOrDefaultAsync(x => x.Id == playerEquipmentId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_EQUIP_NOT_FOUND", "装备不存在或不归属于当前玩家");

        var item = eq.EquipmentItem
            ?? await db.RanchEquipmentItems.FirstOrDefaultAsync(x => x.Id == eq.EquipmentItemId, ct)
            ?? throw new BusinessRuleException("ITEM_NOT_FOUND", "马具字典数据缺失");

        if (eq.CurrentDurability >= item.MaxDurability)
        {
            throw new BusinessRuleException("RANCH_EQUIP_NOT_BROKEN", "装备耐久完好，无需维修");
        }

        var repairCost = MoneyMath.Round(item.PriceCoin * 0.30m);

        var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
            ? $"repair_equip:{playerId}:{playerEquipmentId}:{DateTime.UtcNow.Ticks}"
            : idempotencyKey.Trim();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingTx = await db.WalletTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
            if (existingTx != null)
            {
                var curWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
                return new RepairEquipmentResultDto(playerEquipmentId, repairCost, item.MaxDurability, curWallet?.Balance ?? 0m);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        if (wallet.Balance < repairCost)
        {
            throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"金币不足，铁匠铺修复该装备需要 {repairCost:N0} 金币 (原价30%)");
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - repairCost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "RANCH_REPAIR_EQUIP",
            Amount = -repairCost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "EQUIPMENT_ITEM",
            ReferenceId = item.ItemCode,
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        eq.CurrentDurability = item.MaxDurability;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new RepairEquipmentResultDto(playerEquipmentId, repairCost, eq.CurrentDurability, wallet.Balance);
    }

    public async Task<TrialResultDto> RunQualificationTrialAsync(
        long playerId,
        long horseId,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId && x.OwnerPlayerId == playerId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在");

        if (horse.Level < 20)
        {
            throw new BusinessRuleException("RANCH_HORSE_STAGE_MISMATCH", "必须达到 Lv.20 成年体型方可申请资格审查考核");
        }

        if (horse.StaminaEnergy < 15)
        {
            throw new BusinessRuleException("RANCH_TRAIN_ENERGY_EMPTY", "赛马精力不足 (试跑需至少 15 点精力)");
        }

        var rules = await ruleConfigService.GetCurrentAsync(DateTime.UtcNow, ct);
        var licenseFee = rules.QualificationLicenseFee;
        var benchmark = rules.QualificationTrialBenchmark;
        var baseTime = rules.QualificationTrialBaseTime;
        var cooldownHours = rules.QualificationCooldownHours;

        // 检查失败冷静期
        var lastFailedTrial = await db.RanchQualificationTrials
            .Where(x => x.HorseId == horseId && !x.IsPassed)
            .OrderByDescending(x => x.CreatedAt)
            .FirstOrDefaultAsync(ct);

        if (lastFailedTrial != null && (DateTime.UtcNow - lastFailedTrial.CreatedAt).TotalHours < (double)cooldownHours)
        {
            var remainingMinutes = Math.Max(1, (int)Math.Ceiling((lastFailedTrial.CreatedAt.AddHours((double)cooldownHours) - DateTime.UtcNow).TotalMinutes));
            throw new BusinessRuleException("RANCH_TRIAL_COOLDOWN", $"未通过试跑冷静期中，尚需等待 {remainingMinutes} 分钟方可再次申请");
        }

        if (horse.HealthPoints < 100 || horse.HoofWear >= 50)
        {
            throw new BusinessRuleException("RANCH_HORSE_UNHEALTHY", "赛马健康度未达 100/100 或蹄铁磨损超过 50%，未通过兽医体检");
        }

        if (!horse.SaddleItemId.HasValue || !horse.StirrupItemId.HasValue || !horse.HorseshoeItemId.HasValue)
        {
            throw new BusinessRuleException("RANCH_EQUIP_MISSING", "必须同时装配有效马鞍、马镫与赛道蹄铁三件套方可入场试跑");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        if (wallet.Balance < licenseFee)
        {
            throw new BusinessRuleException("WALLET_INSUFFICIENT_BALANCE", $"申请资格审查试跑需先备齐 {licenseFee:N0} 🪙 官方执照证书规费（考核达标时扣除）");
        }

        // 试跑体能损耗：无论成败均消耗精力 15 点、蹄铁磨损 +5%、调子 -3 点
        horse.StaminaEnergy = Math.Max(0, horse.StaminaEnergy - 15);
        horse.HoofWear = Math.Clamp(horse.HoofWear + 5, 0, 100);
        horse.ConditionLevel = Math.Clamp(horse.ConditionLevel - 3, 0, 100);

        // 计算已装配装备属性加成与耐久损耗
        decimal equipSpeedBonus = 0m;
        decimal equipBurstBonus = 0m;
        decimal equipAgilityBonus = 0m;

        var eqIds = new List<long>();
        if (horse.SaddleItemId.HasValue) eqIds.Add(horse.SaddleItemId.Value);
        if (horse.StirrupItemId.HasValue) eqIds.Add(horse.StirrupItemId.Value);
        if (horse.HorseshoeItemId.HasValue) eqIds.Add(horse.HorseshoeItemId.Value);

        var equippedItems = await db.RanchHorseEquipments
            .Include(x => x.EquipmentItem)
            .Where(x => eqIds.Contains(x.Id))
            .ToListAsync(ct);

        foreach (var eqItem in equippedItems)
        {
            if (eqItem.CurrentDurability > 0 && eqItem.EquipmentItem != null)
            {
                equipSpeedBonus += eqItem.EquipmentItem.SpeedBonus;
                equipBurstBonus += eqItem.EquipmentItem.BurstBonus;
                equipAgilityBonus += eqItem.EquipmentItem.AgilityBonus;
            }
            eqItem.CurrentDurability = Math.Max(0, eqItem.CurrentDurability - 2);
        }

        decimal finalSpeed = Math.Clamp(horse.SpeedStat + equipSpeedBonus, 10.00m, 120.00m);
        decimal finalBurst = Math.Clamp(horse.BurstStat + equipBurstBonus, 10.00m, 120.00m);
        decimal finalAgility = Math.Clamp(horse.AgilityStat + equipAgilityBonus, 10.00m, 120.00m);

        // 动力学 400m 模拟试跑时间 (TC-R06: 性能加成将初始基准缩减，达标签发执照)
        var randFloat = (RandomNumberGenerator.GetInt32(-150, 151)) / 1000.0m;
        var performanceGain = (finalSpeed * 0.08m + finalBurst * 0.06m + finalAgility * 0.02m) / 10.0m;
        var trialTime = Math.Round(baseTime - performanceGain + randFloat, 3);

        bool passed = trialTime <= benchmark;
        decimal feeCharged = 0.00m;
        decimal newBalance = wallet.Balance;

        if (passed)
        {
            var before = wallet.Balance;
            wallet.Balance = MoneyMath.Round(wallet.Balance - licenseFee);
            wallet.Version++;
            wallet.UpdatedAt = DateTime.UtcNow;
            newBalance = wallet.Balance;
            feeCharged = licenseFee;

            var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
                ? $"trial_pass:{playerId}:{horseId}:{DateTime.UtcNow.Ticks}"
                : idempotencyKey.Trim();

            db.WalletTransactions.Add(new WalletTransaction
            {
                PlayerId = playerId,
                TransactionType = "RANCH_LICENSE",
                Amount = -licenseFee,
                BalanceBefore = before,
                BalanceAfter = wallet.Balance,
                FeeRate = 0m,
                FeeAmount = 0m,
                ReferenceType = "RANCH_HORSE",
                ReferenceId = horseId.ToString(),
                IdempotencyKey = idemKey,
                CreatedAt = DateTime.UtcNow
            });

            var certHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes($"{horse.Id}:{DateTime.UtcNow.Ticks}")))[..4];
            var certCode = $"WY-{DateTime.UtcNow:yyyyMMdd}-{certHash}";
            horse.IsLicensedRacer = true;
            horse.GrowthStage = "PRO_RACER";
            horse.QualificationTime = trialTime;
            horse.LicenseCertCode = certCode;
        }

        db.RanchQualificationTrials.Add(new RanchQualificationTrial
        {
            HorseId = horseId,
            PlayerId = playerId,
            TrialTimeSeconds = trialTime,
            StandardBenchmark = benchmark,
            IsPassed = passed,
            FeeCharged = feeCharged,
            CreatedAt = DateTime.UtcNow
        });

        horse.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new TrialResultDto(
            IsPassed: passed,
            TrialTime: trialTime,
            StandardBenchmark: benchmark,
            FeeCharged: feeCharged,
            LicenseCertCode: horse.LicenseCertCode,
            GrowthStage: horse.GrowthStage,
            NewBalance: newBalance);
    }

    public async Task<BuybackResultDto> BuybackHorseAsync(
        long playerId,
        long horseId,
        string? idempotencyKey,
        CancellationToken ct = default)
    {
        var horse = await db.RanchHorses
            .FirstOrDefaultAsync(x => x.Id == horseId, ct)
            ?? throw new BusinessRuleException("RANCH_HORSE_NOT_FOUND", "赛马不存在");

        if (horse.OwnerPlayerId != playerId)
        {
            throw new BusinessRuleException("RANCH_BUYBACK_NOT_OWNER", "只有马匹合法拥有者方可申请马会保底回购");
        }

        if (horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "PREGNANT")
        {
            throw new BusinessRuleException("RANCH_HORSE_STATE_LOCKED", $"赛马当前处于 {horse.SubStatus} 状态，不可申请系统保底回购");
        }

        if (horse.SubStatus == "RETIRED")
        {
            throw new BusinessRuleException("RANCH_HORSE_RETIRED", "该赛马已退役回购，不可重复申请");
        }

        var idemKey = string.IsNullOrWhiteSpace(idempotencyKey)
            ? $"buyback:{playerId}:{horseId}:{DateTime.UtcNow.Ticks}"
            : idempotencyKey.Trim();

        if (!string.IsNullOrWhiteSpace(idempotencyKey))
        {
            var existingTx = await db.WalletTransactions
                .AsNoTracking()
                .FirstOrDefaultAsync(x => x.IdempotencyKey == idemKey, ct);
            if (existingTx != null)
            {
                var curWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, ct);
                return new BuybackResultDto(horseId, existingTx.Amount, curWallet?.Balance ?? 0m);
            }
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, ct);

        var rules = await ruleConfigService.GetCurrentAsync(DateTime.UtcNow, ct);
        var (basePrice, levelMult, winMult, purseMult) = rules.ResolveBuybackConfig(horse.PedigreeTier);

        // BuybackPrice = BasePrice + (Level * LevelMult) + (CareerWins * WinMult) + (AccumulatedPurse * PurseMult)
        decimal payout = basePrice + (horse.Level * levelMult) + (horse.TotalCareerWins * winMult) + (horse.AccumulatedPurse * purseMult);
        payout = MoneyMath.Round(payout);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, ct)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "钱包不存在");

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance + payout);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "SYSTEM_BUYBACK",
            Amount = payout,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "RANCH_HORSE",
            ReferenceId = horseId.ToString(),
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        // 卸载所有装备回仓
        if (horse.SaddleItemId.HasValue)
        {
            var old = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == horse.SaddleItemId.Value, ct);
            if (old != null) { old.IsEquipped = false; old.EquippedHorseId = null; }
            horse.SaddleItemId = null;
        }
        if (horse.StirrupItemId.HasValue)
        {
            var old = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == horse.StirrupItemId.Value, ct);
            if (old != null) { old.IsEquipped = false; old.EquippedHorseId = null; }
            horse.StirrupItemId = null;
        }
        if (horse.HorseshoeItemId.HasValue)
        {
            var old = await db.RanchHorseEquipments.FirstOrDefaultAsync(x => x.Id == horse.HorseshoeItemId.Value, ct);
            if (old != null) { old.IsEquipped = false; old.EquippedHorseId = null; }
            horse.HorseshoeItemId = null;
        }

        horse.SubStatus = "RETIRED";
        horse.UpdatedAt = DateTime.UtcNow;
        await db.SaveChangesAsync(ct);
        await transaction.CommitAsync(ct);

        return new BuybackResultDto(horseId, payout, wallet.Balance);
    }

    private static void ApplyExpAndLevelUp(RanchHorse horse, int gainExp)
    {
        // Lv.20 成年方案 C (PRD 3.3 节与 TC-R04): 等级硬顶封顶于 Lv.20，不可继续突破等级数字
        if (horse.Level >= 20)
        {
            horse.Level = 20;
            horse.MaxExp = 3500;
            horse.CurrentExp = Math.Min(3500, horse.CurrentExp + gainExp);
            return;
        }

        horse.CurrentExp += gainExp;

        while (true)
        {
            int reqExp;
            if (horse.Level < 10)
            {
                reqExp = FoalExpTable[horse.Level - 1];
            }
            else if (horse.Level < 20)
            {
                reqExp = JuvenileExpTable[horse.Level - 10];
            }
            else
            {
                reqExp = 3500;
            }

            horse.MaxExp = reqExp;

            if (horse.CurrentExp >= reqExp)
            {
                horse.CurrentExp -= reqExp;
                horse.Level++;

                // 阶段晋级判定
                if (horse.Level >= 10 && horse.GrowthStage == "FOAL")
                {
                    horse.GrowthStage = "JUVENILE";
                }
                else if (horse.Level >= 20)
                {
                    horse.Level = 20;
                    if (horse.GrowthStage == "JUVENILE")
                    {
                        horse.GrowthStage = "MATURE";
                    }
                    horse.MaxExp = 3500;
                    break;
                }
            }
            else
            {
                break;
            }
        }
    }

    private static bool UpdateDigestionAndEnergy(RanchHorse horse, DateTime now)
    {
        var changed = false;

        // 1. 饱腹度代谢追赶 (PRD 5.2): 每小时自然代谢 20 点，最多追赶 24 小时
        var hours = (now - horse.LastDigestedAt).TotalHours;
        if (hours >= 1.0)
        {
            var digested = (int)(Math.Min(hours, 24.0) * 20);
            if (digested > 0)
            {
                horse.HungerLevel = Math.Max(0, horse.HungerLevel - digested);
                horse.LastDigestedAt = now;
                changed = true;
            }
        }

        // 2. 每日 UTC 00:00 青年马体力重置 (PRD 5.4): 未处于伤病/妊娠中的青年马重置为 100
        if (now.Date > horse.UpdatedAt.Date && horse.SubStatus is not ("INJURED" or "SICK" or "PREGNANT" or "RETIRED"))
        {
            if (horse.StaminaEnergy < 100)
            {
                horse.StaminaEnergy = 100;
                horse.UpdatedAt = now;
                changed = true;
            }
        }

        return changed;
    }

    private static RanchHorseDto ToDto(RanchHorse h) => new(
        h.Id,
        h.OwnerPlayerId,
        h.HorseCode,
        h.CustomName,
        h.Gender,
        h.GrowthStage,
        h.Level,
        h.CurrentExp,
        h.MaxExp,
        h.PedigreeTier,
        h.Generation,
        h.CoatColor,
        h.RunningStyle,
        h.SpeedStat,
        h.SpeedPotential,
        h.StaminaStat,
        h.StaminaPotential,
        h.BurstStat,
        h.BurstPotential,
        h.AgilityStat,
        h.AgilityPotential,
        h.TemperamentStat,
        h.TemperamentPotential,
        h.HungerLevel,
        h.StaminaEnergy,
        h.ConditionLevel,
        h.HoofWear,
        h.IntimacyLevel,
        h.HealthPoints,
        h.SaddleItemId,
        h.StirrupItemId,
        h.HorseshoeItemId,
        h.IsLicensedRacer,
        h.QualificationTime,
        h.LicenseCertCode,
        h.TotalCareerRaces,
        h.TotalCareerWins,
        h.AccumulatedPurse,
        h.SubStatus,
        h.CreatedAt);
}

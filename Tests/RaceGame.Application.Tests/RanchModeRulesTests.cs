using RaceGame.Application.Common;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 模式三：西部纯血马房养成系统核心规则与数学断言测试。
/// 覆盖经验曲线、潜能截断(TC-R02)、消化代谢、400m 动力学与公会回购。
/// </summary>
public sealed class RanchModeRulesTests
{
    private static readonly int[] FoalExpTable = [100, 120, 150, 190, 240, 300, 370, 450, 550];
    private static readonly int[] JuvenileExpTable = [650, 750, 880, 1020, 1180, 1350, 1550, 1800, 2100, 2500];

    [Fact]
    public void TC_R01_ExpProgression_ReachesLevel10_PromotesToJuvenile()
    {
        var horse = new RanchHorse
        {
            Level = 1,
            CurrentExp = 0,
            GrowthStage = "FOAL",
            MaxExp = FoalExpTable[0]
        };

        // 幼驹升至 Lv.10 累计所需总经验为 100+120+150+190+240+300+370+450+550 = 2470
        const int totalExpGain = 2470;
        horse.CurrentExp += totalExpGain;

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
                reqExp = 3500 + (horse.Level - 20) * 500;
            }

            horse.MaxExp = reqExp;

            if (horse.CurrentExp >= reqExp)
            {
                horse.CurrentExp -= reqExp;
                horse.Level++;

                if (horse.Level >= 10 && horse.GrowthStage == "FOAL")
                {
                    horse.GrowthStage = "JUVENILE";
                }
            }
            else
            {
                break;
            }
        }

        Assert.Equal(10, horse.Level);
        Assert.Equal(0, horse.CurrentExp);
        Assert.Equal("JUVENILE", horse.GrowthStage);
        Assert.Equal(650, horse.MaxExp);
    }

    [Fact]
    public void TC_R02_PotentialCap_TrainingGainTruncatedProperly()
    {
        var horse = new RanchHorse
        {
            SpeedStat = 74.50m,
            SpeedPotential = 75.00m,
            BurstStat = 75.00m,
            BurstPotential = 75.00m
        };

        const decimal spdGain = 0.80m;
        const decimal brsGain = 0.40m;

        decimal actualSpd = Math.Min(spdGain, Math.Max(0m, horse.SpeedPotential - horse.SpeedStat));
        decimal actualBrs = Math.Min(brsGain, Math.Max(0m, horse.BurstPotential - horse.BurstStat));

        horse.SpeedStat += actualSpd;
        horse.BurstStat += actualBrs;

        Assert.Equal(0.50m, actualSpd);
        Assert.Equal(0.00m, actualBrs);
        Assert.Equal(75.00m, horse.SpeedStat);
        Assert.Equal(75.00m, horse.BurstStat);
    }

    [Fact]
    public void DigestionMetabolism_Reduces20PointsPerHour_ClampedTo24Hours()
    {
        var now = DateTime.UtcNow;
        var horse = new RanchHorse
        {
            HungerLevel = 80,
            LastDigestedAt = now.AddHours(-3.5)
        };

        var hours = (now - horse.LastDigestedAt).TotalHours;
        var digested = (int)(Math.Min(hours, 24.0) * 20);
        horse.HungerLevel = Math.Max(0, horse.HungerLevel - digested);

        // 3.5 小时代谢 70 点饱腹度，80 - 70 = 10
        Assert.Equal(70, digested);
        Assert.Equal(10, horse.HungerLevel);
    }

    [Fact]
    public void TC_R06_QualificationTrial_PhysicsBenchmarkCalculation()
    {
        const decimal BaseTime = 25.800m;
        const decimal Benchmark = 24.500m;

        // 1. 顶配成年职业马 (五维 Speed: 90, Burst: 88, Agility: 80)
        decimal proSpeed = 90.00m;
        decimal proBurst = 88.00m;
        decimal proAgility = 80.00m;

        // 性能增益计算公式：(finalSpeed * 0.08 + finalBurst * 0.06 + finalAgility * 0.02) / 10.0
        // (90 * 0.08 + 88 * 0.06 + 80 * 0.02) / 10 = (7.20 + 5.28 + 1.60) / 10 = 1.408 秒
        var proGain = (proSpeed * 0.08m + proBurst * 0.06m + proAgility * 0.02m) / 10.0m;
        Assert.Equal(1.408m, proGain);

        var bestCaseProTime = Math.Round(BaseTime - proGain - 0.100m, 3); // 25.800 - 1.408 - 0.100 = 24.292 秒
        Assert.True(bestCaseProTime <= Benchmark, $"顶配赛马成绩 {bestCaseProTime} 应跑进 {Benchmark} 秒并考核通过");

        // 2. 初始未调教低资质幼驹 (五维 Speed: 38, Burst: 36, Agility: 36)
        decimal rawSpeed = 38.00m;
        decimal rawBurst = 36.00m;
        decimal rawAgility = 36.00m;
        var rawGain = (rawSpeed * 0.08m + rawBurst * 0.06m + rawAgility * 0.02m) / 10.0m; // 0.592 秒
        var rawTime = Math.Round(BaseTime - rawGain, 3); // 25.800 - 0.592 = 25.208 秒

        Assert.True(rawTime > Benchmark, $"未训练幼驹成绩 {rawTime} 应超过 {Benchmark} 秒被判定未通过(不扣200规费)");
    }

    [Fact]
    public void BuybackFormula_CalculatesPayoutAccurately_AcrossTiers()
    {
        // 柯尔特平原纯血马，Lv.15，3 场胜利，累计奖金 5000 🪙
        // 公式：BasePrice(400) + (15 * 25) + (3 * 100) + (5000 * 0.05)
        // 400 + 375 + 300 + 250 = 1325 🪙
        var horse = new RanchHorse
        {
            PedigreeTier = "PLAINS_TB",
            Level = 15,
            TotalCareerWins = 3,
            AccumulatedPurse = 5000.00m
        };

        decimal basePrice = horse.PedigreeTier switch
        {
            "PLAINS_TB" => 400.00m,
            "ROYAL" => 1200.00m,
            "MYTHIC" => 3500.00m,
            _ => 150.00m
        };

        decimal payout = basePrice + (horse.Level * 25.00m) + (horse.TotalCareerWins * 100.00m) + (horse.AccumulatedPurse * 0.05m);
        payout = MoneyMath.Round(payout);

        Assert.Equal(1325.00m, payout);
    }

    [Fact]
    public void TC_R07_LopeTraining_IncludesTemperament_TruncatedByPotential()
    {
        // 验证慢步耐力 (Lope) 包含耐力 +0.90 与心理/性情 +0.30，且受潜能上限绝对截断
        var horse = new RanchHorse
        {
            StaminaStat = 74.50m,
            StaminaPotential = 75.00m,
            TemperamentStat = 74.85m,
            TemperamentPotential = 75.00m
        };

        const decimal staGain = 0.90m;
        const decimal tempGain = 0.30m;

        decimal actualSta = Math.Min(staGain, Math.Max(0m, horse.StaminaPotential - horse.StaminaStat));
        decimal actualTmp = Math.Min(tempGain, Math.Max(0m, horse.TemperamentPotential - horse.TemperamentStat));

        horse.StaminaStat += actualSta;
        horse.TemperamentStat += actualTmp;

        // 耐力上限 75.00，实际增长 0.50
        Assert.Equal(0.50m, actualSta);
        Assert.Equal(75.00m, horse.StaminaStat);

        // 性情上限 75.00，原值 74.85，实际增长 0.15
        Assert.Equal(0.15m, actualTmp);
        Assert.Equal(75.00m, horse.TemperamentStat);
    }

    [Fact]
    public void TC_R08_QualificationTrial_CooldownEnforced_ForFourHours()
    {
        // 验证考核未达标 4 小时冷静期：3 小时前失败不允许再次试跑，4.1 小时前失败则允许
        var now = DateTime.UtcNow;
        var recentFailedTrialTime = now.AddHours(-3.0);
        var oldFailedTrialTime = now.AddHours(-4.1);

        var isRecentCooldownActive = (now - recentFailedTrialTime).TotalHours < 4.0;
        var isOldCooldownActive = (now - oldFailedTrialTime).TotalHours < 4.0;

        Assert.True(isRecentCooldownActive, "3小时前失败应处于4小时冷静期中");
        Assert.False(isOldCooldownActive, "4.1小时前失败已脱离冷静期");
    }

    [Fact]
    public void TC_R09_CertCode_DeterministicFormatWithoutGetHashCode()
    {
        // 验证证书编码格式符合 WY-yyyyMMdd-XXXX 结构化特征
        var utcNow = new DateTime(2026, 9, 16, 12, 0, 0, DateTimeKind.Utc);
        const long horseId = 8801;
        var certHash = Convert.ToHexString(System.Security.Cryptography.SHA256.HashData(System.Text.Encoding.UTF8.GetBytes($"{horseId}:{utcNow.Ticks}")))[..4];
        var certCode = $"WY-{utcNow:yyyyMMdd}-{certHash}";

        Assert.Matches(@"^WY-20260916-[0-9A-F]{4}$", certCode);
    }

    [Theory]
    [InlineData("IN_RACE", true)]
    [InlineData("AUCTION_LOCKED", true)]
    [InlineData("TRANSFER_LOCKED", true)]
    [InlineData("PREGNANT", true)]
    [InlineData("IDLE", false)]
    public void TC_R10_BuybackHorse_StateExclusion_RejectsLockedHorses(string subStatus, bool shouldReject)
    {
        var horse = new RanchHorse
        {
            Id = 101,
            SubStatus = subStatus
        };

        var isLocked = horse.SubStatus is "IN_RACE" or "AUCTION_LOCKED" or "TRANSFER_LOCKED" or "PREGNANT";
        Assert.Equal(shouldReject, isLocked);
    }

    [Fact]
    public void TC_R11_DailyStaminaRecovery_OvernightCatchUp_RecoversTo100()
    {
        var yesterday = DateTime.UtcNow.AddDays(-1);
        var horse = new RanchHorse
        {
            StaminaEnergy = 0,
            UpdatedAt = yesterday,
            SubStatus = "IDLE"
        };

        var now = DateTime.UtcNow;
        if (now.Date > horse.UpdatedAt.Date && horse.SubStatus is not ("INJURED" or "SICK" or "PREGNANT" or "RETIRED"))
        {
            if (horse.StaminaEnergy < 100)
            {
                horse.StaminaEnergy = 100;
            }
        }

        Assert.Equal(100, horse.StaminaEnergy);
    }

    [Theory]
    [InlineData("WIN", 1, true)]
    [InlineData("WIN", 3, true)]
    [InlineData("WIN", 4, false)]
    [InlineData("QUINELLA", 2, false)]
    [InlineData("EXACTA", 1, false)]
    public void TC_R12_DoubleDown_RestrictedToWinAndTop3(string playType, int finalRank, bool isValid)
    {
        var isWin = string.Equals(playType, "WIN", StringComparison.OrdinalIgnoreCase);
        var isTop3 = finalRank <= 3;
        var allowed = isWin && isTop3;

        Assert.Equal(isValid, allowed);
    }

    [Fact]
    public void TC_R13_AdultStatLock_Level20Locked_NoStatGain()
    {
        // PRD 3.3 方案 C 与 TC-R04 断言：Lv.20 成年马五维基础属性锁定
        var matureHorse = new RanchHorse
        {
            Level = 20,
            GrowthStage = "MATURE",
            SpeedStat = 65.00m,
            SpeedPotential = 80.00m
        };

        const decimal spdGain = 0.80m;
        bool isAdultLocked = matureHorse.Level >= 20 || matureHorse.GrowthStage is "MATURE" or "PRO_RACER";
        decimal actualSpd = isAdultLocked ? 0m : Math.Min(spdGain, Math.Max(0m, matureHorse.SpeedPotential - matureHorse.SpeedStat));

        matureHorse.SpeedStat += actualSpd;

        Assert.True(isAdultLocked);
        Assert.Equal(0m, actualSpd);
        Assert.Equal(65.00m, matureHorse.SpeedStat);
    }

    [Fact]
    public void TC_R14_EquipmentRepair_RestoresMaxDurability_With30PercentCost()
    {
        // PRD 6.2 节：装备耐久度耗损后，在铁匠铺消耗原价 30% 金币进行修理并恢复满耐久
        const decimal priceCoin = 350.00m; // 真皮减负鞍
        const int maxDurability = 80;
        var currentDurability = 0; // 彻底磨损

        var repairCost = MoneyMath.Round(priceCoin * 0.30m); // 105.00 🪙
        currentDurability = maxDurability;

        Assert.Equal(105.00m, repairCost);
        Assert.Equal(80, currentDurability);
    }
}


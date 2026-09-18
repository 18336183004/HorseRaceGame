namespace RaceGame.Domain.Entities;

/// <summary>
/// 纯血马房专属赛马资产实体。
/// </summary>
public class RanchHorse
{
    public long Id { get; set; }

    /// <summary>所属玩家 ID</summary>
    public long OwnerPlayerId { get; set; }

    /// <summary>全服唯一赛马编码 (如 #WY-2026-889102)</summary>
    public string HorseCode { get; set; } = string.Empty;

    /// <summary>玩家自定义昵称</summary>
    public string CustomName { get; set; } = string.Empty;

    /// <summary>性别：STALLION (公马) / MARE (母马)</summary>
    public string Gender { get; set; } = "STALLION";

    /// <summary>主生命周期阶段：FOAL / JUVENILE / MATURE / PRO_RACER</summary>
    public string GrowthStage { get; set; } = "FOAL";

    /// <summary>等级 (1~20+，Lv.20 成年)</summary>
    public int Level { get; set; } = 1;

    /// <summary>当前经验值</summary>
    public int CurrentExp { get; set; }

    /// <summary>当前等级升下级所需经验</summary>
    public int MaxExp { get; set; } = 100;

    /// <summary>血统级别：WILD / PLAINS_TB / ROYAL / MYTHIC</summary>
    public string PedigreeTier { get; set; } = "WILD";

    /// <summary>父系马 ID (繁育时记录)</summary>
    public long? SireId { get; set; }

    /// <summary>母系马 ID (繁育时记录)</summary>
    public long? DamId { get; set; }

    /// <summary>世代代数 (从第 1 代起递增)</summary>
    public int Generation { get; set; } = 1;

    /// <summary>毛色 (如 BAY, CHESTNUT, BLACK, GREY)</summary>
    public string CoatColor { get; set; } = "BAY";

    /// <summary>跑法倾向：FRONT_RUNNER (逃) / STALKER (先行) / CLOSER (差) / STRETCH_RUNNER (追)</summary>
    public string RunningStyle { get; set; } = "STALKER";

    // 五维核心能力与先天潜能上限
    public decimal SpeedStat { get; set; } = 40.00m;
    public decimal SpeedPotential { get; set; } = 75.00m;

    public decimal StaminaStat { get; set; } = 40.00m;
    public decimal StaminaPotential { get; set; } = 75.00m;

    public decimal BurstStat { get; set; } = 40.00m;
    public decimal BurstPotential { get; set; } = 75.00m;

    public decimal AgilityStat { get; set; } = 40.00m;
    public decimal AgilityPotential { get; set; } = 75.00m;

    public decimal TemperamentStat { get; set; } = 40.00m;
    public decimal TemperamentPotential { get; set; } = 75.00m;

    // 生理健康指标
    /// <summary>饱腹度 (0~100，100 不可再投喂，每小时代谢 20)</summary>
    public int HungerLevel { get; set; }

    /// <summary>青年马每日精力能量 (0~100，每日 UTC 00:00 重置为 100)</summary>
    public int StaminaEnergy { get; set; } = 100;

    /// <summary>体况调子 (0~100，90+ 为绝好调)</summary>
    public int ConditionLevel { get; set; } = 100;

    /// <summary>蹄铁磨损度 (0~100，>=80 触发伤病减速)</summary>
    public int HoofWear { get; set; }

    /// <summary>与马主亲密度 (0~100)</summary>
    public int IntimacyLevel { get; set; } = 10;

    /// <summary>健康值 (0~100，100 方可参与 400m 资格审查)</summary>
    public int HealthPoints { get; set; } = 100;

    // 装备挂载
    public long? SaddleItemId { get; set; }
    public long? StirrupItemId { get; set; }
    public long? HorseshoeItemId { get; set; }

    // 资质与竞技履历
    public bool IsLicensedRacer { get; set; }
    public decimal? QualificationTime { get; set; }
    public string? LicenseCertCode { get; set; }
    public int TotalCareerRaces { get; set; }
    public int TotalCareerWins { get; set; }
    public decimal AccumulatedPurse { get; set; }
    public int SeasonPoints { get; set; }

    // 繁育与生理冷却
    public bool IsPregnant { get; set; }
    public DateTime? BreedingCooldownUntil { get; set; }
    public DateTime LastDigestedAt { get; set; } = DateTime.UtcNow;

    /// <summary>伴生子状态：IDLE, IN_RACE, AUCTION_LOCKED, TRANSFER_LOCKED, PREGNANT, RESTING, INJURED, SICK, RETIRED</summary>
    public string SubStatus { get; set; } = "IDLE";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

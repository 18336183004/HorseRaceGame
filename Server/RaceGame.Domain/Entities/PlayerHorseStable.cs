namespace RaceGame.Domain.Entities;

/// <summary>
/// 玩家专属马房认领与养成状态实体。
/// </summary>
public class PlayerHorseStable
{
    public long Id { get; set; }

    /// <summary>所属玩家 ID。</summary>
    public long PlayerId { get; set; }

    /// <summary>认领的系统赛马模板 ID。</summary>
    public long HorseCatalogId { get; set; }

    /// <summary>玩家为赛马取的自定义昵称。</summary>
    public string? CustomName { get; set; }

    /// <summary>状态与体力值 (0~100，100 为绝好调)。</summary>
    public int ConditionLevel { get; set; } = 100;

    /// <summary>今日日常照料喂养次数。</summary>
    public int CareCountToday { get; set; }

    /// <summary>职业生涯累计参赛场次。</summary>
    public int TotalCareerRaces { get; set; }

    /// <summary>职业生涯累计获胜胜场。</summary>
    public int TotalCareerWins { get; set; }

    /// <summary>累计待领取的出赛分红总额。</summary>
    public decimal AccumulatedPurse { get; set; } = 0.00m;

    /// <summary>认领时间 (UTC)。</summary>
    public DateTime AdoptedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;


/// <summary>定义 PlayerStat 领域持久化数据结构及其业务状态字段。</summary>
public class PlayerStat
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public long TotalRoundsParticipated { get; set; }

    public long TotalRoundsWon { get; set; }

    public decimal WinRate { get; set; }

    public decimal TotalBetAmount { get; set; }

    public decimal TotalGrossReward { get; set; }

    public decimal TotalFeeAmount { get; set; }

    public decimal TotalNetReward { get; set; }

    /// <summary>盈利胜局总数：整轮所有注单净收益总额 > 总投注额的局数。</summary>
    public long TotalNetProfitWins { get; set; }

    /// <summary>当前命中连胜次数：只要任意单中奖即递增，未中奖则清零。</summary>
    public int CurrentHitStreak { get; set; }

    /// <summary>历史最高命中连胜纪录。</summary>
    public int MaxHitStreak { get; set; }

    /// <summary>当前净盈利连胜次数：当局净收益 > 投注额时递增，否则清零。</summary>
    public int CurrentProfitStreak { get; set; }

    /// <summary>历史最高净盈利连胜纪录。</summary>
    public int MaxProfitStreak { get; set; }

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

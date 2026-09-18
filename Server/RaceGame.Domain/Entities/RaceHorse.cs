namespace RaceGame.Domain.Entities;


/// <summary>定义 RaceHorse 领域持久化数据结构及其业务状态字段。</summary>
public class RaceHorse
{
    public long Id { get; set; }

    public long RoundId { get; set; }

    public int HorseNo { get; set; }

    public long HorseTemplateId { get; set; }

    public string? HorseNameZhSnapshot { get; set; }

    public string? HorseNameEnSnapshot { get; set; }

    public string? AvatarAssetSnapshot { get; set; }

    public string? PortraitAssetSnapshot { get; set; }

    public decimal Odds { get; set; }

    public long TotalRacesSnapshot { get; set; }

    public long WinCountSnapshot { get; set; }

    public decimal WinRateSnapshot { get; set; }

    public decimal Rank1ProbabilitySnapshot { get; set; }

    public decimal Rank2ProbabilitySnapshot { get; set; }

    public decimal Rank3ProbabilitySnapshot { get; set; }

    public decimal Rank4ProbabilitySnapshot { get; set; }

    public decimal Rank5ProbabilitySnapshot { get; set; }

    public decimal Rank6ProbabilitySnapshot { get; set; }

    public bool IsBlackHorseCandidate { get; set; }

    public int BlackHorseHitCount { get; set; }

    public bool IsBlackHorse { get; set; }

    public int? FinalRank { get; set; }

    public decimal? FinishTime { get; set; }

    public string? AnimationJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

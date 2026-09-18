namespace RaceGame.Domain.Entities;

/// <summary>
/// 400m 资格审查考核试跑记录实体。
/// </summary>
public class RanchQualificationTrial
{
    public long Id { get; set; }

    public long HorseId { get; set; }

    public long PlayerId { get; set; }

    public decimal TrialTimeSeconds { get; set; }

    public decimal StandardBenchmark { get; set; } = 24.500m;

    public bool IsPassed { get; set; }

    public decimal FeeCharged { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

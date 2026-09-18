namespace RaceGame.Domain.Entities;

/// <summary>
/// 牧场饲料投喂审计日志实体。
/// </summary>
public class RanchFeedLog
{
    public long Id { get; set; }

    public long HorseId { get; set; }

    public long PlayerId { get; set; }

    public string FeedCode { get; set; } = string.Empty;

    public decimal CoinCost { get; set; }

    public int ExpGained { get; set; }

    public int HungerBefore { get; set; }

    public int HungerAfter { get; set; }

    public int ConditionBefore { get; set; }

    public int ConditionAfter { get; set; }

    public string IdempotencyKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

namespace RaceGame.Domain.Entities;

/// <summary>
/// 青年马专项骑术训练日志实体。
/// </summary>
public class RanchTrainingLog
{
    public long Id { get; set; }

    public long HorseId { get; set; }

    public long PlayerId { get; set; }

    public string TrainingType { get; set; } = string.Empty;

    public int StaminaEnergyCost { get; set; }

    public decimal CoinCost { get; set; }

    public int ExpGained { get; set; }

    public decimal SpeedDelta { get; set; }

    public decimal StaminaDelta { get; set; }

    public decimal BurstDelta { get; set; }

    public decimal AgilityDelta { get; set; }
 
    public decimal TemperamentDelta { get; set; }
 
    public int HoofWearDelta { get; set; }

    public string IdempotencyKey { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

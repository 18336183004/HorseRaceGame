namespace RaceGame.Domain.Entities;


/// <summary>定义 BetOrderSettlementLog 领域持久化数据结构及其业务状态字段。</summary>
public class BetOrderSettlementLog
{
    public long Id { get; set; }

    public long BetOrderId { get; set; }

    public long? SettlementRunId { get; set; }

    public string ResultStatus { get; set; } = string.Empty;

    public decimal GrossRewardSnapshot { get; set; }

    public decimal FeeRateSnapshot { get; set; }

    public decimal FeeAmountSnapshot { get; set; }

    public decimal NetRewardSnapshot { get; set; }

    public long? RewardTransactionId { get; set; }

    public long? FeeTransactionId { get; set; }

    public string? MetadataJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

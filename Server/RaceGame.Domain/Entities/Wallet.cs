using System.ComponentModel.DataAnnotations;

namespace RaceGame.Domain.Entities;

/// <summary>定义 Wallet 领域持久化数据结构及其业务状态字段。</summary>
public class Wallet
{
    public long Id { get; set; }

    public long PlayerId { get; set; }

    public decimal Balance { get; set; }

    /// <summary>冻结资金 (如拍卖行出价保证金等)</summary>
    public decimal FrozenBalance { get; set; }

    [ConcurrencyCheck]
    public long Version { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

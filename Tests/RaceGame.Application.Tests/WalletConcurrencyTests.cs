using System.ComponentModel.DataAnnotations;
using System.Reflection;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证钱包实体配置了 EF 乐观并发检查令牌属性，保障高并发扣款与结算时的数据一致性。
/// </summary>
public sealed class WalletConcurrencyTests
{
    [Fact]
    public void Wallet_VersionProperty_HasConcurrencyCheckAttribute()
    {
        var property = typeof(Wallet).GetProperty(nameof(Wallet.Version));
        Assert.NotNull(property);

        var attribute = property.GetCustomAttribute<ConcurrencyCheckAttribute>();
        Assert.NotNull(attribute);
    }

    [Fact]
    public void Wallet_InitialVersion_IsZero()
    {
        var wallet = new Wallet
        {
            PlayerId = 1,
            Balance = 1000m,
        };

        Assert.Equal(0, wallet.Version);
    }
}

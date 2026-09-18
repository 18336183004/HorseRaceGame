using System.Security.Cryptography;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RaceGame.Api.Extensions;
using RaceGame.Application.Common;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 边境酒馆消遣轻微游戏控制器（西部幸运轮盘与牛仔拼骰）。
/// 提供完全由服务端原子事务控制的下注消耗与奖金派发，
/// 严格写入钱包流水（WalletTransactions）并持久化到数据库。
/// </summary>
[ApiController]
[Route("api/minigame")]
[Authorize]
public sealed class MinigameController(AppDbContext db) : ControllerBase
{
    private static readonly (string Text, decimal Amount, int Weight)[] WheelPrizes =
    [
        ("💰 5币", 5.00m, 25),
        ("🪙 10币", 10.00m, 15),
        ("📣 助威号角", 2.00m, 20),
        ("💎 25大奖", 25.00m, 5),
        ("⚡ 黄金马鞭", 2.00m, 20),
        ("🍺 冰啤回本", 2.00m, 15),
    ];

    /// <summary>
    /// 旋转西部幸运轮盘：消耗 2 金币，根据权威权重派发小额金币或比赛助威道具。
    /// </summary>
    [HttpPost("wheel/spin")]
    public async Task<IActionResult> SpinWheel(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        const decimal spinCost = 2.00m;
        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken);
        if (wallet is null)
        {
            return BadRequest(new { code = "WALLET_NOT_FOUND", message = "玩家钱包不存在" });
        }

        if (wallet.Balance < spinCost)
        {
            return BadRequest(new { code = "INSUFFICIENT_BALANCE", message = "余额不足 2 金币，请先充值" });
        }

        // 服务端权威权重抽奖
        var totalWeight = WheelPrizes.Sum(x => x.Weight);
        var roll = RandomNumberGenerator.GetInt32(0, totalWeight);
        var acc = 0;
        var prizeIndex = 0;
        for (var i = 0; i < WheelPrizes.Length; i++)
        {
            acc += WheelPrizes[i].Weight;
            if (roll < acc)
            {
                prizeIndex = i;
                break;
            }
        }

        var prize = WheelPrizes[prizeIndex];
        var utcNow = DateTime.UtcNow;
        var balanceBefore = wallet.Balance;
        var balanceAfter = MoneyMath.Round(balanceBefore - spinCost + prize.Amount);

        wallet.Balance = balanceAfter;
        wallet.Version++;
        wallet.UpdatedAt = utcNow;

        var txId = Guid.NewGuid().ToString("N");
        var tx = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "MINIGAME_WHEEL",
            Amount = MoneyMath.Round(prize.Amount - spinCost),
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            ReferenceType = "MINIGAME_WHEEL_SPIN",
            ReferenceId = txId,
            IdempotencyKey = $"wallet:wheel:{playerId}:{txId}",
            CreatedAt = utcNow,
        };

        db.WalletTransactions.Add(tx);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                prizeIndex,
                prizeText = prize.Text,
                cost = spinCost,
                reward = prize.Amount,
                newBalance = wallet.Balance,
            }
        });
    }

    /// <summary>
    /// 牛仔拼骰对决：消耗 2 金币与酒馆老板比大小。点数大者胜（奖4币），平局退本（退2币），点数小者负。
    /// </summary>
    [HttpPost("dice/roll")]
    public async Task<IActionResult> RollDice(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        const decimal diceCost = 2.00m;
        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken);
        if (wallet is null)
        {
            return BadRequest(new { code = "WALLET_NOT_FOUND", message = "玩家钱包不存在" });
        }

        if (wallet.Balance < diceCost)
        {
            return BadRequest(new { code = "INSUFFICIENT_BALANCE", message = "余额不足 2 金币，请先充值" });
        }

        var b1 = RandomNumberGenerator.GetInt32(1, 7);
        var b2 = RandomNumberGenerator.GetInt32(1, 7);
        var p1 = RandomNumberGenerator.GetInt32(1, 7);
        var p2 = RandomNumberGenerator.GetInt32(1, 7);

        var bSum = b1 + b2;
        var pSum = p1 + p2;

        decimal reward;
        string resultDesc;
        if (pSum > bSum)
        {
            reward = 4.00m; // 胜出：返奖 4 币（净赚 +2）
            resultDesc = "WIN";
        }
        else if (pSum == bSum)
        {
            reward = 2.00m; // 平局：原银退回 2 币（净赚 0）
            resultDesc = "TIE";
        }
        else
        {
            reward = 0.00m; // 告负：扣除 2 币（净赚 -2）
            resultDesc = "LOSE";
        }

        var utcNow = DateTime.UtcNow;
        var balanceBefore = wallet.Balance;
        var balanceAfter = MoneyMath.Round(balanceBefore - diceCost + reward);

        wallet.Balance = balanceAfter;
        wallet.Version++;
        wallet.UpdatedAt = utcNow;

        var txId = Guid.NewGuid().ToString("N");
        var tx = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "MINIGAME_DICE",
            Amount = MoneyMath.Round(reward - diceCost),
            BalanceBefore = balanceBefore,
            BalanceAfter = balanceAfter,
            ReferenceType = "MINIGAME_DICE_ROLL",
            ReferenceId = txId,
            IdempotencyKey = $"wallet:dice:{playerId}:{txId}",
            CreatedAt = utcNow,
        };

        db.WalletTransactions.Add(tx);
        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                playerDice = new[] { p1, p2 },
                bossDice = new[] { b1, b2 },
                playerSum = pSum,
                bossSum = bSum,
                result = resultDesc,
                cost = diceCost,
                reward,
                newBalance = wallet.Balance,
            }
        });
    }
}

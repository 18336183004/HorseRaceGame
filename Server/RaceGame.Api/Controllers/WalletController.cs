using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;
using RaceGame.Application.Abstractions;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 提供钱包余额与流水账单查询接口。
/// </summary>
[ApiController]
[Route("api/wallet")]
[Authorize]
public sealed class WalletController(IGameDbContext db) : ControllerBase
{
    /// <summary>
    /// 获取当前登录玩家的钱包信息（余额与版本号）。
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken = default)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var wallet = await db.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);

        if (wallet is null)
        {
            return NotFound(new { code = 1, message = "钱包不存在" });
        }

        return Ok(new
        {
            code = 0,
            data = new
            {
                wallet.PlayerId,
                wallet.Balance,
                wallet.Version,
                serverTime = DateTime.UtcNow,
            },
        });
    }

    /// <summary>
    /// 分页查询当前登录玩家的钱包流水记录。
    /// </summary>
    [HttpGet("transactions")]
    public async Task<IActionResult> Transactions(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 30,
        CancellationToken cancellationToken = default)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.WalletTransactions
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .OrderByDescending(x => x.Id);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.TransactionType,
                x.Amount,
                x.BalanceBefore,
                x.BalanceAfter,
                x.ReferenceType,
                x.ReferenceId,
                x.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                page,
                pageSize,
                total,
                items,
            },
        });
    }
}

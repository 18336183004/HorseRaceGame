using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using RaceGame.Api.Extensions;
using RaceGame.Application.Betting;
using RaceGame.Application.Common;

namespace RaceGame.Api.Controllers;

/// <summary>提供认证玩家下注的 HTTP 入口，并保持控制器只负责身份、状态码和响应信封。</summary>
[ApiController]
[Route("api/race")]
[EnableRateLimiting("bet")]
public sealed class BettingController(BettingService bettingService) : ControllerBase
{
    /// <summary>为当前认证玩家提交一笔可幂等重试的下注。</summary>
    [Authorize]
    [HttpPost("bet")]
    public async Task<IActionResult> Bet(PlaceBetRequest request, CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await bettingService.PlaceAsync(playerId, request, cancellationToken);
            return Ok(new { code = 0, data = result });
        }
        catch (BusinessRuleException exception)
        {
            return Conflict(new { code = exception.Code, message = exception.Message });
        }
    }

    /// <summary>为当前认证玩家提交局内 15~18 秒冲刺加倍追投。</summary>
    [Authorize]
    [HttpPost("inplay/double-down")]
    public async Task<IActionResult> DoubleDown(DoubleDownRequest request, CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await bettingService.DoubleDownAsync(playerId, request, cancellationToken);
            return Ok(new { code = 0, data = result });
        }
        catch (BusinessRuleException exception)
        {
            return Conflict(new { code = exception.Code, message = exception.Message });
        }
    }
}

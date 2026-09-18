using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RaceGame.Api.Extensions;
using RaceGame.Application.Achievements;
using RaceGame.Application.Common;

namespace RaceGame.Api.Controllers;

/// <summary>提供玩家功勋/成就查询与幂等领奖入口（对应 1.png Feat 页面）。</summary>
[ApiController]
[Authorize]
[Route("api/achievement")]
public sealed class AchievementController(AchievementService achievementService) : ControllerBase
{
    /// <summary>获取当前登录玩家的所有成就列表与达成状态。</summary>
    [HttpGet]
    public async Task<IActionResult> GetPlayerAchievements(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var list = await achievementService.GetPlayerAchievementsAsync(playerId, cancellationToken);
        return Ok(new { code = 0, data = list });
    }

    /// <summary>领取指定成就的奖励金币（带幂等保护）。</summary>
    [HttpPost("{playerAchievementId:long}/claim")]
    public async Task<IActionResult> Claim(
        long playerAchievementId,
        ClaimAchievementRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await achievementService.ClaimAsync(
                playerId,
                playerAchievementId,
                request,
                cancellationToken);
            return Ok(new { code = 0, data = result });
        }
        catch (BusinessRuleException exception)
        {
            return Conflict(new { code = exception.Code, message = exception.Message });
        }
    }
}

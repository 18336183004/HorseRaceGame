using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RaceGame.Api.Extensions;
using RaceGame.Application.Common;
using RaceGame.Application.Tasks;

namespace RaceGame.Api.Controllers;

/// <summary>提供认证玩家每日任务查询与幂等奖励领取入口。</summary>
[ApiController]
[Authorize]
[Route("api/tasks/daily")]
public sealed class DailyTasksController(DailyTaskService dailyTaskService) : ControllerBase
{
    /// <summary>获取当前伦敦业务日的任务配置、进度和领奖状态。</summary>
    [HttpGet]
    public async Task<IActionResult> GetCurrent(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var tasks = await dailyTaskService.GetCurrentAsync(playerId, DateTime.UtcNow, cancellationToken);
        return Ok(new { code = 0, data = tasks });
    }

    /// <summary>领取指定玩家每日任务的配置快照奖励。</summary>
    [HttpPost("{playerDailyTaskId:long}/claim")]
    public async Task<IActionResult> Claim(
        long playerDailyTaskId,
        ClaimDailyTaskRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await dailyTaskService.ClaimAsync(
                playerId,
                playerDailyTaskId,
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

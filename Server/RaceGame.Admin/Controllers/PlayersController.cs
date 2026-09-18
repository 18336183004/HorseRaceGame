using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 运营后台玩家管理控制器。
/// 提供玩家账号查询、模糊搜索、状态（启用/封禁）切换与运维审计能力。
/// </summary>
[Authorize]
public class PlayersController(
    AppDbContext db,
    ILogger<PlayersController> logger) : Controller
{
    /// <summary>
    /// 分页/模糊搜索展示玩家列表。
    /// </summary>
    /// <param name="q">搜索关键词（支持匹配玩家账号 AccountId 或昵称 Nickname）。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>玩家列表视图。</returns>
    [HttpGet]
    public async Task<IActionResult> Index(string? q, CancellationToken ct = default)
    {
        var query = db.Players.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var keyword = q.Trim();
            query = query.Where(x => x.AccountId.Contains(keyword) || x.Nickname.Contains(keyword));
        }

        ViewBag.Query = q;

        var players = await query
            .OrderByDescending(x => x.Id)
            .Take(200)
            .ToListAsync(ct);

        return View(players);
    }

    /// <summary>
    /// 切换玩家账号的启用/封禁状态。
    /// </summary>
    /// <param name="id">目标玩家主键 ID。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>重定向回玩家列表页面。</returns>
    [ValidateAntiForgeryToken]
    [HttpPost]
    public async Task<IActionResult> Toggle(long id, CancellationToken ct = default)
    {
        var player = await db.Players.FindAsync([id], ct);
        if (player is null)
        {
            return NotFound();
        }

        player.IsActive = !player.IsActive;
        player.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Player {PlayerId} IsActive changed to {IsActive} by admin {Admin}",
            id,
            player.IsActive,
            User.Identity?.Name);

        return RedirectToAction(nameof(Index));
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 运营后台比赛轮次记录与审计控制器。
/// 提供全量历史轮次状态、算法版本、随机种子摘要与结算状态的分页查询。
/// </summary>
[Authorize]
public class RoundsController(AppDbContext db) : Controller
{
    /// <summary>
    /// 分页查询比赛轮次历史列表。
    /// </summary>
    /// <param name="page">页码，从 1 开始。</param>
    /// <param name="pageSize">每页记录数，范围限制在 1~200。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>轮次历史列表视图。</returns>
    [HttpGet]
    public async Task<IActionResult> Index(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var rounds = await db.RaceRounds
            .AsNoTracking()
            .OrderByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        ViewBag.Page = page;
        ViewBag.PageSize = pageSize;

        return View(rounds);
    }
}

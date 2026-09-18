using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 运营后台注单数据与资金流向控制器。
/// 提供全服玩家下注订单、锁定赔率、盈亏结算状态与手续费明细的分页查询展示。
/// </summary>
[Authorize]
public class BetsController(AppDbContext db) : Controller
{
    /// <summary>
    /// 分页查询全服投注订单历史列表。
    /// </summary>
    /// <param name="page">页码，从 1 开始。</param>
    /// <param name="pageSize">每页记录数，范围限制在 1~200。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>投注订单列表视图。</returns>
    [HttpGet]
    public async Task<IActionResult> Index(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken ct = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 200);

        var orders = await db.BetOrders
            .AsNoTracking()
            .OrderByDescending(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .ToListAsync(ct);

        ViewBag.Page = page;
        ViewBag.PageSize = pageSize;

        return View(orders);
    }
}

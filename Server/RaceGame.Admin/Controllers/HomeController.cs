using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Entities;
using RaceGame.Domain.Enums;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 运营后台首页与仪表盘控制器。
/// 提供核心指标统计、近期轮次趋势分析、马匹胜率榜及下注流水数据。
/// </summary>
[Authorize]
public class HomeController(AppDbContext db) : Controller
{
    /// <summary>
    /// 加载运营仪表盘首页数据。
    /// 包含注册玩家、今日活跃、总轮次、注单数、激活马匹、流水总额、走势数据及热榜。
    /// </summary>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>仪表盘视图结果。</returns>
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        ViewBag.PlayerCount = await db.Players.CountAsync(ct);
        ViewBag.ActivePlayerCount = await db.Players.CountAsync(x => x.IsActive, ct);
        ViewBag.RoundCount = await db.RaceRounds.CountAsync(ct);
        ViewBag.BetCount = await db.BetOrders.CountAsync(ct);
        ViewBag.ActiveHorseCount = await db.HorseCatalogs.CountAsync(x => x.IsEnabled, ct);
        ViewBag.TotalBet = await db.BetOrders.SumAsync(x => (decimal?)x.BetAmount, ct) ?? 0m;

        var todayUtc = DateTime.UtcNow.Date;
        ViewBag.TodayBet = await db.BetOrders
            .Where(x => x.CreatedAt >= todayUtc)
            .SumAsync(x => (decimal?)x.BetAmount, ct) ?? 0m;

        var totalRounds = (long)ViewBag.RoundCount;
        var finishedRoundCount = await db.RaceRounds.CountAsync(x => x.State == RaceState.Finished, ct);
        ViewBag.SettlementRate = totalRounds > 0 
            ? Math.Round((double)finishedRoundCount / totalRounds * 100, 1) 
            : 100.0;

        // 获取最近比赛轮次（降序排前 10 条供表格展示）
        ViewBag.LatestRounds = await db.RaceRounds
            .AsNoTracking()
            .OrderByDescending(x => x.Id)
            .Take(10)
            .ToListAsync(ct);

        // 获取近期 12 轮次走势数据（升序供图表时间轴展示）
        var recentRounds = await db.RaceRounds
            .AsNoTracking()
            .OrderByDescending(x => x.Id)
            .Take(12)
            .ToListAsync(ct);
        recentRounds.Reverse();
        ViewBag.RecentTrendRounds = recentRounds;

        // 获取马匹胜率与胜场前 6 排行
        ViewBag.TopHorses = await db.HorseCatalogs
            .AsNoTracking()
            .Where(x => x.IsEnabled)
            .OrderByDescending(x => x.WinCount)
            .ThenByDescending(x => x.WinRate)
            .Take(6)
            .ToListAsync(ct);

        return View();
    }

    /// <summary>
    /// 错误页展示。
    /// </summary>
    [AllowAnonymous]
    public IActionResult Error() => View("~/Views/Shared/Error.cshtml");
}


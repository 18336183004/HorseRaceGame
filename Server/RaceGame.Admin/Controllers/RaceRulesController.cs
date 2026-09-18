using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;
/// <summary>
/// 后台比赛规则与轮次参数管理。
/// </summary>
[Authorize]
public class RaceRulesController(AppDbContext db, ILogger<RaceRulesController> logger) : Controller
{
    /// <summary>展示全部配置版本列表。</summary>
    public async Task<IActionResult> Index(CancellationToken ct)
    {
        var rules = await db.RaceRuleConfigs
            .OrderByDescending(x => x.IsActive)
            .ThenByDescending(x => x.Version)
            .ToListAsync(ct);
        return View(rules);
    }

    /// <summary>读取待编辑规则配置。</summary>
    [HttpGet]
    public async Task<IActionResult> Edit(long id, CancellationToken ct)
    {
        var rule = await db.RaceRuleConfigs.FindAsync([id], ct);
        return rule is null ? NotFound() : View(rule);
    }

    /// <summary>保存更新后的规则配置。</summary>
    [ValidateAntiForgeryToken]
    [HttpPost]
    public async Task<IActionResult> Edit(RaceRuleConfig model, CancellationToken ct)
    {
        var rule = await db.RaceRuleConfigs.FindAsync([model.Id], ct);
        if (rule is null)
        {
            return NotFound();
        }

        if (model.BettingDurationSeconds < 1 ||
            model.PrepareDurationSeconds < 0 ||
            model.RaceDurationSeconds < 1 ||
            model.PostRaceIntervalSeconds < 0)
        {
            ModelState.AddModelError("", "时间配置不合法");
            return View(model);
        }

        rule.MinBetAmount = model.MinBetAmount;
        rule.InitialWalletBalance = model.InitialWalletBalance;
        rule.ReliefWaitSeconds = model.ReliefWaitSeconds;
        rule.ReliefDailyLimit = model.ReliefDailyLimit;
        rule.BettingDurationSeconds = model.BettingDurationSeconds;
        rule.PrepareDurationSeconds = model.PrepareDurationSeconds;
        rule.RaceDurationSeconds = model.RaceDurationSeconds;
        rule.PostRaceIntervalSeconds = model.PostRaceIntervalSeconds;
        rule.OddsAlgorithmVersion = model.OddsAlgorithmVersion;
        rule.ResultAlgorithmVersion = model.ResultAlgorithmVersion;
        rule.BlackHorseAlgorithmVersion = model.BlackHorseAlgorithmVersion;
        rule.RoundingVersion = model.RoundingVersion;
        rule.IsMaintenanceEnabled = model.IsMaintenanceEnabled;
        rule.MaintenanceStartAt = model.MaintenanceStartAt.HasValue ? DateTime.SpecifyKind(model.MaintenanceStartAt.Value, DateTimeKind.Utc) : null;
        rule.MaintenanceEndAt = model.MaintenanceEndAt.HasValue ? DateTime.SpecifyKind(model.MaintenanceEndAt.Value, DateTimeKind.Utc) : null;
        rule.MaintenanceNoticeMinutes = model.MaintenanceNoticeMinutes;
        rule.MaintenanceReason = model.MaintenanceReason;
        rule.MaxRoundPayoutLiability = model.MaxRoundPayoutLiability;
        rule.ReferralCommissionRate = model.ReferralCommissionRate;
        rule.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);
        logger.LogInformation("RaceRule {RuleId} updated by {Admin}", rule.Id, User.Identity?.Name);
        return RedirectToAction(nameof(Index));
    }
}

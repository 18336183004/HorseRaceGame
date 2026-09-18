using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 运营后台赛马图鉴管理控制器。
/// 负责维护赛马基础数据、中文/英文名称、头像/立绘资源、排序权重以及是否参与轮次出战抽选。
/// </summary>
[Authorize]
public class HorsesController(
    AppDbContext db,
    ILogger<HorsesController> logger) : Controller
{
    /// <summary>
    /// 展示所有赛马编目图鉴列表。
    /// </summary>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>赛马列表视图。</returns>
    [HttpGet]
    public async Task<IActionResult> Index(CancellationToken ct = default)
    {
        var horses = await db.HorseCatalogs
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(ct);

        return View(horses);
    }

    /// <summary>
    /// 呈现赛马新增或编辑表单视图。
    /// </summary>
    /// <param name="id">赛马 ID（传 null 表示创建新马匹）。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>编辑表单视图。</returns>
    [HttpGet]
    public async Task<IActionResult> Edit(long? id, CancellationToken ct = default)
    {
        if (id is null)
        {
            return View(new HorseCatalog());
        }

        var horse = await db.HorseCatalogs.FindAsync([id.Value], ct);
        return View(horse ?? new HorseCatalog());
    }

    /// <summary>
    /// 提交保存赛马图鉴数据（新增或更新）。
    /// </summary>
    /// <param name="model">前端提交的赛马数据模型。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>成功时重定向至列表页，校验失败时回显错误。</returns>
    [ValidateAntiForgeryToken]
    [HttpPost]
    public async Task<IActionResult> Edit(HorseCatalog model, CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(model.HorseCode) || string.IsNullOrWhiteSpace(model.NameZh))
        {
            ModelState.AddModelError(string.Empty, "马匹编码和中文名称不能为空");
            return View(model);
        }

        HorseCatalog entity;

        if (model.Id == 0)
        {
            entity = model;
            entity.CreatedAt = DateTime.UtcNow;
            entity.UpdatedAt = DateTime.UtcNow;
            db.HorseCatalogs.Add(entity);
        }
        else
        {
            entity = await db.HorseCatalogs.FindAsync([model.Id], ct)
                ?? throw new InvalidOperationException($"Horse not found: {model.Id}");

            entity.HorseCode = model.HorseCode;
            entity.NameZh = model.NameZh;
            entity.NameEn = model.NameEn;
            entity.DescriptionZh = model.DescriptionZh;
            entity.AvatarAsset = model.AvatarAsset;
            entity.PortraitAsset = model.PortraitAsset;
            entity.SortOrder = model.SortOrder;
            entity.IsEnabled = model.IsEnabled;
            entity.UpdatedAt = DateTime.UtcNow;
        }

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Horse {HorseId}/{HorseCode} saved by admin {Admin}",
            entity.Id,
            entity.HorseCode,
            User.Identity?.Name);

        return RedirectToAction(nameof(Index));
    }

    /// <summary>
    /// 切换指定赛马的启用/停用状态。
    /// 停用后的赛马将不会被 Worker 选入后续轮次参赛名单。
    /// </summary>
    /// <param name="id">赛马 ID。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>重定向回列表页面。</returns>
    [ValidateAntiForgeryToken]
    [HttpPost]
    public async Task<IActionResult> Toggle(long id, CancellationToken ct = default)
    {
        var horse = await db.HorseCatalogs.FindAsync([id], ct);
        if (horse is null)
        {
            return NotFound();
        }

        horse.IsEnabled = !horse.IsEnabled;
        horse.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(ct);

        logger.LogInformation(
            "Horse {HorseId} enabled={Enabled} by admin {Admin}",
            id,
            horse.IsEnabled,
            User.Identity?.Name);

        return RedirectToAction(nameof(Index));
    }
}

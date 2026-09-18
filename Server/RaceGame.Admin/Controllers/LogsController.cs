using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 后台日志查询入口。
/// 文件日志用于基础设施排障，数据库三类业务日志用于比赛、马匹和角色业务追溯。
/// </summary>
[Authorize]
public class LogsController(
    IWebHostEnvironment environment,
    AppDbContext db) : Controller
{
    /// <summary>读取文件日志和指定类型的数据库业务日志。</summary>
    [HttpGet]
    public async Task<IActionResult> Index(
        string? file,
        string type = "race",
        long? roundId = null,
        long? playerId = null,
        int pageSize = 100,
        CancellationToken cancellationToken = default)
    {
        var root = Path.GetFullPath(
            Path.Combine(
                environment.ContentRootPath,
                "..",
                "..",
                "..",
                "logs"));

        Directory.CreateDirectory(root);

        ViewBag.Files = Directory
            .GetFiles(root, "*.log", SearchOption.AllDirectories)
            .OrderByDescending(System.IO.File.GetLastWriteTimeUtc)
            .Take(50)
            .Select(x => Path.GetRelativePath(root, x))
            .ToList();

        ViewBag.Selected = file;
        ViewBag.Type = type;
        ViewBag.RoundId = roundId;
        ViewBag.PlayerId = playerId;
        var effectivePageSize = Math.Clamp(pageSize, 10, 500);
        ViewBag.PageSize = effectivePageSize;

        if (!string.IsNullOrWhiteSpace(file))
        {
            var full = Path.GetFullPath(Path.Combine(root, file));
            var rootWithSeparator = root.EndsWith(
                Path.DirectorySeparatorChar.ToString(),
                StringComparison.Ordinal)
                ? root
                : root + Path.DirectorySeparatorChar;

            if (
                full.StartsWith(rootWithSeparator, StringComparison.OrdinalIgnoreCase)
                && System.IO.File.Exists(full))
            {
                ViewBag.Content = string.Join(
                    Environment.NewLine,
                    System.IO.File.ReadLines(full).TakeLast(500));
            }
        }

        switch (type.ToLowerInvariant())
        {
            case "horse":
                IQueryable<RaceGame.Domain.Entities.HorseLog> horseQuery = db.HorseLogs.AsNoTracking();
                if (roundId.HasValue)
                {
                    horseQuery = horseQuery.Where(x => x.RoundId == roundId.Value);
                }

                ViewBag.HorseLogs = await horseQuery
                    .OrderByDescending(x => x.Id)
                    .Take(effectivePageSize)
                    .Select(x => new
                    {
                        x.Id,
                        x.RoundId,
                        x.HorseNo,
                        x.HorseTemplateId,
                        x.EventType,
                        x.ExecutionStatus,
                        x.PayloadJson,
                        x.CreatedAt,
                    })
                    .ToListAsync(cancellationToken);
                break;

            case "character":
                IQueryable<RaceGame.Domain.Entities.CharacterLog> characterQuery = db.CharacterLogs.AsNoTracking();
                if (playerId.HasValue)
                {
                    characterQuery = characterQuery.Where(x => x.PlayerId == playerId.Value);
                }

                ViewBag.CharacterLogs = await characterQuery
                    .OrderByDescending(x => x.Id)
                    .Take(effectivePageSize)
                    .Select(x => new
                    {
                        x.Id,
                        x.PlayerId,
                        x.CharacterId,
                        x.PlayerCharacterId,
                        x.EventType,
                        x.ExecutionStatus,
                        x.PayloadJson,
                        x.CreatedAt,
                    })
                    .ToListAsync(cancellationToken);
                break;

            default:
                IQueryable<RaceGame.Domain.Entities.RaceLog> raceQuery = db.RaceLogs.AsNoTracking();
                if (roundId.HasValue)
                {
                    raceQuery = raceQuery.Where(x => x.RoundId == roundId.Value);
                }

                ViewBag.RaceLogs = await raceQuery
                    .OrderByDescending(x => x.Id)
                    .Take(effectivePageSize)
                    .Select(x => new
                    {
                        x.Id,
                        x.RoundId,
                        x.RoundNo,
                        x.EventType,
                        x.State,
                        x.ExecutionStatus,
                        x.PayloadJson,
                        x.CreatedAt,
                    })
                    .ToListAsync(cancellationToken);
                break;
        }

        return View();
    }
}

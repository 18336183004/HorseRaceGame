using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;

using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>提供客户端启动时读取的有效公告与规则内容。</summary>
[ApiController]
[Route("api/notices")]
public sealed class NoticeController(AppDbContext db) : ControllerBase
{
    /// <summary>返回当前已发布且处于有效时间窗口内的公告。</summary>
    [HttpGet("active")]
    public async Task<IActionResult> Active(CancellationToken cancellationToken)
    {
        var now = DateTime.UtcNow;
        var hasPlayer = User.TryGetPlayerId(out var playerId);

        var userReadVersions = hasPlayer
            ? await db.PlayerNoticeReads
                .AsNoTracking()
                .Where(x => x.PlayerId == playerId)
                .ToDictionaryAsync(x => x.NoticeId, x => x.DismissedVersion, cancellationToken)
            : new Dictionary<long, int?>();

        var rawNotices = await db.Notices
            .AsNoTracking()
            .Where(x => x.IsPublished)
            .Where(x => x.StartAt == null || x.StartAt <= now)
            .Where(x => x.EndAt == null || x.EndAt > now)
            .OrderByDescending(x => x.IsForced)
            .ThenBy(x => x.SortOrder)
            .ThenByDescending(x => x.Version)
            .ToListAsync(cancellationToken);

        var notices = rawNotices.Select(x => new
        {
            noticeId = x.Id,
            noticeCode = x.NoticeCode,
            titleZh = x.TitleZh,
            titleEn = x.TitleEn,
            contentZh = x.ContentZh,
            contentEn = x.ContentEn,
            noticeType = x.NoticeType,
            version = x.Version,
            isForced = x.IsForced,
            isRead = userReadVersions.TryGetValue(x.Id, out var ver) && ver >= x.Version,
            publishedAt = x.PublishedAt,
            startAt = x.StartAt,
            endAt = x.EndAt,
        }).ToList();

        return Ok(new { code = 0, data = notices, serverTime = now });
    }

    /// <summary>记录当前玩家已阅读的公告版本，重复提交不会产生重复记录。</summary>
    [Authorize]
    [HttpPost("{id:long}/read")]
    public async Task<IActionResult> MarkRead(
        long id,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var notice = await db.Notices
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.Id == id && x.IsPublished, cancellationToken);

        if (notice is null)
        {
            return NotFound(new { code = "NOTICE_NOT_FOUND", message = "公告不存在" });
        }

        var existing = await db.PlayerNoticeReads
            .FirstOrDefaultAsync(
                x => x.PlayerId == playerId && x.NoticeId == id,
                cancellationToken);

        if (existing is null)
        {
            db.PlayerNoticeReads.Add(new RaceGame.Domain.Entities.PlayerNoticeRead
            {
                PlayerId = playerId,
                NoticeId = id,
                DismissedVersion = notice.Version,
                ReadAt = DateTime.UtcNow,
                AcknowledgedAt = DateTime.UtcNow,
            });
            await db.SaveChangesAsync(cancellationToken);
        }
        else if (existing.DismissedVersion != notice.Version)
        {
            existing.DismissedVersion = notice.Version;
            existing.ReadAt = DateTime.UtcNow;
            existing.AcknowledgedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Ok(new
        {
            code = 0,
            data = new { noticeId = id, version = notice.Version },
        });
    }

}

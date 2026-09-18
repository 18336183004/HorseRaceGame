using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>提供玩家语言、时区和通知偏好的读取与修改。</summary>
[ApiController]
[Authorize]
[Route("api/player/settings")]
public sealed class SettingsController(AppDbContext db) : ControllerBase
{
    /// <summary>读取当前玩家设置；业务时间区默认使用 Europe/London。</summary>
    [HttpGet]
    public async Task<IActionResult> Get(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var settings = await db.PlayerSettings
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                language = settings?.Language ?? "zh-CN",
                timeZone = settings?.TimeZone ?? "Europe/London",
                allowPushNotice = settings?.AllowPushNotice ?? true,
                allowResultAnimation = settings?.AllowResultAnimation ?? true,
            },
        });
    }

    /// <summary>修改玩家设置；语言只接受当前产品支持的 zh-CN/en-US。</summary>
    [HttpPut]
    public async Task<IActionResult> Update(
        UpdatePlayerSettingsRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        if (request.Language is not ("zh-CN" or "en-US"))
        {
            return BadRequest(new
            {
                code = "LANGUAGE_NOT_SUPPORTED",
                message = "仅支持 zh-CN 和 en-US",
            });
        }

        var settings = await db.PlayerSettings
            .FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);

        if (settings is null)
        {
            settings = new RaceGame.Domain.Entities.PlayerSetting
            {
                PlayerId = playerId,
            };
            db.PlayerSettings.Add(settings);
        }

        settings.Language = request.Language;
        settings.TimeZone = "Europe/London";
        settings.AllowPushNotice = request.AllowPushNotice;
        settings.AllowResultAnimation = request.AllowResultAnimation;
        settings.UpdatedAt = DateTime.UtcNow;

        var player = await db.Players.FirstAsync(x => x.Id == playerId, cancellationToken);
        player.Locale = request.Language;
        player.UpdatedAt = DateTime.UtcNow;

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                language = settings.Language,
                timeZone = settings.TimeZone,
                settings.AllowPushNotice,
                settings.AllowResultAnimation,
            },
        });
    }
}

/// <summary>玩家设置修改请求。</summary>
public sealed record UpdatePlayerSettingsRequest(
    string Language,
    bool AllowPushNotice = true,
    bool AllowResultAnimation = true);

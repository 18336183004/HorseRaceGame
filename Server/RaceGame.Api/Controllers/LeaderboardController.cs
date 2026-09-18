using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 提供开服累计的个人和马匹胜率榜。
/// 榜单只读取结算后持久化统计，不在客户端重新计算。
/// </summary>
[ApiController]
[Route("api/leaderboards")]
public sealed class LeaderboardController(AppDbContext db) : ControllerBase
{
    /// <summary>读取个人累计胜率榜，使用胜率、胜场和玩家 ID 的稳定排序。</summary>
    [HttpGet("players")]
    public async Task<IActionResult> Players(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 100);

        var items = await db.PlayerStats
            .AsNoTracking()
            .Where(x => x.TotalRoundsParticipated >= 5)
            .Join(
                db.Players.AsNoTracking(),
                stats => stats.PlayerId,
                player => player.Id,
                (stats, player) => new
                {
                    playerId = player.Id,
                    nickname = player.Nickname,
                    totalRounds = stats.TotalRoundsParticipated,
                    totalWins = stats.TotalRoundsWon,
                    winRate = stats.WinRate,
                    totalBetAmount = stats.TotalBetAmount,
                    totalNetReward = stats.TotalNetReward,
                })
            .OrderByDescending(x => x.winRate)
            .ThenByDescending(x => x.totalWins)
            .ThenBy(x => x.playerId)
            .Take(limit)
            .ToListAsync(cancellationToken);

        return Ok(new { code = 0, data = items });
    }

    /// <summary>读取马匹累计胜率榜，使用胜率、胜场和马匹 ID 的稳定排序。</summary>
    [HttpGet("horses")]
    public async Task<IActionResult> Horses(
        [FromQuery] int limit = 50,
        CancellationToken cancellationToken = default)
    {
        limit = Math.Clamp(limit, 1, 100);

        var items = await db.HorseCatalogs
            .AsNoTracking()
            .Where(x => x.IsEnabled)
            .OrderByDescending(x => x.WinRate)
            .ThenByDescending(x => x.WinCount)
            .ThenBy(x => x.Id)
            .Take(limit)
            .Select(x => new
            {
                horseId = x.Id,
                horseCode = x.HorseCode,
                nameZh = x.NameZh,
                nameEn = x.NameEn,
                totalRaces = x.TotalRaces,
                winCount = x.WinCount,
                winRate = x.WinRate,
                rank1Probability = x.Rank1Probability,
                rank2Probability = x.Rank2Probability,
                rank3Probability = x.Rank3Probability,
                rank4Probability = x.Rank4Probability,
                rank5Probability = x.Rank5Probability,
                rank6Probability = x.Rank6Probability,
                avatarAsset = x.AvatarAsset,
                portraitAsset = x.PortraitAsset,
            })
            .ToListAsync(cancellationToken);

        return Ok(new { code = 0, data = items });
    }
}

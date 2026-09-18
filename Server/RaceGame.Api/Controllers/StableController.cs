using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;
using RaceGame.Application.Common;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

public sealed record AdoptHorseRequest(long HorseCatalogId, string? CustomName = null, string? IdempotencyKey = null);
public sealed record FeedHorseRequest(long HorseCatalogId, string? IdempotencyKey = null);

/// <summary>
/// 提供马场公开马匹主数据、长期统计以及玩家专属马房认领、养护与分红。
/// </summary>
[ApiController]
[Route("api/stable")]
public sealed class StableController(AppDbContext db) : ControllerBase
{
    /// <summary>
    /// 分页读取马场公开马匹。
    /// 页大小限制在 1～100，避免客户端一次加载全部历史数据。
    /// </summary>
    [HttpGet("horses")]
    public async Task<IActionResult> Horses(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.HorseCatalogs
            .AsNoTracking()
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                horseId = x.Id,
                horseCode = x.HorseCode,
                nameZh = x.NameZh,
                nameEn = x.NameEn,
                descriptionZh = x.DescriptionZh,
                descriptionEn = x.DescriptionEn,
                totalRaces = x.TotalRaces,
                winCount = x.WinCount,
                winRate = x.WinRate,
                rank1Count = x.Rank1Count,
                rank2Count = x.Rank2Count,
                rank3Count = x.Rank3Count,
                rank4Count = x.Rank4Count,
                rank5Count = x.Rank5Count,
                rank6Count = x.Rank6Count,
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

        return Ok(new
        {
            code = 0,
            data = new
            {
                page,
                pageSize,
                total,
                items,
            },
        });
    }

    /// <summary>读取单匹启用马匹的完整公开资料与第 1～6 名统计。</summary>
    [HttpGet("horses/{id:long}")]
    public async Task<IActionResult> Horse(long id, CancellationToken cancellationToken)
    {
        var horse = await db.HorseCatalogs
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.Id == id && x.IsEnabled,
                cancellationToken);

        if (horse is null)
        {
            return NotFound(new
            {
                code = "HORSE_NOT_FOUND",
                message = "马匹不存在",
            });
        }

        return Ok(new
        {
            code = 0,
            data = new
            {
                horseId = horse.Id,
                horseCode = horse.HorseCode,
                nameZh = horse.NameZh,
                nameEn = horse.NameEn,
                descriptionZh = horse.DescriptionZh,
                descriptionEn = horse.DescriptionEn,
                totalRaces = horse.TotalRaces,
                winCount = horse.WinCount,
                winRate = horse.WinRate,
                rank1Count = horse.Rank1Count,
                rank2Count = horse.Rank2Count,
                rank3Count = horse.Rank3Count,
                rank4Count = horse.Rank4Count,
                rank5Count = horse.Rank5Count,
                rank6Count = horse.Rank6Count,
                rank1Probability = horse.Rank1Probability,
                rank2Probability = horse.Rank2Probability,
                rank3Probability = horse.Rank3Probability,
                rank4Probability = horse.Rank4Probability,
                rank5Probability = horse.Rank5Probability,
                rank6Probability = horse.Rank6Probability,
                avatarAsset = horse.AvatarAsset,
                portraitAsset = horse.PortraitAsset,
            },
        });
    }

    /// <summary>读取当前玩家已认领的赛马、状态与待提取分红数据。</summary>
    [Authorize]
    [HttpGet("my")]
    public async Task<IActionResult> MyStable(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var stables = await db.PlayerHorseStables
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .OrderByDescending(x => x.AdoptedAt)
            .ToListAsync(cancellationToken);

        var catalogIds = stables.Select(x => x.HorseCatalogId).Distinct().ToList();
        var catalogs = await db.HorseCatalogs
            .AsNoTracking()
            .Where(x => catalogIds.Contains(x.Id))
            .ToDictionaryAsync(x => x.Id, cancellationToken);

        var unclaimedDividends = await db.HorseDividends
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId && !x.Claimed)
            .SumAsync(x => (decimal?)x.DividendAmount, cancellationToken) ?? 0m;

        var items = stables.Select(s =>
        {
            catalogs.TryGetValue(s.HorseCatalogId, out var cat);
            return new
            {
                stableId = s.Id,
                horseCatalogId = s.HorseCatalogId,
                customName = s.CustomName ?? cat?.NameZh ?? "未命名赛马",
                nameZh = cat?.NameZh ?? "未知赛马",
                nameEn = cat?.NameEn,
                avatarAsset = cat?.AvatarAsset,
                portraitAsset = cat?.PortraitAsset,
                conditionLevel = s.ConditionLevel,
                careCountToday = s.CareCountToday,
                totalCareerRaces = s.TotalCareerRaces,
                totalCareerWins = s.TotalCareerWins,
                accumulatedPurse = s.AccumulatedPurse,
                adoptedAt = s.AdoptedAt
            };
        });

        return Ok(new
        {
            code = 0,
            data = new
            {
                unclaimedDividends,
                horses = items
            }
        });
    }

    /// <summary>花费 1,000 金币认领一匹赛马，成为专属马主。</summary>
    [Authorize]
    [HttpPost("adopt")]
    public async Task<IActionResult> Adopt(
        [FromBody] AdoptHorseRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var horse = await db.HorseCatalogs.FirstOrDefaultAsync(x => x.Id == request.HorseCatalogId && x.IsEnabled, cancellationToken);
        if (horse is null)
        {
            return NotFound(new { code = "HORSE_NOT_FOUND", message = "赛马不存在或已退役" });
        }

        var alreadyAdopted = await db.PlayerHorseStables.AnyAsync(x => x.PlayerId == playerId && x.HorseCatalogId == request.HorseCatalogId, cancellationToken);
        if (alreadyAdopted)
        {
            return BadRequest(new { code = "ALREADY_ADOPTED", message = "你已经认领过该匹赛马" });
        }

        var idemKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
            ? $"adopt:{playerId}:{request.HorseCatalogId}:{Guid.NewGuid():N}"
            : request.IdempotencyKey.Trim();

        var existingTx = await db.WalletTransactions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId && x.IdempotencyKey == idemKey, cancellationToken);
        if (existingTx != null)
        {
            var existingStable = await db.PlayerHorseStables.AsNoTracking()
                .FirstOrDefaultAsync(x => x.PlayerId == playerId && x.HorseCatalogId == request.HorseCatalogId, cancellationToken);
            var currentWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);
            return Ok(new
            {
                code = 0,
                data = new
                {
                    stableId = existingStable?.Id ?? 0,
                    horseCatalogId = request.HorseCatalogId,
                    customName = existingStable?.CustomName,
                    newBalance = currentWallet?.Balance ?? 0m
                }
            });
        }

        const decimal adoptCost = 1000.00m;
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken);
        if (wallet is null || wallet.Balance < adoptCost)
        {
            return BadRequest(new { code = "INSUFFICIENT_FUNDS", message = $"金币不足，认领赛马需要 {adoptCost:N0} 金币" });
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - adoptCost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "STABLE_ADOPT",
            Amount = -adoptCost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "HORSE_CATALOG",
            ReferenceId = request.HorseCatalogId.ToString(),
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        var stable = new PlayerHorseStable
        {
            PlayerId = playerId,
            HorseCatalogId = request.HorseCatalogId,
            CustomName = string.IsNullOrWhiteSpace(request.CustomName) ? horse.NameZh : request.CustomName.Trim(),
            ConditionLevel = 100,
            CareCountToday = 0,
            TotalCareerRaces = 0,
            TotalCareerWins = 0,
            AccumulatedPurse = 0m,
            AdoptedAt = DateTime.UtcNow
        };
        db.PlayerHorseStables.Add(stable);
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                stableId = stable.Id,
                horseCatalogId = stable.HorseCatalogId,
                customName = stable.CustomName,
                newBalance = wallet.Balance
            }
        });
    }

    /// <summary>消耗 50 金币投喂加州有机胡萝卜，赛马状态提升至 100 (绝好调)。</summary>
    [Authorize]
    [HttpPost("feed")]
    public async Task<IActionResult> Feed(
        [FromBody] FeedHorseRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var stable = await db.PlayerHorseStables.FirstOrDefaultAsync(
            x => x.PlayerId == playerId && x.HorseCatalogId == request.HorseCatalogId, cancellationToken);
        if (stable is null)
        {
            return NotFound(new { code = "STABLE_NOT_FOUND", message = "尚未认领该赛马" });
        }

        var idemKey = string.IsNullOrWhiteSpace(request.IdempotencyKey)
            ? $"feed:{playerId}:{request.HorseCatalogId}:{Guid.NewGuid():N}"
            : request.IdempotencyKey.Trim();

        var existingTx = await db.WalletTransactions.AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId && x.IdempotencyKey == idemKey, cancellationToken);
        if (existingTx != null)
        {
            var currentWallet = await db.Wallets.AsNoTracking().FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken);
            return Ok(new
            {
                code = 0,
                data = new
                {
                    conditionLevel = stable.ConditionLevel,
                    careCountToday = stable.CareCountToday,
                    newBalance = currentWallet?.Balance ?? 0m
                }
            });
        }

        const decimal feedCost = 50.00m;
        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken);
        if (wallet is null || wallet.Balance < feedCost)
        {
            return BadRequest(new { code = "INSUFFICIENT_FUNDS", message = $"金币不足，投喂胡萝卜需要 {feedCost:N0} 金币" });
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - feedCost);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "STABLE_FEED",
            Amount = -feedCost,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "HORSE_CATALOG",
            ReferenceId = request.HorseCatalogId.ToString(),
            IdempotencyKey = idemKey,
            CreatedAt = DateTime.UtcNow
        });

        stable.ConditionLevel = 100;
        stable.CareCountToday += 1;
        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                conditionLevel = stable.ConditionLevel,
                careCountToday = stable.CareCountToday,
                newBalance = wallet.Balance
            }
        });
    }

    /// <summary>一键提取名下所有出战赛马累计的出赛分红进钱包。</summary>
    [Authorize]
    [HttpPost("claim-dividends")]
    public async Task<IActionResult> ClaimDividends(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        await using var tx = await db.Database.BeginTransactionAsync(cancellationToken);

        var unclaimedList = await db.HorseDividends
            .Where(x => x.PlayerId == playerId && !x.Claimed)
            .ToListAsync(cancellationToken);

        if (unclaimedList.Count == 0)
        {
            return Ok(new { code = 0, data = new { claimedAmount = 0m, message = "暂无可提取的分红" } });
        }

        var totalAmount = unclaimedList.Sum(x => x.DividendAmount);
        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken);
        if (wallet is null)
        {
            return BadRequest(new { code = "WALLET_NOT_FOUND", message = "钱包不存在" });
        }

        var before = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance + totalAmount);
        wallet.Version++;
        wallet.UpdatedAt = DateTime.UtcNow;

        foreach (var item in unclaimedList)
        {
            item.Claimed = true;
        }

        var stables = await db.PlayerHorseStables.Where(x => x.PlayerId == playerId).ToListAsync(cancellationToken);
        foreach (var s in stables)
        {
            s.AccumulatedPurse = 0m;
        }

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = "STABLE_DIVIDEND",
            Amount = totalAmount,
            BalanceBefore = before,
            BalanceAfter = wallet.Balance,
            FeeRate = 0m,
            FeeAmount = 0m,
            ReferenceType = "DIVIDENDS",
            ReferenceId = unclaimedList.Count.ToString(),
            IdempotencyKey = $"claim_div:{playerId}:{Guid.NewGuid():N}",
            CreatedAt = DateTime.UtcNow
        });

        await db.SaveChangesAsync(cancellationToken);
        await tx.CommitAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                claimedAmount = totalAmount,
                newBalance = wallet.Balance,
                claimedCount = unclaimedList.Count
            }
        });
    }
}

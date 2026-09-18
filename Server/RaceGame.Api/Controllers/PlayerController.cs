using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;
using RaceGame.Application.Common;
using RaceGame.Application.Referrals;
using RaceGame.Domain.Enums;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 提供玩家自己的摘要、角色状态、救济状态、下注历史与好友裂变推荐。
/// 所有结果均以服务端持久化数据为准。
/// </summary>
[ApiController]
[Route("api/player")]
[Authorize]
public sealed class PlayerController(AppDbContext db, PlayerReferralService referralService) : ControllerBase
{
    /// <summary>读取当前玩家、钱包、累计统计、当前角色和补偿状态。</summary>
    [HttpGet("me")]
    public async Task<IActionResult> Me(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        // 玩家上线/刷新时自动结算到期的破产救济金（每日限额 5 次内自动充值到账）
        await ReliefScheduler.ProcessPlayerPendingReliefGrantsAsync(db, playerId, DateTime.UtcNow, cancellationToken);

        var playerSummary = await (
            from p in db.Players.AsNoTracking().Where(x => x.Id == playerId)
            join w in db.Wallets.AsNoTracking() on p.Id equals w.PlayerId into wallets
            from w in wallets.DefaultIfEmpty()
            join s in db.PlayerStats.AsNoTracking() on p.Id equals s.PlayerId into stats
            from s in stats.DefaultIfEmpty()
            select new
            {
                p.Id,
                p.AccountId,
                p.Nickname,
                p.AvatarAsset,
                p.Locale,
                p.Level,
                p.Exp,
                p.InviteCode,
                p.ReferredByPlayerId,
                Balance = (decimal?)w.Balance,
                TotalRoundsParticipated = (long?)s.TotalRoundsParticipated,
                TotalRoundsWon = (long?)s.TotalRoundsWon,
                WinRate = (decimal?)s.WinRate,
                TotalNetProfitWins = (long?)s.TotalNetProfitWins,
                CurrentHitStreak = (int?)s.CurrentHitStreak,
                MaxHitStreak = (int?)s.MaxHitStreak,
                CurrentProfitStreak = (int?)s.CurrentProfitStreak,
                MaxProfitStreak = (int?)s.MaxProfitStreak,
            }
        ).FirstOrDefaultAsync(cancellationToken);

        if (playerSummary is null)
        {
            return Unauthorized(new { code = "PLAYER_NOT_FOUND", message = "玩家不存在或登录已失效" });
        }

        var equippedCharacter = await db.PlayerCharacters
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId && x.IsEquipped)
            .Join(
                db.CharacterCatalogs.AsNoTracking(),
                owned => owned.CharacterId,
                catalog => catalog.Id,
                (owned, catalog) => new
                {
                    characterId = catalog.Id,
                    characterCode = catalog.CharacterCode,
                    nameZh = catalog.NameZh,
                    nameEn = catalog.NameEn,
                    avatarAsset = catalog.AvatarAsset,
                    portraitAsset = catalog.PortraitAsset,
                    level = owned.Level,
                    exp = owned.Exp,
                })
            .FirstOrDefaultAsync(cancellationToken);

        var businessDate = DateOnly.FromDateTime(DateTime.UtcNow);
        var todayGrantedCount = await db.PlayerReliefGrants
            .AsNoTracking()
            .CountAsync(x => x.PlayerId == playerId && x.BusinessDate == businessDate && (x.Status == "GRANTED" || x.Status == "CLAIMED"), cancellationToken);

        var reliefEntity = await db.PlayerReliefGrants
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .OrderByDescending(x => x.Id)
            .FirstOrDefaultAsync(cancellationToken);

        var relief = reliefEntity == null ? null : new
        {
            reliefEntity.Status,
            reliefEntity.ScheduledAt,
            reliefEntity.GrantAt,
            reliefEntity.Amount,
            reliefEntity.BusinessDate,
            reliefEntity.GrantedTransactionId,
            dailyCount = todayGrantedCount,
        };

        return Ok(new
        {
            code = 0,
            data = new
            {
                playerId = playerSummary.Id,
                accountId = playerSummary.AccountId,
                nickname = playerSummary.Nickname,
                avatarAsset = playerSummary.AvatarAsset,
                locale = playerSummary.Locale,
                level = playerSummary.Level,
                exp = playerSummary.Exp,
                inviteCode = playerSummary.InviteCode ?? ("RG" + playerSummary.Id.ToString().PadLeft(6, '0')),
                referredBy = playerSummary.ReferredByPlayerId,
                balance = playerSummary.Balance ?? 0m,
                totalRoundsParticipated = playerSummary.TotalRoundsParticipated ?? 0,
                totalRoundsWon = playerSummary.TotalRoundsWon ?? 0,
                winRate = playerSummary.WinRate ?? 0m,
                totalNetProfitWins = playerSummary.TotalNetProfitWins ?? 0,
                currentHitStreak = playerSummary.CurrentHitStreak ?? 0,
                maxHitStreak = playerSummary.MaxHitStreak ?? 0,
                currentProfitStreak = playerSummary.CurrentProfitStreak ?? 0,
                maxProfitStreak = playerSummary.MaxProfitStreak ?? 0,
                character = equippedCharacter,
                relief,
            },
        });
    }

    /// <summary>获取当前玩家专属邀请码、已邀请人数与裂变返佣明细。</summary>
    [HttpGet("referral")]
    public async Task<IActionResult> Referral(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var summary = await referralService.GetReferralSummaryAsync(playerId, cancellationToken);
        return Ok(new { code = 0, data = summary });
    }

    /// <summary>绑定推荐人邀请码，发放新手礼包与邀请奖励。</summary>
    [HttpPost("referral/bind")]
    public async Task<IActionResult> BindReferral(
        BindReferralRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await referralService.BindReferralAsync(playerId, request, cancellationToken);
            return Ok(new { code = 0, data = result });
        }
        catch (BusinessRuleException ex)
        {
            return Conflict(new { code = ex.Code, message = ex.Message });
        }
    }

    /// <summary>主动提炼并领取所有未结返佣至钱包余额。</summary>
    [HttpPost("referral/claim")]
    public async Task<IActionResult> ClaimReferralCommission(
        ClaimCommissionRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await referralService.ClaimCommissionAsync(playerId, request, cancellationToken);
            return Ok(new { code = 0, data = result });
        }
        catch (BusinessRuleException ex)
        {
            return Conflict(new { code = ex.Code, message = ex.Message });
        }
    }

    /// <summary>
    /// 分页查询当前玩家的下注记录。
    /// 可按订单状态、起止 UTC 时间筛选，避免客户端一次加载全部历史。
    /// </summary>
    [HttpGet("bets")]
    public async Task<IActionResult> Bets(
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 20,
        [FromQuery] int? status = null,
        [FromQuery] DateTime? fromUtc = null,
        [FromQuery] DateTime? toUtc = null,
        CancellationToken cancellationToken = default)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.BetOrders
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId);

        if (status.HasValue)
        {
            var targetStatus = (RaceGame.Domain.Enums.BetOrderStatus)status.Value;
            query = query.Where(x => x.Status == targetStatus);
        }

        if (fromUtc.HasValue)
        {
            query = query.Where(x => x.CreatedAt >= fromUtc.Value.ToUniversalTime());
        }

        if (toUtc.HasValue)
        {
            query = query.Where(x => x.CreatedAt < toUtc.Value.ToUniversalTime());
        }

        query = query.OrderByDescending(x => x.Id);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.OrderNo,
                x.RoundId,
                x.PlayType,
                x.HorseNo,
                x.SecondHorseNo,
                x.Combination,
                x.BetAmount,
                x.LockedOdds,
                x.GrossReward,
                x.FeeRate,
                x.FeeAmount,
                x.NetReward,
                x.DilutionFactor,
                status = (int)x.Status,
                x.StatusReason,
                x.IsDoubleDown,
                x.DoubleDownAmount,
                x.CreatedAt,
                x.SettledAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new { page, pageSize, total, items },
        });
    }

    /// <summary>读取单笔下注的赛果与钱包流水摘要。</summary>
    [HttpGet("bets/{orderNo}")]
    public async Task<IActionResult> BetDetail(string orderNo, CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var order = await db.BetOrders
            .AsNoTracking()
            .FirstOrDefaultAsync(
                x => x.PlayerId == playerId && x.OrderNo == orderNo,
                cancellationToken);

        if (order is null)
        {
            return NotFound(new { code = "BET_ORDER_NOT_FOUND", message = "注单不存在" });
        }

        var round = await db.RaceRounds
            .AsNoTracking()
            .Include(x => x.Horses)
            .FirstOrDefaultAsync(x => x.Id == order.RoundId, cancellationToken);

        var transactions = await db.WalletTransactions
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId && x.ReferenceId == order.OrderNo)
            .OrderBy(x => x.Id)
            .Select(x => new
            {
                x.TransactionType,
                x.Amount,
                x.BalanceBefore,
                x.BalanceAfter,
                x.FeeAmount,
                x.CreatedAt,
            })
            .ToListAsync(cancellationToken);

        var revealResult = round?.State == RaceState.Finished;
        var revealAnimation = round?.State is RaceState.Racing or RaceState.Settlement or RaceState.Finished;

        return Ok(new
        {
            code = 0,
            data = new
            {
                order = new
                {
                    order.OrderNo,
                    order.RoundId,
                    order.PlayType,
                    order.HorseNo,
                    order.SecondHorseNo,
                    order.Combination,
                    order.BetAmount,
                    order.LockedOdds,
                    order.GrossReward,
                    order.FeeRate,
                    order.FeeAmount,
                    order.NetReward,
                    order.DilutionFactor,
                    status = (int)order.Status,
                    order.StatusReason,
                    order.IsDoubleDown,
                    order.DoubleDownAmount,
                    order.CreatedAt,
                    order.SettledAt,
                },
                race = round is null
                    ? null
                    : new
                    {
                        round.Id,
                        round.RoundNo,
                        state = (int)round.State,
                        winnerHorseNo = revealResult ? round.WinnerHorseNo : null,
                        secondHorseNo = revealResult ? round.SecondHorseNo : null,
                        quinellaCombination = revealResult ? round.QuinellaCombination : null,
                        horses = round.Horses
                            .OrderBy(x => x.HorseNo)
                            .Select(x => new
                            {
                                x.HorseNo,
                                x.HorseNameZhSnapshot,
                                finalRank = revealResult ? x.FinalRank : null,
                                finishTime = revealAnimation ? x.FinishTime : null,
                                isBlackHorse = revealResult ? (bool?)x.IsBlackHorse : null,
                            }),
                    },
                walletTransactions = transactions,
            },
        });
    }
}

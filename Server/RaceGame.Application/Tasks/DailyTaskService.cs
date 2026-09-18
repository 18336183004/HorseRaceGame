using System.Data;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Common;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Tasks;

/// <summary>每日任务查询结果，包含配置、当天进度和领奖状态。</summary>
public sealed record DailyTaskDto(
    long PlayerDailyTaskId,
    long TaskDefinitionId,
    string TaskCode,
    string TaskType,
    string TitleZh,
    string? TitleEn,
    int TargetValue,
    int Progress,
    bool IsCompleted,
    bool IsClaimed,
    string RewardType,
    string? RewardPayload);

/// <summary>每日任务领奖请求；幂等键必须在客户端重试时保持不变。</summary>
public sealed record ClaimDailyTaskRequest(string IdempotencyKey);

/// <summary>每日任务领奖完成或幂等重放时返回的结果。</summary>
public sealed record DailyTaskClaimResponse(
    long ClaimId,
    long PlayerDailyTaskId,
    string ClaimStatus,
    decimal Balance,
    DateTime ServerTime);

/// <summary>
/// 管理每日任务的生成、查询、比赛进度推进和幂等奖励领取。
/// 业务日统一按 Europe/London 计算，资产发放与领奖记录在同一数据库事务中完成。
/// </summary>
public sealed class DailyTaskService(IGameDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>获取玩家当前伦敦业务日的任务，并为新启用任务创建零进度记录。</summary>
    public async Task<IReadOnlyList<DailyTaskDto>> GetCurrentAsync(
        long playerId,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var businessDate = GetLondonBusinessDate(utcNow);
        await EnsureDailyTasksAsync(playerId, businessDate, utcNow, cancellationToken);

        var tasks = await db.PlayerDailyTasks
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId && x.BusinessDate == businessDate)
            .Join(
                db.DailyTaskDefinitions.AsNoTracking(),
                playerTask => playerTask.TaskDefinitionId,
                definition => definition.Id,
                (playerTask, definition) => new
                {
                    PlayerTaskId = playerTask.Id,
                    DefinitionId = definition.Id,
                    definition.TaskCode,
                    definition.TaskType,
                    definition.TitleZh,
                    definition.TitleEn,
                    definition.TargetValue,
                    playerTask.Progress,
                    playerTask.IsCompleted,
                    IsClaimed = playerTask.ClaimedAt != null,
                    definition.RewardType,
                    definition.RewardPayload,
                    playerTask.TaskDefinitionId
                })
            .OrderBy(x => x.TaskDefinitionId)
            .ToListAsync(cancellationToken);

        return tasks
            .Select(x => new DailyTaskDto(
                x.PlayerTaskId,
                x.DefinitionId,
                x.TaskCode,
                x.TaskType,
                x.TitleZh,
                x.TitleEn,
                x.TargetValue,
                x.Progress,
                x.IsCompleted,
                x.IsClaimed,
                x.RewardType,
                x.RewardPayload))
            .ToList();
    }

    /// <summary>
    /// 在轮次结算事务中为参与玩家推进场次、胜场或负场任务。
    /// 本方法只修改当前 DbContext 的跟踪实体，不自行提交事务，由结算用例统一保存。
    /// </summary>
    public async Task RecordRaceResultsAsync(
        IReadOnlyCollection<long> participantPlayerIds,
        IReadOnlyCollection<long> winnerPlayerIds,
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        var businessDate = GetLondonBusinessDate(utcNow);
        var winnerSet = winnerPlayerIds.ToHashSet();

        foreach (var playerId in participantPlayerIds.Distinct())
        {
            await EnsureDailyTasksAsync(playerId, businessDate, utcNow, cancellationToken);
            var tasks = await db.PlayerDailyTasks
                .Where(x => x.PlayerId == playerId && x.BusinessDate == businessDate)
                .Join(
                    db.DailyTaskDefinitions,
                    playerTask => playerTask.TaskDefinitionId,
                    definition => definition.Id,
                    (playerTask, definition) => new { PlayerTask = playerTask, Definition = definition })
                .ToListAsync(cancellationToken);

            foreach (var task in tasks)
            {
                var shouldIncrement = task.Definition.TaskType switch
                {
                    GameBusinessCodes.DailyRaceCountTask => true,
                    GameBusinessCodes.DailyRaceWinTask => winnerSet.Contains(playerId),
                    GameBusinessCodes.DailyRaceLossTask => !winnerSet.Contains(playerId),
                    _ => false,
                };

                if (!shouldIncrement)
                {
                    continue;
                }

                task.PlayerTask.Progress = Math.Min(task.Definition.TargetValue, task.PlayerTask.Progress + 1);
                task.PlayerTask.IsCompleted = task.PlayerTask.Progress >= task.Definition.TargetValue;
                task.PlayerTask.CompletedAt ??= task.PlayerTask.IsCompleted ? utcNow : null;
                task.PlayerTask.UpdatedAt = utcNow;
            }
        }
    }

    /// <summary>
    /// 领取已完成任务的配置快照奖励。
    /// 当前支持金币与物品奖励；未知奖励类型会在资产变更前被拒绝。
    /// </summary>
    public async Task<DailyTaskClaimResponse> ClaimAsync(
        long playerId,
        long playerDailyTaskId,
        ClaimDailyTaskRequest request,
        CancellationToken cancellationToken = default)
    {
        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }

        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);
        var existingClaim = await db.DailyTaskClaims
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, cancellationToken);

        if (existingClaim is not null)
        {
            if (existingClaim.PlayerId != playerId || existingClaim.PlayerDailyTaskId != playerDailyTaskId)
            {
                throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
            }

            var existingBalance = await GetBalanceAsync(playerId, cancellationToken);
            return MapResponse(existingClaim, existingBalance);
        }

        var playerTask = await db.PlayerDailyTasks.SingleOrDefaultAsync(
            x => x.Id == playerDailyTaskId && x.PlayerId == playerId,
            cancellationToken) ?? throw new BusinessRuleException("DAILY_TASK_NOT_FOUND", "每日任务不存在");
        var definition = await db.DailyTaskDefinitions.SingleAsync(
            x => x.Id == playerTask.TaskDefinitionId,
            cancellationToken);

        if (!playerTask.IsCompleted)
        {
            throw new BusinessRuleException("DAILY_TASK_NOT_COMPLETED", "每日任务尚未完成");
        }

        if (playerTask.ClaimedAt is not null)
        {
            throw new BusinessRuleException("DAILY_TASK_ALREADY_CLAIMED", "每日任务奖励已领取");
        }

        var reward = ParseReward(definition.RewardPayload);
        var utcNow = DateTime.UtcNow;
        var claim = new DailyTaskClaim
        {
            PlayerId = playerId,
            PlayerDailyTaskId = playerTask.Id,
            BusinessDate = playerTask.BusinessDate,
            ClaimStatus = GameBusinessCodes.PendingStatus,
            RewardTypeSnapshot = definition.RewardType,
            RewardPayloadSnapshot = definition.RewardPayload,
            IdempotencyKey = request.IdempotencyKey,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };
        try
        {
            db.DailyTaskClaims.Add(claim);
            await db.SaveChangesAsync(cancellationToken);

            if (string.Equals(definition.RewardType, GameBusinessCodes.CoinReward, StringComparison.OrdinalIgnoreCase))
            {
                claim.WalletTransactionId = await GrantCoinAsync(playerId, claim.Id, reward, utcNow, cancellationToken);
            }
            else if (string.Equals(definition.RewardType, GameBusinessCodes.ItemReward, StringComparison.OrdinalIgnoreCase))
            {
                claim.ItemTransactionId = await GrantItemAsync(playerId, claim.Id, reward, utcNow, cancellationToken);
            }
            else
            {
                throw new BusinessRuleException("DAILY_TASK_REWARD_NOT_SUPPORTED", "任务奖励类型暂不支持");
            }

            playerTask.ClaimedAt = utcNow;
            playerTask.UpdatedAt = utcNow;
            claim.ClaimStatus = GameBusinessCodes.CompletedStatus;
            claim.UpdatedAt = utcNow;
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);

            return MapResponse(claim, await GetBalanceAsync(playerId, cancellationToken));
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "uq_daily_task_claims_idempotency_key"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return await HandleIdempotentConflictAsync(playerId, playerDailyTaskId, request, cancellationToken);
        }
    }

    /// <summary>
    /// 当并发领奖触发幂等键唯一约束冲突时，回查已持久化的领奖记录并幂等重放结果。
    /// </summary>
    private async Task<DailyTaskClaimResponse> HandleIdempotentConflictAsync(
        long playerId,
        long playerDailyTaskId,
        ClaimDailyTaskRequest request,
        CancellationToken cancellationToken)
    {
        var existingClaim = await db.DailyTaskClaims
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, cancellationToken)
            ?? throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等领奖已被处理，但无法重新读取记录");

        if (existingClaim.PlayerId != playerId || existingClaim.PlayerDailyTaskId != playerDailyTaskId)
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
        }

        var existingBalance = await GetBalanceAsync(playerId, cancellationToken);
        return MapResponse(existingClaim, existingBalance);
    }

    private static bool IsUniqueConstraintViolation(DbUpdateException ex, string? constraintName = null)
    {
        for (Exception? current = ex; current is not null; current = current.InnerException)
        {
            if (current.Message.Contains("23505", StringComparison.OrdinalIgnoreCase) ||
                current.Message.Contains("unique constraint", StringComparison.OrdinalIgnoreCase))
            {
                if (string.IsNullOrEmpty(constraintName) || current.Message.Contains(constraintName, StringComparison.OrdinalIgnoreCase))
                {
                    return true;
                }
            }
        }
        return false;
    }

    /// <summary>为当前生效任务定义创建当天玩家进度记录。</summary>
    private async Task EnsureDailyTasksAsync(
        long playerId,
        DateOnly businessDate,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var definitionIds = await db.DailyTaskDefinitions
            .Where(x => x.IsEnabled)
            .Where(x => x.EffectiveStartAt == null || x.EffectiveStartAt <= utcNow)
            .Where(x => x.EffectiveEndAt == null || x.EffectiveEndAt > utcNow)
            .Select(x => x.Id)
            .ToListAsync(cancellationToken);
        var existingIds = await db.PlayerDailyTasks
            .Where(x => x.PlayerId == playerId && x.BusinessDate == businessDate)
            .Select(x => x.TaskDefinitionId)
            .ToListAsync(cancellationToken);

        foreach (var definitionId in definitionIds.Except(existingIds))
        {
            db.PlayerDailyTasks.Add(new PlayerDailyTask
            {
                PlayerId = playerId,
                TaskDefinitionId = definitionId,
                BusinessDate = businessDate,
                UpdatedAt = utcNow,
            });
        }

        await db.SaveChangesAsync(cancellationToken);
    }

    /// <summary>发放任务金币奖励并返回钱包流水主键。</summary>
    private async Task<long> GrantCoinAsync(
        long playerId,
        long claimId,
        RewardPayload reward,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var amount = reward.Amount is > 0m
            ? MoneyMath.Round(reward.Amount.Value)
            : throw new BusinessRuleException("INVALID_DAILY_TASK_REWARD", "任务金币奖励配置无效");
        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");
        var balanceBefore = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance + amount);
        wallet.Version++;
        wallet.UpdatedAt = utcNow;

        var walletTransaction = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = GameBusinessCodes.DailyTaskRewardTransaction,
            Amount = amount,
            BalanceBefore = balanceBefore,
            BalanceAfter = wallet.Balance,
            ReferenceType = GameBusinessCodes.DailyTaskClaimReference,
            ReferenceId = claimId.ToString(),
            IdempotencyKey = $"wallet:task:{claimId}",
        };
        db.WalletTransactions.Add(walletTransaction);
        await db.SaveChangesAsync(cancellationToken);
        return walletTransaction.Id;
    }

    /// <summary>发放任务物品奖励并返回物品流水主键。</summary>
    private async Task<long> GrantItemAsync(
        long playerId,
        long claimId,
        RewardPayload reward,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var itemId = reward.ItemId is > 0
            ? reward.ItemId.Value
            : throw new BusinessRuleException("INVALID_DAILY_TASK_REWARD", "任务物品奖励配置无效");
        var quantity = reward.Quantity is > 0
            ? reward.Quantity.Value
            : throw new BusinessRuleException("INVALID_DAILY_TASK_REWARD", "任务物品数量配置无效");
        var inventory = await db.PlayerItems.SingleOrDefaultAsync(
            x => x.PlayerId == playerId && x.ItemId == itemId,
            cancellationToken);
        var quantityBefore = inventory?.Quantity ?? 0;

        if (inventory is null)
        {
            inventory = new PlayerItem
            {
                PlayerId = playerId,
                ItemId = itemId,
                CreatedAt = utcNow,
            };
            db.PlayerItems.Add(inventory);
        }

        inventory.Quantity = checked(quantityBefore + quantity);
        inventory.UpdatedAt = utcNow;
        var itemTransaction = new PlayerItemTransaction
        {
            PlayerId = playerId,
            ItemId = itemId,
            ChangeType = GameBusinessCodes.DailyTaskRewardTransaction,
            QuantityChange = quantity,
            QuantityBefore = quantityBefore,
            QuantityAfter = inventory.Quantity,
            ReferenceType = GameBusinessCodes.DailyTaskClaimReference,
            ReferenceId = claimId.ToString(),
            IdempotencyKey = $"item:task:{claimId}",
        };
        db.PlayerItemTransactions.Add(itemTransaction);
        await db.SaveChangesAsync(cancellationToken);
        return itemTransaction.Id;
    }

    /// <summary>解析后台配置的奖励 JSON，并把格式错误转换为稳定业务错误。</summary>
    private static RewardPayload ParseReward(string? rewardPayload)
    {
        if (string.IsNullOrWhiteSpace(rewardPayload))
        {
            throw new BusinessRuleException("INVALID_DAILY_TASK_REWARD", "任务奖励尚未配置");
        }

        try
        {
            return JsonSerializer.Deserialize<RewardPayload>(rewardPayload, JsonOptions)
                ?? throw new BusinessRuleException("INVALID_DAILY_TASK_REWARD", "任务奖励配置无效");
        }
        catch (JsonException)
        {
            throw new BusinessRuleException("INVALID_DAILY_TASK_REWARD", "任务奖励配置无效");
        }
    }

    /// <summary>将 UTC 时间转换为项目约定的伦敦自然日。</summary>
    private static DateOnly GetLondonBusinessDate(DateTime utcNow)
        => BusinessDateTime.GetLondonDate(utcNow);

    /// <summary>读取玩家当前余额，用于正常和幂等重放响应。</summary>
    private async Task<decimal> GetBalanceAsync(long playerId, CancellationToken cancellationToken)
    {
        return await db.Wallets
            .Where(x => x.PlayerId == playerId)
            .Select(x => x.Balance)
            .SingleAsync(cancellationToken);
    }

    /// <summary>将领奖实体转换为稳定 API 响应。</summary>
    private static DailyTaskClaimResponse MapResponse(DailyTaskClaim claim, decimal balance)
    {
        return new DailyTaskClaimResponse(
            claim.Id,
            claim.PlayerDailyTaskId,
            claim.ClaimStatus,
            balance,
            DateTime.UtcNow);
    }
}

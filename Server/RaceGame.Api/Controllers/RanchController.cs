using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RaceGame.Api.Extensions;
using RaceGame.Application.Common;
using RaceGame.Application.Ranch;

namespace RaceGame.Api.Controllers;

public sealed record AdoptFoalRequest(string? CustomName = null, string? PedigreeTier = "WILD", string? IdempotencyKey = null);
public sealed record FeedRanchHorseRequest(long HorseId, string FeedCode, string? IdempotencyKey = null);
public sealed record TrainRanchHorseRequest(long HorseId, string TrainingType, string? IdempotencyKey = null);
public sealed record CareRanchHorseRequest(long HorseId, string CareType, string? IdempotencyKey = null);
public sealed record EquipItemRequest(long HorseId, long EquipmentItemId, string? IdempotencyKey = null);
public sealed record UnequipItemRequest(long HorseId, string SlotCategory);
public sealed record RepairEquipmentRequest(long EquipmentId, string? IdempotencyKey = null);
public sealed record QualificationTrialRequest(long HorseId, string? IdempotencyKey = null);
public sealed record BuybackHorseRequest(long HorseId, string? IdempotencyKey = null);

/// <summary>
/// 模式三：西部纯血马房养成、繁育与职业巡回赛 API 控制器。
/// </summary>
[ApiController]
[Route("api/ranch")]
public sealed class RanchController(IRanchService ranchService) : ControllerBase
{
    /// <summary>获取马房系统完整配置字典（幼驹档位、饲草料、专项训练、理疗医护及考核规则）。</summary>
    [HttpGet("catalog")]
    public async Task<IActionResult> Catalog(CancellationToken ct)
    {
        var catalog = await ranchService.GetRanchCatalogAsync(ct);
        return Ok(EnvelopeSuccess(catalog));
    }

    [Authorize]
    [HttpGet("my-horses")]
    [HttpGet("horses")]
    public async Task<IActionResult> MyHorses(CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        var list = await ranchService.GetMyHorsesAsync(playerId, ct);
        return Ok(EnvelopeSuccess(new { horses = list }));
    }

    [Authorize]
    [HttpGet("horses/{id:long}")]
    public async Task<IActionResult> HorseDetails(long id, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        var horse = await ranchService.GetHorseDetailsAsync(playerId, id, ct);
        if (horse is null)
        {
            return NotFound(EnvelopeError(30001, "RANCH_HORSE_NOT_FOUND", "赛马不存在或不归属于当前玩家"));
        }

        return Ok(EnvelopeSuccess(horse));
    }

    [Authorize]
    [HttpPost("adopt-foal")]
    [HttpPost("horses/adopt")]
    public async Task<IActionResult> AdoptFoal([FromBody] AdoptFoalRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var horse = await ranchService.AdoptFoalAsync(
                playerId,
                request.CustomName ?? "未命名幼驹",
                request.PedigreeTier ?? "WILD",
                request.IdempotencyKey,
                ct);

            return Ok(EnvelopeSuccess(horse));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("feed")]
    public async Task<IActionResult> Feed([FromBody] FeedRanchHorseRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var result = await ranchService.FeedHorseAsync(playerId, request.HorseId, request.FeedCode, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(result));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("train")]
    public async Task<IActionResult> Train([FromBody] TrainRanchHorseRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var result = await ranchService.TrainHorseAsync(playerId, request.HorseId, request.TrainingType, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(result));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("care")]
    public async Task<IActionResult> Care([FromBody] CareRanchHorseRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var result = await ranchService.CareHorseAsync(playerId, request.HorseId, request.CareType, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(result));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpGet("equipment")]
    [HttpGet("equipment/shop")]
    public async Task<IActionResult> GetEquipment(CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        var (shopCatalog, inventory) = await ranchService.GetEquipmentShopAndInventoryAsync(playerId, ct);
        return Ok(EnvelopeSuccess(new { catalog = shopCatalog, shopCatalog, inventory }));
    }

    [Authorize]
    [HttpPost("equip")]
    [HttpPost("equipment/equip")]
    public async Task<IActionResult> Equip([FromBody] EquipItemRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var eq = await ranchService.BuyAndEquipItemAsync(playerId, request.HorseId, request.EquipmentItemId, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(eq));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("unequip")]
    [HttpPost("equipment/unequip")]
    public async Task<IActionResult> Unequip([FromBody] UnequipItemRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var ok = await ranchService.UnequipItemAsync(playerId, request.HorseId, request.SlotCategory, ct);
            return Ok(EnvelopeSuccess(new { unequipped = ok, success = ok }));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("equipment/repair")]
    [HttpPost("repair-equipment")]
    public async Task<IActionResult> RepairEquipment([FromBody] RepairEquipmentRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var result = await ranchService.RepairEquipmentAsync(playerId, request.EquipmentId, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(result));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("qualification-trial")]
    [HttpPost("trials/run")]
    public async Task<IActionResult> QualificationTrial([FromBody] QualificationTrialRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var trial = await ranchService.RunQualificationTrialAsync(playerId, request.HorseId, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(trial));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    [Authorize]
    [HttpPost("buyback")]
    public async Task<IActionResult> Buyback([FromBody] BuybackHorseRequest request, CancellationToken ct)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(EnvelopeError(10001, "AUTH_UNAUTHORIZED", "会话已过期或未登录"));
        }

        try
        {
            var result = await ranchService.BuybackHorseAsync(playerId, request.HorseId, request.IdempotencyKey, ct);
            return Ok(EnvelopeSuccess(result));
        }
        catch (BusinessRuleException ex)
        {
            return BadRequest(EnvelopeError(ResolveErrorCode(ex.Code), ex.Code, ex.Message));
        }
    }

    private static object EnvelopeSuccess(object data) => new
    {
        code = 0,
        message = "ok",
        data,
        errorCode = "SUCCESS",
        serverTime = DateTime.UtcNow
    };

    private static object EnvelopeError(int code, string errorCode, string message) => new
    {
        code,
        message,
        data = (object?)null,
        errorCode,
        serverTime = DateTime.UtcNow
    };

    private static int ResolveErrorCode(string errCode) => errCode switch
    {
        "WALLET_INSUFFICIENT_BALANCE" => 20001,
        "WALLET_CONCURRENCY_CONFLICT" => 20002,
        "WALLET_INVALID_AMOUNT" => 20003,
        "WALLET_FROZEN_FAILED" => 20003,
        "RANCH_HORSE_NOT_FOUND" => 30001,
        "RANCH_FEED_STOMACH_FULL" => 30002,
        "RANCH_TRAIN_ENERGY_EMPTY" => 30003,
        "RANCH_HORSE_STATE_LOCKED" => 30004,
        "RANCH_EQUIP_SLOT_MISMATCH" => 30005,
        "RANCH_EQUIP_MISSING" => 30005,
        "RANCH_HORSE_STAGE_MISMATCH" => 30005,
        "RANCH_LICENSE_TRIAL_FAILED" => 30006,
        "RANCH_BUYBACK_NOT_OWNER" => 30007,
        "RANCH_HANDWALK_COOLDOWN" => 30008,
        "RANCH_TRIAL_COOLDOWN" => 30010,
        "RANCH_HORSE_RETIRED" => 30011,
        "RANCH_HORSE_UNHEALTHY" => 30012,
        "RANCH_EQUIP_NOT_FOUND" => 30013,
        "RANCH_EQUIP_NOT_BROKEN" => 30014,
        _ => 30000
    };
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Extensions;
using RaceGame.Application.Audit;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 提供角色、装扮和物品的读取，以及玩家展示角色和装扮的切换。
/// 这些接口只影响表现层资产，不参与赔率、赛果和奖励计算。
/// </summary>
[ApiController]
[Route("api/characters")]
public sealed class CharacterController(
    AppDbContext db,
    GameLogService gameLogService) : ControllerBase
{
    /// <summary>返回角色模板、玩家拥有状态、等级经验和当前装备状态。</summary>
    [Authorize]
    [HttpGet]
    public async Task<IActionResult> GetCharacters(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var owned = await db.PlayerCharacters
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .ToDictionaryAsync(x => x.CharacterId, cancellationToken);

        var characters = await db.CharacterCatalogs
            .AsNoTracking()
            .Where(x => x.IsEnabled)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        var levelConfigs = await db.CharacterLevelConfigs
            .AsNoTracking()
            .Where(x => characters.Select(c => c.Id).Contains(x.CharacterId))
            .OrderBy(x => x.Level)
            .ToListAsync(cancellationToken);

        var result = characters.Select(character =>
        {
            owned.TryGetValue(character.Id, out var playerCharacter);
            var levels = levelConfigs
                .Where(x => x.CharacterId == character.Id)
                .Select(x => new
                {
                    x.Level,
                    x.RequiredExp,
                    x.RewardType,
                    x.RewardPayload
                })
                .ToList();

            return new
            {
                characterId = character.Id,
                characterCode = character.CharacterCode,
                nameZh = character.NameZh,
                nameEn = character.NameEn,
                descriptionZh = character.DescriptionZh,
                descriptionEn = character.DescriptionEn,
                avatarAsset = character.AvatarAsset,
                portraitAsset = character.PortraitAsset,
                metadata = character.MetadataJson,
                isDefault = character.IsDefault,
                isOwned = playerCharacter is not null,
                isEquipped = playerCharacter?.IsEquipped ?? false,
                level = playerCharacter?.Level ?? 0,
                exp = playerCharacter?.Exp ?? 0,
                levels,
            };
        });

        return Ok(new { code = 0, data = result });
    }

    /// <summary>设置当前玩家的展示角色；未拥有角色不能装备。</summary>
    [Authorize]
    [HttpPut("/api/player/character")]
    public async Task<IActionResult> EquipCharacter(
        EquipCharacterRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        if (request.CharacterId <= 0)
        {
            return BadRequest(new { code = "INVALID_CHARACTER_ID", message = "角色参数无效" });
        }

        var character = await db.CharacterCatalogs
            .FirstOrDefaultAsync(x => x.Id == request.CharacterId && x.IsEnabled, cancellationToken);

        if (character is null)
        {
            return NotFound(new { code = "CHARACTER_NOT_FOUND", message = "角色不存在或未开放" });
        }

        var playerCharacter = await db.PlayerCharacters
            .FirstOrDefaultAsync(
                x => x.PlayerId == playerId && x.CharacterId == request.CharacterId,
                cancellationToken);

        if (playerCharacter is null)
        {
            return Conflict(new { code = "CHARACTER_NOT_OWNED", message = "尚未拥有该角色" });
        }

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var current = await db.PlayerCharacters
            .Where(x => x.PlayerId == playerId && x.IsEquipped)
            .ToListAsync(cancellationToken);

        var now = DateTime.UtcNow;
        if (current.Count > 0)
        {
            await db.PlayerCharacters
                .Where(x => x.PlayerId == playerId && x.IsEquipped)
                .ExecuteUpdateAsync(setters => setters
                    .SetProperty(x => x.IsEquipped, false)
                    .SetProperty(x => x.EquippedAt, (DateTime?)null)
                    .SetProperty(x => x.UpdatedAt, now),
                    cancellationToken);

            foreach (var item in current)
            {
                item.IsEquipped = false;
                item.EquippedAt = null;
                item.UpdatedAt = now;
            }
        }

        playerCharacter.IsEquipped = true;
        playerCharacter.EquippedAt = now;
        playerCharacter.UpdatedAt = now;

        gameLogService.AddCharacterLog(
            playerId,
            character.Id,
            playerCharacter.Id,
            "CHARACTER_EQUIPPED",
            "SUCCESS",
            new
            {
                previousCharacterIds = current.Select(x => x.CharacterId).ToArray(),
                characterId = character.Id,
            });

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                characterId = character.Id,
                message = "角色已装备",
            },
        });
    }

    /// <summary>返回当前玩家拥有的装扮和物品，供简单 UI 展示。</summary>
    [Authorize]
    [HttpGet("/api/player/assets")]
    public async Task<IActionResult> Assets(CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        var cosmetics = await db.PlayerCosmetics
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .Join(
                db.CosmeticCatalogs.AsNoTracking(),
                owned => owned.CosmeticId,
                catalog => catalog.Id,
                (owned, catalog) => new
                {
                    owned.Id,
                    cosmeticId = catalog.Id,
                    catalog.CosmeticCode,
                    catalog.NameZh,
                    catalog.NameEn,
                    catalog.SlotType,
                    catalog.IconAsset,
                    catalog.PreviewAsset,
                    owned.IsEquipped,
                    owned.ObtainedAt,
                })
            .OrderBy(x => x.SlotType)
            .ThenBy(x => x.NameZh)
            .ToListAsync(cancellationToken);

        var items = await db.PlayerItems
            .AsNoTracking()
            .Where(x => x.PlayerId == playerId)
            .Join(
                db.ItemCatalogs.AsNoTracking(),
                owned => owned.ItemId,
                catalog => catalog.Id,
                (owned, catalog) => new
                {
                    owned.Id,
                    itemId = catalog.Id,
                    catalog.ItemCode,
                    catalog.NameZh,
                    catalog.NameEn,
                    catalog.ItemType,
                    catalog.IconAsset,
                    owned.Quantity,
                })
            .OrderBy(x => x.NameZh)
            .ToListAsync(cancellationToken);

        return Ok(new { code = 0, data = new { cosmetics, items } });
    }
}

/// <summary>玩家切换展示角色请求。</summary>
public sealed record EquipCharacterRequest(long CharacterId);

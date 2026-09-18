using System.Security.Claims;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 后台数据管理 Web API。
/// 当前先提供角色、任务、商城和玩家比赛记录的结构化管理接口，前端后台页面可逐步替换为正式组件。
/// </summary>
[ApiController]
[Authorize]
[Route("admin/api")]
public sealed class ManagementApiController(AppDbContext db) : ControllerBase
{
    /// <summary>查询角色模板及等级经验配置。</summary>
    [HttpGet("characters")]
    public async Task<IActionResult> Characters(CancellationToken cancellationToken)
    {
        var characters = await db.CharacterCatalogs
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new
            {
                x.Id,
                x.CharacterCode,
                x.NameZh,
                x.NameEn,
                x.DescriptionZh,
                x.DescriptionEn,
                x.AvatarAsset,
                x.PortraitAsset,
                x.MetadataJson,
                x.SortOrder,
                x.IsEnabled,
                x.IsDefault,
            })
            .ToListAsync(cancellationToken);

        var levels = await db.CharacterLevelConfigs
            .AsNoTracking()
            .OrderBy(x => x.CharacterId)
            .ThenBy(x => x.Level)
            .Select(x => new
            {
                x.Id,
                x.CharacterId,
                x.Level,
                x.RequiredExp,
                x.RewardType,
                x.RewardPayload,
            })
            .ToListAsync(cancellationToken);

        return Ok(new { code = 0, data = new { characters, levels } });
    }

    /// <summary>新增角色模板并写入后台审计记录。</summary>
    [HttpPost("characters")]
    public async Task<IActionResult> CreateCharacter(
        CharacterManagementRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.CharacterCode)
            || string.IsNullOrWhiteSpace(request.NameZh))
        {
            return BadRequest(new
            {
                code = "CHARACTER_REQUIRED",
                message = "角色编码和中文名称不能为空",
            });
        }

        var code = request.CharacterCode.Trim();
        var exists = await db.CharacterCatalogs.AnyAsync(
            x => x.CharacterCode == code,
            cancellationToken);

        if (exists)
        {
            return Conflict(new
            {
                code = "CHARACTER_CODE_EXISTS",
                message = "角色编码已存在",
            });
        }

        var adminId = GetAdminId();
        var now = DateTime.UtcNow;
        var character = new CharacterCatalog
        {
            CharacterCode = code,
            NameZh = request.NameZh.Trim(),
            NameEn = request.NameEn?.Trim(),
            DescriptionZh = request.DescriptionZh,
            DescriptionEn = request.DescriptionEn,
            AvatarAsset = request.AvatarAsset,
            PortraitAsset = request.PortraitAsset,
            MetadataJson = request.MetadataJson,
            SortOrder = request.SortOrder,
            IsEnabled = request.IsEnabled,
            IsDefault = request.IsDefault,
            CreatedByAdminUserId = adminId,
            UpdatedByAdminUserId = adminId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.CharacterCatalogs.Add(character);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "CREATE",
            "CHARACTER",
            character.Id.ToString(),
            new { character.CharacterCode, character.NameZh },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { character.Id } });
    }

    /// <summary>编辑角色模板；不会修改历史比赛快照。</summary>
    [HttpPut("characters/{id:long}")]
    public async Task<IActionResult> UpdateCharacter(
        long id,
        CharacterManagementRequest request,
        CancellationToken cancellationToken)
    {
        var character = await db.CharacterCatalogs
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (character is null)
        {
            return NotFound(new { code = "CHARACTER_NOT_FOUND", message = "角色不存在" });
        }

        if (string.IsNullOrWhiteSpace(request.NameZh))
        {
            return BadRequest(new { code = "CHARACTER_NAME_REQUIRED", message = "中文名称不能为空" });
        }

        character.NameZh = request.NameZh.Trim();
        character.NameEn = request.NameEn?.Trim();
        character.DescriptionZh = request.DescriptionZh;
        character.DescriptionEn = request.DescriptionEn;
        character.AvatarAsset = request.AvatarAsset;
        character.PortraitAsset = request.PortraitAsset;
        character.MetadataJson = request.MetadataJson;
        character.SortOrder = request.SortOrder;
        character.IsEnabled = request.IsEnabled;
        character.IsDefault = request.IsDefault;
        character.UpdatedByAdminUserId = GetAdminId();
        character.UpdatedAt = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "UPDATE",
            "CHARACTER",
            id.ToString(),
            new { character.CharacterCode, character.NameZh },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { character.Id } });
    }

    /// <summary>新增或覆盖指定角色的等级经验和奖励配置。</summary>
    [HttpPut("characters/{characterId:long}/levels/{level:int}")]
    public async Task<IActionResult> UpsertCharacterLevel(
        long characterId,
        int level,
        CharacterLevelManagementRequest request,
        CancellationToken cancellationToken)
    {
        if (level < 1 || request.RequiredExp < 0)
        {
            return BadRequest(new
            {
                code = "INVALID_CHARACTER_LEVEL",
                message = "等级或经验配置无效",
            });
        }

        var characterExists = await db.CharacterCatalogs
            .AnyAsync(x => x.Id == characterId, cancellationToken);

        if (!characterExists)
        {
            return NotFound(new
            {
                code = "CHARACTER_NOT_FOUND",
                message = "角色不存在",
            });
        }

        var config = await db.CharacterLevelConfigs
            .FirstOrDefaultAsync(
                x => x.CharacterId == characterId && x.Level == level,
                cancellationToken);

        if (config is null)
        {
            config = new CharacterLevelConfig
            {
                CharacterId = characterId,
                Level = level,
            };
            db.CharacterLevelConfigs.Add(config);
        }

        config.RequiredExp = request.RequiredExp;
        config.RewardType = request.RewardType;
        config.RewardPayload = request.RewardPayload;
        config.UpdatedByAdminUserId = GetAdminId();
        config.UpdatedAt = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "UPSERT",
            "CHARACTER_LEVEL",
            $"{characterId}:{level}",
            new
            {
                characterId,
                level,
                request.RequiredExp,
                request.RewardType,
            },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { config.Id } });
    }

    /// <summary>查询单个玩家的比赛与下注记录，供客服/运营追溯。</summary>
    [HttpGet("players/{id:long}/races")]
    public async Task<IActionResult> PlayerRaces(
        long id,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.BetOrders
            .AsNoTracking()
            .Where(x => x.PlayerId == id)
            .OrderByDescending(x => x.Id);

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Join(
                db.RaceRounds.AsNoTracking(),
                order => order.RoundId,
                round => round.Id,
                (order, round) => new
                {
                    order.OrderNo,
                    order.RoundId,
                    round.RoundNo,
                    state = (int)round.State,
                    order.PlayType,
                    order.HorseNo,
                    order.SecondHorseNo,
                    order.Combination,
                    order.BetAmount,
                    order.LockedOdds,
                    order.NetReward,
                    order.Status,
                    order.CreatedAt,
                    order.SettledAt,
                })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new { page, pageSize, total, items },
        });
    }

    /// <summary>查询后台任务定义与奖励配置。</summary>
    [HttpGet("tasks")]
    public async Task<IActionResult> Tasks(CancellationToken cancellationToken)
    {
        var items = await db.DailyTaskDefinitions
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return Ok(new { code = 0, data = items });
    }

    /// <summary>查询后台商城商品配置；现金商品仍只返回配置，不开放客户端购买。</summary>
    [HttpGet("shop/products")]
    public async Task<IActionResult> ShopProducts(CancellationToken cancellationToken)
    {
        var items = await db.ShopProducts
            .AsNoTracking()
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .ToListAsync(cancellationToken);

        return Ok(new { code = 0, data = items });
    }


    /// <summary>
    /// 创建每日任务配置，并写入后台审计。
    /// 任务只描述条件与奖励，玩家进度由 Worker/Application 根据配置生成。
    /// </summary>
    [HttpPost("tasks")]
    public async Task<IActionResult> CreateTask(
        DailyTaskManagementRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.TaskCode)
            || string.IsNullOrWhiteSpace(request.TaskType)
            || request.TargetValue <= 0
            || string.IsNullOrWhiteSpace(request.RewardType))
        {
            return BadRequest(new
            {
                code = "TASK_REQUIRED",
                message = "任务编码、类型、目标值和奖励类型不能为空",
            });
        }

        var taskCode = request.TaskCode.Trim();
        if (await db.DailyTaskDefinitions.AnyAsync(
            x => x.TaskCode == taskCode,
            cancellationToken))
        {
            return Conflict(new
            {
                code = "TASK_CODE_EXISTS",
                message = "任务编码已存在",
            });
        }

        var adminId = GetAdminId();
        var now = DateTime.UtcNow;
        var entity = new DailyTaskDefinition
        {
            TaskCode = taskCode,
            TaskType = request.TaskType.Trim(),
            TitleZh = request.TitleZh.Trim(),
            TitleEn = request.TitleEn?.Trim(),
            DescriptionZh = request.DescriptionZh,
            DescriptionEn = request.DescriptionEn,
            TargetValue = request.TargetValue,
            ConditionPayloadJson = request.ConditionPayloadJson,
            RewardType = request.RewardType.Trim(),
            RewardPayload = request.RewardPayload,
            Version = Math.Max(1, request.Version),
            IsEnabled = request.IsEnabled,
            SortOrder = request.SortOrder,
            EffectiveStartAt = request.EffectiveStartAt?.ToUniversalTime(),
            EffectiveEndAt = request.EffectiveEndAt?.ToUniversalTime(),
            CreatedByAdminUserId = adminId,
            UpdatedByAdminUserId = adminId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.DailyTaskDefinitions.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "CREATE",
            "DAILY_TASK",
            entity.Id.ToString(),
            new { entity.TaskCode, entity.TaskType, entity.TargetValue },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { entity.Id } });
    }

    /// <summary>更新每日任务条件、奖励和生效窗口；历史玩家进度不会被回写。</summary>
    [HttpPut("tasks/{id:long}")]
    public async Task<IActionResult> UpdateTask(
        long id,
        DailyTaskManagementRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await db.DailyTaskDefinitions
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new { code = "TASK_NOT_FOUND", message = "任务不存在" });
        }

        if (string.IsNullOrWhiteSpace(request.TitleZh)
            || request.TargetValue <= 0
            || string.IsNullOrWhiteSpace(request.RewardType))
        {
            return BadRequest(new
            {
                code = "TASK_INVALID",
                message = "任务名称、目标值和奖励类型无效",
            });
        }

        entity.TitleZh = request.TitleZh.Trim();
        entity.TitleEn = request.TitleEn?.Trim();
        entity.DescriptionZh = request.DescriptionZh;
        entity.DescriptionEn = request.DescriptionEn;
        entity.TargetValue = request.TargetValue;
        entity.ConditionPayloadJson = request.ConditionPayloadJson;
        entity.RewardType = request.RewardType.Trim();
        entity.RewardPayload = request.RewardPayload;
        entity.Version = Math.Max(entity.Version + 1, request.Version);
        entity.IsEnabled = request.IsEnabled;
        entity.SortOrder = request.SortOrder;
        entity.EffectiveStartAt = request.EffectiveStartAt?.ToUniversalTime();
        entity.EffectiveEndAt = request.EffectiveEndAt?.ToUniversalTime();
        entity.UpdatedByAdminUserId = GetAdminId();
        entity.UpdatedAt = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "UPDATE",
            "DAILY_TASK",
            id.ToString(),
            new { entity.TaskCode, entity.Version },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { entity.Id, entity.Version } });
    }

    /// <summary>创建商城商品配置；现金商品可以配置但不会自动开放到玩家购买流程。</summary>
    [HttpPost("shop/products")]
    public async Task<IActionResult> CreateShopProduct(
        ShopProductManagementRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.ProductCode)
            || string.IsNullOrWhiteSpace(request.TitleZh)
            || request.PriceAmount < 0
            || string.IsNullOrWhiteSpace(request.ProductType)
            || string.IsNullOrWhiteSpace(request.CurrencyType))
        {
            return BadRequest(new
            {
                code = "SHOP_PRODUCT_INVALID",
                message = "商品编码、名称、类型、币种和价格不能为空",
            });
        }

        var productCode = request.ProductCode.Trim();
        if (await db.ShopProducts.AnyAsync(
            x => x.ProductCode == productCode,
            cancellationToken))
        {
            return Conflict(new
            {
                code = "SHOP_PRODUCT_CODE_EXISTS",
                message = "商品编码已存在",
            });
        }

        var adminId = GetAdminId();
        var now = DateTime.UtcNow;
        var entity = new ShopProduct
        {
            ProductCode = productCode,
            ProductType = request.ProductType.Trim(),
            CurrencyType = request.CurrencyType.Trim(),
            TitleZh = request.TitleZh.Trim(),
            TitleEn = request.TitleEn?.Trim(),
            DescriptionZh = request.DescriptionZh,
            DescriptionEn = request.DescriptionEn,
            PriceAmount = request.PriceAmount,
            CashSkuCode = request.CashSkuCode,
            PurchaseLimitDaily = request.PurchaseLimitDaily,
            PurchaseLimitLifetime = request.PurchaseLimitLifetime,
            CharacterId = request.CharacterId,
            CosmeticId = request.CosmeticId,
            ItemId = request.ItemId,
            RewardPayload = request.RewardPayload,
            MetadataJson = request.MetadataJson,
            CoverAsset = request.CoverAsset,
            SortOrder = request.SortOrder,
            IsEnabled = request.IsEnabled,
            IsVisible = request.IsVisible,
            EffectiveStartAt = request.EffectiveStartAt?.ToUniversalTime(),
            EffectiveEndAt = request.EffectiveEndAt?.ToUniversalTime(),
            Version = Math.Max(1, request.Version),
            CreatedByAdminUserId = adminId,
            UpdatedByAdminUserId = adminId,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.ShopProducts.Add(entity);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "CREATE",
            "SHOP_PRODUCT",
            entity.Id.ToString(),
            new { entity.ProductCode, entity.ProductType, entity.PriceAmount },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { entity.Id } });
    }

    /// <summary>更新商城商品展示、价格、生效窗口和履约配置。</summary>
    [HttpPut("shop/products/{id:long}")]
    public async Task<IActionResult> UpdateShopProduct(
        long id,
        ShopProductManagementRequest request,
        CancellationToken cancellationToken)
    {
        var entity = await db.ShopProducts
            .FirstOrDefaultAsync(x => x.Id == id, cancellationToken);

        if (entity is null)
        {
            return NotFound(new
            {
                code = "SHOP_PRODUCT_NOT_FOUND",
                message = "商城商品不存在",
            });
        }

        if (string.IsNullOrWhiteSpace(request.TitleZh)
            || request.PriceAmount < 0)
        {
            return BadRequest(new
            {
                code = "SHOP_PRODUCT_INVALID",
                message = "商品名称或价格无效",
            });
        }

        entity.ProductType = request.ProductType.Trim();
        entity.CurrencyType = request.CurrencyType.Trim();
        entity.TitleZh = request.TitleZh.Trim();
        entity.TitleEn = request.TitleEn?.Trim();
        entity.DescriptionZh = request.DescriptionZh;
        entity.DescriptionEn = request.DescriptionEn;
        entity.PriceAmount = request.PriceAmount;
        entity.CashSkuCode = request.CashSkuCode;
        entity.PurchaseLimitDaily = request.PurchaseLimitDaily;
        entity.PurchaseLimitLifetime = request.PurchaseLimitLifetime;
        entity.CharacterId = request.CharacterId;
        entity.CosmeticId = request.CosmeticId;
        entity.ItemId = request.ItemId;
        entity.RewardPayload = request.RewardPayload;
        entity.MetadataJson = request.MetadataJson;
        entity.CoverAsset = request.CoverAsset;
        entity.SortOrder = request.SortOrder;
        entity.IsEnabled = request.IsEnabled;
        entity.IsVisible = request.IsVisible;
        entity.EffectiveStartAt = request.EffectiveStartAt?.ToUniversalTime();
        entity.EffectiveEndAt = request.EffectiveEndAt?.ToUniversalTime();
        entity.Version = Math.Max(entity.Version + 1, request.Version);
        entity.UpdatedByAdminUserId = GetAdminId();
        entity.UpdatedAt = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);
        await AddAuditAsync(
            "UPDATE",
            "SHOP_PRODUCT",
            id.ToString(),
            new { entity.ProductCode, entity.Version },
            cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { entity.Id, entity.Version } });
    }

    /// <summary>查询马匹列表，支持分页、关键字搜索和上下架过滤。</summary>
    [HttpGet("horses")]
    public async Task<IActionResult> Horses(
        [FromQuery] string? q = null,
        [FromQuery] bool? isEnabled = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.HorseCatalogs.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var search = q.Trim();
            query = query.Where(x => x.HorseCode.Contains(search) || x.NameZh.Contains(search) || (x.NameEn != null && x.NameEn.Contains(search)));
        }

        if (isEnabled.HasValue)
        {
            query = query.Where(x => x.IsEnabled == isEnabled.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await query
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(x => new
            {
                x.Id,
                x.HorseCode,
                x.NameZh,
                x.NameEn,
                x.DescriptionZh,
                x.DescriptionEn,
                x.AvatarAsset,
                x.PortraitAsset,
                x.SortOrder,
                x.IsEnabled,
                x.TotalRaces,
                x.WinCount,
                x.WinRate,
                x.Rank1Probability,
                x.Rank2Probability,
                x.Rank3Probability,
                x.Rank4Probability,
                x.Rank5Probability,
                x.Rank6Probability,
                x.CreatedAt,
                x.UpdatedAt,
            })
            .ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new { page, pageSize, total, items },
        });
    }

    /// <summary>新增或导入马匹主数据，并写入后台审计记录。</summary>
    [HttpPost("horses")]
    public async Task<IActionResult> CreateHorse(
        HorseManagementRequest request,
        CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.HorseCode) || string.IsNullOrWhiteSpace(request.NameZh))
        {
            return BadRequest(new
            {
                code = "HORSE_REQUIRED",
                message = "马匹编码和中文名称不能为空",
            });
        }

        var code = request.HorseCode.Trim();
        var exists = await db.HorseCatalogs.AnyAsync(x => x.HorseCode == code, cancellationToken);
        if (exists)
        {
            return Conflict(new
            {
                code = "HORSE_CODE_EXISTS",
                message = "马匹编码已存在",
            });
        }

        var now = DateTime.UtcNow;
        var horse = new HorseCatalog
        {
            HorseCode = code,
            NameZh = request.NameZh.Trim(),
            NameEn = request.NameEn?.Trim(),
            DescriptionZh = request.DescriptionZh,
            DescriptionEn = request.DescriptionEn,
            AvatarAsset = request.AvatarAsset,
            PortraitAsset = request.PortraitAsset,
            MetadataJson = request.MetadataJson,
            SortOrder = request.SortOrder,
            IsEnabled = request.IsEnabled,
            TotalRaces = request.TotalRaces,
            WinCount = request.WinCount,
            WinRate = request.TotalRaces > 0 ? (decimal)request.WinCount / request.TotalRaces : 0m,
            Rank1Probability = request.Rank1Probability,
            Rank2Probability = request.Rank2Probability,
            Rank3Probability = request.Rank3Probability,
            Rank4Probability = request.Rank4Probability,
            Rank5Probability = request.Rank5Probability,
            Rank6Probability = request.Rank6Probability,
            Rank1Count = request.Rank1Count,
            Rank2Count = request.Rank2Count,
            Rank3Count = request.Rank3Count,
            Rank4Count = request.Rank4Count,
            Rank5Count = request.Rank5Count,
            Rank6Count = request.Rank6Count,
            CreatedAt = now,
            UpdatedAt = now,
        };

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        db.HorseCatalogs.Add(horse);
        await db.SaveChangesAsync(cancellationToken);

        await AddAuditAsync(
            "CREATE",
            "HORSE",
            horse.Id.ToString(),
            new { horse.HorseCode, horse.NameZh },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { horse.Id } });
    }

    /// <summary>编辑马匹主数据展示与启停状态，并写入后台审计记录。</summary>
    [HttpPut("horses/{id:long}")]
    public async Task<IActionResult> UpdateHorse(
        long id,
        HorseManagementRequest request,
        CancellationToken cancellationToken)
    {
        var horse = await db.HorseCatalogs.FindAsync([id], cancellationToken);
        if (horse is null)
        {
            return NotFound(new
            {
                code = "HORSE_NOT_FOUND",
                message = "马匹不存在",
            });
        }

        if (string.IsNullOrWhiteSpace(request.NameZh))
        {
            return BadRequest(new
            {
                code = "HORSE_REQUIRED",
                message = "马匹中文名称不能为空",
            });
        }

        horse.NameZh = request.NameZh.Trim();
        horse.NameEn = request.NameEn?.Trim();
        horse.DescriptionZh = request.DescriptionZh;
        horse.DescriptionEn = request.DescriptionEn;
        horse.AvatarAsset = request.AvatarAsset;
        horse.PortraitAsset = request.PortraitAsset;
        horse.MetadataJson = request.MetadataJson;
        horse.SortOrder = request.SortOrder;
        horse.IsEnabled = request.IsEnabled;
        horse.UpdatedAt = DateTime.UtcNow;

        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        await db.SaveChangesAsync(cancellationToken);

        await AddAuditAsync(
            "UPDATE",
            "HORSE",
            id.ToString(),
            new { horse.HorseCode, horse.IsEnabled },
            cancellationToken);

        await transaction.CommitAsync(cancellationToken);

        return Ok(new { code = 0, data = new { horse.Id } });
    }

    /// <summary>查询玩家账号列表，支持账号/昵称搜索与分页。</summary>
    [HttpGet("players")]
    public async Task<IActionResult> Players(
        [FromQuery] string? q = null,
        [FromQuery] bool? isActive = null,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50,
        CancellationToken cancellationToken = default)
    {
        page = Math.Max(1, page);
        pageSize = Math.Clamp(pageSize, 1, 100);

        var query = db.Players.AsNoTracking().AsQueryable();

        if (!string.IsNullOrWhiteSpace(q))
        {
            var search = q.Trim();
            query = query.Where(x => x.AccountId.Contains(search) || x.Nickname.Contains(search));
        }

        if (isActive.HasValue)
        {
            query = query.Where(x => x.IsActive == isActive.Value);
        }

        var total = await query.CountAsync(cancellationToken);
        var items = await (
            from player in query.OrderByDescending(x => x.Id).Skip((page - 1) * pageSize).Take(pageSize)
            join wallet in db.Wallets.AsNoTracking() on player.Id equals wallet.PlayerId into walletGroup
            from w in walletGroup.DefaultIfEmpty()
            join stats in db.PlayerStats.AsNoTracking() on player.Id equals stats.PlayerId into statsGroup
            from s in statsGroup.DefaultIfEmpty()
            select new
            {
                player.Id,
                player.AccountId,
                player.Nickname,
                player.AvatarAsset,
                player.Level,
                player.Exp,
                player.IsActive,
                player.CreatedAt,
                player.UpdatedAt,
                balance = w != null ? w.Balance : 0m,
                totalRounds = s != null ? s.TotalRoundsParticipated : 0,
                totalWins = s != null ? s.TotalRoundsWon : 0,
                winRate = s != null ? s.WinRate : 0m,
            }
        ).ToListAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new { page, pageSize, total, items },
        });
    }

    /// <summary>读取当前后台用户 ID；管理员登录时由 Cookie Claim 提供。</summary>
    private long? GetAdminId()
    {
        var value = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return long.TryParse(value, out var id) ? id : null;
    }

    /// <summary>写入后台操作审计，不保存密码、令牌等敏感信息。</summary>
    private async Task AddAuditAsync(
        string action,
        string resource,
        string resourceId,
        object metadata,
        CancellationToken cancellationToken)
    {
        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminUserId = GetAdminId(),
            ActionType = action,
            ResourceType = resource,
            ResourceId = resourceId,
            RequestId = HttpContext.TraceIdentifier,
            MetadataJson = JsonSerializer.Serialize(metadata),
            CreatedAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(cancellationToken);
    }
}

/// <summary>后台每日任务创建/编辑请求。</summary>
public sealed record DailyTaskManagementRequest(
    string TaskCode,
    string TaskType,
    string TitleZh,
    string? TitleEn,
    string? DescriptionZh,
    string? DescriptionEn,
    int TargetValue,
    string? ConditionPayloadJson,
    string RewardType,
    string? RewardPayload,
    int Version,
    bool IsEnabled,
    int SortOrder,
    DateTime? EffectiveStartAt,
    DateTime? EffectiveEndAt);

/// <summary>后台商城商品创建/编辑请求。</summary>
public sealed record ShopProductManagementRequest(
    string ProductCode,
    string ProductType,
    string CurrencyType,
    string TitleZh,
    string? TitleEn,
    string? DescriptionZh,
    string? DescriptionEn,
    decimal PriceAmount,
    string? CashSkuCode,
    int? PurchaseLimitDaily,
    int? PurchaseLimitLifetime,
    long? CharacterId,
    long? CosmeticId,
    long? ItemId,
    string? RewardPayload,
    string? MetadataJson,
    string? CoverAsset,
    int SortOrder,
    bool IsEnabled,
    bool IsVisible,
    int Version,
    DateTime? EffectiveStartAt,
    DateTime? EffectiveEndAt);

/// <summary>后台角色等级经验和升级奖励配置请求。</summary>
public sealed record CharacterLevelManagementRequest(
    long RequiredExp,
    string? RewardType,
    string? RewardPayload);

/// <summary>后台创建或编辑角色模板请求。</summary>
public sealed record CharacterManagementRequest(
    string CharacterCode,
    string NameZh,
    string? NameEn,
    string? DescriptionZh,
    string? DescriptionEn,
    string? AvatarAsset,
    string? PortraitAsset,
    string? MetadataJson,
    int SortOrder,
    bool IsEnabled,
    bool IsDefault);

/// <summary>后台创建或编辑马匹主数据请求。</summary>
public sealed record HorseManagementRequest(
    string HorseCode,
    string NameZh,
    string? NameEn,
    string? DescriptionZh,
    string? DescriptionEn,
    string? AvatarAsset,
    string? PortraitAsset,
    string? MetadataJson,
    int SortOrder,
    bool IsEnabled,
    int TotalRaces = 0,
    int WinCount = 0,
    decimal Rank1Probability = 0m,
    decimal Rank2Probability = 0m,
    decimal Rank3Probability = 0m,
    decimal Rank4Probability = 0m,
    decimal Rank5Probability = 0m,
    decimal Rank6Probability = 0m,
    int Rank1Count = 0,
    int Rank2Count = 0,
    int Rank3Count = 0,
    int Rank4Count = 0,
    int Rank5Count = 0,
    int Rank6Count = 0);

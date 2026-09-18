using System.Data;
using System.Security.Cryptography;
using System.Text;
using Microsoft.EntityFrameworkCore;
using RaceGame.Application.Audit;
using RaceGame.Application.Common;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Shop;

/// <summary>商城金币购买请求。幂等键必须由客户端为一次用户操作生成并在重试时保持不变。</summary>
public sealed record PurchaseShopProductRequest(long ProductId, int Quantity, string IdempotencyKey);

/// <summary>客户端可见的商城商品 DTO，不直接暴露 EF 实体和后台审计字段。</summary>
public sealed record ShopProductDto(
    long Id,
    string ProductCode,
    string ProductType,
    string CurrencyType,
    string TitleZh,
    string? TitleEn,
    string? DescriptionZh,
    string? DescriptionEn,
    decimal PriceAmount,
    string? CoverAsset,
    int? PurchaseLimitDaily,
    int? PurchaseLimitLifetime);

/// <summary>商城下单成功或幂等重放时返回的稳定结果。</summary>
public sealed record ShopOrderResponse(
    string OrderNo,
    long ProductId,
    int Quantity,
    decimal TotalPriceAmount,
    string Status,
    decimal Balance,
    DateTime ServerTime);

/// <summary>
/// 编排商城商品读取、金币扣款、订单持久化和角色/装扮/物品履约。
/// 所有资产变化与订单状态在同一数据库事务中完成，避免出现扣款成功但未发货。
/// </summary>
public sealed class ShopService(IGameDbContext db, GameLogService gameLogService)
{
    /// <summary>返回当前 UTC 时间点已启用、可见且处于生效窗口内的商品。</summary>
    public async Task<IReadOnlyList<ShopProductDto>> GetAvailableProductsAsync(
        DateTime utcNow,
        CancellationToken cancellationToken = default)
    {
        return await db.ShopProducts
            .AsNoTracking()
            .Where(x => x.IsEnabled && x.IsVisible)
            .Where(x => x.EffectiveStartAt == null || x.EffectiveStartAt <= utcNow)
            .Where(x => x.EffectiveEndAt == null || x.EffectiveEndAt > utcNow)
            .OrderBy(x => x.SortOrder)
            .ThenBy(x => x.Id)
            .Select(x => new ShopProductDto(
                x.Id,
                x.ProductCode,
                x.ProductType,
                x.CurrencyType,
                x.TitleZh,
                x.TitleEn,
                x.DescriptionZh,
                x.DescriptionEn,
                x.PriceAmount,
                x.CoverAsset,
                x.PurchaseLimitDaily,
                x.PurchaseLimitLifetime))
            .ToListAsync(cancellationToken);
    }

    /// <summary>
    /// 创建金币商城订单并完成扣款与履约。
    /// 当前产品要求只开放金币购买；现金商品保留数据结构但会被服务端拒绝。
    /// </summary>
    public async Task<ShopOrderResponse> PurchaseAsync(
        long playerId,
        PurchaseShopProductRequest request,
        CancellationToken cancellationToken = default)
    {
        ValidateRequest(request);
        var requestHash = ComputeRequestHash(request);
        await using var transaction = await db.Database.BeginTransactionAsync(IsolationLevel.ReadCommitted, cancellationToken);

        var existingOrder = await db.ShopOrders
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, cancellationToken);

        if (existingOrder is not null)
        {
            if (existingOrder.PlayerId != playerId)
            {
                throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
            }

            if (!string.Equals(existingOrder.RequestHash, requestHash, StringComparison.Ordinal))
            {
                throw new BusinessRuleException("IDEMPOTENCY_REQUEST_MISMATCH", "幂等键已被不同购买参数复用");
            }

            var existingWallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
                ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");
            var existingBalance = existingWallet.Balance;

            return MapResponse(existingOrder, existingBalance);
        }

        var utcNow = DateTime.UtcNow;
        var product = await db.ShopProducts.FirstOrDefaultAsync(x => x.Id == request.ProductId, cancellationToken)
            ?? throw new BusinessRuleException("SHOP_PRODUCT_NOT_FOUND", "商品不存在");

        EnsureProductCanBePurchased(product, request.Quantity, utcNow);
        await EnsureUniqueAssetNotOwnedAsync(playerId, product, request.Quantity, cancellationToken);
        await EnsurePurchaseLimitsAsync(playerId, product, request.Quantity, utcNow, cancellationToken);

        var wallet = await WalletConcurrency.LockAsync(db, playerId, cancellationToken)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");
        var totalPrice = MoneyMath.Round(product.PriceAmount * request.Quantity);

        if (wallet.Balance < totalPrice)
        {
            throw new BusinessRuleException("INSUFFICIENT_BALANCE", "余额不足");
        }

        var orderNo = CreateOrderNumber();
        var balanceBefore = wallet.Balance;
        wallet.Balance = MoneyMath.Round(wallet.Balance - totalPrice);
        wallet.Version++;
        wallet.UpdatedAt = utcNow;

        var paymentTransaction = new WalletTransaction
        {
            PlayerId = playerId,
            TransactionType = GameBusinessCodes.ShopPurchaseTransaction,
            Amount = -totalPrice,
            BalanceBefore = balanceBefore,
            BalanceAfter = wallet.Balance,
            ReferenceType = GameBusinessCodes.ShopOrderReference,
            ReferenceId = orderNo,
            IdempotencyKey = $"wallet:shop:{request.IdempotencyKey}",
        };

        var order = new ShopOrder
        {
            OrderNo = orderNo,
            PlayerId = playerId,
            ProductId = product.Id,
            ProductCodeSnapshot = product.ProductCode,
            ProductTypeSnapshot = product.ProductType,
            CurrencyTypeSnapshot = product.CurrencyType,
            TitleZhSnapshot = product.TitleZh,
            TitleEnSnapshot = product.TitleEn,
            Quantity = request.Quantity,
            UnitPriceAmount = product.PriceAmount,
            TotalPriceAmount = totalPrice,
            Status = GameBusinessCodes.PendingStatus,
            IdempotencyKey = request.IdempotencyKey,
            RequestHash = requestHash,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };

        db.WalletTransactions.Add(paymentTransaction);
        db.ShopOrders.Add(order);
        await db.SaveChangesAsync(cancellationToken);

        order.PaymentTransactionId = paymentTransaction.Id;
        await DeliverProductAsync(playerId, product, order, request.Quantity, utcNow, cancellationToken);
        order.Status = GameBusinessCodes.CompletedStatus;
        order.CompletedAt = utcNow;
        order.UpdatedAt = utcNow;

        if (wallet.Balance == 0m)
        {
            await ReliefScheduler.ScheduleIfNeededAsync(
                db,
                playerId,
                paymentTransaction.Id,
                utcNow,
                cancellationToken);
        }

        try
        {
            await db.SaveChangesAsync(cancellationToken);
            await transaction.CommitAsync(cancellationToken);
            return MapResponse(order, wallet.Balance);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "uq_shop_orders_idempotency_key"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return await HandleIdempotentConflictAsync(playerId, request, requestHash, cancellationToken);
        }
    }

    /// <summary>
    /// 当并发写入触发幂等键唯一约束冲突时，回查已持久化的商城订单并幂等重放结果。
    /// </summary>
    private async Task<ShopOrderResponse> HandleIdempotentConflictAsync(
        long playerId,
        PurchaseShopProductRequest request,
        string requestHash,
        CancellationToken cancellationToken)
    {
        var existingOrder = await db.ShopOrders
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.IdempotencyKey == request.IdempotencyKey, cancellationToken)
            ?? throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等订单已被处理，但无法重新读取订单");

        if (existingOrder.PlayerId != playerId)
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_CONFLICT", "幂等键已被其他请求使用");
        }

        if (!string.Equals(existingOrder.RequestHash, requestHash, StringComparison.Ordinal))
        {
            throw new BusinessRuleException("IDEMPOTENCY_REQUEST_MISMATCH", "幂等键已被不同购买参数复用");
        }

        var wallet = await db.Wallets
            .AsNoTracking()
            .FirstOrDefaultAsync(x => x.PlayerId == playerId, cancellationToken)
            ?? throw new BusinessRuleException("WALLET_NOT_FOUND", "玩家钱包不存在");

        return MapResponse(existingOrder, wallet.Balance);
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

    /// <summary>验证请求级约束，避免无效数量和无法建立数据库幂等性的请求进入事务。</summary>
    private static string ComputeRequestHash(PurchaseShopProductRequest request)
    {
        var canonical = $"product={request.ProductId}&quantity={request.Quantity}";
        return Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(canonical))).ToLowerInvariant();
    }

    private static void ValidateRequest(PurchaseShopProductRequest request)
    {
        if (request.ProductId <= 0 || request.Quantity <= 0)
        {
            throw new BusinessRuleException("INVALID_SHOP_REQUEST", "商品和购买数量无效");
        }

        if (string.IsNullOrWhiteSpace(request.IdempotencyKey))
        {
            throw new BusinessRuleException("IDEMPOTENCY_KEY_REQUIRED", "幂等键不能为空");
        }
    }

    /// <summary>校验商品发布状态、生效窗口和当前版本允许的货币类型。</summary>
    private static void EnsureProductCanBePurchased(ShopProduct product, int quantity, DateTime utcNow)
    {
        if (!product.IsEnabled || !product.IsVisible ||
            (product.EffectiveStartAt is not null && product.EffectiveStartAt > utcNow) ||
            (product.EffectiveEndAt is not null && product.EffectiveEndAt <= utcNow))
        {
            throw new BusinessRuleException("SHOP_PRODUCT_UNAVAILABLE", "商品当前不可购买");
        }

        if (!string.Equals(product.CurrencyType, GameBusinessCodes.CoinCurrency, StringComparison.OrdinalIgnoreCase))
        {
            throw new BusinessRuleException("SHOP_CURRENCY_NOT_SUPPORTED", "当前版本仅支持金币商品");
        }

        if (product.PriceAmount < 0m || quantity <= 0)
        {
            throw new BusinessRuleException("INVALID_SHOP_PRICE", "商品价格或数量无效");
        }
    }

    /// <summary>对角色和装扮等非堆叠唯一资产，限制单次购买数量为 1，且已拥有时拒绝重复购买。</summary>
    private async Task EnsureUniqueAssetNotOwnedAsync(
        long playerId,
        ShopProduct product,
        int requestedQuantity,
        CancellationToken cancellationToken)
    {
        if (product.CharacterId is not null || product.CosmeticId is not null)
        {
            if (requestedQuantity != 1)
            {
                throw new BusinessRuleException("INVALID_QUANTITY_FOR_UNIQUE_ITEM", "角色或装扮为唯一资产，每次只能购买 1 件");
            }

            if (product.CharacterId is not null)
            {
                var owned = await db.PlayerCharacters.AnyAsync(
                    x => x.PlayerId == playerId && x.CharacterId == product.CharacterId.Value,
                    cancellationToken);
                if (owned)
                {
                    throw new BusinessRuleException("ALREADY_OWNED", "您已拥有该角色，无需重复购买");
                }
            }

            if (product.CosmeticId is not null)
            {
                var owned = await db.PlayerCosmetics.AnyAsync(
                    x => x.PlayerId == playerId && x.CosmeticId == product.CosmeticId.Value,
                    cancellationToken);
                if (owned)
                {
                    throw new BusinessRuleException("ALREADY_OWNED", "您已拥有该装扮，无需重复购买");
                }
            }
        }
    }

    /// <summary>使用已完成订单统计每日和终身购买数量，防止绕过后台配置的限购规则。</summary>
    private async Task EnsurePurchaseLimitsAsync(
        long playerId,
        ShopProduct product,
        int requestedQuantity,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var purchasedLifetime = await db.ShopOrders
            .Where(x => x.PlayerId == playerId && x.ProductId == product.Id)
            .Where(x => x.Status == GameBusinessCodes.CompletedStatus)
            .SumAsync(x => (int?)x.Quantity, cancellationToken) ?? 0;

        if (product.PurchaseLimitLifetime is not null &&
            purchasedLifetime + requestedQuantity > product.PurchaseLimitLifetime)
        {
            throw new BusinessRuleException("SHOP_LIFETIME_LIMIT_REACHED", "已达到商品终身购买上限");
        }

        var (startUtc, endUtc) = BusinessDateTime.GetCurrentLondonDayUtcRange(utcNow);
        var purchasedToday = await db.ShopOrders
            .Where(x => x.PlayerId == playerId && x.ProductId == product.Id)
            .Where(x => x.Status == GameBusinessCodes.CompletedStatus && x.CreatedAt >= startUtc && x.CreatedAt < endUtc)
            .SumAsync(x => (int?)x.Quantity, cancellationToken) ?? 0;

        if (product.PurchaseLimitDaily is not null &&
            purchasedToday + requestedQuantity > product.PurchaseLimitDaily)
        {
            throw new BusinessRuleException("SHOP_DAILY_LIMIT_REACHED", "已达到商品每日购买上限");
        }
    }

    /// <summary>
    /// 根据商品直接关联的角色、装扮或物品完成发货，并写入独立履约记录。
    /// 商品至少应配置一种资产；重复拥有的非堆叠资产会保持单份并仍记录成功履约。
    /// </summary>
    private async Task DeliverProductAsync(
        long playerId,
        ShopProduct product,
        ShopOrder order,
        int quantity,
        DateTime utcNow,
        CancellationToken cancellationToken)
    {
        var delivered = false;

        if (product.ItemId is not null)
        {
            var inventory = await db.PlayerItems.SingleOrDefaultAsync(
                x => x.PlayerId == playerId && x.ItemId == product.ItemId,
                cancellationToken);
            var quantityBefore = inventory?.Quantity ?? 0;

            if (inventory is null)
            {
                inventory = new PlayerItem
                {
                    PlayerId = playerId,
                    ItemId = product.ItemId.Value,
                    CreatedAt = utcNow,
                };
                db.PlayerItems.Add(inventory);
            }

            inventory.Quantity = checked(quantityBefore + quantity);
            inventory.UpdatedAt = utcNow;
            var itemTransaction = new PlayerItemTransaction
            {
                PlayerId = playerId,
                ItemId = product.ItemId.Value,
                ChangeType = GameBusinessCodes.ShopPurchaseTransaction,
                QuantityChange = quantity,
                QuantityBefore = quantityBefore,
                QuantityAfter = inventory.Quantity,
                ReferenceType = GameBusinessCodes.ShopOrderReference,
                ReferenceId = order.OrderNo,
                IdempotencyKey = $"item:shop:{order.Id}:{product.ItemId}",
            };
            db.PlayerItemTransactions.Add(itemTransaction);
            await db.SaveChangesAsync(cancellationToken);

            var itemDelivery = CreateDelivery(order.Id, GameBusinessCodes.ItemDelivery, utcNow);
            itemDelivery.ItemTransactionId = itemTransaction.Id;
            db.ShopOrderDeliveries.Add(itemDelivery);
            delivered = true;
        }

        if (product.CharacterId is not null)
        {
            var playerCharacter = await db.PlayerCharacters.SingleOrDefaultAsync(
                x => x.PlayerId == playerId && x.CharacterId == product.CharacterId,
                cancellationToken);

            if (playerCharacter is null)
            {
                playerCharacter = new PlayerCharacter
                {
                    PlayerId = playerId,
                    CharacterId = product.CharacterId.Value,
                    ObtainedAt = utcNow,
                    UpdatedAt = utcNow,
                };
                db.PlayerCharacters.Add(playerCharacter);
                await db.SaveChangesAsync(cancellationToken);
            }

            var characterDelivery = CreateDelivery(order.Id, GameBusinessCodes.CharacterDelivery, utcNow);
            characterDelivery.PlayerCharacterId = playerCharacter.Id;
            db.ShopOrderDeliveries.Add(characterDelivery);

            gameLogService.AddCharacterLog(
                playerId,
                playerCharacter.CharacterId,
                playerCharacter.Id,
                "CHARACTER_GRANTED",
                "SUCCESS",
                new
                {
                    source = "SHOP",
                    orderNo = order.OrderNo,
                    productId = product.Id,
                });

            delivered = true;
        }

        if (product.CosmeticId is not null)
        {
            var catalog = await db.CosmeticCatalogs.AsNoTracking()
                .SingleAsync(x => x.Id == product.CosmeticId, cancellationToken);
            var playerCosmetic = await db.PlayerCosmetics.SingleOrDefaultAsync(
                x => x.PlayerId == playerId && x.CosmeticId == product.CosmeticId,
                cancellationToken);

            if (playerCosmetic is null)
            {
                playerCosmetic = new PlayerCosmetic
                {
                    PlayerId = playerId,
                    CosmeticId = product.CosmeticId.Value,
                    SlotType = catalog.SlotType,
                    ObtainedAt = utcNow,
                    UpdatedAt = utcNow,
                };
                db.PlayerCosmetics.Add(playerCosmetic);
                await db.SaveChangesAsync(cancellationToken);
            }

            var cosmeticDelivery = CreateDelivery(order.Id, GameBusinessCodes.CosmeticDelivery, utcNow);
            cosmeticDelivery.PlayerCosmeticId = playerCosmetic.Id;
            db.ShopOrderDeliveries.Add(cosmeticDelivery);
            delivered = true;
        }

        if (!delivered)
        {
            throw new BusinessRuleException("SHOP_DELIVERY_NOT_CONFIGURED", "商品尚未配置可发放内容");
        }
    }

    /// <summary>创建统一的成功履约实体，具体资产关联由调用处补充。</summary>
    private static ShopOrderDelivery CreateDelivery(long orderId, string deliveryType, DateTime utcNow)
    {
        return new ShopOrderDelivery
        {
            ShopOrderId = orderId,
            DeliveryType = deliveryType,
            DeliveryStatus = GameBusinessCodes.CompletedStatus,
            CreatedAt = utcNow,
            UpdatedAt = utcNow,
        };
    }

    /// <summary>生成便于日志和客服查询的非顺序商城订单号。</summary>
    private static string CreateOrderNumber()
    {
        return $"SHOP{Guid.NewGuid():N}"[..24];
    }

    /// <summary>将订单实体转换为稳定 API 响应。</summary>
    private static ShopOrderResponse MapResponse(ShopOrder order, decimal balance)
    {
        return new ShopOrderResponse(
            order.OrderNo,
            order.ProductId,
            order.Quantity,
            order.TotalPriceAmount,
            order.Status,
            balance,
            DateTime.UtcNow);
    }
}

using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using RaceGame.Api.Extensions;
using RaceGame.Application.Common;
using RaceGame.Application.Shop;

namespace RaceGame.Api.Controllers;

/// <summary>提供商城商品读取和认证玩家金币购买入口。</summary>
[ApiController]
[Route("api/shop")]
public sealed class ShopController(ShopService shopService) : ControllerBase
{
    /// <summary>返回当前已启用且处于生效窗口内的商城商品。</summary>
    [HttpGet("products")]
    public async Task<IActionResult> GetProducts(CancellationToken cancellationToken)
    {
        var products = await shopService.GetAvailableProductsAsync(DateTime.UtcNow, cancellationToken);
        return Ok(new { code = 0, data = products });
    }

    /// <summary>使用玩家金币创建幂等商城订单并完成发货。</summary>
    [Authorize]
    [HttpPost("orders")]
    public async Task<IActionResult> Purchase(
        PurchaseShopProductRequest request,
        CancellationToken cancellationToken)
    {
        if (!User.TryGetPlayerId(out var playerId))
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        try
        {
            var result = await shopService.PurchaseAsync(playerId, request, cancellationToken);
            return Ok(new { code = 0, data = result });
        }
        catch (BusinessRuleException exception)
        {
            return Conflict(new { code = exception.Code, message = exception.Message });
        }
    }
}

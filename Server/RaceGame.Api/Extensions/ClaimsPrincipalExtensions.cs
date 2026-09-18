using System.Security.Claims;

namespace RaceGame.Api.Extensions;

/// <summary>
/// 提供 API 层统一的认证玩家身份读取逻辑，避免各控制器重复解析 JWT 声明。
/// </summary>
public static class ClaimsPrincipalExtensions
{
    /// <summary>
    /// 尝试从标准名称标识声明读取玩家主键。
    /// </summary>
    /// <param name="principal">当前 HTTP 请求的认证主体。</param>
    /// <param name="playerId">解析成功时返回玩家主键。</param>
    /// <returns>声明存在且为有效正整数时返回 <see langword="true"/>。</returns>
    public static bool TryGetPlayerId(this ClaimsPrincipal principal, out long playerId)
    {
        var rawPlayerId = principal.FindFirstValue(ClaimTypes.NameIdentifier)
            ?? principal.FindFirstValue(ClaimTypes.Name);

        return long.TryParse(rawPlayerId, out playerId) && playerId > 0;
    }
}

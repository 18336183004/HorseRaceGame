using System.Security.Claims;
using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Admin.Services;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Controllers;

/// <summary>
/// 管理后台账号认证与会话控制器。
/// 负责处理管理员用户的登录身份核验、Cookie 认证会话维持、登出销毁以及登录审计追踪。
/// </summary>
public class AccountController(
    AppDbContext db,
    AdminPasswordHasher hasher,
    ILogger<AccountController> logger) : Controller
{
    /// <summary>
    /// 渲染管理员登录界面。
    /// </summary>
    /// <param name="returnUrl">登录成功后预期重定向的站内目标 URL。</param>
    /// <returns>登录页视图。</returns>
    [AllowAnonymous]
    [HttpGet]
    public IActionResult Login(string? returnUrl = null) => View(model: returnUrl);

    /// <summary>
    /// 验证管理员账号密码并建立登录会话。
    /// 校验输入完整性，核对数据库中已激活管理员的哈希凭据，记录审计日志并签发 Cookie。
    /// </summary>
    /// <param name="username">管理员账号用户名。</param>
    /// <param name="password">管理员明文密码。</param>
    /// <param name="returnUrl">登录成功后预期重定向的站内目标 URL。</param>
    /// <param name="ct">异步操作取消令牌。</param>
    /// <returns>验证成功时重定向至目标页面，失败时保留在登录页并呈现错误提示。</returns>
    [AllowAnonymous]
    [ValidateAntiForgeryToken]
    [HttpPost]
    public async Task<IActionResult> Login(
        string? username,
        string? password,
        string? returnUrl = null,
        CancellationToken ct = default)
    {
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrEmpty(password))
        {
            logger.LogWarning(
                "Admin login failed: empty username or password from {RemoteIp}",
                HttpContext.Connection.RemoteIpAddress);
            ViewBag.Error = "用户名和密码不能为空";
            return View(model: returnUrl);
        }

        var normalized = username.Trim().ToUpperInvariant();
        var admin = await db.AdminUsers.SingleOrDefaultAsync(
            x => x.UsernameNormalized == normalized && x.IsActive,
            ct);

        if (admin is null || !hasher.Verify(password, admin.PasswordHash))
        {
            logger.LogWarning(
                "Admin login failed for {Username} from {RemoteIp}",
                username,
                HttpContext.Connection.RemoteIpAddress);
            ViewBag.Error = "用户名或密码错误";
            return View(model: returnUrl);
        }

        admin.LastLoginAt = DateTime.UtcNow;
        admin.UpdatedAt = DateTime.UtcNow;

        db.AdminAuditLogs.Add(new AdminAuditLog
        {
            AdminUserId = admin.Id,
            ActionType = "LOGIN",
            ResourceType = "ADMIN_SESSION",
            RequestId = HttpContext.TraceIdentifier,
            MetadataJson = System.Text.Json.JsonSerializer.Serialize(new
            {
                remoteIp = HttpContext.Connection.RemoteIpAddress?.ToString()
            })
        });

        await db.SaveChangesAsync(ct);

        var claims = new[]
        {
            new Claim(ClaimTypes.NameIdentifier, admin.Id.ToString()),
            new Claim(ClaimTypes.Name, admin.Username),
            new Claim(ClaimTypes.Role, "Administrator")
        };

        await HttpContext.SignInAsync(
            CookieAuthenticationDefaults.AuthenticationScheme,
            new ClaimsPrincipal(new ClaimsIdentity(claims, CookieAuthenticationDefaults.AuthenticationScheme)));

        logger.LogInformation("Admin {AdminId}/{Username} signed in", admin.Id, admin.Username);
        return LocalRedirect(string.IsNullOrWhiteSpace(returnUrl) ? "/" : returnUrl);
    }

    /// <summary>
    /// 退出当前管理员会话并清除身份 Cookie。
    /// </summary>
    /// <returns>重定向至登录界面。</returns>
    [Authorize]
    [ValidateAntiForgeryToken]
    [HttpPost]
    public async Task<IActionResult> Logout()
    {
        await HttpContext.SignOutAsync();
        return RedirectToAction(nameof(Login));
    }
}

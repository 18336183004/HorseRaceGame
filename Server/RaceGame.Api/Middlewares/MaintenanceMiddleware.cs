using Microsoft.AspNetCore.Http;
using RaceGame.Application.Configuration;

namespace RaceGame.Api.Middlewares;

/// <summary>
/// 系统维护时间窗口全局拦截中间件。
/// 在维护生效期间（now >= MaintenanceStartAt 且未超过 MaintenanceEndAt），
/// 拦截非管理员业务请求并返回 HTTP 503 与结构化错误信息。
/// </summary>
public class MaintenanceMiddleware(RequestDelegate next)
{
    public async Task InvokeAsync(HttpContext context, RaceRuleConfigService ruleConfigService)
    {
        var path = context.Request.Path.Value ?? string.Empty;

        // 允许健康探针、Swagger、后台管理与身份认证通过
        if (path.StartsWith("/health", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/swagger", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/admin", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/admin", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("/api/auth", StringComparison.OrdinalIgnoreCase) ||
            path == "/")
        {
            await next(context);
            return;
        }

        var now = DateTime.UtcNow;
        var rules = await ruleConfigService.GetCurrentAsync(now, context.RequestAborted);

        if (rules.IsMaintenanceEnabled && rules.MaintenanceStartAt.HasValue)
        {
            var isMaintenanceActive = now >= rules.MaintenanceStartAt.Value &&
                (rules.MaintenanceEndAt == null || now < rules.MaintenanceEndAt.Value);

            if (isMaintenanceActive)
            {
                // 如果是已登录管理员，允许放行
                if (context.User.IsInRole("Admin") || context.User.IsInRole("SuperAdmin"))
                {
                    await next(context);
                    return;
                }

                context.Response.StatusCode = StatusCodes.Status503ServiceUnavailable;
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsJsonAsync(new
                {
                    code = 503,
                    message = "游戏正在维护中，请稍后再试",
                    data = new
                    {
                        maintenanceStartAt = rules.MaintenanceStartAt,
                        maintenanceEndAt = rules.MaintenanceEndAt,
                        reason = rules.MaintenanceReason ?? "系统日常维护升级中",
                    }
                });
                return;
            }
        }

        await next(context);
    }
}

using System.Security.Claims;
using System.Text;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;
using RaceGame.Api.Services;
using RaceGame.Application.Abstractions;
using RaceGame.Application.Audit;
using RaceGame.Application.Betting;
using RaceGame.Application.Configuration;
using RaceGame.Application.Race;
using RaceGame.Application.Settlement;
using RaceGame.Application.Shop;
using RaceGame.Application.Tasks;
using RaceGame.Application.Realtime;
using RaceGame.Application.Achievements;
using RaceGame.Application.Referrals;
using RaceGame.Infrastructure.Persistence;
using RaceGame.Infrastructure.Redis;
using RaceGame.Api.Hubs;
using RaceGame.Api.Logging;
using RaceGame.Api.Middlewares;
using RaceGame.Application.Ranch;

var builder = WebApplication.CreateBuilder(args);

// 根目录 logs/api：记录框架日志、业务日志和异常，便于本机排查。
var apiLogDirectory = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "logs", "api"));
builder.Logging.AddProvider(new DailyFileLoggerProvider(apiLogDirectory, "api"));

// Windows 本地开发：API 启动前自动确认 Redis 已启动；PostgreSQL 仍由用户手动启动。
RedisBootstrapper.EnsureStarted(builder.Configuration);

builder.Services.AddControllers();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var connectionString = builder.Configuration.GetConnectionString("Default")!;
builder.Services.AddDbContext<AppDbContext>(options => options.UseNpgsql(connectionString));
builder.Services.AddScoped<IGameDbContext>(sp => sp.GetRequiredService<AppDbContext>());

builder.Services.AddSingleton<StackExchange.Redis.IConnectionMultiplexer>(_ =>
{
    var options = StackExchange.Redis.ConfigurationOptions.Parse(
        builder.Configuration["Redis:Connection"] ?? "localhost:6379");
    options.Password = builder.Configuration["Redis:Password"];
    options.AbortOnConnectFail = false;
    options.ConnectRetry = 3;
    options.ConnectTimeout = 5000;
    options.SyncTimeout = 5000;
    return StackExchange.Redis.ConnectionMultiplexer.Connect(options);
});
builder.Services.AddSingleton<IRedisService, RedisService>();

builder.Services.AddScoped<PasswordHasher>();
builder.Services.AddScoped<JwtTokenService>();
// 注册应用用例。规则服务集中读取数据库配置，商城与任务服务负责各自事务边界。
builder.Services.AddScoped<RaceRuleConfigService>();
builder.Services.AddScoped<GameLogService>();
builder.Services.AddScoped<BettingService>();
builder.Services.AddScoped<RaceEngine>();
builder.Services.AddScoped<DailyTaskService>();
builder.Services.AddScoped<SettlementService>();
builder.Services.AddScoped<ShopService>();
builder.Services.AddScoped<AchievementService>();
builder.Services.AddScoped<PlayerReferralService>();
builder.Services.AddScoped<IRanchService, RanchService>();
builder.Services.AddSingleton<IRaceEventPublisher, RaceEventPublisher>();

var jwtIssuer = builder.Configuration["Jwt:Issuer"] ?? "RaceGame";
var jwtAudience = builder.Configuration["Jwt:Audience"] ?? "RaceGame";
var jwtKey = builder.Configuration["Jwt:Key"];

if (string.IsNullOrWhiteSpace(jwtKey))
{
    throw new InvalidOperationException("必须配置 Jwt:Key。");
}

if (!builder.Environment.IsDevelopment()
    && jwtKey.StartsWith("dev-only", StringComparison.OrdinalIgnoreCase))
{
    throw new InvalidOperationException("非开发环境禁止使用开发 JWT 密钥。");
}

var signingKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey));

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateIssuerSigningKey = true,
            ValidateLifetime = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = signingKey,
            ClockSkew = TimeSpan.FromMinutes(1),
        };
        options.Events = new JwtBearerEvents
        {
            OnMessageReceived = context =>
            {
                var accessToken = context.Request.Query["access_token"];
                var path = context.HttpContext.Request.Path;
                if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/raceHub"))
                {
                    context.Token = accessToken;
                }
                return Task.CompletedTask;
            }
        };
    });

builder.Services.AddAuthorization();
builder.Services.AddSignalR();
builder.Services.AddHostedService<RaceGame.Worker.RaceWorker>();
builder.Services.AddHostedService<RaceGame.Worker.RanchJobWorker>();

// 接口细粒度限流：保护认证（防暴力破解）与资金下注等高频操作。
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, token) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        await context.HttpContext.Response.WriteAsync(
            "{\"code\":\"TOO_MANY_REQUESTS\",\"message\":\"请求过于频繁，请稍后再试\"}",
            token);
    };

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = builder.Environment.IsDevelopment() ? 60 : 10,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));

    options.AddPolicy("bet", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            httpContext.User.FindFirst(ClaimTypes.NameIdentifier)?.Value
            ?? httpContext.Connection.RemoteIpAddress?.ToString()
            ?? "unknown",
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 30,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0,
            }));
});

// 开发环境允许本机调试；非开发环境必须显式配置允许来源，避免形成任意来源 CORS。
var allowedOrigins = builder.Configuration
    .GetSection("Cors:AllowedOrigins")
    .Get<string[]>() ?? [];

builder.Services.AddCors(options =>
    options.AddDefaultPolicy(policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.SetIsOriginAllowed(origin =>
            {
                if (Uri.TryCreate(origin, UriKind.Absolute, out var uri))
                {
                    return uri.Host is "localhost" or "127.0.0.1";
                }
                return false;
            })
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
            return;
        }

        if (allowedOrigins.Length == 0)
        {
            throw new InvalidOperationException(
                "非开发环境必须配置 Cors:AllowedOrigins。");
        }

        policy.WithOrigins(allowedOrigins)
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials();
    }));

var app = builder.Build();

app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("HttpRequest");
    var started = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        await next();
        logger.LogInformation("{Method} {Path} -> {StatusCode} in {Elapsed}ms", context.Request.Method, context.Request.Path, context.Response.StatusCode, started.ElapsedMilliseconds);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unhandled API exception: {Method} {Path}", context.Request.Method, context.Request.Path);
        if (!context.Response.HasStarted)
        {
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json; charset=utf-8";
            var errorMsg = builder.Environment.IsDevelopment() ? ex.Message : "服务器内部错误，请稍后重试";
            await context.Response.WriteAsJsonAsync(new { code = 500, message = errorMsg });
        }
    }
});

app.UseCors();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseAuthentication();
app.UseAuthorization();
app.UseMiddleware<MaintenanceMiddleware>();
app.UseRateLimiter();

app.MapControllers();
app.MapHub<RaceHub>("/raceHub");

// 本地开发入口：访问根地址直接进入 Swagger，避免 https://localhost:端口/ 返回 404。
app.MapGet("/", () => Results.Redirect("/swagger"));

// 存活探针（Liveness）：容器/进程存活探测。
app.MapGet("/health/live", () => Results.Ok(new
{
    status = "Live",
    serverTime = DateTime.UtcNow,
}));

// 就绪探针（Readiness）与综合健康检查：验证 PostgreSQL 与 Redis 连通性。
var checkHealth = async (AppDbContext db, StackExchange.Redis.IConnectionMultiplexer redis, CancellationToken ct) =>
{
    var postgresOk = false;
    var redisOk = false;
    string? postgresError = null;
    string? redisError = null;

    try
    {
        postgresOk = await db.Database.CanConnectAsync(ct);
    }
    catch
    {
        postgresError = "PostgreSQL不可用";
    }

    try
    {
        await redis.GetDatabase().PingAsync();
        redisOk = true;
    }
    catch
    {
        redisError = "Redis不可用";
    }

    var ok = postgresOk && redisOk;
    return Results.Json(new
    {
        status = ok ? "Healthy" : "Unhealthy",
        postgres = new { ok = postgresOk, error = postgresError },
        redis = new { ok = redisOk, error = redisError },
        serverTime = DateTime.UtcNow,
    }, statusCode: ok ? StatusCodes.Status200OK : StatusCodes.Status503ServiceUnavailable);
};

app.MapGet("/health", checkHealth);
app.MapGet("/health/ready", checkHealth);

app.Run();

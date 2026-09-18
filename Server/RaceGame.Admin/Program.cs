using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.EntityFrameworkCore;
using RaceGame.Admin.Logging;
using RaceGame.Infrastructure.Persistence;
using RaceGame.Admin.Services;

var builder = WebApplication.CreateBuilder(args);
var adminLogDirectory = Path.GetFullPath(Path.Combine(builder.Environment.ContentRootPath, "..", "..", "logs", "admin"));
builder.Logging.AddProvider(new DailyFileLoggerProvider(adminLogDirectory, "admin"));

builder.Services.AddControllersWithViews();
builder.Services.AddScoped<AdminPasswordHasher>();
builder.Services.AddDbContext<AppDbContext>(o => o.UseNpgsql(builder.Configuration.GetConnectionString("Default")!));
builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme).AddCookie(o =>
{
    o.LoginPath = "/Account/Login";
    o.AccessDeniedPath = "/Account/Login";
    o.Cookie.Name = "RaceGame.Admin";
    o.ExpireTimeSpan = TimeSpan.FromHours(8);
    o.SlidingExpiration = true;
});
builder.Services.AddAuthorization();

var app = builder.Build();

using (var bootstrapScope = app.Services.CreateScope())
{
    var db = bootstrapScope.ServiceProvider.GetRequiredService<AppDbContext>();
    var hasher = bootstrapScope.ServiceProvider.GetRequiredService<AdminPasswordHasher>();
    await AdminBootstrapper.EnsureAsync(db, hasher, app.Environment, CancellationToken.None);
}
app.Use(async (context, next) =>
{
    var logger = context.RequestServices.GetRequiredService<ILoggerFactory>().CreateLogger("AdminHttpRequest");
    var sw = System.Diagnostics.Stopwatch.StartNew();
    try
    {
        await next();
        logger.LogInformation("{Method} {Path} -> {StatusCode} in {Elapsed}ms", context.Request.Method, context.Request.Path, context.Response.StatusCode, sw.ElapsedMilliseconds);
    }
    catch (Exception ex)
    {
        logger.LogError(ex, "Unhandled Admin exception: {Method} {Path}", context.Request.Method, context.Request.Path);
        throw;
    }
});
if (!app.Environment.IsDevelopment()) app.UseExceptionHandler("/Home/Error");
app.UseStaticFiles();
app.UseRouting();
app.UseAuthentication();
app.UseAuthorization();
app.MapControllerRoute(name: "default", pattern: "{controller=Home}/{action=Index}/{id?}");

app.MapGet("/health/live", () => Results.Ok(new { status = "Live", service = "RaceGame.Admin", serverTime = DateTime.UtcNow })).AllowAnonymous();

var checkAdminHealth = async (AppDbContext db, CancellationToken ct) =>
{
    try { return Results.Json(new { status = await db.Database.CanConnectAsync(ct) ? "Healthy" : "Unhealthy", service = "RaceGame.Admin", serverTime = DateTime.UtcNow }); }
    catch (Exception ex) { return Results.Json(new { status = "Unhealthy", service = "RaceGame.Admin", error = ex.Message, serverTime = DateTime.UtcNow }, statusCode: 503); }
};

app.MapGet("/health", checkAdminHealth).AllowAnonymous();
app.MapGet("/health/ready", checkAdminHealth).AllowAnonymous();

app.Run();

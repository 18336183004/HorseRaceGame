using Microsoft.EntityFrameworkCore;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Admin.Services;

/// <summary>从环境变量初始化首个后台管理员，避免生产环境依赖仓库中的固定密码。</summary>
public static class AdminBootstrapper
{
    public static async Task EnsureAsync(AppDbContext db, AdminPasswordHasher hasher, IWebHostEnvironment environment, CancellationToken cancellationToken)
    {
        var username = Environment.GetEnvironmentVariable("RACEGAME_ADMIN_USERNAME");
        var password = Environment.GetEnvironmentVariable("RACEGAME_ADMIN_PASSWORD");

        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            if (environment.IsDevelopment())
            {
                username = "admin";
                password = "RaceGame@2026";
            }
            else
            {
                throw new InvalidOperationException("Production requires RACEGAME_ADMIN_USERNAME and RACEGAME_ADMIN_PASSWORD for admin bootstrap.");
            }
        }

        var normalized = username.Trim().ToUpperInvariant();
        var admin = await db.AdminUsers.FirstOrDefaultAsync(x => x.UsernameNormalized == normalized, cancellationToken);
        if (admin is null)
        {
            admin = new AdminUser
            {
                Username = username.Trim(),
                UsernameNormalized = normalized,
                PasswordHash = hasher.HashPassword(password),
                PasswordAlgorithm = "PBKDF2-SHA256-100000",
                PasswordVersion = 1,
                IsActive = true,
            };
            db.AdminUsers.Add(admin);
            await db.SaveChangesAsync(cancellationToken);
            return;
        }

        if (!admin.IsActive)
        {
            admin.IsActive = true;
            admin.PasswordHash = hasher.HashPassword(password);
            admin.PasswordAlgorithm = "PBKDF2-SHA256-100000";
            admin.PasswordVersion++;
            admin.LastPasswordChangedAt = DateTime.UtcNow;
            admin.UpdatedAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }
    }
}

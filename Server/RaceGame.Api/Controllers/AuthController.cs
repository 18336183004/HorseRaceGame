using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using RaceGame.Api.Services;
using RaceGame.Application.Audit;
using RaceGame.Application.Configuration;
using RaceGame.Application.Referrals;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using RaceGame.Infrastructure.Persistence;

namespace RaceGame.Api.Controllers;

/// <summary>
/// 提供玩家注册、登录、改密和受限开发登录入口。
/// 注册资产初始化读取当前发布的赛马规则配置，避免初始余额散落在控制器中。
/// </summary>
[ApiController]
[Route("api/auth")]
[Microsoft.AspNetCore.RateLimiting.EnableRateLimiting("auth")]
public sealed class AuthController(
    AppDbContext db,
    PasswordHasher passwordHasher,
    JwtTokenService jwtTokenService,
    RaceRuleConfigService ruleConfigService,
    GameLogService gameLogService,
    PlayerReferralService referralService,
    IWebHostEnvironment environment) : ControllerBase
{
    /// <summary>注册玩家并在一个事务内创建凭据、设置、统计、钱包和初始化流水。</summary>
    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request, CancellationToken cancellationToken)
    {
        var accountId = NormalizeAccount(request.AccountId);
        var validationError = ValidateCredentialInput(accountId, request.Password, request.ConfirmPassword);
        if (validationError is not null)
        {
            return BadRequest(new { code = 1, message = validationError });
        }

        var exists = await db.Players.AnyAsync(x => x.AccountNormalized == accountId.ToUpperInvariant(), cancellationToken);
        if (exists)
        {
            return BadRequest(new { code = 1, message = "账号已存在" });
        }

        var utcNow = DateTime.UtcNow;
        var rules = await ruleConfigService.GetCurrentAsync(utcNow, cancellationToken);
        var inviteCode = await referralService.GenerateUniqueInviteCodeAsync(cancellationToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

        var player = new Player
        {
            AccountId = accountId,
            AccountNormalized = accountId.ToUpperInvariant(),
            Nickname = string.IsNullOrWhiteSpace(request.Nickname) ? accountId : request.Nickname.Trim(),
            Locale = "zh-CN",
            Level = 1,
            Exp = 0,
            IsActive = true,
            InviteCode = inviteCode,
        };

        try
        {
            db.Players.Add(player);
            await db.SaveChangesAsync(cancellationToken);

        db.PlayerCredentials.Add(new PlayerCredential
        {
            PlayerId = player.Id,
            PasswordHash = passwordHasher.HashPassword(request.Password),
            PasswordAlgorithm = passwordHasher.Algorithm,
            PasswordVersion = 1,
        });

        db.PlayerSettings.Add(new PlayerSetting
        {
            PlayerId = player.Id,
            Language = "zh-CN",
            TimeZone = "Europe/London",
        });

        db.PlayerStats.Add(new PlayerStat { PlayerId = player.Id });

        var defaultCharacter = await db.CharacterCatalogs
            .FirstOrDefaultAsync(x => x.IsEnabled && x.IsDefault, cancellationToken);

        db.Wallets.Add(new Wallet
        {
            PlayerId = player.Id,
            Balance = rules.InitialWalletBalance,
        });

        PlayerCharacter? defaultPlayerCharacter = null;
        if (defaultCharacter is not null)
        {
            defaultPlayerCharacter = new PlayerCharacter
            {
                PlayerId = player.Id,
                CharacterId = defaultCharacter.Id,
                Level = 1,
                Exp = 0,
                IsEquipped = true,
                EquippedAt = utcNow,
            };
            db.PlayerCharacters.Add(defaultPlayerCharacter);
        }

        db.WalletTransactions.Add(new WalletTransaction
        {
            PlayerId = player.Id,
            TransactionType = GameBusinessCodes.InitialGrantTransaction,
            Amount = rules.InitialWalletBalance,
            BalanceBefore = 0m,
            BalanceAfter = rules.InitialWalletBalance,
            ReferenceType = GameBusinessCodes.PlayerReference,
            ReferenceId = player.Id.ToString(),
            IdempotencyKey = "init:" + player.Id,
        });

        await db.SaveChangesAsync(cancellationToken);

        if (defaultPlayerCharacter is not null)
        {
            gameLogService.AddCharacterLog(
                player.Id,
                defaultPlayerCharacter.CharacterId,
                defaultPlayerCharacter.Id,
                "CHARACTER_GRANTED",
                "SUCCESS",
                new { source = "REGISTER", level = defaultPlayerCharacter.Level });
            await db.SaveChangesAsync(cancellationToken);
        }

            await transaction.CommitAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "uq_players_account_normalized"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new { code = 1, message = "账号已存在" });
        }
        catch (DbUpdateException ex) when (IsUniqueConstraintViolation(ex, "idx_players_invite_code") || IsUniqueConstraintViolation(ex, "uq_players_invite_code"))
        {
            await transaction.RollbackAsync(cancellationToken);
            return BadRequest(new { code = 1, message = "邀请码生成冲突，请重新尝试注册" });
        }

        return Ok(new
        {
            code = 0,
            data = new
            {
                playerId = player.Id,
                accountId = player.AccountId,
                nickname = player.Nickname,
                message = "注册成功，请重新登录",
            },
        });
    }

    /// <summary>校验账号密码并签发可撤销的访问令牌与刷新会话。</summary>
    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request, CancellationToken cancellationToken)
    {
        var accountId = NormalizeAccount(request.AccountId);
        if (string.IsNullOrWhiteSpace(accountId))
        {
            return BadRequest(new { code = 1, message = "请输入账号" });
        }

        if (string.IsNullOrEmpty(request.Password))
        {
            return BadRequest(new { code = 1, message = "请输入密码" });
        }

        var player = await db.Players.FirstOrDefaultAsync(
            x => x.AccountNormalized == accountId.ToUpperInvariant() && x.IsActive,
            cancellationToken);

        if (player is null)
        {
            return BadRequest(new { code = 1, message = "账号不存在，请先注册账号" });
        }

        var credential = await db.PlayerCredentials.FirstOrDefaultAsync(x => x.PlayerId == player.Id, cancellationToken);
        var now = DateTime.UtcNow;
        if (credential is null)
        {
            return BadRequest(new { code = 1, message = "账号凭据不存在，请联系管理员" });
        }

        if (credential.LockedUntil is not null && credential.LockedUntil > now)
        {
            return StatusCode(StatusCodes.Status429TooManyRequests, new
            {
                code = "ACCOUNT_TEMPORARILY_LOCKED",
                message = "登录失败次数过多，请稍后再试",
                retryAt = credential.LockedUntil,
            });
        }

        if (!passwordHasher.Verify(request.Password, credential.PasswordHash))
        {
            credential.FailedLoginCount++;
            credential.LockedUntil = credential.FailedLoginCount >= 5
                ? now.AddMinutes(10)
                : null;
            credential.UpdatedAt = now;
            await db.SaveChangesAsync(cancellationToken);

            return BadRequest(new
            {
                code = credential.LockedUntil is not null ? "ACCOUNT_TEMPORARILY_LOCKED" : "INVALID_CREDENTIALS",
                message = credential.LockedUntil is not null ? "登录失败次数过多，请10分钟后再试" : "账号或密码错误，请重新输入",
            });
        }

        credential.FailedLoginCount = 0;
        credential.LockedUntil = null;
        credential.UpdatedAt = now;
        player.LastLoginAt = now;
        player.UpdatedAt = now;

        var tokenResult = jwtTokenService.IssuePlayerTokens(player);
        db.PlayerSessions.Add(new PlayerSession
        {
            PlayerId = player.Id,
            RefreshTokenHash = passwordHasher.HashToken(tokenResult.RefreshToken),
            AccessTokenJti = tokenResult.Jti,
            ClientPlatform = request.ClientPlatform ?? "unknown",
            ClientVersion = request.ClientVersion,
            IssuedAt = DateTime.UtcNow,
            ExpiresAt = tokenResult.RefreshTokenExpiresAt,
            LastSeenAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(cancellationToken);

        var wallet = await db.Wallets.FirstOrDefaultAsync(x => x.PlayerId == player.Id, cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                playerId = player.Id,
                accountId = player.AccountId,
                nickname = player.Nickname,
                accessToken = tokenResult.AccessToken,
                accessTokenExpiresAt = tokenResult.AccessTokenExpiresAt,
                refreshToken = tokenResult.RefreshToken,
                refreshTokenExpiresAt = tokenResult.RefreshTokenExpiresAt,
                balance = wallet?.Balance ?? 0m,
            },
        });
    }

    /// <summary>撤销当前 Refresh Token 对应的会话，保证退出登录在服务端真正生效。</summary>
    [AllowAnonymous]
    [HttpPost("logout")]
    public async Task<IActionResult> Logout(LogoutRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
        {
            return Ok(new { code = 0, data = new { revoked = false } });
        }

        var hash = passwordHasher.HashToken(request.RefreshToken);
        var session = await db.PlayerSessions
            .FirstOrDefaultAsync(x => x.RefreshTokenHash == hash && x.RevokedAt == null, cancellationToken);

        if (session is not null)
        {
            session.RevokedAt = DateTime.UtcNow;
            session.RevokeReason = "LOGOUT";
            session.LastSeenAt = DateTime.UtcNow;
            await db.SaveChangesAsync(cancellationToken);
        }

        return Ok(new { code = 0, data = new { revoked = session is not null } });
    }

    /// <summary>刷新访问令牌并轮换 Refresh Token；旧刷新令牌立即失效，防止重放。</summary>
    [HttpPost("refresh")]
    public async Task<IActionResult> Refresh(RefreshTokenRequest request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.RefreshToken))
            return BadRequest(new { code = 1, message = "Refresh Token不能为空" });

        var hash = passwordHasher.HashToken(request.RefreshToken);
        await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);
        var now = DateTime.UtcNow;
        var session = await db.PlayerSessions
            .FirstOrDefaultAsync(x => x.RefreshTokenHash == hash && x.RevokedAt == null && x.ExpiresAt > now, cancellationToken);

        if (session is null)
            return Unauthorized(new { code = "REFRESH_TOKEN_INVALID", message = "Refresh Token无效或已过期" });

        var player = await db.Players.FirstOrDefaultAsync(x => x.Id == session.PlayerId && x.IsActive, cancellationToken);
        if (player is null)
            return Unauthorized(new { code = "PLAYER_INACTIVE", message = "玩家不存在或已停用" });

        session.RevokedAt = now;
        session.RevokeReason = "ROTATED";
        session.LastSeenAt = now;

        var tokenResult = jwtTokenService.IssuePlayerTokens(player);
        db.PlayerSessions.Add(new PlayerSession
        {
            PlayerId = player.Id,
            RefreshTokenHash = passwordHasher.HashToken(tokenResult.RefreshToken),
            AccessTokenJti = tokenResult.Jti,
            ClientPlatform = request.ClientPlatform ?? session.ClientPlatform,
            ClientVersion = request.ClientVersion ?? session.ClientVersion,
            DeviceId = request.DeviceId ?? session.DeviceId,
            IssuedAt = now,
            ExpiresAt = tokenResult.RefreshTokenExpiresAt,
            LastSeenAt = now,
        });

        await db.SaveChangesAsync(cancellationToken);
        await transaction.CommitAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                playerId = player.Id,
                accessToken = tokenResult.AccessToken,
                accessTokenExpiresAt = tokenResult.AccessTokenExpiresAt,
                refreshToken = tokenResult.RefreshToken,
                refreshTokenExpiresAt = tokenResult.RefreshTokenExpiresAt,
            }
        });
    }

    /// <summary>修改密码并撤销当前玩家所有历史会话。</summary>
    [Authorize]
    [HttpPost("change-password")]
    public async Task<IActionResult> ChangePassword(ChangePasswordRequest request, CancellationToken cancellationToken)
    {
        var playerId = GetCurrentPlayerId();
        if (playerId is null)
        {
            return Unauthorized(new { code = 1, message = "未登录" });
        }

        if (string.IsNullOrEmpty(request.NewPassword) || request.NewPassword.Length < 8)
        {
            return BadRequest(new { code = 1, message = "新密码长度不能小于8位" });
        }

        if (!string.Equals(request.NewPassword, request.ConfirmNewPassword, StringComparison.Ordinal))
        {
            return BadRequest(new { code = 1, message = "两次输入的新密码不一致" });
        }

        var credential = await db.PlayerCredentials.FirstOrDefaultAsync(x => x.PlayerId == playerId.Value, cancellationToken);
        if (credential is null || !passwordHasher.Verify(request.OldPassword, credential.PasswordHash))
        {
            return BadRequest(new { code = 1, message = "旧密码错误" });
        }

        var now = DateTime.UtcNow;
        credential.PasswordHash = passwordHasher.HashPassword(request.NewPassword);
        credential.PasswordVersion++;
        credential.PasswordAlgorithm = passwordHasher.Algorithm;
        credential.LastPasswordChangedAt = now;
        credential.UpdatedAt = now;

        var sessions = await db.PlayerSessions
            .Where(x => x.PlayerId == playerId.Value && x.RevokedAt == null)
            .ToListAsync(cancellationToken);

        foreach (var session in sessions)
        {
            session.RevokedAt = now;
            session.RevokeReason = "PASSWORD_CHANGED";
            session.LastSeenAt = now;
        }

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                message = "密码修改成功，请重新登录",
            },
        });
    }

    /// <summary>提供开发环境快捷登录；正式环境必须通过部署策略禁用。</summary>
    [AllowAnonymous]
    [HttpPost("dev-login")]
    public async Task<IActionResult> DevLogin(DevLoginRequest request, CancellationToken cancellationToken)
    {
        if (!environment.IsDevelopment() && !environment.IsEnvironment("Test"))
        {
            return NotFound(new { code = "NOT_FOUND", message = "接口不存在" });
        }

        var accountId = NormalizeAccount(request.AccountId);
        if (accountId.Length < 8)
        {
            return BadRequest(new { code = 1, message = "开发登录账号长度不能小于8位" });
        }

        var player = await db.Players.FirstOrDefaultAsync(x => x.AccountNormalized == accountId.ToUpperInvariant(), cancellationToken);
        if (player is null)
        {
            var utcNow = DateTime.UtcNow;
            var rules = await ruleConfigService.GetCurrentAsync(utcNow, cancellationToken);
            await using var transaction = await db.Database.BeginTransactionAsync(cancellationToken);

            player = new Player
            {
                AccountId = accountId,
                AccountNormalized = accountId.ToUpperInvariant(),
                Nickname = string.IsNullOrWhiteSpace(request.Nickname) ? accountId : request.Nickname.Trim(),
                Locale = "zh-CN",
                IsActive = true,
            };

            db.Players.Add(player);
            await db.SaveChangesAsync(cancellationToken);

            db.PlayerSettings.Add(new PlayerSetting
            {
                PlayerId = player.Id,
                Language = "zh-CN",
                TimeZone = "Europe/London",
            });

            db.PlayerStats.Add(new PlayerStat { PlayerId = player.Id });

            var defaultCharacter = await db.CharacterCatalogs
                .FirstOrDefaultAsync(x => x.IsEnabled && x.IsDefault, cancellationToken);
            if (defaultCharacter is not null)
            {
                var playerCharacter = new PlayerCharacter
                {
                    PlayerId = player.Id,
                    CharacterId = defaultCharacter.Id,
                    Level = 1,
                    Exp = 0,
                    IsEquipped = true,
                    EquippedAt = utcNow,
                };
                db.PlayerCharacters.Add(playerCharacter);
            }

            db.Wallets.Add(new Wallet { PlayerId = player.Id, Balance = rules.InitialWalletBalance });
            db.WalletTransactions.Add(new WalletTransaction
            {
                PlayerId = player.Id,
                TransactionType = GameBusinessCodes.InitialGrantTransaction,
                Amount = rules.InitialWalletBalance,
                BalanceBefore = 0m,
                BalanceAfter = rules.InitialWalletBalance,
                ReferenceType = GameBusinessCodes.PlayerReference,
                ReferenceId = player.Id.ToString(),
                IdempotencyKey = "init:" + player.Id,
            });

            await db.SaveChangesAsync(cancellationToken);

            if (defaultCharacter is not null)
            {
                var playerCharacter = await db.PlayerCharacters.FirstAsync(
                    x => x.PlayerId == player.Id && x.CharacterId == defaultCharacter.Id,
                    cancellationToken);
                gameLogService.AddCharacterLog(
                    player.Id,
                    playerCharacter.CharacterId,
                    playerCharacter.Id,
                    "CHARACTER_GRANTED",
                    "SUCCESS",
                    new { source = "DEV_LOGIN", level = playerCharacter.Level });
                await db.SaveChangesAsync(cancellationToken);
            }

            await transaction.CommitAsync(cancellationToken);
        }

        var tokenResult = jwtTokenService.IssuePlayerTokens(player);
        db.PlayerSessions.Add(new PlayerSession
        {
            PlayerId = player.Id,
            RefreshTokenHash = passwordHasher.HashToken(tokenResult.RefreshToken),
            AccessTokenJti = tokenResult.Jti,
            ClientPlatform = "dev",
            ClientVersion = "dev",
            IssuedAt = DateTime.UtcNow,
            ExpiresAt = tokenResult.RefreshTokenExpiresAt,
            LastSeenAt = DateTime.UtcNow,
        });

        await db.SaveChangesAsync(cancellationToken);

        return Ok(new
        {
            code = 0,
            data = new
            {
                playerId = player.Id,
                accountId = player.AccountId,
                nickname = player.Nickname,
                accessToken = tokenResult.AccessToken,
                refreshToken = tokenResult.RefreshToken,
            },
        });
    }

    private long? GetCurrentPlayerId()
    {
        var raw = User.FindFirstValue(ClaimTypes.NameIdentifier) ?? User.FindFirstValue(ClaimTypes.Name);
        return long.TryParse(raw, out var playerId) ? playerId : null;
    }

    private static string NormalizeAccount(string? accountId)
    {
        return (accountId ?? string.Empty).Trim();
    }

    private static string? ValidateCredentialInput(string accountId, string password, string confirmPassword)
    {
        if (accountId.Length < 8)
        {
            return "账号长度不能小于8位";
        }

        if (string.IsNullOrEmpty(password) || password.Length < 8)
        {
            return "密码长度不能小于8位";
        }

        if (!string.Equals(password, confirmPassword, StringComparison.Ordinal))
        {
            return "两次输入的密码不一致";
        }

        return null;
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
}

public record RegisterRequest(string AccountId, string Password, string ConfirmPassword, string? Nickname);

public record LoginRequest(string AccountId, string Password, string? ClientPlatform, string? ClientVersion);

public record ChangePasswordRequest(string OldPassword, string NewPassword, string ConfirmNewPassword);

public sealed record LogoutRequest(string RefreshToken);

public record DevLoginRequest(string AccountId, string? Nickname);


public sealed record RefreshTokenRequest(
    string RefreshToken,
    string? ClientPlatform = null,
    string? ClientVersion = null,
    string? DeviceId = null);

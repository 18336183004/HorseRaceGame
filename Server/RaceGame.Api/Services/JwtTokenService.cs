using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using RaceGame.Domain.Entities;

namespace RaceGame.Api.Services;

public record AuthTokenResult(
    string AccessToken,
    DateTime AccessTokenExpiresAt,
    string RefreshToken,
    DateTime RefreshTokenExpiresAt,
    string Jti);

public class JwtTokenService(IConfiguration configuration)
{
    public AuthTokenResult IssuePlayerTokens(Player player)
    {
        var issuer = configuration["Jwt:Issuer"] ?? "RaceGame";
        var audience = configuration["Jwt:Audience"] ?? "RaceGame";
        var key = configuration["Jwt:Key"] ?? "dev-only-super-secret-key-change-me-1234567890";

        var accessExpiresAt = DateTime.UtcNow.AddHours(12);
        var refreshExpiresAt = DateTime.UtcNow.AddDays(7);
        var jti = Guid.NewGuid().ToString("N");

        var claims = new List<Claim>
        {
            new(JwtRegisteredClaimNames.Sub, player.Id.ToString()),
            new(ClaimTypes.NameIdentifier, player.Id.ToString()),
            new(ClaimTypes.Name, player.AccountId),
            new("account_id", player.AccountId),
            new("locale", player.Locale),
            new(JwtRegisteredClaimNames.Jti, jti),
        };

        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            notBefore: DateTime.UtcNow,
            expires: accessExpiresAt,
            signingCredentials: new SigningCredentials(
                new SymmetricSecurityKey(Encoding.UTF8.GetBytes(key)),
                SecurityAlgorithms.HmacSha256));

        var accessToken = new JwtSecurityTokenHandler().WriteToken(token);
        var refreshToken = Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

        return new AuthTokenResult(accessToken, accessExpiresAt, refreshToken, refreshExpiresAt, jti);
    }
}

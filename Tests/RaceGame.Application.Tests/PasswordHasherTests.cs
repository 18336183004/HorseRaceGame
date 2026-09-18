using RaceGame.Api.Services;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证密码加盐哈希算法（PBKDF2-SHA256）与令牌哈希的安全性与幂等性。
/// </summary>
public sealed class PasswordHasherTests
{
    [Fact]
    public void HashPassword_GeneratesSaltAndHash_VerifiesSuccessfully()
    {
        var hasher = new PasswordHasher();
        const string password = "SecurePassword@2026!";

        var hash = hasher.HashPassword(password);

        Assert.NotEmpty(hash);
        Assert.Contains(".", hash);
        Assert.Equal("PBKDF2-SHA256-100000", hasher.Algorithm);

        Assert.True(hasher.Verify(password, hash));
        Assert.False(hasher.Verify("WrongPassword", hash));
    }

    [Fact]
    public void HashPassword_ProducesDifferentSaltsForSamePassword()
    {
        var hasher = new PasswordHasher();
        const string password = "IdenticalPassword#123";

        var hash1 = hasher.HashPassword(password);
        var hash2 = hasher.HashPassword(password);

        Assert.NotEqual(hash1, hash2);
        Assert.True(hasher.Verify(password, hash1));
        Assert.True(hasher.Verify(password, hash2));
    }

    [Fact]
    public void HashToken_IsDeterministicSha256()
    {
        var hasher = new PasswordHasher();
        const string token = "refresh_token_sample_string_123456";

        var hash1 = hasher.HashToken(token);
        var hash2 = hasher.HashToken(token);

        Assert.Equal(hash1, hash2);
        Assert.NotEmpty(hash1);
    }
}

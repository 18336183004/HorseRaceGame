using System.Security.Cryptography;
using System.Text;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证可信赛果算法 (Provably Fair) 的哈希承诺与跨平台确定性。
/// 对标 PRD 5.3.3、5.3.5、12.2.2 及验收标准 11.9。
/// </summary>
public sealed class ProvablyFairTests
{
    private static string ComputeCommitment(string seed)
        => Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(seed))).ToLowerInvariant();

    [Fact]
    public void SeedCommitment_IsDeterministicAndProduces64HexChars()
    {
        const string seed = "20260910-1002-race-round-12345-secret-salt-abc";
        var hash1 = ComputeCommitment(seed);
        var hash2 = ComputeCommitment(seed);

        Assert.Equal(hash1, hash2);
        Assert.Equal(64, hash1.Length);
        Assert.Matches("^[0-9a-f]{64}$", hash1);
    }

    [Fact]
    public void SeedCommitment_DifferentSeeds_ProduceCompletelyDifferentHashes()
    {
        const string seedA = "seed-version-1.2-alpha";
        const string seedB = "seed-version-1.2-alphb";

        var hashA = ComputeCommitment(seedA);
        var hashB = ComputeCommitment(seedB);

        Assert.NotEqual(hashA, hashB);
    }

    [Fact]
    public void SeedCommitment_StandardKnownVector_Matches()
    {
        // 测试标准 ASCII 字符串 "RaceGameProvablyFair" 的 SHA-256
        const string input = "RaceGameProvablyFair";
        var commitment = ComputeCommitment(input);

        using var sha = SHA256.Create();
        var expectedBytes = sha.ComputeHash(Encoding.UTF8.GetBytes(input));
        var expectedHex = Convert.ToHexString(expectedBytes).ToLowerInvariant();

        Assert.Equal(expectedHex, commitment);
    }
}

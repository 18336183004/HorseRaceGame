using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证大厅赛果走势统计：马匹获胜频次分布、跳过轮次过滤与空轮次兜底不变量。
/// </summary>
public sealed class RaceHistoryTrendTests
{
    private sealed record MockHistoryItem(long RoundId, int? WinnerHorseNo, bool IsSkipped);

    private static (int Total, int Active, int Skipped, int[] Distribution) ComputeDistribution(IEnumerable<MockHistoryItem> items)
    {
        var list = items.ToList();
        var winnerCounts = new int[6];
        foreach (var item in list)
        {
            if (!item.IsSkipped && item.WinnerHorseNo is >= 1 and <= 6)
            {
                winnerCounts[item.WinnerHorseNo.Value - 1]++;
            }
        }

        var active = list.Count(x => !x.IsSkipped);
        var skipped = list.Count(x => x.IsSkipped);
        return (list.Count, active, skipped, winnerCounts);
    }

    [Fact]
    public void ComputeDistribution_CorrectlyTalliesWinningHorses()
    {
        var history = new List<MockHistoryItem>
        {
            new(101, 3, false),
            new(102, 3, false),
            new(103, 1, false),
            new(104, 6, false),
            new(105, 3, false),
        };

        var (total, active, skipped, counts) = ComputeDistribution(history);

        Assert.Equal(5, total);
        Assert.Equal(5, active);
        Assert.Equal(0, skipped);
        Assert.Equal(1, counts[0]); // Horse 1 won once
        Assert.Equal(0, counts[1]); // Horse 2 won 0
        Assert.Equal(3, counts[2]); // Horse 3 won three times
        Assert.Equal(0, counts[3]); // Horse 4 won 0
        Assert.Equal(0, counts[4]); // Horse 5 won 0
        Assert.Equal(1, counts[5]); // Horse 6 won once
    }

    [Fact]
    public void ComputeDistribution_IgnoresSkippedAndNullWinners()
    {
        var history = new List<MockHistoryItem>
        {
            new(101, 2, false),
            new(102, null, true),  // 无下注跳过轮次
            new(103, 2, false),
            new(104, 7, false),   // 异常马号（越界）
            new(105, null, false), // 赛果未出
        };

        var (total, active, skipped, counts) = ComputeDistribution(history);

        Assert.Equal(5, total);
        Assert.Equal(4, active);
        Assert.Equal(1, skipped);
        Assert.Equal(2, counts[1]); // Horse 2 won twice
        Assert.Equal(0, counts[0]);
        Assert.Equal(0, counts[2]);
    }

    [Fact]
    public void ComputeDistribution_HandlesEmptyRoundList()
    {
        var history = new List<MockHistoryItem>();

        var (total, active, skipped, counts) = ComputeDistribution(history);

        Assert.Equal(0, total);
        Assert.Equal(0, active);
        Assert.Equal(0, skipped);
        Assert.All(counts, count => Assert.Equal(0, count));
    }
}

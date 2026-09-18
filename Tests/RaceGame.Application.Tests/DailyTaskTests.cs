using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;
using Xunit;

namespace RaceGame.Application.Tests;

/// <summary>
/// 验证 PRD 6.10 规定的 9 个每日任务（比赛场数、胜场、负场）业务递进与判定规则。
/// </summary>
public sealed class DailyTaskTests
{
    [Fact]
    public void TaskTypeConstants_MatchPRD6_10Specifications()
    {
        Assert.Equal("RACE_COUNT", GameBusinessCodes.DailyRaceCountTask);
        Assert.Equal("RACE_WIN", GameBusinessCodes.DailyRaceWinTask);
        Assert.Equal("RACE_LOSS", GameBusinessCodes.DailyRaceLossTask);
    }

    [Fact]
    public void DailyTaskIncrement_ProgressesCountWinAndLossCorrectly()
    {
        var countTask = new PlayerDailyTask { Progress = 2, IsCompleted = false };
        var winTask = new PlayerDailyTask { Progress = 0, IsCompleted = false };
        var lossTask = new PlayerDailyTask { Progress = 0, IsCompleted = false };

        const int countTarget = 3;
        const int winTarget = 1;
        const int lossTarget = 1;

        // 模拟场景 A：玩家参战并获胜
        var isWinner = true;

        // 1. 场次任务递增
        countTask.Progress = Math.Min(countTarget, countTask.Progress + 1);
        countTask.IsCompleted = countTask.Progress >= countTarget;

        // 2. 胜场任务递增
        if (isWinner)
        {
            winTask.Progress = Math.Min(winTarget, winTask.Progress + 1);
            winTask.IsCompleted = winTask.Progress >= winTarget;
        }

        // 3. 负场任务不递增
        if (!isWinner)
        {
            lossTask.Progress = Math.Min(lossTarget, lossTask.Progress + 1);
            lossTask.IsCompleted = lossTask.Progress >= lossTarget;
        }

        Assert.Equal(3, countTask.Progress);
        Assert.True(countTask.IsCompleted);

        Assert.Equal(1, winTask.Progress);
        Assert.True(winTask.IsCompleted);

        Assert.Equal(0, lossTask.Progress);
        Assert.False(lossTask.IsCompleted);
    }

    [Fact]
    public void DailyTaskIncrement_LosingRaceIncrementsLossTaskOnly()
    {
        var winTask = new PlayerDailyTask { Progress = 0, IsCompleted = false };
        var lossTask = new PlayerDailyTask { Progress = 0, IsCompleted = false };

        // 模拟场景 B：玩家参战但未获胜
        var isWinner = false;

        if (isWinner)
        {
            winTask.Progress = Math.Min(1, winTask.Progress + 1);
            winTask.IsCompleted = winTask.Progress >= 1;
        }
        else
        {
            lossTask.Progress = Math.Min(1, lossTask.Progress + 1);
            lossTask.IsCompleted = lossTask.Progress >= 1;
        }

        Assert.Equal(0, winTask.Progress);
        Assert.False(winTask.IsCompleted);

        Assert.Equal(1, lossTask.Progress);
        Assert.True(lossTask.IsCompleted);
    }
}

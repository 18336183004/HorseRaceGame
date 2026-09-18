using System.ComponentModel.DataAnnotations.Schema;
using RaceGame.Domain.Enums;

namespace RaceGame.Domain.Entities;

public class RaceRound
{
    public long Id { get; set; }

    public string RoundNo { get; set; } = string.Empty;

    public RaceState State { get; set; } = RaceState.Betting;

    public DateTime BettingStartAt { get; set; }

    public DateTime BettingEndAt { get; set; }

    public DateTime? PrepareStartAt { get; set; }

    public DateTime? RaceStartAt { get; set; }

    public DateTime? RaceEndAt { get; set; }

    public DateTime? SettlementAt { get; set; }

    public DateTime? CancelledAt { get; set; }

    public string? CancelReason { get; set; }

    public int? WinnerHorseNo { get; set; }

    /// <summary>第二名（亚军）赛马编号 (1~6)。</summary>
    public int? SecondHorseNo { get; set; }

    /// <summary>本轮冲线是否触发了冠亚军鼻尖微距绝杀 (Photo Finish)。</summary>
    public bool IsPhotoFinish { get; set; }

    /// <summary>第一名与第二名完赛时间差（秒）。</summary>
    public decimal? PhotoFinishGapSeconds { get; set; }

    /// <summary>服务端生成的本轮结构化赛况解说台本文本 JSON。</summary>
    public string? CommentaryScriptJson { get; set; }

    /// <summary>本轮是否触发了全服超级大爆奖。</summary>
    public bool JackpotDropped { get; set; }

    /// <summary>本轮爆出的全服超级大奖总金额。</summary>
    public decimal JackpotDropAmount { get; set; }

    /// <summary>当期冠亚军连赢组合代码，例如 "2-4"。若未完赛则为 null。</summary>
    [NotMapped]
    public string? QuinellaCombination => WinnerHorseNo.HasValue && SecondHorseNo.HasValue
        ? $"{Math.Min(WinnerHorseNo.Value, SecondHorseNo.Value)}-{Math.Max(WinnerHorseNo.Value, SecondHorseNo.Value)}"
        : null;

    public int BetCount { get; set; }

    public decimal TotalBetAmount { get; set; }

    /// <summary>当轮浮动彩池可赔付金额容量。</summary>
    public decimal PayoutPoolAmount { get; set; }

    /// <summary>当轮赔率稀释因子（<= 1.0，1.0 代表无需稀释）。</summary>
    public decimal DilutionFactor { get; set; } = 1.0m;

    public int BettingDurationSeconds { get; set; } = 180;

    public int PrepareDurationSeconds { get; set; } = 15;

    public int RaceDurationSeconds { get; set; } = 30;

    /// <summary>等待本轮结算完成后，距离下一轮开始的间隔秒数。</summary>
    /// <remarks>与数据库 race_rounds.post_race_interval_seconds 及 EF Core 映射保持一致。</remarks>
    public int PostRaceIntervalSeconds { get; set; } = 75;

    /// <summary>赛场天气：SUNNY (晴天), RAINY (雨天), CLOUDY (阴天)</summary>
    public string Weather { get; set; } = "SUNNY";

    /// <summary>赛道类型：TURF (草地), DIRT (泥地), SAND (沙地)</summary>
    public string TrackType { get; set; } = "TURF";

    public string? OddsAlgorithmVersion { get; set; }

    public string? ResultAlgorithmVersion { get; set; }

    public string? BlackHorseAlgorithmVersion { get; set; }

    public string? SettlementVersion { get; set; }

    public string? ResultSeed { get; set; }

    public string? ResultSeedCommitment { get; set; }

    public string? SelectedHorseSnapshotJson { get; set; }

    public string? OddsSnapshotJson { get; set; }

    /// <summary>15 组连赢组合赔率快照 JSON。</summary>
    public string? QuinellaOddsSnapshotJson { get; set; }

    public string? BlackHorseSnapshotJson { get; set; }

    public string? ResultJson { get; set; }

    public string? RoundRuleSnapshotJson { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    public List<RaceHorse> Horses { get; set; } = [];

    [NotMapped]
    public string? AlgorithmVersion
    {
        get => ResultAlgorithmVersion;
        set => ResultAlgorithmVersion = value;
    }
}

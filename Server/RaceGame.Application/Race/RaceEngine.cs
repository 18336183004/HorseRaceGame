using System.Buffers.Binary;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json.Serialization;
using RaceGame.Domain.Constants;
using RaceGame.Domain.Entities;

namespace RaceGame.Application.Race;

/// <summary>一匹参赛马在轮次创建时锁定的历史统计与赔率。</summary>
public record RoundHorseEntry(
    long HorseCatalogId,
    decimal Odds,
    long TotalRaces,
    decimal WinRate,
    decimal Rank1Probability,
    decimal Rank2Probability,
    decimal Rank3Probability,
    decimal Rank4Probability,
    decimal Rank5Probability,
    decimal Rank6Probability);

/// <summary>单匹马最终名次与动画参数。</summary>
public record HorseResult(
    int HorseNo,
    long HorseTemplateId,
    int FinalRank,
    decimal FinishTime,
    int AnimationSeed,
    bool IsBlackHorse,
    int BlackHorseHitCount);

/// <summary>黑马算法的触发、候选命中和最终结果快照。</summary>
public record BlackHorseDecision(
    bool Triggered,
    decimal TriggerProbability,
    long? HorseTemplateId,
    Dictionary<long, int> HitCounts);

/// <summary>经典街机连赢（Quinella）15 组合中单项组合赔率快照。</summary>
public record QuinellaOddEntry(
    [property: JsonPropertyName("combination")] string Combination,
    [property: JsonPropertyName("horse1")] int Horse1,
    [property: JsonPropertyName("horse2")] int Horse2,
    [property: JsonPropertyName("odds")] decimal Odds);

/// <summary>位置/秀选（跑入前二）单马赔率快照条目。</summary>
public record PlaceOddEntry(
    [property: JsonPropertyName("horseNo")] int HorseNo,
    [property: JsonPropertyName("odds")] decimal Odds);

/// <summary>二连单（精准冠亚军排序）组合赔率快照条目。</summary>
public record ExactaOddEntry(
    [property: JsonPropertyName("combination")] string Combination,
    [property: JsonPropertyName("horse1")] int Horse1,
    [property: JsonPropertyName("horse2")] int Horse2,
    [property: JsonPropertyName("odds")] decimal Odds);

/// <summary>赛况解说台本单句条目。</summary>
public record CommentaryEntry(
    [property: JsonPropertyName("second")] int Second,
    [property: JsonPropertyName("phase")] string Phase,
    [property: JsonPropertyName("textZh")] string TextZh,
    [property: JsonPropertyName("textEn")] string TextEn,
    [property: JsonPropertyName("soundCue")] string? SoundCue);

/// <summary>完整赛果以及可复核所需的算法与种子信息。</summary>
public record RaceResult(
    long RoundId,
    string Seed,
    string AlgorithmVersion,
    string BlackHorseAlgorithmVersion,
    BlackHorseDecision BlackHorse,
    List<HorseResult> Results,
    bool IsPhotoFinish = false,
    decimal PhotoFinishGapSeconds = 0m,
    List<CommentaryEntry>? CommentaryScript = null)
{
    /// <summary>第一名（冠军）马号。</summary>
    public int WinnerHorseNo => Results.First(x => x.FinalRank == 1).HorseNo;

    /// <summary>第二名（亚军）马号。</summary>
    public int SecondHorseNo => Results.First(x => x.FinalRank == 2).HorseNo;

    /// <summary>连赢中奖组合键，格式形如 "2-4"。</summary>
    public string QuinellaCombination => $"{Math.Min(WinnerHorseNo, SecondHorseNo)}-{Math.Max(WinnerHorseNo, SecondHorseNo)}";

    /// <summary>二连单中奖组合键，格式形如 "2-4"（严格冠-亚）。</summary>
    public string ExactaCombination => $"{WinnerHorseNo}-{SecondHorseNo}";
}

/// <summary>
/// 根据轮次锁定的历史统计和算法版本计算赔率并生成确定性赛果。
/// 该类型不访问数据库，所有输入必须由服务端持久化流程准备并保存快照。
/// </summary>
public sealed class RaceEngine
{
    /// <summary>构建六匹参赛马的相对赔率和历史统计快照，并根据赛道类型和天气环境计算自适应修正。</summary>
    public IReadOnlyList<RoundHorseEntry> BuildRoundHorseEntries(
        IReadOnlyCollection<HorseCatalog> horses,
        string? trackType = null,
        string? weather = null,
        decimal trackBonusRate = 1.08m,
        decimal weatherBonusRate = 1.08m,
        (decimal r1, decimal r2, decimal r3, decimal r4, decimal r5, decimal r6, decimal wr)? weights = null)
    {
        var w = weights ?? (6m, 5m, 4m, 3m, 2m, 1m, 6m);
        var entries = horses
            .Select(horse =>
            {
                var rank1 = NormalizeProbability(horse.TotalRaces, horse.Rank1Probability);
                var rank2 = NormalizeProbability(horse.TotalRaces, horse.Rank2Probability);
                var rank3 = NormalizeProbability(horse.TotalRaces, horse.Rank3Probability);
                var rank4 = NormalizeProbability(horse.TotalRaces, horse.Rank4Probability);
                var rank5 = NormalizeProbability(horse.TotalRaces, horse.Rank5Probability);
                var rank6 = NormalizeProbability(horse.TotalRaces, horse.Rank6Probability);
                var winRate = NormalizeProbability(horse.TotalRaces, horse.WinRate);

                var baseScore = ComputePerformanceScore(rank1, rank2, rank3, rank4, rank5, rank6, winRate, w);
                var trackBonus = (!string.IsNullOrWhiteSpace(trackType) && string.Equals(horse.PreferredTrack, trackType, StringComparison.OrdinalIgnoreCase)) ? trackBonusRate : 1.0m;
                var weatherBonus = (!string.IsNullOrWhiteSpace(weather) && string.Equals(horse.PreferredWeather, weather, StringComparison.OrdinalIgnoreCase)) ? weatherBonusRate : 1.0m;
                var score = baseScore * trackBonus * weatherBonus;

                return new
                {
                    horse.Id,
                    horse.TotalRaces,
                    WinRate = winRate,
                    Rank1 = rank1,
                    Rank2 = rank2,
                    Rank3 = rank3,
                    Rank4 = rank4,
                    Rank5 = rank5,
                    Rank6 = rank6,
                    Score = score,
                };
            })
            .ToList();

        var totalScore = entries.Sum(x => x.Score);
        if (totalScore <= 0m)
        {
            totalScore = entries.Count;
        }

        return entries
            .Select(x =>
            {
                var probability = totalScore <= 0m ? 1m / entries.Count : x.Score / totalScore;
                var odds = probability <= 0m ? 1m : Math.Round(1m / probability, 6, MidpointRounding.AwayFromZero);

                return new RoundHorseEntry(
                    x.Id,
                    odds,
                    x.TotalRaces,
                    x.WinRate,
                    x.Rank1,
                    x.Rank2,
                    x.Rank3,
                    x.Rank4,
                    x.Rank5,
                    x.Rank6);
            })
            .ToList();
    }

    /// <summary>
    /// 根据 6 匹马锁定的胜率与前二概率确定性派生 15 组经典街机二连碰（Quinella）组合赔率。
    /// 组合以 min-max 格式排序，热门配对赔率较低，双黑马组合赔率可达数百至一千倍。
    /// </summary>
    public IReadOnlyList<QuinellaOddEntry> BuildQuinellaOdds(IReadOnlyList<RoundHorseEntry> horseEntries, decimal payoutRatio = 0.86m)
    {
        var quinellaList = new List<QuinellaOddEntry>(15);

        for (var i = 1; i <= 5; i++)
        {
            var entryA = horseEntries[i - 1];
            var probA = Math.Clamp(entryA.WinRate, 0.02m, 0.60m);

            for (var j = i + 1; j <= 6; j++)
            {
                var entryB = horseEntries[j - 1];
                var probB = Math.Clamp(entryB.WinRate, 0.02m, 0.60m);

                // 联合连赢概率估算: P(A 冠 B 亚) + P(B 冠 A 亚)
                var jointProb = (probA * (probB / Math.Max(0.1m, 1m - probA))) +
                                (probB * (probA / Math.Max(0.1m, 1m - probB)));
                jointProb = Math.Clamp(jointProb, 0.0008m, 0.45m);

                var rawOdds = payoutRatio / jointProb;
                // 对齐街机经典倍率梯度：低倍率保留1位小数，高倍率取整
                decimal finalOdds;
                if (rawOdds < 10m)
                {
                    finalOdds = Math.Round(Math.Max(rawOdds, 2.0m), 1);
                }
                else if (rawOdds < 100m)
                {
                    finalOdds = Math.Round(rawOdds);
                }
                else
                {
                    finalOdds = Math.Min(1000m, Math.Round(rawOdds / 5m) * 5m);
                }

                quinellaList.Add(new QuinellaOddEntry(
                    Combination: $"{i}-{j}",
                    Horse1: i,
                    Horse2: j,
                    Odds: finalOdds));
            }
        }

        return quinellaList;
    }

    /// <summary>
    /// 使用轮次快照和可选的服务端随机盐生成一次确定性的 1～6 名结果。
    /// 种子由轮次编号、数据库 ID、算法版本以及下注截止时生成的加密随机盐组成，
    /// 既保证下注期内无法预知结果，又支持在结算公开后跨服务实例复核。
    /// </summary>
    public RaceResult Generate(
        RaceRound round,
        string? secretSalt = null,
        decimal photoFinishThresholdSeconds = 0.1800m,
        decimal photoFinishProbability = 0.35m,
        decimal blackHorseBoostMultiplier = 2.0m,
        IReadOnlyList<RaceCommentaryTemplate>? commentaryTemplates = null)
    {
        var orderedHorses = round.Horses.OrderBy(x => x.HorseNo).ToList();
        if (orderedHorses.Count != GameRuleDefaults.HorseCountPerRound)
        {
            throw new InvalidOperationException("赛果生成要求当前轮次必须存在6匹马");
        }

        var resultVersion = round.ResultAlgorithmVersion ?? GameBusinessCodes.DefaultResultAlgorithmVersion;
        var blackHorseVersion = round.BlackHorseAlgorithmVersion ?? GameBusinessCodes.DefaultBlackHorseAlgorithmVersion;
        var seed = string.IsNullOrWhiteSpace(secretSalt)
            ? $"{round.RoundNo}:{round.Id}:{resultVersion}"
            : $"{round.RoundNo}:{round.Id}:{resultVersion}:{secretSalt.Trim()}";
        var rng = new Random(GetDeterministicSeed(seed));
        var blackHorse = DetermineBlackHorse(orderedHorses, rng);

        var remaining = orderedHorses.ToList();
        var results = new List<HorseResult>(orderedHorses.Count);

        var isPhotoFinishRoll = rng.NextDouble() < (double)photoFinishProbability; // 动态几率产生胶卷绝杀微差剧本
        decimal rank1Time = 0m;

        for (var rank = 1; rank <= orderedHorses.Count; rank++)
        {
            var winner = PickWeightedHorse(remaining, blackHorse.HorseTemplateId, rng, rank, blackHorseBoostMultiplier);
            remaining.Remove(winner);

            var finishTime = BuildFinishTime(rank, round.RaceDurationSeconds, rng, isPhotoFinishRoll, rank1Time);
            if (rank == 1)
            {
                rank1Time = finishTime;
            }

            results.Add(new HorseResult(
                winner.HorseNo,
                winner.HorseTemplateId,
                rank,
                finishTime,
                rng.Next(),
                blackHorse.HorseTemplateId == winner.HorseTemplateId,
                blackHorse.HitCounts.TryGetValue(winner.HorseTemplateId, out var hitCount) ? hitCount : 0));
        }

        var winnerNo = results.First(x => x.FinalRank == 1).HorseNo;
        var secondNo = results.First(x => x.FinalRank == 2).HorseNo;
        var r1Time = results.First(x => x.FinalRank == 1).FinishTime;
        var r2Time = results.First(x => x.FinalRank == 2).FinishTime;
        var gap = Math.Round(Math.Abs(r2Time - r1Time), 4);
        var threshold = photoFinishThresholdSeconds > 0 ? photoFinishThresholdSeconds : 0.1800m;
        var isPhotoFinish = gap <= threshold;

        var commentary = BuildCommentaryScript(winnerNo, secondNo, round.Weather, round.TrackType, isPhotoFinish, commentaryTemplates);

        return new RaceResult(round.Id, seed, resultVersion, blackHorseVersion, blackHorse, results, isPhotoFinish, gap, commentary);
    }

    private static BlackHorseDecision DetermineBlackHorse(IReadOnlyList<RaceHorse> horses, Random rng)
    {
        var orderedByWinRate = horses.OrderByDescending(x => x.WinRateSnapshot).ThenBy(x => x.HorseNo).ToList();
        var candidates = orderedByWinRate.Skip(3).Take(3).ToList();
        var oddWinRateSum = (orderedByWinRate.Count > 0 ? orderedByWinRate[0].WinRateSnapshot : 0m)
            + (orderedByWinRate.Count > 2 ? orderedByWinRate[2].WinRateSnapshot : 0m)
            + (orderedByWinRate.Count > 4 ? orderedByWinRate[4].WinRateSnapshot : 0m);
        var evenWinRateSum = (orderedByWinRate.Count > 1 ? orderedByWinRate[1].WinRateSnapshot : 0m)
            + (orderedByWinRate.Count > 3 ? orderedByWinRate[3].WinRateSnapshot : 0m)
            + (orderedByWinRate.Count > 5 ? orderedByWinRate[5].WinRateSnapshot : 0m);
        var triggerProbability = Math.Min(1m, Math.Abs(oddWinRateSum - evenWinRateSum));
        var triggered = rng.NextDouble() < (double)triggerProbability;
        var hitCounts = candidates.ToDictionary(x => x.HorseTemplateId, _ => 0);

        if (!triggered || candidates.Count == 0)
        {
            return new BlackHorseDecision(false, triggerProbability, null, hitCounts);
        }

        for (var i = 0; i < 1000; i++)
        {
            var pickedIndex = rng.Next(0, candidates.Count);
            var pickedHorseId = candidates[pickedIndex].HorseTemplateId;
            hitCounts[pickedHorseId]++;
        }

        var blackHorseId = hitCounts
            .OrderByDescending(x => x.Value)
            .ThenBy(x => x.Key)
            .First()
            .Key;

        return new BlackHorseDecision(true, triggerProbability, blackHorseId, hitCounts);
    }

    private static RaceHorse PickWeightedHorse(
        IReadOnlyCollection<RaceHorse> horses,
        long? blackHorseTemplateId,
        Random rng,
        int currentRank,
        decimal blackHorseBoostMultiplier = 2.0m)
    {
        var weighted = horses
            .Select(horse =>
            {
                var weight = ComputePerformanceScore(
                    horse.Rank1ProbabilitySnapshot,
                    horse.Rank2ProbabilitySnapshot,
                    horse.Rank3ProbabilitySnapshot,
                    horse.Rank4ProbabilitySnapshot,
                    horse.Rank5ProbabilitySnapshot,
                    horse.Rank6ProbabilitySnapshot,
                    horse.WinRateSnapshot);

                if (blackHorseTemplateId == horse.HorseTemplateId && currentRank == 1)
                {
                    weight *= Math.Max(1.0m, blackHorseBoostMultiplier);
                }

                return new { Horse = horse, Weight = Math.Max(weight, 0.000001m) };
            })
            .ToList();

        var totalWeight = weighted.Sum(x => x.Weight);
        var roll = (decimal)rng.NextDouble() * totalWeight;
        var cursor = 0m;

        foreach (var item in weighted)
        {
            cursor += item.Weight;
            if (roll <= cursor)
            {
                return item.Horse;
            }
        }

        return weighted[^1].Horse;
    }

    private static decimal ComputePerformanceScore(
        decimal rank1,
        decimal rank2,
        decimal rank3,
        decimal rank4,
        decimal rank5,
        decimal rank6,
        decimal winRate,
        (decimal r1, decimal r2, decimal r3, decimal r4, decimal r5, decimal r6, decimal wr)? weights = null)
    {
        var w = weights ?? (6m, 5m, 4m, 3m, 2m, 1m, 6m);
        var score =
            rank1 * w.r1 +
            rank2 * w.r2 +
            rank3 * w.r3 +
            rank4 * w.r4 +
            rank5 * w.r5 +
            rank6 * w.r6 +
            winRate * w.wr;

        return Math.Max(score, 0.000001m);
    }

    private static decimal NormalizeProbability(long totalRaces, decimal currentValue)
    {
        if (currentValue > 0m)
        {
            return currentValue;
        }

        return totalRaces <= 0 ? 1m / 6m : 0m;
    }

    private static decimal BuildFinishTime(int rank, int raceDurationSeconds, Random rng, bool isPhotoFinishCandidate, decimal rank1BaseTime)
    {
        // 依据当前轮次配置的比赛时长自适应缩放完赛时间，确保第一名在 90% 时长左右冲线
        var duration = raceDurationSeconds > 0 ? (decimal)raceDurationSeconds : (decimal)GameRuleDefaults.RaceDurationSeconds;
        if (rank == 1)
        {
            var baseTime = duration * 0.90m;
            var jitter = (decimal)rng.NextDouble() * (duration * 0.005m);
            return Math.Round(Math.Min(baseTime + jitter, duration - 0.2m), 4, MidpointRounding.AwayFromZero);
        }

        if (rank == 2 && isPhotoFinishCandidate)
        {
            // 逼真微距绝杀：第二名与第一名差距在 0.02s ~ 0.15s 之间
            var gap = 0.02m + ((decimal)rng.NextDouble() * 0.13m);
            return Math.Round(Math.Min(rank1BaseTime + gap, duration - 0.15m), 4, MidpointRounding.AwayFromZero);
        }

        var step = duration * 0.014m;
        var rJitter = (decimal)rng.NextDouble() * (duration * 0.008m);
        var time = (rank1BaseTime > 0 ? rank1BaseTime : duration * 0.90m) + ((rank - 1) * step) + rJitter;
        time = Math.Min(time, duration - 0.1m);
        return Math.Round(time, 4, MidpointRounding.AwayFromZero);
    }

    /// <summary>生成结构化赛况解说台本（优先从数据库台本模板匹配，无匹配时安全回退默认）。</summary>
    public static List<CommentaryEntry> BuildCommentaryScript(
        int winnerNo,
        int secondNo,
        string? weather,
        string? trackType,
        bool isPhotoFinish,
        IReadOnlyList<RaceCommentaryTemplate>? templates = null)
    {
        if (templates != null && templates.Count > 0)
        {
            var result = new List<CommentaryEntry>();
            var phases = new[] { "START", "TURN", "STRETCH", "FINISH" };
            foreach (var phase in phases)
            {
                var candidates = templates
                    .Where(x => x.Phase.Equals(phase, StringComparison.OrdinalIgnoreCase) && x.IsEnabled)
                    .ToList();

                RaceCommentaryTemplate? chosen = null;
                if (phase == "START" && !string.IsNullOrWhiteSpace(weather))
                {
                    chosen = candidates.FirstOrDefault(x => string.Equals(x.WeatherCondition, weather, StringComparison.OrdinalIgnoreCase));
                }
                else if (phase == "FINISH")
                {
                    chosen = candidates.FirstOrDefault(x => x.IsPhotoFinish == isPhotoFinish);
                }

                chosen ??= candidates.FirstOrDefault();
                if (chosen != null)
                {
                    var textZh = chosen.TextZh.Replace("{winnerNo}", winnerNo.ToString()).Replace("{secondNo}", secondNo.ToString());
                    var textEn = chosen.TextEn.Replace("{winnerNo}", winnerNo.ToString()).Replace("{secondNo}", secondNo.ToString());
                    result.Add(new CommentaryEntry(chosen.TriggerSecond, chosen.Phase, textZh, textEn, chosen.SoundCue));
                }
            }

            if (result.Count == 4)
            {
                return result;
            }
        }

        var weatherTextZh = (weather?.ToUpperInvariant()) switch
        {
            "RAINY" => "雨水浸湿了泥泞跑道，马蹄激荡飞沙！",
            "CLOUDY" => "阴云密布，赛道硬朗，是一决胜负的好天气！",
            _ => "烈日灼烧荒野，漫天尘沙伴随着号角吹响！"
        };
        var weatherTextEn = (weather?.ToUpperInvariant()) switch
        {
            "RAINY" => "Rain soaks the muddy track, sand spraying with every stride!",
            "CLOUDY" => "Overcast skies with a firm track, primed for a showdown!",
            _ => "Blazing sun over the dusty frontier as the trumpet sounds!"
        };

        return
        [
            new(1, "START", $"闸门弹开！{weatherTextZh} 各驹如离弦之箭冲出起点！", $"Gates burst open! {weatherTextEn} The field surges forward!", "commentary_start"),
            new(15, "TURN", $"转入决胜大弯道！冲刺加倍窗口开启！{secondNo}号紧咬内道，各骑师起鞭发力！", $"Sweeping into the final turn! In-play boost active! Horse #{secondNo} attacks the inside rail!", "commentary_turn"),
            new(25, "STRETCH", $"进入最后直道！全体起势！{winnerNo}号外侧强行超车，全场马匹全速爆发！", $"The home stretch! Horse #{winnerNo} unleashes a blistering sprint from the outside!", "commentary_stretch"),
            new(28, "FINISH", isPhotoFinish
                ? $"终点线！双方并驾齐驱！鼻尖微差绝杀！谁才是最后的王者？！"
                : $"冲过终点线！{winnerNo}号一马当先锁定胜局！",
                isPhotoFinish
                ? $"Neck and neck at the wire! Incredible photo finish! Who took the glory?!"
                : $"Across the finish line! Horse #{winnerNo} seals an emphatic victory!",
                isPhotoFinish ? "commentary_photofinish" : "commentary_finish")
        ];
    }

    /// <summary>根据 6 匹马锁定的前二概率构建位置/秀选（跑入前二）单马赔率快照。</summary>
    public IReadOnlyList<PlaceOddEntry> BuildPlaceOdds(IReadOnlyList<RoundHorseEntry> horseEntries, decimal payoutRatio = 0.88m)
    {
        var list = new List<PlaceOddEntry>(6);
        for (var i = 1; i <= 6; i++)
        {
            var entry = horseEntries[i - 1];
            var prob = Math.Clamp(entry.Rank1Probability + entry.Rank2Probability, 0.10m, 0.85m);
            var rawOdds = payoutRatio / prob;
            var finalOdds = Math.Round(Math.Clamp(rawOdds, 1.10m, 5.00m), 2);
            list.Add(new PlaceOddEntry(i, finalOdds));
        }
        return list;
    }

    /// <summary>构建 30 组二连单（Exacta，区分严格冠亚军排序）赔率快照。</summary>
    public IReadOnlyList<ExactaOddEntry> BuildExactaOdds(IReadOnlyList<RoundHorseEntry> horseEntries, decimal payoutRatio = 0.84m)
    {
        var list = new List<ExactaOddEntry>(30);
        for (var i = 1; i <= 6; i++)
        {
            var entryA = horseEntries[i - 1];
            var probA = Math.Clamp(entryA.WinRate, 0.02m, 0.60m);
            for (var j = 1; j <= 6; j++)
            {
                if (i == j) continue;
                var entryB = horseEntries[j - 1];
                var probB = Math.Clamp(entryB.WinRate, 0.02m, 0.60m);
                var exactaProb = probA * (probB / Math.Max(0.1m, 1m - probA));
                exactaProb = Math.Clamp(exactaProb, 0.0004m, 0.35m);
                var rawOdds = payoutRatio / exactaProb;
                decimal finalOdds;
                if (rawOdds < 10m)
                {
                    finalOdds = Math.Round(Math.Max(rawOdds, 2.5m), 1);
                }
                else if (rawOdds < 100m)
                {
                    finalOdds = Math.Round(rawOdds);
                }
                else
                {
                    finalOdds = Math.Min(500m, Math.Round(rawOdds / 5m) * 5m);
                }
                list.Add(new ExactaOddEntry($"{i}-{j}", i, j, finalOdds));
            }
        }
        return list;
    }

    private static int GetDeterministicSeed(string input)
    {
        var bytes = SHA256.HashData(Encoding.UTF8.GetBytes(input));
        // 明确采用 Little Endian，避免不同 CPU 架构上的 BitConverter 端序差异。
        return BinaryPrimitives.ReadInt32LittleEndian(bytes.AsSpan(0, sizeof(int)));
    }
}

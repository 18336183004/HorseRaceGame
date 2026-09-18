using System.Text.Json;
using RaceGame.Domain.Entities;
using RaceGame.Application.Abstractions;

namespace RaceGame.Application.Audit;

/// <summary>
/// 将比赛、马匹和角色日志分域写入数据库。
/// 业务调用方只提供已经确定的业务数据，JSON 仅作为不可变事件快照，不承担当前状态。
/// </summary>
public sealed class GameLogService(IGameDbContext db)
{
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    /// <summary>记录一条比赛级事件。</summary>
    public void AddRaceLog(
        RaceRound round,
        string eventType,
        string executionStatus,
        object? payload = null,
        string? requestId = null)
    {
        db.RaceLogs.Add(new RaceLog
        {
            RoundId = round.Id,
            RoundNo = round.RoundNo,
            EventType = eventType,
            State = (int)round.State,
            ExecutionStatus = executionStatus,
            RequestId = requestId,
            PayloadJson = Serialize(payload),
            CreatedAt = DateTime.UtcNow,
        });
    }

    /// <summary>记录一条单匹马事件。</summary>
    public void AddHorseLog(
        RaceHorse horse,
        string eventType,
        string executionStatus,
        object? payload = null)
    {
        db.HorseLogs.Add(new HorseLog
        {
            RoundId = horse.RoundId,
            RaceHorseId = horse.Id == 0 ? null : horse.Id,
            HorseTemplateId = horse.HorseTemplateId,
            HorseNo = horse.HorseNo,
            EventType = eventType,
            ExecutionStatus = executionStatus,
            PayloadJson = Serialize(payload),
            CreatedAt = DateTime.UtcNow,
        });
    }

    /// <summary>记录一条玩家角色事件。</summary>
    public void AddCharacterLog(
        long playerId,
        long characterId,
        long? playerCharacterId,
        string eventType,
        string executionStatus,
        object? payload = null)
    {
        db.CharacterLogs.Add(new CharacterLog
        {
            PlayerId = playerId,
            CharacterId = characterId,
            PlayerCharacterId = playerCharacterId,
            EventType = eventType,
            ExecutionStatus = executionStatus,
            PayloadJson = Serialize(payload),
            CreatedAt = DateTime.UtcNow,
        });
    }

    /// <summary>统一序列化日志快照，避免各业务模块自行拼接 JSON。</summary>
    private static string? Serialize(object? payload)
    {
        return payload is null ? null : JsonSerializer.Serialize(payload, JsonOptions);
    }
}

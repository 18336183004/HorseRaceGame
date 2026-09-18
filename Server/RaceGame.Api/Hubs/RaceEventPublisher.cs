using System.Text.Json;
using Microsoft.AspNetCore.SignalR;
using RaceGame.Application.Realtime;
using RaceGame.Infrastructure.Redis;

namespace RaceGame.Api.Hubs;

/// <summary>
/// 赛况事件发布器。同时向本地客户端广播并发布至 Redis Pub/Sub，支撑单体与分布式多实例部署。
/// </summary>
public sealed class RaceEventPublisher(
    IHubContext<RaceHub> hub,
    IRedisService redis,
    ILogger<RaceEventPublisher> logger) : IRaceEventPublisher
{
    public async Task PublishAsync(long roundId, string eventName, object payload, CancellationToken cancellationToken = default)
    {
        // 1. 本机在线长连接广播：新轮次产生、提前开赛或全服停服维护时广播给全服在线玩家；轮内事件推送给当前轮次分组。
        var isGlobalBroadcast = eventName == "RaceBettingStarted" || eventName == "SystemMaintenanceKick" || eventName == "RaceBettingFastForward" || roundId == 0L;
        var clients = isGlobalBroadcast ? hub.Clients.All : hub.Clients.Group(RaceHub.GroupName(roundId));
        await clients.SendAsync(eventName, payload, cancellationToken);

        // 2. Redis Pub/Sub 发布，用于多实例分布式部署时跨节点同步
        try
        {
            var json = JsonSerializer.Serialize(new
            {
                roundId,
                eventName,
                payload,
                publishedAt = DateTime.UtcNow,
            });
            await redis.PublishAsync("race:events", json);
        }
        catch (Exception ex)
        {
            logger.LogWarning(ex, "发布 race:events 到 Redis 失败，已通过本地 SignalR 广播保底");
        }
    }
}

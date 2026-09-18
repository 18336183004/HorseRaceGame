namespace RaceGame.Application.Realtime;

/// <summary>轮次状态事件发布抽象；Application 不依赖 SignalR，API 负责具体传输实现。</summary>
public interface IRaceEventPublisher
{
    Task PublishAsync(long roundId, string eventName, object payload, CancellationToken cancellationToken = default);
}

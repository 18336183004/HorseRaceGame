using StackExchange.Redis;

namespace RaceGame.Infrastructure.Redis;

public interface IRedisService
{
    Task SetAsync(string key, string value, TimeSpan? expiry = null);
    Task<string?> GetAsync(string key);
    Task<bool> AcquireLockAsync(string key, string token, TimeSpan expiry);
    Task<bool> RenewLockAsync(string key, string token, TimeSpan expiry);
    Task<bool> ReleaseLockAsync(string key, string token);
    Task PublishAsync(string channel, string message);
    Task SubscribeAsync(string channel, Action<string, string> handler);
}

/// <summary>Redis 基础服务；锁使用 token 校验，避免误释放其他实例持有的锁。</summary>
public sealed class RedisService(IConnectionMultiplexer redis) : IRedisService
{
    private const string RenewScript = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('pexpire', KEYS[1], ARGV[2]) else return 0 end";
    private const string ReleaseScript = "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end";

    public Task SetAsync(string key, string value, TimeSpan? expiry = null)
        => redis.GetDatabase().StringSetAsync(key, value, expiry);

    public async Task<string?> GetAsync(string key)
        => await redis.GetDatabase().StringGetAsync(key);

    public Task<bool> AcquireLockAsync(string key, string token, TimeSpan expiry)
        => redis.GetDatabase().StringSetAsync(key, token, expiry, When.NotExists);

    public async Task<bool> RenewLockAsync(string key, string token, TimeSpan expiry)
    {
        var result = await redis.GetDatabase().ScriptEvaluateAsync(
            RenewScript,
            new RedisKey[] { key },
            new RedisValue[] { token, (long)expiry.TotalMilliseconds });
        return (long)result == 1;
    }

    public async Task<bool> ReleaseLockAsync(string key, string token)
    {
        var result = await redis.GetDatabase().ScriptEvaluateAsync(
            ReleaseScript,
            new RedisKey[] { key },
            new RedisValue[] { token });
        return (long)result == 1;
    }

    public Task PublishAsync(string channel, string message)
        => redis.GetSubscriber().PublishAsync(RedisChannel.Literal(channel), message);

    public Task SubscribeAsync(string channel, Action<string, string> handler)
        => redis.GetSubscriber().SubscribeAsync(RedisChannel.Literal(channel), (ch, msg) => handler(ch.ToString(), msg.ToString()!));
}

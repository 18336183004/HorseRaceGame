using System.Diagnostics;
using System.Net;
using System.Net.Sockets;

namespace RaceGame.Api.Services;

/// <summary>
/// 本地开发环境 Redis 启动器：API 启动时先确认 6379 已监听；
/// 若没有监听，则优先尝试启动 Windows Redis/Memurai 服务，最后尝试 redis-server.exe。
/// PostgreSQL 不由此组件启动。
/// </summary>
public static class RedisBootstrapper
{
    private static readonly string[] DefaultServiceNames = ["Redis", "RedisStack", "Memurai"];

    public static void EnsureStarted(IConfiguration configuration, ILogger? logger = null)
    {
        var enabled = configuration.GetValue("Redis:AutoStart", true);
        if (!enabled)
        {
            return;
        }

        var endpoint = configuration["Redis:Connection"] ?? "localhost:6379";
        var (host, port) = ParseEndpoint(endpoint);
        var password = configuration["Redis:Password"] ?? string.Empty;

        if (CanConnect(host, port, 500))
        {
            logger?.LogInformation("Redis 已在 {Host}:{Port} 运行。", host, port);
            return;
        }

        logger?.LogInformation("Redis 未监听 {Host}:{Port}，API 尝试自动启动 Redis。", host, port);

        foreach (var serviceName in GetServiceNames(configuration))
        {
            if (TryStartWindowsService(serviceName, logger))
            {
                if (WaitForRedis(host, port, 5000))
                {
                    logger?.LogInformation("已启动 Windows Redis 服务：{ServiceName}。", serviceName);
                    return;
                }
            }
        }

        if (TryStartRedisServer(configuration, host, port, password, logger) && WaitForRedis(host, port, 5000))
        {
            logger?.LogInformation("已启动 redis-server.exe：{Host}:{Port}。", host, port);
            return;
        }

        throw new InvalidOperationException(
            $"Redis 无法自动启动或连接失败：{host}:{port}。请确认 Redis 已安装、Windows 服务可用，" +
            "或在 appsettings.json 中配置 Redis:ExecutablePath / Redis:ConfigPath。PostgreSQL 不受此检查影响。");
    }

    private static IEnumerable<string> GetServiceNames(IConfiguration configuration)
    {
        var configured = configuration.GetSection("Redis:ServiceNames").Get<string[]>();
        return configured is { Length: > 0 } ? configured : DefaultServiceNames;
    }

    private static bool TryStartWindowsService(string serviceName, ILogger? logger)
    {
        try
        {
            using var query = Process.Start(new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = $"query \"{serviceName}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            });
            if (query is null) return false;
            var output = query.StandardOutput.ReadToEnd();
            query.WaitForExit(2000);
            if (query.ExitCode != 0 || !output.Contains("SERVICE_NAME", StringComparison.OrdinalIgnoreCase))
            {
                return false;
            }

            using var start = Process.Start(new ProcessStartInfo
            {
                FileName = "sc.exe",
                Arguments = $"start \"{serviceName}\"",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            });
            if (start is null) return false;
            if (!start.WaitForExit(5000))
            {
                logger?.LogWarning("Windows 服务 {ServiceName} 启动命令超时。", serviceName);
                return false;
            }
            logger?.LogInformation("尝试启动 Windows 服务 {ServiceName}，退出码 {ExitCode}。", serviceName, start.ExitCode);
            return start.ExitCode == 0;
        }
        catch (Exception ex)
        {
            logger?.LogDebug(ex, "启动 Windows Redis 服务 {ServiceName} 失败。", serviceName);
            return false;
        }
    }

    private static bool TryStartRedisServer(IConfiguration configuration, string host, int port, string password, ILogger? logger)
    {
        try
        {
            var executable = configuration["Redis:ExecutablePath"];
            if (string.IsNullOrWhiteSpace(executable))
            {
                executable = FindRedisExecutable();
            }
            if (string.IsNullOrWhiteSpace(executable))
            {
                logger?.LogWarning("未找到 redis-server.exe。请设置 Redis:ExecutablePath。 ");
                return false;
            }

            var configPath = configuration["Redis:ConfigPath"];
            var arguments = string.Empty;
            if (!string.IsNullOrWhiteSpace(configPath))
            {
                arguments = Quote(configPath);
            }
            else
            {
                // 没有配置文件时使用用户指定密码，避免启动出的 Redis 无密码。
                arguments = $"--bind {host} --port {port} --requirepass {Quote(password)}";
            }

            var process = Process.Start(new ProcessStartInfo
            {
                FileName = executable,
                Arguments = arguments,
                WorkingDirectory = Path.GetDirectoryName(executable) ?? AppContext.BaseDirectory,
                UseShellExecute = false,
                CreateNoWindow = true,
            });
            if (process is null) return false;

            logger?.LogInformation("redis-server.exe 已启动，PID={Pid}。", process.Id);
            return true;
        }
        catch (Exception ex)
        {
            logger?.LogWarning(ex, "启动 redis-server.exe 失败。 ");
            return false;
        }
    }

    private static string? FindRedisExecutable()
    {
        var candidates = new List<string>();
        try
        {
            using var process = Process.Start(new ProcessStartInfo
            {
                FileName = "where.exe",
                Arguments = "redis-server.exe",
                UseShellExecute = false,
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                CreateNoWindow = true,
            });
            if (process is not null)
            {
                var output = process.StandardOutput.ReadToEnd();
                process.WaitForExit(2000);
                candidates.AddRange(output.Split(new[] { '\r', '\n' }, StringSplitOptions.RemoveEmptyEntries));
            }
        }
        catch { }

        candidates.AddRange([
            @"C:\Program Files\Redis\redis-server.exe",
            @"C:\Program Files\Redis\redis-server.exe",
            @"C:\Redis\redis-server.exe",
            @"C:\Program Files\Memurai\memurai.exe",
            @"C:\Program Files\Memurai\memurai.exe",
        ]);

        return candidates.FirstOrDefault(File.Exists);
    }

    private static bool WaitForRedis(string host, int port, int timeoutMs)
    {
        var end = DateTime.UtcNow.AddMilliseconds(timeoutMs);
        while (DateTime.UtcNow < end)
        {
            if (CanConnect(host, port, 300)) return true;
            Thread.Sleep(200);
        }
        return false;
    }

    private static bool CanConnect(string host, int port, int timeoutMs)
    {
        try
        {
            using var client = new TcpClient();
            var task = client.ConnectAsync(host, port);
            return task.Wait(timeoutMs) && client.Connected;
        }
        catch
        {
            return false;
        }
    }

    private static (string Host, int Port) ParseEndpoint(string endpoint)
    {
        var value = endpoint.Split(',', 2)[0].Trim();
        var parts = value.Split(':', 2);
        if (parts.Length == 2 && int.TryParse(parts[1], out var port))
            return (parts[0], port);
        return (value, 6379);
    }

    private static string Quote(string value) => $"\"{value.Replace("\"", "\\\"")}\"";
}

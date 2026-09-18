using Microsoft.Extensions.Logging;

namespace RaceGame.Api.Logging;

public sealed class DailyFileLoggerProvider : ILoggerProvider
{
    private readonly string _directory;
    private readonly string _prefix;
    private readonly object _sync = new();

    public DailyFileLoggerProvider(string directory, string prefix)
    {
        _directory = directory;
        _prefix = prefix;
        Directory.CreateDirectory(_directory);
    }

    public ILogger CreateLogger(string categoryName) => new DailyFileLogger(this, categoryName);
    public void Dispose() { }

    private void Write(string category, LogLevel level, EventId eventId, string message, Exception? exception)
    {
        var now = DateTimeOffset.Now;
        var file = Path.Combine(_directory, $"{_prefix}-{now:yyyyMMdd}.log");
        var line = $"{now:yyyy-MM-dd HH:mm:ss.fff zzz} [{level}] {category} ({eventId.Id}) {message}";
        if (exception is not null) line += Environment.NewLine + exception;
        line += Environment.NewLine;
        lock (_sync) File.AppendAllText(file, line, System.Text.Encoding.UTF8);
    }

    private sealed class DailyFileLogger(DailyFileLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception,
            Func<TState, Exception?, string> formatter)
        {
            if (!IsEnabled(logLevel)) return;
            provider.Write(category, logLevel, eventId, formatter(state, exception), exception);
        }
    }
}

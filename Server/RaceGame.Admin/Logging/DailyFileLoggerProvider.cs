using Microsoft.Extensions.Logging;

namespace RaceGame.Admin.Logging;

public sealed class DailyFileLoggerProvider : ILoggerProvider
{
    private readonly string _directory;
    private readonly string _prefix;
    private readonly object _sync = new();
    public DailyFileLoggerProvider(string directory, string prefix) { _directory = directory; _prefix = prefix; Directory.CreateDirectory(directory); }
    public ILogger CreateLogger(string categoryName) => new DailyFileLogger(this, categoryName);
    public void Dispose() { }
    private void Write(string category, LogLevel level, EventId eventId, string message, Exception? ex)
    {
        var now = DateTimeOffset.Now;
        var file = Path.Combine(_directory, $"{_prefix}-{now:yyyyMMdd}.log");
        var text = $"{now:yyyy-MM-dd HH:mm:ss.fff zzz} [{level}] {category} ({eventId.Id}) {message}" + (ex is null ? "" : Environment.NewLine + ex) + Environment.NewLine;
        lock (_sync) File.AppendAllText(file, text, System.Text.Encoding.UTF8);
    }
    private sealed class DailyFileLogger(DailyFileLoggerProvider provider, string category) : ILogger
    {
        public IDisposable? BeginScope<TState>(TState state) where TState : notnull => null;
        public bool IsEnabled(LogLevel logLevel) => logLevel != LogLevel.None;
        public void Log<TState>(LogLevel logLevel, EventId eventId, TState state, Exception? exception, Func<TState, Exception?, string> formatter)
        { if (IsEnabled(logLevel)) provider.Write(category, logLevel, eventId, formatter(state, exception), exception); }
    }
}

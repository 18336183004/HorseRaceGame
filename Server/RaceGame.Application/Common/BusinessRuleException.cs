namespace RaceGame.Application.Common;

/// <summary>
/// 表示由可信服务端业务校验产生、可安全映射为客户端业务错误的异常。
/// <see cref="Code"/> 是稳定错误代码，<see cref="Message"/> 只包含可公开的用户提示。
/// </summary>
public sealed class BusinessRuleException(string code, string message) : InvalidOperationException(message)
{
    /// <summary>获取可供 API 和客户端识别的稳定业务错误代码。</summary>
    public string Code { get; } = code;
}

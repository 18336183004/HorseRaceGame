/**
 * 客户端运行时配置。
 *
 * Cocos Creator 3.8.8 的预览和发布环境可以通过全局配置注入 API 地址，
 * 未注入时仅回退到本机开发地址。业务脚本不得再次硬编码服务端 URL。
 */
export interface ClientRuntimeConfig {
    /** HTTP/SignalR 服务端基础地址，例如 http://localhost:5080。 */
    apiBaseUrl: string;
    /** 客户端业务版本，用于服务端会话和兼容诊断。 */
    clientVersion: string;
}

/**
 * 读取运行时全局配置。
 * 使用 unknown + 类型收窄，避免在客户端配置边界引入 any。
 */
function readGlobalConfig(): Partial<ClientRuntimeConfig> {
    const globalObject = globalThis as unknown as Record<string, unknown>;
    const raw = globalObject["__RACE_GAME_CONFIG__"];

    if (!raw || typeof raw !== "object") {
        return {};
    }

    const value = raw as Record<string, unknown>;
    return {
        apiBaseUrl:
            typeof value.apiBaseUrl === "string" ? value.apiBaseUrl : undefined,
        clientVersion:
            typeof value.clientVersion === "string"
                ? value.clientVersion
                : undefined,
    };
}

/** 当前客户端的统一运行时配置。 */
export const ClientConfig: ClientRuntimeConfig = {
    apiBaseUrl:
        readGlobalConfig().apiBaseUrl?.replace(/\/$/, "") ??
        "http://localhost:55230",
    clientVersion: readGlobalConfig().clientVersion ?? "2.0.0",
};

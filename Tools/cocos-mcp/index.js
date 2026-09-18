#!/usr/bin/env node
/**
 * Cocos Creator 3.8.8 MCP (Model Context Protocol) Server
 * 
 * 遵循 Anthropic Model Context Protocol 规范（JSON-RPC 2.0 over Stdio）。
 * 桥接连接：
 * 1. Cocos 3.8.8 Web 预览服务 (http://localhost:7456)
 * 2. Cocos 3.8.8 编辑器扩展桥接 (http://127.0.0.1:7457)
 * 3. Client 静态资源与场景解析 (Client/assets/Main.scene.scene & scripts)
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const PROJECT_ROOT = path.resolve(__dirname, '..', '..');
const CLIENT_ROOT = path.join(PROJECT_ROOT, 'Client');
const ASSETS_ROOT = path.join(CLIENT_ROOT, 'assets');
const PREVIEW_URL = 'http://localhost:7456';
const BRIDGE_URL = 'http://127.0.0.1:7457';

/** 辅助函数：发起 HTTP GET 请求 */
function httpGet(url, timeoutMs = 2000) {
    return new Promise((resolve) => {
        try {
            const req = http.get(url, { timeout: timeoutMs }, (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    resolve({ ok: res.statusCode >= 200 && res.statusCode < 400, status: res.statusCode, body: data });
                });
            });
            req.on('error', (err) => {
                resolve({ ok: false, error: err.message });
            });
            req.on('timeout', () => {
                req.destroy();
                resolve({ ok: false, error: 'timeout' });
            });
        } catch (e) {
            resolve({ ok: false, error: e.message });
        }
    });
}

/** 工具定义清单 */
const TOOLS = [
    {
        name: 'cocos_check_status',
        description: '检查 Cocos Creator 3.8.8 编辑器与 Web 预览 (http://localhost:7456) 的连接状态与引擎信息',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'cocos_inspect_scene',
        description: '解析项目启动场景 Main.scene.scene 的节点树层次结构与绑定的组件类型',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'cocos_list_scripts',
        description: '获取 Client/assets/scripts 中的所有游戏组件与 DTO 脚本清单',
        inputSchema: {
            type: 'object',
            properties: {
                filter: {
                    type: 'string',
                    description: '可选文件名过滤关键词'
                }
            }
        }
    },
    {
        name: 'cocos_read_client_config',
        description: '读取客户端运行配置 ClientConfig.ts 与 project.json 版本信息',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'cocos_query_preview_html',
        description: '从运行中的 Cocos Web 预览服务 (http://localhost:7456) 拉取当前预览页面 HTML 结构与分辨率设置',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    }
];

/** 执行工具调用 */
async function handleToolCall(name, args) {
    switch (name) {
        case 'cocos_check_status': {
            const [previewRes, bridgeRes] = await Promise.all([
                httpGet(PREVIEW_URL),
                httpGet(`${BRIDGE_URL}/status`)
            ]);

            return {
                engine: 'Cocos Creator 3.8.8',
                projectPath: CLIENT_ROOT,
                previewService: {
                    url: PREVIEW_URL,
                    isOnline: previewRes.ok,
                    statusCode: previewRes.status,
                    error: previewRes.error || null
                },
                editorBridgeExtension: {
                    url: BRIDGE_URL,
                    isOnline: bridgeRes.ok,
                    details: bridgeRes.ok ? JSON.parse(bridgeRes.body || '{}') : null,
                    error: bridgeRes.error || null
                }
            };
        }

        case 'cocos_inspect_scene': {
            const scenePath = path.join(ASSETS_ROOT, 'Main.scene.scene');
            if (!fs.existsSync(scenePath)) {
                return { error: `Scene file not found: ${scenePath}` };
            }

            try {
                const raw = fs.readFileSync(scenePath, 'utf8');
                const objects = JSON.parse(raw);
                
                const nodes = [];
                const components = [];

                for (let i = 0; i < objects.length; i++) {
                    const item = objects[i];
                    if (item.__type__ === 'cc.Node') {
                        nodes.push({
                            id: i,
                            name: item._name,
                            active: item._active,
                            position: item._lpos,
                            componentsCount: Array.isArray(item._components) ? item._components.length : 0
                        });
                    } else if (item.__type__ && item.__type__.includes('.')) {
                        components.push({
                            id: i,
                            type: item.__type__
                        });
                    }
                }

                return {
                    sceneFile: 'Main.scene.scene',
                    totalObjects: objects.length,
                    nodes: nodes,
                    detectedComponents: components.slice(0, 20)
                };
            } catch (err) {
                return { error: 'Failed to parse scene JSON: ' + err.message };
            }
        }

        case 'cocos_list_scripts': {
            const scriptsDir = path.join(ASSETS_ROOT, 'scripts');
            if (!fs.existsSync(scriptsDir)) {
                return { error: `Scripts directory not found: ${scriptsDir}` };
            }

            const files = fs.readdirSync(scriptsDir)
                .filter(f => f.endsWith('.ts'))
                .filter(f => !args.filter || f.toLowerCase().includes(args.filter.toLowerCase()))
                .map(f => {
                    const full = path.join(scriptsDir, f);
                    const stat = fs.statSync(full);
                    return {
                        name: f,
                        sizeBytes: stat.size,
                        updatedAt: stat.mtime.toISOString()
                    };
                });

            return {
                count: files.length,
                scripts: files
            };
        }

        case 'cocos_read_client_config': {
            const configPath = path.join(ASSETS_ROOT, 'scripts', 'ClientConfig.ts');
            const projectJsonPath = path.join(CLIENT_ROOT, 'project.json');

            let projectJson = null;
            if (fs.existsSync(projectJsonPath)) {
                try {
                    projectJson = JSON.parse(fs.readFileSync(projectJsonPath, 'utf8'));
                } catch { }
            }

            let clientConfigPreview = null;
            if (fs.existsSync(configPath)) {
                clientConfigPreview = fs.readFileSync(configPath, 'utf8').substring(0, 1000);
            }

            return {
                projectMeta: projectJson,
                configPreview: clientConfigPreview
            };
        }

        case 'cocos_query_preview_html': {
            const res = await httpGet(PREVIEW_URL);
            if (!res.ok) {
                return {
                    success: false,
                    error: `Could not reach ${PREVIEW_URL}: ${res.error || res.status}`
                };
            }

            return {
                success: true,
                statusCode: res.status,
                contentLength: res.body.length,
                htmlSnippet: res.body.substring(0, 2000)
            };
        }

        default:
            throw new Error(`Unknown tool: ${name}`);
    }
}

/** 主流程：处理标准 JSON-RPC 2.0 / MCP Stdio */
let buffer = '';

process.stdin.setEncoding('utf8');
process.stdin.on('data', async (chunk) => {
    buffer += chunk;
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop(); // 保留未闭合的部分

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        try {
            const request = JSON.parse(trimmed);
            await processRequest(request);
        } catch (err) {
            sendResponse({
                jsonrpc: '2.0',
                id: null,
                error: {
                    code: -32700,
                    message: 'Parse error: ' + err.message
                }
            });
        }
    }
});

function sendResponse(response) {
    process.stdout.write(JSON.stringify(response) + '\n');
}

async function processRequest(request) {
    const { id, method, params } = request;

    // 处理通知（不需要返回 id）
    if (!id && method && method.startsWith('notifications/')) {
        return;
    }

    switch (method) {
        case 'initialize':
            sendResponse({
                jsonrpc: '2.0',
                id,
                result: {
                    protocolVersion: '2024-11-05',
                    capabilities: {
                        tools: {}
                    },
                    serverInfo: {
                        name: 'cocos-creator-3.8.8-mcp',
                        version: '1.0.0'
                    }
                }
            });
            break;

        case 'tools/list':
            sendResponse({
                jsonrpc: '2.0',
                id,
                result: {
                    tools: TOOLS
                }
            });
            break;

        case 'tools/call': {
            const toolName = params?.name;
            const toolArgs = params?.arguments || {};

            try {
                const result = await handleToolCall(toolName, toolArgs);
                sendResponse({
                    jsonrpc: '2.0',
                    id,
                    result: {
                        content: [
                            {
                                type: 'text',
                                text: JSON.stringify(result, null, 2)
                            }
                        ]
                    }
                });
            } catch (err) {
                sendResponse({
                    jsonrpc: '2.0',
                    id,
                    error: {
                        code: -32603,
                        message: err.message
                    }
                });
            }
            break;
        }

        default:
            sendResponse({
                jsonrpc: '2.0',
                id,
                error: {
                    code: -32601,
                    message: `Method '${method}' not found`
                }
            });
            break;
    }
}

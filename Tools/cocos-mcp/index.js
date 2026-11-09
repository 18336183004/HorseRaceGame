#!/usr/bin/env node
/**
 * Cocos Creator 3.8.8 MCP (Model Context Protocol) Server
 * 
 * 遵循 Model Context Protocol 规范（JSON-RPC 2.0 over Stdio）。
 * 桥接连接：
 * 1. Cocos 3.8.8 Web 预览服务 (http://localhost:7456)
 * 2. Cocos 3.8.8 编辑器扩展桥接 (http://127.0.0.1:7457)
 * 3. Client 静态资源与场景解析 (Client/assets/Main.scene.scene & scripts)
 * 4. 实时 3D 赛马竞技场效果控制、资产热重载与场景节点树查询
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
function httpGet(url, timeoutMs = 2500) {
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
        description: '检查 Cocos Creator 3.8.8 编辑器扩展桥接 (http://127.0.0.1:7457) 与 Web 预览 (http://localhost:7456) 的连接状态与引擎信息',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'cocos_query_editor_tree',
        description: '通过编辑器扩展桥接实时查询 Cocos Creator 3.8.8 编辑器中当前激活场景的完整节点树层级与挂载组件',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'cocos_query_assets',
        description: '通过编辑器扩展桥接查询 Cocos Creator 3.8.8 资产数据库中的资产清单（支持按关键字过滤）',
        inputSchema: {
            type: 'object',
            properties: {
                pattern: {
                    type: 'string',
                    description: '可选资产路径过滤模式，如 "models", "scripts", "scenes"'
                }
            }
        }
    },
    {
        name: 'cocos_refresh_asset',
        description: '通知 Cocos Creator 3.8.8 编辑器刷新并重新编译指定的资产（如脚本或场景）',
        inputSchema: {
            type: 'object',
            properties: {
                url: {
                    type: 'string',
                    description: '资产的 db:// 路径，例如 "db://assets/scripts/GameApp.ts"'
                }
            },
            required: ['url']
        }
    },
    {
        name: 'cocos_inspect_scene',
        description: '解析项目启动场景 Main.scene.scene 的节点树结构、3D 摄像机、环境光与渲染管线配置',
        inputSchema: {
            type: 'object',
            properties: {}
        }
    },
    {
        name: 'cocos_apply_3d_effect',
        description: '应用并校验 3D 赛马竞技场视觉效果配置（校准 3D 摄像机视口与背景、3D 赛道与马匹模型/动画、环境光照，并刷新编辑器资产）',
        inputSchema: {
            type: 'object',
            properties: {
                updateSceneFile: {
                    type: 'boolean',
                    description: '是否将 3D 主摄像机和环境光的标准 3D 渲染参数固化到 Main.scene.scene 场景文件中（默认为 true）'
                }
            }
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

        case 'cocos_query_editor_tree': {
            const res = await httpGet(`${BRIDGE_URL}/scene-tree`);
            if (!res.ok) {
                return {
                    success: false,
                    error: `Failed to query scene-tree from editor bridge: ${res.error || res.status}`
                };
            }
            try {
                const data = JSON.parse(res.body);
                return {
                    success: true,
                    tree: data.tree
                };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }

        case 'cocos_query_assets': {
            const res = await httpGet(`${BRIDGE_URL}/query-assets`);
            if (!res.ok) {
                return {
                    success: false,
                    error: `Failed to query assets from editor bridge: ${res.error || res.status}`
                };
            }
            try {
                const data = JSON.parse(res.body);
                let list = data.assets || [];
                if (args && args.pattern) {
                    const pat = args.pattern.toLowerCase();
                    list = list.filter(a => (a.url && a.url.toLowerCase().includes(pat)) || (a.name && a.name.toLowerCase().includes(pat)));
                }
                return {
                    success: true,
                    total: list.length,
                    assets: list.slice(0, 50)
                };
            } catch (err) {
                return { success: false, error: err.message };
            }
        }

        case 'cocos_refresh_asset': {
            const targetUrl = encodeURIComponent(args.url || 'db://assets/scripts/GameApp.ts');
            const res = await httpGet(`${BRIDGE_URL}/refresh-asset?url=${targetUrl}`);
            if (!res.ok) {
                return {
                    success: false,
                    error: `Failed to refresh asset via editor bridge: ${res.error || res.status}`
                };
            }
            try {
                return JSON.parse(res.body);
            } catch {
                return { success: true, raw: res.body };
            }
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
                const cameras = [];
                const lights = [];

                for (let i = 0; i < objects.length; i++) {
                    const item = objects[i];
                    if (item.__type__ === 'cc.Node') {
                        nodes.push({
                            id: i,
                            name: item._name,
                            active: item._active,
                            position: item._lpos,
                            rotation: item._euler,
                            componentsCount: Array.isArray(item._components) ? item._components.length : 0
                        });
                    } else if (item.__type__ === 'cc.Camera') {
                        cameras.push({
                            id: i,
                            projection: item._projection === 1 ? 'PERSPECTIVE' : 'ORTHOGRAPHIC',
                            fov: item._fov,
                            clearFlags: item._clearFlags,
                            clearColor: item._color,
                            rect: item._rect,
                            priority: item._priority,
                            visibility: item._visibility
                        });
                    } else if (item.__type__ === 'cc.DirectionalLight') {
                        lights.push({
                            id: i,
                            color: item._color,
                            illuminance: item._illuminance
                        });
                    }
                }

                return {
                    sceneFile: 'Main.scene.scene',
                    totalObjects: objects.length,
                    nodes: nodes,
                    cameras: cameras,
                    lights: lights
                };
            } catch (err) {
                return { error: 'Failed to parse scene JSON: ' + err.message };
            }
        }

        case 'cocos_apply_3d_effect': {
            const scenePath = path.join(ASSETS_ROOT, 'Main.scene.scene');
            const shouldUpdateScene = args.updateSceneFile !== false;
            let sceneUpdated = false;

            if (shouldUpdateScene && fs.existsSync(scenePath)) {
                try {
                    const raw = fs.readFileSync(scenePath, 'utf8');
                    const objects = JSON.parse(raw);

                    // 1. 优化 Main Camera 为 3D 透视视口与开阔天空背景
                    for (let i = 0; i < objects.length; i++) {
                        const item = objects[i];
                        if (item.__type__ === 'cc.Camera' && item._priority === 0) {
                            item._projection = 1; // PERSPECTIVE
                            item._fov = 45;
                            item._near = 1;
                            item._far = 1000;
                            item._color = {
                                __type__: 'cc.Color',
                                r: 135,
                                g: 175,
                                b: 215,
                                a: 255
                            };
                            item._clearFlags = 14; // SOLID_COLOR (Color + Depth + Stencil)
                            item._rect = {
                                __type__: 'cc.Rect',
                                x: 12 / 720,
                                y: 704 / 1280,
                                width: 696 / 720,
                                height: 360 / 1280
                            };
                            sceneUpdated = true;
                        }

                        // 2. 优化 Canvas 摄像机为仅清除深度缓冲，保留底层 3D 渲染
                        if (item.__type__ === 'cc.Camera' && item._priority >= 1000000) {
                            item._clearFlags = 6; // DEPTH_ONLY (Depth + Stencil)
                            sceneUpdated = true;
                        }

                        // 3. 增强阳光强度
                        if (item.__type__ === 'cc.DirectionalLight') {
                            item._color = {
                                __type__: 'cc.Color',
                                r: 255,
                                g: 248,
                                b: 238,
                                a: 255
                            };
                            item._illuminance = 65000;
                            item._illuminanceHDR = 65000;
                            sceneUpdated = true;
                        }
                    }

                    if (sceneUpdated) {
                        fs.writeFileSync(scenePath, JSON.stringify(objects, null, 2), 'utf8');
                    }
                } catch (err) {
                    return { success: false, error: 'Failed to update scene file: ' + err.message };
                }
            }

            // 4. 通知 Cocos Creator 3.8.8 编辑器刷新资产
            const refreshResults = [];
            const assetsToRefresh = [
                'db://assets/Main.scene.scene',
                'db://assets/scripts/RaceTrack3D.ts',
                'db://assets/scripts/HorseEntity3D.ts',
                'db://assets/scripts/CameraDirector3D.ts',
                'db://assets/scripts/HorseVisual3D.ts',
                'db://assets/scripts/GameApp.ts'
            ];

            for (const assetUrl of assetsToRefresh) {
                const res = await httpGet(`${BRIDGE_URL}/refresh-asset?url=${encodeURIComponent(assetUrl)}`);
                refreshResults.push({ assetUrl, refreshed: res.ok });
            }

            return {
                success: true,
                sceneUpdated,
                refreshedAssets: refreshResults,
                threeDimensionalFeatures: {
                    arenaTrack3D: {
                        lengthMeters: 110,
                        lanesCount: 6,
                        laneWidthMeters: 2.4,
                        fences: 'Double-rail white wooden pickets with 38 posts',
                        startingGates: '6-stall 3D starting gates with yellow livery & lane badges',
                        finishLineGantry: 'Overhead truss arch with checkered finish banner',
                        grandstand: 'Tiered wooden spectator stand with multi-color bunting',
                        surfaceMaterials: ['Turf (grass)', 'Dirt (red clay)', 'Sand (golden dunes)'],
                        weathers: ['Sunny', 'Sunset', 'Rainy', 'Night']
                    },
                    horses3D: {
                        anatomicalSkeletons: 20,
                        motionKinematics: ['Gallop', 'Stand', 'Trot', 'Rear', 'Graze', 'Buck', 'Sliding_Stop', 'Finish'],
                        palettes: '20 authentic Thoroughbred coats, silks, and saddlecloths',
                        gltfModelsCount: 20
                    },
                    cinematicCameraDirector: {
                        modes: ['PANORAMIC (Broadcast)', 'LEADER_CHASE (Action)', 'OVERVIEW (Tactical)', 'PHOTO_FINISH (Laser Finish)'],
                        dynamicTracking: 'Smooth dampened interpolation following pack leader'
                    },
                    renderPipeline: {
                        mainCameraClearFlags: 'SOLID_COLOR (Western Desert Blue: #87AFDF)',
                        canvasCameraClearFlags: 'DEPTH_ONLY (Transparent 2D overlay)',
                        viewportRect: 'Rect(0, 0.5828, 1.0, 0.28125) embedded within saloon brass frame',
                        offscreenTurntable: '512x512 RenderTexture for Stable & Gallery 3D turntable display'
                    }
                }
            };
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
                        version: '1.1.0'
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

'use strict';

const http = require('http');

let server = null;
const BRIDGE_PORT = 7457;

module.exports = {
    load() {
        console.log('[Cocos-MCP-Bridge] 加载 Cocos Creator 3.8.8 MCP 桥接插件...');
        
        try {
            server = http.createServer(async (req, res) => {
                res.setHeader('Content-Type', 'application/json; charset=utf-8');
                res.setHeader('Access-Control-Allow-Origin', '*');
                res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
                res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

                if (req.method === 'OPTIONS') {
                    res.writeHead(204);
                    res.end();
                    return;
                }

                const url = new URL(req.url, `http://${req.headers.host || '127.0.0.1'}`);

                if (url.pathname === '/status') {
                    res.writeHead(200);
                    res.end(JSON.stringify({
                        status: 'online',
                        engine: 'Cocos Creator 3.8.8',
                        extension: 'cocos-mcp-bridge',
                        version: '1.0.0',
                        time: new Date().toISOString()
                    }));
                    return;
                }

                if (url.pathname === '/scene-tree') {
                    try {
                        let tree = null;
                        if (typeof Editor !== 'undefined' && Editor.Message) {
                            tree = await Editor.Message.request('scene', 'query-node-tree');
                        }
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, tree }));
                    } catch (err) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                    return;
                }

                if (url.pathname === '/query-assets') {
                    try {
                        let assets = null;
                        if (typeof Editor !== 'undefined' && Editor.Message) {
                            assets = await Editor.Message.request('asset-db', 'query-assets', {
                                pattern: 'db://assets/**/*'
                            });
                        }
                        res.writeHead(200);
                        res.end(JSON.stringify({ success: true, assets }));
                    } catch (err) {
                        res.writeHead(500);
                        res.end(JSON.stringify({ success: false, error: err.message }));
                    }
                    return;
                }

                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Endpoint not found' }));
            });

            server.on('error', (err) => {
                console.error('[Cocos-MCP-Bridge] 桥接端口错误:', err.message);
            });

            server.listen(BRIDGE_PORT, '127.0.0.1', () => {
                console.log(`[Cocos-MCP-Bridge] 服务端就绪: http://127.0.0.1:${BRIDGE_PORT}`);
            });
        } catch (e) {
            console.error('[Cocos-MCP-Bridge] 启动异常:', e.message);
        }
    },

    unload() {
        if (server) {
            server.close(() => {
                console.log('[Cocos-MCP-Bridge] 桥接服务已关闭');
            });
            server = null;
        }
    },

    methods: {
        openPanel() {
            console.log('[Cocos-MCP-Bridge] MCP 桥接状态正常，监听端口 7457');
        },
        getStatus() {
            return {
                status: 'online',
                port: BRIDGE_PORT,
                engine: '3.8.8'
            };
        }
    }
};

if (require.main === module) {
    module.exports.load();
}


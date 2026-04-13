import { randomUUID } from 'node:crypto';
import { createServer, IncomingMessage, ServerResponse } from 'node:http';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { Config } from './config.js';

function getRequestBody(req: IncomingMessage): Promise<unknown> {
    return new Promise((resolve, reject) => {
        let raw = '';
        req.setEncoding('utf8');
        req.on('data', (chunk) => {
            raw += chunk;
        });
        req.on('end', () => {
            if (!raw) {
                resolve(undefined);
                return;
            }

            try {
                resolve(JSON.parse(raw));
            } catch (error) {
                reject(error);
            }
        });
        req.on('error', reject);
    });
}

function writeJson(res: ServerResponse, statusCode: number, body: Record<string, unknown>) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
}

function isHostAllowed(req: IncomingMessage, config: Config): boolean {
    const hostHeader = req.headers.host;
    if (!hostHeader) {
        return false;
    }

    const hostname = hostHeader.split(':')[0]?.toLowerCase();
    if (!hostname) {
        return false;
    }

    const localHosts = new Set([
        '127.0.0.1',
        '::1',
        'localhost',
        config.httpHost.toLowerCase(),
    ]);

    if (!config.allowRemote) {
        return localHosts.has(hostname);
    }

    if (config.allowedHosts.length === 0) {
        return true;
    }

    return config.allowedHosts.map((entry) => entry.toLowerCase()).includes(hostname);
}

export async function startHttpServer(
    mcpServer: McpServer,
    config: Config,
): Promise<void> {
    const transports = new Map<string, StreamableHTTPServerTransport>();

    const server = createServer(async (req, res) => {
        if (!isHostAllowed(req, config)) {
            writeJson(res, 403, { error: 'Host not allowed' });
            return;
        }

        const requestUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
        if (req.method === 'GET' && requestUrl.pathname === '/healthz') {
            writeJson(res, 200, {
                status: 'ok',
                transport: 'http',
                path: config.httpPath,
            });
            return;
        }

        if (requestUrl.pathname !== config.httpPath) {
            writeJson(res, 404, { error: 'Not found' });
            return;
        }

        if (req.method !== 'POST') {
            writeJson(res, 405, { error: 'Method not allowed' });
            return;
        }

        let body: unknown;
        try {
            body = await getRequestBody(req);
        } catch {
            writeJson(res, 400, { error: 'Invalid JSON body' });
            return;
        }

        try {
            if (config.httpStateless) {
                const transport = new StreamableHTTPServerTransport({
                    sessionIdGenerator: undefined,
                });
                await mcpServer.connect(transport);
                await transport.handleRequest(req, res, body);
                return;
            }

            const sessionId = req.headers['mcp-session-id'];
            if (typeof sessionId === 'string' && transports.has(sessionId)) {
                await transports.get(sessionId)!.handleRequest(req, res, body);
                return;
            }

            const transport = new StreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (generatedSessionId) => {
                    transports.set(generatedSessionId, transport);
                },
            });

            transport.onclose = () => {
                if (transport.sessionId) {
                    transports.delete(transport.sessionId);
                }
            };

            await mcpServer.connect(transport);
            await transport.handleRequest(req, res, body);
        } catch (error) {
            const message = error instanceof Error ? error.message : 'Internal server error';
            writeJson(res, 500, { error: message });
        }
    });

    await new Promise<void>((resolve, reject) => {
        server.once('error', reject);
        server.listen(config.httpPort, config.httpHost, () => {
            resolve();
        });
    });
}

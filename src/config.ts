export interface Config {
    baseUrl: string;
    apiToken: string;
    apiKey?: string;
    readonly: boolean;
    transport: 'stdio' | 'http';
    httpHost: string;
    httpPort: number;
    httpPath: string;
    httpStateless: boolean;
    allowRemote: boolean;
    redactSensitive: boolean;
    safeMode: 'off' | 'balanced' | 'strict';
    allowedHosts: string[];
}

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
    if (value === undefined) {
        return defaultValue;
    }

    return value === 'true';
}

export function loadConfig(): Config {
    const baseUrl = process.env.REMNAWAVE_BASE_URL;
    const apiToken = process.env.REMNAWAVE_API_TOKEN;
    const apiKey = process.env.REMNAWAVE_API_KEY;
    const readonly = parseBoolean(process.env.REMNAWAVE_READONLY, false);
    const transport = process.env.MCP_TRANSPORT === 'http' ? 'http' : 'stdio';
    const httpHost = process.env.MCP_HTTP_HOST || '127.0.0.1';
    const httpPort = Number.parseInt(process.env.MCP_HTTP_PORT || '3100', 10);
    const httpPath = process.env.MCP_HTTP_PATH || '/mcp';
    const httpStateless = parseBoolean(process.env.MCP_HTTP_STATELESS, true);
    const allowRemote = parseBoolean(process.env.MCP_ALLOW_REMOTE, false);
    const redactSensitive = parseBoolean(process.env.MCP_REDACT_SENSITIVE, true);
    const safeMode = process.env.REMNAWAVE_SAFE_MODE === 'off'
        ? 'off'
        : process.env.REMNAWAVE_SAFE_MODE === 'strict'
            ? 'strict'
            : 'balanced';
    const allowedHosts = (process.env.MCP_ALLOWED_HOSTS || '')
        .split(',')
        .map((host) => host.trim())
        .filter(Boolean);

    if (!baseUrl) {
        throw new Error('REMNAWAVE_BASE_URL environment variable is required');
    }
    if (!apiToken) {
        throw new Error('REMNAWAVE_API_TOKEN environment variable is required');
    }
    if (!Number.isInteger(httpPort) || httpPort < 1 || httpPort > 65535) {
        throw new Error('MCP_HTTP_PORT must be a valid TCP port');
    }
    if (!httpPath.startsWith('/')) {
        throw new Error('MCP_HTTP_PATH must start with "/"');
    }
    if (!allowRemote && (httpHost === '0.0.0.0' || httpHost === '::')) {
        throw new Error('MCP_ALLOW_REMOTE=true is required when binding HTTP MCP to all interfaces');
    }
    try {
        const url = new URL(baseUrl);
        if (!['http:', 'https:'].includes(url.protocol)) {
            throw new Error('REMNAWAVE_BASE_URL must use http or https');
        }
    } catch {
        throw new Error('REMNAWAVE_BASE_URL must be a valid URL');
    }

    return {
        baseUrl: baseUrl.replace(/\/+$/, ''),
        apiToken,
        apiKey,
        readonly,
        transport,
        httpHost,
        httpPort,
        httpPath,
        httpStateless,
        allowRemote,
        redactSensitive,
        safeMode,
        allowedHosts,
    };
}

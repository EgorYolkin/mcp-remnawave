import { Config } from './config.js';

const TOOL_BLOCKLIST_BY_MODE: Record<Config['safeMode'], Set<string>> = {
    off: new Set(),
    balanced: new Set([
        'api_tokens_list',
        'api_tokens_create',
        'api_tokens_delete',
        'keygen_get',
        'subscriptions_get_connection_keys',
        'subscriptions_get_raw_by_short_uuid',
    ]),
    strict: new Set([
        'api_tokens_list',
        'api_tokens_create',
        'api_tokens_delete',
        'keygen_get',
        'subscriptions_get_connection_keys',
        'subscriptions_get_raw_by_short_uuid',
        'settings_get',
        'settings_update',
        'metadata_node_get',
        'metadata_user_get',
        'metadata_node_upsert',
        'metadata_user_upsert',
    ]),
};

const SENSITIVE_KEY_NAMES = new Set([
    'apikey',
    'api_key',
    'authorization',
    'connectionkey',
    'connectionkeys',
    'key',
    'password',
    'secret',
    'subscriptionurl',
    'token',
]);

let activeConfig: Pick<Config, 'redactSensitive' | 'safeMode'> = {
    redactSensitive: true,
    safeMode: 'balanced',
};

function normalizeKey(value: string): string {
    return value.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

function shouldMaskKey(key: string): boolean {
    const normalized = normalizeKey(key);
    return Array.from(SENSITIVE_KEY_NAMES).some(
        (candidate) => normalized.includes(candidate),
    );
}

function maskString(value: string): string {
    return value
        .replace(
            /\b(Bearer\s+)([A-Za-z0-9._~-]{8,})/gi,
            '$1[REDACTED]',
        )
        .replace(
            /\b(sk-[A-Za-z0-9._-]{8,})\b/g,
            '[REDACTED]',
        )
        .replace(
            /\b([A-Za-z0-9_-]{20,}\.[A-Za-z0-9._-]{10,})\b/g,
            '[REDACTED]',
        )
        .replace(
            /((?:https?:\/\/)?[^\s"'`]+)(\/s\/[A-Za-z0-9._~-]+)([^\s"'`]*)/g,
            '$1/s/[REDACTED]$3',
        );
}

export function configureSecurity(config: Config) {
    activeConfig = {
        redactSensitive: config.redactSensitive,
        safeMode: config.safeMode,
    };
}

export function isToolAllowed(name: string): boolean {
    return !TOOL_BLOCKLIST_BY_MODE[activeConfig.safeMode].has(name);
}

export function sanitizeData<T>(value: T): T {
    if (!activeConfig.redactSensitive) {
        return value;
    }

    if (typeof value === 'string') {
        return maskString(value) as T;
    }

    if (
        typeof value === 'number' ||
        typeof value === 'boolean' ||
        value === null ||
        value === undefined
    ) {
        return value;
    }

    if (Array.isArray(value)) {
        return value.map((item) => sanitizeData(item)) as T;
    }

    if (value instanceof Date) {
        return value;
    }

    if (typeof value === 'object') {
        const sanitizedEntries = Object.entries(value).map(([key, entryValue]) => {
            if (shouldMaskKey(key)) {
                return [key, '[REDACTED]'];
            }

            return [key, sanitizeData(entryValue)];
        });

        return Object.fromEntries(sanitizedEntries) as T;
    }

    return value;
}

export function sanitizeErrorMessage(message: string): string {
    if (!activeConfig.redactSensitive) {
        return message;
    }

    return maskString(message)
        .replace(/\{.*\}/s, 'request failed')
        .trim();
}

export function serializeJson(data: unknown): string {
    return JSON.stringify(sanitizeData(data), null, 2);
}

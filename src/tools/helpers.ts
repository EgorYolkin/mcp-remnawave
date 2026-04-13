import { sanitizeData, sanitizeErrorMessage, serializeJson } from '../security.js';

export function toolResult(data: unknown) {
    return {
        content: [
            {
                type: 'text' as const,
                text: serializeJson(data),
            },
        ],
        structuredContent: sanitizeData(data),
    };
}

export function toolError(error: unknown) {
    const message =
        error instanceof Error ? sanitizeErrorMessage(error.message) : sanitizeErrorMessage(String(error));
    return {
        content: [
            {
                type: 'text' as const,
                text: `Error: ${message}`,
            },
        ],
        isError: true,
    };
}

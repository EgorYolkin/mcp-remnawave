import test from 'node:test';
import assert from 'node:assert/strict';
import { configureSecurity, isToolAllowed, sanitizeData, sanitizeErrorMessage } from '../dist/security.js';

test('balanced mode blocks explicitly sensitive tools', () => {
    configureSecurity({ redactSensitive: true, safeMode: 'balanced' });
    assert.equal(isToolAllowed('system_stats'), true);
    assert.equal(isToolAllowed('subscriptions_get_connection_keys'), false);
    assert.equal(isToolAllowed('api_tokens_list'), false);
});

test('sanitizeData redacts sensitive keys recursively', () => {
    configureSecurity({ redactSensitive: true, safeMode: 'balanced' });
    const value = sanitizeData({
        token: 'secret-token',
        nested: {
            apiKey: 'abc',
            safe: 'value',
        },
    });

    assert.deepEqual(value, {
        token: '[REDACTED]',
        nested: {
            apiKey: '[REDACTED]',
            safe: 'value',
        },
    });
});

test('sanitizeErrorMessage removes bearer tokens', () => {
    configureSecurity({ redactSensitive: true, safeMode: 'balanced' });
    assert.equal(
        sanitizeErrorMessage('Remnawave API error: Bearer abcdef1234567890'),
        'Remnawave API error: Bearer [REDACTED]',
    );
});

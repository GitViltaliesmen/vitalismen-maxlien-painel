import assert from 'node:assert/strict';
import test from 'node:test';

import {
    PROVIDER_ONLY_FILES,
    REPLACEMENT_MATRIX,
    ZAPI_DEPENDENCY_MATRIX,
    directZapiImportsInCanonicalCore,
    validateBaselineLock,
    validateProviderOnlyDiff
} from '../scripts/audit-ec-whatsapp-provider-boundary.mjs';

test('baseline comercial permanece protegida pela sucessão V170/V171', () => {
    const result = validateBaselineLock();
    assert.equal(result.protectedFiles, 36);
});

test('núcleo canônico não importa cliente nem roteador físico Z-API', () => {
    assert.deepEqual(directZapiImportsInCanonicalCore(), []);
});

test('diff da missão é restrito aos quatro artefatos provider-only', () => {
    const changed = validateProviderOnlyDiff();
    assert.equal(changed.every((relative) => PROVIDER_ONLY_FILES.includes(relative)), true);
});

test('matriz cobre todas as capacidades exigidas pela migração', () => {
    const capabilities = new Set(Object.values(ZAPI_DEPENDENCY_MATRIX).flat());
    for (const capability of [
        'INBOUND', 'OUTBOUND', 'TEXT', 'AUDIO', 'IMAGE', 'MESSAGE_ID',
        'DELIVERY_ACK', 'READ_ACK', 'WEBHOOK', 'HEALTH', 'SESSION_IDENTITY',
        'PANEL_STATUS', 'BOT_ROUTING'
    ]) {
        assert.equal(capabilities.has(capability), true, `capability_not_mapped:${capability}`);
        assert.ok(REPLACEMENT_MATRIX[capability], `replacement_not_mapped:${capability}`);
    }
});

test('lacunas reais continuam explícitas e não são promovidas a READY', () => {
    const gaps = Object.entries(REPLACEMENT_MATRIX)
        .filter(([, value]) => value.state === 'NOT_IMPLEMENTED_LIVE')
        .map(([key]) => key)
        .sort();
    assert.deepEqual(gaps, ['DELIVERY_ACK', 'READ_ACK', 'WEBHOOK']);
});

import assert from 'node:assert/strict';

import '../src/services/ecAuthLoginV78PassThroughFreezeRuntimeGuardV127.js';
import {
    EC_AUTH_LOGIN_V78_PATH,
    isExactEcAuthLoginV78Request
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';

assert.equal(EC_AUTH_LOGIN_V78_PATH, '/api/auth/login');
assert.equal(isExactEcAuthLoginV78Request({ method: 'POST', path: '/api/auth/login' }), true);

for (const candidate of [
    { method: 'GET', path: '/api/auth/login' },
    { method: 'POST', path: '/api/auth/login/' },
    { method: 'POST', path: '/api/auth/register' },
    { method: 'POST', path: '/api/auth/users' },
    { method: 'POST', path: '/api/auth/login/reset' }
]) {
    assert.equal(isExactEcAuthLoginV78Request(candidate), false, `${candidate.method} ${candidate.path}`);
}

console.log('EC_AUTH_LOGIN_V78_PASS_THROUGH_V127=PASS');

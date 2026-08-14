import assert from 'node:assert/strict';
import test from 'node:test';

process.env.GOOGLE_CONTACTS_CLIENT_ID = 'client.apps.googleusercontent.com';
process.env.GOOGLE_CONTACTS_CLIENT_SECRET = 'client-secret';
process.env.GOOGLE_CONTACTS_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.GOOGLE_CONTACTS_REDIRECT_URI = 'https://ec.maxlien.shop/api/integrations/google-contacts/callback';

const {
    decryptGoogleRefreshToken,
    encryptGoogleRefreshToken,
    googleContactsConfiguration,
    publicGoogleContactSync
} = await import('../src/services/googleContactsService.js');

test('refresh token usa AES-GCM e nao fica em texto aberto', () => {
    const plain = 'refresh-token-super-secreto';
    const encrypted = encryptGoogleRefreshToken(plain);
    assert.notEqual(encrypted.encryptedRefreshToken, plain);
    assert.ok(encrypted.tokenIv);
    assert.ok(encrypted.tokenAuthTag);
    assert.equal(decryptGoogleRefreshToken(encrypted), plain);
});

test('configuracao exige callback HTTPS e segredo forte', () => {
    assert.equal(googleContactsConfiguration().configured, true);
});

test('resposta publica nunca expoe token ou resourceName', () => {
    const exposed = publicGoogleContactSync({
        status: 'synced',
        name: 'Cliente Teste',
        resourceName: 'people/secret',
        encryptedRefreshToken: 'secret'
    });
    assert.equal(exposed.status, 'synced');
    assert.equal('resourceName' in exposed, false);
    assert.equal('encryptedRefreshToken' in exposed, false);
});

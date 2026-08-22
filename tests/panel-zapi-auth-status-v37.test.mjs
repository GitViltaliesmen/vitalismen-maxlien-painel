import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

const panel = fs.readFileSync('public/qr.html', 'utf8');
const zapiRoute = fs.readFileSync('src/routes/zapi.js', 'utf8');
const auth = fs.readFileSync('src/middleware/auth.js', 'utf8');

test('V37 preserva a autenticação obrigatória da rota sensível Z-API', () => {
    assert.match(zapiRoute, /router\.get\('\/status', authMiddleware,/);
    assert.match(auth, /return res\.status\(401\)\.json\(\{ error: 'No token provided' \}\)/);
    assert.doesNotMatch(zapiRoute, /router\.get\('\/status', async/);
});

test('V37 não consulta o status protegido enquanto o painel está sem login', () => {
    const checkStatusStart = panel.indexOf('async function checkStatus()');
    const noTokenGuard = panel.indexOf('if (!state.token)', checkStatusStart);
    const protectedFetch = panel.indexOf("fetchPanelJson(`/api/zapi/status?", checkStatusStart);

    assert.ok(checkStatusStart > 0);
    assert.ok(noTokenGuard > checkStatusStart);
    assert.ok(protectedFetch > noTokenGuard);
    assert.match(panel.slice(noTokenGuard, protectedFetch), /setSignedOutZapiState\(\);[\s\S]+return;/);
});

test('V37 inicia pela autenticação e não dispara checkStatus anônimo no bootstrap', () => {
    const bootstrapTail = panel.slice(panel.lastIndexOf('async function bootstrapAuth()'));
    assert.match(bootstrapTail, /bootstrapAuth\(\);/);
    assert.doesNotMatch(bootstrapTail, /checkStatus\(\);\s*\n\s*bootstrapAuth\(\);/);
});

test('V37 limpa o alerta técnico ao sair ou perder a sessão', () => {
    assert.match(panel, /const signedOutZapiText = 'Faça login para consultar a conexão'/);
    assert.match(panel, /el\('statusText'\)\.textContent = signedOutZapiText/);
    assert.match(panel, /el\('loginStatusText'\)\.textContent = signedOutZapiText/);
    assert.match(panel, /el\('waBadge'\)\.textContent = 'SEM LOGIN'/);
    assert.match(panel, /setActiveModule\('all'\);\s*setSignedOutZapiState\(\);/);
});

test('V37 converte 401/403 do painel em sessão expirada sem expor erro técnico', () => {
    assert.match(panel, /response\.status === 401 \|\| response\.status === 403/);
    assert.match(panel, /setAuth\(''\);\s*const error = new Error\('Sessão expirada\. Entre novamente\.'\)/);
    assert.match(panel, /state\.token \? \{ Authorization: `Bearer \$\{state\.token\}` \} : \{\}/);
});

test('V37 não altera o transporte, número, funil ou ações externas', () => {
    assert.doesNotMatch(panel, /ZAPI_TOKEN\s*=/);
    assert.doesNotMatch(panel, /ZAPI_INSTANCE_ID\s*=/);
    assert.doesNotMatch(panel, /WHATSAPP_FUNNEL_ENABLED\s*=/);
    assert.doesNotMatch(panel, /VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED\s*=/);
});

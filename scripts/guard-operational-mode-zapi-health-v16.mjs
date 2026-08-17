import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

await import('../src/services/operationalModeZapiHealthFreezeRuntimeGuardV16.js');
await import('./guard-customer-current-context-panel-v16.mjs');

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');
const manifest = JSON.parse(read('docs/freeze/operational-mode-zapi-health-reconciliation-v16-20260816.json'));
const parentManifest = JSON.parse(read('docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json'));
const health = read('src/routes/health.js');
const testSource = read('tests/operational-mode-zapi-health.test.mjs');
const agents = read('AGENTS.md');
const architecture = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
const seniorGuard = read('scripts/senior-guard.mjs');
const officialAudit = read('scripts/official-state-audit.mjs');
const index = read('src/index.js');
const packageJson = JSON.parse(read('package.json'));
const successorGuardPattern = /guard-operational-mode-zapi-health-v16\.mjs/;
const previousTopGuardPattern = /guard-whatsapp-chats-readonly-v16\.mjs/;
const forbiddenMutation = /\.(?:save|updateOne|updateMany|findOneAndUpdate|insertOne|create|deleteOne|deleteMany|bulkWrite)\s*\(/;
const forbiddenSend = /\b(?:sendZapiText|sendText|sendAudio|sendImage|sendVideo|sendDocument)\b/;
const requiredProtectedFiles = [
    'AGENTS.md',
    'package.json',
    'src/index.js',
    'src/routes/health.js',
    'src/services/operationalModeZapiHealthFreezeRuntimeGuardV16.js',
    'scripts/guard-operational-mode-zapi-health-v16.mjs',
    'scripts/senior-guard.mjs',
    'scripts/official-state-audit.mjs',
    'tests/operational-mode-zapi-health.test.mjs',
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/OPERATIONAL_MODE_ZAPI_HEALTH_RECONCILIATION_FREEZE_V16_20260816.md',
    'docs/freeze/whatsapp-chats-readonly-hardening-v16-20260816.json',
    'FREEZE_EC_8637_ZAPI_PUBLIC_RESET_20260622.md',
    'FREEZE_EC_VSL_ZAPI_AUTORESOLVER_20260623.md',
    'FREEZE_EC_MANUAL_SEND_1621_RECOVERY_20260623.md'
];

assert.equal(manifest.freezeId, 'operational-mode-zapi-health-reconciliation-v16-20260816');
assert.equal(manifest.status, 'implementation_candidate_locked');
assert.equal(manifest.country, 'EC');
assert.equal(manifest.parentFreezeId, parentManifest.freezeId);
assert.equal(manifest.publicationStatus, 'not_published');
assert.equal(manifest.productionUnchanged, true);
assert.equal(manifest.requiresWrittenAuthorizationToChange, true);
assert.deepEqual(manifest.supersededParentProtectedFiles, ['package.json', 'src/index.js']);
assert.deepEqual(manifest.supersededAncestorProtectedFiles, []);
assert.deepEqual(Object.keys(manifest.protectedFiles).sort(), requiredProtectedFiles.slice().sort());
assert.equal(manifest.policy.modeContractStrict, true);
assert.equal(manifest.policy.operationalModePreserved, true);
assert.equal(manifest.policy.observationModePreserved, true);
assert.equal(manifest.policy.isolatedFunnelFlagChangesAllowed, false);
assert.equal(manifest.policy.officialTransport, 'zapi');
assert.equal(manifest.policy.baileysRequiredWhenZapiHealthy, false);
assert.equal(manifest.policy.healthReadOnly, true);
assert.equal(manifest.policy.databaseWritesAllowed, false);
assert.equal(manifest.policy.externalSendsAllowed, false);
assert.equal(manifest.policy.productionUnchanged, true);

assert.equal(parentManifest.freezeId, 'whatsapp-chats-readonly-hardening-v16-20260816');
assert.equal(parentManifest.policy.readOnly, true);
assert.equal(parentManifest.policy.databaseWritesAllowed, false);
assert.equal(parentManifest.policy.markReadChanged, false);
assert.equal(parentManifest.policy.customerContextV16Changed, false);

for (const source of [agents, architecture]) {
    assert.match(source, /modo observacao/i);
    assert.match(source, /modo operacional aprovado/i);
    assert.match(source, /WHATSAPP_FUNNEL_ENABLED=false/);
    assert.match(source, /WHATSAPP_FUNNEL_ENABLED=true/);
    assert.match(source, /Nunca alterar apenas `?WHATSAPP_FUNNEL_ENABLED`?/i);
    assert.match(source, /Z-API e o transporte oficial/i);
    assert.match(source, /Baileys/i);
}

assert.match(seniorGuard, /const operationalAutomationApproved = hasEnv\('VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED', 'true'\)/);
assert.match(seniorGuard, /operacao aprovada deve manter WHATSAPP_FUNNEL_ENABLED=true/);
assert.match(seniorGuard, /\.env deve manter WHATSAPP_FUNNEL_ENABLED=false/);
assert.match(officialAudit, /const requiredOperationalEnv = \{/);
assert.match(officialAudit, /VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'true'/);
assert.match(officialAudit, /WHATSAPP_FUNNEL_ENABLED: 'true'/);
assert.match(officialAudit, /const requiredObservationEnv = \{[\s\S]*WHATSAPP_FUNNEL_ENABLED: 'false'/);

assert.match(health, /export const evaluateOperationalWhatsappHealth =/);
assert.match(health, /if \(zapi\.configured\.enabled\)/);
assert.match(health, /zapi\.connected = zapiConnectedFromStatus\(await getZapiStatus\(\)\)/);
assert.match(health, /official: transportHealth\.officialTransport/);
assert.match(health, /const baileysRequired = officialTransport === 'baileys' && whatsappConnectEnabled/);
assert.match(health, /if \(zapiRequired && !zapiConnected\) degradedReasons\.push\('zapi_not_connected'\)/);
assert.match(health, /if \(baileysRequired && connectedSessionCount < 1\) degradedReasons\.push\('no_connected_whatsapp_session'\)/);
assert.doesNotMatch(health, /const zapiPrimary = !whatsappConnectEnabled/);
assert.doesNotMatch(health, forbiddenMutation);
assert.doesNotMatch(health, forbiddenSend);
assert.doesNotMatch(health, /router\.(?:post|put|patch|delete)\s*\(/);

assert.equal([...testSource.matchAll(/\btest\('/g)].length, 11);
for (const expectedTest of [
    'modo operacional aprovado e reconhecido',
    'combinacao completa de flags',
    'WHATSAPP_FUNNEL_ENABLED true nao viola',
    'modo observacao continua exigindo',
    'combinacao parcial ou incoerente',
    'Z-API conectada mantem health operacional',
    'Z-API desconectada sem outro transporte',
    'Baileys obrigatorio sem sessao pronta',
    'outros motivos legitimos de degradacao',
    'nao modifica o objeto recebido',
    'health permanece GET/read-only'
]) {
    assert.ok(testSource.includes(expectedTest), `teste obrigatorio ausente: ${expectedTest}`);
}

assert.match(index, /import '\.\/services\/operationalModeZapiHealthFreezeRuntimeGuardV16\.js';/);
assert.doesNotMatch(index, /import '\.\/services\/whatsappChatsReadonlyFreezeRuntimeGuardV16\.js';/);
assert.deepEqual(
    [...index.matchAll(/^import '\.\/services\/([^']*FreezeRuntimeGuard[^']*)';$/gm)].map((match) => match[1]),
    ['operationalModeZapiHealthFreezeRuntimeGuardV16.js']
);

for (const scriptName of ['senior:check', 'guard:tex-ultra-approved', 'guard:ec-product-funnel-isolation', 'deploy:ec-safe', 'deploy:vps']) {
    assert.match(packageJson.scripts[scriptName], successorGuardPattern, `${scriptName} deve usar o guard sucessor`);
    assert.doesNotMatch(packageJson.scripts[scriptName], previousTopGuardPattern, `${scriptName} nao pode encadear o guard anterior`);
}
assert.equal(packageJson.scripts['guard:operational-mode-zapi-health'], 'node scripts/guard-operational-mode-zapi-health-v16.mjs');
assert.equal(packageJson.scripts['guard:whatsapp-chats-readonly'], 'node scripts/guard-operational-mode-zapi-health-v16.mjs');
assert.match(packageJson.scripts['senior:check'], /tests\/operational-mode-zapi-health\.test\.mjs/);

console.log(`[OPERATIONAL-MODE-ZAPI-HEALTH-GUARD-V16] OK: ${manifest.freezeId} preserva os dois modos e mede o transporte Z-API oficial sem escrita ou envio.`);

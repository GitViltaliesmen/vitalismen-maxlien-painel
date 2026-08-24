import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
    OFFICIAL_GITHUB_REPOSITORY,
    isOfficialGithubActionsWorkspace
} from '../scripts/senior-guard-workspace-policy.mjs';

const cwd = '/home/runner/work/vitalismen-maxlien-painel/vitalismen-maxlien-painel';
const officialEnvironment = {
    CI: 'true',
    GITHUB_ACTIONS: 'true',
    GITHUB_REPOSITORY: OFFICIAL_GITHUB_REPOSITORY,
    GITHUB_WORKSPACE: cwd
};

test('senior guard aceita somente o workspace oficial completo do GitHub Actions', () => {
    assert.equal(isOfficialGithubActionsWorkspace({ env: officialEnvironment, cwd }), true);
});

test('senior guard rejeita ambientes GitHub Actions parcialmente falsificados', () => {
    for (const [field, value] of [
        ['CI', 'false'],
        ['GITHUB_ACTIONS', 'false'],
        ['GITHUB_REPOSITORY', 'outro/repositorio'],
        ['GITHUB_WORKSPACE', '/home/runner/work/outro/outro']
    ]) {
        assert.equal(isOfficialGithubActionsWorkspace({
            env: { ...officialEnvironment, [field]: value },
            cwd
        }), false, `${field} divergente precisa ser rejeitado`);
    }
    assert.equal(isOfficialGithubActionsWorkspace({
        env: { ...officialEnvironment, GITHUB_WORKSPACE: '' },
        cwd
    }), false);
});

test('auditoria de retirada reconhece ledger e evento recuperado com comprovante', () => {
    const result = spawnSync(process.execPath, [
        'scripts/audit-pickup-notification-evidence.mjs',
        '--self-test'
    ], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, /PICKUP_NOTIFICATION_EVIDENCE_AUDIT_SELF_TEST=OK/);
});

test('registro final identifica release, rollback e ausência de disparos', () => {
    const result = readFileSync('docs/RESULTADO_ATIVACAO_MEDIA_V30_20260821.md', 'utf8');
    assert.match(result, /production-20260821-7cd0238/);
    assert.match(result, /20260821T185008Z_production-20260821-7cd0238/);
    assert.match(result, /Rollback preservado:.*20260821T180758Z_production-20260821-937ae43/);
    assert.match(result, /nenhuma mensagem enviada/i);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V39 comprova commit, PM2, rollback e ausência de canário real', () => {
    const result = readFileSync(
        'docs/EC_DIRECT_PRODUCT_NAME_POSTSALE_ACTIVATION_RESULT_V39_20260822.md',
        'utf8'
    );
    assert.match(result, /e191a6e212af866f25528fdd8af5ff517ca247a2/);
    assert.match(result, /20260822T152503Z_production-20260822-e191a6e/);
    assert.match(result, /PID atual: `2161976`/);
    assert.match(result, /20260822T143218Z_production-20260822-dbc3cbd/);
    assert.match(result, /Nenhum canário real foi enviado/);
    assert.match(result, /document\.querySelectorAll\('\.chat-preview \.meta'\)\.length === 0/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V40 comprova release, auditoria, PM2 e ausência de envio real', () => {
    const result = readFileSync(
        'docs/EC_ENGAGEMENT_INTERNAL_BUCKET_ACTIVATION_RESULT_V40_20260822.md',
        'utf8'
    );
    assert.match(result, /d1a142ab44aeb7eca03fef25f91bba39252c13a9/);
    assert.match(result, /20260822T172707Z_production-20260822-d1a142a/);
    assert.match(result, /PID atual: `2173631`/);
    assert.match(result, /candidatos seguros a `AQUECIMENTO`: `19`/);
    assert.match(result, /registros técnicos antes e depois: `294`/);
    assert.match(result, /Nenhuma mensagem, mídia,\s*pedido, Dropi ou evento Meta\/CAPI foi criado/);
    assert.match(result, /20260822T152503Z_production-20260822-e191a6e/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V41 comprova busca publicada, backup, PM2 e ausência de efeitos externos', () => {
    const result = readFileSync(
        'docs/PANEL_CLIENT_SEARCH_ACTIVATION_RESULT_V41_20260822.md',
        'utf8'
    );
    assert.match(result, /1f4895bdf7f00a00831484e9e2fe1b832658dd74/);
    assert.match(result, /20260822T180506Z_production-20260822-1f4895b/);
    assert.match(result, /PID atual após ativação: `2181029`/);
    assert.match(result, /qr\.html\.before-v41-20260822T180506Z/);
    assert.match(result, /20260822T172707Z_production-20260822-d1a142a/);
    assert.match(result, /Nenhuma mensagem real, mídia, pedido, Dropi, Meta\/CAPI, escrita de banco/);
    assert.match(result, /chat-search-v41\.js`: HTTP `200`/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V42 comprova aquecimento publicado, contato auditado e ausência de envio real', () => {
    const result = readFileSync(
        'docs/EC_ENGAGEMENT_COMMAND_REPLY_ACTIVATION_RESULT_V42_20260822.md',
        'utf8'
    );
    assert.match(result, /cbd6dfcbf3f43c36ccfe2057ab79d32353d6a76d/);
    assert.match(result, /20260822T185502Z_production-20260822-cbd6dfc/);
    assert.match(result, /PID atual após ativação: `2188070`/);
    assert.match(result, /qr\.html\.before-v42-20260822T185502Z/);
    assert.match(result, /20260822T180506Z_production-20260822-1f4895b/);
    assert.match(result, /bucket persistido: `engagement`/);
    assert.match(result, /pedidos ativos: `0`/);
    assert.match(result, /shipments ativos: `0`/);
    assert.match(result, /Nenhuma mensagem real, mídia, pedido, Dropi, Meta\/CAPI/);
    assert.match(result, /ec-engagement-panel-v42\.js`:[\s\S]*HTTP `200`/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V50 comprova painel publicado, PM2, rollback e validação sem cliente real', () => {
    const result = readFileSync(
        'docs/PANEL_MANUAL_EDIT_PERSISTENCE_ACTIVATION_RESULT_V50_20260823.md',
        'utf8'
    );
    assert.match(result, /a17e51905c88c0d8bc2d605c7f3f837f2dd5b8d1/);
    assert.match(result, /20260823T235000Z_production-20260823-a17e519/);
    assert.match(result, /PID após reinício controlado: `2406151`/);
    assert.match(result, /20260823T231500Z_production-20260823-cbc845b/);
    assert.match(result, /correctedByHumanFields: \["name"\]/);
    assert.match(result, /Nenhum cliente real foi editado/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V57 comprova alias corrigido, backup, PM2 e zero envio', () => {
    const result = readFileSync(
        'docs/PANEL_CUSTOMER_ALIAS_REPAIR_ACTIVATION_RESULT_V57_20260824.md',
        'utf8'
    );
    assert.match(result, /33e48fc82d480646993fe52abdb9a31bf071357d/);
    assert.match(result, /20260824T045910Z_production-20260824-33e48fc/);
    assert.match(result, /PID `2525370`/);
    assert.match(result, /alias-before-20260824T050025Z\.json/);
    assert.match(result, /Divergencias reais de identidade apos normalizacao EC: `0`/);
    assert.match(result, /Mensagens enviadas aos telefones envolvidos depois do inicio do reparo: `0`/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

test('registro V58 comprova frasco, valores, PM2 e canario somente no QA', () => {
    const result = readFileSync(
        'docs/PANEL_TEX_ULTRA_BOTTLE_BLOCK_ACTIVATION_RESULT_V58_20260824.md',
        'utf8'
    );
    assert.match(result, /812fb25f0e585c0906cde47f4d4b1570511c3fda/);
    assert.match(result, /20260824T123239Z_production-20260824-812fb25/);
    assert.match(result, /PID `2558794`/);
    assert.match(result, /tex_ultra\.png`, SHA-256[\s\S]*450122a3db3823d012770a20f25f311be66a564b8fb23d9d0d47f0207d3ce2f7/);
    assert.match(result, /O unico telefone usado foi o QA autorizado `5515998038637`/);
    assert.match(result, /estado final `delivered`/);
    assert.match(result, /Pedidos e shipments criados para o QA na janela do canario: `0` e `0`/);
    assert.match(result, /Nenhum cliente real recebeu validacao/);
    assert.doesNotMatch(result, /ZAPI_(?:INSTANCE_TOKEN|CLIENT_TOKEN)\s*=/i);
});

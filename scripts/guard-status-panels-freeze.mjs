import fs from 'fs';
import path from 'path';

const root = process.cwd();
const officialStatuses = [
    'novo',
    'atendendo',
    'comprar_depois',
    'confirmado',
    'pedido_enviado',
    'entregue',
    'recompra',
    'cancelado',
    'devolvido'
];

const failures = [];
const warn = [];

const readFirst = (candidates, label, { required = true } = {}) => {
    for (const candidate of candidates) {
        const file = path.isAbsolute(candidate) ? candidate : path.join(root, candidate);
        if (fs.existsSync(file)) {
            return { file, body: fs.readFileSync(file, 'utf8') };
        }
    }
    const message = `${label} nao encontrado em: ${candidates.join(', ')}`;
    if (required) failures.push(message);
    else warn.push(message);
    return { file: '', body: '' };
};

const assert = (condition, message) => {
    if (!condition) failures.push(message);
};

const orderedOptions = (body) => {
    const match = body.match(/<select id="customerStatusInput"[\s\S]*?<\/select>/);
    if (!match) return [];
    return [...match[0].matchAll(/<option value="([^"]+)"/g)].map((item) => item[1]);
};

const jsonList = JSON.stringify(officialStatuses);
const pythonList = `STATUSES = ${jsonList}`;
const confirmationText = 'Deseja alterar os dados/status deste cliente em todos os paineis?';

const qr = readFirst([
    'public/qr.html',
    '.codex-tmp/status-align/public/qr.html',
    '/opt/vitalismen-automacao/current/public/qr.html'
], 'Painel Integrado public/qr.html');

const whatsapp = readFirst([
    'src/routes/whatsapp.js',
    '.codex-tmp/status-align/src/routes/whatsapp.js',
    '/opt/vitalismen-automacao/current/src/routes/whatsapp.js'
], 'Rota WhatsApp');

const orders = readFirst([
    'src/routes/orders.js',
    '.codex-tmp/status-align/src/routes/orders.js',
    '/opt/vitalismen-automacao/current/src/routes/orders.js'
], 'Rota Orders');

const statusService = readFirst([
    'src/services/adminPanelStatusService.js',
    '.codex-tmp/status-align/src/services/adminPanelStatusService.js',
    '/opt/vitalismen-automacao/current/src/services/adminPanelStatusService.js'
], 'Servico de status do Painel Unificado');

const explicitMaxlienPath = String(process.env.MAXLIEN_APP_PATH || '').trim();
const maxlienCandidates = [
    explicitMaxlienPath,
    '.codex-tmp/status-align/maxlien/app.py',
    ...(process.platform === 'win32' ? [] : ['/opt/maxlien-mvp/app.py'])
].filter(Boolean);
const maxlien = readFirst(
    maxlienCandidates,
    'Painel externo app.py (verificacao cross-project)',
    { required: Boolean(explicitMaxlienPath) }
);

const qrOptions = orderedOptions(qr.body);
assert(
    JSON.stringify(qrOptions) === jsonList,
    `Lista do Painel Integrado alterada. Esperado ${jsonList}; atual ${JSON.stringify(qrOptions)}`
);
assert(!/<option value="(?:pago|finalizado|enviado|shipped|processing|confirmed|delivered|cancelled|returned|draft|pending)"/.test(qr.body), 'Painel Integrado voltou a expor status legado.');
assert(qr.body.includes(confirmationText), 'Painel Integrado precisa confirmar antes de alterar dados/status.');
assert(qr.body.includes('normalizePanelStatus'), 'Painel Integrado perdeu normalizacao canonica de status.');
assert(qr.body.includes('orderStatusForApi'), 'Painel Integrado perdeu mapeamento seguro para API de pedidos.');
assert(!/>Finalizar<\/button>/.test(qr.body), 'Painel Integrado voltou a mostrar botao Finalizar; use Arquivar para nao virar status.');

if (maxlien.body) {
    assert(maxlien.body.includes(pythonList), `Lista STATUSES do Maxlien alterada. Esperado: ${pythonList}`);
    assert(maxlien.body.includes(confirmationText), 'Maxlien precisa confirmar antes de alterar dados/status.');
    assert(maxlien.body.includes('mirror_status_to_whatsapp_panel'), 'Maxlien perdeu espelhamento de status para o Painel Integrado.');
    assert(maxlien.body.includes('"whatsapp_panel_sync": mirror_result'), 'API /admin/api/status deve retornar resultado do espelhamento WhatsApp.');
    assert(!maxlien.body.includes('STATUS AUTOSAVE FINAL'), 'Maxlien voltou com autosave duplicado de status.');
    assert(!maxlien.body.includes('quick status colorize'), 'Maxlien voltou com listener duplicado de status.');
}

assert(whatsapp.body.includes('PANEL_STATUSES'), 'WhatsApp perdeu lista canonica PANEL_STATUSES.');
assert(whatsapp.body.includes('internal/admin-status-sync'), 'WhatsApp perdeu rota local de espelhamento do Painel Unificado.');
assert(whatsapp.body.includes('status_painel_unificado'), 'WhatsApp precisa registrar historico quando status vem do Painel Unificado.');
assert(whatsapp.body.includes('orderStatusFromPanelStatus'), 'WhatsApp perdeu mapeamento do status canonico para pedido.');

assert(orders.body.includes("pedido_enviado: 'processing'"), 'Orders precisa aceitar pedido_enviado vindo do painel.');
assert(orders.body.includes("recompra: 'delivered'"), 'Orders precisa aceitar recompra sem criar status divergente.');
assert(statusService.body.includes("if (['novo', 'comprar_depois', 'confirmado', 'pedido_enviado', 'entregue', 'recompra', 'cancelado', 'devolvido'].includes(value))"), 'adminPanelStatusService precisa preservar status canonicos do painel.');

if (warn.length) {
    console.warn('[STATUS-PANELS-FREEZE] Avisos:');
    for (const item of warn) console.warn(`- ${item}`);
}

if (failures.length) {
    console.error('\n[STATUS-PANELS-FREEZE] BLOQUEADO. Esta parte esta congelada:\n');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('[STATUS-PANELS-FREEZE] OK: painel desta raiz protegido; painel externo validado somente quando disponivel ou informado explicitamente.');

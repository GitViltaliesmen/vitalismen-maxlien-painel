import fs from 'fs';
import path from 'path';
import { execFileSync, spawnSync } from 'child_process';
import { VIT_POWER_APPROVED_AUDIO_CANDIDATES } from '../src/services/vitPowerEvolvedWorkflow.js';

const root = process.cwd();
const failures = [];
const warnings = [];
const notes = [];

const requiredLocalEnv = {
    BOT_FORCE_AGENT: 'vit_power_ec',
    WHATSAPP_AUTO_REPLY_ENABLED: 'true',
    WHATSAPP_FUNNEL_ENABLED: 'false',
    BOT_USE_APPROVED_AUDIO_ONLY: 'true',
    WHATSAPP_AUTO_REJECT_CALLS: 'true'
};

const forbiddenEnv = [
    'LEGACY_ORDER_FUNNEL_ENABLED',
    'DRAFT_RECOVERY_ENABLED',
    'SHIPMENT_NOTIFICATIONS_ENABLED'
];

const readFile = (file) => fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';

const parseEnv = (body) => {
    const out = {};
    for (const line of String(body || '').split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const match = trimmed.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
        if (match) out[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
    return out;
};

const ok = (message) => notes.push(`OK  ${message}`);
const warn = (message) => warnings.push(`WARN ${message}`);
const fail = (message) => failures.push(`FAIL ${message}`);

const run = (cmd, args, options = {}) => {
    const result = spawnSync(cmd, args, {
        cwd: root,
        encoding: 'utf8',
        timeout: options.timeout || 20000
    });
    return {
        code: result.status,
        stdout: result.stdout || '',
        stderr: result.stderr || '',
        error: result.error
    };
};

const fetchJson = async (url) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3000);
    try {
        const response = await fetch(url, { signal: controller.signal });
        const text = await response.text();
        try {
            return { ok: response.ok, status: response.status, data: JSON.parse(text), text };
        } catch {
            return { ok: response.ok, status: response.status, data: null, text };
        }
    } finally {
        clearTimeout(timer);
    }
};

const auditLocalFiles = () => {
    if (!root.endsWith('Vitalismen Automacao')) {
        warn(`cwd inesperado: ${root}`);
    } else {
        ok(`pasta oficial local: ${root}`);
    }

    const envBody = readFile('.env');
    if (!envBody) {
        fail('.env nao encontrado.');
        return;
    }

    const env = parseEnv(envBody);
    for (const [key, value] of Object.entries(requiredLocalEnv)) {
        if (env[key] !== value) fail(`.env ${key} deve ser ${value}, atual=${env[key] ?? '(ausente)'}`);
        else ok(`.env ${key}=${value}`);
    }

    for (const key of forbiddenEnv) {
        if (Object.prototype.hasOwnProperty.call(env, key)) fail(`.env nao pode conter ${key}`);
    }

    const engine = readFile('src/services/conversationEngine.js');
    if (!engine.includes('buildCheckoutOrderConfirmationSummaryText')) {
        fail('conversationEngine.js nao possui bloco de resumo/confirmacao para dados completos do formulario.');
    } else {
        ok('formulario com dados completos usa resumo de confirmacao antes do fechamento.');
    }

    if (!engine.includes("if (checkoutOrderData)") || !engine.includes("stage: 'awaiting_agency_confirmation'")) {
        fail('conversationEngine.js pode deixar formulario completo cair no fluxo comum de preco/apresentacao.');
    } else {
        ok('formulario completo vai direto para awaiting_agency_confirmation.');
    }

    const ecTemplateDir = path.join(root, 'public', 'media', 'templates', 'EC');
    const missingAudioGroups = [];
    for (const [group, candidates] of Object.entries(VIT_POWER_APPROVED_AUDIO_CANDIDATES)) {
        const hasAny = candidates.some((baseName) => (
            fs.existsSync(path.join(ecTemplateDir, `${baseName}.ogg`))
            || fs.existsSync(path.join(ecTemplateDir, `${baseName}.mp3`))
        ));
        if (!hasAny) missingAudioGroups.push(`${group}: ${candidates.join(' | ')}`);
    }
    if (missingAudioGroups.length) {
        warn(`audios do funil evoluido ainda faltando (${missingAudioGroups.length} grupos): ${missingAudioGroups.join('; ')}`);
    } else {
        ok('todos os grupos de audio do funil evoluido possuem pelo menos um arquivo aprovado.');
    }
};

const auditSeniorGuard = () => {
    const result = run(process.execPath, ['scripts/senior-guard.mjs']);
    if (result.code === 0) ok('senior-guard local passou.');
    else fail(`senior-guard local falhou:\n${result.stdout}${result.stderr}`);
};

const auditHttp = async () => {
    try {
        const health = await fetchJson('http://127.0.0.1:3001/health');
        if (health.ok && health.data?.status === 'ok') ok('API local /health OK.');
        else warn(`API local /health nao confirmou OK: status=${health.status}`);
    } catch (error) {
        warn(`API local nao respondeu em 127.0.0.1:3001: ${error.message}`);
        return;
    }

    try {
        const status = await fetchJson('http://127.0.0.1:3001/api/whatsapp/status');
        const session = status.data?.sessions?.find((item) => item.sessionId === status.data?.defaultSessionId)
            || status.data?.sessions?.[0];
        if (session?.isReady && session?.status === 'connected') {
            ok(`WhatsApp conectado: ${session.sessionId}`);
        } else {
            warn(`WhatsApp nao esta pronto: ${JSON.stringify(status.data)}`);
        }
    } catch (error) {
        warn(`status do WhatsApp nao respondeu: ${error.message}`);
    }
};

const auditCheckoutOrders = async () => {
    try {
        const mongoose = await import('mongoose');
        const { default: Message } = await import('../src/models/Message.js');
        const { default: Order } = await import('../src/models/Order.js');
        await mongoose.default.connect(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/vitalismen_automacao');

        const messages = await Message.find({
            body: /Cantidad\s*:\s*(3|6)[\s\S]*Total\s*:\s*\$?(95\.99|167\.99)/i
        }).sort({ createdAt: -1 }).limit(10).lean();

        const latestByPhoneTail = new Map();
        for (const message of messages) {
            const qty = Number((String(message.body).match(/Cantidad\s*:\s*(\d+)/i) || [])[1] || 0);
            const total = Number((String(message.body).match(/Total\s*:\s*\$?([\d.]+)/i) || [])[1] || 0);
            const phone = (String(message.body).match(/Tel[eé]fono\s*:\s*([^\n]+)/i) || [])[1] || message.peerPhone || '';
            const tail = phone.replace(/\D/g, '').slice(-10);
            if (!tail || !qty || !total) continue;
            if (!latestByPhoneTail.has(tail)) {
                latestByPhoneTail.set(tail, { qty, total, message });
            }
        }

        let mismatches = 0;
        for (const [tail, entry] of latestByPhoneTail.entries()) {
            const order = await Order.findOne({ country: 'EC', 'customer.phone': { $regex: tail } })
                .sort({ updatedAt: -1, createdAt: -1 })
                .lean();
            if (!order) {
                warn(`formulario qty=${entry.qty} phoneTail=${tail} sem pedido EC correspondente.`);
                continue;
            }
            if (order.package?.quantity !== entry.qty || Number(order.total) !== entry.total) {
                mismatches += 1;
                fail(`pedido ${order.orderId} diverge do formulario mais recente: formulario=${entry.qty}/${entry.total}, pedido=${order.package?.quantity}/${order.total}`);
            }
        }

        if (!messages.length) warn('nenhum formulario recente com Cantidad 3/6 encontrado para conferir no banco.');
        else if (!mismatches) ok(`formularios recentes com Cantidad 3/6 conferidos por telefone: ${latestByPhoneTail.size}.`);

        await mongoose.default.disconnect();
    } catch (error) {
        warn(`auditoria Mongo/formularios pulada: ${error.message}`);
    }
};

const auditVps = () => {
    const key = `${process.env.HOME || ''}/.ssh/vps_auditoria_codex`;
    if (!fs.existsSync(key)) {
        warn('chave do VPS nao encontrada; auditoria VPS pulada.');
        return;
    }

    try {
        const output = execFileSync('ssh', [
            '-i', key,
            '-o', 'StrictHostKeyChecking=accept-new',
            'root@maxlien.shop',
            [
                'cd /opt/vitalismen-automacao/current',
                'npm run senior:check >/tmp/vitalismen-senior-check.out 2>&1',
                'cat /tmp/vitalismen-senior-check.out',
                "grep -E '^(VITALISMEN_OFFICIAL_ONLY|VITALISMEN_OFFICIAL_PRODUCT|VITALISMEN_OFFICIAL_AGENT|VITALISMEN_OFFICIAL_DOCTOR|VITALISMEN_OFFICIAL_COUNTRY|BOT_FORCE_AGENT|WHATSAPP_AUTO_REPLY_ENABLED|WHATSAPP_FUNNEL_ENABLED|BOT_USE_APPROVED_AUDIO_ONLY)=' .env || true"
            ].join(' && ')
        ], {
            encoding: 'utf8',
            timeout: 30000
        });

        if (!output.includes('[SENIOR-GUARD] OK')) fail('senior-guard do VPS nao confirmou OK.');
        else ok('senior-guard do VPS passou.');

        const requiredVpsFlags = [
            'VITALISMEN_OFFICIAL_ONLY=true',
            'VITALISMEN_OFFICIAL_PRODUCT=Vit Power',
            'BOT_FORCE_AGENT=vit_power_ec',
            'WHATSAPP_AUTO_REPLY_ENABLED=true',
            'WHATSAPP_FUNNEL_ENABLED=false',
            'BOT_USE_APPROVED_AUDIO_ONLY=true'
        ];
        for (const flag of requiredVpsFlags) {
            if (!output.includes(flag)) fail(`VPS sem flag oficial: ${flag}`);
            else ok(`VPS ${flag}`);
        }
    } catch (error) {
        warn(`auditoria VPS falhou/pulada: ${error.message}`);
    }
};

auditLocalFiles();
auditSeniorGuard();
await auditHttp();
await auditCheckoutOrders();
auditVps();

console.log('\n=== Auditoria oficial Vitalismen ===');
for (const line of notes) console.log(line);
for (const line of warnings) console.warn(line);
for (const line of failures) console.error(line);

if (failures.length) {
    console.error(`\nResultado: BLOQUEADO (${failures.length} falha(s), ${warnings.length} aviso(s)).`);
    process.exit(1);
}

console.log(`\nResultado: OK (${warnings.length} aviso(s)).`);

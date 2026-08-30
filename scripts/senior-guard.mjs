import fs from 'fs';
import os from 'os';
import path from 'path';
import { isOfficialGithubActionsWorkspace } from './senior-guard-workspace-policy.mjs';

const root = process.cwd();
const localOfficialPath = '/Users/greson/Documents/Vitalismen Automacao';
const windowsOfficialPath = path.join(
    os.homedir(),
    'Documents',
    'SITES',
    'MAXLIENSHOP_JULHO_2026',
    'Vitalismen Automacao'
);
const vpsOfficialPath = '/opt/vitalismen-automacao/current';
const codexOfficialWorkspace = '/home/codex/workspaces/maxlien-vitalismen';
const normalizePath = (value) => {
    try {
        return fs.realpathSync(value);
    } catch {
        return path.resolve(value);
    }
};
const read = (file) => fs.existsSync(path.join(root, file))
    ? fs.readFileSync(path.join(root, file), 'utf8')
    : '';

const failures = [];

const assert = (condition, message) => {
    if (!condition) failures.push(message);
};

const scanFiles = (dir, predicate = () => true) => {
    const base = path.join(root, dir);
    if (!fs.existsSync(base)) return [];
    const out = [];
    const walk = (current) => {
        for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
            const full = path.join(current, entry.name);
            if (entry.isDirectory()) {
                if (['node_modules', '.git'].includes(entry.name)) continue;
                walk(full);
            } else if (predicate(full)) {
                out.push(full);
            }
        }
    };
    walk(base);
    return out;
};

const localEnv = read('.env');
const envExample = read('.env.example');
const codexWorkspaceActive = normalizePath(root) === normalizePath(codexOfficialWorkspace);
// O workspace Codex nao recebe segredos nem a configuracao operacional do
// VPS. Nesse caminho exato, o contrato seguro versionado e a fonte de flags.
// A V48 preserva este gate também durante o saneamento restrito a status X -> X.
const env = codexWorkspaceActive && !localEnv ? envExample : localEnv;
const marker = read('.vitalismen-official-root');
const hasEnv = (key, value) => new RegExp(`^${key}=${value}$`, 'm').test(env);
const operationalAutomationApproved = hasEnv('VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED', 'true');
const term = (...parts) => parts.join('');
const forbiddenContextPatterns = [
    new RegExp(`\\b${term('colo', 'mbia')}\\b`, 'i'),
    new RegExp(`\\bcol[oô]${term('mbia')}\\b`, 'i'),
    new RegExp(`\\b${term('super', 'full')}\\b`, 'i'),
    new RegExp(`\\b${term('al', 'pha')}\\b`, 'i'),
    new RegExp(`\\b${term('el', 'ite')}\\b`, 'i'),
    new RegExp(`\\b${term('mi', 'guel')}\\b`, 'i'),
    new RegExp(`${term('drop', 'i')}\\.co`, 'i'),
    new RegExp(`${term('dro', 'ppi')}\\/co`, 'i'),
    new RegExp(`\\b${term('DRO', 'PI_CO_')}`),
    new RegExp(`\\b${term('DRO', 'PPI_CO_')}`),
    new RegExp(`\\b${term('META_PIXEL_ID_', 'CO')}\\b`),
    new RegExp(`\\b${term('META_ACCESS_TOKEN_', 'CO')}\\b`),
    new RegExp(`\\b${term('C', 'OP')}\\b`),
    new RegExp(`${term('inter', 'rapid')}[ií]simo`, 'i')
];
const ignoredContextFiles = new Set([
    'src/data/agencia_LISTA.json'
]);
// A V61 precisa registrar explicitamente que a conta compartilhada continua
// read-only fora de EC. A excecao aceita somente a palavra de contexto nestes
// documentos listados; as demais proibicoes e todos os outros arquivos continuam
// cobertos pelo guard geral.
const metaAttributionReadOnlyContextFiles = new Set([
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'docs/META_EC_PROTOCOLO_G_ATTRIBUTION_FREEZE_V61_20260824.md',
    'docs/DEPLOY_GUARD_ANCESTRY_SUCCESSOR_FREEZE_V91_20260830.md'
]);
// A referencia aprovada a consulta da Dra. Maria pertence exclusivamente ao
// contrato isolado do Nitrix. Ela nao faz parte do texto ou do estado do
// funil Vit Power, que continua protegido pela regra geral abaixo.
const productScopedProtocolFiles = new Set([
    'src/services/nitrixProductProfile.js',
    // A V74 cita os guards V62/V63 somente para declarar e preservar a
    // ancestralidade Meta já congelada; não importa conteúdo de outro funil.
    'src/services/freezeLockEcMetaDynamicFreezeRuntimeGuardV74.js',
    // Autorização V34: estes dois arquivos reconhecem somente a origem
    // comercial da VSL Protocolo G como Tex Ultra. O projeto externo da VSL
    // continua separado e nenhum asset/código dela é importado para cá.
    'src/routes/whatsapp.js',
    'src/routes/zapi.js',
    'src/services/protocoloGTexUltraFreezeRuntimeGuardV34.js',
    // A V35 cita o manifesto V34 apenas para preservar a cadeia de freezes.
    // O conteúdo comercial novo continua isolado por productKey.
    'src/services/ecProductIngredientsFreezeRuntimeGuardV35.js',
    // A V36 cita os manifestos V34/V35 somente para preservar a linhagem.
    'src/services/ecAllProductsIngredientsFreezeRuntimeGuardV36.js',
    // A V37 cita os manifestos anteriores somente para preservar a linhagem.
    'src/services/panelZapiAuthStatusFreezeRuntimeGuardV37.js',
    // A V38 cita V28–V37 somente para preservar a linhagem.
    'src/services/inboundMediaPathPortabilityFreezeRuntimeGuardV38.js',
    // A V39 permanece como ancestral imutável da V40.
    'src/services/ecDirectProductNameFreezeRuntimeGuardV39.js',
    // A V40 cita os manifestos anteriores somente para preservar a linhagem.
    'src/services/ecEngagementFreezeRuntimeGuardV40.js',
    // A V41 cita V28–V40 somente para preservar a linhagem de freezes.
    'src/services/panelClientSearchFreezeRuntimeGuardV41.js',
    // A V42 cita V28–V41 somente para preservar a linhagem de freezes.
    'src/services/ecEngagementCommandReplyFreezeRuntimeGuardV42.js',
    // A V43 cita V28–V42 somente para preservar a linhagem de freezes.
    'src/services/ecEngagementPriorityFreezeRuntimeGuardV43.js',
    // A V44 cita V28–V43 somente para preservar a linhagem de freezes.
    'src/services/panelGlobalNewMessagesFreezeRuntimeGuardV44.js',
    // A V45 cita V28–V44 somente para preservar a linhagem de freezes.
    'src/services/ecDeliveredRepurchaseFreezeRuntimeGuardV45.js',
    // A V46 cita V28–V45 somente para preservar a linhagem de freezes.
    'src/services/ecRepurchaseSyncPreservationFreezeRuntimeGuardV46.js',
    // A V47 cita V28–V46 somente para preservar a linhagem de freezes.
    'src/services/ecRepurchaseSqliteSerializationFreezeRuntimeGuardV47.js',
    // V48 centraliza as origens multiproduto autorizadas, inclusive
    // Protocolo G -> Tex Ultra, sem acessar ou incorporar a VSL externa.
    'src/services/ecuadorProductService.js',
    'src/services/ecMultiproductCoreFreezeRuntimeGuardV48.js',
    // Autorizacao V61: contrato e freeze da atribuicao Meta exclusiva
    // EC + TEX_ULTRA + PROTOCOLO_G, sem incorporar o projeto Vilaliemen.
    'src/services/metaAttributionFreezeRuntimeGuardV61.js',
    'src/services/metaProtocoloGAttributionService.js',
    'src/services/funnelMetricsService.js',
    // V73 apenas preserva a rota/Dataset Protocolo G já congelados pela V61;
    // a exceção fica restrita ao resolvedor Meta e ao guard sucessor.
    'src/services/metaDestinationRegistryService.js',
    'src/services/metaPartnerDestinationRegistryFreezeRuntimeGuardV73.js',
    // Autorizacao V62: sucessor restrito a CTA secundaria e observabilidade
    // exclusiva do Protocolo G, sem alterar o funil comercial EC.
    'src/services/protocoloGConversionFreezeRuntimeGuardV62.js',
    // Autorizacao V63: corte pos-correcao e metricas por anuncio, somente leitura.
    'src/services/protocoloGAdMetricsFreezeRuntimeGuardV63.js',
    // V78 formaliza a assinatura deterministica da origem oficial sem
    // aceitar texto generico e sem incorporar ou alterar o projeto externo.
    'src/services/ecOfficialVslEntryV78Service.js',
    // O guard sucessor V78 referencia os guards V61-V63 somente para validar
    // por hash a ancestralidade congelada da origem oficial.
    'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js',
    // A V90 reconhece exclusivamente a entrada oficial /protocolo-g para
    // persistência no dashboard sem armar automação no contexto QA.
    'src/services/ecVslDashboardIngressV90Service.js',
    // V64 somente herda o freeze V63 e bloqueia nomes invalidos no Dropi EC.
    'src/services/dropiCustomerFullNameFreezeRuntimeGuardV64.js',
    // V65 corrige busca, leitura canonica, pos-venda e reconciliacao Dropi EC.
    'src/services/postSaleGargalosFreezeRuntimeGuardV65.js'
]);
const officialGithubActionsWorkspace = isOfficialGithubActionsWorkspace({
    env: process.env,
    cwd: root
});

assert(
    officialGithubActionsWorkspace
    || [localOfficialPath, windowsOfficialPath, codexOfficialWorkspace, vpsOfficialPath, '/opt/vitalismen-automacao/releases'].some(
        (allowed) => normalizePath(root).startsWith(normalizePath(allowed))
    ),
    `Caminho fora da raiz oficial. Use somente ${localOfficialPath} no Mac, ${windowsOfficialPath} no Windows, ${codexOfficialWorkspace} no Codex, ${vpsOfficialPath} no VPS ou um release em /opt/vitalismen-automacao/releases. Atual: ${root}`
);
assert(marker.includes('VITALISMEN_OFFICIAL_PROJECT=vit_power_ec'), 'Marcador .vitalismen-official-root ausente ou invalido.');
assert(marker.includes('DO_NOT_USE_PARALLEL_AUTOMATION_PROJECTS=true'), 'Marcador oficial deve bloquear projetos paralelos de automacao.');
assert(!fs.existsSync(path.join(root, 'src/services/funnelService.js')), 'Remova src/services/funnelService.js: funil legado nao pode voltar.');
assert(!fs.existsSync(path.join(root, 'src/services/aiService.js')), 'Remova src/services/aiService.js: recuperacao/TTS legado nao pode voltar.');
assert(!fs.existsSync(path.join(root, 'src/services/shipmentSchedulerService.js')), 'Remova src/services/shipmentSchedulerService.js: scheduler paralelo nao pode voltar.');
assert(/BOT_FORCE_AGENT=vit_power_ec/.test(env), '.env deve manter BOT_FORCE_AGENT=vit_power_ec.');
if (operationalAutomationApproved) {
    assert(hasEnv('VIT_POWER_FUNNEL_ACTIVE', 'true'), '.env com operacao aprovada deve manter VIT_POWER_FUNNEL_ACTIVE=true.');
    assert(hasEnv('WHATSAPP_AUTO_REPLY_ENABLED', 'true'), '.env com operacao aprovada deve manter WHATSAPP_AUTO_REPLY_ENABLED=true.');
    assert(hasEnv('ZAPI_ROUTE_INBOUND_TO_BOT', 'true'), '.env com operacao aprovada deve manter ZAPI_ROUTE_INBOUND_TO_BOT=true.');
    assert(hasEnv('WHATSAPP_FUNNEL_ENABLED', 'true'), '.env com operacao aprovada deve manter WHATSAPP_FUNNEL_ENABLED=true.');
    assert(hasEnv('DISABLE_SCHEDULER', '0'), '.env com operacao aprovada deve manter DISABLE_SCHEDULER=0.');
    assert(hasEnv('SHIPMENT_STATUS_DISPATCH_ENABLED', 'true'), '.env com operacao aprovada deve manter SHIPMENT_STATUS_DISPATCH_ENABLED=true.');
    assert(hasEnv('SHIPMENT_PICKUP_REMINDERS_ENABLED', 'true'), '.env com operacao aprovada deve manter SHIPMENT_PICKUP_REMINDERS_ENABLED=true.');
    assert(hasEnv('PICKUP_PROOF_SWEEP_ENABLED', 'true'), '.env com operacao aprovada deve manter PICKUP_PROOF_SWEEP_ENABLED=true.');
} else {
    assert(hasEnv('VIT_POWER_FUNNEL_ACTIVE', 'false'), '.env deve manter VIT_POWER_FUNNEL_ACTIVE=false enquanto o funil esta em teste.');
    assert(hasEnv('WHATSAPP_AUTO_REPLY_ENABLED', 'false'), '.env deve manter WHATSAPP_AUTO_REPLY_ENABLED=false enquanto o Observador analisa atendimentos reais.');
    assert(hasEnv('ZAPI_ROUTE_INBOUND_TO_BOT', 'false'), '.env deve manter ZAPI_ROUTE_INBOUND_TO_BOT=false para nao rotear cliente ao funil automatico.');
    assert(hasEnv('WHATSAPP_FUNNEL_ENABLED', 'false'), '.env deve manter WHATSAPP_FUNNEL_ENABLED=false.');
    assert(hasEnv('DISABLE_SCHEDULER', '1'), '.env deve manter DISABLE_SCHEDULER=1 para pausar ciclos operacionais automaticos.');
    assert(hasEnv('SHIPMENT_STATUS_DISPATCH_ENABLED', 'false'), '.env deve manter SHIPMENT_STATUS_DISPATCH_ENABLED=false.');
    assert(hasEnv('SHIPMENT_PICKUP_REMINDERS_ENABLED', 'false'), '.env deve manter SHIPMENT_PICKUP_REMINDERS_ENABLED=false.');
    assert(hasEnv('PICKUP_PROOF_SWEEP_ENABLED', 'false'), '.env deve manter PICKUP_PROOF_SWEEP_ENABLED=false.');
}
assert(/WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false/.test(env), '.env deve manter WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false.');
assert(/PENDING_CHECKOUT_FOLLOWUP_ENABLED=false/.test(env), '.env deve manter PENDING_CHECKOUT_FOLLOWUP_ENABLED=false.');
assert(/OBSERVER_OPENAI_ENABLED=true/.test(env), '.env deve manter OBSERVER_OPENAI_ENABLED=true para continuar o Bot Observador.');
assert(/BOT_USE_APPROVED_AUDIO_ONLY=true/.test(env), '.env deve manter BOT_USE_APPROVED_AUDIO_ONLY=true.');
assert(!/BOT_FAST_TEXT_ONLY=true/.test(env), '.env nao pode manter BOT_FAST_TEXT_ONLY=true; isso derruba o funil A/B em texto.');
assert(!/BOT_DISABLE_AUTO_MEDIA=true/.test(env), '.env nao pode manter BOT_DISABLE_AUTO_MEDIA=true; isso bloqueia audios/imagens do funil A/B.');
assert(!/BOT_FAST_TEXT_ONLY=true/.test(envExample), '.env.example nao pode sugerir BOT_FAST_TEXT_ONLY=true.');
assert(!/BOT_DISABLE_AUTO_MEDIA=true/.test(envExample), '.env.example nao pode sugerir BOT_DISABLE_AUTO_MEDIA=true.');

assert(!fs.existsSync(path.join(root, 'public/media/sales/co')), 'Remova public/media/sales/co: midia de outro contexto nao pode ficar no projeto.');
assert(!fs.existsSync(path.join(root, 'public/media/templates/EC/.quarantine-wrong-bonus')), 'Remova quarentena de bonus antigo/errado em EC.');
assert(fs.existsSync(path.join(root, 'src/data/agencia_LISTA.json')), 'A lista oficial de agencias deve ser src/data/agencia_LISTA.json.');
assert(!fs.existsSync(path.join(root, 'src/data/servientrega_ec_agencies.json')), 'Nao recrie lista paralela: use somente src/data/agencia_LISTA.json.');

for (const forbidden of ['LEGACY_ORDER_FUNNEL_ENABLED', 'DRAFT_RECOVERY_ENABLED', 'SHIPMENT_NOTIFICATIONS_ENABLED']) {
    assert(!env.includes(forbidden), `.env nao pode conter ${forbidden}. Automacao paralela removida.`);
    assert(!envExample.includes(forbidden), `.env.example nao pode conter ${forbidden}. Automacao paralela removida.`);
}

const sourceFiles = scanFiles('src', (file) => /\.(js|mjs|ts)$/.test(file));
for (const file of sourceFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    const body = fs.readFileSync(file, 'utf8');
    assert(!/funnelService/.test(body), `${rel} referencia funnelService legado.`);
    assert(!/processPendingFunnelByOrderId|processDuePendingFunnels/.test(body), `${rel} referencia funil pendente legado.`);
    assert(!/generateWelcomeMessage|rewriteMessage/.test(body), `${rel} referencia IA legada de recuperacao.`);
    assert(!/shipmentSchedulerService|processShipmentNotifications/.test(body), `${rel} referencia scheduler paralelo de entregas.`);
    assert(!/DRAFT_RECOVERY_ENABLED|LEGACY_ORDER_FUNNEL_ENABLED|SHIPMENT_NOTIFICATIONS_ENABLED/.test(body), `${rel} referencia flag legada removida.`);
    if (!productScopedProtocolFiles.has(rel)) {
        assert(!/\bprotocolo\b/i.test(body), `${rel} menciona protocolo; foco atual e Vit Power.`);
    }
}

const projectFiles = [
    ...scanFiles('src', (file) => /\.(js|mjs|ts|json|md)$/.test(file)),
    ...scanFiles('scripts', (file) => /\.(js|mjs|sh)$/.test(file)),
    ...scanFiles('docs', (file) => /\.(md|txt)$/.test(file)),
    ...scanFiles('public', (file) => /\.(html|js|json|md)$/.test(file)),
    path.join(root, '.env'),
    path.join(root, '.env.example')
].filter((file) => fs.existsSync(file));

for (const file of projectFiles) {
    const rel = path.relative(root, file).split(path.sep).join('/');
    if (ignoredContextFiles.has(rel)) continue;
    const body = fs.readFileSync(file, 'utf8');
    const guardedBody = metaAttributionReadOnlyContextFiles.has(rel)
        ? body.replace(/\bcol(?:o|ô)mbia\b/gi, 'EC_READ_ONLY')
        : body;
    for (const pattern of forbiddenContextPatterns) {
        assert(!pattern.test(guardedBody), `${rel} contem contexto antigo proibido: ${pattern}.`);
    }
}

const docs = read('docs/ARQUITETURA_AUTOMACAO_OFICIAL.md');
assert(docs.includes('Automacoes paralelas apagadas'), 'Atualize docs/ARQUITETURA_AUTOMACAO_OFICIAL.md com o status congelado/apagado.');
assert(docs.includes('Regra de imutabilidade A/B'), 'Atualize docs/ARQUITETURA_AUTOMACAO_OFICIAL.md com a regra de imutabilidade A/B.');
assert(docs.includes('Camada de complementos fora do nucleo A/B'), 'Atualize docs/ARQUITETURA_AUTOMACAO_OFICIAL.md com a camada de complementos fora do nucleo A/B.');
assert(docs.includes('Regra de intencao forte antes de etapa rigida'), 'Atualize docs/ARQUITETURA_AUTOMACAO_OFICIAL.md com a regra de intencao forte antes de etapa rigida.');

const conversationEngine = read('src/services/conversationEngine.js');
assert(conversationEngine.includes('strongQuantityShortcutFromText'), 'conversationEngine deve manter o roteador de intencao forte para quantidade.');
assert(conversationEngine.includes('quantity_selection_before_audio_complement'), 'Quantidade deve ser tratada antes dos complementos de audio.');
assert(!conversationEngine.includes('TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6'), 'Nao reintroduza o audio antigo TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6.');

if (failures.length) {
    console.error('\n[SENIOR-GUARD] Bloqueado. Corrija antes de continuar:\n');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
}

console.log('[SENIOR-GUARD] OK: core Vitalismen multiproduto EC e modos operacionais preservados.');

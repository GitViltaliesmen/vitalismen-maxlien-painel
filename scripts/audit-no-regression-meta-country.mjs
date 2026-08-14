import fs from 'fs';
import path from 'path';

const root = process.cwd();
const failures = [];
const warnings = [];
const ecSuffix = ['E', 'C'].join('');

const read = (file) => {
    const full = path.join(root, file);
    return fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : '';
};

const exists = (file) => fs.existsSync(path.join(root, file));

const assert = (condition, message) => {
    if (!condition) failures.push(message);
};

const warn = (message) => warnings.push(message);

const hasLine = (body, pattern) => new RegExp(`^${pattern}$`, 'm').test(body);

const env = read('.env');
const envExample = read('.env.example');
const qr = read('public/qr.html');
const leads = read('public/leads-window.html');
const meta = read('src/services/metaConversionsService.js');
const sessionRouter = read('src/whatsapp/sessionRouter.js');
const sellerRotation = read('src/services/sellerRotationService.js');
const whatsappRoute = read('src/routes/whatsapp.js');
const vslVisit = read('src/models/VslVisit.js');
const humanPacing = read('src/whatsapp/humanPacing.js');
const sendText = read('src/whatsapp/sendText.js');
const sendAudio = read('src/whatsapp/sendAudio.js');
const sendImage = read('src/whatsapp/sendImage.js');
const sendVideo = read('src/whatsapp/sendVideo.js');
const sendDocument = read('src/whatsapp/sendDocument.js');

assert(hasLine(env, 'META_PIXEL_ID_EC=.*'), '.env precisa manter META_PIXEL_ID_EC.');
assert(hasLine(env, 'META_ACCESS_TOKEN_EC=.*'), '.env precisa manter META_ACCESS_TOKEN_EC.');
assert(env.includes('VITALISMEN_OFFICIAL_ONLY=true'), '.env precisa manter VITALISMEN_OFFICIAL_ONLY=true.');
assert(env.includes('BOT_FORCE_AGENT=vit_power_ec'), '.env precisa manter BOT_FORCE_AGENT=vit_power_ec.');

assert(hasLine(envExample, `META_PIXEL_ID_${ecSuffix}=.*`), '.env.example precisa documentar META_PIXEL_ID_EC.');
assert(hasLine(envExample, `META_ACCESS_TOKEN_${ecSuffix}=.*`), '.env.example precisa documentar META_ACCESS_TOKEN_EC.');
assert(envExample.includes(`WHATSAPP_DEFAULT_SESSION_ID_${ecSuffix}=`), '.env.example precisa documentar session id EC.');
assert(envExample.includes('WHATSAPP_EC_ONLY_OUTBOUND=true'), '.env.example precisa documentar o bloqueio de saida EC-only.');

assert(meta.includes(`process.env.META_PIXEL_ID_${ecSuffix}`), 'metaConversionsService deve continuar usando META_PIXEL_ID_EC.');
assert(meta.includes(`process.env.META_ACCESS_TOKEN_${ecSuffix}`), 'metaConversionsService deve continuar usando META_ACCESS_TOKEN_EC.');
assert(whatsappRoute.includes('sendBrowserMetaEvent'), 'rota WhatsApp precisa manter envio Meta CAPI para VSL.');
assert(whatsappRoute.includes("eventName: 'PageView'"), 'vsl-entry precisa manter PageView CAPI.');
assert(whatsappRoute.includes("eventName: 'ViewContent'"), 'vsl-entry precisa manter ViewContent CAPI.');
assert(whatsappRoute.includes("eventName: 'InitiateCheckout'"), 'vsl-entry precisa manter InitiateCheckout CAPI.');
assert(whatsappRoute.includes("eventName: 'Lead'"), 'vsl-entry precisa manter Lead CAPI quando receber event_id explicito.');
assert(whatsappRoute.includes('pageViewEventId') || whatsappRoute.includes('page_view_event_id'), 'vsl-entry precisa aceitar event_id de PageView do browser.');
assert(vslVisit.includes('metaPageViewSentAt'), 'VslVisit precisa manter lock metaPageViewSentAt.');
assert(vslVisit.includes('metaViewContentSentAt'), 'VslVisit precisa manter lock metaViewContentSentAt.');
assert(vslVisit.includes('metaInitiateCheckoutSentAt'), 'VslVisit precisa manter lock metaInitiateCheckoutSentAt.');
assert(vslVisit.includes('metaLeadSentAt'), 'VslVisit precisa manter lock metaLeadSentAt.');
assert(vslVisit.includes('metaPageViewResponse') && vslVisit.includes('metaLeadResponse'), 'VslVisit precisa guardar respostas Meta PageView/Lead.');
assert(sessionRouter.includes('defaultSessionId'), 'sessionRouter precisa manter o resolver de default por pais.');
assert(sessionRouter.includes("WHATSAPP_DEFAULT_SESSION_ID_"), 'sessionRouter precisa manter defaults por pais.');
assert(sessionRouter.includes('resolveOutboundSessionForJid'), 'sessionRouter precisa manter o resolvedor por pais.');
assert(sessionRouter.includes('country'), 'sessionRouter precisa permanecer country-aware.');

assert(!sellerRotation.includes('WHATSAPP_SELLER_POOL_' + ['C', 'O'].join('')), 'sellerRotationService nao pode manter pool de outro pais.');
assert(sellerRotation.includes('WHATSAPP_SELLER_E164') || sellerRotation.includes('country'), 'sellerRotationService precisa continuar roteando a operacao Ecuador.');

assert(whatsappRoute.includes('manual_panel'), 'rota WhatsApp precisa manter o caminho manual_panel.');
assert(qr.includes('state.selectedChat?.country || selectedOperationalCountry() || \'EC\''), 'painel manual precisa continuar enviando o country correto.');
assert(whatsappRoute.includes('country:'), 'rota WhatsApp precisa continuar enviando country nos requests manuais.');
assert(!whatsappRoute.includes("c.zapiCapturedContact || isAllowedPanelPhoneForCountry(c.phone, countryFilter)"), 'painel nao pode usar zapiCapturedContact como passe livre para outro pais.');
assert(!whatsappRoute.includes("{ 'metadata.zapiCapturedContact': true }"), 'filtro por pais nao pode listar contatos Z-API sem validar Ecuador.');

assert(humanPacing.includes('manual_panel') || sendText.includes('manual_panel'), 'pacing manual deve continuar separado do bot.');
assert(sendText.includes('country'), 'sendText precisa continuar passando country para a sessao.');
assert(sendAudio.includes('country'), 'sendAudio precisa continuar passando country para a sessao.');
assert(sendImage.includes('country'), 'sendImage precisa continuar passando country para a sessao.');
assert(sendVideo.includes('country'), 'sendVideo precisa continuar passando country para a sessao.');
assert(sendDocument.includes('country'), 'sendDocument precisa continuar passando country para a sessao.');

assert(qr.includes('leadDashboardFrame'), 'public/qr.html precisa manter leadDashboardFrame.');
assert(qr.includes('leadDashboardOpenLink'), 'public/qr.html precisa manter leadDashboardOpenLink.');
assert(qr.includes('/leads-window.html?country=EC'), 'public/qr.html precisa manter o path same-domain do painel.');
assert(qr.includes('srcdoc = `'), 'public/qr.html precisa continuar embutindo o Painel Unificado no frame.');
assert(leads.includes('Recentes 7 dias'), 'public/leads-window.html precisa manter o filtro Recentes 7 dias.');

assert(exists('src/services/metaConversionsService.js'), 'metaConversionsService deve existir.');
assert(exists('src/models/VslVisit.js'), 'VslVisit model deve existir.');
assert(exists('src/whatsapp/sessionRouter.js'), 'sessionRouter deve existir.');
assert(exists('src/services/sellerRotationService.js'), 'sellerRotationService deve existir.');
assert(exists('public/qr.html'), 'painel principal public/qr.html deve existir.');
assert(exists('public/leads-window.html'), 'Leads Clientes public/leads-window.html deve existir.');

if (warnings.length) {
    for (const warning of warnings) {
        console.warn(`[REGRESSION-AUDIT] ${warning}`);
    }
}

if (failures.length) {
    console.error('\n[REGRESSION-AUDIT] Bloqueado. Corrija antes de publicar:\n');
    for (const failure of failures) {
        console.error(`- ${failure}`);
    }
    process.exit(1);
}

console.log('[REGRESSION-AUDIT] OK: Meta EC e painel Ecuador sem regressao.');

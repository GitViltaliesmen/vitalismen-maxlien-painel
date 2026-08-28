const exactString = (value) => String(value ?? '').trim();

export const DEPLOY_HEALTH_V76_EXPECTED_SAFETY = Object.freeze({
    mode: 'SAFE_OBSERVATION_ONLY',
    policy: 'STRICT_READ_ONLY',
    strictReadOnly: true,
    zapiReadOnlyStatusAllowed: true,
    zapiInboundPersistenceAllowed: false,
    zapiAckPersistenceAllowed: false,
    baileysEnabled: false,
    mutatingRoutesEnabled: false,
    mutatingSchedulers: 0,
    operationalMutationsEnabled: false,
    compatibilityBridgeComplete: true,
    dataCompatibilityVersion: 66,
    minimumRuntimeVersion: 66,
    dropiSyncMode: 'REPORT_ONLY',
    dropiApplyAllowed: false
});

export const DEPLOY_HEALTH_V76_EXPECTED_RUNTIME_ENV = Object.freeze({
    VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED: 'false',
    VITALISMEN_STRICT_READ_ONLY: 'true',
    SAFE_OBSERVATION_POLICY: 'STRICT_READ_ONLY',
    VIT_POWER_FUNNEL_ACTIVE: 'false',
    WHATSAPP_CONNECT_ENABLED: 'false',
    WHATSAPP_AUTO_REPLY_ENABLED: 'false',
    ZAPI_ROUTE_INBOUND_TO_BOT: 'false',
    ZAPI_PERSIST_INBOUND_ENABLED: 'false',
    ZAPI_PERSIST_ACK_ENABLED: 'false',
    VSL_STAGE_PERSIST_ENABLED: 'false',
    WHATSAPP_FUNNEL_ENABLED: 'false',
    DISABLE_SCHEDULER: '1',
    SHIPMENT_STATUS_DISPATCH_ENABLED: 'false',
    SHIPMENT_PICKUP_REMINDERS_ENABLED: 'false',
    WHATSAPP_PRODUCT_FOLLOWUP_ENABLED: 'false',
    PENDING_CHECKOUT_FOLLOWUP_ENABLED: 'false',
    ADMIN_BUY_LATER_FOLLOWUP_ENABLED: 'false',
    POST_SALE_REPURCHASE_30D_ENABLED: 'false',
    EC_ENGAGEMENT_AUTO_REPLY_ENABLED: 'false',
    PICKUP_PROOF_SWEEP_ENABLED: 'false',
    DROPPI_EC_ACTIVE_SYNC_ENABLED: 'false',
    DROPPI_EC_ACTIVE_SYNC_MODE: 'REPORT_ONLY',
    POST_SALE_V66_MUTATIONS_ENABLED: 'false',
    POST_SALE_V66_MUTATIONS_AUTHORIZATION: '',
    POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: 'false',
    POST_SALE_V66_BRIDGE_APPLY_APPROVED: ''
});

const result = (failures) => Object.freeze({
    ok: failures.length === 0,
    failures: Object.freeze(failures)
});

export const evaluateDeployHealthBridgeSemanticsV76 = (health = {}) => {
    const safety = health?.automationSafety || {};
    const failures = [];

    if (health?.status !== 'online') failures.push('health_status_must_be_online');
    if (!Array.isArray(health?.degradedReasons) || health.degradedReasons.length !== 0) {
        failures.push('degraded_reasons_must_be_empty');
    }
    if (!Array.isArray(safety.allowedWriteClasses) || safety.allowedWriteClasses.length !== 0) {
        failures.push('allowed_write_classes_must_be_empty');
    }

    for (const [field, expected] of Object.entries(DEPLOY_HEALTH_V76_EXPECTED_SAFETY)) {
        if (field === 'dataCompatibilityVersion' || field === 'minimumRuntimeVersion') {
            if (Number(safety[field]) !== expected) failures.push(`${field}_must_equal_${expected}`);
            continue;
        }
        if (safety[field] !== expected) failures.push(`${field}_must_equal_${String(expected)}`);
    }

    return result(failures);
};

export const assertDeployHealthBridgeSemanticsV76 = (health = {}) => {
    const evaluation = evaluateDeployHealthBridgeSemanticsV76(health);
    if (!evaluation.ok) {
        throw new Error(`[DEPLOY-HEALTH-BRIDGE-SEMANTICS-V76] health bloqueado: ${evaluation.failures.join(',')}`);
    }
    return evaluation;
};

export const evaluateDeployHealthRuntimeContainmentV76 = (env = {}) => {
    const failures = [];
    for (const [field, expected] of Object.entries(DEPLOY_HEALTH_V76_EXPECTED_RUNTIME_ENV)) {
        if (exactString(env[field]) !== expected) failures.push(`${field}_must_equal_${expected || 'EMPTY'}`);
    }
    return result(failures);
};

export const assertDeployHealthRuntimeContainmentV76 = (env = {}) => {
    const evaluation = evaluateDeployHealthRuntimeContainmentV76(env);
    if (!evaluation.ok) {
        throw new Error(`[DEPLOY-HEALTH-BRIDGE-SEMANTICS-V76] runtime bloqueado: ${evaluation.failures.join(',')}`);
    }
    return evaluation;
};

const functionBlock = (source, name, nextName) => {
    const start = source.indexOf(`${name}() {`);
    const end = source.indexOf(`\n${nextName}() {`, start + 1);
    if (start < 0 || end < 0) throw new Error(`função ${name} ausente no helper`);
    return source.slice(start, end);
};

const requireSnippet = (source, snippet, label) => {
    if (!source.includes(snippet)) throw new Error(`contrato ausente: ${label}`);
};

export const assertDeployHelperBridgeSemanticsSourceV76 = (source = '') => {
    const helper = String(source || '');
    const healthBlock = functionBlock(helper, 'wait_candidate_health_v66', 'source_health_if_required');
    const profileBlock = functionBlock(helper, 'safe_profile_content', 'safe_profile_sha256');
    const pm2Block = functionBlock(helper, 'safe_pm2', 'verify_candidate_pm2_safe_env');
    const pm2VerifyBlock = functionBlock(helper, 'verify_candidate_pm2_safe_env', 'write_audit_event');

    if (healthBlock.includes('safety.compatibilityBridgeComplete !== false')) {
        throw new Error('predicado legado confunde migração persistente com bridge operacional');
    }
    requireSnippet(
        healthBlock,
        "safety.compatibilityBridgeComplete !== true",
        'bridgeComplete=true como prova persistente'
    );
    requireSnippet(healthBlock, 'Number(safety.dataCompatibilityVersion) !== 66', 'data compatibility V66');
    requireSnippet(healthBlock, 'Number(safety.minimumRuntimeVersion) !== 66', 'runtime mínimo V66');
    requireSnippet(healthBlock, 'safety.operationalMutationsEnabled !== false', 'mutações bloqueadas no health');
    requireSnippet(healthBlock, 'safety.mutatingSchedulers !== 0', 'schedulers mutantes zerados');
    requireSnippet(healthBlock, "safety.dropiSyncMode !== 'REPORT_ONLY'", 'Dropi REPORT_ONLY');
    requireSnippet(healthBlock, 'safety.dropiApplyAllowed !== false', 'Dropi APPLY bloqueado');

    for (const block of [profileBlock, pm2Block]) {
        requireSnippet(block, 'DISABLE_SCHEDULER=1', 'scheduler global desligado');
        requireSnippet(block, 'DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY', 'Dropi em REPORT_ONLY');
        requireSnippet(block, 'POST_SALE_V66_MUTATIONS_ENABLED=false', 'mutações V66 desligadas');
        requireSnippet(block, 'POST_SALE_V66_MUTATIONS_AUTHORIZATION=', 'autorização V66 vazia');
        requireSnippet(block, 'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false', 'bridge operacional desligada');
        requireSnippet(block, 'POST_SALE_V66_BRIDGE_APPLY_APPROVED=', 'autorização bridge vazia');
    }
    requireSnippet(
        pm2VerifyBlock,
        'POST_SALE_V66_COMPATIBILITY_BRIDGE_READY: "false"',
        'verificação PM2 da bridge operacional'
    );
    requireSnippet(pm2VerifyBlock, 'autorização de mutação presente', 'verificação de autorização V66 vazia');
    requireSnippet(pm2VerifyBlock, 'autorização de bridge presente', 'verificação de autorização bridge vazia');

    return Object.freeze({
        healthPersistentBridgeRequired: true,
        operationalBridgeReady: false,
        dataCompatibilityVersion: 66,
        minimumRuntimeVersion: 66,
        mutationAuthorization: '',
        bridgeAuthorization: '',
        mutatingSchedulers: 0,
        dropiMode: 'REPORT_ONLY'
    });
};

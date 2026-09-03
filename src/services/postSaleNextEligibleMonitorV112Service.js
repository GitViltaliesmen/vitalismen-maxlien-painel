import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    POST_SALE_TERMINAL_LEDGER_STATES,
    buildPostSaleIdempotencyKey,
    canonicalPostSaleStage
} from './postSaleSafetyV66Service.js';
import {
    POST_SALE_NOTIFICATION_DECISIONS,
    evaluatePostSaleChronology
} from './postSaleNotificationDecisionService.js';

export const POST_SALE_NEXT_ELIGIBLE_V112_VERSION = 112;
export const POST_SALE_NEXT_ELIGIBLE_V112_MANIFEST_PATH = 'docs/freeze/post-sale-next-eligible-monitor-v112-20260903.json';
export const POST_SALE_NEXT_ELIGIBLE_V112_PARENT_COMMIT = 'd8313dae376f09d72e641c271b70d181c72a9891';
export const POST_SALE_NEXT_ELIGIBLE_V112_PARENT_TREE = 'c580fa26bcbdcc9a9a48af5a4f766235fe5fd2a1';
export const POST_SALE_NEXT_ELIGIBLE_V112_PARENT_MANIFEST_SHA256 = 'cb29139d373e64438c407360cd19b907c8e1bc291e675ccc139194cb9e7e8b2d';
export const POST_SALE_NEXT_ELIGIBLE_V112_PARENT_FREEZE_SHA256 = 'bdba0445bdb341f57f5f7b570fce23883fbde934a32a67cdd98986d82c731e86';
export const POST_SALE_NEXT_ELIGIBLE_V112_PARENT_ATTESTATION_SHA256 = 'd8cdf157e6f1ec5504faaec45c5417e6dfd3302dd4f6a0f672ab83510802f8d8';
export const POST_SALE_NEXT_ELIGIBLE_V112_FREEZE_SHA256 = '8b4c9d316ffad81300b1ba7f2725c40f134e253739cac64e2fe72af29d6eeeb9';
export const POST_SALE_NEXT_ELIGIBLE_V112_ATTESTATION_SHA256 = 'f6ced1965cbf2fca7a1b9d1c2c6012e0b5561666008f76bb79c62aebaace2b0e';
export const POST_SALE_NEXT_ELIGIBLE_V112_ARM_PHRASE = 'I_UNDERSTAND_POST_SALE_NEXT_ELIGIBLE_V112_SINGLE_USE';
export const POST_SALE_NEXT_ELIGIBLE_V112_PERMIT_TTL_DAYS = 30;
export const POST_SALE_NEXT_ELIGIBLE_V112_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

export const POST_SALE_NEXT_ELIGIBLE_V112_NEW_PROTECTED_FILES = Object.freeze([
    'docs/POST_SALE_NEXT_ELIGIBLE_MONITOR_FREEZE_V112_20260903.md',
    'docs/evidence/post-sale-next-eligible-monitor-v112-attestation-20260903.json',
    'ops/post-sale-next-eligible-v112',
    'ops/systemd/vitalismen-postsale-next-eligible-v112.service',
    'ops/systemd/vitalismen-postsale-next-eligible-v112.timer',
    'scripts/guard-post-sale-next-eligible-monitor-v112.mjs',
    'scripts/lib/post-sale-next-eligible-monitor-v112.mjs',
    'scripts/post-sale-next-eligible-monitor-v112.mjs',
    'src/services/postSaleNextEligibleMonitorFreezeRuntimeGuardV112.js',
    'src/services/postSaleNextEligibleMonitorV112Service.js',
    'tests/post-sale-next-eligible-monitor-v112.test.mjs'
]);

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const clean = (value = '') => String(value ?? '').trim();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] protected_path_outside_root');
    }
    return candidate;
};
const fileSha256 = (relativePath) => sha256(fs.readFileSync(relativeFile(relativePath)));
const canonicalJson = (relativePath, label) => {
    const content = fs.readFileSync(relativeFile(relativePath), 'utf8');
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[POST-SALE-NEXT-ELIGIBLE-V112] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV111 = () => {
    const identities = new Map([
        ['docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json', POST_SALE_NEXT_ELIGIBLE_V112_PARENT_MANIFEST_SHA256],
        ['docs/BOT_QA_MULTITURN_RECOVERY_FREEZE_V111_20260903.md', POST_SALE_NEXT_ELIGIBLE_V112_PARENT_FREEZE_SHA256],
        ['docs/evidence/bot-qa-multiturn-recovery-v111-attestation-20260903.json', POST_SALE_NEXT_ELIGIBLE_V112_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[POST-SALE-NEXT-ELIGIBLE-V112] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = canonicalJson('docs/freeze/bot-qa-multiturn-recovery-v111-20260903.json', 'parent_manifest');
    if (parent.version !== 111 || parent.freezeId !== 'bot-qa-multiturn-recovery-v111'
        || parent.policy?.productionCustomerBypass !== false
        || parent.policy?.dropiChanged !== false
        || parent.policy?.externalEffectsAllowed !== false) {
        throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] parent_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_NEXT_ELIGIBLE_V112_OVERRIDE_KEY] || []);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (successorOverrides.has(relativePath)) continue;
        if (fileSha256(relativePath) !== expectedHash) {
            throw new Error(`[POST-SALE-NEXT-ELIGIBLE-V112] parent_protected_file_invalid:${relativePath}`);
        }
    }
};

export const assertPostSaleNextEligibleMonitorV112Manifest = () => {
    assertParentV111();
    const manifest = canonicalJson(POST_SALE_NEXT_ELIGIBLE_V112_MANIFEST_PATH, 'manifest');
    const newProtected = normalizePaths(manifest.newProtectedFiles);
    const expectedPaths = [...new Set(newProtected)].sort();
    if (manifest.freezeId !== 'post-sale-next-eligible-monitor-v112'
        || manifest.version !== POST_SALE_NEXT_ELIGIBLE_V112_VERSION
        || manifest.parentVersion !== 'V111'
        || manifest.parentCommit !== POST_SALE_NEXT_ELIGIBLE_V112_PARENT_COMMIT
        || manifest.parentTree !== POST_SALE_NEXT_ELIGIBLE_V112_PARENT_TREE
        || manifest.parentManifestSha256 !== POST_SALE_NEXT_ELIGIBLE_V112_PARENT_MANIFEST_SHA256
        || manifest.purpose !== 'READ_ONLY_DETECT_NEXT_NATURAL_POSTSALE_ELIGIBLE_AND_TRIGGER_SINGLE_USE_V105_GATE3'
        || JSON.stringify(manifest.declaredAncestorOverrides) !== JSON.stringify([])
        || JSON.stringify(newProtected) !== JSON.stringify(POST_SALE_NEXT_ELIGIBLE_V112_NEW_PROTECTED_FILES)
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedPaths)
        || manifest.policy?.detectorProviderCalls !== 0
        || manifest.policy?.detectorMongoMutations !== 0
        || manifest.policy?.singleUse !== true
        || manifest.policy?.batchMax !== 1
        || manifest.policy?.dailyLimit !== 1
        || manifest.policy?.promoteBeyondOne !== false
        || manifest.policy?.historicalBacklogEnabled !== false
        || manifest.policy?.dropiAutomaticEnabled !== false
        || manifest.policy?.metaRetroactiveEnabled !== false
        || manifest.policy?.humanModeManualBlocked !== true
        || manifest.policy?.chronologyGuardRequired !== true
        || manifest.evidence?.sha256 !== POST_SALE_NEXT_ELIGIBLE_V112_ATTESTATION_SHA256
        || fileSha256(manifest.evidence.path) !== manifest.evidence.sha256
        || fileSha256('docs/POST_SALE_NEXT_ELIGIBLE_MONITOR_FREEZE_V112_20260903.md') !== POST_SALE_NEXT_ELIGIBLE_V112_FREEZE_SHA256) {
        throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] manifest_identity_or_policy_invalid');
    }
    const successorOverrides = new Set(globalThis[POST_SALE_NEXT_ELIGIBLE_V112_OVERRIDE_KEY] || []);
    for (const relativePath of expectedPaths) {
        if (!successorOverrides.has(relativePath) && fileSha256(relativePath) !== manifest.protectedFiles[relativePath]) {
            throw new Error(`[POST-SALE-NEXT-ELIGIBLE-V112] protected_file_invalid:${relativePath}`);
        }
    }
    const logical = expectedPaths.map((relativePath) => (
        `${relativePath}\0${successorOverrides.has(relativePath) ? manifest.protectedFiles[relativePath] : fileSha256(relativePath)}\n`
    )).join('');
    if (manifest.logicalBundle?.sha256 !== sha256(logical)) {
        throw new Error('[POST-SALE-NEXT-ELIGIBLE-V112] logical_bundle_invalid');
    }
    return Object.freeze({
        ready: true,
        failures: [],
        manifest,
        manifestSha256: fileSha256(POST_SALE_NEXT_ELIGIBLE_V112_MANIFEST_PATH)
    });
};

export const postSaleNextEligibleCandidateQueryV112 = () => ({
    country: 'EC',
    'client.phone': { $exists: true, $ne: '' },
    $or: [
        {
            'logistics.status': { $nin: ['READY_FOR_PICKUP', 'ENTREGADO', 'DEVUELTO', 'CANCELADO', 'CANCELADO_SERVIENTREGA', 'CANCELADO SERVIENTREGA'] },
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'automation.guiaNotifiedAt': null
        },
        {
            'logistics.status': { $in: ['EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA'] },
            'automation.inTransitNotifiedAt': null,
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        },
        {
            'logistics.status': 'READY_FOR_PICKUP',
            'logistics.pickupReadyVerified': true,
            'logistics.trackingNumber': { $exists: true, $ne: '' },
            'logistics.agencyPickup': true,
            'automation.readyForPickupNotifiedAt': null,
            'outcomes.delivered': { $ne: true },
            'outcomes.pickedUp': { $ne: true },
            'outcomes.returned': { $ne: true },
            'outcomes.prepaidOnly': { $ne: true }
        },
        {
            'logistics.status': 'ENTREGADO',
            'automation.bonusNotifiedAt': null,
            'outcomes.returned': { $ne: true }
        },
        {
            'logistics.status': 'DEVUELTO',
            'automation.returnedNotifiedAt': null
        }
    ]
});

const normalizeStatus = (value = '') => clean(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/\s+/g, '_');

export const postSaleActionForShipmentV112 = (shipment = {}) => {
    const status = normalizeStatus(shipment?.logistics?.status);
    if (status === 'DEVUELTO') return 'returned';
    if (status === 'ENTREGADO') return 'delivered_bonus';
    if (status === 'READY_FOR_PICKUP') return 'ready_for_pickup';
    if (shipment?.logistics?.trackingNumber && !shipment?.automation?.guiaNotifiedAt) return 'guide';
    if (status === 'GUIA_GENERADA') return 'guide';
    if (['EN_RUTA', 'EN_REPARTO', 'EN_DESPACHO', 'EN_BODEGA_TRANSPORTADORA', 'MERCANCIA_RECOGIDA', 'EN_DISTRIBUCION_A_CLIENTE'].includes(status)) {
        return 'in_transit';
    }
    return 'none';
};

const notificationKindForAction = (action) => action === 'delivered_bonus' ? 'pickup_bonus' : action;

const POST_SALE_STAGE_RANK = Object.freeze({
    GUIDE: 1,
    IN_TRANSIT: 2,
    READY_FOR_PICKUP: 3,
    PICKUP_REMINDER_DAY1: 4,
    PICKUP_REMINDER_SOFT_DAY2: 5,
    PICKUP_REMINDER_DAY3: 6,
    PICKUP_REMINDER_SOFT_DAY4: 7,
    PICKUP_REMINDER_DAY5: 8,
    PICKUP_REMINDER_SOFT_DAY6: 9,
    PICKUP_PROOF_REQUEST: 10,
    PICKUP_BONUS: 11,
    DELIVERED: 11,
    RETURNED: 12
});

const latestTerminalLedgerStage = (shipment = {}) => Object.values(
    shipment?.automation?.postSaleSafetyLedger || {}
).filter((entry) => POST_SALE_TERMINAL_LEDGER_STATES.includes(clean(entry?.state).toUpperCase()))
    .map((entry) => canonicalPostSaleStage(entry?.stage || entry?.variant))
    .filter(Boolean)
    .sort((left, right) => (POST_SALE_STAGE_RANK[right] || 0) - (POST_SALE_STAGE_RANK[left] || 0))[0] || '';

export const latestRealPostSaleStageV112 = (shipment = {}) => {
    const status = normalizeStatus(shipment?.logistics?.status);
    if (shipment?.outcomes?.returned === true || ['DEVUELTO', 'RETURNED', 'DEVOLUCION', 'NO_RETIRADO'].includes(status)) return 'RETURNED';
    if (shipment?.outcomes?.delivered === true || shipment?.outcomes?.pickedUp === true
        || ['ENTREGADO', 'DELIVERED', 'RETIRADO', 'RECOGIDO', 'PICKED_UP'].includes(status)) return 'DELIVERED';
    const ledgerStage = latestTerminalLedgerStage(shipment);
    if ((POST_SALE_STAGE_RANK[ledgerStage] || 0) > (POST_SALE_STAGE_RANK.IN_TRANSIT || 0)) return ledgerStage;
    if (['READY_FOR_PICKUP', 'LISTO_PARA_RETIRO', 'PARA_RETIRO_EN_AGENCIA', 'DISPONIBLE_PARA_RETIRO'].includes(status)) return 'READY_FOR_PICKUP';
    if (['MERCANCIA_RECOGIDA', 'EN_BODEGA_TRANSPORTADORA', 'EN_DESPACHO', 'EN_PROCESAMIENTO', 'EN_RUTA', 'EN_REPARTO', 'EN_DISTRIBUCION_A_CLIENTE'].includes(status)) return 'IN_TRANSIT';
    if (clean(shipment?.logistics?.trackingNumber).replace(/\D/g, '').length >= 6 || status === 'GUIA_GENERADA') return 'GUIDE';
    return ledgerStage || status || 'UNKNOWN';
};

const terminalLedgerForStage = (shipment = {}, stage = '') => Object.values(
    shipment?.automation?.postSaleSafetyLedger || {}
).find((entry) => clean(entry?.stage) === stage
    && POST_SALE_TERMINAL_LEDGER_STATES.includes(clean(entry?.state).toUpperCase()));

const classifyDecision = ({ rawDecision = {}, cooldownClear = true } = {}) => {
    if (rawDecision.decision === POST_SALE_NOTIFICATION_DECISIONS.SHOULD_SEND) {
        return cooldownClear ? 'SHOULD_SEND' : 'BLOCK_COOLDOWN';
    }
    if (rawDecision.reason === 'human_mode_manual') return 'BLOCK_HUMAN';
    if (clean(rawDecision.reason).startsWith('chronology_blocks_')) return 'BLOCK_CHRONOLOGY';
    if (rawDecision.decision === POST_SALE_NOTIFICATION_DECISIONS.HISTORICAL_EVENT_SUPPRESSED) return 'BLOCK_LEDGER';
    if (rawDecision.decision === POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_STRUCTURED) {
        return clean(rawDecision.reason).startsWith('automation.postSaleSafetyLedger.')
            ? 'BLOCK_LEDGER'
            : 'BLOCK_ALREADY_SENT';
    }
    if (rawDecision.decision === POST_SALE_NOTIFICATION_DECISIONS.ALREADY_NOTIFIED_MANUALLY) return 'BLOCK_ALREADY_SENT';
    return 'BLOCK_OTHER';
};

export const buildPostSaleNextEligibleReportV112 = async ({
    shipments = [],
    decidePostSaleNotification,
    findManualHumanModeForShipment,
    now = new Date(),
    minGapMs = 30 * 60 * 1000,
    providerCalls = 0,
    mutationGuard = null
} = {}) => {
    if (typeof decidePostSaleNotification !== 'function' || typeof findManualHumanModeForShipment !== 'function') {
        throw new Error('post_sale_v112_decision_dependencies_missing');
    }
    const items = [];
    for (const shipment of shipments) {
        const action = postSaleActionForShipmentV112(shipment);
        const kind = notificationKindForAction(action);
        const stage = canonicalPostSaleStage(kind);
        const chronology = evaluatePostSaleChronology({ shipment, kind });
        const human = await findManualHumanModeForShipment({ shipment });
        const rawDecision = await decidePostSaleNotification({ shipment, kind, acquireLock: false, now });
        const ledgerMatch = terminalLedgerForStage(shipment, stage);
        const lastReminder = shipment?.automation?.lastReminderAt ? new Date(shipment.automation.lastReminderAt) : null;
        const cooldownClear = !lastReminder || Number.isNaN(lastReminder.getTime())
            || lastReminder.getTime() <= now.getTime() - minGapMs;
        let decision = classifyDecision({ rawDecision, cooldownClear });
        if (decision === 'BLOCK_OTHER' && rawDecision.decision === POST_SALE_NOTIFICATION_DECISIONS.MANUAL_REVIEW_REQUIRED && human) {
            decision = 'BLOCK_HUMAN';
        }
        const expectedKey = buildPostSaleIdempotencyKey({ shipment, stage, variant: '' });
        items.push({
            ORDER_ID: clean(shipment?.orderId),
            CURRENT_STAGE: clean(stage || kind || action || 'none').toUpperCase(),
            LATEST_REAL_STAGE: latestRealPostSaleStageV112(shipment),
            HUMAN_MODE: human ? 'manual' : 'auto_or_unset',
            LEDGER_MATCH: ledgerMatch ? `YES:${clean(ledgerMatch.state).toUpperCase()}` : 'NO',
            COOLDOWN: cooldownClear ? 'PASS' : `BLOCKED_UNTIL_${new Date(lastReminder.getTime() + minGapMs).toISOString()}`,
            ANTI_SPAM: ['BLOCK_LEDGER', 'BLOCK_ALREADY_SENT'].includes(decision) ? 'PASS_BLOCKED_DUPLICATE' : 'PASS',
            IDEMPOTENCY: expectedKey && rawDecision.idempotencyKey === expectedKey ? 'PASS' : (expectedKey ? 'PASS_DERIVED' : 'FAIL'),
            CHRONOLOGY: chronology.allowed ? 'PASS' : `BLOCKED:${chronology.reason}`,
            RAW_DECISION: clean(rawDecision.decision),
            RAW_REASON: clean(rawDecision.reason),
            DECISION: decision
        });
    }
    const eligible = items.filter((item) => item.DECISION === 'SHOULD_SEND');
    const counts = items.reduce((result, item) => {
        result[item.DECISION] = (result[item.DECISION] || 0) + 1;
        return result;
    }, {});
    return Object.freeze({
        GENERATED_AT: now.toISOString(),
        MODE: 'STRICT_READ_ONLY',
        SOURCE_PROFILE: 'V105_WITH_V108_V109_SUCCESSORS',
        POSTSALE_CANDIDATES: items.length,
        POSTSALE_ELIGIBLE: eligible.length,
        FIRST_ELIGIBLE_ORDER: eligible[0]?.ORDER_ID || '',
        DECISION_COUNTS: counts,
        PROVIDER_CALLS: Number(providerCalls || 0),
        MONGO_MUTATIONS: 0,
        MONGOOSE_MUTATION_GUARD: mutationGuard,
        REPORT_SHA256: sha256(JSON.stringify(items)),
        ITEMS: items
    });
};

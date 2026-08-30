import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    EC_OFFICIAL_VSL_V78_MESSAGE,
    EC_OFFICIAL_VSL_V78_URL,
    EC_OFFICIAL_VSL_V78_WHATSAPP,
    recognizeOfficialEcVslEntryV78
} from './ecOfficialVslEntryV78Service.js';
import { claimEcQaInboundContextV78 } from './ecBotCoreRuntimeIntegrationV78Service.js';
import { EC_QA_TEST_PHONE_V78 } from './ecQaTestResetV78Service.js';

export const EC_VSL_DASHBOARD_INGRESS_V90_PARENT_COMMIT = '04a68c3f31be290ca1524cef3b0c6ef4e6d712fb';
export const EC_VSL_DASHBOARD_INGRESS_V90_PARENT_TREE = '44e9fe5670d7093867b7a97ba7444620e476d5a1';
export const EC_VSL_DASHBOARD_INGRESS_V90_PARENT_MANIFEST_SHA256 = '1af1407c551392ad4f292bff3a94019996f778c515b30415e146b6998b2180f8';
export const EC_VSL_DASHBOARD_INGRESS_V90_PARENT_FREEZE_SHA256 = '3afc6c7cad6a33649ae58da105026861960cc337d1e4dced105402cef9eb5a1e';
export const EC_VSL_DASHBOARD_INGRESS_V90_PARENT_ATTESTATION_SHA256 = 'abe2421b2a030a1ff54fcc7dad570dc1776dd196f8f0f3489f903493fc876729';
export const EC_VSL_DASHBOARD_INGRESS_V90_MANIFEST_PATH = 'docs/freeze/ec-vsl-dashboard-ingress-v90-20260830.json';
export const EC_VSL_DASHBOARD_INGRESS_V90_OVERRIDE_KEY = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const modifiedParentProtectedFiles = Object.freeze([
    'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
    'docs/ARQUIVOS_OFICIAIS.md',
    'ops/ec-bot-core-v78',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs',
    'src/routes/zapi.js',
    'src/services/ecBotCoreControlPlaneV89Service.js',
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
    'src/services/ecOfficialVslEntryV78Service.js'
]);
const newProtectedFiles = Object.freeze([
    'docs/EC_VSL_DASHBOARD_INGRESS_FREEZE_V90_20260830.md',
    'docs/evidence/ec-vsl-dashboard-ingress-v90-attestation-20260830.json',
    'scripts/guard-ec-vsl-dashboard-ingress-v90.mjs',
    'src/services/ecVslDashboardIngressFreezeRuntimeGuardV90.js',
    'src/services/ecVslDashboardIngressV90Service.js',
    'tests/ec-vsl-dashboard-ingress-v90.test.mjs'
]);

const sha256Buffer = (value) => crypto.createHash('sha256').update(value).digest('hex');
const relativeFile = (relativePath) => {
    if (typeof relativePath !== 'string' || !relativePath || path.isAbsolute(relativePath)
        || relativePath.includes('..') || relativePath.includes('\\')) {
        throw new Error('[EC-VSL-DASHBOARD-V90] protected_path_invalid');
    }
    const candidate = path.resolve(root, relativePath);
    if (candidate !== root && !candidate.startsWith(`${root}${path.sep}`)) {
        throw new Error('[EC-VSL-DASHBOARD-V90] protected_path_outside_root');
    }
    return candidate;
};
const sha256File = (relativePath) => sha256Buffer(fs.readFileSync(relativeFile(relativePath)));
const readText = (relativePath) => fs.readFileSync(relativeFile(relativePath), 'utf8');
const readCanonicalJson = (relativePath, label) => {
    const content = readText(relativePath);
    const value = JSON.parse(content);
    if (content !== `${JSON.stringify(value, null, 2)}\n`) {
        throw new Error(`[EC-VSL-DASHBOARD-V90] ${label}_not_canonical`);
    }
    return value;
};
const normalizePaths = (value) => {
    if (!Array.isArray(value)) throw new Error('[EC-VSL-DASHBOARD-V90] paths_invalid');
    return value.map((relativePath) => {
        relativeFile(relativePath);
        return relativePath;
    });
};

const assertParentV89 = () => {
    const identities = new Map([
        ['docs/freeze/ec-bot-core-control-plane-v89-20260830.json', EC_VSL_DASHBOARD_INGRESS_V90_PARENT_MANIFEST_SHA256],
        ['docs/EC_BOT_CORE_CONTROL_PLANE_FREEZE_V89_20260830.md', EC_VSL_DASHBOARD_INGRESS_V90_PARENT_FREEZE_SHA256],
        ['docs/evidence/ec-bot-core-control-plane-v89-attestation-20260830.json', EC_VSL_DASHBOARD_INGRESS_V90_PARENT_ATTESTATION_SHA256]
    ]);
    for (const [relativePath, expectedHash] of identities) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-VSL-DASHBOARD-V90] parent_identity_invalid:${relativePath}`);
        }
    }
    const parent = readCanonicalJson('docs/freeze/ec-bot-core-control-plane-v89-20260830.json', 'parent_manifest');
    if (parent.version !== 89 || parent.purpose !== 'EC_BOT_CORE_PM2_CONTROL_PLANE_ISOLATION'
        || parent.policy?.mutatingSchedulersAllowed !== false
        || parent.policy?.dropiApplyAllowed !== false
        || parent.policy?.metaPurchaseAllowed !== false) {
        throw new Error('[EC-VSL-DASHBOARD-V90] parent_policy_invalid');
    }
    const modified = new Set(modifiedParentProtectedFiles);
    for (const [relativePath, expectedHash] of Object.entries(parent.protectedFiles || {})) {
        if (modified.has(relativePath)) continue;
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-VSL-DASHBOARD-V90] parent_protected_file_invalid:${relativePath}`);
        }
    }
    return parent;
};

export const evaluateEcVslDashboardIngressV90 = async () => {
    const failures = [];
    const officialPayload = [
        'Hola, quiero el tratamiento Tex Ultra.',
        'Nombre: Cliente Protocolo G',
        'CIUDAD: Quito',
        'PROVINCIA: Pichincha'
    ].join('\n');
    const recognition = recognizeOfficialEcVslEntryV78({
        text: officialPayload,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        sourceUrl: EC_OFFICIAL_VSL_V78_URL
    });
    if (!recognition.recognized) failures.push(`official_protocolo_g_not_recognized:${recognition.reason}`);
    if (EC_OFFICIAL_VSL_V78_URL !== 'https://vilaliemen.shop/protocolo-g') failures.push('official_url_not_protocolo_g');
    if (recognizeOfficialEcVslEntryV78({
        text: 'Hola, quiero el tratamiento',
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        sourceUrl: EC_OFFICIAL_VSL_V78_URL
    }).recognized) failures.push('generic_message_recognized');

    const persistenceOnly = await claimEcQaInboundContextV78({
        payload: {
            phone: EC_QA_TEST_PHONE_V78,
            messageId: 'v90-dashboard-persistence-only',
            text: { message: officialPayload }
        },
        model: { updateOne: async () => ({ modifiedCount: 0 }) },
        now: new Date('2026-08-30T03:00:00.000Z')
    });
    if (persistenceOnly.persistenceAllowed !== true || persistenceOnly.automationAllowed !== false
        || persistenceOnly.reason !== 'qa_dashboard_persistence_only') {
        failures.push('qa_persistence_only_contract_missing');
    }

    const integrationSource = readText('src/services/ecBotCoreRuntimeIntegrationV78Service.js');
    const zapiSource = readText('src/routes/zapi.js');
    const preloaderSource = readText('scripts/lib/ec-bot-core-control-plane-v89-successor-context.mjs');
    if (!integrationSource.includes('req.ecQaInboundPolicyV90')) failures.push('qa_request_policy_missing');
    if ((zapiSource.match(/!qaPersistenceOnly && result\.routeToBot/g) || []).length !== 2) {
        failures.push('qa_bot_suppression_not_applied_to_both_webhooks');
    }
    if ((zapiSource.match(/skip: qaPersistenceOnly \|\|/g) || []).length !== 2) {
        failures.push('qa_engagement_suppression_not_applied_to_both_webhooks');
    }
    if (!preloaderSource.includes('ecVslDashboardIngressFreezeRuntimeGuardV90.js')) {
        failures.push('v90_runtime_guard_not_loaded');
    }
    for (const relativePath of modifiedParentProtectedFiles) {
        if (!preloaderSource.includes(`'${relativePath}'`)) failures.push(`successor_override_missing:${relativePath}`);
    }
    return Object.freeze({
        ok: failures.length === 0,
        ready: failures.length === 0,
        failures: Object.freeze(failures),
        officialUrl: EC_OFFICIAL_VSL_V78_URL,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        qaPhone: EC_QA_TEST_PHONE_V78,
        officialMessageFixture: EC_OFFICIAL_VSL_V78_MESSAGE,
        dashboardPersistenceWithoutAutomation: persistenceOnly.persistenceAllowed === true
            && persistenceOnly.automationAllowed === false
    });
};

export const assertEcVslDashboardIngressManifestV90 = () => {
    assertParentV89();
    const manifest = readCanonicalJson(EC_VSL_DASHBOARD_INGRESS_V90_MANIFEST_PATH, 'manifest');
    const overrides = normalizePaths(manifest.declaredAncestorOverrides);
    const modified = normalizePaths(manifest.modifiedParentProtectedFiles);
    const created = normalizePaths(manifest.newProtectedFiles);
    const expectedProtected = [...new Set([...overrides, ...created])].sort();
    if (manifest.freezeId !== 'ec-vsl-dashboard-ingress-v90'
        || manifest.version !== 90 || manifest.parentVersion !== 'V89'
        || manifest.parentCommit !== EC_VSL_DASHBOARD_INGRESS_V90_PARENT_COMMIT
        || manifest.parentTree !== EC_VSL_DASHBOARD_INGRESS_V90_PARENT_TREE
        || manifest.purpose !== 'EC_PROTOCOLO_G_DASHBOARD_INGRESS_WITHOUT_UNARMED_AUTOMATION'
        || manifest.country !== 'EC'
        || JSON.stringify(overrides) !== JSON.stringify(modifiedParentProtectedFiles)
        || JSON.stringify(modified) !== JSON.stringify(modifiedParentProtectedFiles)
        || manifest.policy?.officialVslUrl !== 'https://vilaliemen.shop/protocolo-g'
        || manifest.policy?.officialWhatsapp !== '5515991418416'
        || manifest.policy?.qaPhone !== '5515998038637'
        || manifest.policy?.dashboardPersistenceWithoutBot !== true
        || manifest.policy?.externalVslFilesChanged !== false
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || JSON.stringify(Object.keys(manifest.protectedFiles || {}).sort()) !== JSON.stringify(expectedProtected)) {
        throw new Error('[EC-VSL-DASHBOARD-V90] manifest_identity_or_policy_invalid');
    }
    const logicalHash = sha256Buffer(Buffer.from(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileHash]) => `${relativePath}\0${fileHash}\n`)
            .join('')
    ));
    if (manifest.logicalBundle?.sha256 !== logicalHash) throw new Error('[EC-VSL-DASHBOARD-V90] logical_bundle_invalid');
    for (const [relativePath, expectedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (sha256File(relativePath) !== expectedHash) {
            throw new Error(`[EC-VSL-DASHBOARD-V90] protected_file_invalid:${relativePath}`);
        }
    }
    return Object.freeze({ manifest, overrides, manifestSha256: sha256File(EC_VSL_DASHBOARD_INGRESS_V90_MANIFEST_PATH) });
};

export const assertEcVslDashboardIngressV90 = async () => {
    const identity = assertEcVslDashboardIngressManifestV90();
    const result = await evaluateEcVslDashboardIngressV90();
    if (!result.ok) throw new Error(`[EC-VSL-DASHBOARD-V90] readiness_blocked:${result.failures.join(',')}`);
    return Object.freeze({ ...result, manifestSha256: identity.manifestSha256 });
};

export const ecVslDashboardIngressV90Files = Object.freeze({
    modifiedParentProtectedFiles,
    newProtectedFiles
});

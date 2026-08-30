import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
    getSuccessorOverrideFiles
} from './successorGuardContextService.js';

await import('../../scripts/lib/ec-bot-core-lifecycle-boot-v88-successor-context.mjs');

const root = process.cwd();
const directEntry = Boolean(process.argv[1])
    && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));
const markerPath = path.join(root, '.vitalismen-official-root');
const manifestPath = 'docs/freeze/ec-bot-core-structural-safety-v78-20260829.json';
const absoluteManifestPath = path.join(root, manifestPath);
const officialWorkspace = fs.existsSync(markerPath)
    && fs.readFileSync(markerPath, 'utf8').includes('VITALISMEN_OFFICIAL_PROJECT=vit_power_ec');

if (officialWorkspace || fs.existsSync(absoluteManifestPath)) {
    if (!fs.existsSync(absoluteManifestPath)) {
        throw new Error('[EC-BOT-CORE-STRUCTURAL-V78] manifesto V78 ausente na raiz oficial; execução bloqueada.');
    }

    const parentManifestPath = 'docs/freeze/canary-controller-health-policy-reset-v77h2-20260829.json';
    const parentManifestSha256 = '63e409d9bb72a109b2960ce1df24cc327e2ee97044d67e2eec0febb2a6b323d5';
    const parentCommit = '193faa1c919a02c524deba3263bc174b24775700';
    const parentTree = '124c6a0f46daf9f768014935a78bbba71c8f8d04';
    const successorOverrideKey = '__VITALISMEN_SUCCESSOR_OVERRIDE_FILES';

    const declaredAncestorOverrides = [
        'docs/ARQUITETURA_AUTOMACAO_OFICIAL.md',
        'docs/ARQUIVOS_OFICIAIS.md',
        'scripts/guard-deploy-health-bridge-semantics-v76.mjs',
        'scripts/guard-deploy-helper-v71-chain-alignment-safety-v72.mjs',
        'scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs',
        'scripts/guard-meta-partner-destination-registry-v73.mjs',
        'scripts/guard-protocolo-g-ad-metrics-v63.mjs',
        'scripts/guard-protocolo-g-conversion-v62.mjs',
        'scripts/senior-guard.mjs',
        'src/index.js',
        'src/services/canaryIsolationV75Service.js',
        'src/services/passiveFunnelObserverService.js',
        'src/services/salesHoursAnalyticsService.js',
        'src/services/zapiClient.js'
    ];
    const newProtectedFiles = [
        'docs/EC_BOT_CORE_STRUCTURAL_SAFETY_FREEZE_V78_20260829.md',
        'docs/evidence/ec-official-vsl-origin-v78-20260829.json',
        'ops/ec-bot-core-v78',
        'scripts/ec-qa-test-reset-v78.mjs',
        'scripts/guard-ec-bot-core-structural-v78.mjs',
        'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
        'src/services/ecBotCoreOperationalV78Service.js',
        'src/services/ecBotCoreRuntimeIntegrationV78Service.js',
        'src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js',
        'src/services/ecOfficialVslEntryV78Service.js',
        'src/services/ecQaTestResetV78Service.js',
        'src/services/mutableRuntimeArtifactV78Service.js',
        'tests/ec-bot-core-structural-v78.test.mjs'
    ];

    const absolute = (relativePath) => path.join(root, relativePath);
    const sha256 = (relativePath) => crypto.createHash('sha256')
        .update(fs.readFileSync(absolute(relativePath)))
        .digest('hex');
    const manifestContent = fs.readFileSync(absoluteManifestPath, 'utf8');
    const manifest = JSON.parse(manifestContent);
    const canonicalManifest = `${JSON.stringify(manifest, null, 2)}\n`;
    const expectedProtectedFiles = [...declaredAncestorOverrides, ...newProtectedFiles].sort();
    const protectedFiles = Object.keys(manifest.protectedFiles || {}).sort();
    const logicalBundleSha256 = crypto.createHash('sha256').update(
        Object.entries(manifest.protectedFiles || {})
            .sort(([left], [right]) => left.localeCompare(right))
            .map(([relativePath, fileSha256]) => `${relativePath}\0${fileSha256}\n`)
            .join('')
    ).digest('hex');

    if (
        manifestContent !== canonicalManifest
        || sha256(parentManifestPath) !== parentManifestSha256
        || manifest.freezeId !== 'ec-bot-core-structural-safety-v78'
        || manifest.version !== 78
        || manifest.parentVersion !== 'V77H2'
        || manifest.parentFreezeId !== 'canary-controller-health-policy-reset-v77h2'
        || manifest.parentManifestSha256 !== parentManifestSha256
        || manifest.parentCommit !== parentCommit
        || manifest.parentTree !== parentTree
        || manifest.status !== 'frozen'
        || manifest.publicationStatus !== 'local_commit_only_no_push_no_stage_no_deploy'
        || manifest.country !== 'EC'
        || manifest.policy?.canonicalRuntimeGuard !== 'node src/services/ecBotCoreStructuralSafetyFreezeRuntimeGuardV78.js'
        || manifest.policy?.profile !== 'EC_BOT_CORE_OPERATIONAL'
        || manifest.policy?.runtimeGuardChainVersion !== 71
        || manifest.policy?.dataCompatibilityVersion !== 66
        || manifest.policy?.datasetId !== '1468946114265008'
        || manifest.policy?.qaPhone !== '5515998038637'
        || manifest.policy?.mutableRuntimeRoot !== '/opt/vitalismen-automacao/shared/runtime'
        || manifest.policy?.mutatingSchedulersAllowed !== false
        || manifest.policy?.dropiApplyAllowed !== false
        || manifest.policy?.metaPurchaseAllowed !== false
        || manifest.policy?.productionMutationExecuted !== false
        || manifest.policy?.ancestorFailurePropagation !== 'FAIL_CLOSED'
        || manifest.deployment?.ready !== false
        || JSON.stringify(manifest.deployment?.blockers || []) !== JSON.stringify(['OFFICIAL_VSL_ORIGIN_CONTRACT_DIVERGENT'])
        || manifest.logicalBundle?.algorithm !== 'SHA-256'
        || manifest.logicalBundle?.format !== 'sorted-relative-path-NUL-file-sha256-LF'
        || manifest.logicalBundle?.sha256 !== logicalBundleSha256
        || JSON.stringify([...(manifest.declaredAncestorOverrides || [])].sort()) !== JSON.stringify(declaredAncestorOverrides)
        || JSON.stringify([...(manifest.newProtectedFiles || [])].sort()) !== JSON.stringify(newProtectedFiles)
        || JSON.stringify(protectedFiles) !== JSON.stringify(expectedProtectedFiles)
    ) {
        throw new Error('[EC-BOT-CORE-STRUCTURAL-V78] manifesto, ancestralidade ou política inválida; execução bloqueada.');
    }

    const inheritedOverrides = getSuccessorOverrideFiles();
    globalThis[successorOverrideKey] = [...new Set([...inheritedOverrides, ...declaredAncestorOverrides])];
    const originalConsoleLog = console.log;
    try {
        console.log = () => {};
        await import('./canaryControllerHealthPolicyResetSafetyFreezeRuntimeGuardV77H2.js');
    } catch (error) {
        if (inheritedOverrides.length) globalThis[successorOverrideKey] = inheritedOverrides;
        else delete globalThis[successorOverrideKey];
        throw error;
    } finally {
        console.log = originalConsoleLog;
    }

    const inheritedOverrideSet = new Set(inheritedOverrides);
    for (const [relativePath, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
        if (inheritedOverrideSet.has(relativePath)) continue;
        if (!fs.existsSync(absolute(relativePath)) || sha256(relativePath) !== approvedHash) {
            throw new Error(`[EC-BOT-CORE-STRUCTURAL-V78] alteração não autorizada em ${relativePath}.`);
        }
    }

    const {
        EC_BOT_CORE_V78_DATASET_ID,
        assertEcBotCoreV78Configuration,
        buildEcBotCoreV78OverlayEnvironment,
        ecBotCoreV78ExternalEffectDecision
    } = await import('./ecBotCoreOperationalV78Service.js');
    const {
        EC_OFFICIAL_VSL_V78_MESSAGE,
        EC_OFFICIAL_VSL_V78_URL,
        EC_OFFICIAL_VSL_V78_WHATSAPP,
        recognizeOfficialEcVslEntryV78
    } = await import('./ecOfficialVslEntryV78Service.js');
    const {
        EC_QA_TEST_PHONE_V78,
        assertExactEcQaPhoneV78
    } = await import('./ecQaTestResetV78Service.js');

    const overlay = buildEcBotCoreV78OverlayEnvironment({
        baseEnv: { META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }
    });
    assertEcBotCoreV78Configuration({ ...overlay, META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID }, {
        browserPixelId: EC_BOT_CORE_V78_DATASET_ID,
        serverDatasetId: EC_BOT_CORE_V78_DATASET_ID
    });
    for (const blockedEffect of ['scheduler', 'dropi', 'meta', 'capi', 'purchase']) {
        if (ecBotCoreV78ExternalEffectDecision(blockedEffect, {
            ...overlay,
            META_PIXEL_ID_EC: EC_BOT_CORE_V78_DATASET_ID
        }).allowed) {
            throw new Error(`[EC-BOT-CORE-STRUCTURAL-V78] efeito externo indevido liberado: ${blockedEffect}.`);
        }
    }
    const recognition = recognizeOfficialEcVslEntryV78({
        text: EC_OFFICIAL_VSL_V78_MESSAGE,
        destinationPhone: EC_OFFICIAL_VSL_V78_WHATSAPP,
        sourceUrl: EC_OFFICIAL_VSL_V78_URL
    });
    if (!recognition.recognized || EC_QA_TEST_PHONE_V78 !== '5515998038637') {
        throw new Error('[EC-BOT-CORE-STRUCTURAL-V78] contrato VSL/QA inválido.');
    }
    assertExactEcQaPhoneV78(EC_QA_TEST_PHONE_V78);

    if (directEntry) {
        console.log('[EC-BOT-CORE-STRUCTURAL-V78] V78 → V77H2 → V77H → V77 → V76 → V75 → V74 → V73 → V72 → V71 íntegra; perfil seletivo e runtime externo congelados; origem VSL pública divergente mantém deploy bloqueado; nenhuma mutação de produção autorizada.');
    }
}

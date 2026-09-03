export const EC_BOT_CORE_READINESS_V79_VERSION = 79;
export const EC_BOT_CORE_READINESS_V79_DATASET_ID = '1468946114265008';
export const EC_BOT_CORE_READINESS_V79_PARENT_COMMIT = '9a17abbe6546819f25885541a86f0cca7be1bc7b';
export const EC_BOT_CORE_READINESS_V79_PARENT_TREE = 'a2d39450f790a3516ddfaed3babc1250927bb77b';
export const EC_BOT_CORE_READINESS_V79_PARENT_MANIFEST_SHA256 = '46a9363f203c9e2f4d574e286d2c361b4bd3bb915ee2f0b2398b04af624e12e1';
const EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_PATH = ['proto', 'colo'].join('');
const EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER_SUFFIX = ['PROTO', 'COLO'].join('');
export const EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_URL = `https://vilaliemen.shop/${EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_PATH}`;
export const EC_BOT_CORE_READINESS_V79_OFFICIAL_PHONE = '5515991418416';
export const EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER = `EC-TEX-ULTRA-${EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER_SUFFIX}`;
export const EC_BOT_CORE_READINESS_V79_OFFICIAL_MESSAGE = `Hola, vengo de la presentación oficial de Tex Ultra. Ref: ${EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER}`;
export const EC_BOT_CORE_READINESS_V79_QA_PHONE = '5515998038637';
export const EC_BOT_CORE_READINESS_V79_QA_CONTEXT = 'EC_V78_OFFICIAL_VSL_QA';

const clean = (value = '') => String(value ?? '').trim();
const push = (failures, condition, code) => {
    if (!condition) failures.push(code);
};

export const buildEcBotCoreReadinessSnapshotV79 = ({ manifest = {}, evidence = {} } = {}) => ({
    version: manifest.version,
    parentVersion: manifest.parentVersion,
    parentCommit: manifest.parentCommit,
    parentTree: manifest.parentTree,
    parentManifestSha256: manifest.parentManifestSha256,
    v78ByteIntact: evidence.v78?.byteIntact,
    dataset: {
        canonical: evidence.canonicalDataset?.datasetId,
        proofStatus: evidence.canonicalDataset?.status,
        browser: evidence.final?.browserDatasetId,
        capi: evidence.final?.capiDatasetId,
        activeDestination: evidence.final?.activeDestinationDatasetId,
        activeDestinationSource: evidence.final?.activeDestinationSource,
        publicDescriptor: evidence.final?.publicDescriptorDatasetId,
        publicDescriptorBrowser: evidence.final?.publicDescriptorBrowserPixelId,
        browserServerSynchronized: evidence.final?.browserServerSynchronized,
        equalityStatus: evidence.final?.datasetEquality,
        resolvedPixelCount: evidence.final?.vslPublicResolverPixelCount,
        secondParallelPixelIntroduced: evidence.staticMetaPaths?.secondParallelPixelIntroduced,
        browserTokenExposed: evidence.staticMetaPaths?.browserTokenExposed,
        capiPurchaseDefinitionCount: evidence.staticMetaPaths?.capiPurchaseDefinitionCount,
        browserPurchasePathCount: evidence.staticMetaPaths?.browserPurchasePathCount,
        leadLogicalFlowCount: evidence.staticMetaPaths?.leadLogicalFlowCount,
        leadDeduplicatedByEventId: evidence.staticMetaPaths?.leadDeduplicatedByEventId,
        metaEventsSent: evidence.staticMetaPaths?.metaEventsSent
    },
    cta: {
        url: evidence.publicCta?.url,
        httpStatus: evidence.publicCta?.httpStatus,
        xCloaker: evidence.publicCta?.xCloaker,
        destinationPhone: evidence.publicCta?.destinationPhone,
        message: evidence.publicCta?.message,
        marker: evidence.publicCta?.marker,
        status: evidence.publicCta?.status,
        changedDuringV79: evidence.publicCta?.changedDuringV79,
        clicked: evidence.publicCta?.clicked,
        whatsappOpened: evidence.publicCta?.whatsappOpened,
        messageSent: evidence.publicCta?.messageSent
    },
    deployment: {
        ready: manifest.deployment?.ready,
        blockers: [...(manifest.deployment?.blockers || [])],
        requiresExplicitAuthorization: manifest.deployment?.requiresExplicitAuthorization
    },
    policy: {
        profile: manifest.policy?.profile,
        mutatingSchedulersAllowed: manifest.policy?.mutatingSchedulersAllowed,
        dropiApplyAllowed: manifest.policy?.dropiApplyAllowed,
        metaPurchaseAllowed: manifest.policy?.metaPurchaseAllowed,
        realCustomerTrafficAuthorized: manifest.policy?.realCustomerTrafficAuthorized,
        botProductionDeployed: evidence.isolation?.botProductionDeployed,
        botActivated: evidence.isolation?.botActivated,
        canaryExecuted: evidence.futureQa?.canaryExecuted
    },
    qa: {
        phone: evidence.futureQa?.phone,
        context: evidence.futureQa?.context,
        url: evidence.futureQa?.url,
        permitCreated: evidence.futureQa?.permitCreated,
        resetExecuted: evidence.futureQa?.resetExecuted
    },
    isolation: {
        colombiaOperationalInfrastructureReferenced: evidence.isolation?.colombiaOperationalInfrastructureReferenced,
        colombiaOperationalInfrastructureTouched: evidence.isolation?.colombiaOperationalInfrastructureTouched,
        hostingerEcMutationExecuted: evidence.isolation?.hostingerEcMutationExecuted
    },
    evidenceStatus: evidence.status
});

export const evaluateEcBotCoreReadinessV79 = (snapshot = {}) => {
    const failures = [];
    const dataset = snapshot.dataset || {};
    const cta = snapshot.cta || {};
    const deployment = snapshot.deployment || {};
    const policy = snapshot.policy || {};
    const qa = snapshot.qa || {};
    const isolation = snapshot.isolation || {};

    push(failures, snapshot.version === EC_BOT_CORE_READINESS_V79_VERSION, 'version_invalid');
    push(failures, snapshot.parentVersion === 'V78', 'parent_version_invalid');
    push(failures, snapshot.parentCommit === EC_BOT_CORE_READINESS_V79_PARENT_COMMIT, 'parent_commit_invalid');
    push(failures, snapshot.parentTree === EC_BOT_CORE_READINESS_V79_PARENT_TREE, 'parent_tree_invalid');
    push(failures, snapshot.parentManifestSha256 === EC_BOT_CORE_READINESS_V79_PARENT_MANIFEST_SHA256, 'parent_manifest_invalid');
    push(failures, snapshot.v78ByteIntact === true, 'v78_not_byte_intact');

    push(failures, dataset.proofStatus === 'PROVEN', 'canonical_dataset_unproven');
    for (const [label, value] of Object.entries({
        canonical: dataset.canonical,
        browser: dataset.browser,
        capi: dataset.capi,
        active_destination: dataset.activeDestination,
        public_descriptor: dataset.publicDescriptor,
        public_descriptor_browser: dataset.publicDescriptorBrowser
    })) push(failures, value === EC_BOT_CORE_READINESS_V79_DATASET_ID, `${label}_dataset_mismatch`);
    push(failures, ['legacy_env', 'shared_registry'].includes(clean(dataset.activeDestinationSource)), 'active_destination_source_invalid');
    push(failures, dataset.browserServerSynchronized === true, 'browser_server_not_synchronized');
    push(failures, dataset.equalityStatus === 'PASS', 'dataset_equality_not_pass');
    push(failures, dataset.resolvedPixelCount === 1, 'parallel_pixel_count_invalid');
    push(failures, dataset.secondParallelPixelIntroduced === false, 'second_pixel_introduced');
    push(failures, dataset.browserTokenExposed === false, 'browser_token_exposed');
    push(failures, dataset.capiPurchaseDefinitionCount === 1, 'capi_purchase_definition_count_invalid');
    push(failures, dataset.browserPurchasePathCount === 0, 'browser_purchase_path_present');
    push(failures, dataset.leadLogicalFlowCount === 1, 'lead_flow_count_invalid');
    push(failures, dataset.leadDeduplicatedByEventId === true, 'lead_event_id_dedup_missing');
    push(failures, dataset.metaEventsSent === 0, 'meta_event_was_sent');

    push(failures, cta.url === EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_URL, 'cta_url_invalid');
    push(failures, cta.httpStatus === 200, 'cta_http_invalid');
    push(failures, clean(cta.xCloaker).toLowerCase() === 'allowed', 'cta_cloaker_not_allowed');
    push(failures, cta.destinationPhone === EC_BOT_CORE_READINESS_V79_OFFICIAL_PHONE, 'cta_destination_invalid');
    push(failures, cta.message === EC_BOT_CORE_READINESS_V79_OFFICIAL_MESSAGE, 'cta_message_invalid');
    push(failures, cta.marker === EC_BOT_CORE_READINESS_V79_OFFICIAL_MARKER, 'cta_marker_invalid');
    push(failures, cta.status === 'PASS', 'cta_conformance_not_pass');
    push(failures, cta.changedDuringV79 === false, 'cta_changed_during_v79');
    push(failures, cta.clicked === false && cta.whatsappOpened === false && cta.messageSent === false, 'cta_external_action_detected');

    push(failures, deployment.ready === true, 'deployment_not_ready');
    push(failures, deployment.blockers.length === 0, 'deployment_ready_with_blocker');
    push(failures, deployment.requiresExplicitAuthorization === true, 'explicit_authorization_not_required');
    push(failures, policy.profile === 'EC_BOT_CORE_OPERATIONAL', 'bot_core_profile_invalid');
    push(failures, policy.mutatingSchedulersAllowed === false, 'mutating_scheduler_enabled');
    push(failures, policy.dropiApplyAllowed === false, 'dropi_apply_enabled');
    push(failures, policy.metaPurchaseAllowed === false, 'meta_purchase_enabled');
    push(failures, policy.realCustomerTrafficAuthorized === false, 'real_customer_traffic_authorized');
    push(failures, policy.botProductionDeployed === false, 'bot_production_deployed');
    push(failures, policy.botActivated === false, 'bot_activated');
    push(failures, policy.canaryExecuted === false, 'canary_executed');

    push(failures, qa.phone === EC_BOT_CORE_READINESS_V79_QA_PHONE, 'qa_phone_invalid');
    push(failures, qa.context === EC_BOT_CORE_READINESS_V79_QA_CONTEXT, 'qa_context_invalid');
    push(failures, qa.url === EC_BOT_CORE_READINESS_V79_OFFICIAL_VSL_URL, 'qa_url_invalid');
    push(failures, qa.permitCreated === false && qa.resetExecuted === false, 'qa_preparation_executed');

    push(failures, isolation.colombiaOperationalInfrastructureReferenced === false, 'colombia_operational_infrastructure_referenced');
    push(failures, isolation.colombiaOperationalInfrastructureTouched === false, 'colombia_operational_infrastructure_touched');
    push(failures, isolation.hostingerEcMutationExecuted === false, 'hostinger_ec_mutation_executed');
    push(failures, snapshot.evidenceStatus === 'DATASET_RECONCILIATION_PASS', 'dataset_reconciliation_not_pass');

    return Object.freeze({
        ok: failures.length === 0,
        failures: Object.freeze(failures),
        deploymentReady: deployment.ready === true && deployment.blockers.length === 0,
        datasetId: dataset.canonical || '',
        profile: policy.profile || ''
    });
};

export const assertEcBotCoreReadinessV79 = (snapshot = {}) => {
    const result = evaluateEcBotCoreReadinessV79(snapshot);
    if (!result.ok) {
        throw new Error(`ec_bot_core_readiness_v79_blocked:${result.failures.join(',')}`);
    }
    return result;
};

export const META_CANONICAL_DATASET_EC_V195 = '920532663934291';
export const META_LEGACY_DATASET_EC_V195 = '1468946114265008';
export const META_HISTORICAL_PROTOCOLO_G_DATASET_V195 = '2048099902484149';
export const META_CANONICAL_APPROVAL_ENV_V195 = 'META_CANONICAL_CONSOLIDATION_EC_APPROVED';
export const META_CANONICAL_DATASET_ENV_V195 = 'META_CANONICAL_DATASET_EC';
export const META_CANONICAL_TOKEN_ENV_V195 = 'META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G';
export const META_CANONICAL_PROFILE_V195 = 'meta_canonical_920_v195';

const clean = (value) => String(value || '').trim();

const blockedDestination = (route, errorCode) => Object.freeze({
    pixelId: null,
    browserPixelId: null,
    accessToken: null,
    tokenSource: '',
    route: `${route}_canonical_v195_blocked`,
    requestedRoute: route,
    profile: META_CANONICAL_PROFILE_V195,
    source: 'meta_canonical_consolidation_v195',
    browserServerSynchronized: false,
    errorCode
});

export const resolveMetaCanonicalConsolidationV195 = (
    env = process.env,
    { route = 'country_ec_default' } = {}
) => {
    const approval = clean(env[META_CANONICAL_APPROVAL_ENV_V195]);
    const datasetId = clean(env[META_CANONICAL_DATASET_ENV_V195]);
    const configured = Boolean(approval || datasetId);

    if (!configured) {
        return Object.freeze({ configured: false, enabled: false, destination: null, errorCode: '' });
    }

    if (approval !== 'true') {
        const errorCode = 'META_CANONICAL_V195_APPROVAL_REQUIRED';
        return Object.freeze({
            configured: true,
            enabled: false,
            destination: blockedDestination(route, errorCode),
            errorCode
        });
    }

    if (datasetId !== META_CANONICAL_DATASET_EC_V195) {
        const errorCode = 'META_CANONICAL_V195_DATASET_MISMATCH';
        return Object.freeze({
            configured: true,
            enabled: false,
            destination: blockedDestination(route, errorCode),
            errorCode
        });
    }

    const accessToken = clean(env[META_CANONICAL_TOKEN_ENV_V195]);
    if (!accessToken) {
        const errorCode = 'META_CANONICAL_V195_TOKEN_MISSING';
        return Object.freeze({
            configured: true,
            enabled: false,
            destination: blockedDestination(route, errorCode),
            errorCode
        });
    }

    return Object.freeze({
        configured: true,
        enabled: true,
        errorCode: '',
        destination: Object.freeze({
            pixelId: META_CANONICAL_DATASET_EC_V195,
            browserPixelId: META_CANONICAL_DATASET_EC_V195,
            accessToken,
            tokenSource: `env:${META_CANONICAL_TOKEN_ENV_V195}`,
            route,
            requestedRoute: route,
            profile: META_CANONICAL_PROFILE_V195,
            label: 'Meta EC canonical 920 V195',
            source: 'meta_canonical_consolidation_v195',
            browserDeploymentVerifiedAt: '2026-09-23T00:00:00.000Z',
            browserServerSynchronized: true,
            errorCode: ''
        })
    });
};

export const expectedMetaEcDatasetV195 = (env = process.env) => {
    const canonical = resolveMetaCanonicalConsolidationV195(env);
    if (!canonical.configured) return META_LEGACY_DATASET_EC_V195;
    return canonical.enabled ? META_CANONICAL_DATASET_EC_V195 : '';
};

export default resolveMetaCanonicalConsolidationV195;

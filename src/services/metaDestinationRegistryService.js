import fs from 'node:fs';
import path from 'node:path';

export const META_DESTINATION_REGISTRY_VERSION = 1;
export const META_DESTINATION_ROUTES = Object.freeze({
    EC_DEFAULT: 'country_ec_default',
    EC_TEX_ULTRA_PROTOCOLO_G: 'ec_tex_ultra_protocolo_g'
});
export const META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID = '2048099902484149';
export const DEFAULT_META_DESTINATION_REGISTRY_PATH = '/opt/vitalismen-automacao/shared/config/meta-destinations.json';
export const DEFAULT_META_DESTINATION_SECRETS_PATH = '/opt/vitalismen-automacao/shared/secrets/meta-destinations.json';

const DATASET_ID_PATTERN = /^\d{8,25}$/;
const PROFILE_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const TOKEN_REF_PATTERN = /^(env|secret):([A-Za-z][A-Za-z0-9_-]{2,79})$/;
const ENV_KEY_PATTERN = /^[A-Z][A-Z0-9_]{2,79}$/;
const SECRET_KEY_PATTERN = /^[a-z][a-z0-9_-]{2,79}$/;
const MAX_CONFIG_BYTES = 128 * 1024;
const SUPPORTED_ROUTES = new Set(Object.values(META_DESTINATION_ROUTES));
const REGISTRY_KEYS = new Set(['version', 'updatedAt', 'activeRoutes', 'profiles']);
const PROFILE_KEYS = new Set([
    'label',
    'route',
    'datasetId',
    'browserPixelId',
    'accessTokenRefs',
    'browserDeploymentVerifiedAt',
    'enabled'
]);
const SECRETS_KEYS = new Set(['version', 'tokens']);

const clean = (value = '') => String(value || '').trim();

const fail = (message, code = 'META_DESTINATION_REGISTRY_INVALID') => {
    const error = new Error(message);
    error.code = code;
    throw error;
};

const assertPlainObject = (value, label) => {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
        fail(`${label} precisa ser um objeto.`);
    }
    return value;
};

const assertOnlyKeys = (value, allowedKeys, label) => {
    const unknown = Object.keys(value).filter((key) => !allowedKeys.has(key));
    if (unknown.length) {
        fail(`${label} contém campos não permitidos: ${unknown.sort().join(', ')}.`, 'META_DESTINATION_SCHEMA_UNKNOWN_FIELD');
    }
};

const assertSafeFile = (filePath, { secret = false } = {}) => {
    const stat = fs.lstatSync(filePath);
    if (!stat.isFile() || stat.isSymbolicLink()) {
        fail(`Arquivo de configuração inválido: ${filePath}`, 'META_DESTINATION_FILE_UNSAFE');
    }
    if (stat.size <= 0 || stat.size > MAX_CONFIG_BYTES) {
        fail(`Tamanho de configuração inválido: ${filePath}`, 'META_DESTINATION_FILE_UNSAFE');
    }
    if (process.platform !== 'win32' && process.getuid?.() === 0 && (stat.mode & 0o077) !== 0) {
        fail(
            `Arquivo Meta precisa usar modo 0600: ${filePath}`,
            secret ? 'META_DESTINATION_SECRETS_PERMISSIONS' : 'META_DESTINATION_REGISTRY_PERMISSIONS'
        );
    }
    if (
        process.platform !== 'win32'
        && process.getuid?.() === 0
        && (stat.uid !== 0 || stat.gid !== 0)
    ) fail(
        `Arquivo Meta precisa pertencer a root:root: ${filePath}`,
        secret ? 'META_DESTINATION_SECRETS_OWNER' : 'META_DESTINATION_REGISTRY_OWNER'
    );
};

const readJsonFile = (filePath, options = {}) => {
    assertSafeFile(filePath, options);
    try {
        return JSON.parse(fs.readFileSync(filePath, 'utf8'));
    } catch (error) {
        fail(`JSON Meta inválido em ${filePath}: ${error.message}`);
    }
};

const normalizeTokenRefs = (value, profileKey) => {
    const refs = Array.isArray(value) ? value.map(clean).filter(Boolean) : [];
    if (!refs.length) fail(`Perfil ${profileKey} precisa declarar accessTokenRefs.`);
    refs.forEach((ref) => {
        const match = ref.match(TOKEN_REF_PATTERN);
        if (
            !match
            || (match[1] === 'env' && !ENV_KEY_PATTERN.test(match[2]))
            || (match[1] === 'secret' && !SECRET_KEY_PATTERN.test(match[2]))
        ) fail(`Token ref inválida no perfil ${profileKey}.`);
    });
    return [...new Set(refs)];
};

const normalizeProfile = (profileKey, rawProfile) => {
    if (!PROFILE_KEY_PATTERN.test(profileKey)) fail(`Chave de perfil Meta inválida: ${profileKey}`);
    const profile = assertPlainObject(rawProfile, `profiles.${profileKey}`);
    assertOnlyKeys(profile, PROFILE_KEYS, `profiles.${profileKey}`);
    const route = clean(profile.route);
    const datasetId = clean(profile.datasetId);
    const browserPixelId = clean(profile.browserPixelId);
    if (!SUPPORTED_ROUTES.has(route)) fail(`Rota Meta não suportada no perfil ${profileKey}.`);
    if (!DATASET_ID_PATTERN.test(datasetId)) fail(`Dataset inválido no perfil ${profileKey}.`);
    if (!DATASET_ID_PATTERN.test(browserPixelId)) fail(`Browser Pixel inválido no perfil ${profileKey}.`);
    if (browserPixelId !== datasetId) {
        fail(`Browser Pixel e CAPI Dataset divergem no perfil ${profileKey}.`, 'META_BROWSER_SERVER_DATASET_MISMATCH');
    }
    if (
        route === META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G
        && datasetId !== META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID
    ) {
        fail('Dataset dedicado do Protocolo G não pode ser substituído por configuração.', 'META_PROTOCOLO_G_DATASET_LOCKED');
    }
    if (profile.enabled !== true) fail(`Perfil ${profileKey} precisa estar explicitamente enabled=true.`);
    const browserDeploymentVerifiedAt = clean(profile.browserDeploymentVerifiedAt);
    if (!browserDeploymentVerifiedAt || !Number.isFinite(Date.parse(browserDeploymentVerifiedAt))) {
        fail(`Perfil ${profileKey} precisa de browserDeploymentVerifiedAt válido.`);
    }
    return Object.freeze({
        key: profileKey,
        route,
        datasetId,
        browserPixelId,
        accessTokenRefs: normalizeTokenRefs(profile.accessTokenRefs, profileKey),
        browserDeploymentVerifiedAt: new Date(browserDeploymentVerifiedAt).toISOString(),
        label: clean(profile.label).slice(0, 120) || profileKey
    });
};

export const assertMetaDestinationRegistryDocument = (rawRegistry) => {
    const registry = assertPlainObject(rawRegistry, 'registry');
    assertOnlyKeys(registry, REGISTRY_KEYS, 'registry');
    if (registry.version !== META_DESTINATION_REGISTRY_VERSION) {
        fail(`Versão de registry Meta inválida: ${registry.version}`);
    }
    const rawProfiles = assertPlainObject(registry.profiles, 'profiles');
    const profiles = Object.fromEntries(
        Object.entries(rawProfiles).map(([key, profile]) => [key, normalizeProfile(key, profile)])
    );
    const activeRoutes = assertPlainObject(registry.activeRoutes, 'activeRoutes');
    assertOnlyKeys(activeRoutes, SUPPORTED_ROUTES, 'activeRoutes');
    const normalizedActiveRoutes = {};
    for (const route of SUPPORTED_ROUTES) {
        const profileKey = clean(activeRoutes[route]);
        if (!profileKey || !profiles[profileKey]) fail(`Perfil ativo ausente para ${route}.`);
        if (profiles[profileKey].route !== route) fail(`Perfil ${profileKey} não pertence à rota ${route}.`);
        normalizedActiveRoutes[route] = profileKey;
    }
    const updatedAt = clean(registry.updatedAt);
    if (!updatedAt || !Number.isFinite(Date.parse(updatedAt))) fail('registry.updatedAt precisa ser um ISO válido.');
    return Object.freeze({
        version: META_DESTINATION_REGISTRY_VERSION,
        updatedAt: new Date(updatedAt).toISOString(),
        activeRoutes: Object.freeze(normalizedActiveRoutes),
        profiles: Object.freeze(profiles)
    });
};

const readSecrets = (secretsPath) => {
    if (!secretsPath || !fs.existsSync(secretsPath)) return null;
    const rawSecrets = readJsonFile(secretsPath, { secret: true });
    assertOnlyKeys(assertPlainObject(rawSecrets, 'secrets'), SECRETS_KEYS, 'secrets');
    if (rawSecrets?.version !== META_DESTINATION_REGISTRY_VERSION) {
        fail('Versão do arquivo de segredos Meta inválida.', 'META_DESTINATION_SECRETS_INVALID');
    }
    const tokens = assertPlainObject(rawSecrets.tokens, 'tokens');
    for (const [key, token] of Object.entries(tokens)) {
        if (!SECRET_KEY_PATTERN.test(key) || typeof token !== 'string' || clean(token).length < 20) {
            fail('Arquivo de segredos Meta contém entrada inválida.', 'META_DESTINATION_SECRETS_INVALID');
        }
    }
    return tokens;
};

const tokenFromRefs = ({ refs, env, secretsPath }) => {
    let secrets;
    for (const ref of refs) {
        const match = ref.match(TOKEN_REF_PATTERN);
        if (!match) continue;
        const [, source, key] = match;
        if (source === 'env') {
            const token = clean(env[key]);
            if (token) return { accessToken: token, tokenSource: `env:${key}` };
        } else {
            if (secrets === undefined) secrets = readSecrets(secretsPath);
            const token = clean(secrets?.[key]);
            if (token) return { accessToken: token, tokenSource: `secret:${key}` };
        }
    }
    return { accessToken: '', tokenSource: '' };
};

const resolveRegistryPath = (env, explicitPath) => clean(
    explicitPath
    || env.META_DESTINATION_REGISTRY_PATH
    || (env === process.env ? DEFAULT_META_DESTINATION_REGISTRY_PATH : '')
);

const resolveSecretsPath = (env, explicitPath) => clean(
    explicitPath
    || env.META_DESTINATION_SECRETS_PATH
    || (env === process.env ? DEFAULT_META_DESTINATION_SECRETS_PATH : '')
);

const legacyDestination = ({ route, legacyConfig = {} }) => ({
    pixelId: clean(legacyConfig.pixelId) || null,
    accessToken: clean(legacyConfig.accessToken) || null,
    route
});

const blockedDestination = (route, error) => ({
    pixelId: null,
    browserPixelId: null,
    accessToken: null,
    tokenSource: '',
    route: `${route}_registry_blocked`,
    requestedRoute: route,
    profile: '',
    source: 'shared_registry',
    browserServerSynchronized: false,
    errorCode: clean(error?.code || 'META_DESTINATION_REGISTRY_INVALID')
});

const destinationFromRegistry = ({ requestedRoute, registry, env, secretsPath, profileKey }) => {
    const selectedProfileKey = clean(profileKey || registry.activeRoutes[requestedRoute]);
    const profile = registry.profiles[selectedProfileKey];
    if (!profile || profile.route !== requestedRoute) {
        fail(`Perfil ${selectedProfileKey || '(vazio)'} não pertence à rota ${requestedRoute}.`, 'META_DESTINATION_PROFILE_INVALID');
    }
    const token = tokenFromRefs({ refs: profile.accessTokenRefs, env, secretsPath });
    return {
        pixelId: profile.datasetId,
        browserPixelId: profile.browserPixelId,
        accessToken: token.accessToken || null,
        tokenSource: token.tokenSource,
        route: requestedRoute,
        profile: profile.key,
        label: profile.label,
        source: 'shared_registry',
        browserDeploymentVerifiedAt: profile.browserDeploymentVerifiedAt,
        browserServerSynchronized: profile.datasetId === profile.browserPixelId,
        errorCode: token.accessToken ? '' : 'META_DESTINATION_TOKEN_MISSING'
    };
};

export const resolveMetaDestinationDocument = ({
    route,
    registryDocument,
    env = process.env,
    secretsPath
} = {}) => {
    const requestedRoute = clean(route);
    if (!SUPPORTED_ROUTES.has(requestedRoute)) return blockedDestination(requestedRoute || 'unknown', {
        code: 'META_DESTINATION_ROUTE_UNSUPPORTED'
    });
    try {
        return destinationFromRegistry({
            requestedRoute,
            registry: assertMetaDestinationRegistryDocument(registryDocument),
            env,
            secretsPath: resolveSecretsPath(env, secretsPath)
        });
    } catch (error) {
        return blockedDestination(requestedRoute, error);
    }
};

export const resolveMetaDestination = ({
    route,
    env = process.env,
    registryPath,
    secretsPath,
    legacyConfig = {}
} = {}) => {
    const requestedRoute = clean(route);
    if (!SUPPORTED_ROUTES.has(requestedRoute)) return blockedDestination(requestedRoute || 'unknown', {
        code: 'META_DESTINATION_ROUTE_UNSUPPORTED'
    });
    const configuredRegistryPath = clean(registryPath || env.META_DESTINATION_REGISTRY_PATH);
    const configuredSecretsPath = clean(secretsPath || env.META_DESTINATION_SECRETS_PATH);
    const resolvedRegistryPath = resolveRegistryPath(env, registryPath);
    if (configuredRegistryPath && !path.isAbsolute(configuredRegistryPath)) {
        return blockedDestination(requestedRoute, { code: 'META_DESTINATION_REGISTRY_PATH_INVALID' });
    }
    if (configuredSecretsPath && !path.isAbsolute(configuredSecretsPath)) {
        return blockedDestination(requestedRoute, { code: 'META_DESTINATION_SECRETS_PATH_INVALID' });
    }
    if (!resolvedRegistryPath || !fs.existsSync(resolvedRegistryPath)) {
        if (configuredRegistryPath) {
            return blockedDestination(requestedRoute, { code: 'META_DESTINATION_REGISTRY_MISSING' });
        }
        return legacyDestination({ route: requestedRoute, legacyConfig });
    }
    try {
        const registry = assertMetaDestinationRegistryDocument(readJsonFile(resolvedRegistryPath));
        return destinationFromRegistry({
            requestedRoute,
            registry,
            env,
            secretsPath: resolveSecretsPath(env, secretsPath)
        });
    } catch (error) {
        return blockedDestination(requestedRoute, error);
    }
};

export const resolveMetaDestinationProfile = ({
    route,
    profile,
    env = process.env,
    registryPath,
    secretsPath,
    legacyConfig = {}
} = {}) => {
    const requestedRoute = clean(route);
    const requestedProfile = clean(profile);
    if (!SUPPORTED_ROUTES.has(requestedRoute)) return blockedDestination(requestedRoute || 'unknown', {
        code: 'META_DESTINATION_ROUTE_UNSUPPORTED'
    });
    if (requestedProfile === 'legacy_env') {
        return legacyDestination({ route: requestedRoute, legacyConfig });
    }
    const configuredRegistryPath = clean(registryPath || env.META_DESTINATION_REGISTRY_PATH);
    const configuredSecretsPath = clean(secretsPath || env.META_DESTINATION_SECRETS_PATH);
    const resolvedRegistryPath = resolveRegistryPath(env, registryPath);
    if (
        !requestedProfile
        || (configuredRegistryPath && !path.isAbsolute(configuredRegistryPath))
        || (configuredSecretsPath && !path.isAbsolute(configuredSecretsPath))
        || !resolvedRegistryPath
        || !fs.existsSync(resolvedRegistryPath)
    ) return blockedDestination(requestedRoute, { code: 'META_DESTINATION_PROFILE_UNAVAILABLE' });
    try {
        const registry = assertMetaDestinationRegistryDocument(readJsonFile(resolvedRegistryPath));
        return destinationFromRegistry({
            requestedRoute,
            registry,
            env,
            secretsPath: resolveSecretsPath(env, secretsPath),
            profileKey: requestedProfile
        });
    } catch (error) {
        return blockedDestination(requestedRoute, error);
    }
};

export const publicMetaDestinationDescriptor = (destination = {}) => {
    const datasetId = clean(destination.pixelId);
    const browserPixelId = clean(destination.browserPixelId || destination.pixelId);
    const synchronized = destination.browserServerSynchronized === undefined
        ? Boolean(datasetId && datasetId === browserPixelId)
        : destination.browserServerSynchronized === true;
    const source = clean(destination.source) || 'legacy_env';
    return Object.freeze({
        route: clean(destination.requestedRoute || destination.route),
        profile: clean(destination.profile) || (source === 'legacy_env' ? 'legacy_env' : ''),
        label: clean(destination.label),
        datasetId,
        browserPixelId,
        source,
        browserServerSynchronized: synchronized,
        browserDeploymentVerifiedAt: clean(destination.browserDeploymentVerifiedAt),
        tokenConfigured: Boolean(destination.accessToken),
        available: Boolean(
            DATASET_ID_PATTERN.test(datasetId)
            && DATASET_ID_PATTERN.test(browserPixelId)
            && destination.accessToken
            && synchronized
        ),
        errorCode: clean(destination.errorCode)
    });
};

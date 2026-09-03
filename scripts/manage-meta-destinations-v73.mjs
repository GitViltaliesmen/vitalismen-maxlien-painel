import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import {
    assertMetaDestinationRegistryDocument,
    DEFAULT_META_DESTINATION_REGISTRY_PATH,
    DEFAULT_META_DESTINATION_SECRETS_PATH,
    META_DESTINATION_REGISTRY_VERSION,
    META_DESTINATION_ROUTES,
    META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
    publicMetaDestinationDescriptor,
    resolveMetaDestination,
    resolveMetaDestinationDocument
} from '../src/services/metaDestinationRegistryService.js';

const APPLY_APPROVAL = 'I_UNDERSTAND_META_BROWSER_SERVER_ATOMIC_CHANGE';
const DATASET_ID_PATTERN = /^\d{8,25}$/;
const PROFILE_KEY_PATTERN = /^[a-z][a-z0-9_-]{1,63}$/;
const SECRET_KEY_PATTERN = /^[a-z][a-z0-9_-]{2,79}$/;
const MAX_CONFIG_BYTES = 128 * 1024;

const clean = (value = '') => String(value || '').trim();
const nowIso = () => new Date().toISOString();

const parseArgs = (argv = []) => {
    const [command = 'status', ...rest] = argv;
    const options = {};
    for (const argument of rest) {
        if (!argument.startsWith('--')) throw new Error(`Argumento inválido: ${argument}`);
        const separator = argument.indexOf('=');
        if (separator === -1) options[argument.slice(2)] = true;
        else options[argument.slice(2, separator)] = argument.slice(separator + 1);
    }
    return { command, options };
};

const pathsFrom = (options = {}, env = process.env) => {
    const registryRaw = clean(options.registry || env.META_DESTINATION_REGISTRY_PATH || DEFAULT_META_DESTINATION_REGISTRY_PATH);
    const secretsRaw = clean(options.secrets || env.META_DESTINATION_SECRETS_PATH || DEFAULT_META_DESTINATION_SECRETS_PATH);
    if (!path.isAbsolute(registryRaw) || !path.isAbsolute(secretsRaw)) {
        throw new Error('Registry e secrets precisam usar caminhos absolutos.');
    }
    const registryPath = path.normalize(registryRaw);
    const secretsPath = path.normalize(secretsRaw);
    if (
        process.platform !== 'win32'
        && env.META_DESTINATION_TEST_MODE !== 'true'
        && (
            registryPath !== path.normalize(DEFAULT_META_DESTINATION_REGISTRY_PATH)
            || secretsPath !== path.normalize(DEFAULT_META_DESTINATION_SECRETS_PATH)
        )
    ) throw new Error('Produção aceita somente os caminhos shared oficiais de registry e secrets.');
    return { registryPath, secretsPath };
};

const assertApplyAuthorized = (options, env = process.env) => {
    if (Object.hasOwn(options, 'apply') && options.apply !== true) {
        throw new Error('Use --apply sem valor; --apply=<valor> é proibido.');
    }
    if (!options.apply) return false;
    if (env.META_DESTINATION_CHANGE_APPROVED !== APPLY_APPROVAL) {
        throw new Error(`Apply bloqueado. Defina META_DESTINATION_CHANGE_APPROVED=${APPLY_APPROVAL}.`);
    }
    if (process.platform !== 'win32' && process.getuid?.() !== 0 && env.META_DESTINATION_TEST_MODE !== 'true') {
        throw new Error('Apply operacional precisa ser executado como root.');
    }
    return true;
};

const readJson = (filePath, { secret = false } = {}) => {
    const stat = fs.lstatSync(filePath);
    const fileKind = secret ? 'segredos' : 'registry';
    if (!stat.isFile() || stat.isSymbolicLink()) throw new Error(`Arquivo inseguro: ${filePath}`);
    if (stat.size <= 0 || stat.size > MAX_CONFIG_BYTES) throw new Error(`Tamanho de arquivo inseguro: ${filePath}`);
    if (process.platform !== 'win32' && process.getuid?.() === 0 && (stat.mode & 0o077) !== 0) {
        throw new Error(`Arquivo de ${fileKind} Meta precisa usar modo 0600: ${filePath}`);
    }
    if (
        process.platform !== 'win32'
        && process.getuid?.() === 0
        && (stat.uid !== 0 || stat.gid !== 0)
    ) throw new Error(`Arquivo de ${fileKind} Meta precisa pertencer a root:root: ${filePath}`);
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
};

const safeTimestamp = () => new Date().toISOString().replace(/\D/g, '').slice(0, 17);

const assertSafeParentDirectory = (directory) => {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    const stat = fs.lstatSync(directory);
    if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error(`Diretório inseguro: ${directory}`);
    if (
        process.platform !== 'win32'
        && process.getuid?.() === 0
        && (stat.uid !== 0 || stat.gid !== 0 || (stat.mode & 0o022) !== 0)
    ) throw new Error(`Diretório precisa pertencer a root:root e não ser gravável por grupo/outros: ${directory}`);
};

const fsyncFile = (filePath) => {
    if (process.platform === 'win32') return;
    const descriptor = fs.openSync(filePath, 'r');
    try {
        fs.fsyncSync(descriptor);
    } finally {
        fs.closeSync(descriptor);
    }
};

const fsyncDirectory = (directory) => {
    if (process.platform === 'win32') return;
    const descriptor = fs.openSync(directory, 'r');
    try {
        fs.fsyncSync(descriptor);
    } finally {
        fs.closeSync(descriptor);
    }
};

const atomicWriteJson = (filePath, value, { secret = false } = {}) => {
    const parent = path.dirname(filePath);
    const backupDir = path.join(parent, 'backups');
    assertSafeParentDirectory(parent);
    assertSafeParentDirectory(backupDir);
    const stat = fs.existsSync(filePath) ? fs.lstatSync(filePath) : null;
    if (stat?.isSymbolicLink() || (stat && !stat.isFile())) throw new Error(`Destino inseguro: ${filePath}`);
    if (stat) {
        const backupPath = path.join(backupDir, `${path.basename(filePath)}.${safeTimestamp()}.${process.pid}.bak`);
        fs.copyFileSync(filePath, backupPath, fs.constants.COPYFILE_EXCL);
        fs.chmodSync(backupPath, 0o600);
        fsyncFile(backupPath);
    }
    const temporary = path.join(parent, `.${path.basename(filePath)}.${process.pid}.${Date.now()}.tmp`);
    let temporaryCreated = false;
    try {
        fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600, flag: 'wx' });
        temporaryCreated = true;
        fs.chmodSync(temporary, secret ? 0o600 : 0o600);
        fsyncFile(temporary);
        fs.renameSync(temporary, filePath);
        temporaryCreated = false;
        fs.chmodSync(filePath, 0o600);
        fsyncFile(filePath);
        fsyncDirectory(parent);
    } finally {
        if (temporaryCreated && fs.existsSync(temporary)) fs.unlinkSync(temporary);
    }
};

const withMetaDestinationChangeLock = async ({ registryPath, command }, operation) => {
    const parent = path.dirname(registryPath);
    assertSafeParentDirectory(parent);
    const lockPath = path.join(parent, '.meta-destination-change.lock');
    let descriptor;
    try {
        descriptor = fs.openSync(lockPath, 'wx', 0o600);
    } catch (error) {
        if (error?.code === 'EEXIST') {
            throw new Error(`Outra alteração Meta está em andamento ou deixou lock pendente: ${lockPath}`);
        }
        throw error;
    }
    const ownedStat = fs.fstatSync(descriptor);
    try {
        fs.writeFileSync(descriptor, `${JSON.stringify({ version: 1, command, pid: process.pid, createdAt: nowIso() })}\n`);
        fs.fsyncSync(descriptor);
        return await operation();
    } finally {
        fs.closeSync(descriptor);
        if (fs.existsSync(lockPath)) {
            const currentStat = fs.lstatSync(lockPath);
            if (currentStat.dev === ownedStat.dev && currentStat.ino === ownedStat.ino) fs.unlinkSync(lockPath);
        }
    }
};

const legacyForRoute = (route, env = process.env) => {
    if (route === META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G) {
        return {
            pixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
            browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
            accessToken: env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G || env.META_ACCESS_TOKEN_EC,
            tokenSource: env.META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G
                ? 'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G'
                : 'env:META_ACCESS_TOKEN_EC'
        };
    }
    return {
        pixelId: env.META_PIXEL_ID_EC,
        browserPixelId: env.META_PIXEL_ID_EC,
        accessToken: env.META_ACCESS_TOKEN_EC,
        tokenSource: 'env:META_ACCESS_TOKEN_EC'
    };
};

export const buildMetaDestinationStatus = ({ env = process.env, registryPath, secretsPath } = {}) => ({
    version: META_DESTINATION_REGISTRY_VERSION,
    registryPath,
    registryExists: fs.existsSync(registryPath),
    secretsPath,
    secretsExists: fs.existsSync(secretsPath),
    routes: Object.fromEntries(Object.values(META_DESTINATION_ROUTES).map((route) => [
        route,
        publicMetaDestinationDescriptor(resolveMetaDestination({
            route,
            env,
            registryPath,
            secretsPath,
            legacyConfig: legacyForRoute(route, env)
        }))
    ]))
});

const requireDataset = (value, label) => {
    const normalized = clean(value);
    if (!DATASET_ID_PATTERN.test(normalized)) throw new Error(`${label} inválido.`);
    return normalized;
};

const requireVerifiedAt = (value) => {
    const normalized = clean(value);
    if (!normalized || !Number.isFinite(Date.parse(normalized))) {
        throw new Error('Informe --browser-verified-at=<ISO> depois de validar o Browser Pixel real.');
    }
    return new Date(normalized).toISOString();
};

export const buildBootstrapRegistry = ({ env = process.env, browserVerifiedAt } = {}) => {
    const ecDataset = requireDataset(env.META_PIXEL_ID_EC, 'META_PIXEL_ID_EC');
    const verifiedAt = requireVerifiedAt(browserVerifiedAt);
    return assertMetaDestinationRegistryDocument({
        version: META_DESTINATION_REGISTRY_VERSION,
        updatedAt: nowIso(),
        activeRoutes: {
            [META_DESTINATION_ROUTES.EC_DEFAULT]: 'ec-primary',
            [META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G]: 'ec-protocolo-g'
        },
        profiles: {
            'ec-primary': {
                label: 'EC principal compartilhável com contas parceiras',
                route: META_DESTINATION_ROUTES.EC_DEFAULT,
                datasetId: ecDataset,
                browserPixelId: ecDataset,
                accessTokenRefs: ['env:META_ACCESS_TOKEN_EC'],
                browserDeploymentVerifiedAt: verifiedAt,
                enabled: true
            },
            'ec-protocolo-g': {
                label: 'EC Tex Ultra Protocolo G — Dataset congelado',
                route: META_DESTINATION_ROUTES.EC_TEX_ULTRA_PROTOCOLO_G,
                datasetId: META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
                browserPixelId: META_EC_TEX_ULTRA_PROTOCOLO_G_LOCKED_DATASET_ID,
                accessTokenRefs: [
                    'env:META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G',
                    'env:META_ACCESS_TOKEN_EC'
                ],
                browserDeploymentVerifiedAt: verifiedAt,
                enabled: true
            }
        }
    });
};

const serializableRegistry = (registry) => ({
    version: registry.version,
    updatedAt: registry.updatedAt || nowIso(),
    activeRoutes: { ...registry.activeRoutes },
    profiles: Object.fromEntries(Object.entries(registry.profiles).map(([key, profile]) => [key, {
        label: profile.label,
        route: profile.route,
        datasetId: profile.datasetId,
        browserPixelId: profile.browserPixelId,
        accessTokenRefs: [...profile.accessTokenRefs],
        browserDeploymentVerifiedAt: profile.browserDeploymentVerifiedAt,
        enabled: true
    }]))
});

const loadRegistryForEdit = (registryPath) => {
    if (!fs.existsSync(registryPath)) throw new Error('Registry ausente; execute bootstrap primeiro.');
    return serializableRegistry(assertMetaDestinationRegistryDocument(readJson(registryPath)));
};

const upsertProfile = (registry, options) => {
    const key = clean(options.profile);
    if (!PROFILE_KEY_PATTERN.test(key)) throw new Error('--profile inválido.');
    if (Object.values(registry.activeRoutes).includes(key)) {
        throw new Error('Perfil ativo é imutável; crie outro perfil e use activate-profile para a troca atômica.');
    }
    const route = clean(options.route);
    if (!Object.values(META_DESTINATION_ROUTES).includes(route)) throw new Error('--route inválida.');
    const datasetId = requireDataset(options['dataset-id'], '--dataset-id');
    const browserPixelId = requireDataset(options['browser-pixel-id'] || options['dataset-id'], '--browser-pixel-id');
    const accessTokenRefs = clean(options['token-refs']).split(',').map(clean).filter(Boolean);
    registry.profiles[key] = {
        label: clean(options.label) || key,
        route,
        datasetId,
        browserPixelId,
        accessTokenRefs,
        browserDeploymentVerifiedAt: requireVerifiedAt(options['browser-verified-at']),
        enabled: true
    };
    registry.updatedAt = nowIso();
    return serializableRegistry(assertMetaDestinationRegistryDocument(registry));
};

const activateProfile = (registry, options, { env, secretsPath }) => {
    const route = clean(options.route);
    const profile = clean(options.profile);
    if (!Object.values(META_DESTINATION_ROUTES).includes(route)) throw new Error('--route inválida.');
    if (!registry.profiles[profile]) throw new Error('Perfil inexistente.');
    const currentProfile = clean(registry.activeRoutes[route]);
    const expectedCurrentProfile = clean(options['expected-current-profile']);
    if (!expectedCurrentProfile) throw new Error('Informe --expected-current-profile para impedir troca sobre estado obsoleto.');
    const expectedNextDatasetId = requireDataset(options['expected-next-dataset-id'], '--expected-next-dataset-id');
    if (expectedCurrentProfile !== currentProfile) {
        throw new Error(`Ativação bloqueada: perfil ativo mudou; esperado ${expectedCurrentProfile}, atual ${currentProfile}.`);
    }
    if (profile === currentProfile) throw new Error('Ativação bloqueada: o perfil solicitado já está ativo.');
    if (registry.profiles[profile].datasetId !== expectedNextDatasetId) {
        throw new Error('Ativação bloqueada: --expected-next-dataset-id diverge do perfil solicitado.');
    }
    registry.activeRoutes[route] = profile;
    registry.updatedAt = nowIso();
    const validated = serializableRegistry(assertMetaDestinationRegistryDocument(registry));
    const destination = resolveMetaDestinationDocument({
        route,
        registryDocument: validated,
        env,
        secretsPath
    });
    if (!destination.pixelId || !destination.accessToken || !destination.browserServerSynchronized) {
        throw new Error(`Ativação bloqueada: destino incompleto (${destination.errorCode || 'META_DESTINATION_NOT_READY'}).`);
    }
    return validated;
};

const partnerPlan = (registryPath, options) => {
    const businessId = requireDataset(options['business-id'], '--business-id');
    const adAccountId = requireDataset(options['ad-account-id'], '--ad-account-id');
    const registry = loadRegistryForEdit(registryPath);
    const route = clean(options.route || META_DESTINATION_ROUTES.EC_DEFAULT);
    if (!Object.values(META_DESTINATION_ROUTES).includes(route)) throw new Error('--route inválida.');
    const activeProfileKey = clean(registry.activeRoutes[route]);
    const requestedProfileKey = clean(options.profile);
    if (requestedProfileKey && requestedProfileKey !== activeProfileKey) {
        throw new Error(`Plano de parceiro bloqueado: ${requestedProfileKey} não é o perfil ativo de ${route}.`);
    }
    const profileKey = activeProfileKey;
    const profile = registry.profiles[profileKey];
    if (!profile || profile.route !== route) throw new Error('Perfil ativo da rota não existe ou é inválido.');
    return {
        mode: 'SHARE_EXISTING_DATASET_WITH_PARTNER',
        runtimeChangeRequired: false,
        siteRestartRequired: false,
        partnerBusinessId: businessId,
        partnerAdAccountId: adAccountId,
        route,
        profile: profileKey,
        datasetId: profile.datasetId,
        steps: [
            'No Meta Business Settings, adicionar o Business ID como parceiro.',
            'Compartilhar o Dataset/Pixel indicado com o parceiro.',
            'Atribuir a conta de anúncio parceira ao mesmo Dataset.',
            'Conferir domínio, PageView/Lead Browser e Purchase CAPI sem trocar IDs.',
            'Não criar Pixel paralelo nem duplicar Purchase.'
        ]
    };
};

const readSecretFromStdin = async () => {
    const chunks = [];
    for await (const chunk of process.stdin) chunks.push(chunk);
    const token = Buffer.concat(chunks).toString('utf8').trim();
    if (token.length < 20) throw new Error('Token recebido via stdin é inválido ou muito curto.');
    return token;
};

export const runMetaDestinationCli = async ({ argv = process.argv.slice(2), env = process.env } = {}) => {
    const { command, options } = parseArgs(argv);
    const { registryPath, secretsPath } = pathsFrom(options, env);
    const apply = assertApplyAuthorized(options, env);

    const execute = async () => {
        if (command === 'status') return buildMetaDestinationStatus({ env, registryPath, secretsPath });
        if (command === 'bootstrap') {
            const registry = serializableRegistry(buildBootstrapRegistry({
                env,
                browserVerifiedAt: options['browser-verified-at']
            }));
            if (apply && fs.existsSync(registryPath)) {
                throw new Error('Bootstrap bloqueado: registry já existe. Use upsert-profile/activate-profile.');
            }
            if (apply) atomicWriteJson(registryPath, registry);
            return { mode: apply ? 'APPLY' : 'DRY_RUN', registryPath, registry };
        }
        if (command === 'upsert-profile') {
            const registry = upsertProfile(loadRegistryForEdit(registryPath), options);
            if (apply) atomicWriteJson(registryPath, registry);
            return { mode: apply ? 'APPLY' : 'DRY_RUN', registryPath, registry };
        }
        if (command === 'activate-profile') {
            const registry = activateProfile(loadRegistryForEdit(registryPath), options, { env, secretsPath });
            if (apply) atomicWriteJson(registryPath, registry);
            return { mode: apply ? 'APPLY' : 'DRY_RUN', registryPath, registry };
        }
        if (command === 'plan-partner') return partnerPlan(registryPath, options);
        if (command === 'set-secret') {
            const key = clean(options.key);
            if (!SECRET_KEY_PATTERN.test(key)) throw new Error('--key de segredo inválida.');
            if (options.token || options['access-token']) throw new Error('Token em argumento é proibido; use somente --token-stdin.');
            if (!options['token-stdin']) throw new Error('Use --token-stdin; token em argumento é proibido.');
            if (!apply) return { mode: 'DRY_RUN', secretsPath, key, tokenStored: false };
            if (fs.existsSync(registryPath)) {
                const registry = loadRegistryForEdit(registryPath);
                const activeUsesSecret = Object.values(registry.activeRoutes).some((profileKey) => (
                    registry.profiles[profileKey]?.accessTokenRefs?.includes(`secret:${key}`)
                ));
                if (activeUsesSecret) {
                    throw new Error('Segredo ativo é imutável; grave uma nova chave, crie outro perfil e ative-o atomicamente.');
                }
            }
            const token = await readSecretFromStdin();
            const current = fs.existsSync(secretsPath)
                ? readJson(secretsPath, { secret: true })
                : { version: 1, tokens: {} };
            current.version = META_DESTINATION_REGISTRY_VERSION;
            current.tokens = { ...(current.tokens || {}), [key]: token };
            atomicWriteJson(secretsPath, current, { secret: true });
            return { mode: 'APPLY', secretsPath, key, tokenStored: true };
        }
        throw new Error('Comando inválido. Use status, bootstrap, plan-partner, upsert-profile, activate-profile ou set-secret.');
    };

    const mutatingCommands = new Set(['bootstrap', 'upsert-profile', 'activate-profile', 'set-secret']);
    return apply && mutatingCommands.has(command)
        ? withMetaDestinationChangeLock({ registryPath, command }, execute)
        : execute();
};

const isCli = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isCli) {
    runMetaDestinationCli()
        .then((result) => process.stdout.write(`${JSON.stringify(result, null, 2)}\n`))
        .catch((error) => {
            process.stderr.write(`META_DESTINATION_MANAGER=FAIL\n${error.message}\n`);
            process.exitCode = 1;
        });
}

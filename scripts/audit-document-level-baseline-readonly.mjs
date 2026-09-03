import crypto from 'node:crypto';
import process from 'node:process';
import { pathToFileURL } from 'node:url';
import { EJSON } from 'bson';
import { MongoClient } from 'mongodb';

export const BASELINE_SCHEMA_VERSION = 'v2.document-level-readonly-v71';

export const DEFAULT_COLLECTIONS = Object.freeze([
    'shipments',
    'orders',
    'contactstates',
    'outbounddedupes',
    'messages',
    'dropisynccycles',
    'operational_safety_states',
    'vslvisits'
]);

export const CRITICAL_FIELD_PATHS = Object.freeze({
    shipments: Object.freeze([
        'orderId',
        'country',
        'status',
        'tracking',
        'provider',
        'productName',
        'client',
        'logistics',
        'automation',
        'treatment',
        'proof',
        'outcomes',
        'review',
        'events',
        'notificationLedger',
        'notificationMarkers',
        'locks',
        'safetyLedger',
        'suppression',
        'raw',
        'updatedAt'
    ]),
    orders: Object.freeze([
        'orderId',
        'country',
        'status',
        'shippingStatus',
        'customer',
        'package',
        'total',
        'currency',
        'dropiOrderId',
        'trackingNumber',
        'tracking',
        'reviewQueue',
        'customerDataResolution',
        'updatedAt'
    ]),
    contactstates: Object.freeze([
        'chatId',
        'phoneDigits',
        'countryCode',
        'assignedAgent',
        'tags',
        'human',
        'conversationBucket',
        'engagementAutomation',
        'customerDataResolution',
        'firstInboundAt',
        'lastInboundAt',
        'lastOutboundAt',
        'buyLaterReminder',
        'metadata',
        'draft',
        'lastMessage',
        'queue',
        'profile',
        'counters',
        'updatedAt'
    ]),
    outbounddedupes: Object.freeze([
        'key',
        'phoneDigits',
        'jid',
        'kind',
        'fingerprint',
        'label',
        'sessionId',
        'status',
        'reservation',
        'firstReservedAt',
        'sentAt',
        'failedAt',
        'error',
        'updatedAt'
    ]),
    messages: Object.freeze([
        'chatId',
        'peerPhone',
        'from',
        'to',
        'timestamp',
        'sessionId',
        'ownerPhoneDigits',
        'isFromMe',
        'isBot',
        'direction',
        'status',
        'type',
        'hasMedia',
        'deliveryStatus',
        'providerStatus',
        'ack',
        'sendError',
        'deliveredAt',
        'readAt',
        'readInferredAt',
        'provider',
        'providerMessageId',
        'providerZaapId',
        'externalId',
        'clientGeneratedId',
        'providerMediaId',
        'payload',
        'metadata',
        'mediaStorageStatus',
        'mediaReceivedAt',
        'mediaStoredAt',
        'mediaReadyAt',
        'mediaFailedAt',
        'mediaDownloadError',
        'orderId',
        'updatedAt'
    ]),
    dropisynccycles: Object.freeze([
        'cycleId',
        'source',
        'mode',
        'status',
        'startedAt',
        'finishedAt',
        'summary',
        'error',
        'updatedAt'
    ]),
    operational_safety_states: Object.freeze([
        'runtimeVersion',
        'dataCompatibilityVersion',
        'status',
        'bridge',
        'authorization',
        'createdAt',
        'updatedAt'
    ]),
    vslvisits: Object.freeze(['*'])
});

export const FORBIDDEN_MONGO_COMMANDS = Object.freeze(new Set([
    'insert',
    'update',
    'delete',
    'findandmodify',
    'bulkwrite',
    'create',
    'createindexes',
    'drop',
    'dropdatabase',
    'dropindexes',
    'collmod',
    'renamecollection',
    'converttoCapped'.toLowerCase(),
    'profile',
    'reindex'
]));

const asPlainExtendedJson = (value) => EJSON.serialize(value, { relaxed: false });

const sortKeysRecursively = (value) => {
    if (Array.isArray(value)) return value.map(sortKeysRecursively);
    if (!value || typeof value !== 'object') return value;
    return Object.fromEntries(
        Object.keys(value)
            .sort()
            .map((key) => [key, sortKeysRecursively(value[key])])
    );
};

export const canonicalizeBson = (value) => sortKeysRecursively(asPlainExtendedJson(value));

export const canonicalStringify = (value) => JSON.stringify(canonicalizeBson(value));

export const sha256Hex = (value) => crypto
    .createHash('sha256')
    .update(typeof value === 'string' || Buffer.isBuffer(value) ? value : canonicalStringify(value))
    .digest('hex');

const valueAtPath = (document, path) => String(path || '')
    .split('.')
    .filter(Boolean)
    .reduce((value, key) => value?.[key], document);

export const criticalProjectionFor = (collectionName, document) => {
    const paths = CRITICAL_FIELD_PATHS[collectionName];
    if (!paths) throw new Error(`Colecao sem contrato de campos criticos: ${collectionName}`);
    if (paths.length === 1 && paths[0] === '*') return document;
    return Object.fromEntries(paths.map((path) => [path, valueAtPath(document, path)]));
};

const portableId = (value) => canonicalizeBson(value);

const portableUpdatedAt = (value) => {
    if (!value) return null;
    if (value instanceof Date) return value.toISOString();
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? canonicalizeBson(value) : parsed.toISOString();
};

export const buildDocumentFingerprint = (collectionName, document) => {
    const critical = criticalProjectionFor(collectionName, document);
    return Object.freeze({
        _id: portableId(document?._id),
        fullDocumentSha256: sha256Hex(canonicalStringify(document)),
        criticalFieldsSha256: sha256Hex(canonicalStringify(critical)),
        updatedAt: portableUpdatedAt(document?.updatedAt)
    });
};

const comparePortableIds = (left, right) => canonicalStringify(left?._id)
    .localeCompare(canonicalStringify(right?._id));

export const buildCollectionBaseline = (collectionName, documents = []) => {
    if (!DEFAULT_COLLECTIONS.includes(collectionName)) {
        throw new Error(`Colecao fora da allowlist: ${collectionName}`);
    }
    const sortedDocuments = [...documents].sort(comparePortableIds);
    const fingerprints = sortedDocuments.map((document) => buildDocumentFingerprint(collectionName, document));
    const aggregateIndexHash = crypto.createHash('sha256');

    sortedDocuments.forEach((document, index) => {
        aggregateIndexHash.update(`${canonicalStringify(fingerprints[index])}\n`);
    });

    return Object.freeze({
        collection: collectionName,
        documentCount: fingerprints.length,
        aggregateSha256: aggregateIndexHash.digest('hex'),
        criticalFieldPaths: [...CRITICAL_FIELD_PATHS[collectionName]],
        documents: fingerprints
    });
};

export const assertReadOnlyCommands = (commandNames = []) => {
    const violations = [...new Set(commandNames
        .map((name) => String(name || '').trim().toLowerCase())
        .filter((name) => FORBIDDEN_MONGO_COMMANDS.has(name)))];
    if (violations.length) {
        throw new Error(`Comando Mongo mutante observado: ${violations.join(', ')}`);
    }
    return true;
};

const parseArguments = (argv = []) => {
    const options = {
        collections: [...DEFAULT_COLLECTIONS],
        database: '',
        summaryOnly: false,
        pretty: false
    };
    for (const argument of argv) {
        if (argument === '--summary-only') options.summaryOnly = true;
        else if (argument === '--pretty') options.pretty = true;
        else if (argument.startsWith('--database=')) options.database = argument.slice('--database='.length).trim();
        else if (argument.startsWith('--collections=')) {
            options.collections = argument.slice('--collections='.length)
                .split(',')
                .map((value) => value.trim())
                .filter(Boolean);
        } else if (argument === '--help' || argument === '-h') {
            options.help = true;
        } else {
            throw new Error(`Argumento desconhecido: ${argument}`);
        }
    }
    const unknown = options.collections.filter((name) => !DEFAULT_COLLECTIONS.includes(name));
    if (unknown.length) throw new Error(`Colecao fora da allowlist: ${unknown.join(', ')}`);
    if (!options.collections.length) throw new Error('Informe ao menos uma colecao da allowlist.');
    return options;
};

const usage = () => [
    'Uso:',
    '  node scripts/audit-document-level-baseline-readonly.mjs [opcoes]',
    '',
    'Opcoes:',
    '  --collections=a,b  limita a allowlist oficial',
    '  --database=nome     sobrescreve apenas o database do MONGODB_URI',
    '  --summary-only      omite a lista por documento da saida',
    '  --pretty            formata o JSON',
    '',
    'A ferramenta usa somente find/sort/getMore e escreve o resultado em stdout.',
    'Ela nao cria arquivo, indice, documento, sessao operacional ou lock no Mongo.'
].join('\n');

export const captureDocumentLevelBaseline = async ({
    uri,
    database = '',
    collections = DEFAULT_COLLECTIONS,
    summaryOnly = false,
    generatedAt = new Date()
} = {}) => {
    if (!uri) throw new Error('MONGODB_URI ausente.');
    const observedCommands = [];
    const client = new MongoClient(uri, {
        monitorCommands: true,
        readPreference: 'primaryPreferred',
        retryWrites: false
    });
    client.on('commandStarted', (event) => observedCommands.push(String(event.commandName || '').toLowerCase()));

    try {
        await client.connect();
        const db = database ? client.db(database) : client.db();
        const baselines = [];
        for (const collectionName of collections) {
            const documents = await db.collection(collectionName)
                .find({}, { readConcern: { level: 'local' } })
                .sort({ _id: 1 })
                .toArray();
            const baseline = buildCollectionBaseline(collectionName, documents);
            baselines.push(summaryOnly ? { ...baseline, documents: undefined } : baseline);
        }
        assertReadOnlyCommands(observedCommands);
        return {
            schemaVersion: BASELINE_SCHEMA_VERSION,
            generatedAt: generatedAt.toISOString(),
            database: db.databaseName,
            readOnly: true,
            writesExecuted: 0,
            bsonNormalization: 'canonical EJSON relaxed=false; keys recursively sorted; arrays preserved',
            documentOrder: 'canonical _id ascending',
            observedMongoCommands: [...new Set(observedCommands)].sort(),
            collections: baselines
        };
    } finally {
        await client.close();
    }
};

const runCli = async () => {
    const options = parseArguments(process.argv.slice(2));
    if (options.help) {
        process.stdout.write(`${usage()}\n`);
        return;
    }
    const result = await captureDocumentLevelBaseline({
        uri: process.env.MONGODB_URI,
        database: options.database,
        collections: options.collections,
        summaryOnly: options.summaryOnly
    });
    process.stdout.write(`${JSON.stringify(result, null, options.pretty ? 2 : 0)}\n`);
};

const isCli = process.argv[1]
    && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isCli) {
    runCli().catch((error) => {
        process.stderr.write(`DOCUMENT_BASELINE_READONLY=FAIL\n${error.message}\n`);
        process.exitCode = 1;
    });
}

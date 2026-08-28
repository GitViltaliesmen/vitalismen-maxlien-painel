import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';

const read = (file) => fs.readFileSync(file, 'utf8');
const json = (file) => JSON.parse(read(file));
const sha256 = (file) => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');

const manifestPath = 'docs/freeze/strict-read-only-observation-safety-v71-20260827.json';
const parentManifestPath = 'docs/freeze/deploy-publication-attestation-safety-v70-20260827.json';
const manifest = json(manifestPath);
const service = read('src/services/strictReadOnlyObservationService.js');
const index = read('src/index.js');
const db = read('src/config/db.js');
const health = read('src/routes/health.js');
const whatsapp = read('src/routes/whatsapp.js');
const zapi = read('src/routes/zapi.js');
const auth = read('src/routes/auth.js');
const helper = read('ops/vitalismen-stage');
const baseline = read('scripts/audit-document-level-baseline-readonly.mjs');
const packageJson = json('package.json');

assert.equal(sha256(parentManifestPath), '7c3e646ffe8b44373dc1755260b92db4f7c413112bd862bc87529ed0a04fd194');
assert.equal(manifest.freezeId, 'strict-read-only-observation-safety-v71');
assert.equal(manifest.parentFreezeId, 'deploy-publication-attestation-safety-v70-20260827');
assert.equal(manifest.parentManifestSha256, sha256(parentManifestPath));
assert.equal(manifest.policy.guardChainVersion, 71);
assert.equal(manifest.policy.dataCompatibilityVersion, 66);
assert.equal(manifest.policy.safeObservationPolicy, 'STRICT_READ_ONLY');
assert.deepEqual(manifest.policy.allowedWriteClasses, []);
assert.equal(manifest.policy.mongoBusinessWrites, 0);
assert.equal(manifest.policy.mongoBookkeepingWrites, 0);
assert.equal(manifest.policy.filesystemSessionWrites, 0);
assert.equal(manifest.policy.outboundCalls, 0);
assert.equal(manifest.policy.dropiApplyCalls, 0);
assert.equal(manifest.policy.mutatingSchedulers, 0);
assert.equal(manifest.policy.autoIndex, false);
assert.equal(manifest.policy.baileysStartCalls, 0);
assert.equal(manifest.policy.documentBaselineCollections, 8);
assert.equal(manifest.policy.v70Commit, '288e49b73564bd17184174db0d5b0fa25f223225');
assert.equal(manifest.policy.v70Tree, 'e4732ca0ae4b6e33c41af4271f2597e3eb9a39f8');
assert.equal(manifest.policy.productionMutationExecuted, false);

for (const [file, approvedHash] of Object.entries(manifest.protectedFiles || {})) {
    assert.equal(sha256(file), approvedHash, `arquivo protegido V71 divergente: ${file}`);
}

for (const symbol of [
    'isStrictReadOnlyObservationEnabled',
    'assertMutationAllowed',
    'assertRouteMutationAllowed',
    'assertTransportPersistenceAllowed',
    'installStrictReadOnlyMongooseGuard',
    'strictReadOnlyMutationRouteGuard',
    'startBaileysIfAllowed',
    'isZapiInboundRoutingEnabled'
]) assert.match(service, new RegExp(`export (?:const|class) ${symbol}`));
assert.match(service, /SAFE_OBSERVATION_MODE = 'SAFE_OBSERVATION_ONLY'/);
assert.match(service, /STRICT_READ_ONLY_POLICY = 'STRICT_READ_ONLY'/);
assert.match(service, /STRICT_READ_ONLY_ALLOWED_WRITE_CLASSES = Object\.freeze\(\[\]\)/);
assert.match(service, /strict_read_only_operation_blocked/i);
assert.match(service, /autoIndex: !isStrictReadOnlyObservationEnabled/);
for (const method of ['insertOne', 'insertMany', 'bulkWrite', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'createIndex', 'createIndexes', 'drop']) {
    assert.match(service, new RegExp(`'${method}'`));
}

assert.ok(index.indexOf('resolveStrictReadOnlyObservation(process.env)') < index.indexOf('connectDB()'));
assert.ok(index.indexOf('installStrictReadOnlyMongooseGuard(mongoose)') < index.indexOf('connectDB()'));
assert.ok(index.indexOf('strictReadOnlyMutationRouteGuard') < index.indexOf("app.use('/api/auth', authRoutes)"));
assert.match(index, /if \(strictObservation\.enabled\)[\s\S]*return;/);
assert.match(index, /startBaileysIfAllowed/);
assert.match(db, /strictReadOnlyMongooseConnectOptions/);
assert.match(auth, /if \(!isStrictReadOnlyObservationEnabled\(\)\)[\s\S]*user\.lastLoginAt[\s\S]*user\.save/);
assert.match(health, /allowedWriteClasses/);
assert.match(health, /disabledByStrictReadOnly/);
assert.match(health, /mutatingSchedulers/);
assert.match(whatsapp, /persistCache && contactState\?\._id/);
assert.match(whatsapp, /strictReadOnlyAcceptedPayload\(\{ surface: 'vsl_stage' \}\)/);
assert.match(whatsapp, /strictReadOnlyAcceptedPayload\(\{ surface: 'vsl_entry' \}\)/);
assert.match(zapi, /strictReadOnlyAcceptedPayload\(\{ surface: 'zapi_delivery' \}\)/);
assert.match(zapi, /strictReadOnlyAcceptedPayload\(\{ surface: 'zapi_webhook' \}\)/);
assert.match(zapi, /strictReadOnlyAcceptedPayload\(\{ surface: 'zapi_received' \}\)/);
assert.equal((zapi.match(/result\.routeToBot && isZapiInboundRoutingEnabled\(\)/g) || []).length, 2);

for (const contractLine of [
    'VITALISMEN_STRICT_READ_ONLY=true',
    'SAFE_OBSERVATION_POLICY=STRICT_READ_ONLY',
    'WHATSAPP_CONNECT_ENABLED=false',
    'ZAPI_ROUTE_INBOUND_TO_BOT=false',
    'ZAPI_PERSIST_INBOUND_ENABLED=false',
    'ZAPI_PERSIST_ACK_ENABLED=false',
    'VSL_STAGE_PERSIST_ENABLED=false'
]) assert.ok(helper.split(contractLine).length >= 3, `overlay/PM2/verify ausente: ${contractLine}`);

assert.match(baseline, /'vslvisits'/);
assert.match(baseline, /vslvisits: Object\.freeze\(\['\*'\]\)/);
assert.match(baseline, /fullDocumentSha256/);
assert.match(baseline, /criticalFieldsSha256/);
assert.match(baseline, /aggregateSha256/);
assert.match(baseline, /documentCount/);
assert.match(baseline, /monitorCommands: true/);
assert.match(baseline, /retryWrites: false/);

assert.equal(packageJson.scripts['audit:document-baseline:readonly'], 'node scripts/audit-document-level-baseline-readonly.mjs');
assert.equal(packageJson.scripts['guard:runtime-chain-v71'], 'node src/services/strictReadOnlyObservationSafetyFreezeRuntimeGuardV71.js');
assert.match(packageJson.scripts['guard:predeploy-v71'], /^npm run guard:runtime-chain-v71 && /);
assert.match(packageJson.scripts.test, /^npm run guard:predeploy-v71 && /);
for (const alias of ['guard:dropi-customer-full-name-v64', 'guard:post-sale-gargalos-v65', 'guard:post-sale-safety-v66']) {
    assert.match(packageJson.scripts[alias], /^npm run guard:runtime-chain-v71 && /);
}

console.log('STRICT_READ_ONLY_OBSERVATION_SAFETY_V71_STATIC=OK');
console.log('SAFE_OBSERVATION_POLICY=STRICT_READ_ONLY');
console.log('ALLOWED_WRITE_CLASSES=0');
console.log('DOCUMENT_BASELINE_COLLECTIONS=8');
console.log('DATA_COMPATIBILITY_VERSION=66');

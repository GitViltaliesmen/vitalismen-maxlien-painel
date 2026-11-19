import{texMeasurementRegistrationV243}from'/usr/local/lib/vitalismen-deploy/ec-tex-measurement-profile-v243-r5.mjs';
import{qaB01CycleRegistrationV244R8}from'/usr/local/lib/vitalismen-deploy/ec-qa-b01-cycle-profile-v244-r8.mjs';
import{texEntryInvitesRegistrationV246}from'/usr/local/lib/vitalismen-deploy/ec-tex-entry-invites-profile-v246-r2.mjs';
import{b01NamedEntryRegistrationV246R5}from'/usr/local/lib/vitalismen-deploy/ec-b01-named-entry-profile-v246-r5.mjs';
import{texEntryGreetingRegistrationV249}from'/usr/local/lib/vitalismen-deploy/ec-tex-entry-greeting-profile-v249-r6.mjs';
import{texPostLeadRegistrationV251}from'/usr/local/lib/vitalismen-deploy/ec-tex-postlead-profile-v251-r2.mjs';
import{ordersDropiPostSaleRegistrationV252}from'/usr/local/lib/vitalismen-deploy/ec-orders-dropi-postsale-profile-v252-r11.mjs';
import{customerEditPaquizhaRegistrationV253}from'/usr/local/lib/vitalismen-deploy/ec-customer-edit-paquizha-profile-v253-r2.mjs';
import{orderIntegrationRegistrationV254}from'/usr/local/lib/vitalismen-deploy/ec-dropi-meta-profile-v254-r8.mjs';
import{texLinkedEntryRegistrationV242}from'/usr/local/lib/vitalismen-deploy/ec-tex-linked-entry-profile-v242-r6.mjs';
import{measurementRegistrationV213}from'/usr/local/lib/vitalismen-deploy/ec-meta-measurement-profile-v213-r4.mjs';
import{inboundOwnerRegistrationV214}from'/usr/local/lib/vitalismen-deploy/ec-inbound-owner-profile-v214-r1.mjs';
import{b01RegistrationV216}from'/usr/local/lib/vitalismen-deploy/ec-b01-profile-v216-r5.mjs';
import{priorityRegistrationV219}from'/usr/local/lib/vitalismen-deploy/ec-freeflow-priority-profile-v219-r4.mjs';
import{webChatRegistrationV220}from'/usr/local/lib/vitalismen-deploy/ec-web-chat-profile-v220-r2.mjs';
import{webChatRecallRegistrationV220}from'/usr/local/lib/vitalismen-deploy/ec-web-chat-profile-v220-r3.mjs';
import{webChatContextRegistrationV220}from'/usr/local/lib/vitalismen-deploy/ec-web-chat-profile-v220-r4.mjs';
import{webDashboardRegistrationV222}from'/usr/local/lib/vitalismen-deploy/ec-web-dashboard-profile-v222-r2.mjs';
import{webDashboardStoreRegistrationV222}from'/usr/local/lib/vitalismen-deploy/ec-web-dashboard-store-profile-v222-r3.mjs';
import{inboundRoutingRegistrationV227}from'/usr/local/lib/vitalismen-deploy/ec-inbound-routing-profile-v227-r1.mjs';
import{burstReplyRegistrationV228}from'/usr/local/lib/vitalismen-deploy/ec-vitpower-burst-profile-v228-r6.mjs';
import{botDropiRegistrationV229}from'/usr/local/lib/vitalismen-deploy/ec-bot-dropi-profile-v229-r3.mjs';
import{sdrSaleRegistrationV230}from'/usr/local/lib/vitalismen-deploy/ec-sdr-sale-profile-v230-r4.mjs';
import{webVoiceStatusRegistrationV231}from'/usr/local/lib/vitalismen-deploy/ec-web-voice-status-profile-v231-r2.mjs';
import{customerInvitesRegistrationV232}from'/usr/local/lib/vitalismen-deploy/ec-customer-invites-profile-v232-r5.mjs';
import{chatAccessRegistrationV236}from'/usr/local/lib/vitalismen-deploy/ec-chat-access-profile-v236.mjs';
import{journeyMeasurementRegistrationV237}from'/usr/local/lib/vitalismen-deploy/ec-journey-measurement-profile-v237-r2.mjs';
import{orderAccessRegistrationV238}from'/usr/local/lib/vitalismen-deploy/ec-order-access-profile-v238-r4.mjs';
import{priceClosureRegistrationV239}from'/usr/local/lib/vitalismen-deploy/ec-price-closure-profile-v239-r2.mjs';
import{texUltraWebChatRegistrationV240}from'/usr/local/lib/vitalismen-deploy/ec-tex-ultra-web-chat-profile-v240-r7.mjs';
import{qaNaturalEntryRegistrationV241}from'/usr/local/lib/vitalismen-deploy/ec-qa-natural-entry-profile-v241-r2.mjs';
import{b01PeriodPriceRegistrationV243}from'/usr/local/lib/vitalismen-deploy/ec-b01-period-price-profile-v243-r2.mjs';
import{readWebChatPolicyV220 as readMeasurementPolicyV213}from'/usr/local/lib/vitalismen-deploy/ec-dropi-meta-profile-v254-r8.mjs';
import {freeflowRegistrationV212,readFreeflowPolicyV212} from '/usr/local/lib/vitalismen-deploy/ec-principal-sdr-profile-v212-r11.mjs';
import {trackingRegistrationV210,readTrackingPolicyV210} from '/usr/local/lib/vitalismen-deploy/ec-postsale-tracking-profile-v210-r4.mjs';
import {prepaidRegistrationV1} from '/usr/local/lib/vitalismen-deploy/gira21x-stripe-prepaid-profile-v1.mjs';
import {audioRegistrationV208,readAudioPolicyV208} from '/usr/local/lib/vitalismen-deploy/ec-inbound-audio-profile-v208-r2.mjs';
import {repurchaseRegistrationV207} from '/usr/local/lib/vitalismen-deploy/ec-repurchase-profile-v207.mjs';
import {handoffRegistration} from '/usr/local/lib/vitalismen-deploy/gira21x-dropi-handoff-authority-v1.mjs';
import {readGiraOperationalPolicy,requireGiraApproval} from '/usr/local/lib/vitalismen-deploy/gira21x-profile-authority-v1.mjs';
import { readOperationalPolicyV203, requireOperationsApprovalV203 } from '/usr/local/lib/vitalismen-deploy/ec-operations-profile-authority-v203-r6.mjs';
import { readOperationalPolicyV2, historicalEngineDigestForPolicyV2 as historicalEngineDigestV2 } from '/usr/local/lib/vitalismen-deploy/ec-bot-core-profile-authority-v2.mjs';
// V203 registers one exact child. All historical authority bytes and branches remain intact.
const historicalEngineDigestForPolicyV2 = file => readMeasurementPolicyV213(file)?.historicalEngineSha256 || readGiraOperationalPolicy('/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs')?.historicalEngineSha256 || metadataGiraAncestorDigest(file) || readOperationalPolicyV203(file)?.historicalEngineSha256 || historicalEngineDigestV2(file);
import assert from 'node:assert/strict';
import { register } from 'node:module';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { pathToFileURL, fileURLToPath } from 'node:url';

// Sealed governance verifier, preload and root-only transactional recovery.
// Historical checkpoints remain immutable; each successor is registered exactly.
export const PREDECESSOR_COMMIT = '87cc5842948695e6a0b80b7d4d1c904c5cef6290';
export const PREDECESSOR_TREE = '40457d45e6a8b6c5a5717c3f0db19f1f5441bb66';
export const HISTORICAL_R5_SHA256 = 'ef5b6c61119aa0fe694d83a323cca30ad8655246d40af28f887cf6ed133b1bd3';
export const REGISTRY_ROOT = '/var/lib/vitalismen-deploy/sealed-successors-v1';
const SHA1 = /^[a-f0-9]{40}$/;
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))(?!.*\/\/)[A-Za-z0-9_.-]+(?:\/[A-Za-z0-9_.-]+)*$/;
const KEYS = ['AUTHORITY_CLASS', 'AUTHORITY_VERSION', 'PROJECT',
    'PREDECESSOR_COMMIT', 'PREDECESSOR_TREE', 'PREDECESSOR_CHECKPOINT_SHA256',
    'SUCCESSOR_COMMIT', 'SUCCESSOR_TREE', 'ALLOWED_DELTA', 'FILE_HASHES',
    'CREATED_AT', 'FAIL_CLOSED'].sort();
export const sha256 = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
export const canonicalBytes = object => Buffer.from(`${JSON.stringify(object, null, 2)}\n`);
const sameKeys = (object, keys, reason) => {
    assert.ok(object && typeof object === 'object' && !Array.isArray(object), reason);
    assert.deepEqual(Object.keys(object).sort(), [...keys].sort(), reason);
};

export function verifyAuthorityBytes(bytes, trustedSealSha256, historicalCheckpointBytes,
    predecessor = { commit: PREDECESSOR_COMMIT, tree: PREDECESSOR_TREE }) {
    assert.match(trustedSealSha256, SHA256, 'SEALED_AUTHORITY_SEAL_INVALID');
    assert.equal(sha256(bytes), trustedSealSha256, 'SEALED_AUTHORITY_TAMPERED');
    assert.equal(sha256(historicalCheckpointBytes), HISTORICAL_R5_SHA256,
        'SEALED_HISTORICAL_R5_TAMPERED');
    const a = JSON.parse(bytes.toString('utf8'));
    assert.deepEqual(bytes, canonicalBytes(a), 'SEALED_AUTHORITY_NONCANONICAL');
    sameKeys(a, KEYS, 'SEALED_AUTHORITY_FIELDS_INVALID');
    assert.equal(a.AUTHORITY_CLASS, 'SEALED_SUCCESSOR');
    assert.equal(a.AUTHORITY_VERSION, 1);
    assert.equal(a.PROJECT, 'VITALISMEN_EC');
    assert.equal(a.FAIL_CLOSED, true);
    assert.equal(a.PREDECESSOR_COMMIT, predecessor.commit, 'SEALED_PREDECESSOR_COMMIT_INVALID');
    assert.equal(a.PREDECESSOR_TREE, predecessor.tree, 'SEALED_PREDECESSOR_TREE_INVALID');
    assert.equal(a.PREDECESSOR_CHECKPOINT_SHA256, HISTORICAL_R5_SHA256);
    assert.match(a.SUCCESSOR_COMMIT, SHA1);
    assert.match(a.SUCCESSOR_TREE, SHA1);
    assert.notEqual(a.SUCCESSOR_COMMIT, predecessor.commit, 'SEALED_EMPTY_SUCCESSOR');
    assert.notEqual(a.SUCCESSOR_TREE, predecessor.tree, 'SEALED_EMPTY_TREE');
    assert.equal(new Date(a.CREATED_AT).toISOString(), a.CREATED_AT, 'SEALED_TIME_INVALID');
    assert.ok(Array.isArray(a.ALLOWED_DELTA) && a.ALLOWED_DELTA.length > 0,
        'SEALED_EMPTY_DELTA');
    assert.deepEqual(a.ALLOWED_DELTA, [...new Set(a.ALLOWED_DELTA)].sort(),
        'SEALED_DELTA_NOT_SORTED_UNIQUE');
    for (const relative of a.ALLOWED_DELTA) {
        assert.equal(typeof relative, 'string');
        assert.match(relative, SAFE_PATH, 'SEALED_PATH_INVALID');
        assert.ok(relative !== '.git' && !relative.startsWith('.git/')
            && !relative.split('/').includes('.'), 'SEALED_PATH_INVALID');
        assert.ok(!relative.split('/').some(segment => /^\.env(?:\.|$)/.test(segment)),
            'SEALED_SECRET_PATH_FORBIDDEN');
    }
    sameKeys(a.FILE_HASHES, a.ALLOWED_DELTA, 'SEALED_HASH_KEYS_INVALID');
    for (const digest of Object.values(a.FILE_HASHES)) assert.match(digest, SHA256);
    return Object.freeze(a);
}

// Facts must come from readGitCandidateFacts, not request data. This pure
// comparison is exported separately so negative tests need no production I/O.
export function verifyCandidateFacts(authority, facts) {
    assert.equal(facts.predecessorCommit, authority.PREDECESSOR_COMMIT,
        'SEALED_CANDIDATE_PREDECESSOR_INVALID');
    assert.equal(facts.predecessorTree, authority.PREDECESSOR_TREE,
        'SEALED_CANDIDATE_PREDECESSOR_TREE_INVALID');
    assert.equal(facts.commit, authority.SUCCESSOR_COMMIT, 'SEALED_UNREGISTERED_COMMIT');
    assert.equal(facts.tree, authority.SUCCESSOR_TREE, 'SEALED_UNREGISTERED_TREE');
    assert.deepEqual(facts.parents, [authority.PREDECESSOR_COMMIT], 'SEALED_PARENT_INVALID');
    assert.equal(facts.clean, true, 'SEALED_CHECKOUT_DIRTY');
    assert.deepEqual(facts.changedPaths, authority.ALLOWED_DELTA, 'SEALED_DELTA_INVALID');
    assert.deepEqual(facts.fileHashes, authority.FILE_HASHES, 'SEALED_FILE_HASH_INVALID');
    return Object.freeze({ authorityClass: 'SEALED_SUCCESSOR', valid: true,
        commit: facts.commit, tree: facts.tree, authoritySha256: sha256(canonicalBytes(authority)) });
}

export function readGitCandidateFacts(root, authority) {
    const physical = fs.realpathSync(root);
    const git = (...args) => execFileSync('git', ['-C', physical, ...args], {
        encoding: 'utf8', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1' },
        maxBuffer: 16 * 1024 * 1024
    }).trim();
    const commit = git('rev-parse', 'HEAD');
    const tree = git('rev-parse', 'HEAD^{tree}');
    assert.equal(commit, authority.SUCCESSOR_COMMIT, 'SEALED_UNREGISTERED_COMMIT');
    assert.equal(tree, authority.SUCCESSOR_TREE, 'SEALED_UNREGISTERED_TREE');
    const changes = git('diff', '--name-status', '--no-renames',
        authority.PREDECESSOR_COMMIT, commit).split(/\r?\n/).filter(Boolean);
    const changedPaths = changes.map(line => {
        const [status, relative, extra] = line.split('\t');
        assert.ok(['A', 'M'].includes(status) && relative && extra === undefined,
            'SEALED_CHANGE_TYPE_INVALID');
        return relative;
    }).sort();
    const fileHashes = {};
    for (const relative of changedPaths) {
        assert.match(relative, SAFE_PATH);
        const item = git('ls-tree', commit, '--', relative);
        assert.ok(item.startsWith('100644 blob ') || item.startsWith('100755 blob '),
            'SEALED_NONREGULAR_GIT_FILE');
        const bytes = execFileSync('git', ['-C', physical, 'show', `${commit}:${relative}`],
            { maxBuffer: 16 * 1024 * 1024 });
        const file = path.join(physical, relative);
        const stat = fs.lstatSync(file);
        assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'SEALED_NONREGULAR_FILE');
        assert.equal(sha256(fs.readFileSync(file)), sha256(bytes), 'SEALED_WORKTREE_HASH_INVALID');
        fileHashes[relative] = sha256(bytes);
    }
    return { predecessorCommit: authority.PREDECESSOR_COMMIT,
        predecessorTree: git('rev-parse', `${authority.PREDECESSOR_COMMIT}^{tree}`),
        commit, tree, parents: git('rev-list', '--parents', '-n', '1', commit).split(' ').slice(1),
        clean: git('status', '--porcelain=v1', '--untracked-files=all').split(/\r?\n/)
            .filter(Boolean).every(line => line.startsWith('?? ') && GENERATED.has(line.slice(3))),
        changedPaths, fileHashes };
}

function rootOwnedRegular(file) {
    const stat = fs.lstatSync(file);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o777) === 0o400, 'SEALED_FILE_PERMISSIONS');
    return fs.readFileSync(file);
}

export function readRegisteredAuthority(successorCommit) {
    assert.equal(process.platform, 'linux', 'SEALED_REGISTRY_LINUX_ONLY');
    assert.match(successorCommit, SHA1, 'SEALED_REGISTRY_KEY_INVALID');
    return registryEnvelope(successorCommit).authority;
}

export function verifyRegisteredGitSuccessor(root) {
    return requireSealedRelease(root, { requireGit: true });
}

export const SEALED_PRELOAD_RELATIVE = 'scripts/lib/sealed-successor-preload-v1.mjs';
export const GOVERNANCE_PATHS = Object.freeze([
    'ops/ec-bot-core-v78-successor-r4', 'ops/vitalismen-stage',
    'scripts/lib/ec-bot-core-operational-contract-v78.mjs',
    'scripts/lib/pm2-target-env-restart-v78-r4.mjs', SEALED_PRELOAD_RELATIVE,
    'scripts/lib/ec-runtime-successor-v168b-preload-context.mjs',
    'src/services/ecBotCoreOperationalV78Service.js'
].sort());
export const VIT_HASHES = Object.freeze({
    'src/services/ecBotCoreRuntimeIntegrationV78Service.js':
        'b2f9ba39fe456fc66363da01d5b30c2e30ef1b0423d835a8c55d43774238d51c',
    'src/services/ecOfficialVslEntryV78Service.js':
        'ffb25713f1b80023479e3bb84eeebf9ee1a50bc208c3d82882511adfe051356d'
});

// One explicit QA persistence-order edge; no descendant admission rule.
const QA_ORDER = Object.freeze({
    purpose: 'QA_AUDIENCE_ORDER_39701BD',
    predecessor: '227e5f864348595408762dad6b5b6a41b41d5fca',
    predecessorTree: 'eb573f0b21ef1152c3cbfb5afe981c15a558c10c',
    predecessorRelease: '20261004T010000Z_production-20261004-227e5f8',
    parentSeal: '270c27a8345d81918f74596f4faa522e9d6f3105760dc15895ea4ad681bf9399',
    successor: '39701bd18f33865a521d89ee6710f708dce6b3c7',
    tree: '2ea302747b75d48f0dc1b34ed72a78d8a5010004',
    seal: '40fb29fe46106e0580870d3009d438524ec8740a587d8534e67cb23d3cf36908',
    hashes: Object.freeze({
        "src/routes/zapi.js": "0f45688306f1258449ac61decd54d06a29dd66109db1e23641d2e952e30be96f",
        "src/services/ecBotCoreRuntimeIntegrationV78Service.js": "3f94080b62107199b3865010eb19c104dffc06925e407352576e2b0a234963cf"
})
});
const isQaOrder = sealed => sealed.envelope.PURPOSE === QA_ORDER.purpose;
const HOME_ORDER = Object.freeze({
    purpose: 'HOME_DELIVERY_MODE_4EAF9E6',
    predecessorRelease: '20261005T151959Z_production-20261005-39701bd',
    successor: '4eaf9e644d7ac48bf37d02f2956b1ca1f062d21c',
    tree: '027bc982d2417639d96e2a4012ce30bcc898db4d',
    seal: '1759e74c0d52ce317cb5de6d18d5d64cea0b901333219352285422041089f473',
    hashes: Object.freeze({ 'src/routes/whatsapp.js': '6e73dab15d805483cda7f8b8e3227943140cf24ecdd98d575eca17bc91d47447' })
});
const isHomeOrder = sealed => sealed.envelope.PURPOSE === HOME_ORDER.purpose;

// One human-authorized lab edge; no historical edge or descendant rule changes.
const MANUAL_QA = Object.freeze({
  "purpose": "MANUAL_QA_8637_2958_EXACT_EDGE_V1",
  "successor": "12d7f5483b1771259b54c15d72be1ed4c7d557b8",
  "tree": "a2be06fd5fb0c74702fbabf4f9b7690d6e7d007b",
  "release": "20261023T213127Z_production-20261023-12d7f54",
  "predecessorRelease": "20261006T042627Z_production-20261006-4eaf9e6",
  "parentSeal": "1759e74c0d52ce317cb5de6d18d5d64cea0b901333219352285422041089f473",
  "seal": "16160427ccb3a02e163f2c2bf699ee62e1c75e5f4fad4dc154fb2426775d3aad",
  "approvalSeal": "bbd864502b4ab101d3a25533de2d7fc2bda240a7fa5a34d6628068a3a6acc5c8",
  "hashes": {
    "public/qr.html": "f61686c080cf1c5d3e07c3d2edd8600049356422af5e7612b0d9c7c12a02cb08",
    "src/routes/whatsapp.js": "89ec80dd620b2169b77f1915af5527399776b6d88413cd7fa7560de324433c60",
    "src/services/ecBotCoreRuntimeIntegrationV78Service.js": "8ae13c37e9421fa678c6211257f67fbd860cdfb4df78ee35293e4f27b1fb8da6",
    "src/services/manualHumanContract.js": "bd411911d8961c272c2a71451b2ee26376d1fa385c8d42b669ecb4c85d8655eb",
    "src/services/manualHumanRuntime.js": "6c067dd5be250ed052026f6da816680a88f62061248f4028941c337dbcc92ee1",
    "src/services/strictReadOnlyObservationService.js": "79141ea14a0826a13f9d544ad6342dc30668f01f485a46fc4493525dc6956f08"
  }
});
const isManualQa = sealed => sealed.envelope.PURPOSE === MANUAL_QA.purpose;


// New exact commercial manual edge. The QA and older records are unchanged.
const MANUAL_COMMERCIAL = Object.freeze({
  "purpose": "MANUAL_COMMERCIAL_2958_EXACT_EDGE_V1",
  "successor": "da137b11229181f3afb49333fef06225cf1a566d",
  "tree": "db403127258dfcd5c8a42def3e33b07c8033490d",
  "release": "20261024T030000Z_production-20261024-da137b1",
  "predecessorRelease": "20261023T213127Z_production-20261023-12d7f54",
  "parentSeal": "16160427ccb3a02e163f2c2bf699ee62e1c75e5f4fad4dc154fb2426775d3aad",
  "seal": "be2549b2822709775c543ee8b2d0bf2a7d43f67f39203aaea9698d757c7bff0e",
  "hashes": {
    "src/services/manualCommercialScope.js": "180e0f03d2bd5579902746b88737cf0c240b2f4135cc81c6935184749ed3863e",
    "src/services/manualHumanContract.js": "fe298a61189ff3f349be4edfd972e200765cb387e9d41f1fc2e7c16dc7ad4a60",
    "src/services/manualHumanRuntime.js": "438095cffd021597928d8b8e8b5e3b810e979168d3db28fe685692549a44f210"
  }
});
const isManualCommercial = sealed => sealed.envelope.PURPOSE === MANUAL_COMMERCIAL.purpose;
export function validateManualCommercialApproval(bytes, { isolated = false, nowMs = Date.now() } = {}) {
    const a = JSON.parse(bytes);
    assert.deepEqual(bytes, canonicalBytes(a), 'MANUAL_EC_NONCANONICAL');
    sameKeys(a, ['kind','project','scope','activationApproved','commit','tree','engineSHA256',
        'envelopeSHA256','files','recipientPolicy','connectedPhone','instanceSHA256','manualOnly',
        'globalStrictReadOnly','automationsAllowed','inboundAllowed','ackAllowed',
        'issuedAt','issuer','authorizationEvidence'], 'MANUAL_EC_FIELDS');
    assert.equal(a.kind, 'HUMAN_APPROVED_MANUAL_COMMERCIAL_2958');
    assert.equal(a.project, 'VITALISMEN_EC');
    assert.equal(a.scope, isolated ? 'ISOLATED_ONLY' : 'PRODUCTION_MANUAL_EC_EXISTING_CONVERSATIONS');
    assert.equal(a.activationApproved, !isolated, 'MANUAL_EC_NOT_APPROVED');
    assert.equal(a.commit, MANUAL_COMMERCIAL.successor); assert.equal(a.tree, MANUAL_COMMERCIAL.tree);
    assert.equal(a.engineSHA256, '636739cc57a96c7a27cf5d4420c11a20b6aee6227422a3ea334f47651716eebf', 'MANUAL_EC_ENGINE');
    assert.equal(a.envelopeSHA256, MANUAL_COMMERCIAL.seal);
    assert.deepEqual(a.files, MANUAL_COMMERCIAL.hashes);
    assert.equal(a.recipientPolicy, 'EXACT_EC_OFFICIAL_CONVERSATION_AND_OPERATOR_ACCESS_V1');
    assert.equal(a.connectedPhone, '553171862958');
    assert.equal(a.instanceSHA256, '2fe72823323c747f55916c661e563a5a07320741121ddfa5b955db52fa49be07');
    assert.equal(a.manualOnly, true); assert.equal(a.globalStrictReadOnly, true);
    for (const k of ['automationsAllowed','inboundAllowed','ackAllowed']) assert.equal(a[k], false);
    assert.equal(new Date(a.issuedAt).toISOString(), a.issuedAt);
    assert.ok(Date.parse(a.issuedAt) <= nowMs + 120000, 'MANUAL_EC_FUTURE');
    for (const k of ['issuer','authorizationEvidence']) assert.ok(typeof a[k] === 'string'
        && a[k].length >= 8 && !/^PENDING/.test(a[k]), 'MANUAL_EC_EVIDENCE');
    return Object.freeze(a);
}
function requireManualCommercialApproval() {
    assertRootOperation();
    assertManualQaStrictProfile();
    assert.equal(process.env.VITALISMEN_MANUAL_CONTRACT_APPROVED, 'true');
    assert.equal(process.env.VITALISMEN_MANUAL_COMMERCIAL_APPROVED, 'true');
    const production = '/var/lib/vitalismen-deploy/manual-commercial2958-production-approval-v1.json';
    if (fs.existsSync(production)) return validateManualCommercialApproval(rootOwnedRegular(production));
    // A lab record cannot authorize production: require hostname AND a NIC-isolated namespace.
    assert.equal(fs.readFileSync('/etc/hostname','utf8').trim(), 'vitalismen-qa2958-lab');
    assert.deepEqual(fs.readdirSync('/sys/class/net').sort(), ['lo'], 'MANUAL_EC_LAB_NETWORK');
    return validateManualCommercialApproval(rootOwnedRegular(
        '/var/lib/vitalismen-deploy/manual-commercial2958-lab-approval-v1.json'), { isolated: true });
}
export function authorizeCommercialManualScope(root) {
    const sealed = requireSealedRelease(root);
    assert.ok((isManualCommercial(sealed) || isDropiList(sealed)), 'MANUAL_EC_WRONG_RELEASE');
    const a = requireManualCommercialApproval();
    return Object.freeze({ manualCommercialAllowed: true, connectedPhone: a.connectedPhone,
        instanceSHA256: a.instanceSHA256, commit: a.commit, tree: a.tree, scope: a.scope });
}


// Exact, separately approved list-contract successor. No generic descendants.
const DROPI_LIST = Object.freeze({
  "purpose": "DROPI_BFF_LIST_POSTSALE2958_EXACT_EDGE_V1",
  "successor": "0b5ae378db1156d5fb5f65815fc2eb55604323db",
  "tree": "e4e7457d93e210ebd02f923c072fd462d36c82f3",
  "release": "20261024T033527Z_production-20261024-0b5ae37",
  "predecessorRelease": "20261024T030000Z_production-20261024-da137b1",
  "parentSeal": "be2549b2822709775c543ee8b2d0bf2a7d43f67f39203aaea9698d757c7bff0e",
  "seal": "b22fc08c6c40477ba1cc4eadb934f0d6d68823931180641d5ab6fd82b44755ec",
  "hashes": {
    "src/services/dropiBffAdapter.js": "9c2f331d59aa15d3f89458f3cba5d94f9abb49ae2a03c733533ebe77c9a16975",
    "src/services/dropiBffListContract.js": "29b47e6189e6a7771d52b57740c7f047e3a9e8f2caf953b1c7dacaf209341187",
    "src/services/droppiEcuadorBrowserService.js": "40b0ef60190294470b239bd3a59b9564bf5c3adbe50593bddb9d8c1eada93e09",
    "tests/dropi-bff-manual-v60.test.mjs": "83edc02d326f78e527e0e031134c6997bf700c3241c6edc83943c42d4690e0c9"
  }
});
const isDropiList = sealed => sealed.envelope.PURPOSE === DROPI_LIST.purpose;
const OPERATIONS_V203 = Object.freeze({
  "purpose": "EC_ORDERS_AND_POSTSALE_V203_R3_EXACT_EDGE",
  "successor": "618339a390302242c2fc3218681086f57ac9a545",
  "tree": "03d065e235c88433b8d5121eaeac597c763e8218",
  "release": "20261109T060629Z_production-20261109-618339a",
  "predecessorRelease": "20261024T033527Z_production-20261024-0b5ae37",
  "parentSeal": "b22fc08c6c40477ba1cc4eadb934f0d6d68823931180641d5ab6fd82b44755ec",
  "seal": "35df795287d5dd367a426b290570babeac6e5cfd5c62996061348b1fc1a26637",
  "hashes": {
    "src/middleware/auth.js": "7410858900fc68faa4fb2ba00857043b8c2f52bee4478dcfcd7e98187aa8d800",
    "src/models/Order.js": "b236cc05e2a5a528e85bfe15f7a0f47cd6b0d53deb5654f3940d9928a5fa40a1",
    "src/routes/orders.js": "5d18b7f048ac8ff5f77025dc0918a5e6bcbe647d1b69a2002e31ee98994a4228",
    "src/routes/shipments.js": "5d8d3c0a046e3d40e17e3152243850a0013ec727229a8c550d1aba13ba9242cc",
    "src/routes/whatsapp.js": "fdec2b4da25635d0ffcfcc4103fd16cc9188410a5cd062a5848ce167f5257375",
    "src/services/customerPurchaseEligibilityService.js": "e9083353a167ac15247e698af4794e3352eb18634132e69340280f424699456f",
    "src/services/dropiBffAdapter.js": "d6a6a6e52c17b1372440481e7b73ad1b40a77b3a2f855738b9c1f5151fae3f85",
    "src/services/dropiBffListContract.js": "ea0056eb2cf66924eea89ce0d150c3ecc74b54a25297765288eeaf9dec12999f",
    "src/services/droppiEcuadorBrowserService.js": "6df0771816db184110aa9bc7fe49bdf7ad14401e4f703459b6796866d4890b5c",
    "src/services/droppiEcuadorService.js": "35f9e1cb829ce0494a0db0ccfe1340a79a501e4b2cb9b2458a3466e56137b220",
    "src/services/ecBotCoreRuntimeIntegrationV78Service.js": "46e57509e8a993b18bf387b11fca748b873ac19bb860da4f588e90d01136f01b",
    "src/services/ecDeliveredRepurchaseService.js": "dbe1d82fab97cdb6adba3b6d0a1c81ac28c5a3377406e647b6ca5f6d3b141362",
    "src/services/ecHistoricalLegacyV203Service.js": "d90de1d299cdffc9d177482c568b4fb7f4bb071c415024416ec924c68ff15268",
    "src/services/ecHistoricalOrderStatusV203Service.js": "c10a7c516829cc2d0803308f5e0dff79ccaa808bbb124061f7b337aeac40f75b",
    "src/services/ecPanelStatusOperationsV177Service.js": "e5ef794bdf0c0c7bd072a47233f70b557be6e5163d82a6a17c35b7f62911894b",
    "tests/ec-complete-operations-v203.test.mjs": "f6e48692437c6df785be1fd5af282d817fa0c27939c248cd1c05e5215e4cecd5"
  },
  "approvalSeal": "a927464fbe316610bcd196dff5fb0f1f51552662417fdf3f41454eee7f3b6847"
});
const isOperationsV203 = sealed => sealed.envelope.PURPOSE === OPERATIONS_V203.purpose;
const GIRA_BRIDGE=Object.freeze({
  "purpose": "GIRA21X_EC_BRIDGE_V1_EXACT_EDGE",
  "successor": "5bd8437781325ae7be6f6988d129ebb90edc9686",
  "tree": "f9b3d5109c7e7433f78cbcebcd5857bcb5c92a0e",
  "release": "20261109T204400Z_production-20261109-5bd8437",
  "predecessorRelease": "20261109T060629Z_production-20261109-618339a",
  "parentSeal": "35df795287d5dd367a426b290570babeac6e5cfd5c62996061348b1fc1a26637",
  "seal": "deae15bd880716e95981cc45851a0a1aa9ff9666908605f9b485209fee15b3e9",
  "hashes": {
    "ops/ec-bot-core-v78-successor-r4": "cf4f033af761d52704199124025dd83bdf775a1292be3b457717cd3d667086ce",
    "ops/vitalismen-stage": "0a6de159aa42ed8aec8060e769dd7b20fae185aaa4ae432969f5d9965c85ef79",
    "scripts/lib/ec-bot-core-operational-contract-v78.mjs": "d321155d18d7413a1e8bbea5f6664bc2334247d37d001a0e6e324395525d459d",
    "scripts/lib/pm2-target-env-restart-v78-r4.mjs": "8bffb0a61d6cf1532ce2baa22bec20bf1f3de305006b15385a16a1caef032330",
    "scripts/lib/sealed-successor-preload-v1.mjs": "36e6c36afa3409b0d836ec07ea8f7f3f251c370f718c5a46c5a27fc46f4d2f34",
    "src/index.js": "c01533aa6d19a0f6f3acac5a29fa8ce6d08e43d698bf7120602f5d1e0c00bf50",
    "src/models/Order.js": "4a4dbc364a2235c0bf550238a38626cb6c6f921d717b5f8c07a078713603ebce",
    "src/services/agentRouter.js": "ad277a658a2362c06da3b2beb2ff8a9a4e289be9f2c16ce1855748430bbc00e0",
    "src/services/carrierTrackingService.js": "c96ea5ac132a44ff151d5e6de16f1bc16c8e050b759c214fcff4a9d444696c90",
    "src/services/droppiEcuadorBrowserService.js": "9b7dae079fc7bb43e6e19ab822c90f66e463cd3bf5733da59efaaee31ecd555e",
    "src/services/ecBotCoreOperationalV78Service.js": "b62ed7d279f3b0d6b22fb85b50ca75ccc9fa90e26ac32174695554eecccde1b8",
    "src/services/ecBotCoreRuntimeIntegrationV78Service.js": "94570d2df4053e3cc1d87c35e8cebeb174af15118ff062fbff46d2666f1d5af2",
    "src/services/gira21x/client.mjs": "5383e8ade0aa053dc19ccb1528fe5c72bbf19de28e51283eed1a25f08b993c65",
    "src/services/gira21x/cohort.mjs": "2149b8bfad7b9a9f6e70fd0a00bc4d53b55a4be6e2c4a60d069746daee1d695c",
    "src/services/gira21x/contract.mjs": "fa8c589b53c50b05f38eb2c276a1a7717164c07a9d7013b3b83b45c9bf952630",
    "src/services/gira21x/cycle.mjs": "57a90290a1a6312a06eba66e8b985d747d28d9ba7a03b68f5aad7ece5ebff009",
    "src/services/gira21x/mongo-store.mjs": "38dfcbaa0ff646f22c0c1257116165d921106cbc8260f9da4f3f4c3d968a401c",
    "src/services/gira21x/notice.mjs": "d3ab213f5159eead788fcb629022d9e5c04b034533a0f85b326fa4db4d55112b",
    "src/services/gira21x/protocol.mjs": "98e4b780a1e56d4d534f42f62c1640208a1e56299111dfdeb1da38141e210f87",
    "src/services/gira21x/runtime-policy.mjs": "42ed883711f4b3aa1f7d021479ca305c107d92d7a2ad6fd3dc46a5d4343ab3e1",
    "src/services/gira21x/runtime.mjs": "b5a63a513e9b69dcdc1767e11cc8f089b10e43a05690183bd0919ef26b6c8eb5",
    "src/services/gira21x/scheduler.mjs": "f0533d1a06cbd89a9ba60b33c817593601792028cef39cd02a2d94f1cfb10138",
    "src/services/manualCommercialScope.js": "3d35ea9fb165315cdc2c781307616cb8dd97ee222b54f11cb41185bacf19d3e3",
    "src/services/metaConversionsService.js": "f8429a7a7c8d1caf71180fd6c6e928fc31e9adab614a0ce089447d03509bf391",
    "src/whatsapp/sendAudio.js": "068a2cfae77677dd41858f3bdf3dbe8b0196752bdcb99fe8d31f5af26d4d1131",
    "src/whatsapp/sendDocument.js": "ce174557cb8b8b013b3015ddb6cdc9bbd9f72e8298c0891ac5bf6400f8265ba8",
    "src/whatsapp/sendImage.js": "92de84dc8c9dd88a79c738e5f8aa5e91cdb84813643bbf81d293ae1770b6c5ca",
    "src/whatsapp/sendText.js": "8641cc3b81b188dceb37f676a3d9ff23c036484f64ea5cb538d78b2b128bfcad",
    "src/whatsapp/sendVideo.js": "8f21d67685a706183d8cd70a3c22ab8b9666d3ea66349b4d7f9662eae547245c",
    "tests/gira21x-bridge.test.mjs": "730c4f12f8a2ea6ec8c03199846ac1116b86f6e68a5ae5aeed2f8c7bb6ca3628",
    "tests/gira21x-runtime-policy.test.mjs": "eee2e28520800de447b383aa0ca6ea0e41f8eaf6a76b2874380c10c416422a8e"
  },
  "approvalSeal": "469708b6d97c005ec8ddb3432ca42bd7fbae80963dac2d3eadd58e57c73a3ff6"
});
const GIRA_HANDOFF=Object.freeze({...handoffRegistration(),successor:handoffRegistration().commit});
const EC_REPURCHASE=Object.freeze({...repurchaseRegistrationV207(),successor:repurchaseRegistrationV207().commit});
const EC_AUDIO=Object.freeze({...audioRegistrationV208(),successor:audioRegistrationV208().commit});
const EC_PREPAID=Object.freeze({...prepaidRegistrationV1(),successor:prepaidRegistrationV1().commit});
const EC_TRACKING=Object.freeze({...trackingRegistrationV210(),successor:trackingRegistrationV210().commit});
const EC_FREEFLOW=Object.freeze({...freeflowRegistrationV212(),successor:freeflowRegistrationV212().commit});
const EC_MEASUREMENT=Object.freeze({...measurementRegistrationV213(),successor:measurementRegistrationV213().commit});
const EC_OWNER=Object.freeze({...inboundOwnerRegistrationV214(),successor:inboundOwnerRegistrationV214().commit});
const EC_B01=Object.freeze({...b01RegistrationV216(),successor:b01RegistrationV216().commit});
const EC_PRIORITY=Object.freeze({...priorityRegistrationV219(),successor:priorityRegistrationV219().commit});
const EC_WEB=Object.freeze({...webChatRegistrationV220(),successor:webChatRegistrationV220().commit});
const EC_RECALL=Object.freeze({...webChatRecallRegistrationV220(),successor:webChatRecallRegistrationV220().commit});
const EC_CONTEXT=Object.freeze({...webChatContextRegistrationV220(),successor:webChatContextRegistrationV220().commit});
const EC_DASHBOARD=Object.freeze({...webDashboardRegistrationV222(),successor:webDashboardRegistrationV222().commit});
const EC_STORE=Object.freeze({...webDashboardStoreRegistrationV222(),successor:webDashboardStoreRegistrationV222().commit});
const EC_INBOUND=Object.freeze({...inboundRoutingRegistrationV227(),successor:inboundRoutingRegistrationV227().commit});
const EC_BURST=Object.freeze({...burstReplyRegistrationV228(),successor:burstReplyRegistrationV228().commit});
const EC_FIX=Object.freeze({...botDropiRegistrationV229(),successor:botDropiRegistrationV229().commit});
const EC_SALE=Object.freeze({...sdrSaleRegistrationV230(),successor:sdrSaleRegistrationV230().commit});
const EC_VOICE=Object.freeze({...webVoiceStatusRegistrationV231(),successor:webVoiceStatusRegistrationV231().commit});
const EC_INVITES=Object.freeze({...customerInvitesRegistrationV232(),successor:customerInvitesRegistrationV232().commit});
const EC_CHAT=Object.freeze({...chatAccessRegistrationV236(),successor:chatAccessRegistrationV236().commit});
const EC_JOURNEY=Object.freeze({...journeyMeasurementRegistrationV237(),successor:journeyMeasurementRegistrationV237().commit});
const EC_ACCESS=Object.freeze({...orderAccessRegistrationV238(),successor:orderAccessRegistrationV238().commit});
const EC_PRICE=Object.freeze({...priceClosureRegistrationV239(),successor:priceClosureRegistrationV239().commit});
const EC_TEX=Object.freeze({...texUltraWebChatRegistrationV240(),successor:texUltraWebChatRegistrationV240().commit});
const EC_QA=Object.freeze({...qaNaturalEntryRegistrationV241(),successor:qaNaturalEntryRegistrationV241().commit});
const EC_LINKED=Object.freeze({...texLinkedEntryRegistrationV242(),successor:texLinkedEntryRegistrationV242().commit});
const EC_PERIOD=Object.freeze({...b01PeriodPriceRegistrationV243(),successor:b01PeriodPriceRegistrationV243().commit});
const EC_MEASURE=Object.freeze({...texMeasurementRegistrationV243(),successor:texMeasurementRegistrationV243().commit});
const EC_QA_CYCLE=Object.freeze({...qaB01CycleRegistrationV244R8(),successor:qaB01CycleRegistrationV244R8().commit});
const EC_TEX_ENTRY=Object.freeze({...texEntryInvitesRegistrationV246(),successor:texEntryInvitesRegistrationV246().commit});
const EC_NAMED=Object.freeze({...b01NamedEntryRegistrationV246R5(),successor:b01NamedEntryRegistrationV246R5().commit});
const EC_TEX_START=Object.freeze({...texEntryGreetingRegistrationV249(),successor:texEntryGreetingRegistrationV249().commit});
const EC_TEX_INVITE=Object.freeze({...texPostLeadRegistrationV251(),successor:texPostLeadRegistrationV251().commit});
const EC_ORDERS=Object.freeze({...ordersDropiPostSaleRegistrationV252(),successor:ordersDropiPostSaleRegistrationV252().commit});
const EC_CUSTOMER=Object.freeze({...customerEditPaquizhaRegistrationV253(),successor:customerEditPaquizhaRegistrationV253().commit});
const EC_INTEGRATION=Object.freeze({...orderIntegrationRegistrationV254(),successor:orderIntegrationRegistrationV254().commit});
const isEcIntegration=sealed=>sealed.envelope.PURPOSE===EC_INTEGRATION.purpose;
const isEcCustomer=sealed=>sealed.envelope.PURPOSE===EC_CUSTOMER.purpose||isEcIntegration(sealed);
const isEcOrders=sealed=>sealed.envelope.PURPOSE===EC_ORDERS.purpose||isEcCustomer(sealed);
const isEcTexInvite=sealed=>sealed.envelope.PURPOSE===EC_TEX_INVITE.purpose||isEcOrders(sealed);
const isEcTexStart=sealed=>sealed.envelope.PURPOSE===EC_TEX_START.purpose||isEcTexInvite(sealed);
const isEcNamed=sealed=>sealed.envelope.PURPOSE===EC_NAMED.purpose||isEcTexStart(sealed);
const isEcTexEntry=sealed=>sealed.envelope.PURPOSE===EC_TEX_ENTRY.purpose||isEcNamed(sealed);
const isEcQaCycle=sealed=>sealed.envelope.PURPOSE===EC_QA_CYCLE.purpose||isEcTexEntry(sealed);
const isEcMeasure=sealed=>sealed.envelope.PURPOSE===EC_MEASURE.purpose||isEcQaCycle(sealed);
const isEcPeriod=sealed=>sealed.envelope.PURPOSE===EC_PERIOD.purpose||isEcMeasure(sealed);
const isEcLinked=sealed=>sealed.envelope.PURPOSE===EC_LINKED.purpose||isEcPeriod(sealed);
const isEcQa=sealed=>sealed.envelope.PURPOSE===EC_QA.purpose||isEcLinked(sealed);
const isEcTex=sealed=>sealed.envelope.PURPOSE===EC_TEX.purpose||isEcQa(sealed);
const isEcPrice=sealed=>sealed.envelope.PURPOSE===EC_PRICE.purpose||isEcTex(sealed);
const isEcAccess=sealed=>sealed.envelope.PURPOSE===EC_ACCESS.purpose||isEcPrice(sealed);
const isEcJourney=sealed=>sealed.envelope.PURPOSE===EC_JOURNEY.purpose||isEcAccess(sealed);
const isEcChat=sealed=>sealed.envelope.PURPOSE===EC_CHAT.purpose||isEcJourney(sealed);
const isEcInvites=sealed=>sealed.envelope.PURPOSE===EC_INVITES.purpose||isEcChat(sealed);
const isEcVoice=sealed=>sealed.envelope.PURPOSE===EC_VOICE.purpose||isEcInvites(sealed);
const isEcSale=sealed=>sealed.envelope.PURPOSE===EC_SALE.purpose||isEcVoice(sealed);
const isEcFix=sealed=>sealed.envelope.PURPOSE===EC_FIX.purpose||isEcSale(sealed);
const isEcBurst=sealed=>sealed.envelope.PURPOSE===EC_BURST.purpose||isEcFix(sealed);
const isEcInbound=sealed=>sealed.envelope.PURPOSE===EC_INBOUND.purpose||isEcBurst(sealed);
const isEcStore=sealed=>sealed.envelope.PURPOSE===EC_STORE.purpose||isEcInbound(sealed);
const isEcDashboard=sealed=>sealed.envelope.PURPOSE===EC_DASHBOARD.purpose||isEcStore(sealed);
const isEcContext=sealed=>sealed.envelope.PURPOSE===EC_CONTEXT.purpose||isEcDashboard(sealed);
const isEcRecall=sealed=>sealed.envelope.PURPOSE===EC_RECALL.purpose||isEcContext(sealed);
const isEcWeb=sealed=>sealed.envelope.PURPOSE===EC_WEB.purpose||isEcRecall(sealed);
const isEcPriority=sealed=>sealed.envelope.PURPOSE===EC_PRIORITY.purpose||isEcWeb(sealed);
const isEcB01=sealed=>sealed.envelope.PURPOSE===EC_B01.purpose||isEcPriority(sealed);
const isEcOwner=sealed=>sealed.envelope.PURPOSE===EC_OWNER.purpose||isEcB01(sealed);
const isEcMeasurement=sealed=>sealed.envelope.PURPOSE===EC_MEASUREMENT.purpose||isEcOwner(sealed);
const isEcFreeflow=sealed=>sealed.envelope.PURPOSE===EC_FREEFLOW.purpose||isEcMeasurement(sealed);
const isEcTracking=sealed=>sealed.envelope.PURPOSE===EC_TRACKING.purpose||isEcFreeflow(sealed);
const isEcPrepaid=sealed=>sealed.envelope.PURPOSE===EC_PREPAID.purpose||isEcTracking(sealed);
const isEcAudio=sealed=>sealed.envelope.PURPOSE===EC_AUDIO.purpose||isEcPrepaid(sealed);
const isEcRepurchase=sealed=>sealed.envelope.PURPOSE===EC_REPURCHASE.purpose||isEcAudio(sealed);
const isGiraHandoff=sealed=>sealed.envelope.PURPOSE===GIRA_HANDOFF.purpose||isEcRepurchase(sealed);
const isGiraBridge=sealed=>sealed.envelope.PURPOSE===GIRA_BRIDGE.purpose||isGiraHandoff(sealed);
function metadataGiraAncestorDigest(file){
 if(process.env.VITALISMEN_GIRA21X_BRIDGE_PROFILE_V1==='true'||process.env.VITALISMEN_EC_OPERATIONAL_POLICY_V203==='true'||process.env.VITALISMEN_EC_OPERATIONAL_POLICY_V2==='true')return null;
 if(process.env.VITALISMEN_STRICT_READ_ONLY!=='true'||process.env.SAFE_OBSERVATION_POLICY!=='STRICT_READ_ONLY'||process.env.DISABLE_SCHEDULER!=='1')return null;
 for(const key of ['VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED','VIT_POWER_FUNNEL_ACTIVE','WHATSAPP_AUTO_REPLY_ENABLED','WHATSAPP_FUNNEL_ENABLED','ZAPI_ROUTE_INBOUND_TO_BOT','ZAPI_PERSIST_INBOUND_ENABLED','ZAPI_PERSIST_ACK_ENABLED','SERVER_FUNNEL_ENABLED','AI_WORKER_ENABLED','SHIPMENT_STATUS_DISPATCH_ENABLED','SHIPMENT_PICKUP_REMINDERS_ENABLED','PICKUP_PROOF_SWEEP_ENABLED'])if(process.env[key]!=='false')return null;
 requireGiraApproval('/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs',GIRA_BRIDGE);
 const bytes=rootOwnedRegular('/var/lib/vitalismen-deploy/ec-operations-policy-v203-r6.json');
 assert.equal(sha256(bytes),'8489231db64fda81bf9a684a7e0ed3e343d0f068bf45bec362c631b2bdea58c3','GIRA_METADATA_PARENT_POLICY');
 const old=JSON.parse(bytes);assert.equal(old.commit,OPERATIONS_V203.successor);assert.equal(old.tree,OPERATIONS_V203.tree);
 const historical=rootOwnedRegular(old.historicalEngineBackup);assert.equal(sha256(historical),'a244e3154d62de26f25d15ad3f33292fd27724623fe34efd1503b9c964ce0805','GIRA_METADATA_ANCESTOR_BYTES');
 return sha256(historical);
}
export function validateDropiListApproval(bytes,{isolated=false,nowMs=Date.now(),engineSHA256=historicalEngineDigestForPolicyV2(fileURLToPath(import.meta.url))}={}) {
 const a=JSON.parse(bytes);assert.deepEqual(bytes,canonicalBytes(a),'DROPI_LIST_NONCANONICAL');
 sameKeys(a,['kind','project','scope','activationApproved','commit','tree','engineSHA256','envelopeSHA256','files','mainStrictReadOnly','inboundAllowed','ackAllowed','botAllowed','postSalePolicyUnchanged','issuedAt','issuer','authorizationEvidence'],'DROPI_LIST_FIELDS');
 assert.equal(a.kind,'HUMAN_APPROVED_DROPI_BFF_LIST_2958');assert.equal(a.project,'VITALISMEN_EC');
 assert.equal(a.scope,isolated?'ISOLATED_ONLY':'PRODUCTION_EXACT_DROPI_LIST_2958');assert.equal(a.activationApproved,!isolated);
 assert.equal(a.commit,DROPI_LIST.successor);assert.equal(a.tree,DROPI_LIST.tree);assert.equal(a.engineSHA256,engineSHA256,'DROPI_LIST_ENGINE');
 assert.equal(a.envelopeSHA256,DROPI_LIST.seal);assert.deepEqual(a.files,DROPI_LIST.hashes);
 assert.equal(a.mainStrictReadOnly,true);assert.equal(a.postSalePolicyUnchanged,true);
 for(const k of ['inboundAllowed','ackAllowed','botAllowed'])assert.equal(a[k],false);
 assert.equal(new Date(a.issuedAt).toISOString(),a.issuedAt);assert.ok(Date.parse(a.issuedAt)<=nowMs+120000);
 for(const k of ['issuer','authorizationEvidence'])assert.ok(typeof a[k]==='string'&&a[k].length>=8&&!/^PENDING/.test(a[k]));
 return Object.freeze(a);
}
function requireDropiListApproval(){
 assertRootOperation();assertManualQaStrictProfile();
 const p='/var/lib/vitalismen-deploy/dropi-bff2958-production-approval-v1.json';
 if(fs.existsSync(p))return validateDropiListApproval(rootOwnedRegular(p));
 assert.equal(fs.readFileSync('/etc/hostname','utf8').trim(),'vitalismen-qa2958-lab');
 assert.deepEqual(fs.readdirSync('/sys/class/net').sort(),['lo']);
 return validateDropiListApproval(rootOwnedRegular('/var/lib/vitalismen-deploy/dropi-bff2958-lab-approval-v1.json'),{isolated:true});
}

function assertManualQaStrictProfile() {
    if (readMeasurementPolicyV213(fileURLToPath(import.meta.url)) || readGiraOperationalPolicy('/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs') || readOperationalPolicyV203(fileURLToPath(import.meta.url)) || readOperationalPolicyV2(fileURLToPath(import.meta.url))) return;
    assert.equal(process.env.VITALISMEN_STRICT_READ_ONLY, 'true', 'MANUAL_QA_STRICT_REQUIRED');
    assert.equal(process.env.SAFE_OBSERVATION_POLICY, 'STRICT_READ_ONLY', 'MANUAL_QA_OBSERVATION_REQUIRED');
    assert.equal(process.env.DISABLE_SCHEDULER, '1', 'MANUAL_QA_SCHEDULER_REQUIRED_OFF');
    for (const key of ["VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED", "VIT_POWER_FUNNEL_ACTIVE", "WHATSAPP_AUTO_REPLY_ENABLED", "WHATSAPP_FUNNEL_ENABLED", "ZAPI_ROUTE_INBOUND_TO_BOT", "ZAPI_PERSIST_INBOUND_ENABLED", "ZAPI_PERSIST_ACK_ENABLED", "SERVER_FUNNEL_ENABLED", "AI_WORKER_ENABLED", "SHIPMENT_STATUS_DISPATCH_ENABLED", "SHIPMENT_PICKUP_REMINDERS_ENABLED", "PICKUP_PROOF_SWEEP_ENABLED"]) assert.equal(process.env[key], 'false', 'MANUAL_QA_AUTOMATION_ENABLED:' + key);
}

// Schema validation is not approval issuance. Only an authorized root operator
// may provision this separate canonical record after explicit LIVE approval.
export function validateManualQaProductionApproval(bytes, { nowMs = Date.now() } = {}) {
    const approval = JSON.parse(bytes);
    assert.deepEqual(bytes, canonicalBytes(approval), 'MANUAL_QA_PROD_NONCANONICAL');
    sameKeys(approval, ['kind', 'project', 'scope', 'activationApproved', 'commit', 'tree', 'engineSHA256',
        'envelopeSHA256', 'files', 'recipient', 'connectedPhone', 'instanceSHA256', 'manualOnly',
        'globalStrictReadOnly', 'automationsAllowed', 'inboundAllowed', 'ackAllowed',
        'issuedAt', 'issuer', 'authorizationEvidence'], 'MANUAL_QA_PROD_FIELDS');
    assert.equal(approval.kind, 'HUMAN_APPROVED_MANUAL_QA_2958');
    assert.equal(approval.project, 'VITALISMEN_EC');
    assert.equal(approval.scope, 'PRODUCTION_QA_ONLY');
    assert.equal(approval.activationApproved, true, 'MANUAL_QA_PROD_NOT_APPROVED');
    assert.equal(approval.commit, MANUAL_QA.successor); assert.equal(approval.tree, MANUAL_QA.tree);
    assert.equal(approval.engineSHA256, '88b72102397e00294c2c20a9904289a405491db40487144a781af921f8b60f15', 'MANUAL_QA_PROD_ENGINE_INVALID');
    assert.equal(approval.envelopeSHA256, MANUAL_QA.seal, 'MANUAL_QA_PROD_ENVELOPE_INVALID');
    assert.deepEqual(approval.files, MANUAL_QA.hashes, 'MANUAL_QA_PROD_FILES_INVALID');
    assert.equal(approval.recipient, '5515998038637'); assert.equal(approval.connectedPhone, '553171862958');
    assert.equal(approval.instanceSHA256, '2fe72823323c747f55916c661e563a5a07320741121ddfa5b955db52fa49be07');
    assert.equal(approval.manualOnly, true); assert.equal(approval.globalStrictReadOnly, true);
    for (const key of ['automationsAllowed', 'inboundAllowed', 'ackAllowed']) assert.equal(approval[key], false);
    assert.equal(typeof approval.issuedAt, 'string');
    const issued = Date.parse(approval.issuedAt);
    assert.ok(Number.isFinite(issued) && issued <= nowMs + 120000, 'MANUAL_QA_PROD_TIME_INVALID');
    assert.equal(new Date(issued).toISOString(), approval.issuedAt);
    for (const key of ['issuer', 'authorizationEvidence']) {
        assert.equal(typeof approval[key], 'string');
        assert.ok(approval[key].trim().length >= 8 && !/^PENDING/.test(approval[key]), 'MANUAL_QA_PROD_EVIDENCE_REQUIRED');
    }
    return Object.freeze(approval);
}

function requireManualQaApproval() {
    assert.equal(process.platform, 'linux', 'MANUAL_QA_LINUX_ONLY');
    assert.equal(process.getuid(), 0, 'MANUAL_QA_ROOT_ONLY');
    const productionApproval = '/var/lib/vitalismen-deploy/manual-qa2958-production-approval-v1.json';
    if (fs.existsSync(productionApproval)) {
        const approval = validateManualQaProductionApproval(rootOwnedRegular(productionApproval));
        assertManualQaStrictProfile();
        return approval;
    }
    const approvalBytes = rootOwnedRegular('/var/lib/vitalismen-deploy/manual-qa2958-lab-approval-v1.json');
    assert.equal(sha256(approvalBytes), MANUAL_QA.approvalSeal, 'MANUAL_QA_APPROVAL_TAMPERED');
    const approval = JSON.parse(approvalBytes);
    assert.deepEqual(approvalBytes, canonicalBytes(approval), 'MANUAL_QA_APPROVAL_NONCANONICAL');
    assert.equal(approval.scope, 'ISOLATED_ONLY', 'MANUAL_QA_SCOPE_INVALID');
    assert.equal(approval.liveAuthorized, false, 'MANUAL_QA_LIVE_FORBIDDEN');
    assert.equal(approval.whatsappSendAuthorized, false, 'MANUAL_QA_REAL_SEND_FORBIDDEN');
    assert.equal(approval.commit, MANUAL_QA.successor, 'MANUAL_QA_APPROVAL_COMMIT_INVALID');
    assert.equal(approval.tree, MANUAL_QA.tree, 'MANUAL_QA_APPROVAL_TREE_INVALID');
    assert.deepEqual(approval.files, MANUAL_QA.hashes, 'MANUAL_QA_APPROVAL_FILES_INVALID');
    assert.equal(fs.readFileSync('/etc/hostname', 'utf8').trim(), approval.hostname, 'MANUAL_QA_HOST_INVALID');
    assert.deepEqual(fs.readdirSync('/sys/class/net').sort(), ['lo'], 'MANUAL_QA_NETWORK_NOT_ISOLATED');
    const receiptBytes = rootOwnedRegular('/var/lib/vitalismen-deploy/manual-qa2958-lab-provisioning-v1.json');
    const receipt = JSON.parse(receiptBytes);
    assert.deepEqual(receiptBytes, canonicalBytes(receipt), 'MANUAL_QA_RECEIPT_NONCANONICAL');
    sameKeys(receipt, ['kind', 'engineSHA256', 'envelopeSHA256', 'approvalSHA256', 'commit', 'tree'], 'MANUAL_QA_RECEIPT_FIELDS');
    assert.equal(receipt.kind, 'ISOLATED_QA2958_PROVISIONING');
    assert.equal(receipt.engineSHA256, '88b72102397e00294c2c20a9904289a405491db40487144a781af921f8b60f15', 'MANUAL_QA_ENGINE_TAMPERED');
    assert.equal(receipt.envelopeSHA256, MANUAL_QA.seal, 'MANUAL_QA_RECEIPT_ENVELOPE_INVALID');
    assert.equal(receipt.approvalSHA256, MANUAL_QA.approvalSeal, 'MANUAL_QA_RECEIPT_APPROVAL_INVALID');
    assert.equal(receipt.commit, MANUAL_QA.successor); assert.equal(receipt.tree, MANUAL_QA.tree);
    assertManualQaStrictProfile();
    return approval;
}



const BASE_RELEASE = '/opt/vitalismen-automacao/releases/20260927T045400Z_production-20260927-87cc584';
const GENERATED = new Set(['.git', 'node_modules', '.env', '.env.v66-safe-observation',
    '.env.v77-canary-qa', '.canary-v77-profile-attestation.json', '.release-source.json',
    '.staging-complete.json', '.release-publication.json', '.publication-complete.json',
    '.activation-complete.json']);

// Preserve the historical graph plus the single pinned 227e5f8 -> 39701bd edge.
export function verifyEnvelopeBytes(bytes, trustedSeal, historical, parentEnvelope = null) {
    assert.equal(sha256(bytes), trustedSeal, 'SEALED_ENVELOPE_TAMPERED');
    const e = JSON.parse(bytes.toString('utf8'));
    assert.deepEqual(bytes, canonicalBytes(e), 'SEALED_ENVELOPE_NONCANONICAL');
    sameKeys(e, ['authority', 'PURPOSE', 'PREDECESSOR_RELEASE', 'PAYLOAD_HASHES'],
        'SEALED_ENVELOPE_FIELDS_INVALID');
    assert.ok(['GOVERNANCE_BOOTSTRAP', 'VIT_SIGNATURE_PATCH', QA_ORDER.purpose, HOME_ORDER.purpose, MANUAL_QA.purpose, MANUAL_COMMERCIAL.purpose, DROPI_LIST.purpose, OPERATIONS_V203.purpose, GIRA_BRIDGE.purpose, GIRA_HANDOFF.purpose, EC_REPURCHASE.purpose, EC_AUDIO.purpose, EC_PREPAID.purpose, EC_TRACKING.purpose, EC_FREEFLOW.purpose, EC_MEASUREMENT.purpose, EC_OWNER.purpose, EC_B01.purpose, EC_PRIORITY.purpose, EC_WEB.purpose, EC_RECALL.purpose, EC_CONTEXT.purpose, EC_DASHBOARD.purpose, EC_STORE.purpose, EC_INBOUND.purpose, EC_BURST.purpose, EC_FIX.purpose, EC_SALE.purpose, EC_VOICE.purpose, EC_INVITES.purpose, EC_CHAT.purpose, EC_JOURNEY.purpose, EC_ACCESS.purpose, EC_PRICE.purpose, EC_TEX.purpose, EC_QA.purpose, EC_LINKED.purpose, EC_PERIOD.purpose, EC_MEASURE.purpose, EC_QA_CYCLE.purpose, EC_TEX_ENTRY.purpose, EC_NAMED.purpose, EC_TEX_START.purpose, EC_TEX_INVITE.purpose, EC_ORDERS.purpose, EC_CUSTOMER.purpose, EC_INTEGRATION.purpose].includes(e.PURPOSE),
        'SEALED_PURPOSE_INVALID');
    let predecessor = { commit: PREDECESSOR_COMMIT, tree: PREDECESSOR_TREE };
    if (e.PURPOSE === 'GOVERNANCE_BOOTSTRAP') {
        assert.equal(parentEnvelope, null, 'SEALED_GOVERNANCE_PARENT_INVALID');
        assert.equal(e.PREDECESSOR_RELEASE, path.basename(BASE_RELEASE));
        assert.deepEqual(e.authority.ALLOWED_DELTA, [...GOVERNANCE_PATHS], 'SEALED_GOVERNANCE_DELTA_INVALID');
     } else if(e.PURPOSE===EC_INTEGRATION.purpose){
        assert.equal(trustedSeal,EC_INTEGRATION.seal,'DROPI_META_V254_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_CUSTOMER.purpose,'DROPI_META_V254_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_INTEGRATION.parentSeal,'DROPI_META_V254_PARENT_SEAL');predecessor={commit:EC_CUSTOMER.successor,tree:EC_CUSTOMER.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_CUSTOMER.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_INTEGRATION.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_INTEGRATION.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_INTEGRATION.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_INTEGRATION.hashes);
     } else if(e.PURPOSE===EC_CUSTOMER.purpose){
        assert.equal(trustedSeal,EC_CUSTOMER.seal,'CUSTOMER_EDIT_PAQUIZHA_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_ORDERS.purpose,'CUSTOMER_EDIT_PAQUIZHA_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_CUSTOMER.parentSeal,'CUSTOMER_EDIT_PAQUIZHA_PARENT_SEAL');predecessor={commit:EC_ORDERS.successor,tree:EC_ORDERS.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_ORDERS.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_CUSTOMER.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_CUSTOMER.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_CUSTOMER.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_CUSTOMER.hashes);
     } else if(e.PURPOSE===EC_ORDERS.purpose){
        assert.equal(trustedSeal,EC_ORDERS.seal,'ORDERS_DROPI_POSTSALE_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_TEX_INVITE.purpose,'ORDERS_DROPI_POSTSALE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_ORDERS.parentSeal,'ORDERS_DROPI_POSTSALE_PARENT_SEAL');predecessor={commit:EC_TEX_INVITE.successor,tree:EC_TEX_INVITE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_TEX_INVITE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_ORDERS.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_ORDERS.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_ORDERS.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_ORDERS.hashes);
     } else if(e.PURPOSE===EC_TEX_INVITE.purpose){
        assert.equal(trustedSeal,EC_TEX_INVITE.seal,'TEX_POSTLEAD_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_TEX_START.purpose,'TEX_POSTLEAD_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_TEX_INVITE.parentSeal,'TEX_POSTLEAD_PARENT_SEAL');predecessor={commit:EC_TEX_START.successor,tree:EC_TEX_START.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_TEX_START.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_TEX_INVITE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_TEX_INVITE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_TEX_INVITE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_TEX_INVITE.hashes);
     } else if(e.PURPOSE===EC_TEX_START.purpose){
        assert.equal(trustedSeal,EC_TEX_START.seal,'TEX_GREETING_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_NAMED.purpose,'TEX_GREETING_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_TEX_START.parentSeal,'TEX_GREETING_PARENT_SEAL');predecessor={commit:EC_NAMED.successor,tree:EC_NAMED.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_NAMED.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_TEX_START.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_TEX_START.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_TEX_START.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_TEX_START.hashes);
     } else if(e.PURPOSE===EC_NAMED.purpose){
        assert.equal(trustedSeal,EC_NAMED.seal,'B01_NAMED_ENTRY_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_TEX_ENTRY.purpose,'B01_NAMED_ENTRY_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_NAMED.parentSeal,'B01_NAMED_ENTRY_PARENT_SEAL');predecessor={commit:EC_TEX_ENTRY.successor,tree:EC_TEX_ENTRY.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_TEX_ENTRY.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_NAMED.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_NAMED.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_NAMED.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_NAMED.hashes);
     } else if(e.PURPOSE===EC_TEX_ENTRY.purpose){
        assert.equal(trustedSeal,EC_TEX_ENTRY.seal,'TEX_ENTRY_INVITES_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_QA_CYCLE.purpose,'TEX_ENTRY_INVITES_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_TEX_ENTRY.parentSeal,'TEX_ENTRY_INVITES_PARENT_SEAL');predecessor={commit:EC_QA_CYCLE.successor,tree:EC_QA_CYCLE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_QA_CYCLE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_TEX_ENTRY.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_TEX_ENTRY.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_TEX_ENTRY.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_TEX_ENTRY.hashes);
     } else if(e.PURPOSE===EC_QA_CYCLE.purpose){
        assert.equal(trustedSeal,EC_QA_CYCLE.seal,'QA_B01_CYCLE_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_MEASURE.purpose,'QA_B01_CYCLE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_QA_CYCLE.parentSeal,'QA_B01_CYCLE_PARENT_SEAL');predecessor={commit:EC_MEASURE.successor,tree:EC_MEASURE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_MEASURE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_QA_CYCLE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_QA_CYCLE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_QA_CYCLE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_QA_CYCLE.hashes);
     } else if(e.PURPOSE===EC_MEASURE.purpose){
        assert.equal(trustedSeal,EC_MEASURE.seal,'TEX_MEASUREMENT_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_PERIOD.purpose,'TEX_MEASUREMENT_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_MEASURE.parentSeal,'TEX_MEASUREMENT_PARENT_SEAL');predecessor={commit:EC_PERIOD.successor,tree:EC_PERIOD.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_PERIOD.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_MEASURE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_MEASURE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_MEASURE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_MEASURE.hashes);
     } else if(e.PURPOSE===EC_PERIOD.purpose){
        assert.equal(trustedSeal,EC_PERIOD.seal,'QA_NATURAL_ENTRY_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_LINKED.purpose,'QA_NATURAL_ENTRY_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_PERIOD.parentSeal,'QA_NATURAL_ENTRY_PARENT_SEAL');predecessor={commit:EC_LINKED.successor,tree:EC_LINKED.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_LINKED.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_PERIOD.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_PERIOD.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_PERIOD.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_PERIOD.hashes);
     } else if(e.PURPOSE===EC_LINKED.purpose){
        assert.equal(trustedSeal,EC_LINKED.seal,'TEX_LINKED_ENTRY_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_QA.purpose,'TEX_LINKED_ENTRY_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_LINKED.parentSeal,'TEX_LINKED_ENTRY_PARENT_SEAL');predecessor={commit:EC_QA.successor,tree:EC_QA.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_QA.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_LINKED.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_LINKED.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_LINKED.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_LINKED.hashes);
     } else if(e.PURPOSE===EC_QA.purpose){
        assert.equal(trustedSeal,EC_QA.seal,'QA_NATURAL_ENTRY_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_TEX.purpose,'QA_NATURAL_ENTRY_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_QA.parentSeal,'QA_NATURAL_ENTRY_PARENT_SEAL');predecessor={commit:EC_TEX.successor,tree:EC_TEX.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_TEX.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_QA.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_QA.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_QA.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_QA.hashes);
     } else if(e.PURPOSE===EC_TEX.purpose){
        assert.equal(trustedSeal,EC_TEX.seal,'TEX_WEB_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_PRICE.purpose,'TEX_WEB_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_TEX.parentSeal,'TEX_WEB_PARENT_SEAL');predecessor={commit:EC_PRICE.successor,tree:EC_PRICE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_PRICE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_TEX.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_TEX.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_TEX.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_TEX.hashes);
     } else if(e.PURPOSE===EC_PRICE.purpose){
        assert.equal(trustedSeal,EC_PRICE.seal,'PRICE_CLOSURE_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_ACCESS.purpose,'PRICE_CLOSURE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_PRICE.parentSeal,'PRICE_CLOSURE_PARENT_SEAL');predecessor={commit:EC_ACCESS.successor,tree:EC_ACCESS.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_ACCESS.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_PRICE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_PRICE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_PRICE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_PRICE.hashes);
     } else if(e.PURPOSE===EC_ACCESS.purpose){
        assert.equal(trustedSeal,EC_ACCESS.seal,'ORDER_ACCESS_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_JOURNEY.purpose,'ORDER_ACCESS_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_ACCESS.parentSeal,'ORDER_ACCESS_PARENT_SEAL');predecessor={commit:EC_JOURNEY.successor,tree:EC_JOURNEY.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_JOURNEY.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_ACCESS.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_ACCESS.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_ACCESS.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_ACCESS.hashes);
     } else if(e.PURPOSE===EC_JOURNEY.purpose){
        assert.equal(trustedSeal,EC_JOURNEY.seal,'JOURNEY_MEASUREMENT_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_CHAT.purpose,'JOURNEY_MEASUREMENT_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_JOURNEY.parentSeal,'JOURNEY_MEASUREMENT_PARENT_SEAL');predecessor={commit:EC_CHAT.successor,tree:EC_CHAT.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_CHAT.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_JOURNEY.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_JOURNEY.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_JOURNEY.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_JOURNEY.hashes);
     } else if(e.PURPOSE===EC_CHAT.purpose){
        assert.equal(trustedSeal,EC_CHAT.seal,'CHAT_ACCESS_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_INVITES.purpose,'CHAT_ACCESS_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_CHAT.parentSeal,'CHAT_ACCESS_PARENT_SEAL');predecessor={commit:EC_INVITES.successor,tree:EC_INVITES.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_INVITES.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_CHAT.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_CHAT.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_CHAT.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_CHAT.hashes);
     } else if(e.PURPOSE===EC_INVITES.purpose){
        assert.equal(trustedSeal,EC_INVITES.seal,'INVITES_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_VOICE.purpose,'INVITES_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_INVITES.parentSeal,'INVITES_PARENT_SEAL');predecessor={commit:EC_VOICE.successor,tree:EC_VOICE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_VOICE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_INVITES.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_INVITES.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_INVITES.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_INVITES.hashes);
     } else if(e.PURPOSE===EC_VOICE.purpose){
        assert.equal(trustedSeal,EC_VOICE.seal,'VOICE_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_SALE.purpose,'VOICE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_VOICE.parentSeal,'VOICE_PARENT_SEAL');predecessor={commit:EC_SALE.successor,tree:EC_SALE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_SALE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_VOICE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_VOICE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_VOICE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_VOICE.hashes);
     } else if(e.PURPOSE===EC_SALE.purpose){
        assert.equal(trustedSeal,EC_SALE.seal,'SALE_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_FIX.purpose,'SALE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_SALE.parentSeal,'SALE_PARENT_SEAL');predecessor={commit:EC_FIX.successor,tree:EC_FIX.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_FIX.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_SALE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_SALE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_SALE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_SALE.hashes);
     } else if(e.PURPOSE===EC_FIX.purpose){
        assert.equal(trustedSeal,EC_FIX.seal,'FIX_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_BURST.purpose,'FIX_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_FIX.parentSeal,'FIX_PARENT_SEAL');predecessor={commit:EC_BURST.successor,tree:EC_BURST.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_BURST.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_FIX.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_FIX.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_FIX.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_FIX.hashes);
     } else if(e.PURPOSE===EC_BURST.purpose){
        assert.equal(trustedSeal,EC_BURST.seal,'BURST_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_INBOUND.purpose,'BURST_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_BURST.parentSeal,'BURST_PARENT_SEAL');predecessor={commit:EC_INBOUND.successor,tree:EC_INBOUND.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_INBOUND.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_BURST.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_BURST.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_BURST.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_BURST.hashes);
     } else if(e.PURPOSE===EC_INBOUND.purpose){
        assert.equal(trustedSeal,EC_INBOUND.seal,'INBOUND_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_STORE.purpose,'INBOUND_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_INBOUND.parentSeal,'INBOUND_PARENT_SEAL');predecessor={commit:EC_STORE.successor,tree:EC_STORE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_STORE.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_INBOUND.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_INBOUND.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_INBOUND.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_INBOUND.hashes);
     } else if(e.PURPOSE===EC_STORE.purpose){
        assert.equal(trustedSeal,EC_STORE.seal,'STORE_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_DASHBOARD.purpose,'STORE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_STORE.parentSeal,'STORE_PARENT_SEAL');predecessor={commit:EC_DASHBOARD.successor,tree:EC_DASHBOARD.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_DASHBOARD.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_STORE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_STORE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_STORE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_STORE.hashes);
     } else if(e.PURPOSE===EC_DASHBOARD.purpose){
        assert.equal(trustedSeal,EC_DASHBOARD.seal,'DASHBOARD_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_CONTEXT.purpose,'DASHBOARD_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_DASHBOARD.parentSeal,'DASHBOARD_PARENT_SEAL');predecessor={commit:EC_CONTEXT.successor,tree:EC_CONTEXT.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_CONTEXT.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_DASHBOARD.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_DASHBOARD.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_DASHBOARD.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_DASHBOARD.hashes);
     } else if(e.PURPOSE===EC_CONTEXT.purpose){
        assert.equal(trustedSeal,EC_CONTEXT.seal,'RECALL_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_RECALL.purpose,'RECALL_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_CONTEXT.parentSeal,'RECALL_PARENT_SEAL');predecessor={commit:EC_RECALL.successor,tree:EC_RECALL.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_RECALL.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_CONTEXT.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_CONTEXT.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_CONTEXT.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_CONTEXT.hashes);
     } else if(e.PURPOSE===EC_RECALL.purpose){
        assert.equal(trustedSeal,EC_RECALL.seal,'RECALL_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_WEB.purpose,'RECALL_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_RECALL.parentSeal,'RECALL_PARENT_SEAL');predecessor={commit:EC_WEB.successor,tree:EC_WEB.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_WEB.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_RECALL.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_RECALL.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_RECALL.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_RECALL.hashes);
     } else if(e.PURPOSE===EC_WEB.purpose){
        assert.equal(trustedSeal,EC_WEB.seal,'WEB_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_PRIORITY.purpose,'WEB_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_WEB.parentSeal,'WEB_PARENT_SEAL');predecessor={commit:EC_PRIORITY.successor,tree:EC_PRIORITY.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_PRIORITY.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_WEB.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_WEB.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_WEB.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_WEB.hashes);
     } else if(e.PURPOSE===EC_PRIORITY.purpose){
        assert.equal(trustedSeal,EC_PRIORITY.seal,'PRIORITY_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_B01.purpose,'PRIORITY_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_PRIORITY.parentSeal,'PRIORITY_PARENT_SEAL');predecessor={commit:EC_B01.successor,tree:EC_B01.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_B01.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_PRIORITY.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_PRIORITY.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_PRIORITY.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_PRIORITY.hashes);
     } else if(e.PURPOSE===EC_B01.purpose){
        assert.equal(trustedSeal,EC_B01.seal,'B01_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_OWNER.purpose,'B01_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_B01.parentSeal,'B01_PARENT_SEAL');predecessor={commit:EC_OWNER.successor,tree:EC_OWNER.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_OWNER.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_B01.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_B01.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_B01.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_B01.hashes);
     } else if(e.PURPOSE===EC_OWNER.purpose){
        assert.equal(trustedSeal,EC_OWNER.seal,'OWNER_SEAL');assert.equal(parentEnvelope?.PURPOSE,EC_MEASUREMENT.purpose,'OWNER_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_OWNER.parentSeal,'OWNER_PARENT_SEAL');predecessor={commit:EC_MEASUREMENT.successor,tree:EC_MEASUREMENT.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_MEASUREMENT.release));assert.equal(e.authority.SUCCESSOR_COMMIT,EC_OWNER.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_OWNER.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_OWNER.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_OWNER.hashes);
     } else if(e.PURPOSE===EC_MEASUREMENT.purpose){
        assert.equal(trustedSeal,EC_MEASUREMENT.seal,'MEASUREMENT_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,EC_FREEFLOW.purpose,'MEASUREMENT_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_MEASUREMENT.parentSeal,'MEASUREMENT_PARENT_SEAL');
        predecessor={commit:EC_FREEFLOW.successor,tree:EC_FREEFLOW.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_FREEFLOW.release),'MEASUREMENT_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,EC_MEASUREMENT.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_MEASUREMENT.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_MEASUREMENT.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_MEASUREMENT.hashes);
     } else if(e.PURPOSE===EC_FREEFLOW.purpose){
        assert.equal(trustedSeal,EC_FREEFLOW.seal,'FREEFLOW_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,EC_TRACKING.purpose,'FREEFLOW_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_FREEFLOW.parentSeal,'FREEFLOW_PARENT_SEAL');
        predecessor={commit:EC_TRACKING.successor,tree:EC_TRACKING.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_TRACKING.release),'FREEFLOW_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,EC_FREEFLOW.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_FREEFLOW.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_FREEFLOW.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_FREEFLOW.hashes);
     } else if(e.PURPOSE===EC_TRACKING.purpose){
        assert.equal(trustedSeal,EC_TRACKING.seal,'TRACKING_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,EC_PREPAID.purpose,'TRACKING_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_TRACKING.parentSeal,'TRACKING_PARENT_SEAL');
        predecessor={commit:EC_PREPAID.successor,tree:EC_PREPAID.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_PREPAID.release),'TRACKING_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,EC_TRACKING.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_TRACKING.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_TRACKING.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_TRACKING.hashes);
     } else if(e.PURPOSE===EC_PREPAID.purpose){
        assert.equal(trustedSeal,EC_PREPAID.seal,'PREPAID_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,EC_AUDIO.purpose,'PREPAID_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_PREPAID.parentSeal,'PREPAID_PARENT_SEAL');
        predecessor={commit:EC_AUDIO.successor,tree:EC_AUDIO.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_AUDIO.release),'PREPAID_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,EC_PREPAID.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_PREPAID.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_PREPAID.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_PREPAID.hashes);
     } else if(e.PURPOSE===EC_AUDIO.purpose){
        assert.equal(trustedSeal,EC_AUDIO.seal,'AUDIO_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,EC_REPURCHASE.purpose,'AUDIO_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_AUDIO.parentSeal,'AUDIO_PARENT_SEAL');
        predecessor={commit:EC_REPURCHASE.successor,tree:EC_REPURCHASE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(EC_REPURCHASE.release),'AUDIO_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,EC_AUDIO.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_AUDIO.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_AUDIO.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_AUDIO.hashes);
     } else if(e.PURPOSE===EC_REPURCHASE.purpose){
        assert.equal(trustedSeal,EC_REPURCHASE.seal,'REPURCHASE_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,GIRA_HANDOFF.purpose,'REPURCHASE_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),EC_REPURCHASE.parentSeal,'REPURCHASE_PARENT_SEAL');
        predecessor={commit:GIRA_HANDOFF.successor,tree:GIRA_HANDOFF.tree};
        assert.equal(e.PREDECESSOR_RELEASE,path.basename(GIRA_HANDOFF.release),'REPURCHASE_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,EC_REPURCHASE.successor);assert.equal(e.authority.SUCCESSOR_TREE,EC_REPURCHASE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(EC_REPURCHASE.hashes).sort());assert.deepEqual(e.authority.FILE_HASHES,EC_REPURCHASE.hashes);
     } else if(e.PURPOSE===GIRA_HANDOFF.purpose){
        assert.equal(trustedSeal,GIRA_HANDOFF.seal,'HANDOFF_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,GIRA_BRIDGE.purpose,'HANDOFF_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),GIRA_HANDOFF.parentSeal,'HANDOFF_PARENT_SEAL');
        predecessor={commit:GIRA_BRIDGE.successor,tree:GIRA_BRIDGE.tree};
        assert.equal(e.PREDECESSOR_RELEASE,GIRA_BRIDGE.release,'HANDOFF_PARENT_RELEASE');
        assert.equal(e.authority.SUCCESSOR_COMMIT,GIRA_HANDOFF.successor);assert.equal(e.authority.SUCCESSOR_TREE,GIRA_HANDOFF.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(GIRA_HANDOFF.hashes));assert.deepEqual(e.authority.FILE_HASHES,GIRA_HANDOFF.hashes);
     } else if(e.PURPOSE===GIRA_BRIDGE.purpose){
        assert.equal(trustedSeal,GIRA_BRIDGE.seal,'GIRA_SEAL');assert.equal(parentEnvelope?.PURPOSE,OPERATIONS_V203.purpose,'GIRA_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),GIRA_BRIDGE.parentSeal,'GIRA_PARENT_SEAL');
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT,OPERATIONS_V203.successor);assert.equal(parentEnvelope.authority.SUCCESSOR_TREE,OPERATIONS_V203.tree);
        predecessor={commit:OPERATIONS_V203.successor,tree:OPERATIONS_V203.tree};assert.equal(e.PREDECESSOR_RELEASE,OPERATIONS_V203.release);
        assert.equal(e.authority.SUCCESSOR_COMMIT,GIRA_BRIDGE.successor);assert.equal(e.authority.SUCCESSOR_TREE,GIRA_BRIDGE.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(GIRA_BRIDGE.hashes));assert.deepEqual(e.authority.FILE_HASHES,GIRA_BRIDGE.hashes);
     } else if (e.PURPOSE === OPERATIONS_V203.purpose) {
        assert.equal(trustedSeal,OPERATIONS_V203.seal,'OP203_SEAL');
        assert.equal(parentEnvelope?.PURPOSE,DROPI_LIST.purpose,'OP203_PARENT_PURPOSE');
        assert.equal(sha256(canonicalBytes(parentEnvelope)),OPERATIONS_V203.parentSeal,'OP203_PARENT_SEAL');
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT,DROPI_LIST.successor);
        assert.equal(parentEnvelope.authority.SUCCESSOR_TREE,DROPI_LIST.tree);
        predecessor={commit:DROPI_LIST.successor,tree:DROPI_LIST.tree};
        assert.equal(e.PREDECESSOR_RELEASE,OPERATIONS_V203.predecessorRelease);
        assert.equal(e.authority.SUCCESSOR_COMMIT,OPERATIONS_V203.successor);
        assert.equal(e.authority.SUCCESSOR_TREE,OPERATIONS_V203.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(OPERATIONS_V203.hashes));
        assert.deepEqual(e.authority.FILE_HASHES,OPERATIONS_V203.hashes);
    } else if (e.PURPOSE === DROPI_LIST.purpose) {
        assert.equal(trustedSeal,DROPI_LIST.seal);assert.equal(parentEnvelope?.PURPOSE,MANUAL_COMMERCIAL.purpose);
        assert.equal(sha256(canonicalBytes(parentEnvelope)),DROPI_LIST.parentSeal);
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT,MANUAL_COMMERCIAL.successor);
        assert.equal(parentEnvelope.authority.SUCCESSOR_TREE,MANUAL_COMMERCIAL.tree);
        predecessor={commit:MANUAL_COMMERCIAL.successor,tree:MANUAL_COMMERCIAL.tree};
        assert.equal(e.PREDECESSOR_RELEASE,DROPI_LIST.predecessorRelease);
        assert.equal(e.authority.SUCCESSOR_COMMIT,DROPI_LIST.successor);assert.equal(e.authority.SUCCESSOR_TREE,DROPI_LIST.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA,Object.keys(DROPI_LIST.hashes));assert.deepEqual(e.authority.FILE_HASHES,DROPI_LIST.hashes);
    } else if (e.PURPOSE === MANUAL_COMMERCIAL.purpose) {
        assert.equal(trustedSeal, MANUAL_COMMERCIAL.seal);
        assert.equal(parentEnvelope?.PURPOSE, MANUAL_QA.purpose);
        assert.equal(sha256(canonicalBytes(parentEnvelope)), MANUAL_COMMERCIAL.parentSeal);
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT, MANUAL_QA.successor);
        assert.equal(parentEnvelope.authority.SUCCESSOR_TREE, MANUAL_QA.tree);
        predecessor = { commit: MANUAL_QA.successor, tree: MANUAL_QA.tree };
        assert.equal(e.PREDECESSOR_RELEASE, MANUAL_COMMERCIAL.predecessorRelease);
        assert.equal(e.authority.SUCCESSOR_COMMIT, MANUAL_COMMERCIAL.successor);
        assert.equal(e.authority.SUCCESSOR_TREE, MANUAL_COMMERCIAL.tree);
        assert.deepEqual(e.authority.ALLOWED_DELTA, Object.keys(MANUAL_COMMERCIAL.hashes));
        assert.deepEqual(e.authority.FILE_HASHES, MANUAL_COMMERCIAL.hashes);
    } else if (e.PURPOSE === MANUAL_QA.purpose) {
        assert.equal(trustedSeal, MANUAL_QA.seal, 'MANUAL_QA_SEAL_INVALID');
        assert.equal(parentEnvelope?.PURPOSE, HOME_ORDER.purpose, 'MANUAL_QA_PARENT_INVALID');
        assert.equal(sha256(canonicalBytes(parentEnvelope)), MANUAL_QA.parentSeal, 'MANUAL_QA_PARENT_SEAL_INVALID');
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT, HOME_ORDER.successor, 'MANUAL_QA_PARENT_COMMIT_INVALID');
        assert.equal(parentEnvelope.authority.SUCCESSOR_TREE, HOME_ORDER.tree, 'MANUAL_QA_PARENT_TREE_INVALID');
        predecessor = { commit: HOME_ORDER.successor, tree: HOME_ORDER.tree };
        assert.equal(e.PREDECESSOR_RELEASE, MANUAL_QA.predecessorRelease, 'MANUAL_QA_PARENT_RELEASE_INVALID');
        assert.equal(e.authority.SUCCESSOR_COMMIT, MANUAL_QA.successor, 'MANUAL_QA_SUCCESSOR_INVALID');
        assert.equal(e.authority.SUCCESSOR_TREE, MANUAL_QA.tree, 'MANUAL_QA_TREE_INVALID');
        assert.deepEqual(e.authority.ALLOWED_DELTA, Object.keys(MANUAL_QA.hashes), 'MANUAL_QA_DELTA_INVALID');
        assert.deepEqual(e.authority.FILE_HASHES, MANUAL_QA.hashes, 'MANUAL_QA_HASHES_INVALID');
    } else if (e.PURPOSE === HOME_ORDER.purpose) {
        assert.equal(trustedSeal, HOME_ORDER.seal, 'SEALED_HOME_SEAL_INVALID');
        assert.equal(parentEnvelope?.PURPOSE, QA_ORDER.purpose, 'SEALED_HOME_PARENT_INVALID');
        assert.equal(sha256(canonicalBytes(parentEnvelope)), QA_ORDER.seal, 'SEALED_HOME_PARENT_SEAL_INVALID');
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT, QA_ORDER.successor, 'SEALED_HOME_PARENT_INVALID');
        assert.equal(parentEnvelope.authority.SUCCESSOR_TREE, QA_ORDER.tree, 'SEALED_HOME_PARENT_TREE_INVALID');
        predecessor = { commit: QA_ORDER.successor, tree: QA_ORDER.tree };
        assert.equal(e.PREDECESSOR_RELEASE, HOME_ORDER.predecessorRelease, 'SEALED_HOME_PARENT_RELEASE_INVALID');
        assert.equal(e.authority.SUCCESSOR_COMMIT, HOME_ORDER.successor, 'SEALED_HOME_SUCCESSOR_INVALID');
        assert.equal(e.authority.SUCCESSOR_TREE, HOME_ORDER.tree, 'SEALED_HOME_TREE_INVALID');
        assert.deepEqual(e.authority.ALLOWED_DELTA, Object.keys(HOME_ORDER.hashes), 'SEALED_HOME_DELTA_INVALID');
        assert.deepEqual(e.authority.FILE_HASHES, HOME_ORDER.hashes, 'SEALED_HOME_HASH_INVALID');
    } else if (e.PURPOSE === QA_ORDER.purpose) {
        assert.equal(trustedSeal, QA_ORDER.seal, 'SEALED_QA_ORDER_SEAL_INVALID');
        assert.equal(parentEnvelope?.PURPOSE, 'VIT_SIGNATURE_PATCH', 'SEALED_QA_ORDER_PARENT_INVALID');
        assert.equal(sha256(canonicalBytes(parentEnvelope)), QA_ORDER.parentSeal, 'SEALED_QA_ORDER_PARENT_SEAL_INVALID');
        assert.equal(parentEnvelope.authority.SUCCESSOR_COMMIT, QA_ORDER.predecessor, 'SEALED_QA_ORDER_PARENT_INVALID');
        assert.equal(parentEnvelope.authority.SUCCESSOR_TREE, QA_ORDER.predecessorTree, 'SEALED_QA_ORDER_PARENT_INVALID');
        predecessor = { commit: QA_ORDER.predecessor, tree: QA_ORDER.predecessorTree };
        assert.equal(e.PREDECESSOR_RELEASE, QA_ORDER.predecessorRelease, 'SEALED_QA_ORDER_PARENT_RELEASE_INVALID');
        assert.equal(e.authority.SUCCESSOR_COMMIT, QA_ORDER.successor, 'SEALED_QA_ORDER_SUCCESSOR_INVALID');
        assert.equal(e.authority.SUCCESSOR_TREE, QA_ORDER.tree, 'SEALED_QA_ORDER_TREE_INVALID');
        assert.deepEqual(e.authority.ALLOWED_DELTA, Object.keys(QA_ORDER.hashes).sort(), 'SEALED_QA_ORDER_DELTA_INVALID');
        assert.deepEqual(e.authority.FILE_HASHES, QA_ORDER.hashes, 'SEALED_QA_ORDER_HASH_INVALID');
    } else {
        assert.equal(parentEnvelope?.PURPOSE, 'GOVERNANCE_BOOTSTRAP', 'SEALED_VIT_PARENT_INVALID');
        predecessor = { commit: parentEnvelope.authority.SUCCESSOR_COMMIT,
            tree: parentEnvelope.authority.SUCCESSOR_TREE };
        assert.ok(e.PREDECESSOR_RELEASE.endsWith(predecessor.commit.slice(0, 7)),
            'SEALED_VIT_PARENT_RELEASE_INVALID');
        assert.deepEqual(e.authority.ALLOWED_DELTA, Object.keys(VIT_HASHES).sort(), 'SEALED_VIT_DELTA_INVALID');
        assert.deepEqual(e.authority.FILE_HASHES, VIT_HASHES, 'SEALED_VIT_HASHES_INVALID');
    }
    const a = verifyAuthorityBytes(canonicalBytes(e.authority), sha256(canonicalBytes(e.authority)),
        historical, predecessor);
    assert.ok(e.PAYLOAD_HASHES && Object.keys(e.PAYLOAD_HASHES).length > 0, 'SEALED_PAYLOAD_EMPTY');
    for (const [relative, digest] of Object.entries(e.PAYLOAD_HASHES)) {
        assert.match(relative, SAFE_PATH);
        assert.match(digest, SHA256);
        assert.ok(!GENERATED.has(relative.split('/')[0]), 'SEALED_GENERATED_IN_PAYLOAD');
    }
    for (const relative of a.ALLOWED_DELTA) assert.equal(e.PAYLOAD_HASHES[relative], a.FILE_HASHES[relative],
        'SEALED_PAYLOAD_DELTA_HASH_INVALID');
    if (parentEnvelope) {
        const changed = [...new Set([...Object.keys(parentEnvelope.PAYLOAD_HASHES),
            ...Object.keys(e.PAYLOAD_HASHES)])].filter(p => parentEnvelope.PAYLOAD_HASHES[p] !== e.PAYLOAD_HASHES[p]).sort();
        assert.deepEqual(changed, a.ALLOWED_DELTA, 'SEALED_PAYLOAD_EXTRA_DELTA');
    }
    return Object.freeze(e);
}

function registryEnvelope(commit, depth = 0) {
    assert.ok(depth <= 1, 'SEALED_SUCCESSOR_REUSE_FORBIDDEN');
    assert.match(commit, SHA1);
    for (const directory of ['/var', '/var/lib', '/var/lib/vitalismen-deploy', REGISTRY_ROOT]) {
        const s = fs.lstatSync(directory);
        assert.ok(s.isDirectory() && !s.isSymbolicLink() && s.uid === 0 && s.gid === 0
            && (s.mode & 0o022) === 0, 'SEALED_REGISTRY_UNSAFE');
    }
    const file = path.join(REGISTRY_ROOT, `${commit}.json`);
    const bytes = rootOwnedRegular(file);
    const seal = rootOwnedRegular(`${file}.sha256`).toString('utf8');
    assert.match(seal, /^[a-f0-9]{64}\n$/);
    assert.equal(sha256(bytes), seal.trim(), 'SEALED_ENVELOPE_TAMPERED');
    const raw = JSON.parse(bytes.toString('utf8'));
    assert.equal(raw.authority?.SUCCESSOR_COMMIT, commit, 'SEALED_REGISTRY_KEY_MISMATCH');
    // The new edge can only load its existing, independently verified parent graph.
    // It does not increase the generic recursion limit or accept another successor.
    if (commit === QA_ORDER.successor || raw.PURPOSE === QA_ORDER.purpose) {
        assert.equal(depth, 0, 'SEALED_SUCCESSOR_REUSE_FORBIDDEN');
        assert.equal(commit, QA_ORDER.successor, 'SEALED_QA_ORDER_SUCCESSOR_INVALID');
        assert.equal(raw.PURPOSE, QA_ORDER.purpose, 'SEALED_QA_ORDER_PURPOSE_INVALID');
        assert.equal(raw.authority.PREDECESSOR_COMMIT, QA_ORDER.predecessor, 'SEALED_QA_ORDER_PARENT_INVALID');
    }
    if (commit === HOME_ORDER.successor || raw.PURPOSE === HOME_ORDER.purpose) {
        assert.equal(depth, 0, 'SEALED_HOME_REUSE_FORBIDDEN');
        assert.equal(commit, HOME_ORDER.successor, 'SEALED_HOME_SUCCESSOR_INVALID');
        assert.equal(raw.PURPOSE, HOME_ORDER.purpose, 'SEALED_HOME_PURPOSE_INVALID');
        assert.equal(raw.authority.PREDECESSOR_COMMIT, QA_ORDER.successor, 'SEALED_HOME_PARENT_INVALID');
    }
    if (commit === MANUAL_QA.successor || raw.PURPOSE === MANUAL_QA.purpose) {
        assert.equal(depth, 0, 'MANUAL_QA_REUSE_FORBIDDEN');
        assert.equal(commit, MANUAL_QA.successor, 'MANUAL_QA_REGISTRY_COMMIT_INVALID');
        assert.equal(raw.PURPOSE, MANUAL_QA.purpose, 'MANUAL_QA_REGISTRY_PURPOSE_INVALID');
        assert.equal(raw.authority.PREDECESSOR_COMMIT, HOME_ORDER.successor, 'MANUAL_QA_REGISTRY_PARENT_INVALID');
        requireManualQaApproval();
    }
    if (commit === MANUAL_COMMERCIAL.successor || raw.PURPOSE === MANUAL_COMMERCIAL.purpose) {
        assert.equal(depth, 0, 'MANUAL_EC_REUSE_FORBIDDEN');
        assert.equal(commit, MANUAL_COMMERCIAL.successor);
        assert.equal(raw.PURPOSE, MANUAL_COMMERCIAL.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT, MANUAL_QA.successor);
        requireManualCommercialApproval();
    }
    if(commit===DROPI_LIST.successor||raw.PURPOSE===DROPI_LIST.purpose){
        assert.equal(depth,0,'DROPI_LIST_REUSE_FORBIDDEN');assert.equal(commit,DROPI_LIST.successor);
        assert.equal(raw.PURPOSE,DROPI_LIST.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,MANUAL_COMMERCIAL.successor);
        requireDropiListApproval();
    }
    if(commit===EC_INTEGRATION.successor||raw.PURPOSE===EC_INTEGRATION.purpose){
        assert.equal(depth,0,'DROPI_META_V254_REUSE_FORBIDDEN');assert.equal(commit,EC_INTEGRATION.successor);assert.equal(raw.PURPOSE,EC_INTEGRATION.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_CUSTOMER.successor);orderIntegrationRegistrationV254();
    }
    if(commit===EC_CUSTOMER.successor||raw.PURPOSE===EC_CUSTOMER.purpose){
        assert(depth===0||depth===1&&commit===EC_INTEGRATION.parentCommit,'CUSTOMER_EDIT_PAQUIZHA_REUSE_FORBIDDEN');assert.equal(commit,EC_CUSTOMER.successor);assert.equal(raw.PURPOSE,EC_CUSTOMER.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_ORDERS.successor);customerEditPaquizhaRegistrationV253();
    }
    if(commit===EC_ORDERS.successor||raw.PURPOSE===EC_ORDERS.purpose){
        assert(depth===0||depth===1&&commit===EC_CUSTOMER.parentCommit,'ORDERS_DROPI_POSTSALE_REUSE_FORBIDDEN');assert.equal(commit,EC_ORDERS.successor);assert.equal(raw.PURPOSE,EC_ORDERS.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_TEX_INVITE.successor);ordersDropiPostSaleRegistrationV252();
    }
    if(commit===EC_TEX_INVITE.successor||raw.PURPOSE===EC_TEX_INVITE.purpose){
        assert(depth===0||depth===1&&commit===EC_ORDERS.parentCommit,'TEX_POSTLEAD_REUSE_FORBIDDEN');assert.equal(commit,EC_TEX_INVITE.successor);assert.equal(raw.PURPOSE,EC_TEX_INVITE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_TEX_START.successor);texPostLeadRegistrationV251();
    }
    if(commit===EC_TEX_START.successor||raw.PURPOSE===EC_TEX_START.purpose){
        assert(depth===0||depth===1&&commit===EC_TEX_INVITE.parentCommit,'TEX_GREETING_REUSE_FORBIDDEN');assert.equal(commit,EC_TEX_START.successor);assert.equal(raw.PURPOSE,EC_TEX_START.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_NAMED.successor);texEntryGreetingRegistrationV249();
    }
    if(commit===EC_NAMED.successor||raw.PURPOSE===EC_NAMED.purpose){
        assert(depth===0||[1,2].includes(depth)&&commit===EC_TEX_START.parentCommit,'B01_NAMED_ENTRY_REUSE_FORBIDDEN');assert.equal(commit,EC_NAMED.successor);assert.equal(raw.PURPOSE,EC_NAMED.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_TEX_ENTRY.successor);b01NamedEntryRegistrationV246R5();
    }
    if(commit===EC_TEX_ENTRY.successor||raw.PURPOSE===EC_TEX_ENTRY.purpose){
        assert(depth===0||[1,2,3].includes(depth)&&commit===EC_NAMED.parentCommit,'TEX_ENTRY_INVITES_REUSE_FORBIDDEN');assert.equal(commit,EC_TEX_ENTRY.successor);assert.equal(raw.PURPOSE,EC_TEX_ENTRY.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_QA_CYCLE.successor);texEntryInvitesRegistrationV246();
    }
    if(commit===EC_QA_CYCLE.successor||raw.PURPOSE===EC_QA_CYCLE.purpose){
        assert(depth===0||[1,2,3,4].includes(depth)&&commit===EC_TEX_ENTRY.parentCommit,'QA_B01_CYCLE_REUSE_FORBIDDEN');assert.equal(commit,EC_QA_CYCLE.successor);assert.equal(raw.PURPOSE,EC_QA_CYCLE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_MEASURE.successor);qaB01CycleRegistrationV244R8();
    }
    if(commit===EC_MEASURE.successor||raw.PURPOSE===EC_MEASURE.purpose){
        assert(depth===0||[1,2,3,4,5].includes(depth)&&commit===EC_QA_CYCLE.parentCommit,'TEX_MEASUREMENT_REUSE_FORBIDDEN');assert.equal(commit,EC_MEASURE.successor);assert.equal(raw.PURPOSE,EC_MEASURE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_PERIOD.successor);texMeasurementRegistrationV243();
    }
    if(commit===EC_PERIOD.successor||raw.PURPOSE===EC_PERIOD.purpose){
        assert.equal(depth,0,'QA_NATURAL_ENTRY_REUSE_FORBIDDEN');assert.equal(commit,EC_PERIOD.successor);assert.equal(raw.PURPOSE,EC_PERIOD.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_LINKED.successor);b01PeriodPriceRegistrationV243();
    }
    if(commit===EC_LINKED.successor||raw.PURPOSE===EC_LINKED.purpose){
        assert.equal(depth,0,'TEX_LINKED_ENTRY_REUSE_FORBIDDEN');assert.equal(commit,EC_LINKED.successor);assert.equal(raw.PURPOSE,EC_LINKED.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_QA.successor);texLinkedEntryRegistrationV242();
    }
    if(commit===EC_QA.successor||raw.PURPOSE===EC_QA.purpose){
        assert.equal(depth,0,'QA_NATURAL_ENTRY_REUSE_FORBIDDEN');assert.equal(commit,EC_QA.successor);assert.equal(raw.PURPOSE,EC_QA.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_TEX.successor);qaNaturalEntryRegistrationV241();
    }
    if(commit===EC_TEX.successor||raw.PURPOSE===EC_TEX.purpose){
        assert.equal(depth,0,'TEX_WEB_REUSE_FORBIDDEN');assert.equal(commit,EC_TEX.successor);assert.equal(raw.PURPOSE,EC_TEX.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_PRICE.successor);texUltraWebChatRegistrationV240();
    }
    if(commit===EC_PRICE.successor||raw.PURPOSE===EC_PRICE.purpose){
        assert.equal(depth,0,'PRICE_CLOSURE_REUSE_FORBIDDEN');assert.equal(commit,EC_PRICE.successor);assert.equal(raw.PURPOSE,EC_PRICE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_ACCESS.successor);priceClosureRegistrationV239();
    }
    if(commit===EC_ACCESS.successor||raw.PURPOSE===EC_ACCESS.purpose){
        assert.equal(depth,0,'ORDER_ACCESS_REUSE_FORBIDDEN');assert.equal(commit,EC_ACCESS.successor);assert.equal(raw.PURPOSE,EC_ACCESS.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_JOURNEY.successor);orderAccessRegistrationV238();
    }
    if(commit===EC_JOURNEY.successor||raw.PURPOSE===EC_JOURNEY.purpose){
        assert.equal(depth,0,'JOURNEY_MEASUREMENT_REUSE_FORBIDDEN');assert.equal(commit,EC_JOURNEY.successor);assert.equal(raw.PURPOSE,EC_JOURNEY.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_CHAT.successor);journeyMeasurementRegistrationV237();
    }
    if(commit===EC_CHAT.successor||raw.PURPOSE===EC_CHAT.purpose){
        assert.equal(depth,0,'CHAT_ACCESS_REUSE_FORBIDDEN');assert.equal(commit,EC_CHAT.successor);assert.equal(raw.PURPOSE,EC_CHAT.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_INVITES.successor);chatAccessRegistrationV236();
    }
    if(commit===EC_INVITES.successor||raw.PURPOSE===EC_INVITES.purpose){
        assert.equal(depth,0,'INVITES_REUSE_FORBIDDEN');assert.equal(commit,EC_INVITES.successor);assert.equal(raw.PURPOSE,EC_INVITES.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_VOICE.successor);customerInvitesRegistrationV232();
    }
    if(commit===EC_VOICE.successor||raw.PURPOSE===EC_VOICE.purpose){
        assert.equal(depth,0,'VOICE_REUSE_FORBIDDEN');assert.equal(commit,EC_VOICE.successor);assert.equal(raw.PURPOSE,EC_VOICE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_SALE.successor);webVoiceStatusRegistrationV231();
    }
    if(commit===EC_SALE.successor||raw.PURPOSE===EC_SALE.purpose){
        assert.equal(depth,0,'SALE_REUSE_FORBIDDEN');assert.equal(commit,EC_SALE.successor);assert.equal(raw.PURPOSE,EC_SALE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_FIX.successor);sdrSaleRegistrationV230();
    }
    if(commit===EC_FIX.successor||raw.PURPOSE===EC_FIX.purpose){
        assert.equal(depth,0,'FIX_REUSE_FORBIDDEN');assert.equal(commit,EC_FIX.successor);assert.equal(raw.PURPOSE,EC_FIX.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_BURST.successor);botDropiRegistrationV229();
    }
    if(commit===EC_BURST.successor||raw.PURPOSE===EC_BURST.purpose){
        assert.equal(depth,0,'BURST_REUSE_FORBIDDEN');assert.equal(commit,EC_BURST.successor);assert.equal(raw.PURPOSE,EC_BURST.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_INBOUND.successor);burstReplyRegistrationV228();
    }
    if(commit===EC_INBOUND.successor||raw.PURPOSE===EC_INBOUND.purpose){
        assert.equal(depth,0,'INBOUND_REUSE_FORBIDDEN');assert.equal(commit,EC_INBOUND.successor);assert.equal(raw.PURPOSE,EC_INBOUND.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_STORE.successor);inboundRoutingRegistrationV227();
    }
    if(commit===EC_STORE.successor||raw.PURPOSE===EC_STORE.purpose){
        assert.equal(depth,0,'STORE_REUSE_FORBIDDEN');assert.equal(commit,EC_STORE.successor);assert.equal(raw.PURPOSE,EC_STORE.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_DASHBOARD.successor);webDashboardStoreRegistrationV222();
    }
    if(commit===EC_DASHBOARD.successor||raw.PURPOSE===EC_DASHBOARD.purpose){
        assert.equal(depth,0,'DASHBOARD_REUSE_FORBIDDEN');assert.equal(commit,EC_DASHBOARD.successor);assert.equal(raw.PURPOSE,EC_DASHBOARD.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_CONTEXT.successor);webDashboardRegistrationV222();
    }
    if(commit===EC_CONTEXT.successor||raw.PURPOSE===EC_CONTEXT.purpose){
        assert.equal(depth,0,'RECALL_REUSE_FORBIDDEN');assert.equal(commit,EC_CONTEXT.successor);assert.equal(raw.PURPOSE,EC_CONTEXT.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_RECALL.successor);webChatContextRegistrationV220();
    }
    if(commit===EC_RECALL.successor||raw.PURPOSE===EC_RECALL.purpose){
        assert.equal(depth,0,'RECALL_REUSE_FORBIDDEN');assert.equal(commit,EC_RECALL.successor);assert.equal(raw.PURPOSE,EC_RECALL.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_WEB.successor);webChatRecallRegistrationV220();
    }
    if(commit===EC_WEB.successor||raw.PURPOSE===EC_WEB.purpose){
        assert.equal(depth,0,'WEB_REUSE_FORBIDDEN');assert.equal(commit,EC_WEB.successor);assert.equal(raw.PURPOSE,EC_WEB.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_PRIORITY.successor);webChatRegistrationV220();
    }
    if(commit===EC_PRIORITY.successor||raw.PURPOSE===EC_PRIORITY.purpose){
        assert.equal(depth,0,'PRIORITY_REUSE_FORBIDDEN');assert.equal(commit,EC_PRIORITY.successor);assert.equal(raw.PURPOSE,EC_PRIORITY.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_B01.successor);priorityRegistrationV219();
    }
    if(commit===EC_B01.successor||raw.PURPOSE===EC_B01.purpose){
        assert.equal(depth,0,'B01_REUSE_FORBIDDEN');assert.equal(commit,EC_B01.successor);assert.equal(raw.PURPOSE,EC_B01.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_OWNER.successor);b01RegistrationV216();
    }
    if(commit===EC_OWNER.successor||raw.PURPOSE===EC_OWNER.purpose){
        assert.equal(depth,0,'OWNER_REUSE_FORBIDDEN');assert.equal(commit,EC_OWNER.successor);assert.equal(raw.PURPOSE,EC_OWNER.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_MEASUREMENT.successor);inboundOwnerRegistrationV214();
    }
    if(commit===EC_MEASUREMENT.successor||raw.PURPOSE===EC_MEASUREMENT.purpose){
        assert(depth===0||depth===1&&commit===EC_OWNER.parentCommit,'MEASUREMENT_REUSE_FORBIDDEN');assert.equal(commit,EC_MEASUREMENT.successor);
        assert.equal(raw.PURPOSE,EC_MEASUREMENT.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_FREEFLOW.successor);
        measurementRegistrationV213();
    }
    if(commit===EC_FREEFLOW.successor||raw.PURPOSE===EC_FREEFLOW.purpose){
        assert.equal(depth,0,'FREEFLOW_REUSE_FORBIDDEN');assert.equal(commit,EC_FREEFLOW.successor);
        assert.equal(raw.PURPOSE,EC_FREEFLOW.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_TRACKING.successor);
        freeflowRegistrationV212();
    }
    if(commit===EC_TRACKING.successor||raw.PURPOSE===EC_TRACKING.purpose){
        assert.equal(depth,0,'TRACKING_REUSE_FORBIDDEN');assert.equal(commit,EC_TRACKING.successor);
        assert.equal(raw.PURPOSE,EC_TRACKING.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_PREPAID.successor);
        trackingRegistrationV210();
    }
    if(commit===EC_PREPAID.successor||raw.PURPOSE===EC_PREPAID.purpose){
        assert.equal(depth,0,'PREPAID_REUSE_FORBIDDEN');assert.equal(commit,EC_PREPAID.successor);
        assert.equal(raw.PURPOSE,EC_PREPAID.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_AUDIO.successor);
        prepaidRegistrationV1();
    }
    if(commit===EC_AUDIO.successor||raw.PURPOSE===EC_AUDIO.purpose){
        assert.equal(depth,0,'AUDIO_REUSE_FORBIDDEN');assert.equal(commit,EC_AUDIO.successor);
        assert.equal(raw.PURPOSE,EC_AUDIO.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,EC_REPURCHASE.successor);
        audioRegistrationV208();
    }
    if(commit===EC_REPURCHASE.successor||raw.PURPOSE===EC_REPURCHASE.purpose){
        assert.equal(depth,0,'REPURCHASE_REUSE_FORBIDDEN');assert.equal(commit,EC_REPURCHASE.successor);
        assert.equal(raw.PURPOSE,EC_REPURCHASE.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,GIRA_HANDOFF.successor);
        repurchaseRegistrationV207();
    }
    if(commit===GIRA_HANDOFF.successor||raw.PURPOSE===GIRA_HANDOFF.purpose){
        assert.equal(depth,0,'HANDOFF_REUSE_FORBIDDEN');assert.equal(commit,GIRA_HANDOFF.successor);
        assert.equal(raw.PURPOSE,GIRA_HANDOFF.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,GIRA_BRIDGE.successor);
        handoffRegistration();
    }
    if(commit===GIRA_BRIDGE.successor||raw.PURPOSE===GIRA_BRIDGE.purpose){
        assert.equal(depth,0,'GIRA_REUSE_FORBIDDEN');assert.equal(commit,GIRA_BRIDGE.successor);assert.equal(raw.PURPOSE,GIRA_BRIDGE.purpose);assert.equal(raw.authority.PREDECESSOR_COMMIT,OPERATIONS_V203.successor);
        requireGiraApproval('/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs',GIRA_BRIDGE);
    }
    if(commit===OPERATIONS_V203.successor||raw.PURPOSE===OPERATIONS_V203.purpose){
        assert.equal(depth,0,'OP203_REUSE_FORBIDDEN');
        assert.equal(commit,OPERATIONS_V203.successor);assert.equal(raw.PURPOSE,OPERATIONS_V203.purpose);
        assert.equal(raw.authority.PREDECESSOR_COMMIT,DROPI_LIST.successor);
        requireOperationsApprovalV203('/usr/local/lib/vitalismen-deploy/sealed-successor-v1.mjs',OPERATIONS_V203);
    }
    const parent = raw.PURPOSE===EC_INTEGRATION.purpose ? registryEnvelope(EC_CUSTOMER.successor)
        : raw.PURPOSE===EC_CUSTOMER.purpose ? registryEnvelope(EC_ORDERS.successor)
        : raw.PURPOSE===EC_ORDERS.purpose ? registryEnvelope(EC_TEX_INVITE.successor)
        : raw.PURPOSE===EC_TEX_INVITE.purpose ? registryEnvelope(EC_TEX_START.successor)
        : raw.PURPOSE===EC_TEX_START.purpose ? registryEnvelope(EC_NAMED.successor)
        : raw.PURPOSE===EC_NAMED.purpose ? registryEnvelope(EC_TEX_ENTRY.successor)
        : raw.PURPOSE===EC_TEX_ENTRY.purpose ? registryEnvelope(EC_QA_CYCLE.successor)
        : raw.PURPOSE===EC_QA_CYCLE.purpose ? registryEnvelope(EC_MEASURE.successor)
        : raw.PURPOSE===EC_MEASURE.purpose ? registryEnvelope(EC_PERIOD.successor)
        : raw.PURPOSE===EC_PERIOD.purpose ? registryEnvelope(EC_LINKED.successor)
        : raw.PURPOSE===EC_LINKED.purpose ? registryEnvelope(EC_QA.successor)
        : raw.PURPOSE===EC_QA.purpose ? registryEnvelope(EC_TEX.successor)
        : raw.PURPOSE===EC_TEX.purpose ? registryEnvelope(EC_PRICE.successor)
        : raw.PURPOSE===EC_PRICE.purpose ? registryEnvelope(EC_ACCESS.successor)
        : raw.PURPOSE===EC_ACCESS.purpose ? registryEnvelope(EC_JOURNEY.successor)
        : raw.PURPOSE===EC_JOURNEY.purpose ? registryEnvelope(EC_CHAT.successor)
        : raw.PURPOSE===EC_CHAT.purpose ? registryEnvelope(EC_INVITES.successor)
        : raw.PURPOSE===EC_INVITES.purpose ? registryEnvelope(EC_VOICE.successor)
        : raw.PURPOSE===EC_VOICE.purpose ? registryEnvelope(EC_SALE.successor)
        : raw.PURPOSE===EC_SALE.purpose ? registryEnvelope(EC_FIX.successor)
        : raw.PURPOSE===EC_FIX.purpose ? registryEnvelope(EC_BURST.successor)
        : raw.PURPOSE===EC_BURST.purpose ? registryEnvelope(EC_INBOUND.successor)
        : raw.PURPOSE===EC_INBOUND.purpose ? registryEnvelope(EC_STORE.successor)
        : raw.PURPOSE===EC_STORE.purpose ? registryEnvelope(EC_DASHBOARD.successor)
        : raw.PURPOSE===EC_DASHBOARD.purpose ? registryEnvelope(EC_CONTEXT.successor)
        : raw.PURPOSE===EC_CONTEXT.purpose ? registryEnvelope(EC_RECALL.successor)
        : raw.PURPOSE===EC_RECALL.purpose ? registryEnvelope(EC_WEB.successor)
        : raw.PURPOSE===EC_WEB.purpose ? registryEnvelope(EC_PRIORITY.successor)
        : raw.PURPOSE===EC_PRIORITY.purpose ? registryEnvelope(EC_B01.successor)
        : raw.PURPOSE===EC_B01.purpose ? registryEnvelope(EC_OWNER.successor)
        : raw.PURPOSE===EC_OWNER.purpose ? registryEnvelope(EC_MEASUREMENT.successor)
        : raw.PURPOSE===EC_MEASUREMENT.purpose ? registryEnvelope(EC_FREEFLOW.successor)
        : raw.PURPOSE===EC_FREEFLOW.purpose ? registryEnvelope(EC_TRACKING.successor)
        : raw.PURPOSE===EC_TRACKING.purpose ? registryEnvelope(EC_PREPAID.successor)
        : raw.PURPOSE===EC_PREPAID.purpose ? registryEnvelope(EC_AUDIO.successor)
        : raw.PURPOSE===EC_AUDIO.purpose ? registryEnvelope(EC_REPURCHASE.successor)
        : raw.PURPOSE===EC_REPURCHASE.purpose ? registryEnvelope(GIRA_HANDOFF.successor)
        : raw.PURPOSE===GIRA_HANDOFF.purpose ? registryEnvelope(GIRA_BRIDGE.successor)
        : raw.PURPOSE===GIRA_BRIDGE.purpose ? registryEnvelope(OPERATIONS_V203.successor)
        : raw.PURPOSE===OPERATIONS_V203.purpose ? registryEnvelope(DROPI_LIST.successor)
        : raw.PURPOSE===DROPI_LIST.purpose ? registryEnvelope(MANUAL_COMMERCIAL.successor)
        : raw.PURPOSE === MANUAL_COMMERCIAL.purpose ? registryEnvelope(MANUAL_QA.successor)
        : raw.PURPOSE === MANUAL_QA.purpose
        ? registryEnvelope(HOME_ORDER.successor)
        : raw.PURPOSE === HOME_ORDER.purpose
        ? registryEnvelope(QA_ORDER.successor)
        : raw.PURPOSE === QA_ORDER.purpose
        ? registryEnvelope(QA_ORDER.predecessor)
        : raw.PURPOSE === 'VIT_SIGNATURE_PATCH'
            ? registryEnvelope(raw.authority.PREDECESSOR_COMMIT, depth + 1) : null;
    return verifyEnvelopeBytes(bytes, seal.trim(),
        rootOwnedRegular('/var/lib/vitalismen-deploy/CHECKPOINT_R5_TEX_ULTRA_LOCALITY_ANTIREPEAT_AUTHORITY.json'), parent);
}

export function payloadHashes(root) {
    const result = {};
    const walk = (dir, prefix = '') => {
        for (const item of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name))) {
            if (!prefix && GENERATED.has(item.name)) continue;
            const relative = prefix ? `${prefix}/${item.name}` : item.name;
            const file = path.join(dir, item.name), stat = fs.lstatSync(file);
            assert.ok(!stat.isSymbolicLink(), 'SEALED_PAYLOAD_SYMLINK');
            if (stat.isDirectory()) walk(file, relative);
            else { assert.ok(stat.isFile(), 'SEALED_PAYLOAD_NONREGULAR'); result[relative] = sha256(fs.readFileSync(file)); }
        }
    };
    walk(root); return result;
}

export function readSealedRelease(root, { requireGit = false } = {}) {
    const physical = fs.realpathSync(root);
    assert.equal(path.dirname(physical), '/opt/vitalismen-automacao/releases', 'SEALED_RELEASE_ROOT_INVALID');
    // The official stage helper creates release metadata as root:root 0600.
    // Registry authority, seal and historical checkpoint still require 0400.
    const sourceFile = path.join(physical, '.release-source.json');
    const sourceStat = fs.lstatSync(sourceFile);
    assert.ok(sourceStat.isFile() && !sourceStat.isSymbolicLink()
        && sourceStat.uid === 0 && sourceStat.gid === 0
        && [0o400, 0o600].includes(sourceStat.mode & 0o777), 'SEALED_SOURCE_PERMISSIONS');
    const sourceBytes = fs.readFileSync(sourceFile);
    const source = JSON.parse(sourceBytes.toString('utf8'));
    assert.deepEqual(sourceBytes, canonicalBytes(source), 'SEALED_SOURCE_NONCANONICAL');
    assert.equal(source.releaseName, path.basename(physical));
    assert.match(source.functionalCommit, SHA1);
    const entry = path.join(REGISTRY_ROOT, `${source.functionalCommit}.json`);
    if (!fs.existsSync(entry)) {
        assert.notEqual(source.functionalCommit, QA_ORDER.successor, 'SEALED_QA_ORDER_AUTHORITY_ABSENT');
        return null; // Existing historical verifier remains mandatory at callers.
    }
    const envelope = registryEnvelope(source.functionalCommit);
    assert.equal(source.functionalTree, envelope.authority.SUCCESSOR_TREE, 'SEALED_SOURCE_TREE_INVALID');
    assert.ok(source.releaseName.endsWith(source.functionalCommit.slice(0, 7)), 'SEALED_RELEASE_NAME_INVALID');
    assert.deepEqual(payloadHashes(physical), envelope.PAYLOAD_HASHES, 'SEALED_MATERIALIZED_PAYLOAD_INVALID');
    if (requireGit) verifyCandidateFacts(envelope.authority, readGitCandidateFacts(physical, envelope.authority));
    return Object.freeze({ envelope, authority: envelope.authority, root: physical,
        authoritySha256: sha256(canonicalBytes(envelope)),
        nodeOptions: '--import=file://' + physical + '/' + SEALED_PRELOAD_RELATIVE });
}

export function requireSealedRelease(root, options) {
    const value = readSealedRelease(root, options);
    assert.ok(value, 'SEALED_AUTHORITY_ABSENT'); return value;
}

const STATE_ROOT = '/var/lib/vitalismen-deploy';
const RESTORABLE_STATE = ['ec-bot-core-v78.env', 'ec-bot-core-v78-attestation.json',
    'ec-bot-core-v78-permit.json', 'ec-bot-core-v78-permit.consumed.json'];
function assertRootOperation() {
    assert.equal(process.platform, 'linux', 'SEALED_OPERATION_LINUX_ONLY');
    assert.equal(process.getuid(), 0, 'SEALED_OPERATION_ROOT_ONLY');
}
function mkdirProtected(directory) {
    if (!fs.existsSync(directory)) fs.mkdirSync(directory, { mode: 0o700 });
    const stat = fs.lstatSync(directory);
    assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0
        && stat.gid === 0 && (stat.mode & 0o077) === 0, 'SEALED_BACKUP_DIRECTORY_UNSAFE');
}
function atomicRootFile(file, bytes, mode) {
    const temporary = `${file}.${process.pid}.tmp`;
    const fd = fs.openSync(temporary, 'wx', mode);
    try { fs.writeFileSync(fd, bytes); fs.fsyncSync(fd); } finally { fs.closeSync(fd); }
    fs.renameSync(temporary, file); fs.chmodSync(file, mode);
}


// Explicit identity source for the authorized materialized home-delivery release.
export function readOfficialBareGitCandidateFacts(root, gitIdentitySource, gitCommit, authority) {
    const official = '/var/lib/vitalismen-deploy/git-identity-sources/home-delivery-authority.git';
    assert.equal(gitIdentitySource, official, 'SEALED_GIT_SOURCE_NOT_OFFICIAL');
    assert.equal(fs.realpathSync(gitIdentitySource), official, 'SEALED_GIT_SOURCE_ALIAS_INVALID');
    const sourceStat = fs.lstatSync(official);
    assert.ok(sourceStat.isDirectory() && !sourceStat.isSymbolicLink()
        && sourceStat.uid === 0 && sourceStat.gid === 0
        && (sourceStat.mode & 0o077) === 0, 'SEALED_GIT_SOURCE_PERMISSIONS');
    assert.ok(!fs.existsSync(path.join(official, 'objects/info/alternates')), 'SEALED_GIT_ALTERNATES_FORBIDDEN');
    assert.match(gitCommit, SHA1);
    assert.equal(gitCommit, authority.SUCCESSOR_COMMIT, 'SEALED_GIT_COMMIT_MISMATCH');
    const gitEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => !key.startsWith('GIT_')));
    Object.assign(gitEnv, { GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null', GIT_OPTIONAL_LOCKS: '0' });
    const git = (...args) => execFileSync('git', ['--no-replace-objects', '-C', official, ...args],
        { encoding: 'utf8', env: gitEnv, maxBuffer: 16 * 1024 * 1024 }).trim();
    assert.equal(git('rev-parse', '--is-bare-repository'), 'true', 'SEALED_GIT_SOURCE_NOT_BARE');
    assert.equal(git('remote', 'get-url', 'origin'),
        'https://github.com/GitViltaliesmen/vitalismen-maxlien-painel.git', 'SEALED_GIT_SOURCE_ORIGIN_INVALID');
    const commit = git('rev-parse', `${gitCommit}^{commit}`);
    const tree = git('rev-parse', `${gitCommit}^{tree}`);
    assert.equal(commit, authority.SUCCESSOR_COMMIT, 'SEALED_UNREGISTERED_COMMIT');
    assert.equal(tree, authority.SUCCESSOR_TREE, 'SEALED_UNREGISTERED_TREE');
    const changes = git('diff', '--name-status', '--no-renames', authority.PREDECESSOR_COMMIT, commit)
        .split(/\r?\n/).filter(Boolean);
    const fileHashes = {};
    const changedPaths = changes.map(line => {
        const [status, relative, extra] = line.split('\t');
        assert.ok(['A', 'M'].includes(status) && relative && extra === undefined, 'SEALED_CHANGE_TYPE_INVALID');
        assert.match(relative, SAFE_PATH);
        const item = git('ls-tree', commit, '--', relative);
        assert.ok(item.startsWith('100644 blob ') || item.startsWith('100755 blob '), 'SEALED_NONREGULAR_GIT_FILE');
        const bytes = execFileSync('git', ['--no-replace-objects', '-C', official, 'show', `${commit}:${relative}`],
            { env: gitEnv, maxBuffer: 16 * 1024 * 1024 });
        const file = path.join(root, relative), stat = fs.lstatSync(file);
        assert.ok(stat.isFile() && !stat.isSymbolicLink(), 'SEALED_NONREGULAR_FILE');
        assert.equal(sha256(fs.readFileSync(file)), sha256(bytes), 'SEALED_RELEASE_GIT_HASH_INVALID');
        fileHashes[relative] = sha256(bytes);
        return relative;
    }).sort();
    return { predecessorCommit: authority.PREDECESSOR_COMMIT,
        predecessorTree: git('rev-parse', `${authority.PREDECESSOR_COMMIT}^{tree}`), commit, tree,
        parents: git('rev-list', '--parents', '-n', '1', commit).split(' ').slice(1),
        clean: true, changedPaths, fileHashes };
}

export async function recordSealedRollbackPlan(root, options = {}) {
    assertRootOperation();
    const separated = Object.keys(options).length !== 0;
    if (separated) sameKeys(options, ['gitIdentitySource', 'gitCommit'], 'SEALED_GIT_SOURCE_OPTIONS_INVALID');
    const sealed = requireSealedRelease(root, { requireGit: !separated });
    if (separated) {
        assert.ok(sealed.envelope.PURPOSE === HOME_ORDER.purpose || isManualQa(sealed) || (isManualCommercial(sealed) || isDropiList(sealed)) || isGiraBridge(sealed), 'SEALED_GIT_SOURCE_CONTEXT_INVALID');
        verifyCandidateFacts(sealed.authority, readOfficialBareGitCandidateFacts(sealed.root,
            options.gitIdentitySource, options.gitCommit, sealed.authority));
    }
    const predecessor = path.join('/opt/vitalismen-automacao/releases', sealed.envelope.PREDECESSOR_RELEASE);
    assert.equal(fs.realpathSync('/opt/vitalismen-automacao/current'), predecessor,
        'SEALED_BACKUP_PREDECESSOR_INVALID');
    if (sealed.envelope.PURPOSE === 'GOVERNANCE_BOOTSTRAP') {
        const historicalCode = path.join(BASE_RELEASE, 'scripts/lib/unified-successor-v202-r5-authority.mjs');
        assert.equal(sha256(fs.readFileSync(historicalCode)), '8c7187f0a142b4077c63fad445914b67c5c36813448ee16301b7e64520e4e206', 'HISTORICAL_CODE_TAMPERED');
        const m = await import(pathToFileURL(historicalCode).href);
        m.verifyR5MaterializedRelease(predecessor);
    } else requireSealedRelease(predecessor);
    const parent = path.join(STATE_ROOT, 'sealed-successor-backups-v1'); mkdirProtected(parent);
    const directory = path.join(parent, sealed.authority.SUCCESSOR_COMMIT); mkdirProtected(directory);
    const journal = path.join(directory, 'rollback.json');
    if (fs.existsSync(journal)) {
        // Legacy receipts bind project, tree and complete payload identity through
        // the exact registered envelope hash; no receipt field is manufactured.
        assert.equal(sealed.envelope.PURPOSE, 'VIT_SIGNATURE_PATCH', 'SEALED_REUSE_CONTEXT_INVALID');
        assert.equal(sealed.authority.PROJECT, 'VITALISMEN_EC', 'SEALED_REUSE_PROJECT_INVALID');
        assert.equal(sealed.authority.SUCCESSOR_COMMIT, '227e5f864348595408762dad6b5b6a41b41d5fca',
            'SEALED_REUSE_SUCCESSOR_INVALID');
        assert.equal(sealed.authority.SUCCESSOR_TREE, 'eb573f0b21ef1152c3cbfb5afe981c15a558c10c',
            'SEALED_REUSE_TREE_INVALID');
        assert.equal(sealed.authoritySha256, '270c27a8345d81918f74596f4faa522e9d6f3105760dc15895ea4ad681bf9399',
            'SEALED_REUSE_AUTHORITY_INVALID');
        assert.equal(predecessor, '/opt/vitalismen-automacao/releases/20261004T000000Z_production-20261004-bb17ea5',
            'SEALED_REUSE_PREDECESSOR_INVALID');
        const bytes = rootOwnedRegular(journal);
        const receipt = JSON.parse(bytes.toString('utf8'));
        assert.deepEqual(bytes, canonicalBytes(receipt), 'SEALED_REUSE_NONCANONICAL');
        sameKeys(receipt, ['version', 'successor', 'authoritySha256', 'predecessor', 'records', 'pm2EnvSha256'],
            'SEALED_REUSE_SCHEMA_INVALID');
        assert.equal(receipt.version, 1, 'SEALED_REUSE_VERSION_INVALID');
        assert.equal(receipt.successor, sealed.authority.SUCCESSOR_COMMIT, 'SEALED_REUSE_SUCCESSOR_INVALID');
        assert.equal(receipt.authoritySha256, sealed.authoritySha256, 'SEALED_REUSE_AUTHORITY_INVALID');
        assert.equal(receipt.predecessor, predecessor, 'SEALED_REUSE_PREDECESSOR_INVALID');
        sameKeys(receipt.records, RESTORABLE_STATE, 'SEALED_REUSE_RECORDS_INVALID');
        assert.deepEqual(fs.readdirSync(directory, { withFileTypes: true }).map(entry => entry.name).sort(),
            ['rollback.json', 'pm2-before.env.json', ...RESTORABLE_STATE.filter(name => receipt.records[name]?.existed === true)].sort(),
            'SEALED_REUSE_BACKUP_TARGETS_INVALID');
        for (const name of RESTORABLE_STATE) {
            const record = receipt.records[name];
            const target = path.join(STATE_ROOT, name);
            if (record.existed === false) {
                assert.deepEqual(record, { existed: false }, 'SEALED_REUSE_RECORD_INVALID');
                assert.ok(!fs.existsSync(target) && !fs.existsSync(path.join(directory, name)),
                    'SEALED_REUSE_ABSENT_TARGET_CHANGED');
                continue;
            }
            sameKeys(record, ['existed', 'sha256', 'mode'], 'SEALED_REUSE_RECORD_INVALID');
            assert.equal(record.existed, true, 'SEALED_REUSE_RECORD_INVALID');
            assert.ok([0o400, 0o600].includes(record.mode), 'SEALED_REUSE_MODE_INVALID');
            assert.match(record.sha256, SHA256, 'SEALED_REUSE_HASH_INVALID');
            assert.equal(sha256(rootOwnedRegular(path.join(directory, name))), record.sha256,
                'SEALED_REUSE_BACKUP_TAMPERED');
            const stat = fs.lstatSync(target);
            assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0
                && (stat.mode & 0o777) === record.mode, 'SEALED_REUSE_TARGET_UNSAFE');
            assert.equal(sha256(fs.readFileSync(target)), record.sha256, 'SEALED_REUSE_TARGET_CHANGED');
        }
        assert.match(receipt.pm2EnvSha256, SHA256, 'SEALED_REUSE_PM2_HASH_INVALID');
        const envBytes = rootOwnedRegular(path.join(directory, 'pm2-before.env.json'));
        assert.equal(sha256(envBytes), receipt.pm2EnvSha256, 'SEALED_REUSE_PM2_BACKUP_TAMPERED');
        const originalEnv = JSON.parse(envBytes.toString('utf8'));
        assert.deepEqual(envBytes, canonicalBytes(originalEnv), 'SEALED_REUSE_PM2_NONCANONICAL');
        for (const [key, value] of Object.entries(originalEnv)) {
            assert.match(key, /^[A-Z][A-Z0-9_]*$/); assert.equal(typeof value, 'string');
        }
        const processes = JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: (isOperationsV203(sealed)||isGiraBridge(sealed)) ? {...Object.fromEntries(Object.entries(process.env).filter(([key])=>!['PM2_PROGRAMMATIC','PM2_JSON_PROCESSING','pm_id'].includes(key))),NODE_OPTIONS:''} : process.env }));
        const matches = processes.filter(p => p.name === 'vitalismen-automation');
        assert.equal(matches.length, 1, 'SEALED_REUSE_PM2_IDENTITY');
        const proc = matches[0].pm2_env;
        assert.equal(proc.status, 'online', 'SEALED_REUSE_PM2_NOT_ONLINE');
        assert.ok(['/opt/vitalismen-automacao/current', predecessor].includes(proc.pm_cwd), 'SEALED_REUSE_PM2_CWD');
        assert.ok(['/opt/vitalismen-automacao/current/src/index.js', predecessor + '/src/index.js'].includes(proc.pm_exec_path),
            'SEALED_REUSE_PM2_EXEC');
        const currentEnv = Object.fromEntries(Object.entries({ ...(proc.env || {}), ...proc })
            .filter(([key, value]) => /^[A-Z][A-Z0-9_]*$/.test(key) && typeof value === 'string'));
        assert.equal(sha256(canonicalBytes(currentEnv)), receipt.pm2EnvSha256, 'SEALED_REUSE_PM2_PROFILE_CHANGED');
        return { rollbackPrepared: true, predecessor, reusedExistingPlan: true };
    }
    const records = {};
    for (const name of RESTORABLE_STATE) {
        const file = path.join(STATE_ROOT, name);
        if (!fs.existsSync(file)) { records[name] = { existed: false }; continue; }
        const stat = fs.lstatSync(file);
        assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0
            && (stat.mode & 0o077) === 0, 'SEALED_STATE_UNSAFE');
        const bytes = fs.readFileSync(file);
        fs.writeFileSync(path.join(directory, name), bytes, { flag: 'wx', mode: 0o400 });
        records[name] = { existed: true, sha256: sha256(bytes), mode: stat.mode & 0o777 };
    }
    const processes = JSON.parse(execFileSync('/usr/bin/pm2', ['jlist'], { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024, env: (isOperationsV203(sealed)||isGiraBridge(sealed)) ? {...Object.fromEntries(Object.entries(process.env).filter(([key])=>!['PM2_PROGRAMMATIC','PM2_JSON_PROCESSING','pm_id'].includes(key))),NODE_OPTIONS:''} : process.env }));
    const matches = processes.filter(p => p.name === 'vitalismen-automation');
    assert.equal(matches.length, 1, 'SEALED_BACKUP_PM2_IDENTITY');
    const proc = matches[0].pm2_env;
    assert.equal(proc.status, 'online', 'SEALED_BACKUP_PM2_NOT_ONLINE');
    assert.ok(['/opt/vitalismen-automacao/current', predecessor].includes(proc.pm_cwd), 'SEALED_BACKUP_PM2_CWD');
    assert.ok(['/opt/vitalismen-automacao/current/src/index.js', predecessor + '/src/index.js'].includes(proc.pm_exec_path),
        'SEALED_BACKUP_PM2_EXEC');
    const originalEnv = Object.fromEntries(Object.entries({ ...(proc.env || {}), ...proc })
        .filter(([key, value]) => /^[A-Z][A-Z0-9_]*$/.test(key) && typeof value === 'string'));
    const envBytes = canonicalBytes(originalEnv);
    fs.writeFileSync(path.join(directory, 'pm2-before.env.json'), envBytes, { flag: 'wx', mode: 0o400 });
    atomicRootFile(journal, canonicalBytes({ version: 1, successor: sealed.authority.SUCCESSOR_COMMIT,
        authoritySha256: sealed.authoritySha256, predecessor, records, pm2EnvSha256: sha256(envBytes) }), 0o400);
    return { rollbackPrepared: true, predecessor };
}

export async function rollbackSealedRelease(releaseName) {
    assertRootOperation();
    assert.match(releaseName, /^\d{8}T\d{6}Z_production-\d{8}-[a-f0-9]{7}$/);
    const root = path.join('/opt/vitalismen-automacao/releases', releaseName);
    const sealed = requireSealedRelease(root);
    const directory = path.join(STATE_ROOT, 'sealed-successor-backups-v1', sealed.authority.SUCCESSOR_COMMIT);
    const bytes = rootOwnedRegular(path.join(directory, 'rollback.json'));
    const journal = JSON.parse(bytes.toString('utf8'));
    assert.deepEqual(bytes, canonicalBytes(journal));
    sameKeys(journal, ['version', 'successor', 'authoritySha256', 'predecessor', 'records', 'pm2EnvSha256'], 'SEALED_BACKUP_SCHEMA');
    assert.equal(journal.version, 1); assert.equal(journal.successor, sealed.authority.SUCCESSOR_COMMIT);
    assert.equal(journal.authoritySha256, sealed.authoritySha256);
    const predecessor = path.join('/opt/vitalismen-automacao/releases', sealed.envelope.PREDECESSOR_RELEASE);
    assert.equal(journal.predecessor, predecessor);
    sameKeys(journal.records, RESTORABLE_STATE, 'SEALED_BACKUP_RECORDS');
    const current = fs.realpathSync('/opt/vitalismen-automacao/current');
    assert.ok([root, predecessor].includes(current), 'SEALED_ROLLBACK_CURRENT_UNEXPECTED');
    if (sealed.envelope.PURPOSE === 'GOVERNANCE_BOOTSTRAP') {
        const historicalCode = path.join(BASE_RELEASE, 'scripts/lib/unified-successor-v202-r5-authority.mjs');
        assert.equal(sha256(fs.readFileSync(historicalCode)), '8c7187f0a142b4077c63fad445914b67c5c36813448ee16301b7e64520e4e206', 'HISTORICAL_CODE_TAMPERED');
        const m = await import(pathToFileURL(historicalCode).href);
        m.verifyR5MaterializedRelease(predecessor);
    } else requireSealedRelease(predecessor);
    const restored = new Map();
    const envBytes = rootOwnedRegular(path.join(directory, 'pm2-before.env.json'));
    assert.equal(sha256(envBytes), journal.pm2EnvSha256, 'SEALED_PM2_BACKUP_TAMPERED');
    const originalEnv = JSON.parse(envBytes.toString('utf8'));
    assert.deepEqual(envBytes, canonicalBytes(originalEnv));
    for (const [key, value] of Object.entries(originalEnv)) {
        assert.match(key, /^[A-Z][A-Z0-9_]*$/); assert.equal(typeof value, 'string');
    }
    for (const name of RESTORABLE_STATE) {
        const record = journal.records[name];
        if (!record.existed) { assert.deepEqual(record, { existed: false }); continue; }
        sameKeys(record, ['existed', 'sha256', 'mode'], 'SEALED_BACKUP_RECORD_INVALID');
        assert.equal(record.existed, true); assert.ok([0o400, 0o600].includes(record.mode));
        const data = rootOwnedRegular(path.join(directory, name));
        assert.equal(sha256(data), record.sha256, 'SEALED_BACKUP_TAMPERED'); restored.set(name, data);
    }
    for (const name of RESTORABLE_STATE) {
        const target = path.join(STATE_ROOT, name);
        if (fs.existsSync(target)) {
            const stat = fs.lstatSync(target);
            assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0,
                'SEALED_RESTORE_TARGET_UNSAFE');
        }
        if (restored.has(name)) atomicRootFile(target, restored.get(name), journal.records[name].mode);
        else if (fs.existsSync(target)) fs.unlinkSync(target);
    }
    if (current !== predecessor) {
        const next = '/opt/vitalismen-automacao/.current.sealed-rollback.' + process.pid;
        fs.symlinkSync(predecessor, next); fs.renameSync(next, '/opt/vitalismen-automacao/current');
    }
    const pm2 = fs.realpathSync('/usr/bin/pm2');
    assert.ok(pm2.endsWith('/pm2/bin/pm2'), 'SEALED_PM2_PATH_INVALID');
    const pm2Root = path.dirname(path.dirname(pm2));
    const preload = sealed.envelope.PURPOSE === 'GOVERNANCE_BOOTSTRAP'
        ? 'unified-successor-v202-r5-preload.mjs' : 'sealed-successor-preload-v1.mjs';
    execFileSync('/usr/bin/node', [path.join(predecessor, 'scripts/lib/pm2-target-env-restart-v78-r4.mjs'),
        pm2Root, 'vitalismen-automation', '--import=file:///opt/vitalismen-automacao/current/scripts/lib/' + preload,
        predecessor], { env: { ...originalEnv, NODE_OPTIONS: '', npm_config_node_options: '' }, timeout: 30000 });
    if (isManualQa(sealed) || (isManualCommercial(sealed) || isDropiList(sealed))) {
        // PM2 reports process-online before its sealed preload and HTTP listener.
        // Bound readiness polling applies only to this exact new edge.
        const deadline = Date.now() + 30000;
        let ready = false;
        const field = (object, key) => {
            if (!object || typeof object !== 'object') return undefined;
            if (Object.hasOwn(object, key)) return object[key];
            for (const value of Object.values(object)) {
                const found = field(value, key); if (found !== undefined) return found;
            }
        };
        while (Date.now() < deadline) {
            try {
                const response = await fetch('http://127.0.0.1:3001/api/health/', { signal: AbortSignal.timeout(1500) });
                const body = response.status === 200 ? await response.json() : null;
                ready = field(body, 'strictReadOnly') === true
                    && ['operationalMutationsEnabled', 'mutatingRoutesEnabled', 'zapiInboundPersistenceAllowed', 'zapiAckPersistenceAllowed']
                        .every(key => field(body, key) === false);
                if (ready) break;
            } catch { /* no effect retry; only the read-only health GET is repeated */ }
            await new Promise(resolve => setTimeout(resolve, 250));
        }
        assert.ok(ready, 'MANUAL_QA_ROLLBACK_SAFE_HEALTH_TIMEOUT');
    } else {
        const response = await fetch('http://127.0.0.1:3001/api/health/', { signal: AbortSignal.timeout(10000) });
        assert.equal(response.status, 200, 'SEALED_ROLLBACK_HEALTH_FAILED');
    }
    return { rollback: 'PASS', predecessor };
}

export async function installSealedPreload(root) {
    const sealed = requireSealedRelease(root);
    const integrationParent=isEcIntegration(sealed)?requireSealedRelease(EC_CUSTOMER.release):null;
    const customerParent=isEcCustomer(sealed)?requireSealedRelease(EC_ORDERS.release):null;
    const ordersParent=isEcOrders(sealed)?requireSealedRelease(EC_TEX_INVITE.release):null;
    const texInviteParent=isEcTexInvite(sealed)?requireSealedRelease(EC_TEX_START.release):null;
    const texStartParent=isEcTexStart(sealed)?requireSealedRelease(EC_NAMED.release):null;
    const namedParent=isEcNamed(sealed)?requireSealedRelease(EC_TEX_ENTRY.release):null;
    const texEntryParent=isEcTexEntry(sealed)?requireSealedRelease(EC_QA_CYCLE.release):null;
    const qaCycleParent=isEcQaCycle(sealed)?requireSealedRelease(EC_MEASURE.release):null;
    const measureParent=isEcMeasure(sealed)?requireSealedRelease(EC_PERIOD.release):null;
    const periodParent=isEcPeriod(sealed)?requireSealedRelease(EC_LINKED.release):null;
    const linkedParent=isEcLinked(sealed)?requireSealedRelease(EC_QA.release):null;
    const qaParent=isEcQa(sealed)?requireSealedRelease(EC_TEX.release):null;
    const texParent=isEcTex(sealed)?requireSealedRelease(EC_PRICE.release):null;
    const priceParent=isEcPrice(sealed)?requireSealedRelease(EC_ACCESS.release):null;
    const accessParent=isEcAccess(sealed)?requireSealedRelease(EC_JOURNEY.release):null;
    const journeyParent=isEcJourney(sealed)?requireSealedRelease(EC_CHAT.release):null;
    const chatParent=isEcChat(sealed)?requireSealedRelease(EC_INVITES.release):null;
    const invitesParent=isEcInvites(sealed)?requireSealedRelease(EC_VOICE.release):null;
    const voiceParent=isEcVoice(sealed)?requireSealedRelease(EC_SALE.release):null;
    const saleParent=isEcSale(sealed)?requireSealedRelease(EC_FIX.release):null;
    const fixParent=isEcFix(sealed)?requireSealedRelease(EC_BURST.release):null;
    const burstParent=isEcBurst(sealed)?requireSealedRelease(EC_INBOUND.release):null;
    const inboundParent=isEcInbound(sealed)?requireSealedRelease(EC_STORE.release):null;
    const storeParent=isEcStore(sealed)?requireSealedRelease(EC_DASHBOARD.release):null;
    const dashboardParent=isEcDashboard(sealed)?requireSealedRelease(EC_CONTEXT.release):null;
    const contextParent=isEcContext(sealed)?requireSealedRelease(EC_RECALL.release):null;
    const recallParent=isEcRecall(sealed)?requireSealedRelease(EC_WEB.release):null;
    const webParent=isEcWeb(sealed)?requireSealedRelease(EC_PRIORITY.release):null;
    const priorityParent=isEcPriority(sealed)?requireSealedRelease(EC_B01.release):null;
    const b01Parent=isEcB01(sealed)?requireSealedRelease(EC_OWNER.release):null;
    const ownerParent=isEcOwner(sealed)?requireSealedRelease(EC_MEASUREMENT.release):null;
    const measurementParent=isEcMeasurement(sealed)?requireSealedRelease(EC_FREEFLOW.release):null;
    const freeflowParent=isEcFreeflow(sealed)?requireSealedRelease(EC_TRACKING.release):null;
    const trackingParent=isEcTracking(sealed)?requireSealedRelease(EC_PREPAID.release):null;
    const prepaidParent=isEcPrepaid(sealed)?requireSealedRelease(EC_AUDIO.release):null;
    const audioParent=isEcAudio(sealed)?requireSealedRelease(EC_REPURCHASE.release):null;
    const handoffParent=isEcRepurchase(sealed)?requireSealedRelease(GIRA_HANDOFF.release):null;
    const bridgeParent=isGiraHandoff(sealed)?requireSealedRelease(GIRA_HANDOFF.parentRelease):null;
    const giraParent=isGiraBridge(sealed)?requireSealedRelease(path.join('/opt/vitalismen-automacao/releases',OPERATIONS_V203.release)):null;
    const operationsParent = (isOperationsV203(sealed)||isGiraBridge(sealed)) ? requireSealedRelease(path.join('/opt/vitalismen-automacao/releases',OPERATIONS_V203.predecessorRelease)) : null;
    const hasDropiListAncestry = isDropiList(sealed) || Boolean(operationsParent);
    // 39701bd contains the frozen observed source and the persistence-order patch.
    // The 227e5f8-only observation loader must not substitute that native source.
    if (!isQaOrder(sealed) && !isHomeOrder(sealed) && !isManualQa(sealed) && !(isManualCommercial(sealed) || hasDropiListAncestry)) installQaClaimObservabilityV1(sealed);
    const descriptorSnapshot = new Map(Object.getOwnPropertyNames(globalThis)
        .filter(k => k.startsWith('__VITALISMEN_')).map(k => [k, Object.getOwnPropertyDescriptor(globalThis, k)]));
    const authorityFile = path.join(BASE_RELEASE, 'scripts/lib/unified-successor-v202-r5-authority.mjs');
    const historicalStat = fs.lstatSync(authorityFile);
    assert.ok(historicalStat.isFile() && !historicalStat.isSymbolicLink()
        && historicalStat.uid === 0 && historicalStat.gid === 0
        && (historicalStat.mode & 0o022) === 0, 'SEALED_HISTORICAL_CODE_UNSAFE');
    assert.equal(sha256(fs.readFileSync(authorityFile)),
        '8c7187f0a142b4077c63fad445914b67c5c36813448ee16301b7e64520e4e206',
        'SEALED_HISTORICAL_CODE_TAMPERED');
    const historical = await import(pathToFileURL(path.join(BASE_RELEASE,
        'scripts/lib/unified-successor-v202-r5-authority.mjs')).href);
    const verified = historical.verifyR5MaterializedRelease(BASE_RELEASE);
    const parentRoot = path.join('/opt/vitalismen-automacao/releases', historical.R5_PARENT_RELEASE);
    const r4 = await import(pathToFileURL(path.join(BASE_RELEASE, 'scripts/lib/unified-successor-v202-r4-authority.mjs')).href);
    const parent = r4.verifyMaterializedRelease(parentRoot);
    const r4Preload = await import(pathToFileURL(path.join(BASE_RELEASE, 'scripts/lib/unified-successor-v202-r4-preload.mjs')).href);
    try {
        const predecessor = sealed.envelope.PURPOSE === 'GOVERNANCE_BOOTSTRAP'
            ? BASE_RELEASE : path.join('/opt/vitalismen-automacao/releases', sealed.envelope.PREDECESSOR_RELEASE);
        const dropiParent = hasDropiListAncestry ? requireSealedRelease(operationsParent ? path.join('/opt/vitalismen-automacao/releases',DROPI_LIST.predecessorRelease) : predecessor) : null;
        const commercialParent = hasDropiListAncestry
            ? requireSealedRelease(path.join('/opt/vitalismen-automacao/releases',MANUAL_COMMERCIAL.predecessorRelease))
            : isManualCommercial(sealed) ? requireSealedRelease(predecessor) : null;
        const manualParent = (isManualCommercial(sealed) || hasDropiListAncestry)
            ? requireSealedRelease(path.join('/opt/vitalismen-automacao/releases', MANUAL_QA.predecessorRelease))
            : isManualQa(sealed) ? requireSealedRelease(predecessor) : null;
        const qaParent = (isManualQa(sealed) || (isManualCommercial(sealed) || hasDropiListAncestry))
            ? requireSealedRelease(path.join('/opt/vitalismen-automacao/releases', HOME_ORDER.predecessorRelease))
            : (isQaOrder(sealed) || isHomeOrder(sealed)) ? requireSealedRelease(predecessor) : null;
        if (sealed.envelope.PURPOSE === 'VIT_SIGNATURE_PATCH') requireSealedRelease(predecessor);
        assert.ok([sealed.root, predecessor].includes(fs.realpathSync('/opt/vitalismen-automacao/current')),
            'SEALED_PREDEPLOY_PARENT_INVALID');
        const homeAncestor = (isHomeOrder(sealed) || isManualQa(sealed) || (isManualCommercial(sealed) || hasDropiListAncestry))
            ? requireSealedRelease(path.join('/opt/vitalismen-automacao/releases', qaParent.envelope.PREDECESSOR_RELEASE)) : null;
        if (homeAncestor) {
            assert.equal(homeAncestor.envelope.PURPOSE, 'VIT_SIGNATURE_PATCH', 'SEALED_HOME_ANCESTOR_PURPOSE_INVALID');
            assert.equal(homeAncestor.authority.SUCCESSOR_COMMIT, qaParent.authority.PREDECESSOR_COMMIT, 'SEALED_HOME_ANCESTOR_COMMIT_INVALID');
            assert.equal(homeAncestor.authority.SUCCESSOR_TREE, qaParent.authority.PREDECESSOR_TREE, 'SEALED_HOME_ANCESTOR_TREE_INVALID');
            for (const file of homeAncestor.authority.ALLOWED_DELTA) {
                // The approved manual delta may replace an inherited file, but
                // its HOME parent must still prove the untouched historical edge.
                const inherited = (isManualQa(sealed) || (isManualCommercial(sealed) || hasDropiListAncestry)) ? manualParent : sealed;
                assert.equal(inherited.envelope.PAYLOAD_HASHES[file], qaParent.envelope.PAYLOAD_HASHES[file], 'SEALED_HOME_INHERITED_PAYLOAD_INVALID:' + file);
                if (isManualQa(sealed) || (isManualCommercial(sealed) || hasDropiListAncestry)) assert.equal(sealed.envelope.PAYLOAD_HASHES[file],
                    (isEcIntegration(sealed)?EC_INTEGRATION.hashes[file]:null)||(isEcCustomer(sealed)?EC_CUSTOMER.hashes[file]:null)||(isEcOrders(sealed)?EC_ORDERS.hashes[file]:null)||(isEcTexInvite(sealed)?EC_TEX_INVITE.hashes[file]:null)||(isEcTexStart(sealed)?EC_TEX_START.hashes[file]:null)||(isEcNamed(sealed)?EC_NAMED.hashes[file]:null)||(isEcTexEntry(sealed)?EC_TEX_ENTRY.hashes[file]:null)||(isEcQaCycle(sealed)?EC_QA_CYCLE.hashes[file]:null)||(isEcMeasure(sealed)?EC_MEASURE.hashes[file]:null)||(isEcPeriod(sealed)?EC_PERIOD.hashes[file]:null)||(isEcLinked(sealed)?EC_LINKED.hashes[file]:null)||(isEcQa(sealed)?EC_QA.hashes[file]:null)||(isEcTex(sealed)?EC_TEX.hashes[file]:null)||(isEcPrice(sealed)?EC_PRICE.hashes[file]:null)||(isEcAccess(sealed)?EC_ACCESS.hashes[file]:null)||(isEcJourney(sealed)?EC_JOURNEY.hashes[file]:null)||(isEcChat(sealed)?EC_CHAT.hashes[file]:null)||(isEcInvites(sealed)?EC_INVITES.hashes[file]:null)||(isEcVoice(sealed)?EC_VOICE.hashes[file]:null)||(isEcSale(sealed)?EC_SALE.hashes[file]:null)||(isEcFix(sealed)?EC_FIX.hashes[file]:null)||(isEcBurst(sealed)?EC_BURST.hashes[file]:null)||(isEcInbound(sealed)?EC_INBOUND.hashes[file]:null)||(isEcStore(sealed)?EC_STORE.hashes[file]:null)||(isEcDashboard(sealed)?EC_DASHBOARD.hashes[file]:null)||(isEcContext(sealed)?EC_CONTEXT.hashes[file]:null)||(isEcRecall(sealed)?EC_RECALL.hashes[file]:null)||(isEcWeb(sealed)?EC_WEB.hashes[file]:null)||(isEcPriority(sealed)?EC_PRIORITY.hashes[file]:null)||(isEcB01(sealed)?EC_B01.hashes[file]:null)||(isEcOwner(sealed)?EC_OWNER.hashes[file]:null)||(isEcMeasurement(sealed)?EC_MEASUREMENT.hashes[file]:null)||(isEcFreeflow(sealed)?EC_FREEFLOW.hashes[file]:null)||(isEcTracking(sealed)?EC_TRACKING.hashes[file]:null)||(isEcPrepaid(sealed)?EC_PREPAID.hashes[file]:null)||(isEcAudio(sealed)?EC_AUDIO.hashes[file]:null)||(isEcRepurchase(sealed)?EC_REPURCHASE.hashes[file]:null)||(isGiraHandoff(sealed)?GIRA_HANDOFF.hashes[file]:null)||(isGiraBridge(sealed)?GIRA_BRIDGE.hashes[file]||OPERATIONS_V203.hashes[file]:null)||(isOperationsV203(sealed) ? OPERATIONS_V203.hashes[file] : null) || DROPI_LIST.hashes[file] || MANUAL_COMMERCIAL.hashes[file] || MANUAL_QA.hashes[file] || inherited.envelope.PAYLOAD_HASHES[file], 'MANUAL_QA_INHERITED_PAYLOAD_INVALID:' + file);
            }
        }
        const paths = [...new Set([...parent.manifest.allowlist.map(e => e.path),
            ...verified.manifest.allowedDeltaPaths, ...GOVERNANCE_PATHS,
            ...(homeAncestor ? homeAncestor.authority.ALLOWED_DELTA : []),
            ...(qaParent ? qaParent.authority.ALLOWED_DELTA : []),
            ...(manualParent ? manualParent.authority.ALLOWED_DELTA : []),
            ...(commercialParent ? commercialParent.authority.ALLOWED_DELTA : []),
            ...(integrationParent?integrationParent.authority.ALLOWED_DELTA:[]), ...(customerParent?customerParent.authority.ALLOWED_DELTA:[]), ...(ordersParent?ordersParent.authority.ALLOWED_DELTA:[]), ...(texInviteParent?texInviteParent.authority.ALLOWED_DELTA:[]), ...(texStartParent?texStartParent.authority.ALLOWED_DELTA:[]), ...(namedParent?namedParent.authority.ALLOWED_DELTA:[]), ...(texEntryParent?texEntryParent.authority.ALLOWED_DELTA:[]), ...(qaCycleParent?qaCycleParent.authority.ALLOWED_DELTA:[]), ...(measureParent?measureParent.authority.ALLOWED_DELTA:[]), ...(periodParent?periodParent.authority.ALLOWED_DELTA:[]), ...(linkedParent?linkedParent.authority.ALLOWED_DELTA:[]), ...(qaParent?qaParent.authority.ALLOWED_DELTA:[]), ...(texParent?texParent.authority.ALLOWED_DELTA:[]), ...(priceParent?priceParent.authority.ALLOWED_DELTA:[]), ...(accessParent?accessParent.authority.ALLOWED_DELTA:[]), ...(journeyParent?journeyParent.authority.ALLOWED_DELTA:[]), ...(chatParent?chatParent.authority.ALLOWED_DELTA:[]), ...(invitesParent?invitesParent.authority.ALLOWED_DELTA:[]), ...(voiceParent?voiceParent.authority.ALLOWED_DELTA:[]), ...(saleParent?saleParent.authority.ALLOWED_DELTA:[]), ...(fixParent?fixParent.authority.ALLOWED_DELTA:[]), ...(burstParent?burstParent.authority.ALLOWED_DELTA:[]), ...(inboundParent?inboundParent.authority.ALLOWED_DELTA:[]), ...(storeParent?storeParent.authority.ALLOWED_DELTA:[]), ...(dashboardParent?dashboardParent.authority.ALLOWED_DELTA:[]), ...(contextParent?contextParent.authority.ALLOWED_DELTA:[]), ...(recallParent?recallParent.authority.ALLOWED_DELTA:[]), ...(webParent?webParent.authority.ALLOWED_DELTA:[]), ...(priorityParent?priorityParent.authority.ALLOWED_DELTA:[]), ...(b01Parent?b01Parent.authority.ALLOWED_DELTA:[]), ...(ownerParent?ownerParent.authority.ALLOWED_DELTA:[]), ...(measurementParent?measurementParent.authority.ALLOWED_DELTA:[]), ...(freeflowParent?freeflowParent.authority.ALLOWED_DELTA:[]), ...(trackingParent?trackingParent.authority.ALLOWED_DELTA:[]), ...(prepaidParent?prepaidParent.authority.ALLOWED_DELTA:[]), ...(audioParent?audioParent.authority.ALLOWED_DELTA:[]), ...(handoffParent?handoffParent.authority.ALLOWED_DELTA:[]), ...(bridgeParent?bridgeParent.authority.ALLOWED_DELTA:[]), ...(giraParent?giraParent.authority.ALLOWED_DELTA:[]), ...(operationsParent ? operationsParent.authority.ALLOWED_DELTA : []), ...(dropiParent ? dropiParent.authority.ALLOWED_DELTA : []), ...sealed.authority.ALLOWED_DELTA])];
        globalThis.__VITALISMEN_SUCCESSOR_OVERRIDE_FILES = Object.freeze(paths);
        const contextKey = '__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT';
        const manifestSha256 = 'ae23ce682d3c7b2f3de42e6e8074e2c43a6365458b2ba861657a940d4041272c';
        const freezeId = 'EC_RUNTIME_GUARD_BASELINE_BOOTSTRAP_V168B_20260916';
        assert.equal(sealed.envelope.PAYLOAD_HASHES['docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json'],
            manifestSha256, 'SEALED_STAGE_CONTEXT_MANIFEST_INVALID');
        const validateContext = value => {
            assert.ok(value && Object.isFrozen(value), 'SEALED_STAGE_CONTEXT_UNKNOWN');
            assert.deepEqual(Object.keys(value).sort(), ['freezeId', 'loaded', 'manifestSha256', 'protectedFiles'],
                'SEALED_STAGE_CONTEXT_UNKNOWN');
            for (const key of Object.keys(value)) assert.ok(
                Object.hasOwn(Object.getOwnPropertyDescriptor(value, key), 'value'), 'SEALED_STAGE_CONTEXT_UNKNOWN');
            assert.ok(value.loaded === true && value.freezeId === freezeId
                && value.manifestSha256 === manifestSha256 && value.protectedFiles
                && !Array.isArray(value.protectedFiles) && Object.isFrozen(value.protectedFiles),
                'SEALED_STAGE_CONTEXT_UNKNOWN');
            return value;
        };
        const prior = Object.getOwnPropertyDescriptor(globalThis, contextKey);
        if (prior) assert.ok(Object.hasOwn(prior, 'value') && prior.configurable && prior.enumerable && prior.writable,
            'SEALED_STAGE_CONTEXT_DESCRIPTOR_INVALID');
        // Retain the bootstrap identity while the immutable historical preload runs.
        // No missing identity is manufactured; the first publication must be complete.
        let sourceContext = prior ? validateContext(prior.value) : null;
        let historicalContext = sourceContext;
        Object.defineProperty(globalThis, contextKey, { configurable: true, enumerable: true,
            get: () => historicalContext,
            set(value) {
                if (!sourceContext) sourceContext = validateContext(value);
                else {
                    assert.ok(value?.loaded === true && value.freezeId === freezeId
                        && value.protectedFiles && Object.isFrozen(value), 'SEALED_STAGE_CONTEXT_UNKNOWN');
                    if (Object.hasOwn(value, 'manifestSha256')) validateContext(value);
                }
                historicalContext = value;
            }
        });
        await import(pathToFileURL(path.join(parent.historicalRoot,
            'scripts/lib/ec-runtime-successor-v199-context.mjs')).href);
        validateContext(sourceContext);
        const v195 = r4Preload.assertR4StartupSuccessorIdentity(parent, parentRoot);
        const protectedFiles = { ...v195.protectedFiles, ...verified.attestation.changedFileHashes };
        for (const p of paths) if (sealed.envelope.PAYLOAD_HASHES[p]) protectedFiles[p] = sealed.envelope.PAYLOAD_HASHES[p];
        globalThis.__VITALISMEN_V195_META_CANONICAL_PRELOAD = Object.freeze({ ...v195,
            protectedFiles: Object.freeze(protectedFiles), authorizedFiles: Object.freeze(Object.keys(protectedFiles)) });
        // Execute only the registered successor's corrected preload, consuming the
        // exact retained bootstrap object, with the original data descriptor.
        // This map comes only from the verified bootstrap and R4/V195 origins,
        // with the already registered successor payload overlays above.
        const authenticatedProtectedFiles = Object.freeze({ ...sourceContext.protectedFiles, ...protectedFiles });
        for (const [file, digest] of Object.entries(authenticatedProtectedFiles)) {
            assert.equal(digest, sealed.envelope.PAYLOAD_HASHES[file], 'SEALED_CONTEXT_ORIGIN_HASH_INVALID:' + file);
        }
        const authenticatedSourceContext = Object.freeze({ ...sourceContext, protectedFiles: authenticatedProtectedFiles });
        Object.defineProperty(globalThis, contextKey, { configurable: true, enumerable: true,
            writable: true, value: authenticatedSourceContext });
        await import(pathToFileURL(path.join(sealed.root,
            'scripts/lib/ec-runtime-successor-v168b-preload-context.mjs')).href);
        const propagated = Object.getOwnPropertyDescriptor(globalThis, contextKey);
        assert.ok(propagated?.configurable && propagated.enumerable && propagated.writable
            && Object.hasOwn(propagated, 'value'), 'SEALED_STAGE_CONTEXT_DESCRIPTOR_INVALID');
        validateContext(propagated.value);
        if (['GOVERNANCE_BOOTSTRAP', 'VIT_SIGNATURE_PATCH', QA_ORDER.purpose, HOME_ORDER.purpose, MANUAL_QA.purpose, MANUAL_COMMERCIAL.purpose, DROPI_LIST.purpose, OPERATIONS_V203.purpose, GIRA_BRIDGE.purpose, GIRA_HANDOFF.purpose, EC_REPURCHASE.purpose, EC_AUDIO.purpose, EC_PREPAID.purpose, EC_TRACKING.purpose, EC_FREEFLOW.purpose, EC_MEASUREMENT.purpose, EC_OWNER.purpose, EC_B01.purpose, EC_PRIORITY.purpose, EC_WEB.purpose, EC_RECALL.purpose, EC_CONTEXT.purpose, EC_DASHBOARD.purpose, EC_STORE.purpose, EC_INBOUND.purpose, EC_BURST.purpose, EC_FIX.purpose, EC_SALE.purpose, EC_VOICE.purpose, EC_INVITES.purpose, EC_CHAT.purpose, EC_JOURNEY.purpose, EC_ACCESS.purpose, EC_PRICE.purpose, EC_TEX.purpose, EC_QA.purpose, EC_LINKED.purpose, EC_PERIOD.purpose, EC_MEASURE.purpose, EC_QA_CYCLE.purpose, EC_TEX_ENTRY.purpose, EC_NAMED.purpose, EC_TEX_START.purpose, EC_TEX_INVITE.purpose, EC_ORDERS.purpose, EC_CUSTOMER.purpose, EC_INTEGRATION.purpose].includes(sealed.envelope.PURPOSE)) {
            const stagePath = 'ops/vitalismen-stage';
            const contextKey = '__VITALISMEN_V168B_BASELINE_BOOTSTRAP_CONTEXT';
            const manifestPath = 'docs/freeze/ec-runtime-guard-baseline-bootstrap-v168b-20260916.json';
            const manifestBytes = fs.readFileSync(path.join(sealed.root, manifestPath));
            const manifestSha256 = sourceContext.manifestSha256;
            assert.equal(manifestSha256, sealed.envelope.PAYLOAD_HASHES[manifestPath],
                'SEALED_STAGE_CONTEXT_MANIFEST_INVALID');
            const manifest = JSON.parse(manifestBytes.toString('utf8'));
            // Vit inherits this unchanged file from its exact registered predecessor.
            // It is not a functional delta in the Vit authority.
            const vit = sealed.envelope.PURPOSE === 'VIT_SIGNATURE_PATCH' || isQaOrder(sealed) || isHomeOrder(sealed) || isManualQa(sealed) || (isManualCommercial(sealed) || hasDropiListAncestry);
            const stageParent = vit ? requireSealedRelease(predecessor) : null;
            const validateStageParent = parent => {
                if(isEcIntegration(sealed)){
                    assert.equal(parent.authoritySha256,EC_INTEGRATION.parentSeal);assert.equal(parent.root,EC_INTEGRATION.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_CUSTOMER.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_CUSTOMER.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcCustomer(sealed)){
                    assert.equal(parent.authoritySha256,EC_CUSTOMER.parentSeal);assert.equal(parent.root,EC_CUSTOMER.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_ORDERS.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_ORDERS.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcOrders(sealed)){
                    assert.equal(parent.authoritySha256,EC_ORDERS.parentSeal);assert.equal(parent.root,EC_ORDERS.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_TEX_INVITE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_TEX_INVITE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcTexInvite(sealed)){
                    assert.equal(parent.authoritySha256,EC_TEX_INVITE.parentSeal);assert.equal(parent.root,EC_TEX_INVITE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_TEX_START.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_TEX_START.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcTexStart(sealed)){
                    assert.equal(parent.authoritySha256,EC_TEX_START.parentSeal);assert.equal(parent.root,EC_TEX_START.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_NAMED.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_NAMED.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcNamed(sealed)){
                    assert.equal(parent.authoritySha256,EC_NAMED.parentSeal);assert.equal(parent.root,EC_NAMED.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_TEX_ENTRY.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_TEX_ENTRY.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcTexEntry(sealed)){
                    assert.equal(parent.authoritySha256,EC_TEX_ENTRY.parentSeal);assert.equal(parent.root,EC_TEX_ENTRY.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_QA_CYCLE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_QA_CYCLE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcQaCycle(sealed)){
                    assert.equal(parent.authoritySha256,EC_QA_CYCLE.parentSeal);assert.equal(parent.root,EC_QA_CYCLE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_MEASURE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_MEASURE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcMeasure(sealed)){
                    assert.equal(parent.authoritySha256,EC_MEASURE.parentSeal);assert.equal(parent.root,EC_MEASURE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_PERIOD.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_PERIOD.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcPeriod(sealed)){
                    assert.equal(parent.authoritySha256,EC_PERIOD.parentSeal);assert.equal(parent.root,EC_PERIOD.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_LINKED.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_LINKED.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcLinked(sealed)){
                    assert.equal(parent.authoritySha256,EC_LINKED.parentSeal);assert.equal(parent.root,EC_LINKED.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_QA.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_QA.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcQa(sealed)){
                    assert.equal(parent.authoritySha256,EC_QA.parentSeal);assert.equal(parent.root,EC_QA.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_TEX.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_TEX.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcTex(sealed)){
                    assert.equal(parent.authoritySha256,EC_TEX.parentSeal);assert.equal(parent.root,EC_TEX.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_PRICE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_PRICE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcPrice(sealed)){
                    assert.equal(parent.authoritySha256,EC_PRICE.parentSeal);assert.equal(parent.root,EC_PRICE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_ACCESS.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_ACCESS.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcAccess(sealed)){
                    assert.equal(parent.authoritySha256,EC_ACCESS.parentSeal);assert.equal(parent.root,EC_ACCESS.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_JOURNEY.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_JOURNEY.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcJourney(sealed)){
                    assert.equal(parent.authoritySha256,EC_JOURNEY.parentSeal);assert.equal(parent.root,EC_JOURNEY.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_CHAT.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_CHAT.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcChat(sealed)){
                    assert.equal(parent.authoritySha256,EC_CHAT.parentSeal);assert.equal(parent.root,EC_CHAT.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_INVITES.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_INVITES.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcInvites(sealed)){
                    assert.equal(parent.authoritySha256,EC_INVITES.parentSeal);assert.equal(parent.root,EC_INVITES.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_VOICE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_VOICE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcVoice(sealed)){
                    assert.equal(parent.authoritySha256,EC_VOICE.parentSeal);assert.equal(parent.root,EC_VOICE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_SALE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_SALE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcSale(sealed)){
                    assert.equal(parent.authoritySha256,EC_SALE.parentSeal);assert.equal(parent.root,EC_SALE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_FIX.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_FIX.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcFix(sealed)){
                    assert.equal(parent.authoritySha256,EC_FIX.parentSeal);assert.equal(parent.root,EC_FIX.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_BURST.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_BURST.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcBurst(sealed)){
                    assert.equal(parent.authoritySha256,EC_BURST.parentSeal);assert.equal(parent.root,EC_BURST.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_INBOUND.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_INBOUND.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcInbound(sealed)){
                    assert.equal(parent.authoritySha256,EC_INBOUND.parentSeal);assert.equal(parent.root,EC_INBOUND.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_STORE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_STORE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcStore(sealed)){
                    assert.equal(parent.authoritySha256,EC_STORE.parentSeal);assert.equal(parent.root,EC_STORE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_DASHBOARD.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_DASHBOARD.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcDashboard(sealed)){
                    assert.equal(parent.authoritySha256,EC_DASHBOARD.parentSeal);assert.equal(parent.root,EC_DASHBOARD.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_CONTEXT.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_CONTEXT.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcContext(sealed)){
                    assert.equal(parent.authoritySha256,EC_CONTEXT.parentSeal);assert.equal(parent.root,EC_CONTEXT.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_RECALL.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_RECALL.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcRecall(sealed)){
                    assert.equal(parent.authoritySha256,EC_RECALL.parentSeal);assert.equal(parent.root,EC_RECALL.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_WEB.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_WEB.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcWeb(sealed)){
                    assert.equal(parent.authoritySha256,EC_WEB.parentSeal);assert.equal(parent.root,EC_WEB.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_PRIORITY.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_PRIORITY.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcPriority(sealed)){
                    assert.equal(parent.authoritySha256,EC_PRIORITY.parentSeal);assert.equal(parent.root,EC_PRIORITY.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_B01.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_B01.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcB01(sealed)){
                    assert.equal(parent.authoritySha256,EC_B01.parentSeal);assert.equal(parent.root,EC_B01.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_OWNER.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_OWNER.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcOwner(sealed)){
                    assert.equal(parent.authoritySha256,EC_OWNER.parentSeal);assert.equal(parent.root,EC_OWNER.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_MEASUREMENT.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_MEASUREMENT.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcMeasurement(sealed)){
                    assert.equal(parent.authoritySha256,EC_MEASUREMENT.parentSeal);assert.equal(parent.root,EC_MEASUREMENT.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_FREEFLOW.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_FREEFLOW.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcFreeflow(sealed)){
                    assert.equal(parent.authoritySha256,EC_FREEFLOW.parentSeal);assert.equal(parent.root,EC_FREEFLOW.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_TRACKING.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_TRACKING.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcTracking(sealed)){
                    assert.equal(parent.authoritySha256,EC_TRACKING.parentSeal);assert.equal(parent.root,EC_TRACKING.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_PREPAID.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_PREPAID.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcPrepaid(sealed)){
                    assert.equal(parent.authoritySha256,EC_PREPAID.parentSeal);assert.equal(parent.root,EC_PREPAID.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_AUDIO.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_AUDIO.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcAudio(sealed)){
                    assert.equal(parent.authoritySha256,EC_AUDIO.parentSeal);assert.equal(parent.root,EC_AUDIO.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,EC_REPURCHASE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,EC_REPURCHASE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isEcRepurchase(sealed)){
                    assert.equal(parent.authoritySha256,EC_REPURCHASE.parentSeal);assert.equal(parent.root,EC_REPURCHASE.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,GIRA_HANDOFF.successor);assert.equal(parent.authority.SUCCESSOR_TREE,GIRA_HANDOFF.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isGiraHandoff(sealed)){
                    assert.equal(parent.authoritySha256,GIRA_HANDOFF.parentSeal);assert.equal(parent.root,GIRA_HANDOFF.parentRelease);
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,GIRA_BRIDGE.successor);assert.equal(parent.authority.SUCCESSOR_TREE,GIRA_BRIDGE.tree);
                    const digest=parent.envelope.PAYLOAD_HASHES[stagePath];assert.equal(digest,GIRA_BRIDGE.hashes[stagePath]);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),digest);return digest;
                }
                if(isGiraBridge(sealed)){
                    assert.equal(parent.authoritySha256,GIRA_BRIDGE.parentSeal);assert.equal(parent.root,path.join('/opt/vitalismen-automacao/releases',OPERATIONS_V203.release));
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,OPERATIONS_V203.successor);assert.equal(parent.authority.SUCCESSOR_TREE,OPERATIONS_V203.tree);
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath],'1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f');
                    const childDigest=GIRA_BRIDGE.hashes[stagePath];assert.ok(childDigest);assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],childDigest);assert.equal(sha256(fs.readFileSync(path.join(sealed.root,stagePath))),childDigest);return childDigest;
                }
                if(isOperationsV203(sealed)||isGiraBridge(sealed)){
                    assert.equal(parent.authoritySha256,OPERATIONS_V203.parentSeal);
                    assert.equal(parent.root,path.join('/opt/vitalismen-automacao/releases',OPERATIONS_V203.predecessorRelease));
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,DROPI_LIST.successor);
                    assert.equal(parent.authority.SUCCESSOR_TREE,DROPI_LIST.tree);
                    const digest='1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f';
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath],digest);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);
                    assert.equal(sha256(fs.readFileSync(path.join(parent.root,stagePath))),digest);return digest;
                }
                if (hasDropiListAncestry) {
                    assert.equal(parent.authoritySha256,DROPI_LIST.parentSeal);
                    assert.equal(parent.root,path.join('/opt/vitalismen-automacao/releases',DROPI_LIST.predecessorRelease));
                    assert.equal(parent.authority.SUCCESSOR_COMMIT,MANUAL_COMMERCIAL.successor);
                    assert.equal(parent.authority.SUCCESSOR_TREE,MANUAL_COMMERCIAL.tree);
                    const digest='1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f';
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath],digest);assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath],digest);
                    assert.equal(sha256(fs.readFileSync(path.join(parent.root,stagePath))),digest);return digest;
                }
                if ((isManualCommercial(sealed) || hasDropiListAncestry)) {
                    assert.equal(parent.authoritySha256, MANUAL_COMMERCIAL.parentSeal);
                    assert.equal(parent.root, path.join('/opt/vitalismen-automacao/releases', MANUAL_COMMERCIAL.predecessorRelease));
                    assert.equal(parent.authority.SUCCESSOR_COMMIT, MANUAL_QA.successor);
                    assert.equal(parent.authority.SUCCESSOR_TREE, MANUAL_QA.tree);
                    const digest = '1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f';
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath], digest);
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath], digest);
                    assert.equal(sha256(fs.readFileSync(path.join(parent.root, stagePath))), digest);
                    return digest;
                }
                if (isManualQa(sealed)) {
                    assert.equal(parent.authoritySha256, MANUAL_QA.parentSeal, 'MANUAL_QA_STAGE_PARENT_INVALID');
                    assert.equal(parent.root, path.join('/opt/vitalismen-automacao/releases', MANUAL_QA.predecessorRelease), 'MANUAL_QA_STAGE_PARENT_ROOT_INVALID');
                    assert.equal(parent.authority.SUCCESSOR_COMMIT, HOME_ORDER.successor, 'MANUAL_QA_STAGE_PARENT_COMMIT_INVALID');
                    assert.equal(parent.authority.SUCCESSOR_TREE, HOME_ORDER.tree, 'MANUAL_QA_STAGE_PARENT_TREE_INVALID');
                    assert.equal(sealed.authority.SUCCESSOR_COMMIT, MANUAL_QA.successor);
                    assert.equal(sealed.authority.SUCCESSOR_TREE, MANUAL_QA.tree);
                    const digest = '1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f';
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath], digest, 'MANUAL_QA_STAGE_PARENT_HASH_INVALID');
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath], digest, 'MANUAL_QA_STAGE_HASH_INVALID');
                    assert.equal(sha256(fs.readFileSync(path.join(parent.root, stagePath))), digest, 'MANUAL_QA_STAGE_HASH_INVALID');
                    return digest;
                }
                if (isHomeOrder(sealed)) {
                    assert.equal(parent.authoritySha256, QA_ORDER.seal, 'SEALED_HOME_STAGE_PARENT_INVALID');
                    assert.equal(parent.root, path.join('/opt/vitalismen-automacao/releases', HOME_ORDER.predecessorRelease), 'SEALED_HOME_STAGE_PARENT_INVALID');
                    assert.equal(parent.authority.SUCCESSOR_COMMIT, QA_ORDER.successor, 'SEALED_HOME_STAGE_PARENT_INVALID');
                    assert.equal(parent.authority.SUCCESSOR_TREE, QA_ORDER.tree, 'SEALED_HOME_STAGE_PARENT_INVALID');
                    assert.equal(sealed.authority.SUCCESSOR_COMMIT, HOME_ORDER.successor, 'SEALED_HOME_SUCCESSOR_INVALID');
                    assert.equal(sealed.authority.SUCCESSOR_TREE, HOME_ORDER.tree, 'SEALED_HOME_TREE_INVALID');
                    const digest = '1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f';
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath], digest, 'SEALED_HOME_STAGE_HASH_INVALID');
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath], digest, 'SEALED_HOME_STAGE_HASH_INVALID');
                    assert.equal(sha256(fs.readFileSync(path.join(parent.root, stagePath))), digest, 'SEALED_HOME_STAGE_HASH_INVALID');
                    return digest;
                }
                if (isQaOrder(sealed)) {
                    assert.equal(parent.authoritySha256, QA_ORDER.parentSeal, 'SEALED_QA_ORDER_STAGE_PARENT_INVALID');
                    assert.equal(parent.root, path.join('/opt/vitalismen-automacao/releases', QA_ORDER.predecessorRelease),
                        'SEALED_QA_ORDER_STAGE_PARENT_INVALID');
                    assert.equal(sealed.authority.SUCCESSOR_COMMIT, QA_ORDER.successor, 'SEALED_QA_ORDER_SUCCESSOR_INVALID');
                    assert.equal(sealed.authority.SUCCESSOR_TREE, QA_ORDER.tree, 'SEALED_QA_ORDER_TREE_INVALID');
                    const digest = '1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f';
                    assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath], digest, 'SEALED_QA_ORDER_STAGE_HASH_INVALID');
                    assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath], digest, 'SEALED_QA_ORDER_STAGE_HASH_INVALID');
                    assert.equal(sha256(fs.readFileSync(path.join(parent.root, stagePath))), digest,
                        'SEALED_QA_ORDER_STAGE_HASH_INVALID');
                    return digest;
                }
                assert.equal(parent.envelope.PURPOSE, 'GOVERNANCE_BOOTSTRAP', 'SEALED_VIT_STAGE_PARENT_INVALID');
                assert.equal(parent.authority.SUCCESSOR_COMMIT,
                    'bb17ea5a119bc923cefc98173e9ce2206b8324e5', 'SEALED_VIT_STAGE_PARENT_INVALID');
                assert.equal(parent.authority.SUCCESSOR_TREE,
                    'd1be9053d015abd067a24f0bb9d58e295c3cbeb7', 'SEALED_VIT_STAGE_PARENT_INVALID');
                assert.equal(parent.root, '/opt/vitalismen-automacao/releases/20261004T000000Z_production-20261004-bb17ea5',
                    'SEALED_VIT_STAGE_PARENT_INVALID');
                assert.equal(sealed.authority.SUCCESSOR_COMMIT,
                    '227e5f864348595408762dad6b5b6a41b41d5fca', 'SEALED_VIT_STAGE_SUCCESSOR_INVALID');
                assert.equal(sealed.authority.SUCCESSOR_TREE,
                    'eb573f0b21ef1152c3cbfb5afe981c15a558c10c', 'SEALED_VIT_STAGE_SUCCESSOR_INVALID');
                assert.equal(sealed.root, '/opt/vitalismen-automacao/releases/20261004T010000Z_production-20261004-227e5f8',
                    'SEALED_VIT_STAGE_SUCCESSOR_INVALID');
                assert.equal(sealed.authority.PREDECESSOR_COMMIT, parent.authority.SUCCESSOR_COMMIT,
                    'SEALED_VIT_STAGE_PARENT_INVALID');
                assert.equal(sealed.authority.PREDECESSOR_TREE, parent.authority.SUCCESSOR_TREE,
                    'SEALED_VIT_STAGE_PARENT_INVALID');
                assert.ok(!sealed.authority.ALLOWED_DELTA.includes(stagePath)
                    && !Object.hasOwn(sealed.authority.FILE_HASHES, stagePath), 'SEALED_VIT_STAGE_DELTA_INVALID');
                const digest = parent.authority.FILE_HASHES[stagePath];
                assert.equal(digest, '1bedb3615e0dcdaeed83b6f7d548880ca95af4005580225095bad7415eba217f',
                    'SEALED_VIT_STAGE_HASH_INVALID');
                assert.equal(parent.envelope.PAYLOAD_HASHES[stagePath], digest, 'SEALED_VIT_STAGE_HASH_INVALID');
                assert.equal(sealed.envelope.PAYLOAD_HASHES[stagePath], digest, 'SEALED_VIT_STAGE_HASH_INVALID');
                assert.equal(sha256(fs.readFileSync(path.join(parent.root, stagePath))), digest,
                    'SEALED_VIT_STAGE_HASH_INVALID');
                return digest;
            };
            const stageHash = vit ? validateStageParent(stageParent) : sealed.authority.FILE_HASHES[stagePath];
            assert.match(stageHash, SHA256, 'SEALED_STAGE_HASH_ABSENT');
            assert.equal(stageHash, sealed.envelope.PAYLOAD_HASHES[stagePath],
                'SEALED_STAGE_HASH_INVALID');
            const descriptor = Object.getOwnPropertyDescriptor(globalThis, contextKey);
            assert.ok(descriptor?.configurable && descriptor.writable
                && Object.hasOwn(descriptor, 'value'), 'SEALED_STAGE_CONTEXT_DESCRIPTOR_INVALID');
            const bindStage = value => {
                validateContext(value);
                assert.ok(value?.loaded === true && value.freezeId === manifest.freezeId
                    && value.manifestSha256 === manifestSha256
                    && value.protectedFiles && typeof value.protectedFiles === 'object'
                    && !Array.isArray(value.protectedFiles), 'SEALED_STAGE_CONTEXT_UNKNOWN');
                // Incoming republications cannot authorize entries or replace this
                // complete retained origin with a filtered or partial map.
                for (const file of Object.keys(value.protectedFiles)) {
                    const field = Object.getOwnPropertyDescriptor(value.protectedFiles, file);
                    assert.ok(Object.hasOwn(field, 'value') && Object.hasOwn(authenticatedProtectedFiles, file),
                        'SEALED_CONTEXT_ENTRY_UNAUTHORIZED:' + file);
                    const allowedStage = file === stagePath && field.value === sourceContext.protectedFiles[stagePath];
                    assert.ok(field.value === authenticatedProtectedFiles[file] || allowedStage,
                        'SEALED_CONTEXT_HASH_DIVERGENT:' + file);
                }
                // Re-read the root-owned registration on every legitimate republication.
                // Neither a global flag nor a replaced context can authorize a new identity.
                const current = requireSealedRelease(sealed.root);
                assert.equal(current.authoritySha256, sealed.authoritySha256,
                    'SEALED_STAGE_AUTHORITY_CHANGED');
                assert.deepEqual(current.authority, sealed.authority,
                    'SEALED_STAGE_AUTHORITY_CHANGED');
                if (vit) {
                    const parent = requireSealedRelease(predecessor);
                    assert.equal(parent.authoritySha256, stageParent.authoritySha256, 'SEALED_VIT_STAGE_PARENT_CHANGED');
                    assert.deepEqual(parent.authority, stageParent.authority, 'SEALED_VIT_STAGE_PARENT_CHANGED');
                    assert.equal(validateStageParent(parent), stageHash, 'SEALED_VIT_STAGE_HASH_INVALID');
                } else assert.equal(current.authority.FILE_HASHES[stagePath], stageHash,
                    'SEALED_STAGE_HASH_INVALID');
                assert.equal(sha256(fs.readFileSync(path.join(sealed.root, stagePath))), stageHash,
                    'SEALED_STAGE_HASH_INVALID');
                return Object.freeze({ ...value,
                    protectedFiles: authenticatedProtectedFiles });
            };
            let stageContext = bindStage(descriptor.value);
            Object.defineProperty(globalThis, contextKey, {
                configurable: true, enumerable: descriptor.enumerable,
                get: () => stageContext,
                set(value) { stageContext = bindStage(value); }
            });
        }
        // A child V170 publication otherwise replaces its authorized-file list
        // with the historical list before V168B reads it. Preserve the complete
        // original publication and bind the exact registered successor overlay.
        if(isOperationsV203(sealed)||isGiraBridge(sealed)){
            const key='__VITALISMEN_V170_PRETRAFFIC_FINAL_CONTEXT';
            // Obtain the original complete identity from the unchanged, verified
            // V170 module before binding its descendant overlay.
            await import(pathToFileURL(path.join(sealed.root,'scripts/lib/ec-runtime-successor-v170-context.mjs')).href);
            const desc=Object.getOwnPropertyDescriptor(globalThis,key), base=globalThis[key];
            assert.ok(desc?.configurable&&(desc.writable||typeof desc.get==='function'&&typeof desc.set==='function')&&base?.loaded===true&&Object.isFrozen(base),'OP203_V170_SOURCE_REQUIRED');
            assert.equal(base.freezeId,'EC_PRETRAFFIC_FINAL_RESTORATION_V170_20260916');
            assert.equal(base.manifestSha256,sha256(fs.readFileSync(path.join(sealed.root,'docs/freeze/ec-pretraffic-final-restoration-v170-20260916.json'))));
            const bind=value=>{
                assert.ok(value&&Object.isFrozen(value),'OP203_V170_PUBLICATION');
                assert.deepEqual(Object.keys(value).sort(),Object.keys(base).sort(),'OP203_V170_SCHEMA');
                for(const k of Object.keys(base))if(!['protectedFiles','authorizedFiles'].includes(k))assert.deepEqual(value[k],base[k],'OP203_V170_IDENTITY:'+k);
                assert.deepEqual(value.authorizedFiles,base.authorizedFiles,'OP203_V170_ORIGIN_FILES');
                assert.deepEqual(value.protectedFiles,base.protectedFiles,'OP203_V170_ORIGIN_HASHES');
                const hashes={...value.protectedFiles};
                for(const p of new Set([...paths,...Object.keys(base.protectedFiles)])){assert.ok(sealed.envelope.PAYLOAD_HASHES[p],'OP203_OVERLAY_SOURCE:'+p);hashes[p]=sealed.envelope.PAYLOAD_HASHES[p];}
                for(const[p,digest]of Object.entries(hashes))assert.equal(digest,sealed.envelope.PAYLOAD_HASHES[p],'OP203_COMPLETE_CONTEXT:'+p);
                return Object.freeze({...value,protectedFiles:Object.freeze(hashes),authorizedFiles:Object.freeze([...new Set([...value.authorizedFiles,...paths])])});
            };
            let current=bind(base);
            Object.defineProperty(globalThis,key,{configurable:true,enumerable:desc.enumerable,get:()=>current,set:value=>{
                if(typeof desc.set==='function'){desc.set.call(globalThis,value);current=bind(desc.get.call(globalThis));}
                else current=bind(value);
            }});
            globalThis[isGiraBridge(sealed)?'__VITALISMEN_GIRA_BRIDGE_CONTEXT_PROPAGATION':'__VITALISMEN_V203_CONTEXT_PROPAGATION']=Object.freeze({loaded:true,commit:sealed.authority.SUCCESSOR_COMMIT,authoritySha256:sealed.authoritySha256,sourceManifestSha256:base.manifestSha256,registeredPaths:Object.freeze([...paths])});
            // Retain the complete V168B publication emitted by the verified
            // bootstrap. A later historical module publishes a filtered map;
            // consumers such as V101 still require the complete browser identity.
            const dropiKey='__VITALISMEN_V168B_DROPI_STATUS_CONTEXT';
            const dropiDesc=Object.getOwnPropertyDescriptor(globalThis,dropiKey),dropiSource=globalThis[dropiKey];
            const manifestPath=path.join(sealed.root,'docs/freeze/ec-dropi-pickup-status-sync-v168b-20260916.json');
            const manifestBytes=fs.readFileSync(manifestPath),dropiManifest=JSON.parse(manifestBytes);
            assert.ok(dropiDesc?.configurable&&dropiSource?.loaded===true&&Object.isFrozen(dropiSource),'OP203_V168_COMPLETE_SOURCE_REQUIRED');
            assert.equal(dropiSource.freezeId,dropiManifest.freezeId);
            assert.deepEqual(Object.keys(dropiSource.protectedFiles).sort(),Object.keys(dropiManifest.protectedFiles).sort(),'OP203_V168_COMPLETE_SOURCE_KEYS');
            const completeHashes=Object.freeze(Object.fromEntries(Object.keys(dropiSource.protectedFiles).map(p=>{
                assert.ok(sealed.envelope.PAYLOAD_HASHES[p],'OP203_V168_SOURCE_ORIGIN:'+p);
                return[p,sealed.envelope.PAYLOAD_HASHES[p]];
            })));
            const validateDropiPublication=value=>{
                assert.ok(value&&Object.isFrozen(value)&&value.loaded===true,'OP203_V168_PUBLICATION');
                assert.equal(value.freezeId,dropiSource.freezeId,'OP203_V168_IDENTITY');
                const keys=Object.keys(value).sort();
                assert.deepEqual(keys,(Object.hasOwn(value,'manifestSha256')?['loaded','freezeId','protectedFiles','manifestSha256']:['loaded','freezeId','protectedFiles']).sort(),'OP203_V168_SCHEMA');
                if(Object.hasOwn(value,'manifestSha256')){
                    assert.equal(value.manifestSha256,sha256(manifestBytes),'OP203_V168_MANIFEST');
                    const later=new Set(globalThis[key].authorizedFiles);
                    const expected=Object.fromEntries(Object.entries(dropiManifest.protectedFiles).filter(([p])=>!later.has(p)));
                    assert.deepEqual(value.protectedFiles,expected,'OP203_V168_FILTERED_SOURCE');
                }else{
                    assert.deepEqual(Object.keys(value.protectedFiles).sort(),Object.keys(completeHashes).sort(),'OP203_V168_BOOTSTRAP_KEYS');
                    for(const[p,digest]of Object.entries(value.protectedFiles))assert.ok([dropiManifest.protectedFiles[p],dropiSource.protectedFiles[p],completeHashes[p]].includes(digest),'OP203_V168_BOOTSTRAP_ORIGIN:'+p);
                }
                return value;
            };
            let completeDropi=Object.freeze({...dropiSource,protectedFiles:completeHashes});
            Object.defineProperty(globalThis,dropiKey,{configurable:true,enumerable:dropiDesc.enumerable,get:()=>completeDropi,set:value=>{
                validateDropiPublication(value);
                if(typeof dropiDesc.set==='function')dropiDesc.set.call(globalThis,value);
                const accepted=typeof dropiDesc.get==='function'?dropiDesc.get.call(globalThis):value;
                assert.equal(accepted.freezeId,dropiSource.freezeId,'OP203_V168_PARENT_IDENTITY');
                // Preserve the publisher's filtering for historical integration
                // contracts; only V101's browser identity receives this exact
                // successor overlay. The complete source remains available with
                // separate provenance instead of being relabelled historical.
                const browser='src/services/droppiEcuadorBrowserService.js';
                assert.equal(completeHashes[browser],isEcPrepaid(sealed)?EC_PREPAID.hashes[browser]:isGiraHandoff(sealed)?GIRA_HANDOFF.hashes[browser]:isGiraBridge(sealed)?GIRA_BRIDGE.hashes[browser]:OPERATIONS_V203.hashes[browser],'OP203_BROWSER_AUTHORITY');
                completeDropi=Object.freeze({...accepted,
                    protectedFiles:Object.freeze({...accepted.protectedFiles,[browser]:completeHashes[browser]}),
                    sourceProtectedFilesV203:dropiSource.protectedFiles,
                    successorAuthoritySha256V203:sealed.authoritySha256});
            }});
        }
        const reconcile = value => {
            if (!value?.protectedFiles) return value;
            const hashes = { ...value.protectedFiles };
            for (const p of paths) if (Object.hasOwn(hashes, p) && sealed.envelope.PAYLOAD_HASHES[p])
                hashes[p] = sealed.envelope.PAYLOAD_HASHES[p];
            return Object.freeze({ ...value, protectedFiles: Object.freeze(hashes) });
        };
        const reconcileContexts = () => {
            for (const key of Object.getOwnPropertyNames(globalThis).filter(k => k.startsWith('__VITALISMEN_'))) {
                const desc = Object.getOwnPropertyDescriptor(globalThis, key);
                const value = globalThis[key];
                if (!value?.protectedFiles) continue;
                if (!paths.some(p => Object.hasOwn(value.protectedFiles, p)
                    && sealed.envelope.PAYLOAD_HASHES[p]
                    && value.protectedFiles[p] !== sealed.envelope.PAYLOAD_HASHES[p])) continue;
                assert.ok(desc.configurable, 'SEALED_CONTEXT_NOT_RECONCILABLE:' + key);
                if (typeof desc.get === 'function' && typeof desc.set === 'function') {
                    let current = reconcile(desc.get.call(globalThis));
                    Object.defineProperty(globalThis, key, { configurable: true,
                        enumerable: desc.enumerable, get: () => current,
                        set(next) { desc.set.call(globalThis, next); current = reconcile(desc.get.call(globalThis)); } });
                } else Object.defineProperty(globalThis, key, { ...desc, value: reconcile(value) });
            }
        };
        reconcileContexts();
        globalThis.__VITALISMEN_SEALED_SUCCESSOR_CONTEXT = Object.freeze({ loaded: true,
            commit: sealed.authority.SUCCESSOR_COMMIT, tree: sealed.authority.SUCCESSOR_TREE,
            authoritySha256: sealed.authoritySha256, nodeOptions: sealed.nodeOptions,
            root: sealed.root, historicalR5Verified: true });
        await import(pathToFileURL(path.join(sealed.root, parent.manifest.currentEntrypoint)).href);
        reconcileContexts();
        for (const key of ['DROPPI_EC_ACTIVE_SYNC_ENABLED', 'VITALISMEN_META_PURCHASE_ENABLED'])
            assert.notEqual(String(process.env[key] || '').toLowerCase(), 'true', 'SEALED_EXTERNAL_EFFECT_ENABLED');
        return sealed;
    } catch (error) {
        for (const key of Object.getOwnPropertyNames(globalThis).filter(k => k.startsWith('__VITALISMEN_')))
            if (!descriptorSnapshot.has(key)) delete globalThis[key];
        for (const [key, desc] of descriptorSnapshot) Object.defineProperty(globalThis, key, desc);
        throw error;
    }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    if (process.argv[2] === '--backup' && process.argv.length === 6) {
        console.log(JSON.stringify(await recordSealedRollbackPlan(process.argv[3],
            { gitIdentitySource: process.argv[4], gitCommit: process.argv[5] })));
    } else {
    assert.equal(process.argv.length, 4, 'SEALED_CLI_ARGUMENTS');
    if (process.argv[2] === '--rollback') console.log(JSON.stringify(await rollbackSealedRelease(process.argv[3])));
    else if (process.argv[2] === '--backup') console.log(JSON.stringify(await recordSealedRollbackPlan(process.argv[3])));
    else throw new Error('SEALED_CLI_COMMAND_INVALID');
    }
}


// One-file, exact-source observability contract. No release file or historical
// hash is changed. The only source admitted is the approved frozen QA service.
export const QA_OBSERVABILITY_RECEIPT_PATH = '/var/lib/vitalismen-deploy/qa-claim-observability-227e5f8-v1/receipt.json';
export const QA_OBSERVABILITY_RECEIPT_SHA256 = '3149d288a4b4ca340df553bf0ad0c45cd0f1239069ad253e2b3fa273f5357dac';
export const QA_OBSERVABILITY_SOURCE_SHA256 = '0c067a9c73ccce1859021caf5fe1bc1ea07e0ace9abf18938e46b4fa19a905b9';
const QA_OBSERVABILITY_ROOT = '/opt/vitalismen-automacao/releases/20261004T010000Z_production-20261004-227e5f8';
const QA_OBSERVABILITY_FILE = 'src/services/ecBotCoreRuntimeIntegrationV78Service.js';
const QA_OBSERVABILITY_BASE_SHA256 = 'b2f9ba39fe456fc66363da01d5b30c2e30ef1b0423d835a8c55d43774238d51c';
const QA_OBSERVABILITY_COMMIT = '227e5f864348595408762dad6b5b6a41b41d5fca';
const QA_OBSERVABILITY_TREE = 'eb573f0b21ef1152c3cbfb5afe981c15a558c10c';
const QA_OBSERVABILITY_AUTHORITY_SHA256 = '270c27a8345d81918f74596f4faa522e9d6f3105760dc15895ea4ad681bf9399';
const QA_OBSERVABILITY_FREEZE = 'VITALISMEN_EC_QA_CLAIM_OBSERVABILITY_227E5F8_c99597e82b96e61c';
const QA_OBSERVABILITY_MANIFEST_SHA256 = '2d64d515ac92dae19cbc3d8207ae1a8e0b36b02b66f95363ff25fbabe12c69a6';

export function validateQaClaimObservabilityReceiptV1(bytes, sealed) {
    assert.equal(sha256(bytes), QA_OBSERVABILITY_RECEIPT_SHA256, 'QA_OBSERVABILITY_RECEIPT_TAMPERED');
    const receipt = JSON.parse(bytes.toString('utf8'));
    assert.deepEqual(bytes, canonicalBytes(receipt), 'QA_OBSERVABILITY_RECEIPT_NONCANONICAL');
    sameKeys(receipt, ['version','project','purpose','observabilityFreeze','observabilityManifestSha256',
        'release','commit','tree','predecessorCommit','authoritySha256','sourceRelativePath',
        'baselineSha256','sourceSha256','sourceBase64','authorizedBy','createdAt'], 'QA_OBSERVABILITY_RECEIPT_FIELDS');
    assert.equal(sealed.root, QA_OBSERVABILITY_ROOT, 'QA_OBSERVABILITY_RELEASE_INVALID');
    assert.equal(sealed.envelope.PURPOSE, 'VIT_SIGNATURE_PATCH', 'QA_OBSERVABILITY_CONTEXT_INVALID');
    assert.equal(sealed.authority.PROJECT, 'VITALISMEN_EC', 'QA_OBSERVABILITY_PROJECT_INVALID');
    assert.equal(sealed.authority.SUCCESSOR_COMMIT, QA_OBSERVABILITY_COMMIT, 'QA_OBSERVABILITY_COMMIT_INVALID');
    assert.equal(sealed.authority.SUCCESSOR_TREE, QA_OBSERVABILITY_TREE, 'QA_OBSERVABILITY_TREE_INVALID');
    assert.equal(sealed.authority.PREDECESSOR_COMMIT, 'bb17ea5a119bc923cefc98173e9ce2206b8324e5', 'QA_OBSERVABILITY_PREDECESSOR_INVALID');
    assert.equal(sealed.authoritySha256, QA_OBSERVABILITY_AUTHORITY_SHA256, 'QA_OBSERVABILITY_AUTHORITY_INVALID');
    assert.equal(sealed.envelope.PAYLOAD_HASHES[QA_OBSERVABILITY_FILE], QA_OBSERVABILITY_BASE_SHA256,
        'QA_OBSERVABILITY_BASELINE_AUTHORITY_INVALID');
    assert.equal(receipt.version, 1);assert.equal(receipt.project, 'VITALISMEN_EC');
    assert.equal(receipt.purpose, 'QA_CLAIM_OBSERVABILITY_ONLY');
    assert.equal(receipt.observabilityFreeze, QA_OBSERVABILITY_FREEZE);
    assert.equal(receipt.observabilityManifestSha256, QA_OBSERVABILITY_MANIFEST_SHA256);
    assert.equal(receipt.release, path.basename(QA_OBSERVABILITY_ROOT));
    assert.equal(receipt.commit, QA_OBSERVABILITY_COMMIT);assert.equal(receipt.tree, QA_OBSERVABILITY_TREE);
    assert.equal(receipt.predecessorCommit, sealed.authority.PREDECESSOR_COMMIT);
    assert.equal(receipt.authoritySha256, QA_OBSERVABILITY_AUTHORITY_SHA256);
    assert.equal(receipt.sourceRelativePath, QA_OBSERVABILITY_FILE);
    assert.equal(receipt.baselineSha256, QA_OBSERVABILITY_BASE_SHA256);
    assert.equal(receipt.sourceSha256, QA_OBSERVABILITY_SOURCE_SHA256);
    const source = Buffer.from(receipt.sourceBase64, 'base64');
    assert.equal(source.toString('base64'), receipt.sourceBase64, 'QA_OBSERVABILITY_SOURCE_ENCODING');
    assert.equal(sha256(source), QA_OBSERVABILITY_SOURCE_SHA256, 'QA_OBSERVABILITY_SOURCE_INVALID');
    return { receipt, source, targetUrl: pathToFileURL(path.join(sealed.root, QA_OBSERVABILITY_FILE)).href };
}

export function readQaClaimObservabilityReceiptV1(sealed) {
    const dir = path.dirname(QA_OBSERVABILITY_RECEIPT_PATH);
    for (let current = dir; current !== '/'; current = path.dirname(current)) {
        const stat = fs.lstatSync(current);
        assert.ok(stat.isDirectory() && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0
            && (stat.mode & 0o022) === 0, 'QA_OBSERVABILITY_PARENT_UNSAFE');
    }
    assert.equal(fs.lstatSync(dir).mode & 0o777, 0o700, 'QA_OBSERVABILITY_DIRECTORY_MODE');
    const stat = fs.lstatSync(QA_OBSERVABILITY_RECEIPT_PATH);
    assert.ok(stat.isFile() && !stat.isSymbolicLink() && stat.uid === 0 && stat.gid === 0
        && (stat.mode & 0o777) === 0o400 && stat.nlink === 1, 'QA_OBSERVABILITY_RECEIPT_PERMISSIONS');
    return validateQaClaimObservabilityReceiptV1(fs.readFileSync(QA_OBSERVABILITY_RECEIPT_PATH), sealed);
}

export function installQaClaimObservabilityV1(sealed) {
    if (sealed.envelope.PURPOSE === 'GOVERNANCE_BOOTSTRAP') return { installed: false, historicalPreserved: true };
    const validated = readQaClaimObservabilityReceiptV1(sealed);
    assert.equal(sha256(fs.readFileSync(fileURLToPath(validated.targetUrl))), QA_OBSERVABILITY_BASE_SHA256,
        'QA_OBSERVABILITY_PHYSICAL_BASELINE_INVALID');
    register(import.meta.url, { parentURL: import.meta.url, data: { root: sealed.root } });
    return { installed: true, sourceSha256: QA_OBSERVABILITY_SOURCE_SHA256 };
}

let qaObservabilityHook = null;
export function initialize(data) {
    sameKeys(data, ['root'], 'QA_OBSERVABILITY_HOOK_INPUT');
    assert.equal(data.root, QA_OBSERVABILITY_ROOT, 'QA_OBSERVABILITY_HOOK_RELEASE');
    qaObservabilityHook = readQaClaimObservabilityReceiptV1(requireSealedRelease(data.root));
}
export async function load(url, context, nextLoad) {
    if (!qaObservabilityHook) return nextLoad(url, context);
    const target = qaObservabilityHook.targetUrl;
    assert.ok(!url.startsWith(target + '?') && !url.startsWith(target + '#'), 'QA_OBSERVABILITY_TARGET_ALIAS');
    if (url !== target) return nextLoad(url, context);
    const original = await nextLoad(url, context);
    assert.equal(original.format, 'module', 'QA_OBSERVABILITY_MODULE_FORMAT');
    assert.equal(sha256(Buffer.from(original.source)), QA_OBSERVABILITY_BASE_SHA256,
        'QA_OBSERVABILITY_LOADED_BASELINE_INVALID');
    try { console.info('[QA_CLAIM_OBSERVABILITY_LOADED] ' + JSON.stringify({
        commit: QA_OBSERVABILITY_COMMIT, sourceSha256: QA_OBSERVABILITY_SOURCE_SHA256,
        receiptSha256: QA_OBSERVABILITY_RECEIPT_SHA256 })); } catch { /* telemetry cannot grant automation */ }
    return { ...original, source: qaObservabilityHook.source };
}


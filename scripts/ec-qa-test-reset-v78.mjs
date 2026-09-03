import fs from 'node:fs';
import path from 'node:path';

import dotenv from 'dotenv';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import {
    EC_QA_TEST_AUTHORIZATION_PHRASE_V78,
    EC_QA_TEST_PHONE_V78,
    applyEcQaTestResetToStateV78,
    containEcQaTestContextOnStateV78,
    createEcQaTestPermitV78,
    planEcQaTestResetV78,
    resolveEcQaTestContextV78,
    validateEcQaTestPermitV78
} from '../src/services/ecQaTestResetV78Service.js';

const stateDir = process.env.EC_QA_TEST_RESET_V78_STATE_DIR || '/var/lib/vitalismen-deploy';
const permitPath = path.join(stateDir, 'ec-qa-test-reset-v78-permit.json');
const exactPhone = process.argv[3];
const action = process.argv[2] || 'status';
const production = process.platform !== 'win32' && process.env.EC_QA_TEST_RESET_V78_TEST_MODE !== 'true';

const fail = (message) => {
    throw new Error(message);
};

const assertRoot = () => {
    if (production && process.getuid?.() !== 0) fail('ec_qa_reset_requires_root');
};

const canonicalJson = (value) => `${JSON.stringify(value, null, 2)}\n`;
const readPermit = () => {
    const content = fs.readFileSync(permitPath, 'utf8');
    const permit = JSON.parse(content);
    if (content !== canonicalJson(permit)) fail('ec_qa_permit_not_canonical');
    if (production) {
        const stats = fs.lstatSync(permitPath);
        if (!stats.isFile() || stats.isSymbolicLink() || stats.uid !== 0 || stats.gid !== 0 || (stats.mode & 0o077) !== 0) {
            fail('ec_qa_permit_permissions_invalid');
        }
    }
    return permit;
};

const connect = async () => {
    dotenv.config();
    const uri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
    if (!uri) fail('mongodb_uri_missing');
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 });
};

const findExactState = () => ContactState.findOne({
    phoneDigits: EC_QA_TEST_PHONE_V78,
    chatId: { $in: [`${EC_QA_TEST_PHONE_V78}@c.us`, `${EC_QA_TEST_PHONE_V78}@s.whatsapp.net`] }
}).sort({ updatedAt: -1 });

const exactPausedUntil = (value) => value ? new Date(value) : null;

const applyReset = async ({ state, permit }) => {
    const plain = state.toObject({ depopulate: true });
    const result = applyEcQaTestResetToStateV78({ state: plain, phone: exactPhone, permit });
    if (!result.changed) return { changed: false, idempotent: true };
    const update = await ContactState.updateOne({
        _id: state._id,
        phoneDigits: EC_QA_TEST_PHONE_V78,
        'metadata.testOnly': true,
        'metadata.botTestEnabled': true,
        'metadata.fullFunnelTestEnabled': true,
        tags: { $all: ['TESTE_8637_PRIORIDADE', 'TESTE_FIXO_NAO_MEXER', 'BOT_TESTE_LIBERADO'] },
        'human.mode': state.human?.mode,
        'human.pausedUntil': exactPausedUntil(state.human?.pausedUntil),
        'metadata.qaTestContextV78.permitId': { $ne: permit.permitId }
    }, {
        $set: {
            'human.mode': result.state.human.mode,
            'human.pausedUntil': result.state.human.pausedUntil,
            'metadata.qaTestContextV78': result.state.metadata.qaTestContextV78
        }
    });
    if (update.modifiedCount === 1) return { changed: true, idempotent: false };
    const current = await findExactState();
    const retry = planEcQaTestResetV78({ state: current?.toObject?.() || current, phone: exactPhone, permit });
    if (retry.idempotent) return { changed: false, idempotent: true };
    fail('ec_qa_reset_atomic_compare_failed');
};

const containReset = async ({ state, permit }) => {
    const plain = state.toObject({ depopulate: true });
    const result = containEcQaTestContextOnStateV78({
        state: plain,
        phone: exactPhone,
        permitId: permit.permitId
    });
    if (!result.changed) return { changed: false, idempotent: true };
    const update = await ContactState.updateOne({
        _id: state._id,
        phoneDigits: EC_QA_TEST_PHONE_V78,
        'human.mode': 'auto',
        'metadata.qaTestContextV78.permitId': permit.permitId,
        'metadata.qaTestContextV78.status': { $in: ['armed', 'consumed'] }
    }, {
        $set: {
            'human.mode': result.state.human.mode,
            'human.pausedUntil': result.state.human.pausedUntil,
            'metadata.qaTestContextV78': result.state.metadata.qaTestContextV78
        }
    });
    if (update.modifiedCount !== 1) fail('ec_qa_containment_atomic_compare_failed');
    return { changed: true, idempotent: false };
};

const run = async () => {
    assertRoot();
    if (action === 'authorize') {
        if (exactPhone !== EC_QA_TEST_PHONE_V78) fail('ec_qa_phone_must_match_exactly');
        if (process.env.EC_QA_TEST_RESET_V78_AUTHORIZE !== EC_QA_TEST_AUTHORIZATION_PHRASE_V78) {
            fail('ec_qa_explicit_authorization_missing');
        }
        fs.mkdirSync(stateDir, { recursive: true, mode: 0o700 });
        const permit = createEcQaTestPermitV78({ phone: exactPhone });
        fs.writeFileSync(permitPath, canonicalJson(permit), { encoding: 'utf8', mode: 0o600, flag: 'wx' });
        process.stdout.write(`EC_QA_RESET_V78_AUTHORIZATION=READY\nPHONE=${EC_QA_TEST_PHONE_V78}\nPERMIT_ID=${permit.permitId}\nAPPLY_EXECUTED=NO\n`);
        return;
    }
    if (!['plan', 'apply', 'status', 'contain'].includes(action)) fail('ec_qa_action_invalid');
    if (exactPhone !== EC_QA_TEST_PHONE_V78) fail('ec_qa_phone_must_match_exactly');
    const permit = readPermit();
    const validation = validateEcQaTestPermitV78(permit, { phone: exactPhone });
    if (!validation.valid && action !== 'status' && action !== 'contain') {
        fail(`ec_qa_permit_invalid:${validation.failures.join(',')}`);
    }
    await connect();
    const state = await findExactState();
    if (!state) fail('ec_qa_exact_state_not_found');
    if (action === 'plan') {
        const plan = planEcQaTestResetV78({ state: state.toObject(), phone: exactPhone, permit });
        if (plan.failures.length) fail(`ec_qa_plan_blocked:${plan.failures.join(',')}`);
        process.stdout.write(`EC_QA_RESET_V78_PLAN=PASS\nTRANSITION=${plan.transition}\nIDEMPOTENT=${plan.idempotent ? 'YES' : 'NO'}\nWRITE_CLASSES=human.mode,human.pausedUntil,metadata.qaTestContextV78\n`);
        return;
    }
    if (action === 'apply') {
        const result = await applyReset({ state, permit });
        process.stdout.write(`EC_QA_RESET_V78_APPLY=PASS\nCHANGED=${result.changed ? 'YES' : 'NO'}\nIDEMPOTENT=${result.idempotent ? 'YES' : 'NO'}\n`);
        return;
    }
    if (action === 'contain') {
        const result = await containReset({ state, permit });
        const archive = `${permitPath}.contained.${Date.now()}`;
        fs.renameSync(permitPath, archive);
        process.stdout.write(`EC_QA_RESET_V78_CONTAIN=PASS\nCHANGED=${result.changed ? 'YES' : 'NO'}\nPREVIOUS_HOLD_RESTORED=YES\n`);
        return;
    }
    const context = resolveEcQaTestContextV78(state.toObject(), {
        phone: exactPhone,
        permitId: state.metadata?.qaTestContextV78?.permitId,
        messageId: state.metadata?.qaTestContextV78?.consumedMessageId,
        allowConsumed: true
    });
    process.stdout.write(`EC_QA_RESET_V78_STATUS=${context.ready ? 'ARMED_OR_CONSUMED' : 'NOT_READY'}\nREASON=${context.reason}\n`);
};

try {
    await run();
} catch (error) {
    process.stderr.write(`ERRO: ${error.message}\n`);
    process.exitCode = 1;
} finally {
    await mongoose.disconnect().catch(() => null);
}

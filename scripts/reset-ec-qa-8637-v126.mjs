import 'dotenv/config';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import {
    buildEcQaSafeResetV126,
    EC_QA_PERMANENT_TEST_V126_PHONE,
    EC_QA_PERMANENT_TEST_V126_RESET_AUTHORIZATION,
    isEcQaPermanentTestStateV126
} from '../src/services/ecQaPermanentTestV126Service.js';

const action = String(process.argv[2] || 'report').trim().toLowerCase();
if (!['report', 'apply'].includes(action)) {
    throw new Error('usage: reset-ec-qa-8637-v126.mjs report|apply');
}
if (action === 'apply'
    && process.env.VITALISMEN_EC_QA_8637_RESET_APPROVED !== EC_QA_PERMANENT_TEST_V126_RESET_AUTHORIZATION) {
    throw new Error('qa_v126_reset_authorization_missing');
}

const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL;
if (!mongoUri) throw new Error('mongo_uri_missing');

await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });
try {
    const aliases = [
        `${EC_QA_PERMANENT_TEST_V126_PHONE}@c.us`,
        `${EC_QA_PERMANENT_TEST_V126_PHONE}@s.whatsapp.net`
    ];
    const states = await ContactState.find({
        $or: [
            { phoneDigits: EC_QA_PERMANENT_TEST_V126_PHONE },
            { chatId: { $in: aliases } }
        ]
    });
    const orderCount = await Order.countDocuments({
        'customer.phone': { $regex: `${EC_QA_PERMANENT_TEST_V126_PHONE}$` }
    });
    const shipmentCount = await Shipment.countDocuments({
        'client.phone': { $regex: `${EC_QA_PERMANENT_TEST_V126_PHONE}$` }
    });
    const state = states[0] || null;
    const reset = buildEcQaSafeResetV126({ state });
    const before = {
        canonicalCustomerCount: states.length,
        eligible: Boolean(state && isEcQaPermanentTestStateV126(state)),
        humanMode: String(state?.human?.mode || ''),
        paused: Boolean(state?.human?.pausedUntil),
        qaContextPresent: Boolean(state?.metadata?.qaTestContextV78),
        perAgentMemoryKeys: Object.keys(state?.metadata?.perAgentMemory || {}),
        orderCount,
        shipmentCount
    };
    if (states.length !== 1 || !reset.allowed || orderCount !== 0 || shipmentCount !== 0) {
        process.stdout.write(`${JSON.stringify({
            status: 'BLOCKED',
            action,
            reason: states.length !== 1
                ? 'qa_single_canonical_customer_required'
                : orderCount || shipmentCount
                    ? 'qa_commercial_record_requires_manual_audit'
                    : reset.reason,
            before,
            mutations: 0,
            messagesDeleted: 0,
            providerIdsDeleted: 0,
            externalCalls: 0
        }, null, 2)}\n`);
        process.exitCode = 2;
    } else if (action === 'report') {
        process.stdout.write(`${JSON.stringify({
            status: 'PASS_REPORT_ONLY',
            action,
            before,
            resetReason: reset.reason,
            mutations: 0,
            messagesDeleted: 0,
            providerIdsDeleted: 0,
            externalCalls: 0
        }, null, 2)}\n`);
    } else {
        const result = await ContactState.updateOne(reset.query, reset.update);
        const after = await ContactState.findById(state._id).lean();
        process.stdout.write(`${JSON.stringify({
            status: result.modifiedCount === 1 ? 'PASS_APPLIED' : 'BLOCKED_NOT_MODIFIED',
            action,
            canonicalCustomerCount: states.length,
            customerIdUnchanged: String(after?._id || '') === String(state._id),
            humanMode: String(after?.human?.mode || ''),
            paused: Boolean(after?.human?.pausedUntil),
            qaContextPresent: Boolean(after?.metadata?.qaTestContextV78),
            perAgentMemoryKeys: Object.keys(after?.metadata?.perAgentMemory || {}),
            orderCount,
            shipmentCount,
            messagesDeleted: 0,
            providerIdsDeleted: 0,
            externalCalls: 0
        }, null, 2)}\n`);
        if (result.modifiedCount !== 1) process.exitCode = 2;
    }
} finally {
    await mongoose.disconnect();
}

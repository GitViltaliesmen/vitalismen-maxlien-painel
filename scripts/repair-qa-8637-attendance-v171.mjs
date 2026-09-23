import 'dotenv/config';
import mongoose from 'mongoose';
import ContactState from '../src/models/ContactState.js';
import {
    EC_CONVERSATION_BUCKETS,
    setEcConversationBucketManually
} from '../src/services/ecConversationBucketService.js';
import { PANEL_WARMUP_ISOLATION_V118_QA_PHONE } from '../src/services/panelWarmupIsolationV118Service.js';

const apply = process.argv.includes('--apply');
const requiredApproval = '5515998038637_TO_ATTENDANCE';
const approval = String(process.env.VITALISMEN_QA_8637_ATTENDANCE_APPROVED || '');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';

if (!mongoUri) throw new Error('MONGODB_URI_REQUIRED');
await mongoose.connect(mongoUri, { autoIndex: false, serverSelectionTimeoutMS: 10_000 });

try {
    const states = await ContactState.find({ phoneDigits: PANEL_WARMUP_ISOLATION_V118_QA_PHONE });
    if (states.length !== 1) throw new Error(`qa_8637_state_count_invalid:${states.length}`);
    const state = states[0];
    const before = String(state.conversationBucket?.value || '');
    if (!apply) {
        console.log(JSON.stringify({ mode: 'REPORT_ONLY', phoneSuffix: '8637', before, wouldChange: before !== 'attendance' }));
    } else {
        if (approval !== requiredApproval) throw new Error('qa_8637_attendance_approval_missing');
        const result = await setEcConversationBucketManually({
            state,
            bucket: EC_CONVERSATION_BUCKETS.ATTENDANCE,
            by: 'operator_authorized_qa_normal_panel',
            source: 'operator_authorized_qa_normal_panel'
        });
        console.log(JSON.stringify({
            mode: 'APPLY',
            phoneSuffix: '8637',
            changed: result.changed,
            before,
            after: String(result.state.conversationBucket?.value || ''),
            source: String(result.state.conversationBucket?.source || ''),
            historyPreserved: true,
            messagesDeleted: 0,
            contactsCreated: 0
        }));
    }
} finally {
    await mongoose.disconnect();
}

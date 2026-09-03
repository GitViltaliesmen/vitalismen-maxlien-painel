import 'dotenv/config';
import mongoose from 'mongoose';
import ContactState from '../src/models/ContactState.js';
import Order from '../src/models/Order.js';
import Shipment from '../src/models/Shipment.js';
import {
    EC_CONVERSATION_BUCKETS,
    setEcConversationBucketManually
} from '../src/services/ecConversationBucketService.js';
import { PANEL_WARMUP_ISOLATION_V118_QA_PHONE } from '../src/services/panelWarmupIsolationV118Service.js';

const apply = process.argv.includes('--apply');
const approval = String(process.env.VITALISMEN_V118_QA_MOVE_APPROVED || '');
const requiredApproval = '5515998038637_TO_ENGAGEMENT';
const activeOrderStatuses = { $nin: ['cancelled', 'returned', 'delivered'] };

if (!process.env.MONGODB_URI) throw new Error('MONGODB_URI ausente');
await mongoose.connect(process.env.MONGODB_URI, { autoIndex: false });

try {
    const states = await ContactState.find({ phoneDigits: PANEL_WARMUP_ISOLATION_V118_QA_PHONE });
    if (states.length !== 1) throw new Error(`qa_state_count_invalid:${states.length}`);
    const state = states[0];
    const phoneTail = PANEL_WARMUP_ISOLATION_V118_QA_PHONE.slice(-9);
    const [activeOrders, shipments] = await Promise.all([
        Order.countDocuments({
            country: 'EC',
            'customer.phone': { $regex: `${phoneTail}$` },
            status: activeOrderStatuses
        }),
        Shipment.find({
            country: 'EC',
            'client.phone': { $regex: `${phoneTail}$` }
        }, {
            outcomes: 1,
            logistics: 1,
            shippingStatus: 1
        }).lean()
    ]);
    const activeShipments = shipments.filter((shipment) => {
        if (shipment.outcomes?.delivered || shipment.outcomes?.returned || shipment.outcomes?.pickedUp) return false;
        return !/(?:delivered|entregado|returned|devuelto|cancel)/i.test(
            String(shipment.logistics?.status || shipment.shippingStatus || '')
        );
    }).length;
    const before = {
        phoneSuffix: PANEL_WARMUP_ISOLATION_V118_QA_PHONE.slice(-4),
        bucket: String(state.conversationBucket?.value || ''),
        bucketSource: String(state.conversationBucket?.source || ''),
        humanMode: String(state.human?.mode || ''),
        activeEcOrders: activeOrders,
        activeEcShipments: activeShipments
    };
    if (activeOrders || activeShipments) throw new Error('qa_has_active_ec_obligation');
    if (!apply) {
        console.log(JSON.stringify({ mode: 'REPORT_ONLY', wouldChange: before.bucket !== 'engagement', before }));
        process.exitCode = 0;
    } else {
        if (approval !== requiredApproval) throw new Error('v118_apply_approval_missing');
        const result = await setEcConversationBucketManually({
            state,
            bucket: EC_CONVERSATION_BUCKETS.ENGAGEMENT,
            by: 'operador_autorizado_v118',
            source: 'controlled_qa_panel_isolation_v118'
        });
        console.log(JSON.stringify({
            mode: 'APPLY',
            changed: result.changed,
            before,
            after: {
                phoneSuffix: PANEL_WARMUP_ISOLATION_V118_QA_PHONE.slice(-4),
                bucket: String(result.state.conversationBucket?.value || ''),
                bucketSource: String(result.state.conversationBucket?.source || ''),
                humanMode: String(result.state.human?.mode || ''),
                replyEligible: result.classification.replyEligibleByHistory === true
            }
        }));
    }
} finally {
    await mongoose.disconnect();
}

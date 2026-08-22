import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';
import {
    extractSubmittedVslName,
    sameCustomerName,
    validCustomerName
} from '../src/services/customerNameResolutionService.js';

const PRODUCT_KEYS = ['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec'];
const args = new Map(process.argv.slice(2).map((item) => {
    const [key, ...rest] = item.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
}));
const applyAssignedAgent = args.has('apply-assigned-agent');
const applyNames = args.has('apply-names');
const applyAuditCleanup = args.has('apply-audit-cleanup');
const applying = applyAssignedAgent || applyNames || applyAuditCleanup;
const confirmation = String(args.get('confirm') || '');
const backupPath = String(args.get('backup') || '');
const since = new Date(String(args.get('since') || '2026-08-22T00:22:28.000Z'));
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';

if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente.');
if (Number.isNaN(since.getTime())) throw new Error('--since invalido.');
if (applying && confirmation !== 'EC_MULTIPRODUCT_V48_CONTROLLED_REPAIR') {
    throw new Error('Aplicacao bloqueada: use --confirm=EC_MULTIPRODUCT_V48_CONTROLLED_REPAIR.');
}
if (applying && (!backupPath || !path.isAbsolute(backupPath))) {
    throw new Error('Aplicacao bloqueada: informe --backup=/caminho/absoluto.json.');
}

const digits = (value = '') => String(value || '').replace(/\D/g, '');
const tail = (value = '') => digits(value).slice(-9);
const comparable = (value = '') => validCustomerName(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
    const [invalidAssignedAgentStates, states, submittedMessages, duplicateAuditGroups] = await Promise.all([
        ContactState.find({ countryCode: 'EC', assignedAgent: { $in: PRODUCT_KEYS } }).lean(),
        ContactState.find({ countryCode: 'EC' }).lean(),
        Message.find({
            isFromMe: false,
            timestamp: { $gte: Math.floor(since.getTime() / 1000) },
            body: { $regex: /nombre(?:\s+completo)?\s*:/i }
        }).sort({ timestamp: 1 }).lean(),
        Message.aggregate([
            { $match: { _id: /^panel_action_/, type: 'system' } },
            { $sort: { timestamp: 1, _id: 1 } },
            { $group: {
                _id: {
                    chatId: '$chatId',
                    from: '$from',
                    to: '$to',
                    body: '$body',
                    type: '$type',
                    isFromMe: '$isFromMe',
                    isBot: '$isBot'
                },
                ids: { $push: '$_id' },
                firstTimestamp: { $min: '$timestamp' },
                count: { $sum: 1 }
            } },
            { $match: { count: { $gt: 1 } } },
            { $sort: { count: -1 } }
        ])
    ]);

    const submittedByTail = new Map();
    for (const message of submittedMessages) {
        const phoneTail = tail(message.peerPhone || message.chatId || message.from);
        const name = extractSubmittedVslName(message.body);
        if (!phoneTail || !name) continue;
        const current = submittedByTail.get(phoneTail) || [];
        current.push({
            name,
            messageId: String(message._id),
            timestamp: message.timestamp,
            body: message.body
        });
        submittedByTail.set(phoneTail, current);
    }

    const recoverableNames = [];
    const identityConflicts = [];
    for (const state of states) {
        const evidences = submittedByTail.get(tail(state.phoneDigits || state.chatId)) || [];
        if (!evidences.length) continue;
        const uniqueNames = [...new Map(evidences.map((item) => [comparable(item.name), item])).values()];
        const submitted = uniqueNames[0]?.name || '';
        const current = validCustomerName(
            state.metadata?.manualNameLock?.name
            || state.metadata?.verifiedCustomerName
            || state.metadata?.customerDraft?.name
        );
        if (uniqueNames.length > 1 || (current && submitted && !sameCustomerName(current, submitted))) {
            identityConflicts.push({
                stateId: String(state._id),
                phone: state.phoneDigits || '',
                currentName: current,
                receivedNames: uniqueNames.map((item) => item.name),
                messageIds: uniqueNames.map((item) => item.messageId)
            });
        } else if (!current && submitted) {
            recoverableNames.push({
                stateId: String(state._id),
                phone: state.phoneDigits || '',
                submittedName: submitted,
                messageId: uniqueNames[0].messageId
            });
        }
    }

    const duplicateAuditCount = duplicateAuditGroups.reduce((sum, group) => sum + group.count - 1, 0);
    const report = {
        mode: applying ? 'CONTROLLED_APPLY' : 'DRY_RUN',
        since: since.toISOString(),
        invalidAssignedAgent: invalidAssignedAgentStates.map((state) => ({
            stateId: String(state._id),
            phone: state.phoneDigits || '',
            assignedAgent: state.assignedAgent,
            productKey: state.metadata?.productKey || state.metadata?.customerDraft?.productKey || '',
            vslProductKey: state.metadata?.vslProductKey || ''
        })),
        recoverableNames,
        identityConflicts,
        duplicateAuditGroups: duplicateAuditGroups.map((group) => ({
            canonicalId: group.ids[0],
            duplicateIds: group.ids.slice(1),
            count: group.count,
            chatId: group._id.chatId,
            body: group._id.body,
            firstTimestamp: group.firstTimestamp
        })),
        totals: {
            invalidAssignedAgent: invalidAssignedAgentStates.length,
            recoverableNames: recoverableNames.length,
            identityConflicts: identityConflicts.length,
            duplicateAuditGroups: duplicateAuditGroups.length,
            duplicateAuditRecords: duplicateAuditCount
        }
    };

    if (applying) {
        const auditIds = duplicateAuditGroups.flatMap((group) => group.ids);
        const auditDocuments = auditIds.length ? await Message.find({ _id: { $in: auditIds } }).lean() : [];
        const backup = {
            generatedAt: new Date().toISOString(),
            confirmation,
            report,
            contactStates: states.filter((state) => (
                invalidAssignedAgentStates.some((item) => String(item._id) === String(state._id))
                || recoverableNames.some((item) => item.stateId === String(state._id))
                || identityConflicts.some((item) => item.stateId === String(state._id))
            )),
            auditDocuments
        };
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });

        if (applyAssignedAgent && invalidAssignedAgentStates.length) {
            await ContactState.updateMany(
                { _id: { $in: invalidAssignedAgentStates.map((item) => item._id) }, assignedAgent: { $in: PRODUCT_KEYS } },
                { $set: { assignedAgent: null } }
            );
        }
        if (applyNames) {
            for (const item of recoverableNames) {
                await ContactState.updateOne(
                    {
                        _id: item.stateId,
                        $or: [
                            { 'metadata.manualNameLock.active': { $ne: true } },
                            { 'metadata.manualNameLock': { $exists: false } }
                        ]
                    },
                    {
                        $set: {
                            'metadata.submittedName': item.submittedName,
                            'metadata.customerDraft.name': item.submittedName,
                            'metadata.customerDraft.nameSource': 'vsl_submitted_name_repair_v48'
                        }
                    }
                );
            }
            for (const item of identityConflicts) {
                await ContactState.updateOne(
                    { _id: item.stateId },
                    {
                        $set: {
                            'metadata.identityConflict': {
                                status: 'IDENTITY_CONFLICT',
                                currentName: item.currentName,
                                receivedName: item.receivedNames[0] || '',
                                receivedSource: 'vsl_submitted_name_repair_v48',
                                detectedAt: new Date().toISOString(),
                                sourceMessageId: item.messageIds[0] || '',
                                resolvedAt: null,
                                resolvedBy: '',
                                resolution: ''
                            }
                        }
                    }
                );
            }
        }
        if (applyAuditCleanup) {
            for (const group of duplicateAuditGroups) {
                const canonicalId = group.ids[0];
                const duplicateIds = group.ids.slice(1);
                await Message.updateOne(
                    { _id: canonicalId },
                    {
                        $set: {
                            'providerPayload.v48DeduplicatedCount': duplicateIds.length,
                            'providerPayload.v48DeduplicatedAt': new Date().toISOString(),
                            'providerPayload.v48BackupPath': backupPath
                        }
                    }
                );
                await Message.deleteMany({ _id: { $in: duplicateIds } });
            }
        }
        report.backupPath = backupPath;
        report.applied = { applyAssignedAgent, applyNames, applyAuditCleanup };
    }

    console.log(JSON.stringify(report, null, 2));
} finally {
    await mongoose.disconnect();
}

import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import mongoose from 'mongoose';

import ContactState from '../src/models/ContactState.js';

const args = new Map(process.argv.slice(2).map((item) => {
    const [key, ...rest] = item.replace(/^--/, '').split('=');
    return [key, rest.join('=') || true];
}));
const apply = args.has('apply');
const confirmation = String(args.get('confirm') || '');
const backupPath = String(args.get('backup') || '');
const mongoUri = process.env.MONGODB_URI || process.env.MONGO_URI || process.env.MONGODB_URL || '';
const REQUIRED_CONFIRMATION = 'PANEL_CUSTOMER_ALIAS_V57_CONTROLLED_REPAIR';
const CANONICAL = Object.freeze({
    id: '6a7de6a3f24ae26732b457a8',
    chatId: '593983125541@c.us',
    phoneDigits: '593983125541',
    name: 'Sergio Ventura Villacís castro'
});
const ALIAS = Object.freeze({
    id: '6a7de6b3f24ae26732b45816',
    chatId: '0983125541@c.us',
    wrongPhoneDigits: '593993994364',
    wrongName: 'Juan H. Bravo'
});

if (!mongoUri) throw new Error('MONGODB_URI/MONGO_URI ausente.');
if (apply && confirmation !== REQUIRED_CONFIRMATION) {
    throw new Error(`Aplicacao bloqueada: use --confirm=${REQUIRED_CONFIRMATION}.`);
}
if (apply && (!backupPath || !path.isAbsolute(backupPath))) {
    throw new Error('Aplicacao bloqueada: informe --backup=/caminho/absoluto.json.');
}

const jsonSafe = (value) => JSON.parse(JSON.stringify(value));
const normalizeEcPhone = (value = '') => {
    const digits = String(value || '').replace(/\D/g, '');
    if (/^5939\d{8}$/.test(digits)) return digits;
    if (/^09\d{8}$/.test(digits)) return `593${digits.slice(1)}`;
    if (/^9\d{8}$/.test(digits)) return `593${digits}`;
    return digits;
};

await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });

try {
    const [canonical, alias] = await Promise.all([
        ContactState.findById(CANONICAL.id).lean(),
        ContactState.findById(ALIAS.id).lean()
    ]);
    if (!canonical || !alias) throw new Error('Estado canonico ou alias autorizado ausente.');
    const aliasAlreadyRepaired = alias.phoneDigits === CANONICAL.phoneDigits
        && alias.metadata?.customerDraft?.name === CANONICAL.name;
    if (
        canonical.chatId !== CANONICAL.chatId
        || canonical.phoneDigits !== CANONICAL.phoneDigits
        || canonical.metadata?.lastSenderPn !== CANONICAL.phoneDigits
        || canonical.metadata?.customerDraft?.name !== CANONICAL.name
        || canonical.metadata?.customerDraft?.phone !== `+${CANONICAL.phoneDigits}`
        || canonical.metadata?.customerDraft?.agencyId !== 'EC-SA-855563F6EA37BD35'
        || canonical.metadata?.customerDraft?.orderId !== ''
        || canonical.metadata?.customerDraft?.sourceOrderId !== ''
        || canonical.metadata?.panelCustomerFormRepairV55?.historicalOrderChanged !== false
        || alias.chatId !== ALIAS.chatId
        || normalizeEcPhone(alias.chatId) !== CANONICAL.phoneDigits
        || (!aliasAlreadyRepaired && alias.phoneDigits !== ALIAS.wrongPhoneDigits)
        || (!aliasAlreadyRepaired && alias.metadata?.customerDraft?.name !== ALIAS.wrongName)
    ) throw new Error('Pre-condicao do alias 5541 mudou; reparo bloqueado.');

    const canonicalDraft = jsonSafe(canonical.metadata.customerDraft);
    const canonicalResolution = jsonSafe(canonical.customerDataResolution);
    const linkedChatIds = [...new Set([
        ...(canonical.metadata?.linkedChatIds || []),
        ...(alias.metadata?.linkedChatIds || []),
        CANONICAL.chatId,
        ALIAS.chatId
    ])];
    const report = {
        ok: true,
        mode: apply ? 'CONTROLLED_APPLY' : 'DRY_RUN',
        aliasStateId: ALIAS.id,
        canonicalStateId: CANONICAL.id,
        before: {
            chatId: alias.chatId,
            phoneDigits: alias.phoneDigits,
            draftName: alias.metadata?.customerDraft?.name || '',
            draftPhone: alias.metadata?.customerDraft?.phone || ''
        },
        after: {
            chatId: ALIAS.chatId,
            phoneDigits: CANONICAL.phoneDigits,
            draftName: canonicalDraft.name,
            draftPhone: canonicalDraft.phone,
            agencyId: canonicalDraft.agencyId,
            orderId: canonicalDraft.orderId,
            sourceOrderId: canonicalDraft.sourceOrderId,
            linkedChatIds
        },
        preserved: {
            noWhatsappSend: true,
            noMessageMutation: true,
            noOrderMutation: true,
            noMetaResend: true,
            noDropiSubmit: true,
            canonicalStateMutation: false
        }
    };

    if (apply) {
        const backup = {
            generatedAt: new Date().toISOString(),
            confirmation,
            report,
            canonicalContactState: jsonSafe(canonical),
            aliasContactState: jsonSafe(alias)
        };
        fs.mkdirSync(path.dirname(backupPath), { recursive: true });
        fs.writeFileSync(backupPath, `${JSON.stringify(backup, null, 2)}\n`, { mode: 0o600 });
        fs.chmodSync(backupPath, 0o600);

        const repairedAt = new Date().toISOString();
        const result = await ContactState.updateOne(
            { _id: alias._id, chatId: ALIAS.chatId },
            { $set: {
                phoneDigits: CANONICAL.phoneDigits,
                customerDataResolution: canonicalResolution,
                'metadata.lastSenderPn': CANONICAL.phoneDigits,
                'metadata.customerPhoneDigits': CANONICAL.phoneDigits,
                'metadata.customerDraft': { ...canonicalDraft, updatedAt: repairedAt },
                'metadata.linkedChatIds': linkedChatIds,
                'metadata.panelCustomerAliasRepairV57': {
                    repairedAt,
                    previousPhoneDigits: alias.phoneDigits,
                    previousDraftName: alias.metadata?.customerDraft?.name || '',
                    canonicalStateId: CANONICAL.id,
                    orderOrMessageChanged: false,
                    source: 'same_customer_local_and_international_alias'
                }
            } }
        );
        if (result.matchedCount !== 1) throw new Error('Falha ao atualizar o alias local 5541.');
        const repaired = await ContactState.findById(ALIAS.id).lean();
        if (
            normalizeEcPhone(repaired.chatId) !== repaired.phoneDigits
            || repaired.metadata?.lastSenderPn !== CANONICAL.phoneDigits
            || repaired.metadata?.customerDraft?.name !== CANONICAL.name
            || repaired.metadata?.customerDraft?.orderId !== ''
            || repaired.metadata?.customerDraft?.sourceOrderId !== ''
        ) throw new Error('Verificacao posterior do alias 5541 falhou.');
        report.applyResult = { matched: result.matchedCount, modified: result.modifiedCount };
        report.backupPath = backupPath;
    }

    console.log(JSON.stringify(report, null, 2));
} finally {
    await mongoose.disconnect().catch(() => null);
}

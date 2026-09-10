import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

// Real models, dispatcher notifiers, panel adapter and persistent ledger; only I/O is SINK.
export const runA07Cases = async ({ Shipment, Message, make, auto, manual, manualComponent, worker, calls,
    transport, directory, delay, a07PlanV147R6R2, inspectA07V147R6R2 }) => {
    const result = {};
    const fresh = async (pdf = true) => {
        const s = await make('A07');
        if (pdf) {
            const guide = path.join(directory, 'guide-' + s._id + '.pdf');
            fs.writeFileSync(guide, '%PDF-1.4\n% isolated A07 SINK guide ' + s._id + '\n%%EOF\n', { mode: 0o600 });
            await Shipment.updateOne({ _id: s._id }, { $set: { 'logistics.invoicePath': guide } });
        }
        return Shipment.findById(s._id);
    };
    const perShipment = (s) => calls().filter((r) => r.phone.replace(/\D/g, '') === s.client.phone);
    const verify = async (s, expected = ['TEXT', 'GUIDE_PDF', 'AUDIO']) => {
        const view = await inspectA07V147R6R2({ shipment: await Shipment.findById(s._id), persist: true });
        assert.equal(view.satisfied, true);
        const ledger = (await Shipment.findById(s._id)).automation.postSaleSafetyLedger.READY_FOR_PICKUP;
        assert.equal(ledger.reservationCount, 1); assert.ok(ledger.reservationId);
        assert.equal(new Set(expected.map((c) => ledger.components[c].providerMessageId)).size, expected.length);
        for (const c of expected) assert.equal(ledger.components[c].parentDedupeKey, ledger.dedupeKey);
        assert.equal(ledger.state, 'SENT');
        const reservation = ledger.reservationId;
        await worker(['--restart', 'A07', String(s._id)]);
        assert.equal((await Shipment.findById(s._id)).automation.postSaleSafetyLedger.READY_FOR_PICKUP.reservationId, reservation);
        assert.equal((await Shipment.findById(s._id)).automation.notificationLocks.READY_FOR_PICKUP, null);
        return ledger;
    };
    const baseline = await fresh();
    assert.equal(await auto(baseline._id, 'A07'), true);
    const baselineCalls = perShipment(baseline);
    assert.deepEqual(baselineCalls.map((r) => r.method), ['sendText', 'sendDocument', 'sendAudio']);
    result.singleExecutionProviderCalls = baselineCalls.length;
    await verify(baseline);
    assert.equal(perShipment(baseline).length, baselineCalls.length);
    for (const first of ['manual', 'auto']) {
        const s = await fresh();
        if (first === 'manual') { await manual(s._id, 'A07'); await auto(s._id, 'A07'); }
        else { await auto(s._id, 'A07'); await manual(s._id, 'A07'); }
        await verify(s);
        assert.equal(perShipment(s).length, baselineCalls.length);
        result[first + 'FirstAndRestart'] = 'PASS';
        const race = await fresh();
        const children = ['manual', 'auto'].map((source) => worker(['--worker=' + source,
            ...(source !== first ? ['--second'] : []), 'A07', String(race._id)]));
        const end = Date.now() + 30000;
        while (Date.now() < end && !['manual', 'auto'].every((source) => fs.existsSync(path.join(directory, race._id + '-' + source + '.ready')))) await delay(10);
        assert.ok(['manual', 'auto'].every((source) => fs.existsSync(path.join(directory, race._id + '-' + source + '.ready'))));
        fs.writeFileSync(path.join(directory, race._id + '-go'), 'go');
        await Promise.all(children);
        await verify(race);
        const rows = perShipment(race);
        assert.equal(rows.length, baselineCalls.length);
        for (const method of ['sendText', 'sendDocument', 'sendAudio']) assert.equal(rows.filter((r) => r.method === method).length, 1);
        result[first + 'StartsRaceProviderCalls'] = rows.length;
    }
    const historical = async (components) => {
        const s = await fresh(); const plan = await a07PlanV147R6R2(s);
        const sentAt = new Date(Date.now() - 60000);
        for (const c of components) {
            await Message.create({ _id: 'preledger-' + s._id + '-' + c, from: 'SINK', peerPhone: s.client.phone,
                to: s.client.phone + '@c.us', isFromMe: true, isBot: false, senderRole: 'human',
                body: c === 'TEXT' ? plan.text : '[Media]', type: c === 'TEXT' ? 'chat' : c === 'AUDIO' ? 'audio' : 'document',
                mediaUrl: c === 'TEXT' ? '' : c === 'AUDIO' ? '/media/templates/EC/Chegou_01.ogg' : plan.guide,
                providerMessageId: 'accepted-' + s._id + '-' + c, ack: 2, createdAt: sentAt, timestamp: Math.floor(sentAt.getTime() / 1000) });
        }
        const before = JSON.stringify(await Message.find({ peerPhone: s.client.phone }).lean());
        await auto(s._id, 'A07');
        const ledger = await verify(s);
        for (const c of components) assert.equal(new Date(ledger.components[c].acceptedAt).getTime(), sentAt.getTime());
        assert.equal(JSON.stringify(await Message.find({ peerPhone: s.client.phone, isBot: false }).lean()), before);
        return s;
    };
    const all = await historical(['TEXT', 'GUIDE_PDF', 'AUDIO']);
    assert.equal(perShipment(all).length, 0); result.manualHistoryProviderCalls = 0;
    for (const [satisfied, expected] of [[['TEXT', 'GUIDE_PDF'], 'sendAudio'], [['TEXT', 'AUDIO'], 'sendDocument'], [['GUIDE_PDF', 'AUDIO'], 'sendText']]) {
        const s = await historical(satisfied); assert.deepEqual(perShipment(s).map((r) => r.method), [expected]);
    }
    result.partialHistoryEachMissingComponent = 'PASS';
    const noPdf = await fresh(false);
    await auto(noPdf._id, 'A07'); await verify(noPdf, ['TEXT', 'AUDIO']);
    assert.deepEqual(perShipment(noPdf).map((r) => r.method), ['sendText', 'sendAudio']);
    result.missingPdfProviderCalls = perShipment(noPdf).length;
    // Two confirmed components survive restart; the known unattempted component may resume.
    const partial = await fresh();
    for (const c of ['TEXT', 'GUIDE_PDF']) assert.equal((await manualComponent(partial._id, c)).sent, true);
    await manualComponent(partial._id, 'AUDIO', async () => ({ ok: false, providerAttempted: false }));
    const beforePartial = perShipment(partial).length;
    await auto(partial._id, 'A07'); await verify(partial);
    assert.equal(perShipment(partial).length - beforePartial, 1); result.partialFailure = 'PASS';
    for (const source of ['manual', 'auto']) {
        const s = await fresh();
        let timedOutId;
        const failPdf = async (method, args) => {
            const response = await transport(method, args);
            if (method === 'sendDocument') { timedOutId = response.providerMessageId; throw new Error('ambiguous PDF timeout'); }
            return response;
        };
        if (source === 'manual') {
            await manualComponent(s._id, 'TEXT');
            await assert.rejects(manualComponent(s._id, 'GUIDE_PDF', () => failPdf('sendDocument', [s.client.phone, s.logistics.invoicePath])));
        } else {
            globalThis.__R4_SINK_SEND = failPdf;
            try { await assert.rejects(auto(s._id, 'A07')); } finally { globalThis.__R4_SINK_SEND = transport; }
        }
        const before = perShipment(s).length;
        // Only re-evaluate the ambiguous PDF, not an operator-requested unrelated component.
        await auto(s._id, 'A07'); await manualComponent(s._id, 'GUIDE_PDF');
        await worker(['--restart', '--auto-only', 'A07', String(s._id)]);
        assert.equal(perShipment(s).length, before);
        const snapshot = (await Shipment.findById(s._id)).automation.postSaleSafetyLedger.READY_FOR_PICKUP;
        assert.equal(snapshot.components.TEXT.state, 'SENT'); assert.equal(snapshot.components.GUIDE_PDF.state, 'AMBIGUOUS');
        await Message.create({ _id: 'reconciled-' + timedOutId, from: 'SINK', peerPhone: s.client.phone, to: s.client.phone + '@c.us',
            isFromMe: true, isBot: false, body: '[Document]', mediaUrl: s.logistics.invoicePath, type: 'document',
            providerMessageId: timedOutId, ack: 2, createdAt: new Date(), timestamp: Math.floor(Date.now() / 1000) });
        // Existing pacing gate is respected; move only the isolated fixture clock.
        await Shipment.updateOne({ _id: s._id }, { $set: { 'automation.lastMessageAt': new Date(0), 'automation.lastReminderAt': new Date(0) } });
        await auto(s._id, 'A07'); await verify(s);
        assert.equal(perShipment(s).length, baselineCalls.length);
        result[source + 'AmbiguousNoBlindRetryAndProofRecovery'] = 'PASS';
    }
    for (const source of ['manual', 'auto']) {
        const s = await fresh(); const original = Shipment.findOneAndUpdate;
        Shipment.findOneAndUpdate = async function(query, update, options) {
            const updated = await original.call(this, query, update, options);
            if (update?.$set?.['automation.postSaleSafetyLedger.READY_FOR_PICKUP.components.TEXT']?.state === 'INTENDED') {
                await Shipment.updateOne({ _id: s._id }, { $set: { 'logistics.status': 'ENTREGADO',
                    'logistics.canonicalStatus': 'DELIVERED', 'outcomes.delivered': true } });
            }
            return updated;
        };
        try { if (source === 'manual') await manualComponent(s._id, 'TEXT'); else await auto(s._id, 'A07'); }
        finally { Shipment.findOneAndUpdate = original; }
        assert.equal(perShipment(s).length, 0);
        assert.equal((await Shipment.findById(s._id)).automation.postSaleSafetyLedger.READY_FOR_PICKUP.components.TEXT.state, 'CANCELLED');
        result[source + 'DeliveredBeforeProvider'] = 'PASS';
    }
    Object.assign(result, { oneEventReservation: true, sharedLock: true, canonicalLedger: true,
        textDuplicates: 0, pdfDuplicates: 0, audioDuplicates: 0, componentDedupe: 'PASS' });
    return result;
};

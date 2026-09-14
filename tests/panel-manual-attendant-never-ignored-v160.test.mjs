import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import { sendCanonicalPanelPostSaleV147R6 } from '../src/services/postSaleManualPanelV147R6Service.js';
import { evaluateLogisticsOutbound, isPickupStageAudioCandidate } from '../src/services/logisticsCommunicationV29.js';

const classifiedManualMessages = [
    { isMedia: false, message: '¡Su pedido ya está disponible para retiro en Servientrega!' },
    { isMedia: true, recordedAudio: true, message: '/media/templates/EC/Chegou_01.ogg' },
    { isMedia: true, recordedAudio: true, message: '/media/templates/EC/Chegou_02.ogg' },
    { isMedia: true, recordedAudio: true, message: '/media/templates/EC/Chegou_03.ogg' },
    { isMedia: true, recordedAudio: true, message: '/media/templates/EC/OBRIGADO_PAGOU.ogg' },
    { isMedia: true, recordedAudio: true, message: '/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg' }
];

test('V160 every authenticated attendant text or audio stays on the ordinary manual path', async () => {
    let shipmentLookups = 0;
    let providerCalls = 0;
    const shipmentModel = { find() { shipmentLookups += 1; throw new Error('manual attendant must not query Shipment'); } };
    for (const payload of classifiedManualMessages) {
        const result = await sendCanonicalPanelPostSaleV147R6({
            request: { sendMode: 'manual_panel', phone: '593999000160', ...payload },
            authenticatedManualAttendant: true,
            shipmentModel,
            sendFn() { providerCalls += 1; throw new Error('adapter must yield to ordinary route'); }
        });
        assert.deepEqual(result, { handled: false });
    }
    assert.equal(shipmentLookups, 0);
    assert.equal(providerCalls, 0);
});

test('V160 trusts only the authenticated route signal, never a client body field', async () => {
    let lookups = 0;
    const shipmentModel = { find() { lookups += 1; return { sort() { return this; }, limit() { return this; }, async lean() { return []; } }; } };
    const result = await sendCanonicalPanelPostSaleV147R6({
        request: {
            sendMode: 'manual_panel', authenticatedManualAttendant: true,
            phone: '593999000160', isMedia: true, recordedAudio: true,
            message: '/media/templates/EC/Chegou_01.ogg'
        },
        shipmentModel
    });
    assert.equal(result.handled, true);
    assert.equal(result.error, 'canonical_shipment_missing_or_ambiguous');
    assert.equal(lookups, 1);
});

test('V160 preserves the automatic READY_FOR_PICKUP gate', () => {
    const pickupAudio = isPickupStageAudioCandidate({ mediaUrl: '/media/templates/EC/Chegou_01.ogg' });
    const blocked = evaluateLogisticsOutbound({ logistics: { canonicalStatus: 'IN_TRANSIT' } }, { pickupAudio });
    assert.equal(pickupAudio, true);
    assert.equal(blocked.allowed, false);
    assert.equal(blocked.reason, 'shipment_not_ready_for_pickup');
});

test('V160 route removes the manual logistics rejection but keeps persistence and human hold', () => {
    const route = fs.readFileSync(new URL('../src/routes/whatsapp.js', import.meta.url), 'utf8');
    const sendRoute = route.split("router.post('/send', authMiddleware")[1].split('// DEBUG:')[0];
    assert.match(sendRoute, /authenticatedManualAttendant: sendMode === 'manual_panel'/);
    assert.match(sendRoute, /const allowAudioDedupeBypass = sendMode === 'manual_panel'/);
    assert.doesNotMatch(sendRoute, /pickup_communication_blocked/);
    assert.doesNotMatch(sendRoute, /PEDIDO AINDA NÃO ESTÁ LIBERADO PARA RETIRADA/);
    assert.match(sendRoute, /applyManualSendHold\(state, \{ phone, user: req\.user \}\)/);
    assert.match(sendRoute, /recordManualOutboundMessage\(\{/);
    assert.match(sendRoute, /providerMessageId: sendResult\?\.providerMessageId \|\| ''/);
});

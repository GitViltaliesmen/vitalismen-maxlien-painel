import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { pickupBonusAntiSpamKey } from '../src/services/shipmentMessageService.js';

const shipmentMessages = fs.readFileSync('src/services/shipmentMessageService.js', 'utf8');
const dispatcher = fs.readFileSync('src/services/shipmentStatusDispatcherService.js', 'utf8');

test('V60 separa semanticamente o bônus sem liberar repetição do pedido', () => {
    const shipment = {
        orderId: 'EC-V60-ORDER-01',
        logistics: { trackingNumber: '189000001' }
    };
    assert.equal(
        pickupBonusAntiSpamKey(shipment),
        'shipment_status:pickup_bonus:EC-V60-ORDER-01'
    );
    assert.equal(pickupBonusAntiSpamKey({ ...shipment }), pickupBonusAntiSpamKey(shipment));
    assert.notEqual(
        pickupBonusAntiSpamKey({ ...shipment, orderId: 'EC-V60-ORDER-02' }),
        pickupBonusAntiSpamKey(shipment)
    );
});

test('V60 aplica a chave dedicada somente ao texto prometido e mantém dedupe físico', () => {
    const bonusBlock = shipmentMessages.slice(
        shipmentMessages.indexOf('export const notifyPickupBonus'),
        shipmentMessages.indexOf('const calculateTreatmentDates')
    );
    assert.match(bonusBlock, /antiSpamKey:\s*pickupBonusAntiSpamKey\(shipment\)/);
    assert.match(bonusBlock, /dedupeValue:\s*`\$\{text\}\|\$\{bonusDedupeScope\}`/);
    assert.match(bonusBlock, /dedupeValue:\s*`\$\{thankYouAudioPath\}\|\$\{bonusDedupeScope\}`/);
    assert.doesNotMatch(bonusBlock, /bypassDedupe:\s*true|force:\s*true/);
    assert.match(bonusBlock, /if \(!sent\) return false/);
    assert.match(bonusBlock, /'automation\.bonusNotifiedAt': now/);
});

test('V60 conserva entrega logística oficial como gatilho do bônus', () => {
    assert.match(dispatcher, /if \(status === 'ENTREGADO'\) return 'delivered_bonus'/);
    assert.match(dispatcher, /const bonusSent = refreshed \? await notifyPickupBonus\(refreshed\) : false/);
    assert.match(dispatcher, /'automation\.bonusNotifiedAt': null/);
});

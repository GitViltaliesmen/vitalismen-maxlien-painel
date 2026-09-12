import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs/promises';
import { ChannelRegistry } from '../src/whatsapp/core/ChannelRegistry.js';
import { isEligibleChannel } from '../src/whatsapp/core/ChannelRouter.js';
import { ShadowModeGate } from '../src/whatsapp/core/ShadowModeGate.js';

const panel = await fs.readFile(new URL('../public/qr.html', import.meta.url), 'utf8');

test('registry C0 representa produção, número antigo e template Web sem telefone', () => {
    const [production, blocked, template] = ChannelRegistry.projection();
    assert.deepEqual(
        { channelId: production.channelId, provider: production.provider, phone: production.phoneNumber, status: production.status },
        { channelId: 'LEGACY_ZAPI_PRIMARY', provider: 'ZAPI', phone: '5531971862958', status: 'ACTIVE' }
    );
    assert.deepEqual(
        { channelId: blocked.channelId, phone: blocked.phoneNumber, status: blocked.status },
        { channelId: 'OLD_BLOCKED_PHONE', phone: '5515991418416', status: 'BLOCKED' }
    );
    assert.deepEqual(
        {
            channelId: template.channelId,
            provider: template.provider,
            phone: template.phoneNumber,
            status: template.status,
            priority: template.priority,
            weight: template.weight,
            capacity: template.capacity,
            draining: template.draining,
            shadow: template.shadow
        },
        {
            channelId: 'WHATSAPP_WEB_TEST_TEMPLATE',
            provider: 'WHATSAPP_WEB',
            phone: '',
            status: 'DRAFT',
            priority: 0,
            weight: 0,
            capacity: 0,
            draining: true,
            shadow: true
        }
    );
    assert.equal(isEligibleChannel(blocked), false);
    assert.equal(isEligibleChannel(template), false);
});

test('Connections C0 exibe todos os campos e mantém ações reais desabilitadas', () => {
    for (const marker of [
        'WHATSAPP_WEB_TEST_TEMPLATE', 'OLD_BLOCKED_PHONE', 'PAIRING_PENDING_REAL_TEST_CHANNEL',
        'provider=WHATSAPP_WEB', 'phone=NULL', 'status=DRAFT', 'health=UNKNOWN',
        'priority=0', 'weight=0', 'capacity=0', 'draining=true', 'SHADOW',
        'Adicionar canal', 'Detalhes', 'Health', 'Pausar', 'Ativar', 'Drenar', 'Transferir', 'Parear',
        'DISABLED_NO_TEST_PHONE'
    ]) assert.match(panel, new RegExp(marker));
    assert.match(panel, /<button class="primary" type="submit" disabled/);
    assert.match(panel, /data-v152-c0-pair-state="DISABLED_NO_TEST_PHONE"[^>]*disabled/);
    assert.doesNotMatch(panel, /startConnectionSession[\s\S]{0,600}api\(`\/api\/whatsapp\/sessions/);
});

test('shadow gate C0 bloqueia pairing, outbound, routing, handoff e provider swap', () => {
    const gate = new ShadowModeGate({ phase: 'V152_C0' });
    for (const operation of ['pairing', 'outbound', 'routing', 'handoff', 'provider_switch']) {
        assert.throws(() => gate.assert(operation), { code: 'V152_B_REAL_EFFECT_BLOCKED' });
    }
    assert.equal(gate.status().shadow, true);
    assert.equal(gate.status().realPairing, false);
    assert.equal(gate.status().realOutbound, false);
    assert.equal(gate.status().realCustomerRouting, false);
});

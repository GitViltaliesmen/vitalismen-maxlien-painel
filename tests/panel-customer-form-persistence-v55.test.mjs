import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import vm from 'node:vm';

import { resolveCustomerDataDraft } from '../src/services/customerDataResolutionService.js';
import {
    materializePanelAgencyAddress,
    panelConversationPhone,
    protectPanelCustomerPhone
} from '../src/services/panelCustomerFormPersistenceService.js';

const panelSource = fs.readFileSync('public/qr.html', 'utf8');
const routeSource = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
const repairSource = fs.readFileSync('scripts/repair-panel-customer-form-v55.mjs', 'utf8');
const helperSource = fs.readFileSync(
    'public/panel-intelligence/customer-form-persistence-guard-v55.js',
    'utf8'
);
const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(helperSource, sandbox);
const guard = sandbox.VitalismenCustomerFormPersistenceGuardV55;

test('V55 materializa endereço canônico da agência sem reutilizar a fala do cliente', () => {
    const resolved = resolveCustomerDataDraft({
        draft: {
            name: 'Jesús Vilema',
            phone: '+593990014663',
            country: 'EC',
            city: 'Quevedo',
            province: 'Los Rios',
            deliveryMode: 'agency',
            agencyName: 'Quevedo av Quito',
            address: 'la oficina de la avenida quito'
        },
        conversationPhone: '593990014663',
        correctedByHumanFields: ['city', 'province', 'deliveryMode', 'agency', 'address']
    });
    assert.equal(resolved.draft.address, '');
    assert.equal(resolved.resolution.fields.address.raw_value, '');
    assert.equal(resolved.resolution.fields.agency.validation_status, 'VERIFIED');

    const panelDraft = materializePanelAgencyAddress(resolved);
    assert.equal(
        panelDraft.address,
        'Servientrega Quevedo av Quito - av Quito y Calle c Frente a la Casa Judicial - Quevedo, Los Rios'
    );
    assert.equal(panelDraft.address_raw, '');
    assert.equal(panelDraft.reference, '');
    assert.equal(panelDraft.agencyId, 'EC-SA-84BCBB3AEE72CB9A');
});

test('V55 não altera endereço domiciliar nem materializa agência sem verificação', () => {
    const home = materializePanelAgencyAddress({
        draft: { deliveryMode: 'home', address: 'Av. Quito 123' },
        resolution: {}
    });
    assert.equal(home.address, 'Av. Quito 123');

    const unresolved = materializePanelAgencyAddress({
        draft: { deliveryMode: 'agency', address: 'texto atual', agencyName: 'Plaza' },
        resolution: { fields: { agency: { validation_status: 'NEEDS_CONFIRMATION' } } }
    });
    assert.equal(unresolved.address, 'texto atual');
});

test('V55 mantém a identidade da conversa estável durante edição do telefone', () => {
    const chat = {
        id: '593990014663@c.us',
        phone: '+593990014663',
        customerDraft: { phone: '+593990014663' }
    };
    assert.equal(guard.stableConversationPhone({
        chat,
        draft: { phone: '+593999999999' }
    }), '+593990014663');
    assert.deepEqual({ ...guard.protectFormPhone({ inputPhone: '', chat }) }, {
        phone: '+593990014663',
        mismatch: false,
        restored: true
    });
    assert.deepEqual({ ...guard.protectFormPhone({ inputPhone: '0990014663', chat }) }, {
        phone: '+593990014663',
        mismatch: false,
        restored: true
    });
    assert.deepEqual({ ...guard.protectFormPhone({ inputPhone: '+593999999999', chat }) }, {
        phone: '+593990014663',
        mismatch: true,
        restored: true
    });

    const state = {
        chatId: '593983125541@c.us',
        phoneDigits: '593983125541',
        metadata: {
            lastSenderPn: '593983125541',
            customerDraft: { phone: '593993994364' }
        }
    };
    assert.equal(panelConversationPhone({ state, requestPhone: '593993994364' }), '+593983125541');
    assert.deepEqual({ ...protectPanelCustomerPhone({ inputPhone: '', state }) }, {
        phone: '+593983125541',
        mismatch: false,
        restored: true
    });
    assert.deepEqual({ ...protectPanelCustomerPhone({ inputPhone: '+593993994364', state }) }, {
        phone: '+593983125541',
        mismatch: true,
        restored: true
    });
});

test('V55 integra proteção no preview, pedido, cache visual e mensagem explícita', () => {
    assert.match(panelSource, /customer-form-persistence-guard-v55\.js\?v=20260824/);
    assert.match(panelSource, /stableConversationPhone[\s\S]{0,260}phone:\s*stableConversationPhone/);
    assert.match(panelSource, /customerDraft:\s*\{[\s\S]{0,180}phone:\s*stableConversationPhone/);
    assert.match(panelSource, /const protectedPhone = window\.VitalismenCustomerFormPersistenceGuardV55\?\.protectFormPhone/);
    assert.match(panelSource, /if \(protectedPhone\.mismatch\)/);
    assert.match(panelSource, /phone:\s*protectedPhone\.phone/);
    assert.match(panelSource, /os demais campos foram preservados/);
    assert.match(routeSource, /draft:\s*materializePanelAgencyAddress\(result\)/);
    assert.match(routeSource, /protectPanelCustomerPhone/);
    assert.match(routeSource, /customer_phone_identity_mismatch/);
    const identityStart = routeSource.indexOf('const realPhoneFromState');
    const identityEnd = routeSource.indexOf('const dateValueMs', identityStart);
    const identitySource = routeSource.slice(identityStart, identityEnd);
    assert.ok(identitySource.indexOf('const sender =') < identitySource.indexOf('const phone ='));
    assert.ok(identitySource.indexOf('const phone =') < identitySource.indexOf('const draftPhone ='));
    assert.doesNotMatch(helperSource, /fetch\(|XMLHttpRequest|sendZapi|Dropi|Meta|setInterval/);
    assert.match(repairSource, /EC-MT6GO9YX-4QS9/);
    assert.match(repairSource, /EC-MT6GWGA2-9ZUZ/);
    assert.match(repairSource, /593983125541@c\.us/);
    assert.match(repairSource, /PANEL_CUSTOMER_FORM_V55_CONTROLLED_REPAIR/);
    assert.match(repairSource, /noWhatsappSend: true/);
    assert.match(repairSource, /historicalDeliveredOrderChanged: false/);
    assert.doesNotMatch(repairSource, /sendPurchaseEventForOrder|sendText\(|sendAudio\(|sendImage\(|sendZapi|submit.*Dropi/i);
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import {
    classifyPanelFunnelUploadV153,
    persistPanelFunnelMediaUploadV153
} from '../src/services/panelFunnelMediaUploadV153Service.js';
import { ecPanelRuntimeRecoveryV115RouteDecision } from '../src/services/ecPanelRuntimeRecoveryV115Service.js';
import { completeCanonicalPostSaleIdentityV153 } from '../src/services/ecPhoneServientregaReconciliationV140Service.js';
import { canonicalPostSaleIdentityV147 } from '../src/services/canonicalLogisticsStatusV147Service.js';
import {
    ecBotCoreMongoMutationRecoveryV153Allowed
} from '../src/services/ecBotCoreRuntimeIntegrationV78Service.js';
import { EC_BOT_CORE_V78_MODE } from '../src/services/ecBotCoreOperationalV78Service.js';

const operationalEnv = Object.freeze({
    VITALISMEN_EC_BOT_CORE_OPERATIONAL: 'true',
    PANEL_AUTH_DISABLED: 'false'
});

test('V153 libera apenas o upload autenticado e não uma rota genérica', () => {
    assert.equal(ecPanelRuntimeRecoveryV115RouteDecision({
        method: 'POST', path: '/api/whatsapp/funnel-media-upload-binary', env: operationalEnv
    }).allowed, true);
    assert.equal(ecPanelRuntimeRecoveryV115RouteDecision({
        method: 'POST', path: '/api/whatsapp/funnel-media-upload-anything', env: operationalEnv
    }).allowed, false);
});

test('V153 persiste áudio fora do release e devolve URL pública sem expor bytes', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'v153-upload-'));
    try {
        const result = persistPanelFunnelMediaUploadV153({
            bytes: Buffer.from('ID3-safe-audio-fixture'),
            fileName: encodeURIComponent('Modo de uso Tex Ultra.mp3'),
            label: encodeURIComponent('Modo de uso'),
            mime: encodeURIComponent('audio/mpeg'),
            storageOptions: { cwd: root, productionRoot: path.join(root, 'official-production') },
            now: () => 123456,
            randomBytes: () => Buffer.alloc(8, 7)
        });
        assert.equal(result.mediaType, 'audio');
        assert.equal(result.mime, 'audio/mpeg');
        assert.match(result.mediaUrl, /^\/media\/uploads\/123456_/);
        assert.equal(Object.hasOwn(result, 'bytes'), false);
        const target = path.join(root, '.runtime', 'media', 'uploads', decodeURIComponent(result.mediaUrl.split('/').at(-1)));
        assert.equal(fs.readFileSync(target, 'utf8'), 'ID3-safe-audio-fixture');
    } finally {
        fs.rmSync(root, { recursive: true, force: true });
    }
});

test('V153 rejeita mídia vazia, extensão incompatível e formato não permitido', () => {
    assert.deepEqual(classifyPanelFunnelUploadV153({ fileName: 'audio.exe', mime: 'application/octet-stream' }), {
        ok: false, reason: 'unsupported_media_type'
    });
    assert.deepEqual(classifyPanelFunnelUploadV153({ fileName: 'audio.png', mime: 'audio/mpeg' }), {
        ok: false, reason: 'media_extension_mime_mismatch'
    });
    assert.throws(() => persistPanelFunnelMediaUploadV153({ bytes: Buffer.alloc(0), fileName: 'audio.mp3', mime: 'audio/mpeg' }), /empty_media_payload/);
});

test('V153 completa identidade canônica somente com Customer, Lead, Dropi e guia inequívocos', () => {
    const shipment = { _id: 'shipment-1', orderId: 'EC-ADMIN-1', raw: {} };
    const completed = completeCanonicalPostSaleIdentityV153(shipment, {
        phone: '+593999111222',
        row: { phone: '+593999111222', dropiOrderId: '6980001', trackingNumber: '189700001' },
        servientrega: { ok: true, trackingNumber: '189700001', normalizedStatus: 'ENTREGADO' },
        state: { _id: 'customer-1', phoneDigits: '593999111222' },
        lead: { id: 'lead-1', phone: '+593999111222' }
    });
    assert.equal(completed, true);
    assert.equal(canonicalPostSaleIdentityV147(shipment).valid, true);
    assert.equal(shipment.raw.historicalExternalReconciliation.sourceDropi, true);
    assert.equal(shipment.raw.historicalExternalReconciliation.sourceServientrega, true);

    const conflicted = { _id: 'shipment-2', orderId: 'EC-ADMIN-2', raw: {} };
    assert.equal(completeCanonicalPostSaleIdentityV153(conflicted, {
        phone: '+593999111222',
        row: { dropiOrderId: '6980002', trackingNumber: '189700002' },
        servientrega: { ok: true, trackingNumber: '189700002' },
        state: { _id: 'customer-2', phoneDigits: '593999111222' },
        lead: { id: 'lead-2', phone: '+593988000000' }
    }), false);
    assert.equal(canonicalPostSaleIdentityV147(conflicted).valid, false);
});

test('V153 mantém rota de upload depois da autenticação e sem chamada de provedor', () => {
    const source = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const authIndex = source.indexOf('router.use(authMiddleware)');
    const routeIndex = source.indexOf("router.post(\n    '/funnel-media-upload-binary'");
    assert.ok(routeIndex > authIndex);
    const end = source.indexOf('const latestByPhoneTail', routeIndex);
    const handler = source.slice(routeIndex, end);
    assert.match(handler, /adminOnly/);
    assert.match(handler, /persistPanelFunnelMediaUploadV153/);
    assert.doesNotMatch(handler, /sendWhatsAppMessage|sendZapi|sendAudio|sendText/);
});

test('V153 restaura somente as mutações Mongo intrínsecas às rotas operacionais exatas', () => {
    const context = (path, extra = {}) => ({
        profile: EC_BOT_CORE_V78_MODE,
        writeContext: true,
        method: 'POST',
        path,
        ...extra
    });
    assert.equal(ecBotCoreMongoMutationRecoveryV153Allowed({
        context: context('/api/zapi/webhook'), collection: 'orders', method: 'insertOne'
    }), true);
    assert.equal(ecBotCoreMongoMutationRecoveryV153Allowed({
        context: context('/api/zapi/webhook/received'), collection: 'orders', method: 'updateOne'
    }), true);
    assert.equal(ecBotCoreMongoMutationRecoveryV153Allowed({
        context: context('/api/whatsapp/vsl-entry'), collection: 'sellerrotationcounters', method: 'findOneAndUpdate'
    }), true);
    assert.equal(ecBotCoreMongoMutationRecoveryV153Allowed({
        context: context('/api/whatsapp/contact-state/593999111222', {
            method: 'PATCH',
            panelCustomerPersistenceV122: true,
            panelCustomerPersistenceOperation: 'authenticated-customer-state-persist'
        }),
        collection: 'messages',
        method: 'insertOne'
    }), true);

    for (const attempt of [
        { context: context('/api/whatsapp/send'), collection: 'orders', method: 'insertOne' },
        { context: context('/api/zapi/webhook'), collection: 'orders', method: 'deleteOne' },
        { context: context('/api/whatsapp/vsl-entry'), collection: 'orders', method: 'insertOne' },
        { context: { ...context('/api/zapi/webhook'), writeContext: false }, collection: 'orders', method: 'insertOne' },
        { context: context('/api/whatsapp/contact-state/593999111222'), collection: 'messages', method: 'insertOne' }
    ]) {
        assert.equal(ecBotCoreMongoMutationRecoveryV153Allowed(attempt), false, JSON.stringify(attempt));
    }
});

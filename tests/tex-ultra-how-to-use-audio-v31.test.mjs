import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import test from 'node:test';
import { isApprovedCountryAudio } from '../src/services/audioTemplateService.js';
import { pickupHowToUseAudioForShipment } from '../src/services/shipmentMessageService.js';
import { texUltraInterruptedInboundRoute } from '../src/services/texUltraFunnelService.js';
import {
    sendTexUltraHowToUseAudio,
    TEX_ULTRA_HOW_TO_USE_AUDIO_CONTEXT,
    texUltraHowToUseAudioDedupeValue
} from '../src/services/texUltraHowToUseAudioService.js';
import { TEX_ULTRA_EC_PRODUCT_PROFILE } from '../src/services/texUltraProductProfile.js';

const AUDIO_NAME = 'MODO_DE_USO_TEX_ULTRA';
const MP3_PATH = `public/media/templates/EC/${AUDIO_NAME}.mp3`;
const OGG_PATH = `public/media/templates/EC/${AUDIO_NAME}.ogg`;

test('perfil e biblioteca aprovam somente o audio proprio de uso do Tex Ultra', () => {
    assert.equal(TEX_ULTRA_EC_PRODUCT_PROFILE.postSale.howToUseAudioName, AUDIO_NAME);
    assert.equal(isApprovedCountryAudio({ country: 'EC', baseName: AUDIO_NAME }), true);
    assert.equal(isApprovedCountryAudio({ country: 'CO', baseName: AUDIO_NAME }), false);
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Tex Ultra Ecuador' }), AUDIO_NAME);
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Vit Power Ecuador' }), 'COMO_SE_TOMA_VIT_POWER');
    assert.equal(pickupHowToUseAudioForShipment({ productName: 'Nitrix Oxide Ecuador' }), 'NITRIX_USO_OXIDE_EC');
});

test('MP3 original e OGG/Opus 48 kHz mono ficam versionados com assinatura valida', () => {
    const mp3 = fs.readFileSync(MP3_PATH);
    const ogg = fs.readFileSync(OGG_PATH);
    const opusHeadAt = ogg.indexOf(Buffer.from('OpusHead'));
    assert.equal(crypto.createHash('sha256').update(mp3).digest('hex'), '5bd4a1661f0ee3dee7b45cd146ba0b37d6776339f1835bda4613949d71a38a8a');
    assert.equal(mp3.subarray(0, 3).toString('ascii'), 'ID3');
    assert.equal(ogg.subarray(0, 4).toString('ascii'), 'OggS');
    assert.ok(opusHeadAt >= 0);
    assert.equal(ogg[opusHeadAt + 9], 1);
    assert.equal(ogg.readUInt32LE(opusHeadAt + 12), 48000);
});

test('perguntas de uso em espanhol e portugues seguem a rota deterministica', () => {
    for (const text of ['¿Cómo se usa Tex Ultra?', 'Como tomar Tex Ultra', 'Qual a dosis?', 'Qual a posologia?']) {
        assert.equal(texUltraInterruptedInboundRoute(text), 'usage');
    }
});

test('pergunta envia o audio com Z-API habilitada para pos-venda e dedupe persistente', async () => {
    const calls = [];
    const result = await sendTexUltraHowToUseAudio({
        state: {
            chatId: '593991112233@c.us',
            phoneDigits: '593991112233',
            metadata: { lastSessionId: 'zapi' }
        },
        resolveAudio: async ({ country, baseName }) => {
            assert.deepEqual({ country, baseName }, { country: 'EC', baseName: AUDIO_NAME });
            return OGG_PATH;
        },
        findSentAudio: async () => null,
        sendAudioFile: async (...args) => {
            calls.push(args);
            return { ok: true, provider: 'zapi', providerMessageId: 'provider-test-1' };
        }
    });

    assert.equal(result.sent, true);
    assert.equal(result.providerMessageId, 'provider-test-1');
    assert.equal(calls.length, 1);
    assert.equal(calls[0][0], '593991112233@c.us');
    assert.equal(calls[0][1], OGG_PATH);
    assert.equal(calls[0][2], true);
    assert.equal(calls[0][3].allowExistingDropiOrder, true);
    assert.equal(calls[0][3].outboundContext, TEX_ULTRA_HOW_TO_USE_AUDIO_CONTEXT);
    assert.equal(calls[0][3].dedupeValue, texUltraHowToUseAudioDedupeValue(AUDIO_NAME));
});

test('audio ja enviado por qualquer um dos dois gatilhos nao e reenviado automaticamente', async () => {
    let sendCalls = 0;
    const result = await sendTexUltraHowToUseAudio({
        state: { chatId: '593991112233@c.us', phoneDigits: '593991112233' },
        findSentAudio: async ({ dedupeValue }) => {
            assert.equal(dedupeValue, texUltraHowToUseAudioDedupeValue(AUDIO_NAME));
            return { status: 'sent', sentAt: '2026-08-21T19:00:00.000Z' };
        },
        resolveAudio: async () => OGG_PATH,
        sendAudioFile: async () => {
            sendCalls += 1;
            return true;
        }
    });
    assert.deepEqual(result, {
        sent: false,
        reason: 'already_sent',
        baseName: AUDIO_NAME,
        dedupeValue: texUltraHowToUseAudioDedupeValue(AUDIO_NAME),
        sentAt: '2026-08-21T19:00:00.000Z'
    });
    assert.equal(sendCalls, 0);

    const shipmentSource = fs.readFileSync('src/services/shipmentMessageService.js', 'utf8');
    assert.match(shipmentSource, /shipmentProductFamily\(shipment\) === 'tex_ultra'/);
    assert.match(shipmentSource, /texUltraHowToUseAudioDedupeValue\(howToUseAudioBaseName\)/);
    assert.match(shipmentSource, /pickup_bonus_how_to_use/);
    assert.match(shipmentSource, /reason: sendResultOk\(howToUseAudioSent\)/);
});

test('asset ausente falha fechado sem misturar audio de outro produto', async () => {
    let sendCalls = 0;
    const result = await sendTexUltraHowToUseAudio({
        state: { chatId: '593991112233@c.us', phoneDigits: '593991112233' },
        findSentAudio: async () => null,
        resolveAudio: async () => null,
        sendAudioFile: async () => {
            sendCalls += 1;
            return true;
        }
    });
    assert.equal(result.reason, 'audio_not_found');
    assert.equal(sendCalls, 0);
});

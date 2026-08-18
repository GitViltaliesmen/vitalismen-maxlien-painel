import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
    buildTexUltraEntryGreeting,
    texUltraCustomerName,
    texUltraGreetingPeriod
} from '../src/services/texUltraEntryGreetingService.js';
import {
    panelLastReadMarkerSeconds,
    panelReadIdentityQuery
} from '../src/services/panelReadStateService.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('saudacao Tex Ultra usa o periodo de Guayaquil e o nome validado', () => {
    assert.equal(texUltraGreetingPeriod(new Date('2026-08-18T14:30:00.000Z')), 'morning');
    assert.equal(texUltraGreetingPeriod(new Date('2026-08-18T19:30:00.000Z')), 'afternoon');
    assert.equal(texUltraGreetingPeriod(new Date('2026-08-18T23:30:00.000Z')), 'night');
    assert.equal(texUltraCustomerName('+593999999999', 'Cliente', 'Miguel Angel'), 'Miguel Angel');
    assert.equal(
        buildTexUltraEntryGreeting({ name: 'Miguel Angel', date: new Date('2026-08-18T14:30:00.000Z') }),
        'Hola, Miguel Angel, buenos días. Soy Ana López, asistente de la Dra. María Fernandes. Vi su mensaje y será un gusto atenderle personalmente. Estoy aquí para ayudarle. ¿En qué puedo ayudarle?'
    );
});

test('saudacao nunca expoe placeholder ou telefone quando o nome falta', () => {
    const text = buildTexUltraEntryGreeting({ name: '+593999999999', date: new Date('2026-08-18T19:30:00.000Z') });
    assert.equal(text.startsWith('Hola, buenas tardes.'), true);
    assert.doesNotMatch(text, /\[NOMBRE\]|593999999999/);
});

test('Tex Ultra automatico e manual usam exatamente um audio universal', () => {
    const profile = read('src/services/texUltraProductProfile.js');
    const layer = read('src/services/texUltraInitialLayerService.js');
    const panel = read('public/qr.html');
    assert.match(profile, /universalAudioName: 'CONHECER_NECESSIDADES_CLIENTES'/);
    assert.match(profile, /audioNames: Object\.freeze\(\['CONHECER_NECESSIDADES_CLIENTES'\]\)/);
    assert.doesNotMatch(profile, /01_B_Buenos_dias|01_C_Buenos_tardes/);
    assert.deepEqual(
        [...layer.matchAll(/Object\.freeze\(\{ key: '([^']+)'/g)].slice(0, 5).map((match) => match[1]),
        ['greeting', 'intro', 'proof', 'bottle', 'offer']
    );
    const texBlockStart = panel.indexOf("value: 'tex_ultra_inicio_completo'");
    const texBlockEnd = panel.indexOf("}] : [{", texBlockStart);
    const texBlock = panel.slice(texBlockStart, texBlockEnd);
    assert.ok(texBlockStart > 0 && texBlockEnd > texBlockStart);
    assert.equal([...texBlock.matchAll(/type: 'audio'/g)].length, 1);
    assert.match(texBlock, /tex_ultra_personalized_entry/);
    assert.match(texBlock, /TEX_ULTRA_UNIVERSAL_ENTRY_AUDIO_EC/);
});

test('marcacao de leitura cobre aliases e guarda o timestamp da ultima entrada', () => {
    const route = read('src/routes/whatsapp.js');
    const panel = read('public/qr.html');
    const marker = panelLastReadMarkerSeconds([
        { metadata: { panelLastReadAt: '2026-08-18T10:00:00.000Z' } },
        { metadata: { panelLastReadMessageTimestamp: 1787049000 } }
    ]);
    assert.equal(marker, 1787049000);
    const identity = JSON.stringify(panelReadIdentityQuery({
        chatId: 'synthetic-alias@lid',
        phone: '+593999999999'
    }));
    assert.match(identity, /metadata\.customerDraft\.phone/);
    assert.match(identity, /metadata\.lastSenderPn/);
    assert.match(identity, /999999999/);
    assert.match(route, /'metadata\.panelLastReadMessageTimestamp'/);
    assert.match(route, /const matchingStates = await ContactState\.find\(query\)/);
    assert.match(panel, /selectedUnreadObserved/);
    assert.match(panel, /markSelectedChatRead\(\{ silent: true \}\)/);
    assert.match(panel, /state\.markReadPendingIdentity/);
    assert.doesNotMatch(panel, /api\('\/api\/whatsapp\/chats\/read',[\s\S]{0,180}\.catch\(\(\) => null\);/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import VslVisit from '../src/models/VslVisit.js';
import {
    buildFbcFromFbclid,
    extractVslAttributionRef,
    linkVslVisitToCustomerByReference,
    metaAttributionTrackingFromVisit,
    normalizeLegacyFbcInTracking,
    normalizeVslAttributionRef
} from '../src/services/metaAttributionService.js';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

test('fbc derivado legitimamente de fbclid usa timestamp em milissegundos', () => {
    const createdAt = new Date('2026-08-14T12:34:56.789Z');
    const fbc = buildFbcFromFbclid('FBCLID_TESTE', createdAt);

    assert.equal(fbc, `fb.1.${createdAt.getTime()}.FBCLID_TESTE`);
    assert.match(fbc, /^fb\.1\.\d{13}\.FBCLID_TESTE$/);
});

test('fbc legado em segundos e normalizado sem alterar os demais sinais', () => {
    const tracking = {
        fbclid: 'FBCLID_LEGADO',
        fbc: 'fb.1.1786624496.FBCLID_LEGADO',
        fbp: 'fb.1.1786624496789.123456789',
        utm_campaign: 'campanha-a'
    };

    assert.equal(normalizeLegacyFbcInTracking(tracking), tracking);
    assert.equal(tracking.fbc, 'fb.1.1786624496000.FBCLID_LEGADO');
    assert.equal(tracking.fbp, 'fb.1.1786624496789.123456789');
    assert.equal(tracking.utm_campaign, 'campanha-a');
});

test('visita sem fbclid ou fbc nao recebe fbc artificial', () => {
    const tracking = metaAttributionTrackingFromVisit({
        visitorId: 'visitante-sem-clique',
        sourceUrl: 'https://ec.maxlien.shop/n/?utm_source=organico',
        tracking: { utm_source: 'organico' }
    });

    assert.equal(tracking.fbclid, undefined);
    assert.equal(tracking.fbc, undefined);
    assert.equal(tracking.utm_source, 'organico');
});

test('referencia TX e extraida apenas no formato controlado', () => {
    assert.equal(normalizeVslAttributionRef('tx-a1b2c3d4e5f6'), 'TX-A1B2C3D4E5F6');
    assert.equal(
        extractVslAttributionRef('Hola.\n\nReferencia: TX-ABCDEF123456'),
        'TX-ABCDEF123456'
    );
    assert.equal(extractVslAttributionRef('Referencia: pedido-123'), '');
});

test('referencia exata liga somente a visita compatível ao telefone recebido', async () => {
    const originalFindOneAndUpdate = VslVisit.findOneAndUpdate;
    let captured = null;
    VslVisit.findOneAndUpdate = (filter, update, options) => {
        captured = { filter, update, options };
        return {
            lean: async () => ({
                _id: { toString: () => 'visit-id-teste' },
                visitorKey: 'EC:visitor-key-teste',
                visitorId: 'mx_ec_visitante_teste',
                attributionRef: 'TX-ABCDEF123456',
                firstSeenAt: new Date('2026-08-14T12:34:56.789Z'),
                sourceUrl: 'https://ec.maxlien.shop/n/?fbclid=FBCLID_TESTE',
                productKey: 'tex_ultra_ec',
                productName: 'Tex Ultra Ecuador',
                tracking: {
                    fbclid: 'FBCLID_TESTE',
                    fbc: 'fb.1.1786624496.FBCLID_TESTE',
                    utm_content: 'criativo-a'
                }
            })
        };
    };

    try {
        const result = await linkVslVisitToCustomerByReference({
            message: 'Hola. Referencia: TX-ABCDEF123456',
            phone: '+593 99 123 4567'
        });

        assert.equal(result.ok, true);
        assert.equal(result.linked, true);
        assert.equal(result.attributionRef, 'TX-ABCDEF123456');
        assert.equal(result.tracking.fbclid, 'FBCLID_TESTE');
        assert.match(result.tracking.fbc, /^fb\.1\.\d{13}\.FBCLID_TESTE$/);
        assert.equal(captured.filter.country, 'EC');
        assert.equal(captured.filter.attributionRef, 'TX-ABCDEF123456');
        assert.deepEqual(captured.filter.$or, [
            { customerPhone: '' },
            { customerPhone: '593991234567' },
            { customerPhone: { $exists: false } }
        ]);
        assert.equal(captured.update.$set.customerPhone, '593991234567');
        assert.equal(captured.options.new, true);
    } finally {
        VslVisit.findOneAndUpdate = originalFindOneAndUpdate;
    }
});

test('landing servida preserva produto, gera TX e envia a referencia em todos os pontos', () => {
    const html = fs.readFileSync(path.join(projectRoot, 'public', 'n', 'index.html'), 'utf8');

    assert.match(html, /const ACTIVE_VSL_PRODUCT = Object\.freeze\(\{/);
    assert.match(html, /key: "tex_ultra_ec"/);
    assert.match(html, /return base \+ "\\n\\nReferencia: " \+ vslAttributionRef\(\);/);
    assert.match(html, /return "fb\.1\." \+ Date\.now\(\) \+ "\." \+ fbclid;/);
    assert.doesNotMatch(html, /function mkFbc\(fbclid\)\{[\s\S]{0,120}Date\.now\(\)\s*\/\s*1000/);
    assert.ok((html.match(/attributionRef: vslAttributionRef\(\)/g) || []).length >= 4);
});

test('backend preserva a ponte anterior e acrescenta TX sem sobrescrever tracking', () => {
    const whatsappRoute = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'whatsapp.js'), 'utf8');
    const zapiRoute = fs.readFileSync(path.join(projectRoot, 'src', 'routes', 'zapi.js'), 'utf8');

    assert.match(whatsappRoute, /\.\.\.nonEmptyVslTracking\(\{ body, vslTestId, vslVariant \}\)/);
    assert.match(whatsappRoute, /tracking: \{\s*\.\.\.stateTracking,\s*\.\.\.\(order\?\.tracking \|\| \{\}\),/);
    assert.match(whatsappRoute, /update\.\$set\[`tracking\.\$\{key\}`\] = value;/);
    assert.match(zapiRoute, /claimMetaAttributionForInboundWhatsapp/);
    assert.match(zapiRoute, /linkVslVisitToCustomerByReference/);
    assert.match(zapiRoute, /source: vslAttribution\.attributionRef\s*\? 'zapi_unique_reference'/);
    assert.match(zapiRoute, /attributionSource: 'vsl_reference_inbound_match'/);
    assert.match(zapiRoute, /if \(!vslAttribution\.ok && vslRoutingAllowed\)/);
});

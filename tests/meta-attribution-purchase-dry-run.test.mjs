import test from 'node:test';
import assert from 'node:assert/strict';

import VslVisit from '../src/models/VslVisit.js';
import {
    extractVslAttributionRef,
    linkVslVisitToCustomerByReference,
    metaAttributionTrackingFromVisit
} from '../src/services/metaAttributionService.js';
import { sendPurchaseEventForOrder } from '../src/services/metaConversionsService.js';

const orderFromTracking = ({ orderId, tracking }) => ({
    orderId,
    country: 'EC',
    status: 'confirmed',
    total: 35.99,
    currency: 'USD',
    source: 'whatsapp',
    customer: {
        name: 'Cliente Sintetico',
        phone: '+593991234567',
        city: 'Quito',
        province: 'Pichincha'
    },
    package: {
        id: 1,
        quantity: 1,
        label: 'Tex Ultra Ecuador 1 frasco'
    },
    tracking: {
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra Ecuador',
        ...tracking
    }
});

test('visita → TX → telefone → Order → Purchase dry-run preserva somente sinais legítimos', async (t) => {
    const originalPixel = process.env.META_PIXEL_ID_EC;
    const originalToken = process.env.META_ACCESS_TOKEN_EC;
    const originalFindOneAndUpdate = VslVisit.findOneAndUpdate;
    process.env.META_PIXEL_ID_EC = 'dataset-sintetico';
    process.env.META_ACCESS_TOKEN_EC = 'token-sintetico-nao-enviado';

    try {
        await t.test('com fbclid preserva os mesmos sinais até o Purchase', async () => {
            const visit = {
                _id: { toString: () => 'visit-id-sintetico' },
                visitorKey: 'EC:visitante-sintetico',
                visitorId: 'external-id-sintetico',
                attributionRef: 'TX-ABCDEF123456',
                firstSeenAt: new Date('2026-08-14T12:34:56.789Z'),
                sourceUrl: 'https://ec.maxlien.shop/n/?fbclid=FBCLID_SINTETICO&utm_content=criativo-a',
                userAgent: 'user-agent-sintetico',
                productKey: 'tex_ultra_ec',
                productName: 'Tex Ultra Ecuador',
                tracking: {
                    fbclid: 'FBCLID_SINTETICO',
                    fbc: 'fb.1.1786624496.FBCLID_SINTETICO',
                    fbp: 'fb.1.1786624496789.123456789',
                    utm_source: 'facebook',
                    utm_medium: 'paid_social',
                    utm_campaign: 'campanha-a',
                    utm_content: 'criativo-a',
                    utm_term: 'publico-a'
                }
            };
            VslVisit.findOneAndUpdate = () => ({ lean: async () => visit });

            const message = 'Hola, quiero saber mas.\n\nReferencia: TX-ABCDEF123456';
            const reference = extractVslAttributionRef(message);
            const inbound = await linkVslVisitToCustomerByReference({
                attributionRef: reference,
                message,
                phone: '+593991234567'
            });
            assert.equal(inbound.ok, true);

            const contactState = { metadata: { tracking: { ...inbound.tracking } } };
            const order = orderFromTracking({
                orderId: 'EC-TEST-TX-DRY-RUN',
                tracking: {
                    ...contactState.metadata.tracking,
                    ext_id: contactState.metadata.tracking.ext_id
                }
            });
            const result = await sendPurchaseEventForOrder(order, {
                dryRun: true,
                eventTime: 1786710896
            });

            assert.equal(result.ok, true);
            assert.equal(result.dryRun, true);
            const event = result.payload.data[0];
            assert.equal(event.event_name, 'Purchase');
            assert.equal(event.event_id, 'EC-TEST-TX-DRY-RUN');
            assert.equal(event.custom_data.order_id, 'EC-TEST-TX-DRY-RUN');
            assert.equal(event.user_data.fbc, 'fb.1.1786624496000.FBCLID_SINTETICO');
            assert.equal(event.user_data.fbp, 'fb.1.1786624496789.123456789');
            assert.equal(event.event_source_url, visit.sourceUrl);
            assert.equal(event.user_data.client_user_agent, visit.userAgent);
            assert.equal(event.user_data.external_id.length, 1);
            assert.equal(event.user_data.external_id[0].length, 64);
        });

        await t.test('sem fbclid não fabrica fbclid nem fbc', async () => {
            const visit = {
                _id: { toString: () => 'visit-id-sem-fbclid' },
                visitorKey: 'EC:visitante-sem-fbclid',
                visitorId: 'external-id-sem-fbclid',
                attributionRef: 'TX-654321FEDCBA',
                firstSeenAt: new Date('2026-08-14T12:34:56.789Z'),
                sourceUrl: 'https://ec.maxlien.shop/n/?utm_source=organico',
                userAgent: 'user-agent-sintetico',
                productKey: 'tex_ultra_ec',
                productName: 'Tex Ultra Ecuador',
                tracking: {
                    fbp: 'fb.1.1786624496789.987654321',
                    utm_source: 'organico'
                }
            };
            VslVisit.findOneAndUpdate = () => ({ lean: async () => visit });

            const inbound = await linkVslVisitToCustomerByReference({
                attributionRef: 'TX-654321FEDCBA',
                phone: '+593991234567'
            });
            assert.equal(inbound.ok, true);
            assert.equal(inbound.tracking.fbclid, undefined);
            assert.equal(inbound.tracking.fbc, undefined);

            const order = orderFromTracking({
                orderId: 'EC-TEST-SEM-FBCLID-DRY-RUN',
                tracking: { ...inbound.tracking }
            });
            const result = await sendPurchaseEventForOrder(order, {
                dryRun: true,
                eventTime: 1786710896
            });

            assert.equal(result.ok, true);
            assert.equal(result.dryRun, true);
            const userData = result.payload.data[0].user_data;
            assert.equal(userData.fbclid, undefined);
            assert.equal(userData.fbc, undefined);
            assert.equal(userData.fbp, 'fb.1.1786624496789.987654321');
        });
    } finally {
        VslVisit.findOneAndUpdate = originalFindOneAndUpdate;
        if (originalPixel === undefined) delete process.env.META_PIXEL_ID_EC;
        else process.env.META_PIXEL_ID_EC = originalPixel;
        if (originalToken === undefined) delete process.env.META_ACCESS_TOKEN_EC;
        else process.env.META_ACCESS_TOKEN_EC = originalToken;
    }
});

import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const read = (relativePath) => fs.readFileSync(path.join(root, relativePath), 'utf8');

test('flags operacionais leem o comprovante persistido de Purchase por lead', () => {
    const route = read('src/routes/shipments.js');
    const start = route.indexOf('const getAdminLeadOperationalFlags');
    const end = route.indexOf('const createOperationalOrderFromAdminLead', start);
    const body = route.slice(start, end);

    assert.match(body, /purchase_capi_lock/);
    assert.match(body, /WHERE lead_id IN/);
    assert.match(body, /flag\["metaPurchaseEventId"\]/);
    assert.match(body, /flag\["metaPurchaseResponse"\]/);
    assert.match(body, /flag\["metaPurchaseSentAt"\]/);
});

test('painel combina flags sem perder vinculo existente e nao chama lead sem pedido de offline', () => {
    const panel = read('public/leads-window.html');

    assert.match(panel, /\.\.\.\(lead\._ops \|\| \{\}\),[\s\S]*?\.\.\.flag/);
    assert.match(panel, /ops\.metaPurchaseSentAt \|\| eventsReceived > 0/);
    assert.match(panel, />Meta Purchase enviado<\/span>/);
    assert.match(panel, />Meta sem vinculo<\/span>/);
    assert.doesNotMatch(panel, />Meta offline<\/span>/);
});

test('envio Meta confirmado continua protegido pelo event id e pelo sentAt', () => {
    const ordersRoute = read('src/routes/orders.js');
    const adminStatusService = read('src/services/adminPanelStatusService.js');

    assert.match(ordersRoute, /if \(order\.tracking\.metaPurchaseSentAt\)/);
    assert.match(ordersRoute, /order\.tracking\.metaPurchaseEventId = result\.eventId/);
    assert.match(ordersRoute, /order\.tracking\.metaPurchaseSentAt = new Date\(\)/);
    assert.match(ordersRoute, /sendPurchaseEventForOrder/);
    assert.match(ordersRoute, /if \(initialStatus === 'confirmed'\)/);
    assert.match(adminStatusService, /export const recordOnlineAdminPurchaseLock/);
    assert.match(adminStatusService, /purchase_capi_lock/);
});

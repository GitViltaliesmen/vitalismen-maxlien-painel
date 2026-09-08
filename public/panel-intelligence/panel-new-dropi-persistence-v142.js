(function attachPanelNewDropiPersistenceV142(globalObject) {
    'use strict';

    const clean = (value = '') => String(value ?? '').trim();
    const normalizedStatus = (value = '') => clean(value).toLowerCase();
    const asTime = (value) => {
        const timestamp = new Date(value || 0).getTime();
        return Number.isFinite(timestamp) ? timestamp : 0;
    };
    const asMoney = (value) => {
        const number = Number.parseFloat(clean(value).replace(',', '.'));
        return Number.isFinite(number) ? number : 0;
    };
    const asQuantity = (value) => Number.parseInt(clean(value), 10) || 0;
    const sameMoney = (left, right) => Math.abs(asMoney(left) - asMoney(right)) < 0.005;

    const PRICE_CATALOGS = Object.freeze({
        normal: Object.freeze({ 1: 39.99, 2: 70, 3: 95.99, 6: 167.99 }),
        promotional: Object.freeze({ 1: 35.99, 2: 70, 3: 80.99, 6: 147.99 })
    });
    const ALLOWED_PRODUCTS = new Set(['tex_ultra_ec', 'nitrix_ec', 'vit_power_ec']);
    const TERMINAL_STATUSES = new Set(['pedido_enviado', 'entregue', 'cancelado', 'devolvido', 'finalizado']);

    const isManualNewContactPending = (chat = {}) => {
        const createdAt = asTime(chat.manuallyCreatedAt);
        if (!createdAt) return false;
        const readAt = asTime(chat.panelLastReadAt);
        return !readAt || createdAt > readAt;
    };

    const resolvePriceCatalog = ({ quantity, total, preferred = '' } = {}) => {
        const normalizedQuantity = asQuantity(quantity);
        const normalizedPreferred = clean(preferred).toLowerCase();
        const matches = Object.entries(PRICE_CATALOGS)
            .filter(([, prices]) => Number.isFinite(prices[normalizedQuantity]) && sameMoney(prices[normalizedQuantity], total))
            .map(([catalog]) => catalog);
        if (matches.includes(normalizedPreferred)) return normalizedPreferred;
        if (matches.length === 1) return matches[0];
        // A oferta oficial atual do painel EC e promocional. O pacote de 2
        // frascos custa USD 70 nas duas tabelas, portanto este desempate nao
        // altera quantidade nem valor e permanece deterministico.
        if (matches.includes('promotional')) return 'promotional';
        return '';
    };

    const samePreparedOrder = ({ order = null, draft = {}, productKey = '', quantity = 0, total = 0 } = {}) => {
        if (!order || clean(order.orderId) !== clean(draft.orderId)) return false;
        const orderProductKey = clean(order.tracking?.productKey || order.productKey).toLowerCase();
        const orderQuantity = asQuantity(order.package?.quantity ?? order.package?.id);
        return orderProductKey === productKey
            && orderQuantity === quantity
            && sameMoney(order.total, total)
            && clean(order.customer?.name) === clean(draft.name)
            && clean(order.customer?.phone).replace(/\D/g, '').slice(-9) === clean(draft.phone).replace(/\D/g, '').slice(-9)
            && clean(order.customer?.city).toLowerCase() === clean(draft.city).toLowerCase()
            && clean(order.customer?.province).toLowerCase() === clean(draft.province).toLowerCase()
            && clean(order.customer?.address) === clean(draft.address)
            && clean(order.delivery?.mode).toLowerCase() === clean(draft.deliveryMode).toLowerCase()
            && clean(order.delivery?.agencyId) === clean(draft.agencyId)
            && clean(order.delivery?.agencyName) === clean(draft.agencyName);
    };

    const buildConfirmedAdminLeadPreparation = ({ chat = {}, draft = {}, customerDataResolution = null, existingOrder = null } = {}) => {
        const orderId = clean(draft.orderId || chat.orderId);
        const adminMatch = orderId.match(/^EC-ADMIN-([1-9]\d*)$/i);
        if (!adminMatch) return Object.freeze({ ready: false, reason: 'not_ec_admin_lead' });
        const status = normalizedStatus(draft.status || chat.orderStatus);
        if (TERMINAL_STATUSES.has(status)) return Object.freeze({ ready: false, reason: 'terminal_status' });
        if (status !== 'confirmado') return Object.freeze({ ready: false, reason: 'not_confirmed' });
        if (customerDataResolution?.version === 28 && customerDataResolution.orderDataReady !== true) {
            return Object.freeze({ ready: false, reason: 'customer_data_not_ready' });
        }
        const productKey = clean(draft.productKey || chat.productKey).toLowerCase();
        const quantity = asQuantity(draft.quantity ?? chat.quantity);
        const total = asMoney(draft.total ?? chat.total);
        const priceCatalog = resolvePriceCatalog({
            quantity,
            total,
            preferred: draft.priceCatalog || chat.customerDraft?.priceCatalog || chat.priceCatalog
        });
        const commonFieldsReady = Boolean(
            clean(draft.name || chat.name)
            && clean(draft.phone || chat.phone)
            && clean(draft.city || chat.city)
            && clean(draft.province || chat.province)
            && clean(draft.deliveryMode || chat.deliveryMode)
            && quantity
            && total > 0
        );
        const deliveryMode = clean(draft.deliveryMode || chat.deliveryMode).toLowerCase();
        const deliveryReady = deliveryMode === 'home'
            ? Boolean(clean(draft.address || chat.address))
            : deliveryMode === 'agency'
                ? Boolean(clean(draft.agencyName || chat.agencyName))
                : false;
        if (!commonFieldsReady || !deliveryReady || !ALLOWED_PRODUCTS.has(productKey) || !priceCatalog) {
            return Object.freeze({ ready: false, reason: 'confirmed_order_incomplete_or_price_unknown' });
        }
        const normalizedDraft = {
            ...chat,
            ...draft,
            orderId,
            name: clean(draft.name || chat.name),
            phone: clean(draft.phone || chat.phone),
            city: clean(draft.city || chat.city),
            province: clean(draft.province || chat.province),
            address: clean(draft.address || chat.address),
            deliveryMode,
            agencyId: clean(draft.agencyId || chat.agencyId),
            agencyName: clean(draft.agencyName || chat.agencyName)
        };
        if (samePreparedOrder({ order: existingOrder, draft: normalizedDraft, productKey, quantity, total })) {
            return Object.freeze({ ready: false, reason: 'already_prepared', orderId });
        }
        return Object.freeze({
            ready: true,
            reason: 'confirmed_admin_lead_ready',
            orderId,
            leadId: adminMatch[1],
            endpoint: `/api/shipments/droppi/ec/admin-leads/${encodeURIComponent(adminMatch[1])}/configure-order`,
            body: Object.freeze({ orderId, productKey, priceCatalog, quantity })
        });
    };

    globalObject.VitalismenPanelNewDropiPersistenceV142 = Object.freeze({
        version: 142,
        isManualNewContactPending,
        resolvePriceCatalog,
        buildConfirmedAdminLeadPreparation
    });
})(typeof window !== 'undefined' ? window : globalThis);

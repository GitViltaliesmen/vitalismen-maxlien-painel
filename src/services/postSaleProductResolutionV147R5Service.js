import Order from '../models/Order.js';
import { ECUADOR_PRODUCTS, validateExplicitEcuadorProductSelection } from './ecuadorProductService.js';

const clean = (value) => String(value ?? '').trim();
const digits = (value) => clean(value).replace(/\D/g, '');
const normalized = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const products = Object.values(ECUADOR_PRODUCTS);
const dropiIds = (shipment) => [...new Set([
    shipment?.raw?.manualDropiOrderId,
    shipment?.raw?.latestDroppiPayload?.dropiOrderId,
    shipment?.raw?.historicalExternalReconciliation?.dropiOrderId
].map(clean).filter(Boolean))];
const identifiers = (row = {}, item = false) => [
    row.productKey, row.productName, typeof row.product === 'string' ? row.product : '',
    row.productId, row.product_id, row.sku,
    ...(item ? [row.name, row.id, row.integration_product_name, row.name_in_guide] : []),
    row.package?.label, row.tracking?.productKey, row.tracking?.productName,
    ...(row.product && typeof row.product === 'object' ? identifiers(row.product, true) : []),
    ...['items', 'orderdetails'].flatMap((key) => Array.isArray(row[key]) ? row[key].flatMap((entry) => identifiers(entry, true)) : [])
].filter((value) => value !== undefined && value !== null && typeof value !== 'object');

const keysFor = (values) => {
    // Aliases e IDs vêm do catálogo oficial; nenhum catálogo ou produto padrão novo.
    const aliases = values.flatMap((value) => products.filter((product) => (
        [product.key, product.name, product.dropiName, ...(product.dropiAliases || [])]
            .some((alias) => normalized(alias) === normalized(value))
        || (clean(value) && product.dropiUrl?.match(/product-details\/(\d+)\//)?.[1] === clean(value))
    )).map((product) => product.key));
    return validateExplicitEcuadorProductSelection({ identifiers: [...values, ...aliases] }).detectedKeys;
};

export const samePostSaleOrderV147R5 = (shipment, order) => {
    if (order?.country !== 'EC') return false;
    const sameOrder = clean(order.orderId) && clean(order.orderId) === clean(shipment.orderId);
    const sameDropi = clean(order.dropiOrderId) && dropiIds(shipment).includes(clean(order.dropiOrderId));
    if (!sameOrder && !sameDropi) return false;
    const phone = digits(shipment?.client?.phone);
    const orderPhone = digits(order?.customer?.phone);
    if (phone && orderPhone && phone !== orderPhone) return false;
    const guide = clean(shipment?.logistics?.trackingNumber);
    if (guide && clean(order.trackingNumber) && guide !== clean(order.trackingNumber)) return false;
    return true;
};

export const resolvePostSaleProductV147R5 = ({ shipment = {}, orders = [] } = {}) => {
    const ids = dropiIds(shipment);
    const evidence = [];
    const add = (source, values) => {
        const keys = keysFor(values);
        if (keys.length) evidence.push({ source, keys });
    };
    const linkedOrders = orders.filter((order) => samePostSaleOrderV147R5(shipment, order));
    for (const order of linkedOrders) add('RESOLVABLE_FROM_ORDER', identifiers(order));
    const dropi = shipment?.raw?.droppiOrder;
    if (dropi && ids.includes(clean(dropi.id))) add('RESOLVABLE_FROM_DROPI_ORDER_ITEM',
        (dropi.orderdetails || []).flatMap((item) => identifiers(item, true)));
    add('RESOLVABLE_FROM_EXISTING_CANONICAL_LINEAGE', identifiers({
        productName: shipment.productName, productKey: shipment.raw?.productKey,
        product: shipment.raw?.productName
    }));
    for (const row of [shipment.raw?.latestDroppiPayload, shipment.raw?.commercialCycle, shipment.raw?.order]) {
        if (row && clean(row.orderId) && [clean(shipment.orderId), ...linkedOrders.map((order) => clean(order.orderId))].includes(clean(row.orderId))) {
            add('RESOLVABLE_FROM_EXISTING_CANONICAL_LINEAGE', identifiers(row));
        }
    }
    const keys = [...new Set(evidence.flatMap((item) => item.keys))];
    const conflict = keys.length > 1 || ids.length > 1 || linkedOrders.length > 1 || linkedOrders.length !== orders.length;
    const product = !conflict && keys.length === 1 ? products.find((entry) => entry.key === keys[0]) : null;
    return Object.freeze({
        productKey: product?.key || '', productName: product?.name || '',
        classification: conflict ? 'CONFLICTING_PRODUCT_EVIDENCE' : product ? evidence[0].source : 'NO_PRODUCT_EVIDENCE',
        reviewRequired: !product, evidence
    });
};

export const loadPostSaleProductV147R5 = async ({ shipment = {}, orderModel = Order } = {}) => {
    const ids = dropiIds(shipment);
    const clauses = [
        ...(clean(shipment.orderId) ? [{ orderId: clean(shipment.orderId) }] : []),
        ...(ids.length ? [{ dropiOrderId: { $in: ids } }] : [])
    ];
    const orders = clauses.length && (orderModel !== Order || Order.db.readyState === 1)
        ? await orderModel.find({ country: 'EC', $or: clauses }).limit(3).lean()
        : [];
    return resolvePostSaleProductV147R5({ shipment, orders });
};

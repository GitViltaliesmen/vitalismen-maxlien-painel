import {
    normalizeDroppiEcuadorStatus,
    upsertDroppiEcuadorShipment
} from './droppiEcuadorService.js';
import { notifyShipmentGuideGenerated } from './shipmentMessageService.js';

const ORDER_ID_RE = /^\d{6,}$/;
const STATUS_RE = /^(GUIA_GENERADA|PREPARADO PARA TRANSPORTADORA|MERCANCIA RECOGIDA|EN BODEGA TRANSPORTADORA|EN DESPACHO|EN RUTA|EN REPARTO|EN PROCESAMIENTO|DEVOLUCION|DEVOLUCIÓN|ENTREGADO|EN AGENCIA|LISTO PARA RETIRO|READY_FOR_PICKUP|DELIVERED|DEVUELTO|RETURNED|NO_RETIRADO|PENDIENTE|NOVEDAD|INGRESANDO EN AGENCIA .*|EN RUTA A CONCESI[ÓO]N .*)$/i;

const normalizeLine = (line) => String(line || '')
    .replace(/\t+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const normalizePhone = (value) => String(value || '').replace(/\D/g, '');

const buildReferenceFromAddress = (addressLine) => {
    const match = String(addressLine || '').match(/referencia:\s*(.+)$/i);
    return match?.[1]?.trim() || '';
};

const parseAddressParts = (addressLine) => {
    const cleaned = String(addressLine || '').trim();
    const telCut = cleaned.split(/tel:/i)[0].trim();
    const parts = telCut.split(/\s*,\s*/);
    const address = parts[0] || '';
    const cityProvince = parts[1] || '';
    const cityProvinceParts = cityProvince.split('-');

    return {
        address,
        city: (cityProvinceParts[0] || '').trim(),
        province: cityProvinceParts.slice(1).join('-').trim(),
        reference: buildReferenceFromAddress(address)
    };
};

const parseRecord = (lines) => {
    if (!lines.length || !ORDER_ID_RE.test(lines[0])) return null;

    const orderId = lines[0];
    const productName = lines[1] || 'Vit Power';
    let cursor = 2;

    if (cursor < lines.length && /\d{1,2}\/\d{1,2}\/\d{4}/.test(lines[cursor])) {
        cursor += 1;
    }

    const clientName = lines[cursor] || '';
    const addressLine = lines[cursor + 1] || '';
    const phoneLine = lines[cursor + 2] || '';
    const status = lines[cursor + 3] || '';
    const trackingNumber = lines[cursor + 4] || '';
    const distributionCompany = lines[cursor + 5] || '';
    const warehouse = lines[cursor + 6] || '';
    const shippingType = lines[cursor + 7] || '';
    const detail = lines[cursor + 8] || '';

    if (!clientName || !STATUS_RE.test(status)) return null;

    const addressParts = parseAddressParts(addressLine);
    const phone = normalizePhone(phoneLine);
    const agencyPickup = /retirar en|oficina|agencia|servientrega/i.test(addressLine);

    return {
        orderId,
        productName,
        clientName,
        phone,
        address: addressParts.address,
        city: addressParts.city,
        province: addressParts.province,
        reference: addressParts.reference,
        status: normalizeDroppiEcuadorStatus(status),
        trackingNumber,
        distributionCompany,
        warehouse,
        shippingType,
        detail,
        agencyPickup,
        agencyName: agencyPickup ? addressParts.address : '',
        invoiceUrl: ''
    };
};

const parseStructuredBlocks = (text) => {
    const chunks = String(text || '')
        .split(/📦\s*Pedido(?:\s*\d+|\s*[—-][^\n]*)?/i)
        .map((item) => item.trim())
        .filter(Boolean);

    const records = [];

    for (const chunk of chunks) {
        const lines = chunk
            .split('\n')
            .map(normalizeLine)
            .filter(Boolean);

        const data = {};
        for (const line of lines) {
            const match = line.match(/^([^:]+):\s*(.+)$/);
            if (!match) continue;
            const key = match[1].trim().toLowerCase();
            const value = match[2].trim();
            data[key] = value;
        }

        const orderId = String(data.id || '').replace(/\D/g, '');
        const clientName = data.cliente || '';
        const phone = normalizePhone(data.telefone || data.telefono || '');
        const cityProvince = String(data.cidade || data.ciudad || '').split(/\s*-\s*/);
        const status = normalizeDroppiEcuadorStatus(data.status || data['estado de la orden'] || '');
        const distributionCompany = data.transportadora || 'Servientrega';

        if (!orderId || !clientName || !phone || !status) continue;

        records.push({
            orderId,
            productName: data.produto || data.producto || 'VIT POWER',
            clientName,
            phone,
            address: data.endereço || data.endereco || data.dirección || data.direccion || '',
            city: (cityProvince[0] || '').trim(),
            province: cityProvince.slice(1).join(' - ').trim(),
            reference: '',
            status,
            trackingNumber: String(data.guia || data['número de guia'] || data['numero de guia'] || '').replace(/\D/g, ''),
            distributionCompany,
            warehouse: data.bodega || '',
            shippingType: data['tipo de envío'] || data['tipo de envio'] || 'CONTRA ENTREGA',
            detail: data.detalhe || data.detalle || '',
            agencyPickup: /retirar en|oficina|agencia|servientrega/i.test(data.endereço || data.endereco || ''),
            agencyName: /retirar en|oficina|agencia|servientrega/i.test(data.endereço || data.endereco || '')
                ? (data.endereço || data.endereco || '')
                : '',
            invoiceUrl: data.factura || data['url factura'] || ''
        });
    }

    return records;
};

export const parseDroppiEcuadorImportText = (text) => {
    const structuredRecords = parseStructuredBlocks(text);
    if (structuredRecords.length) return structuredRecords;

    const normalizedLines = String(text || '')
        .split('\n')
        .map(normalizeLine)
        .filter(Boolean);

    const records = [];
    let buffer = [];

    for (const line of normalizedLines) {
        const previousLine = buffer[buffer.length - 1] || '';
        const shouldStartNewRecord = ORDER_ID_RE.test(line) && (!buffer.length || !STATUS_RE.test(previousLine));

        if (shouldStartNewRecord) {
            if (buffer.length) {
                const parsed = parseRecord(buffer);
                if (parsed) records.push(parsed);
            }
            buffer = [line];
            continue;
        }

        if (!buffer.length) continue;

        buffer.push(line);

        if (
            buffer.length >= 7
            && STATUS_RE.test(buffer[buffer.length - 4] || '')
        ) {
            const parsed = parseRecord(buffer);
            if (parsed) {
                records.push(parsed);
                buffer = [];
            }
        }
    }

    if (buffer.length) {
        const parsed = parseRecord(buffer);
        if (parsed) records.push(parsed);
    }

    return records;
};

export const importDroppiEcuadorText = async ({ text, sessionId = '', autoNotify = true }) => {
    const records = parseDroppiEcuadorImportText(text);
    const shipments = [];
    let notified = 0;

    for (const record of records) {
        const shipment = await upsertDroppiEcuadorShipment({
            ...record,
            sessionId
        });

        shipments.push(shipment);

        if (autoNotify && shipment.logistics.status === 'GUIA_GENERADA') {
            const notifyResult = await notifyShipmentGuideGenerated(shipment);
            if (notifyResult?.success) notified += 1;
        }
    }

    return {
        imported: shipments.length,
        notified,
        shipments
    };
};

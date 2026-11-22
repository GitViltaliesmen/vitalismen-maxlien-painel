const STATUS_LABELS = Object.freeze({
    GUIDE_CREATED: 'Guia gerada · ainda não retirar',
    PICKED_UP_BY_CARRIER: 'Coletado pela transportadora',
    IN_TRANSIT: 'Em trânsito',
    LOGISTICS_CENTER: 'No centro logístico',
    ENTERING_AGENCY: 'Chegando à agência',
    READY_FOR_PICKUP: 'Pronto para retirada',
    DELIVERED: 'Entregue',
    NOT_PICKED_UP: 'Não retirado',
    RETURNING: 'Em devolução',
    RETURNED: 'Devolvido',
    EXCEPTION: 'Exceção logística'
});

export const shipmentCustomerTimelineEvents = (shipments = []) => (
    (Array.isArray(shipments) ? shipments : [])
        .flatMap((shipment) => (Array.isArray(shipment?.events) ? shipment.events : [])
            .filter((event) => ['shipment_lifecycle_status_applied', 'guia_notified'].includes(event?.kind) && event.at)
            .map((event) => {
                if (event.kind === 'guia_notified') {
                    if (event.payload?.primaryTextSent !== true) return null;
                    return {
                        at: event.at,
                        type: 'aviso_logistico',
                        label: 'Aviso de guia enviado pelo WhatsApp',
                        detail: [shipment.orderId, event.payload?.trackingNumber ? `Guia ${event.payload.trackingNumber}` : '']
                            .filter(Boolean).join(' · ')
                    };
                }
                const status = String(event.payload?.canonicalStatus || '').trim().toUpperCase();
                if (!STATUS_LABELS[status]) return null;
                return {
                    at: event.at,
                    type: 'logistica',
                    label: STATUS_LABELS[status],
                    detail: [shipment.orderId, event.payload?.trackingNumber ? `Guia ${event.payload.trackingNumber}` : '']
                        .filter(Boolean).join(' · ')
                };
            })
            .filter(Boolean))
);

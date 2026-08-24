const normalizeText = (value = '') => String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s$.,:;!?¿¡-]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

export const isExplicitDropiPickupReleaseStatus = (value = '') => {
    const body = normalizeText(value).toUpperCase();
    if (!body) return false;
    return /^PARA RETIRO EN AGENCIA\b/.test(body)
        || /^LIST[OA] PARA RETIRO\b/.test(body)
        || /^DISPONIBLE.*RETIRO\b/.test(body)
        || body === 'READY_FOR_PICKUP';
};

export const shipmentHistoryRepeatKey = (text = '') => {
    const body = normalizeText(text);
    if (!body) return '';
    const guideMatch = body.match(/\b(?:guia|guia numero|numero de guia|tracking)(?:\s+para\s+seguimiento)?\s*(?:es|numero|nro|num|:|#|-)?\s*(\d{5,})\b/);
    const pickupReminderStage = (() => {
        if (/\bfoto\s+del\s+retiro\b/.test(body)) return 'soft_day2';
        if (/\bpuede\s+acercarse\s+a\s+servientrega\b/.test(body)) return 'soft_day4';
        if (/\b(?:ultimo\s+aviso|plazo\s+de\s+devolucion)\b/.test(body)) return 'soft_day6';
        if (
            /\bcontinua\s+disponible\s+en\s+servientrega\b.*\bretirarlo\s+hoy\b/.test(body)
            || /^hola\.\s+su\s+pedido\s+esta\s+para\s+retiro\s+en\s+agencia\b/.test(body)
        ) return 'day1';
        return '';
    })();
    const waitingForPickupRelease = (
        /\b(no\s+vaya\s+(?:todavia|aun)|todavia\s+no\s+vaya)\b/.test(body)
        || /\b(?:espere|esperar|debe\s+esperar).*\b(?:aviso|retirarlo|retirar)\b/.test(body)
        || /\bcuando\s+(?:la\s+)?agencia\s+(?:lo\s+)?libere\s+para\s+retiro\b/.test(body)
        || /\ble\s+avisaremos.*\bapenas\s+(?:este|aparezca)\s+disponible\s+para\s+retiro\b/.test(body)
        || /\b(?:apenas|en\s+cuanto).*(?:disponible|listo).*(?:le\s+aviso|le\s+escribo|le\s+avisaremos|avisamos)\b/.test(body)
        || /\b(?:le\s+aviso|le\s+escribo|le\s+avisaremos|avisamos).*\b(?:cuando|apenas|en\s+cuanto).*(?:disponible|listo)\b/.test(body)
    );
    const guideGeneratedNotice = (
        /\b(ya\s+fue\s+enviado|ya\s+salio|ya\s+se\s+genero\s+la\s+guia|se\s+genero\s+la\s+guia|ya\s+tiene\s+guia|tiene\s+guia|guia\s+generada|le\s+confirmo\s+el\s+envio|fue\s+enviado\s+por|salio\s+por)\b/.test(body)
        || (/\bguia\b/.test(body) && /\b(transportadora|en\s+camino|enviado|envio|ruta|servientrega)\b/.test(body))
    );
    if (waitingForPickupRelease) {
        return guideMatch ? `logistics_guide:${guideMatch[1]}` : 'logistics_guide';
    }
    // Cada dia da cadencia e uma comunicacao aprovada diferente. A chave
    // continua bloqueando a repeticao da mesma etapa, mas nao pode transformar
    // day1/soft_day2/soft_day4/soft_day6 em um unico aviso generico de retirada.
    if (pickupReminderStage) {
        return guideMatch
            ? `logistics_pickup_reminder:${pickupReminderStage}:${guideMatch[1]}`
            : `logistics_pickup_reminder:${pickupReminderStage}`;
    }
    const readyPickupNotice = (
        /\b(pedido\s+listo\s+para\s+retiro|pedido\s+para\s+retiro|aviso\s+de\s+retiro|ya\s+puede\s+retirar|puede\s+acercarse|acerquese|lleve\s+su\s+documento|muestre\s+esta\s+guia|retir[aeiou]?\s+(?:su|mi|el)?\s*pedido|retirarlo|retirar\s+en\s+agencia|comprobante\s+de\s+retiro)\b/.test(body)
        || /\b(?:su\s+pedido|pedido)\s+(?:ya\s+)?(?:esta|aparece)\s+(?:listo|disponible)\s+(?:para\s+retiro|en\s+agencia)\b/.test(body)
        || /\b(?:su\s+pedido|pedido)\s+(?:ya\s+)?(?:esta|sigue)\s+para\s+retiro\b/.test(body)
    );
    if (readyPickupNotice) {
        return guideMatch ? `logistics_ready_for_pickup:${guideMatch[1]}` : 'logistics_ready_for_pickup';
    }
    if (guideGeneratedNotice) {
        return guideMatch ? `logistics_guide:${guideMatch[1]}` : 'logistics_guide';
    }
    if (/(pedido ya quedo registrado|pedido esta registrado|su pedido quedo registrado|su pedido ya esta registrado|apenas tenga la guia|novedad de servientrega)/.test(body)) return 'order_registered_waiting_guide';
    if (/(le envio|envio|enviamos)\s+(?:1|2|3|6|un|una|dos|tres|seis)\s+(?:botella|botellas|frasco|frascos)/.test(body)
        && /(listo|de acuerdo|esta correcto|esta bien)/.test(body)) return 'ask_value_confirmation';
    if (/\b(cual es su nombre completo|nombre completo|nombre y apellido)\b/.test(body)) return 'ask_name';
    if (/\bque dia desea que le escribamos nuevamente\b/.test(body)) return 'ask_followup_date';
    if (/(cuantos frascos|indiqueme cuantos frascos|elige la cantidad|escoja la cantidad|1\s*3\s*o\s*6|1\s*,\s*3\s*o\s*6)/.test(body)) return 'ask_quantity';
    if (/(esta bien para usted reservar|me confirma si esta de acuerdo|le parece bien|confirma.*valor|confirmar.*cantidad)/.test(body) && /frasco/.test(body)) return 'ask_value_confirmation';
    if (/(puedo enviar su pedido por una agencia de servientrega|agencia servientrega cercana|prefiere agencia|prefiere domicilio|agencia o domicilio|por agencia o domicilio)/.test(body)) return 'ask_delivery_mode';
    if (/(elija una de las agencias|escoja una de las agencias|responda solo con la letra|a\)\s*servientrega|b\)\s*servientrega)/.test(body)) return 'ask_agency_selection';
    if (/(envieme|envienos|indiqueme|proporcione|cual es|por favor.*(?:direccion|barrio|sector|referencia))/.test(body)
        && /(direccion completa|direccion exacta|barrio|sector|referencia cercana|punto de referencia)/.test(body)) return 'ask_home_address';
    if (/(autoriza el despacho|revise.*datos.*correctos|si todo esta bien|confirma.*despacho|confirmar.*pedido)/.test(body)) return 'ask_final_confirmation';
    if (/(pedido quedo confirmado|gracias por confirmar sus datos|su pedido fue confirmado|venta confirmada)/.test(body)) return 'order_closed_confirmation';
    if (/(cual es|indiqueme|en que|por favor.*provincia|escriba.*provincia)/.test(body) && /\bprovincia\b/.test(body)) return 'ask_province';
    if (/(cual es|indiqueme|en que|por favor.*ciudad|escriba.*ciudad)/.test(body) && /\bciudad\b/.test(body)) return 'ask_city';
    return body.length >= 25 ? `exactish:${body.slice(0, 220)}` : '';
};

const EXPANDED_PICKUP_CONFIRMATION_REGEX = /\b(ya\s+fue\s+retirad[oa]\s+(?:el\s+)?(?:producto|pedido)|(?:el\s+)?(?:producto|pedido)\s+ya\s+fue\s+retirad[oa]|ya\s+retiraron\s+(?:el|mi)\s+(?:producto|pedido)|ja\s+foi\s+retirad[oa]\s+(?:o\s+)?(?:produto|pedido))\b/i;

export const isExpandedCustomerPickupConfirmation = (text = '') => (
    EXPANDED_PICKUP_CONFIRMATION_REGEX.test(normalizeText(text))
);

export const normalizeExpandedCustomerPickupConfirmation = (text = '') => (
    isExpandedCustomerPickupConfirmation(text) ? 'Ya retire mi pedido.' : String(text || '')
);

export const expandedPickupConfirmationRegex = () => EXPANDED_PICKUP_CONFIRMATION_REGEX;

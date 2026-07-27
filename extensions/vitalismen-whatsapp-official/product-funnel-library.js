(function (root, factory) {
    const api = factory();
    if (typeof module === 'object' && module.exports) module.exports = api;
    root.VitalismenProductFunnel = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
    'use strict';

    const PRODUCTS = Object.freeze({
        vit_power_ec: 'Vit Power',
        nitrix_ec: 'Nitrix',
        tex_ultra_ec: 'Tex Ultra'
    });

    const texUltraOffer = [
        '📦 *Hoy tenemos kits promocionales disponibles con precios especiales*:',
        '🟢 1 mes por solo $35,99',
        '🟡 2 meses por $70,00',
        '🟠 3 meses por $80,99',
        '🔴 6 meses (tratamiento completo) por $147,99',
        '',
        '¿Cuántos frascos desea?'
    ].join('\n');

    const baseTemplates = (productKey) => {
        const product = PRODUCTS[productKey];
        return [
            {
                id: `${productKey}:welcome`,
                code: 'P01',
                category: 'abertura',
                stages: ['novo', 'qualificando'],
                title: `Apresentar ${product}`,
                preview: 'Abertura curta e pergunta de intenção',
                text: `Hola{{nome_curto}}. Gracias por contactarnos 😊 Soy del equipo de atención de ${product}. Para orientarle bien, ¿busca información, precio o desea hacer su pedido?`
            },
            {
                id: `${productKey}:offer`,
                code: 'P02',
                category: 'oferta',
                stages: ['qualificando', 'oferta'],
                title: 'Oferta por quantidade',
                preview: 'Apresenta as opções sem pressionar',
                text: productKey === 'tex_ultra_ec'
                    ? texUltraOffer
                    : `📦 Tenemos opciones de ${product} de 1, 2, 3 y 6 frascos.{{valor_linha}} ¿Cuántos frascos desea separar?`
            },
            {
                id: `${productKey}:trust`,
                code: 'P03',
                category: 'confianca',
                stages: ['qualificando', 'oferta'],
                title: 'Confiança e atendimento',
                preview: 'Reforça acompanhamento e tira dúvidas',
                text: `Entiendo su duda. Nuestro equipo le acompaña antes y después de la entrega de ${product}. Puede preguntarme todo lo que necesite antes de decidir.`
            },
            {
                id: `${productKey}:data`,
                code: 'P04',
                category: 'dados',
                stages: ['coleta_dados'],
                title: 'Pedir dados do pedido',
                preview: 'Nome, cidade, província e entrega',
                text: `Perfecto{{nome_curto}}. Para registrar su pedido de ${product}, confírmeme por favor: nombre completo, ciudad, provincia y dirección o agencia Servientrega.`
            },
            {
                id: `${productKey}:confirm`,
                code: 'P05',
                category: 'confirmacao',
                stages: ['aguardando_confirmacao', 'confirmado'],
                title: 'Confirmar antes de registrar',
                preview: 'Resumo preenchido pela ficha inteligente',
                text: `Le confirmo antes de registrar:\n• Producto: ${product}\n• Cantidad: {{quantidade}}\n• Valor: {{valor}}\n• Cliente: {{nome}}\n• Entrega: {{entrega}}\n• Ciudad/Provincia: {{cidade_provincia}}\n\n¿Todo está correcto?`
            },
            {
                id: `${productKey}:followup`,
                code: 'P06',
                category: 'retorno',
                stages: ['comprar_depois', 'recompra', 'pos_venda'],
                title: 'Retomar com permissão',
                preview: 'Seguimento curto, respeitoso e sem pressão',
                text: `Hola{{nome_curto}}. ¿Desea que continuemos con la información de ${product}? Si ya no le interesa, me avisa y no le vuelvo a escribir.`
            }
        ];
    };

    const LIBRARY = Object.freeze(Object.fromEntries(
        Object.keys(PRODUCTS).map((key) => [key, Object.freeze(baseTemplates(key))])
    ));

    const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase()
        .trim();

    const safeValue = (value, fallback = '—') => {
        const text = String(value ?? '').trim();
        return text || fallback;
    };

    const contextTokens = (draft = {}) => {
        const name = safeValue(draft.name);
        const shortName = name === '—' ? '' : ` ${name.split(/\s+/)[0]}`;
        const city = safeValue(draft.city, '');
        const province = safeValue(draft.province, '');
        const total = safeValue(draft.total, '');
        const address = safeValue(draft.address, '');
        const reference = safeValue(draft.reference, '');
        return {
            nome: name,
            nome_curto: shortName,
            quantidade: safeValue(draft.quantity),
            valor: total ? `USD ${total}` : '—',
            valor_linha: total ? ` El valor registrado es USD ${total}.` : '',
            entrega: [address, reference].filter(Boolean).join(' — ') || '—',
            cidade_provincia: [city, province].filter(Boolean).join(' / ') || '—'
        };
    };

    const resolve = (template, draft = {}) => {
        const tokens = contextTokens(draft);
        return String(template?.text || '').replace(/\{\{([a-z_]+)\}\}/g, (_, key) => tokens[key] ?? '—');
    };

    const list = ({ productKey, category = 'todos', search = '', stage = '' } = {}) => {
        const source = LIBRARY[productKey] || [];
        const needle = normalize(search);
        return source
            .filter((item) => category === 'todos' || item.category === category)
            .filter((item) => !needle || normalize(`${item.code} ${item.title} ${item.preview} ${item.text}`).includes(needle))
            .map((item) => ({ ...item, recommended: Boolean(stage && item.stages.includes(stage)) }))
            .sort((a, b) => Number(b.recommended) - Number(a.recommended));
    };

    const productName = (productKey) => PRODUCTS[productKey] || '';

    return Object.freeze({ PRODUCTS, LIBRARY, list, resolve, productName });
}));

(() => {
    'use strict';

    const PRODUCT_NAMES = Object.freeze({
        vit_power_ec: 'Vit Power',
        nitrix_ec: 'Nitrix',
        tex_ultra_ec: 'Tex Ultra'
    });

    const AUDIO_BASE_NAMES = Object.freeze([
        '01_A_buenas_noches',
        '01_B_Buenos_dias',
        '01_C_Buenos_tardes',
        'NITRIX_INICIO_01_VALERIA_ZAMBRANO_UNIVERSAL',
        'NITRIX_INICIO_02_VALERIA_ZAMBRANO_UNIVERSAL',
        'NITRIX_USO_OXIDE_EC',
        'NOME_CIUDAD_PROVICINCIA',
        'PERGUNTA_AGENCIA_DOMICILIO',
        'ENDERECO_CIDADE_PROVINCIA_AGENCIA',
        'ENDERECO_ORIENTACAO',
        'ENDERECO_ERRADO',
        'PRODUDO_LIQUIDO_X_CAPSULA_MELHOR',
        'CONHECER_NECESSIDADES_CLIENTES',
        'DUVIDAS',
        'TRATAMENTO_Y_PRECIOS_PROMOCAO',
        '1_BOTELLA_POR_39',
        '3_BOTELLAS_POR_95_E_99',
        '6_BOTELLAS_POR_167_E_99',
        'QUANTOS_FRASCOS_E_DIA_QUERES',
        'Agradecimento_Agencia_01',
        'AGRADECIMENTO_AGENCIA_DE_ENTREGA',
        'BONUS_RETIRADA',
        'FUNCIONA_VIT_POWER',
        'FUNCIONA_TRATAMENTO_COMPLETO_100_NATURAL',
        '100_NATURAL_SEM_CONTRA_INDICACAO',
        'DEPOIMENTO_AUDIO_PRODUTO',
        'INFORMACOES_PESSOAIS_NAIS',
        'INFORMACOES_PESSOAS_NAIS',
        'CLIENTES_QUE_LIGAM',
        'QUANDO_CLIENTE_INSISTE_EM_LIGAR',
        'QUANDO_CLIENTE_LIGA_01',
        'QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA',
        'QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO',
        'ENVIO_AGENCIA_100_SEGURO',
        'ENTREGA_SEGURA_RETIRE_NA_AGENCIA',
        'ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO',
        'DOMICILIO_A_AGENCIA_DE_SERVIENTREGA',
        'SUGESTAO_ENTREGA_EM_SERVITREGA_01_QUANDO_CLIENTE_NAO_COLOCA_ENDERECO',
        'Ajuda_Prostata',
        'PROSTADA_FUNCIONA_E_QUANDO_CHEGA',
        'TEMPO_DEMORA_PRODUTO_CHEGAR',
        'TEMPO_RESULTADO_VIT_POWER',
        'COMO_SE_TOMA_VIT_POWER',
        'COMO_TOMAR_VIT_POWER_SEM_REFERENCIA_QUANTIDADE_LITRO',
        'TRATAMENTO_CONTINUA_NAO_EFEITO_IMEDIATO',
        'CONFIRMACION_Y_REGALITO_ESPECIAL',
        'Informativo_Ana_Lopes_pedido_Em_fase_entrega',
        'OBRIGADO_PAGOU',
        'GUIA',
        'Chegou_01',
        'Chegou_02',
        'Chegou_03'
    ]);

    const CUSTOM_TEXTS = Object.freeze([
        {
            id: 'text_1780268276900_81b565',
            label: 'Claro! Le envio 1 frasco por 40. ¿De acue...',
            text: 'Claro! Le envio 1 frasco por 40. ¿De acuerdo?'
        },
        {
            id: 'text_1780282158837_bf20c0',
            label: 'PROMOCION_1_3_6',
            text: '📦 *Hoy tenemos kits promocionales disponibles con precios especiales*:\n\n🟢 *1 frasco* por solo *$35,99*\n🟡 *2 frascos* por *$70,00*\n🟠 *3 frascos* por *$80,99*\n🔴 *6 frascos (tratamiento completo)* por *$147,99*\n\n*¿Cuántos frascos desea?*'
        },
        {
            id: 'text_precio_real_1_3_6_20260726',
            label: 'PRECIO_REAL_1_3_6',
            text: '📦 *Precios reales de los kits disponibles*:\n\n🟢 *1 frasco* por solo *$39,99*\n🟡 *2 frascos* por *$70,00*\n🟠 *3 frascos* por *$95,99*\n🔴 *6 frascos (tratamiento completo)* por *$167,99*\n\n*¿Cuántos frascos desea?*'
        },
        {
            id: 'text_1780321166515_2919ae',
            label: '3 frascos_v1',
            text: 'Perfecto! Le envio 3 frascos por 96. ¿De acuerdo?'
        },
        {
            id: 'text_1780321208621_229082',
            label: '3 frascos_v2',
            text: 'Claro! Le envio 3 frascos por 96. ¿De acuerdo?'
        },
        {
            id: 'text_1780321297591_6d97af',
            label: '3 frascos_v3',
            text: 'Muy bien! Estoy le enviado 3 frascos por 96. ¿Confirma?'
        },
        {
            id: 'text_1780399443762_05486f',
            label: 'Aumento do penis',
            text: '¡Hola, mi amor! 🤭 Mira, respondiendo a lo que me preguntas: sí, el Vit Power proporciona exactamente eso. Su función principal es activar la circulación al máximo para darte mucho más volumen, haciendo que se note más grueso, firme y pesado. ¿Quieres que te reserve un combo de 3 o 5 frascos antes de que se acabe la promoción de hoy? 😉'
        },
        {
            id: 'text_1780596063440_08d32a',
            label: 'REGALITO_SITE PARA ACESSO BONUS',
            text: '🔥 Un regalo solo para ti…\nUn bonus para calentar la noche y preparar la llegada de momentos más ardientes.\nContenido exclusivo solo para adultos...\nNormalmente cuesta $40 al mes, pero para ti, como cliente especial, te lo envío como un bono gratuito.\nSolo si estás listo para dejarte llevar...\nBONUS: https://zapgersonecvo.cloud'
        }
    ]);

    const CUSTOM_UPLOADS = Object.freeze([
        {
            id: 'upload_1780322969574_bbf8d8',
            label: '3 frascos_v2',
            detail: 'Verga dura.mp3',
            mediaType: 'audio',
            value: 'legacy-media/funnel-custom/1780322971189_b63edf62cb_Verga_dura.mp3'
        },
        {
            id: 'upload_1780493020392_1f3998',
            label: 'Aumenta_grosso_verga_grande_volume',
            detail: 'Aumenta_grosso_verga_grante.mp3',
            mediaType: 'audio',
            value: 'legacy-media/funnel-custom/1780493022431_68d494547e_Aumenta_grosso_verga_grante.mp3'
        }
    ]);

    const CUSTOM_BLOCKS = Object.freeze([
        {
            label: 'INICIO_01_02_PROVA01_FRASCO_VIT_POWER',
            detail: 'INICIO 01 + INICIO 02 + Produto + Prova 1',
            value: 'custom_1780182896042_1b91ef',
            steps: [
                { type: 'audio', label: 'INICIO 01', value: 'legacy-media/templates/EC/01_B_Buenos_dias.ogg' },
                { type: 'audio', label: 'INICIO 02', value: 'legacy-media/templates/EC/01_C_Buenos_tardes.ogg' },
                { type: 'media', label: 'Produto', value: 'legacy-media/sales/ec/vit_power.jpeg' },
                { type: 'media', label: 'Prova 1', value: 'legacy-media/sales/shared/social_01.jpeg' }
            ]
        },
        {
            label: 'INFORMAÇÕES: DUVIDA, 100 NATURAL, PROSTATA, FUNCIONA',
            detail: 'DUVIDAS + 100 NATURAL SEM CONTRA INDICACAO + AJUDA PROSTATA + Explicar se funciona',
            value: 'custom_1780196676304_4b628b',
            steps: [
                { type: 'audio', label: 'DUVIDAS', value: 'legacy-media/templates/EC/DUVIDAS.ogg' },
                { type: 'audio', label: '100 NATURAL SEM CONTRA INDICACAO', value: 'legacy-media/templates/EC/100_NATURAL_SEM_CONTRA_INDICACAO.ogg' },
                { type: 'audio', label: 'AJUDA PROSTATA', value: 'legacy-media/templates/EC/Ajuda_Prostata.ogg' },
                { type: 'audio', label: 'Explicar se funciona', value: 'legacy-media/templates/EC/FUNCIONA_VIT_POWER.ogg' }
            ]
        },
        {
            label: 'BO1',
            detail: '1 BOTELLA POR 39 + Claro! Le envio 1 frasco por 40. ¿De acuerdo?',
            value: 'custom_1780268918250_4add3e',
            steps: [
                { type: 'audio', label: '1 BOTELLA POR 39', value: 'legacy-media/templates/EC/1_BOTELLA_POR_39.ogg' },
                { type: 'draft', label: 'Claro! Le envio 1 frasco por 40. ¿De acuerdo?', value: 'custom_text:text_1780268276900_81b565' }
            ]
        }
    ]);

    const shortCode = (prefix, index) => `${prefix}${(index + 1).toString(36).toUpperCase().padStart(2, '0').slice(-2)}`;
    const fileName = (value = '') => String(value).split('/').pop().replace(/\.[a-z0-9]{2,5}$/i, '').replace(/[_-]+/g, ' ').trim();
    const customTextById = (id) => CUSTOM_TEXTS.find((item) => item.id === id);
    const productName = (productKey) => PRODUCT_NAMES[productKey] || PRODUCT_NAMES.vit_power_ec;
    const isNitrix = (productKey) => productKey === 'nitrix_ec';
    const isTexUltra = (productKey) => productKey === 'tex_ultra_ec';

    const audioLabel = (baseName) => {
        const base = String(baseName || '').replace(/_/g, ' ');
        if (/01 B BUENOS DIAS|BUENOS DIAS/i.test(base)) return 'Entrada manha';
        if (/01 C BUENOS TARDES|BUENOS TARDES|BUENAS TARDES/i.test(base)) return 'Entrada tarde';
        if (/01 A BUENAS NOCHES|BUENAS NOCHES/i.test(base)) return 'Entrada noite';
        if (/NOME CIUDAD|NOME CIDADE|PROVINCIA/i.test(base)) return 'Pedir nome, cidade e provincia';
        if (/PERGUNTA AGENCIA DOMICILIO/i.test(base)) return 'Perguntar agencia ou domicilio';
        if (/ENDERECO CIDADE PROVINCIA AGENCIA/i.test(base)) return 'Pedir dados da agencia';
        if (/DOMICILIO REFERENCIA|ENDERECO ORIENTACAO/i.test(base)) return 'Pedir endereco e referencia';
        if (/TRATAMENTO Y PRECIOS/i.test(base)) return 'Precos 1, 3 e 6 frascos';
        if (/FUNCIONA VIT POWER/i.test(base)) return 'Explicar se funciona';
        if (/DEPOIMENTO AUDIO PRODUTO/i.test(base)) return 'Depoimento do produto';
        if (/ENVIO AGENCIA 100 SEGURO/i.test(base)) return 'Seguranca da agencia';
        if (/TEMPO DEMORA/i.test(base)) return 'Tempo de entrega';
        if (/TEMPO RESULTADO/i.test(base)) return 'Tempo de resultado';
        if (/COMO SE TOMA/i.test(base)) return 'Como tomar Vit Power';
        if (/CLIENTES QUE LIGAM/i.test(base)) return 'Cliente quer ligar';
        if (/QUANDO CLIENTE INSISTE EM LIGAR|QUANDO CLIENTE LIGA/i.test(base)) return 'Nao atendemos ligacao';
        if (/AGRADECIMENTO/i.test(base)) return 'Agradecimento do pedido';
        if (/BONUS RETIRADA/i.test(base)) return 'Bonus de retirada';
        if (/CHEGOU 01/i.test(base)) return 'Chegou 01 · pedido na agencia';
        if (/CHEGOU 02/i.test(base)) return 'Chegou 02 · lembrete de retirada';
        if (/CHEGOU 03/i.test(base)) return 'Chegou 03 · ultimo reforco';
        return base;
    };

    const audioGroup = (baseName) => {
        const value = String(baseName || '').toUpperCase();
        const groups = [
            { label: 'Entrada', match: /01[_ ]|BUENOS|BUENAS|NOME CIUDAD|NOME CIDADE|PROVINCIA/ },
            { label: 'Prova e produto', match: /FUNCIONA|DEPOIMENTO|100 NATURAL|PRODUDO|PRODUTO|CAPSULA|AJUDA|PROSTADA|PROSTATA/ },
            { label: 'Oferta e frascos', match: /TRATAMENTO Y PRECIOS|BOTELLA|BOTELLAS|QUANTOS FRASCOS|PROMOCAO/ },
            { label: 'Objecoes', match: /TEMPO|COMO SE TOMA|COMO TOMAR|CLIENTES QUE LIGAM|LIGAR|LIGA|INSISTE|NAO PODE|EFEITO IMEDIATO/ },
            { label: 'Logistica e agencia', match: /AGENCIA|DOMICILIO|SERVIENTREGA|SERVITREGA|ENTREGA|ENDERECO|ORIENTACAO|CONFIRMACION/ },
            { label: 'Fechamento', match: /AGRADECIMENTO|BONUS|OBRIGADO|PAGOU|GUIA/ },
            { label: 'Pos-venda', match: /CHEGOU|INFORMATIVO|FASE ENTREGA/ }
        ];
        const index = groups.findIndex((group) => group.match.test(value));
        return index < 0 ? { label: 'Outros funis', order: groups.length } : { ...groups[index], order: index };
    };

    const audioPriority = [
        /TRATAMENTO Y PRECIOS|PRECIOS/i,
        /FUNCIONA VIT POWER/i,
        /NOME CIUDAD|NOME CIDADE|PROVINCIA/i,
        /PERGUNTA AGENCIA DOMICILIO/i,
        /ENDERECO CIDADE PROVINCIA AGENCIA|DOMICILIO REFERENCIA/i,
        /AGRADECIMENTO|BONUS RETIRADA/i
    ];

    const sortedAudioNames = () => [...AUDIO_BASE_NAMES].sort((left, right) => {
        const leftGroup = audioGroup(left);
        const rightGroup = audioGroup(right);
        const leftPriority = audioPriority.findIndex((pattern) => pattern.test(left));
        const rightPriority = audioPriority.findIndex((pattern) => pattern.test(right));
        return leftGroup.order - rightGroup.order
            || (leftPriority < 0 ? 999 : leftPriority) - (rightPriority < 0 ? 999 : rightPriority)
            || left.localeCompare(right, undefined, { numeric: true, sensitivity: 'base' });
    });

    const defaultBlocks = (productKey) => {
        if (isNitrix(productKey)) {
            return [
                {
                    code: 'B01',
                    type: 'block',
                    typeLabel: 'bloco',
                    label: 'Inicio completo Nitrix',
                    detail: 'Inicio universal 01 + Inicio universal 02 + Prova 1 + Frasco Nitrix',
                    value: 'nitrix_inicio_completo',
                    steps: [
                        { type: 'audio', label: 'Inicio universal 01', value: 'legacy-media/templates/EC/NITRIX_INICIO_01_VALERIA_ZAMBRANO_UNIVERSAL.ogg' },
                        { type: 'audio', label: 'Inicio universal 02', value: 'legacy-media/templates/EC/NITRIX_INICIO_02_VALERIA_ZAMBRANO_UNIVERSAL.ogg' },
                        { type: 'media', label: 'Prova 1', value: 'legacy-media/sales/shared/social_01.jpeg' },
                        { type: 'media', label: 'Frasco Nitrix', value: 'legacy-media/sales/ec/nitrix_bottle.png' }
                    ]
                },
                {
                    code: 'B02',
                    type: 'block',
                    typeLabel: 'bloco',
                    label: 'Frasco Nitrix',
                    detail: 'Imagem do produto Nitrix para atendimento manual',
                    value: 'nitrix_frasco',
                    steps: [
                        { type: 'media', label: 'Frasco Nitrix', value: 'legacy-media/sales/ec/nitrix_bottle.png' }
                    ]
                }
            ];
        }
        if (isTexUltra(productKey)) {
            return [{
                code: 'B01',
                type: 'block',
                typeLabel: 'bloco',
                label: 'Inicio completo Tex Ultra',
                detail: 'Inicio 01 + Inicio 02 + Prova 1 + Frasco Tex Ultra',
                value: 'tex_ultra_inicio_completo',
                steps: [
                    { type: 'audio', label: 'Inicio 01', value: 'legacy-media/templates/EC/01_B_Buenos_dias.ogg' },
                    { type: 'audio', label: 'Inicio 02', value: 'legacy-media/templates/EC/01_C_Buenos_tardes.ogg' },
                    { type: 'media', label: 'Prova 1', value: 'legacy-media/sales/shared/social_01.jpeg' },
                    { type: 'media', label: 'Frasco Tex Ultra', value: 'legacy-media/sales/ec/tex_ultra_bottle.png' }
                ]
            }];
        }
        return [{
            code: 'B01',
            type: 'block',
            typeLabel: 'bloco',
            label: 'Inicio completo',
            detail: 'Inicio 01 + Inicio 02 + Prova 1 + Frasco Vit Power',
            value: 'vit_power_inicio_completo',
            steps: [
                { type: 'audio', label: 'Inicio 01', value: 'legacy-media/templates/EC/01_B_Buenos_dias.ogg' },
                { type: 'audio', label: 'Inicio 02', value: 'legacy-media/templates/EC/01_C_Buenos_tardes.ogg' },
                { type: 'media', label: 'Prova 1', value: 'legacy-media/sales/shared/social_01.jpeg' },
                { type: 'media', label: 'Frasco Vit Power', value: 'legacy-media/sales/ec/vit_power.jpeg' }
            ]
        }];
    };

    const productAwareCustomBlock = (item, productKey) => {
        if (!isTexUltra(productKey) || item.value !== 'custom_1780182896042_1b91ef') return item;
        return {
            ...item,
            label: 'INICIO_01_02_PROVA01_FRASCO_TEX_ULTRA',
            detail: 'INICIO 01 + INICIO 02 + Prova 1 + Frasco Tex Ultra',
            steps: [
                { type: 'audio', label: 'INICIO 01', value: 'legacy-media/templates/EC/01_B_Buenos_dias.ogg' },
                { type: 'audio', label: 'INICIO 02', value: 'legacy-media/templates/EC/01_C_Buenos_tardes.ogg' },
                { type: 'media', label: 'Prova 1', value: 'legacy-media/sales/shared/social_01.jpeg' },
                { type: 'media', label: 'Frasco Tex Ultra', value: 'legacy-media/sales/ec/tex_ultra_bottle.png' }
            ]
        };
    };

    const blocks = (productKey) => [
        ...defaultBlocks(productKey),
        ...CUSTOM_BLOCKS.map((item, index) => ({
            ...productAwareCustomBlock(item, productKey),
            code: shortCode('B', index + 1),
            type: 'block',
            typeLabel: 'bloco',
            custom: true
        }))
    ];

    const draftText = (kind, productKey) => {
        const product = productName(productKey);
        const price = productKey === 'tex_ultra_ec'
            ? '1 frasco por USD 35.99, 2 frascos por USD 70.00, 3 frascos por USD 80.99 y 6 frascos por USD 147.99'
            : '1 frasco por USD 39.99, 3 frascos por USD 95.99 y 6 frascos por USD 167.99';
        const templates = {
            offer: `Le confirmo la promocion de ${product}: ${price}. La opcion mas recomendada es la de 3 frascos porque aprovecha mejor el tratamiento y trae regalo sorpresa. Cual le gustaria separar?`,
            proof: 'Le comparto algo importante: varios clientes que tenian la misma duda ya recibieron su pedido y nos contaron que les fue muy bien. Si quiere, le ayudo a dejar el suyo listo hoy.',
            data: 'Perfecto, para dejarlo listo me confirma por favor: nombre completo, ciudad y direccion completa para la entrega?',
            close: 'Listo, entonces le confirmo el pedido con esos datos. Lo dejamos preparado para envio y la transportadora se comunica antes de la entrega. Esta correcto?',
            cmd_euatendo: '#euatendo',
            cmd_botliberado: '#botliberado'
        };
        return templates[kind] || '';
    };

    const drafts = (productKey) => [
        ...CUSTOM_TEXTS.map((item, index) => ({
            ...item,
            code: shortCode('P', index),
            type: 'draft',
            typeLabel: 'texto proprio',
            detail: item.text.split('\n').find(Boolean) || item.label,
            value: `custom_text:${item.id}`
        })),
        { code: 'T01', type: 'draft', typeLabel: 'texto', label: 'Oferta', detail: 'Envia oferta e preco direto', value: 'offer', text: draftText('offer', productKey) },
        { code: 'T02', type: 'draft', typeLabel: 'texto', label: 'Prova social', detail: 'Envia confianca e resultado direto', value: 'proof', text: draftText('proof', productKey) },
        { code: 'T03', type: 'draft', typeLabel: 'texto', label: 'Pedir dados', detail: 'Envia pedido de nome, cidade e endereco', value: 'data', text: draftText('data', productKey) },
        { code: 'T04', type: 'draft', typeLabel: 'texto', label: 'Confirmar', detail: 'Envia confirmacao do pedido direto', value: 'close', text: draftText('close', productKey) },
        { code: 'C01', type: 'draft', typeLabel: 'acao', label: '#euatendo', detail: 'Assumir atendimento humano', value: 'cmd_euatendo', text: '#euatendo' },
        { code: 'C02', type: 'draft', typeLabel: 'acao', label: '#botliberado', detail: 'Liberar bot novamente', value: 'cmd_botliberado', text: '#botliberado' }
    ];

    const audios = () => sortedAudioNames().map((baseName, index) => ({
        code: shortCode('A', index),
        type: 'audio',
        typeLabel: 'audio',
        label: audioLabel(baseName),
        detail: `${audioGroup(baseName).label} - ${fileName(baseName)}`,
        value: `legacy-media/templates/EC/${baseName}.ogg`,
        mediaUrl: `legacy-media/templates/EC/${baseName}.ogg`
    }));

    const uploads = () => CUSTOM_UPLOADS.map((item, index) => ({
        ...item,
        code: shortCode('U', index),
        type: item.mediaType === 'audio' ? 'audio' : 'media',
        typeLabel: item.mediaType === 'audio' ? 'audio proprio' : 'midia propria',
        mediaUrl: item.value
    }));

    const media = (productKey) => {
        const primaryNitrix = isNitrix(productKey);
        const primaryTexUltra = isTexUltra(productKey);
        const product = primaryTexUltra
            ? { label: 'Frasco Tex Ultra', value: 'legacy-media/sales/ec/tex_ultra_bottle.png' }
            : primaryNitrix
            ? { label: 'Frasco Nitrix', value: 'legacy-media/sales/ec/nitrix_bottle.png' }
            : { label: 'Frasco Vit Power', value: 'legacy-media/sales/ec/vit_power.jpeg' };
        const alternate = primaryTexUltra
            ? { label: 'Frasco Tex Ultra', value: 'legacy-media/sales/ec/tex_ultra_bottle.png' }
            : primaryNitrix
            ? { label: 'Frasco Vit Power', value: 'legacy-media/sales/ec/vit_power.jpeg' }
            : { label: 'Frasco Nitrix', value: 'legacy-media/sales/ec/nitrix_bottle.png' };
        return [
            { code: 'M01', type: 'media', typeLabel: 'midia', label: product.label, detail: fileName(product.value), value: product.value },
            { code: 'M02', type: 'media', typeLabel: 'midia', label: 'Prova 1', detail: 'social 01', value: 'legacy-media/sales/shared/social_01.jpeg' },
            { code: 'M03', type: 'media', typeLabel: 'midia', label: 'Prova 2', detail: 'social 02', value: 'legacy-media/sales/shared/social_02.jpeg' },
            { code: 'M04', type: 'media', typeLabel: 'midia', label: 'Prova 3', detail: 'social 03', value: 'legacy-media/sales/shared/social_03.jpeg' },
            { code: 'M05', type: 'media', typeLabel: 'midia', label: 'Prova 4', detail: 'social 04', value: 'legacy-media/sales/shared/social_04.jpeg' },
            { code: 'M06', type: 'media', typeLabel: 'video', label: 'Video', detail: 'prova social video boquet', value: 'legacy-media/sales/shared/prova_social_video_boquet.mp4', viewOnce: true },
            { code: 'M07', type: 'media', typeLabel: 'midia', label: alternate.label, detail: fileName(alternate.value), value: alternate.value }
        ];
    };

    const list = ({ productKey = 'tex_ultra_ec' } = {}) => [
        ...blocks(productKey),
        ...drafts(productKey),
        ...audios(),
        ...uploads(),
        ...media(productKey)
    ];

    const resolveText = (value, productKey) => {
        if (String(value || '').startsWith('custom_text:')) {
            return customTextById(String(value).replace(/^custom_text:/, ''))?.text || '';
        }
        return draftText(value, productKey);
    };

    globalThis.VitalismenLegacyFunnel = Object.freeze({
        PRODUCT_NAMES,
        AUDIO_BASE_NAMES,
        CUSTOM_TEXTS,
        CUSTOM_UPLOADS,
        CUSTOM_BLOCKS,
        productName,
        list,
        resolveText
    });
})();

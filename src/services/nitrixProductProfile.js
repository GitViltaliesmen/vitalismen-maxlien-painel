// Camada de dados exclusiva do Nitrix EC.
// Valores iguais aos atuais foram declarados aqui como catalogo proprio: este
// modulo nao le, importa nem deriva valores de nenhum outro produto.
const price = (quantity, amount) => Object.freeze({
    quantity,
    amount,
    currency: 'USD',
    label: `${quantity} ${quantity === 1 ? 'frasco' : 'frascos'} por ${amount} USD`
});

export const NITRIX_EC_PRODUCT_PROFILE = Object.freeze({
    key: 'nitrix_ec',
    country: 'EC',
    displayName: 'Nitrix Oxide Ecuador',
    bottle: Object.freeze({
        media: '/media/sales/ec/nitrix_bottle.png',
        caption: 'Este es el frasco oficial de Nitrix Ecuador.',
        confirmationText: '¿Es este el producto que desea?'
    }),
    entry: Object.freeze({
        audioNames: Object.freeze([
            'NITRIX_INICIO_01_VALERIA_ZAMBRANO_UNIVERSAL',
            'NITRIX_INICIO_02_VALERIA_ZAMBRANO_UNIVERSAL'
        ]),
        // Acolhimento curto para quem iniciou o WhatsApp pela VSL /n/.
        // Nao pede preco, nao faz promessa e nao substitui os dois audios.
        openingVariants: Object.freeze([
            '¡Hola! Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Gracias por escribirnos; ya le explico por audio.',
            '¡Hola! Le saluda Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Vi que llegó por la presentación de Nitrix; permítame explicarle por audio.',
            'Hola, mucho gusto. Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Gracias por entrar en contacto; le envío un audio enseguida.',
            '¡Hola! Gracias por escribirnos. Le habla Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Ya le cuento por audio sobre lo que vio.',
            'Hola, qué gusto atenderle. Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Enseguida le envío un audio para orientarle.',
            '¡Bienvenido! Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Gracias por llegar desde la presentación de Nitrix; ya le explico por audio.'
        ]),
        // Esta identificacao ocorre somente apos o audio 2, se o nome completo
        // ainda nao estiver salvo. Cada conversa recebe uma unica variante.
        nameIntroVariants: Object.freeze([
            '¡Hola! Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Vi que llegó por la presentación de Nitrix. Para atenderle mejor, ¿me indica su nombre completo, por favor?',
            'Hola, mucho gusto. Le habla Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Vi que nos escribió después de conocer Nitrix. ¿Con quién tengo el gusto?',
            '¡Bienvenido! Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Para acompañar su atención de forma más personal, ¿me comparte su nombre completo?',
            'Hola, gracias por escribirnos. Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Vi que viene de la presentación de Nitrix. ¿Me confirma su nombre completo, por favor?',
            '¡Hola! Le saluda Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Será un gusto ayudarle. Antes de continuar, ¿cómo se llama?',
            'Hola, soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Vi que llegó por la información de Nitrix. Para saber cómo llamarle, ¿me dice su nombre completo?',
            '¡Qué gusto tenerle por aquí! Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Para seguir con su atención, ¿me indica su nombre completo?',
            'Hola, le habla Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Estoy aquí para ayudarle con cualquier duda sobre lo que vio. ¿Me comparte su nombre completo?',
            '¡Hola! Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Vi que llegó desde la presentación de Nitrix. Antes de seguir, ¿me confirma su nombre completo?',
            'Hola, mucho gusto. Soy Valeria Zambrano, del equipo de la Dra. Maria Fernandes. Para dejar su atención bien identificada, ¿podría decirme su nombre completo?'
        ]),
        proofPurpose: 'nitrix_prova',
        proofItems: Object.freeze([
            'image:social_01',
            'image:social_02',
            'image:social_03',
            'image:social_04'
        ])
    }),
    // Tabela Nitrix propria, espelhada da VSL /n/ vigente. Ela nao possui
    // qualquer referencia de execucao a outro funil.
    offerCatalog: Object.freeze({
        original: Object.freeze({
            1: price(1, '39.99'),
            3: price(3, '95.99'),
            6: price(6, '167.99')
        }),
        // Recuperacao somente e aplicada quando um atendente a escolhe
        // explicitamente no painel; o bot nunca a oferece sozinho.
        recovery: Object.freeze({
            1: price(1, '35'),
            2: price(2, '70'),
            3: price(3, '80'),
            6: price(6, '147')
        })
    }),
    guarantee: Object.freeze({
        text: 'Sí, señor. Nitrix cuenta con la garantía oficial de 60 días desde la recepción del pedido. Si surge alguna novedad, la revisamos por este canal oficial.'
    }),
    health: Object.freeze({
        // Audio universal ja aprovado para duvidas de saude; nao contem nome
        // de produto e pertence a biblioteca comum EC.
        approvedAudioName: '100_NATURAL_SEM_CONTRA_INDICACAO',
        companionText: 'Señor, gracias por compartir eso conmigo. Entiendo perfectamente su preocupación, ya que la salud es nuestra prioridad. Nuestro producto es 100% natural y la doctora ya dejó toda la orientación en la VSL y en los audios aprobados. Si desea un acompañamiento más cercano, agende el Protocolo de Salud Masculina con la Dra. Maria Fernandes. Ella le va a orientar y acompañar correctamente.'
    }),
    usage: Object.freeze({
        // Audio fornecido para Nitrix EC. Cada variante abaixo apenas resume
        // o mesmo modo de uso informado junto com este audio.
        approvedAudioName: 'NITRIX_USO_OXIDE_EC',
        form: 'capsulas',
        companionVariants: Object.freeze([
            '📦 Cada frasco contiene 60 cápsulas para 1 mes. Tome 2 cápsulas por la mañana después del desayuno y 1 cápsula extra 30 minutos antes de tener relaciones. Es de uso continuo y no exceda la dosis recomendada.',
            'Para el uso diario: 2 cápsulas por la mañana después del desayuno. Antes de tener relaciones, 1 cápsula extra 30 minutos antes. Cada frasco trae 60 cápsulas para un mes; no exceda la dosis.',
            'Le resumo el modo de uso: 2 cápsulas después del desayuno cada mañana y 1 adicional 30 minutos antes de tener relaciones. El frasco alcanza para 1 mes y el tratamiento es continuo.',
            '✅ Son 60 cápsulas por frasco, suficientes para 1 mes. Use 2 por la mañana después del desayuno; antes de relaciones, 1 extra 30 minutos antes. No supere la dosis indicada.',
            'La indicación es continua: 2 cápsulas por la mañana, después del desayuno, y 1 cápsula adicional 30 minutos antes de tener relaciones. El desayuno mejora la absorción y el efecto durante el día.',
            'Cada mes corresponde a 1 frasco de 60 cápsulas. Tome 2 después del desayuno cada mañana. Si tendrá relaciones, agregue 1 cápsula 30 minutos antes y no exceda la dosis recomendada.',
            'Para mantener el tratamiento: 2 cápsulas al despertar, después del desayuno. Antes del acto sexual, 1 cápsula extra 30 minutos antes. Es un uso continuo y cada frasco dura 1 mes.',
            '📌 Uso Nitric Oxide: 2 cápsulas por la mañana después del desayuno; 1 cápsula adicional 30 minutos antes de relaciones. Son 60 cápsulas por frasco para 1 mes. No exceda la dosis.',
            'El audio explica el uso completo: diariamente 2 cápsulas después del desayuno, más 1 cápsula extra 30 minutos antes de tener relaciones. Siga el uso continuo y no exceda lo recomendado.',
            '🕗 Tome 2 cápsulas después del desayuno para el uso diario. Antes de relaciones sexuales, tome 1 cápsula extra 30 minutos antes. El frasco contiene 60 cápsulas para 1 mes y no debe exceder la dosis.'
        ])
    })
});

export const nitrixPriceText = (catalog = 'original') => Object.values(NITRIX_EC_PRODUCT_PROFILE.offerCatalog[catalog] || NITRIX_EC_PRODUCT_PROFILE.offerCatalog.original)
    .map((item) => `• ${item.label}`)
    .join('\n');

export const nitrixPriceForQuantity = (quantity, catalog = 'original') => (
    (NITRIX_EC_PRODUCT_PROFILE.offerCatalog[catalog] || NITRIX_EC_PRODUCT_PROFILE.offerCatalog.original)[Number(quantity)] || null
);

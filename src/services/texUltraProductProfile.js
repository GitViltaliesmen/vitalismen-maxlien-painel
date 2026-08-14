const price = (quantity, amount, promoted) => Object.freeze({
    quantity,
    amount,
    currency: 'USD',
    promoted,
    label: `${quantity} ${quantity === 1 ? 'frasco' : 'frascos'} por ${amount} USD`
});

export const TEX_ULTRA_EC_PRODUCT_PROFILE = Object.freeze({
    key: 'tex_ultra_ec',
    country: 'EC',
    displayName: 'Tex Ultra Ecuador',
    bottle: Object.freeze({
        media: '/media/sales/ec/tex_ultra.png',
        caption: 'Este es el producto oficial Tex Ultra Ecuador.'
    }),
    entry: Object.freeze({
        audioNames: Object.freeze([
            '01_B_Buenos_dias',
            '01_C_Buenos_tardes'
        ]),
        proofPurpose: 'tex_ultra_prova_compartilhada',
        proofItems: Object.freeze([
            'image:social_01',
            'image:social_02',
            'image:social_03',
            'image:social_04'
        ])
    }),
    offerCatalog: Object.freeze({
        1: price(1, '35.99', true),
        2: price(2, '70.00', true),
        3: price(3, '80.99', true),
        6: price(6, '147.99', true)
    }),
    postSale: Object.freeze({
        thankYouAudioName: 'OBRIGADO_PAGOU',
        howToUseAudioName: '',
        refillAudioName: ''
    })
});

export const texUltraPublicOfferText = () => Object.values(TEX_ULTRA_EC_PRODUCT_PROFILE.offerCatalog)
    .filter((item) => item.promoted)
    .map((item) => `- ${item.label}`)
    .join('\n');

export const texUltraPriceForQuantity = (quantity) => (
    TEX_ULTRA_EC_PRODUCT_PROFILE.offerCatalog[Number(quantity)] || null
);

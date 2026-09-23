export const POST_SALE_TEMPLATE_CATALOG_V147 = Object.freeze({
    POST_PURCHASE_TEMPLATE: Object.freeze({
        id: 'P0_POST_PURCHASE',
        labels: Object.freeze(['Agradecimento_Agencia_01', 'CONFIRMACION_Y_REGALITO_ESPECIAL']),
        enabled: true,
        country: 'EC',
        product: 'delivery_mode_specific',
        trigger: 'confirmed_real_order',
        textPresent: true,
        mediaPresent: true,
        placeholdersValid: true
    }),
    BONUS_PROMISE_TEMPLATE: Object.freeze({ id: 'P0_BONUS_PROMISE', labels: Object.freeze(['BONUS_RETIRADA']), enabled: true, country: 'EC', product: 'all', trigger: 'confirmed_real_order', textPresent: false, mediaPresent: true, placeholdersValid: true }),
    GUIDE_CREATED_TEMPLATE: Object.freeze({ id: 'P1_GUIDE_CREATED', labels: Object.freeze(['shipment_guide_text', 'CONFIRMACION_Y_REGALITO_ESPECIAL']), enabled: true, country: 'EC', product: 'all', trigger: 'valid_guide_transition', textPresent: true, mediaPresent: true, placeholdersValid: true }),
    A07: Object.freeze({ id: 'A07', labels: Object.freeze(['Chegou_01']), enabled: true, country: 'EC', product: 'all', trigger: 'can_pickup_no_to_yes', textPresent: true, mediaPresent: true, placeholdersValid: true }),
    A10: Object.freeze({ id: 'A10', labels: Object.freeze(['Chegou_02']), enabled: true, country: 'EC', product: 'all', trigger: 'a07_accepted_plus_72h', textPresent: false, mediaPresent: true, placeholdersValid: true }),
    A19: Object.freeze({ id: 'A19', labels: Object.freeze(['Chegou_03']), enabled: true, country: 'EC', product: 'all', trigger: 'a07_accepted_plus_120h_after_a10', textPresent: false, mediaPresent: true, placeholdersValid: true }),
    DELIVERED_THANKYOU_TEMPLATE: Object.freeze({ id: 'P5_DELIVERED_THANKYOU_NEUTRAL', labels: Object.freeze(['OBRIGADO_PAGOU']), enabled: true, country: 'EC', product: 'all', trigger: 'carrier_delivered', textPresent: false, mediaPresent: true, placeholdersValid: true }),
    BONUS_ACCESS_TEMPLATE: Object.freeze({ id: 'P6_BONUS_ACCESS', labels: Object.freeze(['VIT_POWER_PICKUP_BONUS_TEXT']), enabled: true, country: 'EC', product: 'all', trigger: 'servientrega_delivered_after_p5', textPresent: true, mediaPresent: false, placeholdersValid: true }),
    USAGE_TEX_ULTRA: Object.freeze({ id: 'P7_USAGE_TEX_ULTRA', labels: Object.freeze(['MODO_DE_USO_TEX_ULTRA']), enabled: true, country: 'EC', product: 'tex_ultra_ec', trigger: 'servientrega_delivered_after_p6', textPresent: false, mediaPresent: true, placeholdersValid: true }),
    USAGE_VIT_POWER: Object.freeze({ id: 'P7_USAGE_VIT_POWER', labels: Object.freeze(['COMO_SE_TOMA_VIT_POWER']), enabled: true, country: 'EC', product: 'vit_power_ec', trigger: 'servientrega_delivered_after_p6', textPresent: false, mediaPresent: true, placeholdersValid: true }),
    USAGE_NITRIX: Object.freeze({ id: 'P7_USAGE_NITRIX', labels: Object.freeze(['NITRIX_USO_OXIDE_EC']), enabled: true, country: 'EC', product: 'nitrix_ec', trigger: 'servientrega_delivered_after_p6', textPresent: false, mediaPresent: true, placeholdersValid: true })
});

export const missingPostSaleTemplatesV147 = () => Object.values(POST_SALE_TEMPLATE_CATALOG_V147)
    .filter((template) => !template.enabled || (!template.textPresent && !template.mediaPresent))
    .map((template) => template.id);

export default POST_SALE_TEMPLATE_CATALOG_V147;

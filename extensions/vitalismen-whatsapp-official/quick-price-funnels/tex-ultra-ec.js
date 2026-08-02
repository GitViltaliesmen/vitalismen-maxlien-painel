(function (root) {
    'use strict';
    root.VitalismenQuickPriceFunnel.register({
        productKey: 'tex_ultra_ec',
        productName: 'Tex Ultra',
        version: '1.1.0',
        offers: [
            { quantity: 1, price: '$35,99', buttonLabel: '1 frasco · $35,99', text: '¡Claro! Le envío 1 frasco por $35,99. ¿De acuerdo?' },
            { quantity: 2, price: '$70,00', buttonLabel: '2 frascos · $70,00', text: '¡Perfecto! Le envío 2 frascos por $70,00. ¿Le parece bien?' },
            { quantity: 3, price: '$80,99', buttonLabel: '3 frascos · $80,99', text: '¡Excelente! Le envío 3 frascos por $80,99. ¿Confirmamos?' },
            { quantity: 6, price: '$147,99', buttonLabel: '6 frascos · $147,99', text: '¡Muy bien! Le envío 6 frascos (tratamiento completo) por $147,99. ¿Está de acuerdo?' }
        ],
        prompts: [
            { id: 'nombre', buttonLabel: 'Nombre', text: '¿Cuál es su nombre completo?' },
            { id: 'direccion', buttonLabel: 'Dirección', text: '¿Cuál es su ciudad y provincia?' },
            {
                id: 'envio-agencia',
                buttonLabel: '¿Envío agencia?',
                text: '¿Puedo enviar su pedido a una agencia de Servientrega? ¿Sabría decirme el nombre de la agencia de Servientrega?'
            }
        ]
    });
}(globalThis));

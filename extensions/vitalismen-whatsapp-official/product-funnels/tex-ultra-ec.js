(function (root) {
    'use strict';
    root.VitalismenProductFunnel.register({
        productKey: 'tex_ultra_ec', productName: 'Tex Ultra', funnelVersion: '1.0.0',
        templates: [
            { id: 'tex_ultra_ec:welcome', code: 'P01', category: 'abertura', stages: ['novo', 'qualificando'], title: 'Apresentar Tex Ultra', preview: 'Abertura curta e pergunta de intenção', text: 'Hola{{nome_curto}}. Gracias por contactarnos 😊 Soy del equipo de atención de Tex Ultra. Para orientarle bien, ¿busca información, precio o desea hacer su pedido?' },
            { id: 'tex_ultra_ec:offer', code: 'P02', category: 'oferta', stages: ['qualificando', 'oferta'], title: 'Oferta por quantidade', preview: 'Apresenta as opções sem pressionar', text: ['📦 *Hoy tenemos kits promocionales disponibles con precios especiales*:', '🟢 1 mes por solo $35,99', '🟡 2 meses por $70,00', '🟠 3 meses por $80,99', '🔴 6 meses (tratamiento completo) por $147,99', '', '¿Cuántos frascos desea?'].join('\n') },
            { id: 'tex_ultra_ec:trust', code: 'P03', category: 'confianca', stages: ['qualificando', 'oferta'], title: 'Confiança e atendimento', preview: 'Reforça acompanhamento e tira dúvidas', text: 'Entiendo su duda. Nuestro equipo le acompaña antes y después de la entrega de Tex Ultra. Puede preguntarme todo lo que necesite antes de decidir.' },
            { id: 'tex_ultra_ec:data', code: 'P04', category: 'dados', stages: ['coleta_dados'], title: 'Pedir dados do pedido', preview: 'Nome, cidade, província e entrega', text: 'Perfecto{{nome_curto}}. Para registrar su pedido de Tex Ultra, confírmeme por favor: nombre completo, ciudad, provincia y dirección o agencia Servientrega.' },
            { id: 'tex_ultra_ec:confirm', code: 'P05', category: 'confirmacao', stages: ['aguardando_confirmacao', 'confirmado'], title: 'Confirmar antes de registrar', preview: 'Resumo preenchido pela ficha inteligente', text: 'Le confirmo antes de registrar:\n• Producto: Tex Ultra\n• Cantidad: {{quantidade}}\n• Valor: {{valor}}\n• Cliente: {{nome}}\n• Entrega: {{entrega}}\n• Ciudad/Provincia: {{cidade_provincia}}\n\n¿Todo está correcto?' },
            { id: 'tex_ultra_ec:followup', code: 'P06', category: 'retorno', stages: ['comprar_depois', 'recompra', 'pos_venda'], title: 'Retomar com permissão', preview: 'Seguimento curto, respeitoso e sem pressão', text: 'Hola{{nome_curto}}. ¿Desea que continuemos con la información de Tex Ultra? Si ya no le interesa, me avisa y no le vuelvo a escribir.' }
        ]
    });
}(globalThis));

# Funil de atendimento e fechamento Vitalismen

Este é o fluxo operacional único para atendimento, venda e fechamento usando os áudios aprovados no projeto.

## Status oficial congelado

- Em 2026-05-06, o processo inicial do funil Vit Power ficou congelado como regra oficial.
- Em 2026-05-08, a estrutura de cliente sem dados no inicio ficou congelada ate o fechamento da primeira parte: escolha de pacote, agencia/domicilio, coleta de agencia, nome, confirmacao limpa, texto humano de fechamento, `Agradecimento_Agencia_01` e `BONUS_RETIRADA`.
- Em 2026-05-09, a estrutura de cliente com dados no inicio tambem ficou congelada: apresentação inicial sem tabela de preços, resumo limpo dos dados, valor da quantidade informada e confirmação final.
- A arquitetura oficial consolidada fica em `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.
- Nao refazer esta etapa do zero. Qualquer ajuste futuro deve manter a ordem aprovada, alterar apenas o ponto necessario e registrar a mudanca neste documento.
- O funil deve gravar memoria por contato para nao repetir mensagens ou etapas ja realizadas.
- O envio deve parecer humano: mostrar digitando/gravando, respeitar pausas entre audio, prova social, imagem do produto e texto de valores.

## Regra principal

- Usar o painel em `http://127.0.0.1:3001/qr.html`, não abrir o HTML por `file://`.
- Se um atendente enviar texto, áudio ou mídia manualmente, a conversa entra em modo humano para evitar que a automação atropela o atendimento.
- Antes de disparos automáticos em massa, conferir saldo Dropi, WhatsApp conectado e chaves Meta/Facebook.
- O funil comercial deve usar áudio gravado aprovado como padrão, buscando cerca de 90% do percurso em áudio quando houver template disponível. Texto fica reservado para preço, quantidade, dados de entrega, confirmação final e campos que precisam ser conferidos sem erro.

## Etapas do funil

1. Entrada do cliente
   - O roteador identifica país, intenção e agente:
     - Equador: `vit_power_ec`
     - Consulta/ecossistema: `vitalismen`
     - Conversa leve: `warmup`
   - Se a automação estiver ligada, a IA responde respeitando modo humano e lista permitida.
   - Mensagens iniciais como `Hola deseo Vit Power`, `Hola desejo Vit Power`, `Quiero saber del producto`, `Quero saber do produto`, `precio Vit Power` ou equivalentes devem iniciar o funil gravado, não uma resposta livre de texto.
   - A lista oficial de variações de CTA do Vit Power fica em `src/services/initialFunnelTriggers.js` e também exposta para páginas em `public/cta-vit-power-messages.json`.
   - Se a mensagem vier do formulário final da VSL, a primeira linha deve ser uma frase oficial de CTA. Nesse caso, mesmo com dados completos (`Nombre`, `Teléfono`, `Provincia`, `Ciudad`, `Dirección`, `Cantidad`, `Total`), o bot deve iniciar o funil gravado antes de seguir para fechamento.
   - Se vier apenas dados completos sem frase oficial de CTA na primeira linha, tratar como pedido/dados e não reiniciar apresentação.
   - Mensagem de formulário com dados nunca deve cair em resposta livre da IA. A regra é determinística:
     - se faltar só `Punto de referencia`, perguntar apenas esse campo;
     - se os dados estiverem completos, responder que os dados e a agência foram recebidos;
     - fechar com chamada direta para a quantidade do formulario, quando existir. Ex.: `Cantidad: 6` deve gerar `Hoy puede separar 6 frascos de VIT POWER por $167.99. Para confirmar, responda: 6 FRASCOS.`

2. Primeiro atendimento com áudio aprovado
   - Regra fixa de disparo inicial:
     3. enviar prova social 1;
     4. enviar prova social 2;
     5. enviar imagem do frasco oficial `Vit Power`;
     6. enviar texto de valores com chamada direta para confirmar a quantidade escolhida, quando existir; sem formulario, perguntar se deseja 1, 3 ou 6 frascos.
     7. enviar audio de valores `TRATAMENTO_Y_PRECIOS_PROMOCAO`.
   - A ordem de fase e obrigatoria: os audios iniciais precisam sair antes das provas; as provas precisam sair antes do frasco e dos valores. Frasco e valores podem variar entre si quando houver necessidade operacional, mas nunca antes dos audios iniciais e das provas.
   - Ritmo oficial de envio:
     - o proprio disparo simula `recording` para audio e `composing` para texto/imagem;
     - depois de cada audio, aguardar entre `INITIAL_FUNNEL_AFTER_AUDIO_MIN_MS` e `INITIAL_FUNNEL_AFTER_AUDIO_MAX_MS`;
     - depois de cada imagem/prova, aguardar entre `INITIAL_FUNNEL_AFTER_IMAGE_MIN_MS` e `INITIAL_FUNNEL_AFTER_IMAGE_MAX_MS`;
     - antes do texto de valores, aguardar entre `INITIAL_FUNNEL_BEFORE_PRICE_MIN_MS` e `INITIAL_FUNNEL_BEFORE_PRICE_MAX_MS`;
     - valores atuais oficiais: audio `7000-14000ms`, imagem `6000-12000ms`, antes do preco `8000-16000ms`.
   - Memoria obrigatoria: cada etapa concluida fica gravada no contato para nao repetir o processo ja realizado. Chaves esperadas:
     - `image:social_01`
     - `image:social_02`
     - `image:vit_power_bottle`
     - `text:price`
     - `audio:TRATAMENTO_Y_PRECIOS_PROMOCAO`
   - A apresentacao inicial so pode ser considerada concluida quando todas as chaves oficiais acima existirem na memoria. Marcas antigas como `initialProductPresentationSentAt` nao bastam para pular audio/imagem.
   - Se o cliente reenviar uma mensagem inicial de CTA depois dessa apresentacao, bloquear repeticao e registrar `initial_product_presentation_already_done`.
   - Se o cliente reenviar formulario com dados completos, seguir o modelo de dados recebidos + apresentação + chamada para a quantidade do formulario (`1 FRASCO`, `3 FRASCOS` ou `6 FRASCOS`).
   - Se houver dados de formulario pendentes e o cliente enviar o ponto de referência na mensagem seguinte, juntar esse dado com a memória salva e iniciar o modelo de dados recebidos + apresentação.
   - No painel, estes áudios ficam em **Cliente selecionado > Audios do funil**.

3. Oferta e prova social
   - Usar respostas curtas por texto para preço, quantidade e fechamento.
   - Usar prova social/imagem aprovada quando houver dúvida de confiança.
   - Equador:
     - 1 frasco: 39.99 USD
     - 3 frascos: 95.99 USD + regalo sorpresa
     - 6 frascos: 167.99 USD + 2 regalos VIP

4. Coleta de dados para pedido
   - No caminho sem dados, depois que o cliente escolher quantidade e confirmar o valor com `SI/LISTO/OK/CORRECTO`, perguntar se deseja envio para agencia Servientrega ou domicilio usando `PERGUNTA_AGENCIA_DOMICILIO`.
   - Se o cliente responder agencia sem indicar cidade/provincia/agencia/endereco de referencia, enviar `ENDERECO_CIDADE_PROVINCIA_AGENCIA`.
   - Quando o cliente informar cidade, provincia e direcao/agencia, confirmar esses dados em texto e pedir somente o nome completo.
   - Quando o cliente informar o nome completo, confirmar em texto: nome, cidade, provincia e direcao/agencia; perguntar se esta de acordo ou se deseja alterar algo.
   - Fazer por texto para evitar erro:
     - nome completo
     - telefone
     - cidade
     - província/departamento
     - endereço completo
     - ponto de referência
     - quantidade escolhida
   - Depois do cliente responder a quantidade pedida, confirmar pedido, valor e agência em uma só mensagem:
     - `Le envío 6 frascos de VIT POWER por $167.99.`
     - nome da agência;
     - endereço da agência;
     - `¿Confirmo su pedido en esta agencia?`

5. Fechamento
   - Quando o cliente confirmar, marcar pedido como confirmado no sistema.
   - Após a confirmação de agência:
     - enviar áudio de agradecimento de agência quando houver template aprovado;
     - enviar `BONUS_RETIRADA` em seguida;
     - enviar texto final humano curto com agencia/endereco:
       `Gracias, señor. Su pedido quedó confirmado para envío a la agencia Servientrega: [AGENCIA] - [DIRECCION_AGENCIA]. Su compra ya quedó cerrada. Desde ahora le acompaño por aquí solo con la guía, la entrega y la retirada.`;
     - se for domicilio, o texto final deve confirmar o endereco do cliente:
       `Gracias, señor. Su pedido quedó confirmado para entrega a domicilio en: [DIRECCION_CLIENTE]. Su compra ya quedó cerrada. Desde ahora le acompaño por aquí solo con la guía, la entrega y cualquier novedad del pedido.`;
     - encerrar a etapa congelada.
   - O evento Purchase do Meta/Facebook depende das chaves do país configuradas.
   - Depois, enviar para Dropi pelo painel em **Vendas / Dropi**.

6. Dropi
   - Se o pedido chegar até `dropi_payment_required`, o processo está correto e parou apenas por saldo.
   - Se a Dropi rejeitar por dado/cidade/endereço, revisar o cartão do pedido antes de tentar de novo.

7. Pós-envio e retirada
   - `CONFIRMACION_Y_REGALITO_ESPECIAL`: guia gerada ou pedido em rota de entrega.
   - `Chegou_01`: primeiro audio quando o pedido fica disponível/chega na agência para retirada.
   - `CONFIRMACION_Y_REGALITO_ESPECIAL`: tambem entra logo depois de `Chegou_01` no aviso de agencia, como incentivo extra para retirada.
   - `Chegou_02`: primeiro lembrete de retirada.
   - `Chegou_03`: reforço final.
   - Depois da retirada, pedir comprovante e enviar bônus.

## Status atual dos áudios

- Equador pronto no projeto:
  - `PERGUNTA_AGENCIA_DOMICILIO`
  - `ENDERECO_CIDADE_PROVINCIA_AGENCIA`
  - `Agradecimento_Agencia_01`
  - `BONUS_RETIRADA`
  - `CONFIRMACION_Y_REGALITO_ESPECIAL`
  - `Chegou_01`
  - `Chegou_02`
  - `Chegou_03`
- Qualquer contexto fora de Ecuador/Vit Power deve permanecer fora deste projeto.

## Complemento lateral V35 — ingredientes por produto

- Perguntas de ingredientes, composição, fórmula ou conteúdo do produto usam
  resposta determinística em espanhol.
- A resposta é isolada pelo produto atual da ficha: Tex Ultra, Nitrix Oxide ou
  Vit Power.
- A camada não troca produto, não reinicia apresentação e não altera a etapa do
  funil.
- Pergunta que cita outro produto diferente da ficha não recebe composição
  automática, evitando contaminação entre VSLs.
- Contexto médico sensível tem prioridade e não recebe promessa comercial.
- Lock persistido e cooldown de trinta minutos impedem repetição.
- Contrato completo: `docs/EC_PRODUCT_INGREDIENTS_FAQ_FREEZE_V35_20260822.md`.

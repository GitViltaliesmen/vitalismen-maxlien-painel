# CONGELADO_PIPELINE_DROPI_E_SPINTAX_CADENCIA_20260527

Data: 2026-05-27

Objetivo: separar claramente o atendimento WhatsApp do envio interno para Dropi e adicionar variacao segura de texto nas mensagens ao cliente.

## Envio para Dropi

O envio para Dropi ja existe e nao e uma mensagem WhatsApp.

Fluxo encontrado:
- Pedido confirmado gera/atualiza `Order` e `Shipment`.
- Envio para Dropi Ecuador passa por `submitDroppiEcuadorOrder`.
- Antes de enviar, o pedido precisa estar autorizado em `automation.dropiSubmitAuthorizedAt`.
- Se nao estiver autorizado, a API retorna `authorizationRequired`.
- Quando envia com sucesso:
  - `automation.submittedToDroppiAt` e preenchido.
  - `automation.browserCheckpoint` vira `submitted_order`.
  - `review.reviewStatus` vira `submitted`.
  - `Order.status` vira `processing`.
  - `dropiOrderId` e salvo quando a Dropi devolve ID.
- Se a Dropi bloquear por saldo/credito, cai em `dropi_payment_required`.
- Se a Dropi rejeitar ou der erro, cai em revisao/envio manual.

Arquivos:
- `src/routes/shipments.js`
- `src/services/droppiEcuadorBrowserService.js`
- `src/services/droppiEcuadorService.js`
- `src/models/Shipment.js`

## Spintax e variacao de saudacao

Regra aplicada:
- Todo `sendText` pode renderizar spintax simples no formato `{opcao 1|opcao 2|opcao 3}`.
- Mensagens que comecam com saudacao alternam a abertura entre:
  - `Hola`
  - `Hola, buen dia`
  - `Buenos dias`
  - `Buenas`
- A variacao acontece depois da trava de dedupe, para nao transformar variacao em permissao para repetir o mesmo conteudo base.
- Pode ser desligado por `WHATSAPP_TEXT_VARIATION_ENABLED=false`.

Arquivos:
- `src/whatsapp/textVariation.js`
- `src/whatsapp/sendText.js`

## Delays

Regra aplicada:
- Intervalo global recomendado no ambiente:
  - `WHATSAPP_GLOBAL_QUEUE_GAP_MIN_MS=15000`
  - `WHATSAPP_GLOBAL_QUEUE_GAP_MAX_MS=30000`
- Alem disso continuam ativos:
  - pausa antes de texto/audio/midia
  - pausa depois de texto/audio/midia
  - fila por contato
  - dedupe de texto

Observacao:
- Essa camada reduz rajada e repeticao.
- Nao altera preco, 2 frascos, domicilio, cidade, pos-fechamento, objecoes ou fechamento.

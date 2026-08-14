# Freeze EC Meta Attribution Bridge - 2026-06-22

## Problema real
As vendas estavam sendo aceitas pela Meta como `Purchase` (`events_received: 1`), mas nao apareciam no Ads Manager/campanhas porque os pedidos confirmados estavam sem dados de atribuicao do clique:
- `fbc=0`
- `fbp=0`
- `fbclid=0`
- `sourceUrl=0`
- `utm_campaign=0`

Auditoria 14 dias antes da correcao:
- `purchaseSent`: 13
- `purchaseSentWithAttribution`: 0
- `purchaseSentBlind`: 13

Conclusao: o evento chegava no Events Manager, mas chegava "cego" para atribuicao. A visita VSL tinha `fbclid/fbc/fbp/UTM`, mas o pedido manual/WhatsApp nao herdava esses dados antes do Purchase.

## Correcao instalada
- `src/models/VslVisit.js`: salva `customerPhone` e `lastWhatsappMessage` na visita/click da VSL.
- `src/models/Order.js`: salva metadados da ponte de atribuicao no tracking do pedido.
- `src/services/metaAttributionService.js`: novo servico que busca visita VSL recente pelo telefone do cliente e copia `fbclid/fbc/fbp/UTM/sourceUrl/userAgent/ext_id` para o pedido.
- `src/services/metaConversionsService.js`: antes de enviar Purchase, chama a ponte de atribuicao; se o pedido tiver `fbc/fbp/fbclid/sourceUrl`, o Purchase sai como `action_source: website`.
- `src/routes/whatsapp.js`: `/api/whatsapp/vsl-entry` agora persiste telefone e mensagem do clique.
- `scripts/audit-meta-purchase-ec.mjs`: auditoria agora mostra `purchaseSentWithAttribution` e `purchaseSentBlind`.

## Backup VPS
`backups/meta-attribution-bridge-20260622211740`

## Teste seco VPS
Foi registrada uma visita/click controlado com telefone e parametros Meta. Depois foi montado um pedido fake em memoria com o mesmo telefone e `tracking: {}`. O envio `dryRun` de Purchase herdou:
- `fbclid`: sim
- `fbc`: sim
- `fbp`: sim
- `utm_campaign`: sim
- `sourceUrl`: sim
- `ext_id`: sim
- `action_source`: `website`
- `attributionSource`: `vsl_visit_phone_match`
- `attributionConfidence`: `phone_tail_recent_click`

Nenhuma venda fake foi enviada para Meta nesse teste.

## Regra operacional daqui para frente
- Purchase sem `fbc/fbp/fbclid/UTM/sourceUrl` pode aparecer no Events Manager, mas tem baixa chance de atribuir no Ads Manager.
- Purchase com ponte de atribuicao deve carregar clique/campanha e sair como website event.
- Nao reenviar vendas antigas com outro event_id para tentar atribuir, porque pode duplicar compras.
- A validacao correta nas proximas vendas e:
  - `events_received: 1`
  - `tracking.attributionSource = vsl_visit_phone_match`
  - `tracking.fbc` ou `tracking.fbclid` preenchido
  - `tracking.utm_campaign` preenchido quando veio de anuncio
  - Ads Manager com periodo incluindo a data da venda e coluna do dataset `1468946114265008`.

# Freeze EC Meta Funnel Events - 2026-06-22

## Problema
No Events Manager havia `PageView`, `Lead` e `Compra/Purchase`, mas `Ver conteudo/ViewContent` e `Finalizacao de compra iniciada/InitiateCheckout` quase nao apareciam. No Ads Manager as colunas de funil intermediario ficavam com traco porque o bot/funil nao disparava essas etapas de forma consistente.

Tambem foi observado que o Ads Manager da imagem estava com periodo ate 21/06/2026, enquanto as vendas conferidas eram de 22/06/2026. Esse filtro de data impede que vendas de 22/06 aparecam na tabela de campanhas mesmo quando o CAPI aceitou o evento.

## Correcao
- `src/models/VslVisit.js`: adicionados locks e respostas para `metaViewContent` e `metaInitiateCheckout`.
- `src/routes/whatsapp.js`: `/api/whatsapp/vsl-entry` agora envia:
  - `PageView` + `ViewContent` no carregamento/entrada da VSL;
  - `InitiateCheckout` + `Lead` no clique/acao de WhatsApp/compra.
- `src/routes/leads.js`: formulario/lead publico agora tambem envia `InitiateCheckout` quando gera pedido pendente ou reaproveita pedido ativo.
- `scripts/audit-meta-purchase-ec.mjs`: auditoria diaria agora conta `viewContent` e `initiateCheckout`.
- `scripts/audit-no-regression-meta-country.mjs`: passa a bloquear regressao se esses eventos sumirem.

## Testes
Local:
- `node --check src/models/VslVisit.js`
- `node --check src/routes/whatsapp.js`
- `node --check src/routes/leads.js`
- `node --check scripts/audit-meta-purchase-ec.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- Payload local de `ViewContent` e `InitiateCheckout` retornou `ok: true`.

VPS:
- Backup: `backups/meta-funnel-events-20260622210738`.
- Deploy feito em `/opt/vitalismen-automacao/current`.
- PM2 reiniciado, processo `vitalismen-automation` online.
- Teste controlado visitor `codex-meta-funnel-20260622180808`:
  - `PageView`: ok true.
  - `ViewContent`: ok true.
  - `InitiateCheckout`: ok true.
  - `Lead`: ok true.

Auditoria 1 dia apos teste:
- `purchaseSent`: 6.
- `purchasePending`: 0.
- `purchaseFailed`: 0.
- `pageView`: 2310.
- `viewContent`: 1.
- `initiateCheckout`: 1.
- `lead`: 36.

## Regra operacional
Para conferir no Facebook:
- Events Manager pode demorar ate 30 minutos para exibir evento novo.
- Ads Manager mostra apenas eventos atribuidos ao periodo/campanha/conjunto selecionado.
- Para vendas de 22/06/2026, selecionar periodo incluindo 22/06/2026.
- Usar colunas do mesmo dataset/pixel `1468946114265008`.

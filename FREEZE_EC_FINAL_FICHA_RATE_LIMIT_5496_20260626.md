# Freeze Final EC Ficha / Rate Limit / Contato 5496 - 2026-06-26

## Estado Congelado

Dominio: `https://ec.maxlien.shop`

Painel: `https://ec.maxlien.shop/qr.html`

Release ativo: `/opt/vitalismen-automacao/releases/202606141310`

Servico PM2: `vitalismen-automation`

## O Que Ficou OK

- Ficha do Cliente salva sem `Too many requests`.
- Alteracao de estado do pedido salva sem `Too many requests`.
- Pesquisa de agencias EC voltou a retornar sugestoes.
- Contato com final `5496` voltou a aparecer no painel de atendimento.
- Ficha do contato `5496` aponta para o pedido confirmado atual.

## Pedido/Contato Conferido

- Cliente: `Okey Listo`
- Telefone: final `5496`
- Pedido confirmado atual: `EC-MQSUK7D8-DXS8`
- Status: `confirmed`
- Cidade: `Latacunga`
- Total: `95.99`

Observacao: o identificador `5496` era final de telefone, nao numero de pedido. O contato ainda apontava para o registro antigo `EC-ADMIN-1978`; foi resincronizado para abrir a Ficha pelo pedido confirmado atual.

## Correcoes Incluidas Neste Congelamento

### Rate limit da Ficha

Arquivo publicado:

- `/opt/vitalismen-automacao/releases/202606141310/src/index.js`

Regra congelada:

- O rate limiter global usa `cf-connecting-ip` quando disponivel.
- Leituras operacionais do painel nao consomem a cota global.
- Escritas especificas da Ficha/status nao consomem a cota global.
- Rotas sensiveis fora da Ficha continuam protegidas.

### Contato `5496`

Estado ajustado:

- `ContactState.chatId`: `593990125496@c.us`
- `metadata.customerDraft.orderId`: `EC-MQSUK7D8-DXS8`
- `metadata.customerDraft.status`: `confirmado`

Nao foi alterado o pedido Mongo nem o lead admin antigo. Foi ajustado somente o estado do atendimento para o painel voltar a localizar a Ficha correta.

## Evidencias

Busca de agencias:

- `GET /api/shipments/servientrega/ec/agencies?city=Quito&limit=5`
- Resultado: `success=true`, `count=5`.

Busca de pedidos confirmados por `5496`:

- Resultado: 1 pedido.
- Pedido retornado: `EC-MQSUK7D8-DXS8`, `confirmed`, `Okey Listo`, final `5496`.

Busca de chats:

- Contato retornado: `593990125496@c.us`.
- Pedido na lista: `EC-MQSUK7D8-DXS8`.
- Status na lista: `confirmed`.

## Hashes Congelados

- `src/index.js`: `b64928f45f477f212771010409e997cfe51e62b972ec5d4e0160e1e0a74ab93b`
- `public/qr.html`: `01f6e6be389953f2aa91d7298e6f4e779917cc01acddfa8890f4b9eea62cfa64`

## Backups VPS

- Rate limit/agencias antes do ajuste:
  - `/root/codex_deploy_backups/ec-agency-rate-limit-before-fix-20260626_051143`
- Rate limit/escrita da Ficha antes do ajuste:
  - `/root/codex_deploy_backups/ec-panel-write-rate-limit-before-fix-20260626_052113`
- Estado bom da Ficha/rate limit:
  - `/root/codex_deploy_backups/ec-panel-ficha-rate-limit-frozen-20260626_052614`
- Contato `5496` antes da resincronizacao:
  - `/root/codex_deploy_backups/ec-contact-5496-before-panel-resync-20260626_053014`
- Freeze final completo:
  - `/root/codex_deploy_backups/ec-final-freeze-ficha-rate-limit-5496-20260626_053232`

## Regra Final

Nao mexer novamente em `src/index.js`, Ficha do Cliente, rate limiter, `ContactState` do `5496`, ou rotas de pedido/status sem novo backup e nova validacao. Esta camada fica congelada como estado operacional bom.


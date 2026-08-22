# Freeze V46 — preservação da recompra ao salvar a ficha EC

Data: 2026-08-22
País: EC
Pai: `ec-delivered-repurchase-v45-20260822`

## Incidente observado

A V45 criou corretamente uma nova ordem `EC-RECOMPRA-*`, vinculada ao pedido
entregue por `previousOrderId` e `entryReason=repeat_purchase_after_delivered`.
No salvamento imediatamente seguinte da ficha, a rotina legada
`ensureOperationalOrderForConfirmedDraft` encontrou essa mesma ordem e
sobrescreveu os dois campos de linhagem. Com isso, o sincronizador do painel
administrativo deixou de reconhecer o ciclo de recompra e preservou o status
antigo `entregue`.

## Contrato congelado

- uma ordem `EC-RECOMPRA-*` já vinculada a uma entrega preserva
  `previousOrderId`, `entryReason`, `previousDeliveredAt` e suas notas de
  auditoria quando a ficha é salva novamente;
- `previousOrderId`, `sourceOrderId` e `currentNegotiationOrderId` continuam na
  ficha estruturada do contato;
- o sincronizador administrativo pode mover o mesmo cliente de `entregue` para
  `confirmado` somente quando a ordem mantém a prova de ciclo de recompra;
- o pedido e o evento Purchase já criados são reaproveitados, sem nova ordem e
  sem novo evento;
- nenhuma remessa, autorização ou submissão Dropi é criada automaticamente;
- AQUECIMENTO continua excluído da aba global `Novas`.

## Arquivos funcionais alterados

- `src/services/ecDeliveredRepurchaseService.js`
- `src/routes/whatsapp.js`
- `tests/ec-repurchase-sync-preservation-v46.test.mjs`

## Validação obrigatória

```sh
node scripts/guard-ec-repurchase-sync-preservation-v46.mjs
node --test tests/ec-repurchase-sync-preservation-v46.test.mjs
npm run senior:check
```

## Rollback

O rollback de código volta à release V45 sem apagar ordens ou eventos reais.
Dados de recompra já confirmados devem ser preservados. Dropi continua manual.

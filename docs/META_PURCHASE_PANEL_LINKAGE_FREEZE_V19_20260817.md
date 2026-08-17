# Freeze V19 — vinculo do comprovante Meta Purchase no painel EC

Data: 2026-08-17

Status: aprovado pelo pedido urgente do operador para investigar e corrigir o falso indicador `Meta offline` sem destruir o bot nem reenviar eventos.

## Evidencia e causa

- O pedido real `EC-MSWR401B-KNHS`, telefone final `6060`, foi confirmado em 2026-08-17 e aceito pela Meta com `events_received: 1`.
- Os dois leads SQLite `3382` e `3383` possuem o mesmo `event_id` e comprovante persistido com status `sent` em `purchase_capi_lock`.
- O painel mesclava o pedido operacional somente em uma das linhas duplicadas por telefone e ignorava `purchase_capi_lock` na outra. Por isso a linha historica `3382` exibia falsamente `Meta offline`.

## Microcamada autorizada

1. A consulta operacional do painel passa a expor, por `lead_id`, o `event_id`, resposta e data persistidos em `purchase_capi_lock`.
2. A hidratacao do painel combina essas flags com o estado operacional ja carregado, sem apagar campos existentes.
3. Um lead sem comprovante vinculado passa a dizer `Meta sem vinculo`, nunca `Meta offline`, pois essa ausencia nao prova indisponibilidade da Meta.
4. Nenhum endpoint de envio Meta, regra de confirmacao ou payload CAPI foi alterado.

## Preservacoes obrigatorias

- Nenhum Purchase e reenviado por esta correcao, teste ou guard.
- `tracking.metaPurchaseSentAt` continua impedindo repeticao e `event_id` continua sendo o ID estavel do pedido.
- Nenhuma mensagem WhatsApp, midia, guia ou pedido Dropi e enviado.
- A microcamada Dropi V18, produto, precos, funil, autorizacao humana, scheduler, schema e memoria permanecem inalterados.
- Nao existe migracao de banco; o painel somente le o lock persistente existente.

## Validacao sem envio

```sh
node scripts/guard-meta-purchase-panel-linkage-v19.mjs
node --test tests/meta-purchase-panel-linkage.test.mjs
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
```

Depois da publicacao, conferir `pm2 jlist`, o destino real de `current`, o health publico e a linha do lead final `6060`. A interface deve mostrar `Meta Purchase enviado`, sem disparar novo evento.

# Congelamento - Avisos Dropi Atrasados Liberados

Data: 2026-05-28

## Objetivo

Reativar e atualizar os avisos atrasados de pedidos Dropi/Vit Power apos periodo fora do ar, usando o numero operacional `5515991418416`.

## Varredura Dropi

Sincronizacao ativa do painel Dropi EC executada no VPS:

- Linhas lidas: 31
- Pedidos parseados: 30
- Pedidos unicos: 30
- Pendencias encontradas apos sincronizacao:
  - Guia: 2
  - Retirada em agencia: 14
  - Bonus pos-entrega/retirada: 2
  - Devolucao: 0

## Liberacao aplicada

Configuracao VPS atualizada:

- `SHIPMENT_STATUS_DISPATCH_ENABLED=true`
- `SHIPMENT_STATUS_DISPATCH_ACTIONS=guide,ready_for_pickup,delivered_bonus,returned`
- `SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT=3`
- `SHIPMENT_PICKUP_REMINDERS_ENABLED=true`
- `DROPPI_EC_ACTIVE_SYNC_ENABLED=true`

Backup:

`/opt/vitalismen-automacao/backups/libera-avisos-dropi-atrasados-20260528-030758`

## Correção técnica

O envio de PDF/fatura usava o motor antigo Baileys e falhava com a operacao atual em Z-API. Foi adicionada rota de envio de documento pela Z-API:

- `src/services/zapiClient.js`: `sendZapiDocument`
- `src/whatsapp/zapiOutbound.js`: `sendDocumentViaZapi`
- `src/whatsapp/sendDocument.js`: caminho Z-API antes do fallback Baileys

Backup da publicacao no VPS:

`/opt/vitalismen-automacao/backups/zapi-documentos-dropi-20260528-033541`

## Resultado

Pendencias principais zeradas:

- Guia: 0
- Retirada: 0
- Bonus: 0
- Devolucao: 0

Tambem foi executado reenvio apenas de fatura/PDF para avisos de retirada que tinham saido sem PDF antes da correcao:

- PDFs processados: 9
- PDFs enviados: 9

## Validacao

- `npm run senior:check` no VPS: OK
- Logs registraram `ZAPI_SEND_OK` para documentos reenviados.
- Z-API segue ativa pelo numero `5515991418416`.

## Observacao

Ainda existem lembretes de retirada candidatos, mas eles sao cadencia posterior de follow-up, nao pendencia principal de guia/retirada/bonus/devolucao. O envio foi mantido em lote pequeno para proteger o numero durante anuncio ativo.

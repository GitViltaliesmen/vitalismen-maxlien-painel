# Freeze EC Guide Print Spam Guard - 2026-07-08

## Regra maxima operacional

Nunca reenviar automaticamente o mesmo print de guia/fatura para o mesmo pedido/cliente.

Risco: repeticao de imagem/logistica pode ser interpretada como spam pelo WhatsApp/Z-API e banir o numero oficial `553183002800`.

## Incidente

- Cliente: final `2015` / `593988042015`
- Pedido Dropi: `EC-DROPI-6031413`
- Guia: `185605881`
- Sintoma: mesma imagem `/media/shipments/guide-prints/EC-DROPI-6031413_185605881.png` enviada repetidamente a cada cerca de 2 minutos.
- Acao emergencial em producao: shipment pausado com `review.manualOnly=true`, `reviewStatus=spam_guard_paused`, contato marcado como humano obrigatorio.

## Causa tecnica

O dispatcher consultava `automation.guidePrintNotifiedAt`, mas campos `guidePrint*` nao existiam no schema `Shipment`. Com schema estrito, a marcacao podia nao persistir, e o scheduler voltava a enxergar o shipment como pendente.

## Correcao de micro camada

- Persistir no schema:
  - `logistics.guidePrintUrl`
  - `logistics.guidePrintPath`
  - `automation.guidePrintNotifiedAt`
  - `automation.guidePrintDispatchLockedUntil`
  - `automation.guidePrintLastAttemptAt`
  - `automation.guidePrintLastError`
- Antes de enviar nova imagem, buscar mensagem existente do mesmo `orderId` e mesma URL de print.
- Se ja existe, marcar `guidePrintNotifiedAt` e retornar `already_notified_existing_message`, sem reenviar.
- O lock final do dispatcher tambem respeita `review.manualOnly`.

## Regra para futuras mudancas

Qualquer scheduler que envie midia ao cliente precisa ter:

1. Campo persistido no schema para "ja enviado".
2. Lock persistido no schema.
3. Busca por historico de mensagem antes de reenviar.
4. Guard/auditoria cobrindo os tres pontos.


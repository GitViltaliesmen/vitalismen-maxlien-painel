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
- Segundo indicio encontrado durante a correcao: pedido `EC-MRBD0COI-ELOR`, guia `185608934`, final `9733`, recebeu 2 prints porque PM2 ainda executava o release antigo.

## Causa tecnica

O dispatcher consultava `automation.guidePrintNotifiedAt`, mas campos `guidePrint*` nao existiam no schema `Shipment`. Com schema estrito, a marcacao podia nao persistir, e o scheduler voltava a enxergar o shipment como pendente.

Durante o deploy foi identificado outro risco: mudar o symlink `/opt/vitalismen-automacao/current` nao garante que PM2 passou para o release novo. O processo `vitalismen-automation` continuava com `pm_cwd` e `pm_exec_path` no release `202607081253`, por isso ainda disparou uma repeticao antes de ser recriado no release `202607081410`.

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
- PM2 foi recriado para executar o release ativo `202607081410`.
- Varredura pos-correcao confirmou:
  - zero envios novos para final `2015` apos a pausa;
  - zero prints de guia enviados apos PM2 passar para `202607081410`;
  - zero candidatos pendentes em `buildGuidePrintReport`.

## Regra para futuras mudancas

Qualquer scheduler que envie midia ao cliente precisa ter:

1. Campo persistido no schema para "ja enviado".
2. Lock persistido no schema.
3. Busca por historico de mensagem antes de reenviar.
4. Guard/auditoria cobrindo os tres pontos.

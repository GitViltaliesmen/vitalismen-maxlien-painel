# Freeze V108 — primeiro candidato pós-venda elegível

Data: 2026-09-03
Escopo: seleção do lote transacional V105
Pai: V107 (`eba93a25089789b7d1be8ad9317c201769d473e3`)

## Causa

O primeiro ciclo seguro encontrou cinco pendências, mas cortava a lista para um
shipment antes do guard semântico. O primeiro item estava em `EN_RUTA` com
estágio posterior já comprovado; foi corretamente bloqueado pela cronologia,
porém monopolizou o lote. O scheduler registrou `Enviados 0/1` e não houve
chamada ao provider.

## Correção

O dispatcher examina a pequena janela já limitada, executa preflight de ledger,
histórico, `human.mode`, idempotência e cronologia sem adquirir lock e ignora os
itens bloqueados. O primeiro elegível encerra a busca. Tanto sucesso quanto falha
de transporte consomem a única tentativa elegível do ciclo: no máximo uma
tentativa de provider e no máximo uma mensagem podem ocorrer.

O containment do V105 também arquiva, depois de restaurar e validar o bot core,
o bundle de ativação já consumido. Isso permite migrar a autorização para um
release sucessor sem reutilizar permit e sem apagar o marcador de lote único.

## Preservado

O perfil V105 permanece com lote e limite diário iguais a um. Backlog histórico,
Dropi apply e Meta retroativo continuam desligados. O patch não muda texto,
produto, destinatário, funil, pedido, schema ou transporte Z-API.

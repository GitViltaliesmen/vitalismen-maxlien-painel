# Freeze V109 — health resiliente no containment do pós-venda

Data: 2026-09-03
Escopo: rollback isolado do control plane V105
Pai: V108 (`e08a1c5de522fd471a2131a8de4ebf648f487bc5`)

## Causa

O PM2 reiniciou corretamente no perfil do bot core, mas o primeiro acesso HTTPS
durante os segundos de subida respondeu `502`. O containment falhou fechado antes
de arquivar o bundle V105, embora o health seguinte já estivesse válido.

## Correção

Depois do restart, o helper aguarda por até 30 tentativas de dois segundos e só
aceita o `status` V78 completo. O bundle consumido é arquivado exclusivamente
depois dessa prova. Falha persistente mantém tudo fechado e retorna erro.

## Preservado

O lote continua em uma tentativa e uma mensagem, o marcador de lote único não é
apagado, Dropi permanece `REPORT_ONLY`, backlog permanece desligado e nenhum
texto, destinatário, pedido, produto, schema ou integração foi alterado.

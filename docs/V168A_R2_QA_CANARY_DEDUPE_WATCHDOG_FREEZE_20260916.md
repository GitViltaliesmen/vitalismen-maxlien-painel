# V168A-R2 — canário QA reutilizável e watchdog canônico

Baseline pai: `V168A_R`, commit `4a259499ccafe286d6650aa95115023f183f58fe`, tree `a64e0c750ec6207239469890ef6d48545926333b`.

Esta candidata é exclusivamente de código e não promove release, não reinicia processos e não envia mensagens.

## Contrato QA

- O escopo é o telefone literal `5515998038637`, com os três marcadores de teste e contexto V78 válido.
- Cada novo canário exige permit novo e inbound novo.
- A identidade da saudação é o SHA-256 determinístico de `contactStateId`, `permitId`, `inboundMessageId` e `stepKey`.
- A mesma autorização produz a mesma identidade e, portanto, uma única reserva strict.
- IDs processados são carregados para `priorProcessedMessageIds` quando um permit novo é armado; um inbound antigo não pode ser reutilizado.
- Fora desse escopo, a identidade histórica da saudação permanece inalterada.
- Nenhum histórico de dedupe é apagado ou atualizado e nenhum bypass global é introduzido.

## Contrato do watchdog

- `ZAPI_CHAT_WATCHDOG_ENABLED=false` bloqueia o agendamento e também a execução de callback já pendente.
- Antes de reprocessar, o watchdog consulta a identidade original nas colunas persistidas de mensagem.
- Um provider ID já persistido não volta ao router.
- É proibido criar ID espelho com sufixo temporal; uma recuperação legítima conserva o ID original.
- O comportamento legítimo permanece disponível quando as flags estão ativas e o ID canônico ainda não existe.

## Escopo auditado

- `QA_DEDUPE_REQUIRED`: resolvedor V168A-R2, reset V78, contexto runtime V78 e saudação inicial Tex Ultra.
- `WATCHDOG_REQUIRED`: política V168A-R2 e callsite da rota Z-API.
- `TEST_REQUIRED`: testes V168A-R2 e atualização da expectativa V110 sucedida.
- `GUARD_REQUIRED`: guard dedicado, wiring NPM e senior guard.
- `DOCUMENTATION_REQUIRED`: este freeze.
- `UNRELATED`: zero arquivos.

Rollback: descartar ou reverter somente esta branch candidata. A produção não requer rollback porque não foi alterada.

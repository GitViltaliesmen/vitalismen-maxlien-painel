# Microcamada V44 — fila global de novas mensagens comerciais EC

Data: 2026-08-22.

## Decisão autorizada

Este freeze sucede a V43 e corrige somente a divergência visual entre o contador
`Novas` e a lista de conversas do painel oficial. O contador já considerava todas
as filas comerciais, mas a lista ainda permanecia limitada à fila operacional
ativa. Assim, o botão podia indicar uma conversa e renderizar uma lista vazia.

O ambiente permanece exclusivamente Vitalismen Ecuador em `72.60.137.77`,
`ec.maxlien.shop` e `/opt/vitalismen-automacao/current`.

## Base congelada antes da alteração

- SHA local, `origin/production`, Git auxiliar do VPS e release: `3f82a754c2872dd65f47e4691e624062b39e8143`;
- release ativa: `/opt/vitalismen-automacao/releases/20260822T193613Z_production-20260822-3f82a75`;
- tag ativa: `production-20260822-3f82a75`;
- PID PM2 observado: `2193011`;
- branch isolada: `codex/panel-global-new-messages-v44-20260822`;
- manifesto pai V43 SHA-256: `ab4cecc831102ab1257f0f37b6ef8730aaab5a57e63f7759fcdcf0622ffe6034`;
- baseline anterior à edição: 316 testes aprovados e `senior:check` verde.

## Contrato visual corrigido

Ao clicar em `Novas`, o painel entra em uma fila global temporária e deixa de
aplicar o recorte `ATENDIMENTO`, `PEDIDOS` ou `REVISAR`. A lista usa o mesmo
predicado já empregado pelo contador e mostra todas as conversas comerciais com
mensagem não lida ou entrada VSL aguardando atendimento.

O bucket `AQUECIMENTO` continua excluído de `Novas` e mantém seu contador próprio.
Enquanto `Novas` está ativo, nenhum botão de fila operacional fica destacado,
deixando claro que a visão é global. Ao clicar em `Tudo` depois dessa visão, o
painel restaura `ATENDIMENTO`; filtros auxiliares preservam uma fila explicitamente
escolhida pelo operador.

A busca por nome ou telefone continua ignorando filtros de fila, como definido na
V41. A coluna esquerda continua sem texto de mensagem.

## Preservado

- classificação, persistência e prioridade das filas V40–V43;
- contador próprio e resposta local `👍` do AQUECIMENTO;
- produtos, preços, ofertas, VSLs e funis;
- checkout, pedidos, Dropi, Meta/CAPI, pixel e banco;
- Z-API, número oficial, áudios, mídias e pós-venda;
- schedulers, PM2 e storage;
- nenhuma mensagem real enviada durante os testes.

## Testes e rollback

Os testes V44 executam somente estado sintético e inspeção estática do painel.
Não enviam WhatsApp, não escrevem banco, não criam pedido e não chamam Dropi ou
Meta/CAPI.

Rollback operacional: reativar
`/opt/vitalismen-automacao/releases/20260822T193613Z_production-20260822-3f82a75`,
preservando bancos, mídias compartilhadas e histórico operacional.

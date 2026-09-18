# Congelamento V177 — operações compostas de status do painel EC

Data: 2026-09-17

Base imutável: commit `6f0fe637a226490e7fb3803370f10bdb86116765`, release `20260918T000329Z_production-20260918-6f0fe63`.

## Escopo autorizado

A V177 é uma camada sucessora mínima. Ela restaura somente:

- `POST /api/whatsapp/chats/action`;
- `POST /api/whatsapp/chats/bucket`;
- `POST /api/whatsapp/contact-state/:phone/identity-conflict`;
- `POST /api/whatsapp/internal/admin-status-sync`, exclusivamente com prova local estrita;
- escrita `orders.insertOne`/`orders.updateOne` apenas em `confirm-order` ou `repurchase-new-cycle`, depois de autenticação de operador ativo.

As rotas humanas recebem primeiro um contexto candidato. A autoridade de escrita nasce somente depois do middleware de autenticação, em um contexto `AsyncLocalStorage` V177 contendo operação, ator e alvo. O callback interno usa ator técnico fixo, alvo explícito e prova simultânea de host e IP de loopback, rejeitando cabeçalhos públicos.

## Matriz congelada

Os status oficiais são: `novo`, `atendendo`, `comprar_depois`, `confirmado`, `pedido_enviado`, `entregue`, `recompra`, `cancelado` e `devolvido`.

Somente `confirmado` e `recompra` podem gravar `orders`. Os demais status persistem somente a ficha/espelho/auditoria já existentes. O callback interno não grava `orders`; confirmação e recompra permanecem ações humanas autenticadas do painel WhatsApp.

## Limites de MongoDB

- `contactstates`: somente `insertOne` e `updateOne` nas operações V177 exatas;
- `messages`: somente `insertOne` para auditoria do painel;
- `orders`: somente `insertOne` e `updateOne` em confirmação ou novo ciclo de recompra;
- `delete`, `drop`, `rename`, `bulkWrite`, outras coleções e contexto ausente permanecem bloqueados.

## Efeitos externos preservados

- `DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY`;
- `dropiApplyAllowed=false`;
- `metaPurchaseAllowed=false`;
- nenhum envio WhatsApp é iniciado pela V177;
- Z-API, VSL, Pixel/CAPI, produtos, áudio e pós-venda não foram alterados.

Os testes usam somente fixtures em memória e o identificador autorizado `5515998038637`. Nenhuma conexão com banco de produção é aberta: `PRODUCTION_DB_WRITE_COUNT=0`.

## Publicação

Este congelamento é de candidato local. Deploy e restart são proibidos nesta missão e exigem autorização separada.

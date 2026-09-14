# V157 — diagnóstico e reparo seguro do preflight Dropi EC

Data operacional: 2026-09-13.

A V157 corrige a classificação de falhas ocorridas antes da criação de um pedido na Dropi. Uma indisponibilidade na consulta anti-duplicidade não pode mais ser exibida como se a Dropi tivesse rejeitado o pedido. O fluxo permanece fechado: se a consulta não for confirmada, nenhum `POST` de criação é executado.

O diagnóstico estruturado passa a preservar, de forma sanitizada, código, HTTP, `requestId` e ciclo da chamada de listagem. O motivo operacional distingue três estados:

- `dropi_preflight_failed`: a verificação anterior ao envio falhou e nenhum pedido foi criado;
- `dropi_submit_unconfirmed`: a criação foi despachada, mas não houve confirmação e uma nova tentativa permanece bloqueada até pesquisa;
- `dropi_rejected`: somente quando a requisição de criação recebeu uma resposta válida da Dropi recusando a operação, inclusive uma recusa lógica em HTTP 200.

Escopo do reparo operacional autorizado:

- pedido `EC-ADMIN-3536`;
- outros registros em `manual_send_required` apenas quando não existir ID, guia, recibo local ou correspondência remota na Dropi;
- reprocessamento individual e serial, depois de preflight autoritativo de produto, estoque, cidade, província, transportadora e consulta anti-duplicidade.

Preservado:

- catálogo Servientrega e agência escolhida pelo operador;
- produto, quantidade, preço e dados do cliente;
- autorização humana em dois passos para Dropi;
- um único `POST` de criação por tentativa;
- bloqueio de duplicidade local e remoto;
- motor do funil, WhatsApp, Z-API, Meta/CAPI e pós-venda;
- V156 e toda a cadeia congelada anterior.

Validação mínima:

```sh
node scripts/guard-dropi-preflight-repair-v157.mjs
node --test tests/dropi-preflight-repair-v157.test.mjs tests/dropi-bff-manual-v60.test.mjs tests/dropi-total-resolution-v121.test.mjs
node scripts/audit-ec-product-micro-layer.mjs
npm run senior:check
```

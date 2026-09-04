# Freeze V123 — ficha e status persistidos antes do pedido

Data: 2026-09-04
País e operação: Vitalismen Ecuador
Baseline pai: V122, commit `09686b256302c983c0ae5fbb5f9afe2bb221b9f0`, tree `6baead7050580d21d4279729f939274584640ce4`

## Incidente confirmado

A V122 liberou a pré-validação e a gravação autenticada da ficha exclusivamente em `contactstates`. Em uma ficha EC completa com status `confirmado`, porém, o próprio handler tentou executar `orders.insertOne` antes de `state.save()`. A barreira V78 bloqueou corretamente a coleção `orders`; como a exceção ocorreu antes da persistência principal, o endpoint respondeu HTTP 500 e o painel voltou a exibir `novo`.

## Microcamada V123

O `PATCH /api/whatsapp/contact-state/:phone` agora conclui primeiro `await state.save()`. Somente depois tenta a sincronização opcional do pedido já existente no fluxo. Uma falha nessa etapa secundária é devolvida como diagnóstico estruturado, sem converter uma ficha/status já gravada em falso erro de salvamento.

O contrato não autoriza `orders`, não libera rotas genéricas de pedido e não altera a barreira de segurança V78. Assim, selecionar `Novo`, `Atendendo`, `Comprar depois`, `Confirmar pedido`, `Pedido enviado`, `Entregue`, `Recompra`, `Cancelado` ou `Devolvido` permanece uma ação de persistência autenticada da ficha; eventual operação de pedido continua sujeita à sua autorização própria.

## Preservado

- banco sem migração e sem backfill;
- envio WhatsApp e funil;
- VSL e atribuição do produto de origem;
- Dropi e autorização manual por pedido;
- Meta/CAPI;
- pós-venda V114/V116;
- aquecimento V118;
- catálogo e preços Tex Ultra, Nitrix e Vit Power.

## Validação obrigatória

- regressão estrutural comprovando `state.save()` antes de `ensureOperationalOrderForConfirmedDraft`;
- classificação sanitizada de bloqueio V78 e de falha secundária inesperada;
- V122 ainda limitada à coleção `contactstates`;
- testes V122 e V123;
- `senior:check` com o preload sucessor;
- smoke autenticado em produção apenas com o telefone QA autorizado, sem pedido, WhatsApp, Dropi ou Meta.

## Rollback

Retornar ao release V122:

`/opt/vitalismen-automacao/releases/20260904T035239Z_production-20260904-09686b2`

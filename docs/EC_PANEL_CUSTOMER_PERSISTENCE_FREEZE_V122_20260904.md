# Freeze V122 — persistência da ficha/status do cliente EC

Data: 2026-09-04
País e operação: Vitalismen Ecuador
Baseline pai: V121, commit `434efbe0eff321ed2ad324da2b8ccc04b9b912e1`, tree `614bb080f1b6696c625f0b92c137f89ab5b7e181`

## Incidente confirmado

O formulário autenticado do painel executava primeiro a pré-validação `POST /api/whatsapp/contact-state/:phone/resolve-customer-data`. A barreira operacional V78 devolvia HTTP 423 porque as camadas V115 e V120 não declaravam essa rota. Como a exceção ocorria antes do `PATCH /api/whatsapp/contact-state/:phone`, a ficha/status editada pelo operador não era gravada e a próxima leitura reapresentava o valor anterior, normalmente `novo`.

A inspeção somente leitura do cliente reportado confirmou que nome, telefone, cidade, província e produto previamente persistidos continuavam intactos. Não houve apagamento de dados; a nova edição foi interrompida antes da persistência.

## Microcamada aprovada

A V122 autoriza exclusivamente, com autenticação obrigatória:

1. `POST /api/whatsapp/contact-state/:phone/resolve-customer-data` para pré-validar o formulário;
2. `PATCH /api/whatsapp/contact-state/:phone` para persistir a ficha/status em `contactstates`.

O `PATCH` recebe contexto de escrita apenas nessa rota exata. A microcamada não libera rotas genéricas de pedidos, não autoriza coleções `orders` ou `shipments` e não concede efeitos externos.

## Preservado

- envio de WhatsApp e funil comercial;
- VSL e atribuição do produto de origem;
- Dropi e autorização manual por pedido;
- Meta/CAPI;
- pós-venda V114/V116;
- aquecimento V118;
- preços e catálogo Tex Ultra, Nitrix e Vit Power;
- banco sem migração e sem backfill.

## Validação obrigatória

- teste da matriz positiva/negativa das duas rotas;
- teste de falha fechada quando a autenticação estiver desativada;
- teste de escopo Mongo limitado a `contactstates`;
- verificação de que as rotas estão depois de `router.use(authMiddleware)`;
- `senior:check` com o preload sucessor;
- smoke autenticado em produção usando somente o telefone QA autorizado, sem WhatsApp, Dropi, Meta ou pedido.

## Rollback

O rollback operacional retorna ao release V121:

`/opt/vitalismen-automacao/releases/20260904T023421Z_production-20260904-434efbe`

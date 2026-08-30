# Congelamento V90 — entrada Protocolo G no dashboard

## Objetivo

Esta microcamada corrige exclusivamente a entrada gerada pela VSL oficial
`https://vilaliemen.shop/protocolo-g` no dashboard EC. A assinatura antiga de
`/protocolo` não é mais a origem oficial.

## Contrato congelado

- a VSL oficial continua enviando ao WhatsApp `5515991418416`;
- o formulário estruturado começa com `Hola, quiero el tratamiento Tex Ultra.`
  e exige `Nombre:`; `CIUDAD:` e `PROVINCIA:` são opcionais;
- o único telefone brasileiro aceito para QA continua sendo `5515998038637`;
- quando o contexto QA não está armado, a mensagem é persistida para aparecer no
  dashboard, mas respostas do bot, confirmação de retirada, compra posterior,
  engajamento e watchdog permanecem bloqueados;
- quando o contexto QA está armado pelo fluxo oficial, a automação já autorizada
  continua disponível e o contexto é consumido uma única vez;
- clientes EC `593` continuam no fluxo operacional existente;
- `GET /api/whatsapp/chats` continua somente leitura.

## Páginas externas preservadas

Nenhum arquivo de `vilaliemen.shop` foi alterado por esta correção. O split já
aprovado de `/protocolo-g` permanece:

- celular: VSL oficial;
- computador: página informativa;
- hash público desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- hash público celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.

## Preservado

Não foram alterados preço, checkout, formulário visual, conteúdo VSL, página
informativa, Dropi, Meta/CAPI, pixel, número oficial, funil de produtos,
schedulers, mídias, áudios, pedidos ou filtros EC do dashboard.

## Validação obrigatória

```sh
node scripts/guard-ec-vsl-dashboard-ingress-v90.mjs
node --test tests/ec-vsl-dashboard-ingress-v90.test.mjs
```

Após publicação autorizada, validar `/api/health/`, PM2 no release ativo, a
preservação dos dois hashes públicos de `/protocolo-g` e uma nova entrada feita
exclusivamente pelo telefone QA autorizado.

# Freeze V20 — integridade de status e produto no pedido publico EC

Data: 2026-08-17

Status: candidato validado localmente, ainda nao publicado. Esta camada sucede a V19 sem alterar os commits ou manifests V17, V18 e V19.

## Riscos corrigidos

1. A criacao publica `POST /api/orders` aceitava estados operacionais como `confirmed`, permitindo chegar ao fluxo de Meta Purchase sem autenticacao do painel.
2. Identificadores de produto conflitantes podiam ser resolvidos de forma permissiva, associando um pedido EC ao produto incorreto.
3. Um rascunho EC sem produto explicito podia ser convertido para `pending`, deixando o pedido operacional sem identidade comercial segura.

## Microcamada autorizada

- A criacao publica aceita somente `draft` e `pending`; estados operacionais continuam disponiveis para o painel autenticado.
- Meta Purchase na criacao direta exige usuario autenticado, preservando o lock `tracking.metaPurchaseSentAt` e o `event_id` existentes.
- Produto EC ausente, invalido ou internamente conflitante retorna erro antes de persistencia ou efeitos externos.
- O primeiro rascunho continua podendo capturar nome e telefone sem produto. Antes da conversao para `pending`, um produto EC explicito e valido passa a ser obrigatorio.
- Atualizacoes autenticadas de produto tambem rejeitam identificadores conflitantes.

## Preservacoes obrigatorias

- Nenhum preco, oferta, funil, audio, midia, scheduler, schema, pixel, numero, transporte WhatsApp ou regra Dropi foi alterado.
- Nenhum Purchase, mensagem WhatsApp ou pedido Dropi e enviado pelos testes ou guards desta camada.
- A autorizacao humana Dropi e a confiabilidade V18 permanecem inalteradas.
- O vinculo visual do comprovante Meta da V19 permanece inalterado.
- A captura inicial de rascunho sem produto permanece publica e sem efeitos operacionais.

## Validacao sem publicacao

```sh
node scripts/guard-order-public-product-integrity-v20.mjs
node --test tests/review-v17-v19-p1.test.mjs tests/order-public-product-integrity-v20.test.mjs
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
git diff --check
```

Publicacao, migracao, merge, push, restart e deploy nao fazem parte desta microcamada preparada. A ativacao futura exige autorizacao escrita separada e a validacao operacional prevista nos freezes anteriores.

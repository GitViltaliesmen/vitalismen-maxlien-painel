# Microcamada V63 — leitura pós-correção por anúncio do Protocolo G

Data: 2026-08-26
País: EC
Produto: Tex Ultra Ecuador
VSL: `https://vilaliemen.shop/protocolo-g`

## Evidência do gargalo

Na janela anterior à ativação V62, os logs oficiais da VSL registraram 212
`fbclid` únicos para o anúncio `120248704142390355` e 71 para o anúncio
`120248709923060355`. Houve somente uma chamada `bridge` aceita em toda a
janela, sem base para atribuir uma venda aos anúncios. A entrega dos anúncios
levou pessoas à página; a perda ocorreu depois da chegada, coerente com a CTA
final antiga em aproximadamente `00:37:37`.

A V62 já corrigiu o ponto de ação com CTA secundária aos 12 minutos e passou a
medir as etapas. A primeira entrada real posterior à ativação chegou com
`campaign_id`, `adset_id` e `ad_id` completos, comprovando que o contrato de
atribuição está funcionando.

## Decisão autorizada

O operador pediu `siga e resolva`. A V63 fecha somente a lacuna de leitura:

1. o bloco Protocolo G ignora eventos anteriores a
   `2026-08-26T05:13:18.000Z`, instante da ativação V62;
2. o painel agrupa as etapas por campanha, conjunto e anúncio;
3. cada linha mostra retenção, CTA, formulário, WhatsApp, conversa, venda e
   Purchase;
4. com menos de 20 entradas a interface declara amostra insuficiente em vez de
   recomendar vencedor ou perdedor;
5. o agregado `EC geral` permanece disponível e identificado separadamente.

## Preservado

- arquivos, player, CTA e bridge da VSL V62;
- anúncios, orçamento e veiculação na Meta;
- Dataset, Pixel, Meta/CAPI, Lead e Purchase;
- produto, preço, checkout, pedido e Dropi;
- WhatsApp, número oficial, vendedor, funil, mensagens, mídias e scheduler;
- dados históricos do banco, que não são apagados nem reescritos.

## Validação obrigatória

```sh
npm run official:path
npm run guard:protocolo-g-ad-metrics-v63
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
```

Depois da publicação, conferir `current`, `pm_cwd`, `pm_exec_path`, CWD real do
PID, health público e a resposta autenticada da API. Nenhum cliente real,
pedido, Dropi, mensagem ou evento Meta será criado para validar a V63.

## Rollback

Reativar a release V62 `production-20260826-10dd893` pelo helper transacional
oficial e repetir as verificações de PM2 e health. A VSL não requer rollback,
pois seus arquivos não são alterados pela V63.

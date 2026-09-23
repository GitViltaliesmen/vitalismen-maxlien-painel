# Freeze V185 — métricas por IDs e Radar somente leitura

Data: 2026-09-18

Base imutável: V184, commit `596441983a7d05e0cd002200372aa1bd0077214b`

Escopo: analytics autenticado e somente leitura. Publicação não autorizada nesta missão.

## Contrato funcional

- A identidade canônica é `ad_id`, seguida por `adset_id`, `campaign_id` e correlação persistida.
- Nomes de campanha, conjunto, anúncio e criativo são somente rótulos; renomear uma campanha não interrompe a descoberta.
- Novos IDs persistidos são descobertos sem configuração manual.
- Venda sem `ad_id` comprovado permanece na linha `SEM_ATRIBUICAO` e não pontua um criativo.
- O endpoint `GET /api/funnel-metrics/creative-sales?scope=protocolo-g` exige autenticação administrativa.
- A consulta Meta usa somente GET, timeout de 8 segundos e cache exclusivamente em memória com TTL de 5 minutos.
- Falha da Meta preserva os fatos internos e força `DEGRADED`, confiança baixa e nenhuma sugestão de verba.
- Os estados do Radar são `NO_DATA`, `LEARNING`, `READY` e `DEGRADED`.
- Sugestão de verba só existe em `READY`, com confiança mínima média, gasto Meta positivo, amostra mínima e cobertura suficiente.
- “Investir agora”, “Manter” e “Aguardar” são indicadores visuais sem evento de mutação.

## Arquivos funcionais V185

- `public/funnel-metrics.html`
- `src/routes/funnelMetrics.js`
- `src/services/creativeSalesMetricsV185Service.js`

## Preservado byte a byte contra V184

- `public/qr.html`
- VSL e ponte Protocolo-G
- bot, roteamento e funil
- Pixel, CAPI e Purchase
- Dropi e Servientrega
- Z-API, Baileys e WhatsApp
- produtos, preços, áudios, pós-venda e schedulers

O contexto sucessor V185 autoriza somente os três arquivos funcionais enumerados acima perante a cadeia histórica. Não altera hashes ancestrais, não usa wildcard, não captura falhas e não converte erro em aviso.

## Estado operacional

`PRODUCTION_CHANGED=NO`

`DEPLOY_EXECUTED=NO`

`RESTART_EXECUTED=NO`

`WRITE_COUNT=0`

`META_MUTATION_COUNT=0`

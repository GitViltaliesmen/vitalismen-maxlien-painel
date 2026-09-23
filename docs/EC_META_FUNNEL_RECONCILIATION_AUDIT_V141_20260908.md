# V141 — auditoria Meta, Z-API, bot, pedido, CAPI e métricas EC

Data da auditoria: 2026-09-08 UTC. Janela canônica: `[2026-09-06T05:00:00.000Z, 2026-09-08T05:00:00.000Z)`, equivalente a 06/09 00:00 até 08/09 00:00 em `America/Guayaquil`.

## Trava da VSL

A VSL `https://vilaliemen.shop/protocolo-g` foi acessada somente para leitura. Nenhum arquivo, rota, cache, anúncio, CTA ou configuração foi alterado.

Estado inicial:

- resposta pública: HTTP 200, SHA-256 `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- `/opt/cloaker/private/vsl/protocolo-g.html`: `5db8590e5187cb3704f8bf2af11599c0a521d1858a799a7cca9c0afb95dbf6f7`;
- `/opt/cloaker/public/assets/js/meta-ec-protocolo-g-bridge.js`: `e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9`;
- `/opt/cloaker/routes/metaEcProtocoloGBridge.js`: `7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd`;
- o servidor da VSL usa implantação direta em `/opt/cloaker`, sem symlink `current` e sem metadados Git disponíveis. Os três hashes acima formam a identidade da release observável.

## Inventário das fontes reais

| Componente | Fonte | Último registro observado | Último sucesso/erro |
| --- | --- | --- | --- |
| Meta Insights | Marketing API Graph `v26.0`, conta configurada no ambiente | consulta live tentada em 08/09 | falha `OAuth 190/463`, token expirado em 04/09 |
| Cache Meta | `/opt/vitalismen-automacao/shared/runtime/meta-ads-insights/ec.json` | `fetchedAt=2026-09-05T04:45:21.702Z`, dados até 04/09 | último sucesso 05/09; nenhum job de refresh instalado |
| Z-API inbound | Mongo `messages` (`provider=zapi`) e `contactstates` (`ZAPI_INBOUND_CAPTURED`) | mensagens até 07/09 13:50Z; contatos até 08/09 00:04Z | os três casos canários estão persistidos |
| Conversas/clientes | Mongo `contactstates`, chave canônica por telefone E.164 | 08/09 00:04Z | fonte ativa |
| Bot | Mongo `messages`, `isFromMe=true`, `isBot=true`, ACK e `deliveredAt` | 07/09 13:50Z | casos canários enviados e entregues |
| Pedidos | Mongo `orders` | 07/09 23:26Z | `EC-ADMIN-3501` completo e `processing` |
| CAPI enviado/resposta | `orders.tracking.metaPurchase*` | nenhum Purchase do 3501 | payload do 3501 é válido, mas o caminho de pedido novo não chamava o sender |
| Atribuição | Mongo `vslvisits`, `metaattributioncorrelations` e `tracking` de pedido | 28 correlações na janela, todas `UNMATCHED` | causa persistida `no_unique_exact_visit` |
| Métricas | `src/routes/funnelMetrics.js`, `funnelMetricsService.js` e `protocoloGCommercialMetricsService.js` | calculadas sob demanda | dependiam de `VslVisit` e da abertura do painel |

## Causas comprovadas

1. **Cache Meta:** o cache terminou em 04/09. Não havia timer ou cron de Insights; somente a rota autenticada tentava atualizá-lo. A tentativa live falhou porque a credencial `ads_read` expirou. A V141 adiciona refresh independente e torna a falha/idade visíveis. A credencial precisa ser renovada pelo operador antes da publicação.
2. **Contagem operacional:** os cards gerais eram derivados de `VslVisit`. Na janela canônica não existe `VslVisit`, embora `ContactState` e `Message` provem entrada e resposta. A V141 agrega entrada por `firstInboundAt`/tags, mensagens Z-API e bot, preservando a passagem histórica mesmo quando a fila atual muda.
3. **Timezone:** Fernando e Jorge aparecem como 06/09 00:17 e 00:11 no navegador em São Paulo, mas os timestamps persistidos são `03:17Z` e `03:11Z`, que correspondem a 05/09 22:17 e 22:11 no Equador. Eles existem e o bot respondeu, mas estão fora da janela canônica pedida. A V141 usa meia-noite UTC-5 e limite final exclusivo.
4. **Pedido e Purchase:** `EC-ADMIN-3501` está completo, `processing`, USD 80,99, três frascos, autorização humana e envio Dropi persistidos. O payload CAPI constrói com sucesso. O ramo normal de pedido novo não chamava `sendPurchaseEventForOrder`; o ramo de recompra chamava. A V141 chama o Purchase somente após sucesso Dropi autorizado por humano, preserva `metaPurchaseSentAt` como deduplicador e permite que um segundo clique humano recupere apenas o CAPI quando o Dropi já foi enviado.
5. **Atribuição:** o 3501 não possui `fbclid`, `fbc`, `fbp`, `external_id`, `ad_id` ou `visitorKey`. As 28 correlações da janela têm `no_unique_exact_visit`. Atribuição exata permanece `UNATTRIBUTED`; horário não é usado como identidade.
6. **PageView CAPI:** não existe `VslVisit` nem `metaPageViewSentAt` na janela. O zero é real na fonte server-side atual. Corrigi-lo exigiria produzir telemetria na VSL, ação expressamente bloqueada; a V141 não cria evento retroativo nem toca na VSL.

## Casos canários

- Fernando Limaico (`+593997483031`): contato e tags encontrados; um inbound Z-API, cinco mensagens do bot, cinco entregues, um áudio e três mídias. Primeiro inbound `2026-09-06T03:17:31.138Z`, fora da janela canônica após conversão para Equador.
- Jorge (`+593995611476`): contato e tags encontrados; dois inbounds Z-API, cinco mensagens do bot, cinco entregues, um áudio e três mídias. Primeiro inbound `2026-09-06T03:11:34.797Z`, fora da janela canônica após conversão para Equador.
- Javier Deidan (`+593993651272`): contato, tags e bot encontrados; primeiro inbound `2026-09-07T03:50:22.861Z`, dentro da janela. Pedido `EC-ADMIN-3501` encontrado, elegível; Purchase não criado, não enviado, não aceito e não atribuído.

## Microcamada implementada

- agregação operacional imutável por fatos de `ContactState`, `Message`, `Order` e correlações;
- vínculo de métrica conversa/pedido pelo telefone canônico, sem gravar vínculo e sem atribuir criativo pelo telefone;
- janela explícita `from/to` em `America/Guayaquil`, com `to` exclusivo;
- estados separados para elegibilidade, evento, envio, aceite e atribuição CAPI;
- causas `UNMATCHED`, freshness e saúde Meta/Z-API/bot/pedidos/CAPI/métricas;
- radar fail-closed para cache stale, fetch falho, janela divergente ou amostra menor que 20;
- Insights ampliados com cliques, outbound, valor, CPA/ROAS e mapeamento read-only `ad_id → creative_id` quando a API estiver disponível;
- timer de refresh Meta a cada cinco minutos, incluído na candidata e ainda não instalado;
- Purchase futuro somente depois de sucesso Dropi explicitamente autorizado por humano, sem retroativo para o 3501.

## Bloqueios externos

- `META_LIVE_FETCH` permanece bloqueado por token expirado. A V141 não troca token sem prova/autorização.
- Creative mapping live e dados Meta de 06–07/09 permanecem indisponíveis pela mesma falha.
- Os anúncios não têm sua configuração alterada. Se não houver parâmetros dinâmicos de campanha/conjunto/anúncio nas URL tags após renovar a credencial, a recomendação é `utm_campaign={{campaign.id}}&utm_content={{ad.id}}&utm_term={{adset.id}}`, sujeita a aprovação separada do operador.


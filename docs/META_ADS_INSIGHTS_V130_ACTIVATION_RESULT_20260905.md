# V130 — resultado da ativação Meta Ads EC

Data operacional: 2026-09-05.

## Escopo publicado

- Serviço somente leitura: `src/services/metaAdsInsightsService.js`.
- Rota autenticada: `GET /api/funnel-metrics`.
- Interface pública do painel autenticado: `/funnel-metrics.html`.
- Token lido exclusivamente de `META_ACCESS_TOKEN` e enviado à Graph API pelo cabeçalho `Authorization: Bearer`.
- Conta EC configurada: `CA PY`, ID `26714145304913323`.
- Versão validada da Marketing API: `v26.0`.
- Filtro validado em campanha, conjunto ou anúncio: `EC | LAL1-ENTREGUES | M40+ | EXC-BUYERS | PURCHASE`.
- A conta `C02_COLOMBIA` não foi carregada no runtime EC, em respeito ao isolamento do painel oficial Equador.

## Release e congelamento

- Commit funcional: `ed4f832cde27dabe37ac4b1bf6e3f9293f82bdcb`.
- Tree funcional: `14951b24c43056272d12a644b4313303e9e9c07c`.
- Release ativo: `/opt/vitalismen-automacao/releases/20260905T040931Z_production-20260905-ed4f832`.
- Tag de publicação: `production-20260905-ed4f832`.
- Tag de congelamento: `freeze-v130-meta-ads-readonly-20260905`.
- Rollback preservado: `/opt/vitalismen-automacao/releases/20260905T004408Z_production-20260905-360e0be`.

## Arquivos externos ao release

- Cache: `/opt/vitalismen-automacao/shared/runtime/meta-ads-insights/ec.json`, modo `0600`, sem token.
- HTML servido pelo Nginx: `/var/www/ec.maxlien.shop/funnel-metrics.html`.
- Backup anterior do HTML: `/var/backups/vitalismen-funnel-metrics-v130/20260905T042748Z/funnel-metrics.html.before`.
- Backup do `.env` V129 anterior à preparação: `/opt/vitalismen-automacao/backups/v130-meta-ads-20260905T040230Z/.env.before`.

## Validação em produção

- `current`, `pm_cwd`, `pm_exec_path` e `/proc/<pid>/cwd` apontaram para o release V130 ativo.
- PM2 `vitalismen-automation`: `online`.
- Perfil `EC_BOT_CORE_OPERATIONAL`: `ACTIVE_VALID`.
- `senior:check`: passou com o preload sucessor oficial.
- `audit-ec-product-micro-layer.mjs`: passou.
- `/funnel-metrics.html`: HTTP 200 e contém o widget `Meta Ads — tráfego pago EC`.
- `/api/funnel-metrics?days=3`: `metaAds.status=available`, conta `CA PY`, país `EC`, API `v26.0`.
- Janela validada de 2026-09-02 a 2026-09-04: 22.126 impressões, alcance 18.477, 2.999 cliques no link, 2.769 landing page views e gasto USD 114,45.
- Nenhuma campanha, orçamento, CAPI, pixel, pedido, Dropi, mensagem ou scheduler foi alterado pela integração.

# FREEZE EC NX ROUTE ISOLATED - 2026-07-05

## Objetivo

Criar uma camada separada para a nova VSL NX/Nitrix do Equador sem mexer na camada Vit Power congelada.

## Regra Congelada

- Vit Power EC permanece congelado em `https://ec.maxlien.shop/m/`.
- Nova camada NX EC publicada em `https://ec.maxlien.shop/n/`.
- Pagina informativa desktop mantida sem troca de conteudo/VSL.
- Precos permanecem os originais da camada ativa: `1 = USD 39.99`, `3 = USD 95.99`, `6 = USD 167.99`.
- Dropi nao foi alterado nem habilitado para NX nesta etapa.
- WhatsApp, Pixel/CAPI e painel EC continuam usando a infraestrutura EC ja auditada, com marcadores separados para NX.
- Nao copiar configuracao, token, banco, produto, Pixel ou Dropi de outro pais.

## Alteracao Publicada

Arquivo publicado no VPS:

- `/var/www/ec.maxlien.shop/n/index.html`
- `/var/www/ec.maxlien.shop/cta-nx-messages.json`

Alteracoes da camada NX:

- VSL mobile NX: `vid-6a4ad9fafede7452274da725`.
- Script NX: `https://scripts.converteai.net/f42d75cd-946f-49c8-b0c8-bc4a98fa88fe/players/6a4ad9fafede7452274da725/v4/player.js`.
- M3U8 NX: `https://cdn.converteai.net/f42d75cd-946f-49c8-b0c8-bc4a98fa88fe/6a4ad9ba3c0695cdbfa9ddd8/main.m3u8`.
- Marcador de entrada VSL/WhatsApp: `nx_ec_mobile`.
- Conteudo Meta separado: `ec_offer_nx_01`.
- Mensagens CTA separadas: `/cta-nx-messages.json`.

## Hashes

- `/var/www/ec.maxlien.shop/m/index.html`: `044770aa7f283e114b3b133f4bff7075535b6f00714e0d2626243e890cac3729`.
- `https://ec.maxlien.shop/m/`: `044770aa7f283e114b3b133f4bff7075535b6f00714e0d2626243e890cac3729`.
- `/var/www/ec.maxlien.shop/n/index.html`: `f1ab02e6a03a23376394e8ade93a3c6e72e4fcfe4f1e06576574b1d274b104ce`.
- `https://ec.maxlien.shop/n/`: `f1ab02e6a03a23376394e8ade93a3c6e72e4fcfe4f1e06576574b1d274b104ce`.
- `/var/www/ec.maxlien.shop/cta-nx-messages.json`: `283a2958bfdae11ed11a87dfadf19753d5fe3e597121d9f9c221ae7f4611c65e`.
- `https://ec.maxlien.shop/cta-nx-messages.json`: `283a2958bfdae11ed11a87dfadf19753d5fe3e597121d9f9c221ae7f4611c65e`.

## Backups E Evidencias

- Evidencia local: `/Users/greson/Automacao Vitalismen/cleanup-quarantine/ec-nx-route-20260705T225947Z`.
- Backup VPS: `/root/codex_deploy_backups/ec-nx-route-20260705T225947Z`.
- Backup VPS inclui copia anterior de `/var/www/ec.maxlien.shop/m/index.html` e hashes antes da publicacao.

## Validacao

- `https://ec.maxlien.shop/n/`: HTTP 200.
- `https://maxlien.shop/n/`: HTTP 200.
- `https://ec.maxlien.shop/m/`: HTTP 200 e hash preservado.
- Player NX e preloads externos: HTTP 200.
- Varredura HTML de `/n/` confirmou:
  - `vid-6a4ad9fafede7452274da725` presente;
  - `nx_ec_mobile` presente;
  - `ec_offer_nx_01` presente;
  - `/cta-nx-messages.json` presente;
  - player mobile antigo `vid-69f206413ea7d424b034658c` ausente;
  - player informativo desktop `vid-6a0454b6f18251980df23068` preservado.
- Browser abriu `https://ec.maxlien.shop/n/` e confirmou a pagina informativa desktop com os marcadores NX no HTML.
- `vitalismen-automation`: online no PM2.
- `/health`: `{"status":"ok"}`.
- `/api/zapi/status`: conectado.

## Guards Rodados

- `scripts/guard-freeze-lock-ec.mjs`: OK.
- `scripts/guard-status-panels-freeze.mjs`: OK.
- `scripts/audit-no-regression-meta-country.mjs`: OK.
- `scripts/audit-customer-draft-zero-quantity.mjs`: OK.

## Observacao Operacional

A rota `/n/` deve ser usada como nova camada NX para testes/entrada de trafego. A rota `/m/` continua sendo a camada Vit Power congelada. A pagina informativa nao muda nesta etapa.

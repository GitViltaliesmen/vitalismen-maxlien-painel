# Freeze EC Ficha do Cliente / Rate Limit - 2026-06-26

## Problema

O painel `https://ec.maxlien.shop/qr.html` voltou a listar agencias na Ficha do Cliente, mas ainda mostrava:

`Too many requests, please try again later.`

ao salvar a ficha ou mudar o estado do pedido.

## Causa

O rate limiter global em `src/index.js` ainda contava escritas operacionais da Ficha do Cliente e status do atendimento. Com o painel aberto, o polling consumia a janela e as acoes legitimas de atendimento podiam cair em `429`.

Tambem foi identificado que a chave do rate limiter podia ficar compartilhada por proxy/CDN se nao usasse o IP real enviado pelo Cloudflare.

## Correcao Congelada

Arquivo alterado:

- `/opt/vitalismen-automacao/releases/202606141310/src/index.js`

Mudancas congeladas:

- `clientRateLimitKey(req)` passa a usar `cf-connecting-ip` quando disponivel.
- O rate limiter global mantem protecao geral, mas ignora leituras seguras do painel.
- O rate limiter global tambem ignora somente escritas operacionais usadas pela Ficha/status:
  - `POST /api/whatsapp/chats/read`
  - `PATCH /api/whatsapp/contact-state/:phone`
  - `POST /api/whatsapp/contact-state/:phone/claim`
  - `POST /api/whatsapp/contact-state/:phone/release`
  - `PATCH /api/orders/:id`
  - `POST /api/orders`
  - `POST /api/orders/:id/send-to-review`
  - `POST /api/orders/:id/finalize-review`
  - `POST /api/orders/:id/clear-review`

Nao foram isentados envio de WhatsApp, Dropi, auth, check-phone, webhooks ou rotas sensiveis fora da operacao da Ficha.

## Evidencia

- Usuario confirmou no painel que a Ficha voltou a salvar.
- Busca de agencias:
  - `GET https://ec.maxlien.shop/api/shipments/servientrega/ec/agencies?city=Quito&limit=5`
  - resultado: `HTTP 200`, `success=true`, `count=5`.
- Probe seguro de escrita:
  - `PATCH https://ec.maxlien.shop/api/orders/__codex_freeze_probe__`
  - resultado: `HTTP 404`, `{"error":"Order not found"}`.
  - Interpretacao: a request passou pelo backend e nao foi barrada por `429`; nao alterou pedido real.
- Saude:
  - PM2 `vitalismen-automation`: `online`.
  - Release ativo: `/opt/vitalismen-automacao/releases/202606141310`.
  - API: `status=online`, `engine=Z-API`.

## Hashes Congelados

- `src/index.js`: `b64928f45f477f212771010409e997cfe51e62b972ec5d4e0160e1e0a74ab93b`
- `public/qr.html`: `01f6e6be389953f2aa91d7298e6f4e779917cc01acddfa8890f4b9eea62cfa64`

## Backups VPS

- Antes do ajuste de agencias/leitura:
  - `/root/codex_deploy_backups/ec-agency-rate-limit-before-fix-20260626_051143`
- Antes do ajuste de escrita da Ficha/status:
  - `/root/codex_deploy_backups/ec-panel-write-rate-limit-before-fix-20260626_052113`
- Estado final congelado:
  - `/root/codex_deploy_backups/ec-panel-ficha-rate-limit-frozen-20260626_052614`

## Testes

Local:

- `node --check src/index.js`: OK.
- `scripts/senior-guard.mjs`: OK.
- `scripts/guard-status-panels-freeze.mjs`: OK.
- `scripts/audit-customer-draft-zero-quantity.mjs`: OK.

VPS:

- `node --check src/index.js`: OK.
- `npm run guard:status-panels`: OK.
- `pm2 restart vitalismen-automation --update-env`: OK, servico online.

Observacao: `npm run senior:check` no VPS segue bloqueando por pendencias antigas em arquivos do observador/docs, fora deste congelamento. Nao foram alteradas para evitar misturar camadas.

## Regra Congelada

O painel EC pode consultar listas e salvar a Ficha do Cliente sem consumir a cota global de rate limit. A protecao contra abuso continua ativa para rotas fora da leitura operacional e fora das escritas especificas de atendimento.


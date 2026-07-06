# Freeze EC Z-API Read Status Webhook - 2026-07-06

## Escopo

- Pais/projeto: Equador Maxlien.
- Painel: `https://ec.maxlien.shop/qr.html`.
- Objetivo: habilitar o webhook real de status de mensagem do Z-API para o painel receber `READ` quando o WhatsApp/Z-API disponibilizar leitura.
- Colombia nao alterado.

## Estado Congelado Antes

- Commit funcional anterior: `801c78c`.
- PM2: `vitalismen-automation` online.
- Release ativa: `/opt/vitalismen-automacao/releases/202606141310`.
- Hash publico do painel antes/depois preservado em `qr.html`: `cf2f30071f2f4470ff8233f69e31d985cd446e371c4e7a94bd2e2280a3b84a8a`.

## Configuracao Aplicada

Script versionado:

- `scripts/configure-zapi-read-status-webhooks.mjs`.

Endpoints Z-API configurados:

- `update-webhook-delivery`.
- `update-webhook-message-status`.

URL configurada nos dois:

- `https://ec.maxlien.shop/api/zapi/webhook/delivery`.

Resultado da API Z-API:

- `delivery`: HTTP `200`, `ok=true`.
- `message_status`: HTTP `200`, `ok=true`.

## Backup

- VPS: `/root/codex_deploy_backups/zapi-read-webhook-config-20260706T022011Z`.

## Validacao

- `node --check scripts/configure-zapi-read-status-webhooks.mjs`: OK.
- `node scripts/configure-zapi-read-status-webhooks.mjs --dry-run`: OK.
- `https://ec.maxlien.shop/api/health/`: `status=online`, `engine=Z-API`.
- `https://ec.maxlien.shop/api/zapi/status`: conectado.
- Guardas no VPS:
  - `scripts/guard-freeze-lock-ec.mjs`: OK.
  - `scripts/guard-status-panels-freeze.mjs`: OK.
  - `scripts/audit-no-regression-meta-country.mjs`: OK.
  - `scripts/audit-customer-draft-zero-quantity.mjs`: OK.

## Regra Operacional

- A partir desta camada, o Z-API deve chamar o painel quando uma mensagem mudar para `SENT`, `RECEIVED`, `READ`, `READ_BY_ME` ou `PLAYED`.
- O painel ja interpreta `READ`/`PLAYED` como `✓✓ lido`.
- Se o WhatsApp/Z-API nao emitir `READ` por privacidade/configuracao do contato ou limitação da instância, permanece o fallback congelado: resposta do cliente marca leitura inferida.
- Para teste real de leitura, enviar uma mensagem controlada para numero autorizado, abrir no WhatsApp e conferir logs `[ZAPI-WEBHOOK] delivery | status=read`.

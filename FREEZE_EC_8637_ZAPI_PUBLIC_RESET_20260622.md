# FREEZE - EC 8637 Z-API Public Reset - 2026-06-22

## Problema

O numero de teste `5515998038637` foi zerado primeiro no Mongo local, mas o webhook real da Z-API estava alimentando o servidor publico. O teste enviado para `553183002800` entrou no publico e encontrou historico antigo.

Tambem houve uma leitura operacional errada: o endpoint Baileys local mostrava QR/scanning, mas o canal aprovado em producao era Z-API, que estava conectado.

## Evidencia

- `https://ec.maxlien.shop/api/zapi/status`: conectado, `phone=553183002800`, device `Ana Lopez 2800`.
- `https://maxlien.shop/api/zapi/status`: conectado, `phone=553183002800`, device `Ana Lopez 2800`.
- Antes do reset publico, `https://ec.maxlien.shop/api/whatsapp/messages/5515998038637?fast=1&limit=10` retornava historico antigo.

## Correcao

- VPS publico:
  - contato `5515998038637@c.us` mantido como teste fixo;
  - `human.mode=auto`;
  - tags: `TESTE_8637_PRIORIDADE`, `TESTE_FIXO_NAO_MEXER`, `BOT_TESTE_LIBERADO`;
  - `metadata.botTestEnabled=true`;
  - `metadata.noDropiEver=true`;
  - `metadata.cleanTestResetReason=manual_reset_8637_publico_liberado_para_teste`;
  - mensagens antigas removidas;
  - travas de dedupe antigas removidas.
- Local:
  - `.env` restaurado com Z-API operacional para `553183002800`;
  - `src/routes/health.js` ajustado para considerar Z-API conectada antes de acusar `no_connected_whatsapp_session`.

## Resultado

- Reset publico:
  - `contactsMatched=1`;
  - `messagesDeleted=35`;
  - `dedupeDeleted=6`;
  - `afterMessages=0`.
- Conferencia publica apos reset:
  - `https://ec.maxlien.shop/api/whatsapp/messages/5515998038637?fast=1&limit=10` retornou `[]`;
  - chat aparece limpo, sem ultimo texto, sem pedido, `human.mode=auto`.

## Backups

- Local `.env`: `backups/env-zapi-2800-20260622/.env.before-zapi-restore`.
- VPS: `/opt/vitalismen-automacao/current/backups/reset-8637-20260622/`.

## Regra Operacional

Para testes reais enviados ao WhatsApp `553183002800`, resetar o estado no VPS publico, nao apenas no Mongo local. Baileys local em QR/scanning nao significa falha da operacao quando a Z-API esta conectada.

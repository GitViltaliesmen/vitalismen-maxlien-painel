# Freeze EC WhatsApp Read Receipts - 2026-07-06

## Escopo

- Painel oficial: `https://ec.maxlien.shop/qr.html`.
- Camada: status de leitura no painel de atendimento WhatsApp.
- Produto/pais: Equador isolado. Colombia nao alterado.

## Problema

O painel mostrava envio/entrega quando havia callback, mas nao tinha uma camada robusta para leitura como no WhatsApp:

- aceitar mais formatos de callback de leitura do Z-API;
- preservar `lido` contra callbacks atrasados de `entregue`;
- marcar leitura inferida quando o cliente responde depois da mensagem do atendente.

## Correcao

- `src/models/Message.js`: adicionados `deliveredAt`, `readAt` e `readInferredAt`.
- `src/routes/zapi.js`:
  - normaliza `read`, `played`, `seen`, `opened`, `blue`, `visualiz*` como leitura;
  - normaliza `deliverycallback` como entrega;
  - impede regressao de `lido` para `entregue`;
  - quando chega mensagem do cliente, marca mensagens anteriores do atendente como `lido` inferido.
- `public/qr.html`: tooltip diferencia leitura real de leitura inferida por resposta do cliente.

## Evidencia Local

- `node --check src/routes/zapi.js`: OK.
- `node --check src/models/Message.js`: OK.
- `scripts/guard-freeze-lock-ec.mjs`: OK.
- `scripts/guard-status-panels-freeze.mjs`: OK.
- `scripts/audit-no-regression-meta-country.mjs`: OK.
- `scripts/audit-customer-draft-zero-quantity.mjs`: OK.

## Publicacao VPS

- Backup: `/root/codex_deploy_backups/ec-whatsapp-read-receipts-20260706T020606Z`.
- PM2: `vitalismen-automation` online.
- Release ativa: `/opt/vitalismen-automacao/releases/202606141310`.
- `current`: `/opt/vitalismen-automacao/releases/202606141310`.

Hashes publicados:

- `/opt/vitalismen-automacao/current/src/models/Message.js`: `c89759e357a6af6a2051ebf1fab7c83930a786d2f6237d93c192b7ba886a3037`.
- `/opt/vitalismen-automacao/current/src/routes/zapi.js`: `15ce5baf106944807dede4b2130aacde5690ea48d1e669efa431ccde445a10f7`.
- `/opt/vitalismen-automacao/current/public/qr.html`: `cf2f30071f2f4470ff8233f69e31d985cd446e371c4e7a94bd2e2280a3b84a8a`.
- `/var/www/ec.maxlien.shop/qr.html`: `cf2f30071f2f4470ff8233f69e31d985cd446e371c4e7a94bd2e2280a3b84a8a`.
- `https://ec.maxlien.shop/qr.html?v=read-receipts-20260706`: `cf2f30071f2f4470ff8233f69e31d985cd446e371c4e7a94bd2e2280a3b84a8a`.

## Smoke Test VPS

- `https://ec.maxlien.shop/api/health/`: `status=online`, `engine=Z-API`.
- `https://ec.maxlien.shop/api/zapi/status`: conectado.
- Guardas no VPS:
  - `scripts/guard-freeze-lock-ec.mjs`: OK.
  - `scripts/guard-status-panels-freeze.mjs`: OK.
  - `scripts/audit-no-regression-meta-country.mjs`: OK.
  - `scripts/audit-customer-draft-zero-quantity.mjs`: OK.

## Regra Operacional

- Quando Z-API enviar leitura real, o painel mostra `✓✓ lido`.
- Quando o cliente responder depois de uma mensagem do atendente, o painel mostra `✓✓ lido` com leitura inferida.
- Se o WhatsApp/Z-API nao entregar callback real de leitura por configuracao do cliente, a inferencia por resposta cobre o atendimento manual sem travar o fluxo.

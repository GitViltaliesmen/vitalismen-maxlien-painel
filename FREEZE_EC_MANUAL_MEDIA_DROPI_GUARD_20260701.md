# Freeze EC - midia manual com pedido Dropi ativo - 2026-07-01

## Problema

Audio enviado manualmente pelo painel podia aparecer na conversa, mas nao chegar ao cliente. Caso auditado:

- Cliente: `+593991564065`
- Mensagem: `manual_1782912929005_3efeffb7`
- Midia: `/media/templates/EC/Agradecimento_Agencia_01.ogg`
- Status salvo: `unconfirmed`
- Provedor: vazio, sem `providerMessageId`
- Erro: `WhatsApp nao retornou confirmacao da midia; conferir no aparelho.`

Os logs do VPS mostraram a causa:

- `[LOG_SEND_BLOCKED] audio bloqueado por pedido Dropi existente`
- Pedido relacionado: `EC-MR23YTB3-0Q0W`

O guard de Dropi estava correto para bloquear automacao comercial depois de pedido ativo, mas estava bloqueando tambem audio/imagem enviados manualmente pelo atendente.

## Correcao Aplicada

- `src/routes/whatsapp.js`
  - em envios de midia pela rota manual do painel (`sendMode === 'manual_panel'`), passa `allowExistingDropiOrder: true` para `sendWhatsAppMessage`;
  - a excecao vale somente para envio humano/manual do painel, nao para automacao.
- `public/qr.html`
  - quando a mensagem tiver `sendError`, o painel mostra o erro no rodape da bolha em vez de deixar a midia parecer enviada.

## Varredura

Amostra via API do painel EC:

- Chats: `180`
- Mensagens amostradas: `1381`
- Midias outbound: `325`
- Midias outbound entregues/lidas: `200`
- Midias outbound pendentes/enfileiradas: `114`
- Midias outbound sem confirmacao/erro: `11`
- Midias inbound: `226`
- Inbound sem arquivo real e token de midia: `4`
- Audios inbound historicos salvos como imagem por extensao: `10`

As amostras de inbound sem arquivo real eram previews de link do WhatsApp (`text.url`/`text.thumbnailUrl`), nao fotos/audios reais do cliente. Por isso devem seguir como texto/link, nao como imagem obrigatoria.

## Backup VPS

- `/opt/vitalismen-automacao/current/backups/manual-media-dropi-ec-20260701104634`

## Validacao

Local:

- `node --check src/routes/whatsapp.js`: OK
- check de sintaxe do script inline de `public/qr.html`: `OK inline scripts: 1`
- `npm run guard:freeze-lock`: OK
- `npm run guard:status-panels`: OK
- `npm run senior:check`: OK

VPS:

- `node --check src/routes/whatsapp.js`: OK
- check de sintaxe do script inline de `public/qr.html`: `OK inline scripts: 1`
- `pm2 restart vitalismen-automation --update-env`: processo online
- `https://ec.maxlien.shop/api/health`: `status=online`, `engine=Z-API`, `ready=true`, telefone `553183002800`
- `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`, `Ana Lopez 2800`
- `npm run guard:freeze-lock`: OK
- `npm run guard:status-panels`: OK

## Regra Congelada

Pedido Dropi ativo nao deve bloquear audio, imagem, video ou documento quando o envio for manual pelo painel. O bloqueio continua valido para automacao que nao declarar contexto permitido.

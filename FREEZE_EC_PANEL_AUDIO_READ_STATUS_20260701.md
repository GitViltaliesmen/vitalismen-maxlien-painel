# Freeze EC - painel audio sem link e status de leitura - 2026-07-01

## Pedido

Remover o link visual `Abrir audio` do card de audio no painel, pois dava a impressao de que a midia nao tinha sido enviada ao cliente. Implantar indicacao de envio, entrega e leitura semelhante ao WhatsApp.

## Correcao Aplicada

- `public/qr.html`
  - remove o link visivel `Abrir audio` dos cards de audio;
  - mantem o elemento `<audio>` interno com `controls`, `preload="metadata"` e fallback `.mp3`/`.ogg` para preservar o player;
  - adiciona status visual em mensagens enviadas pelo atendente:
    - `✓ enviado`;
    - `✓✓ entregue`;
    - `✓✓ lido`;
  - usa `deliveryStatus` e `ack` ja gravados pela Z-API.

## Backup VPS

- `/opt/vitalismen-automacao/current/backups/panel-audio-read-status-ec-20260701111600`

## Validacao

Local:

- check de sintaxe do script inline de `public/qr.html`: `OK inline scripts: 1`
- `npm run guard:status-panels`: OK
- `npm run guard:freeze-lock`: OK

VPS:

- check de sintaxe do script inline de `public/qr.html`: `OK inline scripts: 1`
- `npm run guard:status-panels`: OK
- `https://ec.maxlien.shop/qr.html` contem `messageDeliveryStatusHtml` e `message-status-delivered`;
- `https://ec.maxlien.shop/qr.html` nao contem `wa-audio-open` nem `Abrir audio`;
- `https://ec.maxlien.shop/api/health`: online, Z-API ready, telefone `553183002800`;
- `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`, `Ana Lopez 2800`.

## Regra Congelada

Audio no painel deve parecer uma mensagem normal do WhatsApp: player direto no card, sem link `Abrir audio`, e status claro de envio/entrega/leitura quando houver ACK da Z-API.

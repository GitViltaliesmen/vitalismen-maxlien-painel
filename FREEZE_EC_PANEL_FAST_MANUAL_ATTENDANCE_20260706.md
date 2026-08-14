# FREEZE EC PANEL FAST MANUAL ATTENDANCE - 2026-07-06

## Objetivo

Criar e publicar uma camada segura de atendimento manual rapido no painel EC para operar clientes pelo computador antes de subir novo funil/trafego.

## Escopo Congelado

- Painel oficial: `https://ec.maxlien.shop/qr.html`.
- Envio manual pelo painel sem temporizacao artificial.
- Botao `+` envia imagem, audio e video do computador como `manual_panel`.
- Campo `#messageInput` aceita colar arquivo de imagem/audio/video do clipboard e envia como midia.
- Texto colado continua funcionando como texto normal quando nao ha arquivo no clipboard.
- Ao enviar manualmente ou assumir cliente, o bot fica pausado ate o operador clicar em `Liberar auto`.
- Z-API manual sem `delayMessage`/`delayTyping`.
- Guardas de duplicidade e historico continuam ativos; audio manual pode bypassar dedupe quando enviado pelo painel.

## Fora Do Escopo

- Nao altera VSL `/m/` Vit Power.
- Nao altera VSL `/n/` NX/Nitrix.
- Nao altera precos.
- Nao altera Purchase/Meta CAPI.
- Nao altera Dropi.
- Nao muda prompts automaticos Vit Power para Nitrix nesta camada.
- Nao foi feito envio real para cliente durante validacao automatica.

## Arquivos Alterados

- `public/qr.html`
- `src/routes/whatsapp.js`
- `src/whatsapp/humanPacing.js`
- `src/whatsapp/sendText.js`
- `src/whatsapp/sendAudio.js`
- `src/whatsapp/sendImage.js`
- `src/whatsapp/sendVideo.js`
- `src/whatsapp/sendDocument.js`

## Hashes Publicados

- `public/qr.html`: `727508a11494280d6390919b55b0641577781aad02ee286b64b6b4141d4ab62e`.
- `/var/www/ec.maxlien.shop/qr.html`: `727508a11494280d6390919b55b0641577781aad02ee286b64b6b4141d4ab62e`.
- `src/routes/whatsapp.js`: `afcebcf88ee0cac9d5c48d25b14ac82650a1bafc6272d2a6e12c2ada821327ab`.
- `src/whatsapp/humanPacing.js`: `91081a45731fadf9d93650709b8069c978cb724d16bc8f2bfb423c89fcef12f4`.
- `src/whatsapp/sendText.js`: `36a6ba84ca45b34623967eba4030c7a909e0a9db77807c2b3374351c21d43638`.
- `src/whatsapp/sendAudio.js`: `268625277321ce4373a08fdd8648a52d4e93ece47724e1809f28f253f4f50d5f`.
- `src/whatsapp/sendImage.js`: `3e6deb46b7d3b3dcd13ffa35acba863d19fd39383a0a954c5d36ed197f59936d`.
- `src/whatsapp/sendVideo.js`: `ec4a5f2b63911b2deaad23d896e91e8f8bb438c46859eb542e9086f7dd983323`.
- `src/whatsapp/sendDocument.js`: `a6493d8ab9a286f7703f573a4fc0ccb3a63d594aeff49b2e739ad290239b00c1`.

## Backup VPS

- Backup: `/root/codex_deploy_backups/ec-fast-manual-panel-20260706T003022Z`.
- Conteudo: `files-before.tgz` e `hashes-before.txt`.

## Validacao Local

- `node --check` nos arquivos backend alterados: OK.
- Parse de script inline do `public/qr.html`: OK.
- `git diff --check`: OK.
- `scripts/guard-freeze-lock-ec.mjs`: OK.
- `scripts/guard-status-panels-freeze.mjs`: OK.
- `scripts/audit-no-regression-meta-country.mjs`: OK.
- `scripts/audit-customer-draft-zero-quantity.mjs`: OK.

## Validacao VPS

- Backup criado antes da publicacao.
- Arquivos copiados para `/opt/vitalismen-automacao/current`.
- `public/qr.html` espelhado para `/var/www/ec.maxlien.shop/qr.html`.
- `node --check` no VPS: OK.
- Parse de script inline do `public/qr.html` no VPS: OK.
- `pm2 restart vitalismen-automation --update-env`: OK.
- `vitalismen-automation`: online.
- `/health`: OK.
- `/api/zapi/status`: conectado.
- Guards no VPS: OK.
- `https://ec.maxlien.shop/qr.html`: HTTP 200.
- Browser confirmou:
  - `#messageInput` presente;
  - `#attachMediaBtn` presente;
  - `handleComposerPaste` presente;
  - `clipboardFilesFromPasteEvent` presente;
  - `sendMode: 'manual_panel'` presente;
  - `allowAudioDedupeBypass: true` presente.

## Regra Operacional

Usar esta camada para atendimento humano rapido no painel. Se o operador mandar texto, audio, imagem, video ou colar print, o cliente fica em modo manual ate clicar `Liberar auto`. Para teste real de envio, usar numero operacional/teste antes de cliente final.

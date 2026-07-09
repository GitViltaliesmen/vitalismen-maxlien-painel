# Congelado - Audio Cliente No Painel Via Proxy EC - 2026-07-09

Escopo: Equador (`ec.maxlien.shop`), painel WhatsApp, atendimento humano e audio de cliente recebido por Z-API/WhatsApp 2800.

## Problema

O painel renderizava o card de audio do cliente, mas alguns audios nao tocavam. No caso auditado do final `4529`, o HTML mostrava `src` em `.mp3` e `data-original-src` em `.ogg` por `/api/whatsapp/media-proxy`, com `data-fallback-tried="true"`.

## Causa

- A release ativa nao tinha a rota `GET /api/whatsapp/media-proxy`.
- O player podia trocar audio temporario Backblaze/Z-API para `.mp3`, mesmo quando o arquivo real do cliente era `.ogg`.
- O CSP nao declarava `media-src`, deixando fallback externo dependente de `default-src`.

## Correcao

- Adicionada rota `GET /api/whatsapp/media-proxy` com allowlist, suporte a `Range` e cache local em `public/media/remote-cache`.
- Adicionada diretiva `media-src 'self' data: blob: https:`.
- Ajustado o player do painel para preferir o `.ogg` original em audios temporarios Backblaze/Z-API e nao inventar fallback `.mp3`.
- Adicionado estado visual `Audio indisponivel` quando a midia realmente falha.

## Arquivos

- `src/routes/whatsapp.js`
- `src/index.js`
- `public/qr.html`

## Backup VPS

- `/root/codex_deploy_backups/ec-audio-panel-proxy-20260709_031439`

## Evidencias

- Release ativo validado: `/opt/vitalismen-automacao/releases/20260708211610`
- PM2: `vitalismen-automation` online.
- Telefone Z-API/WhatsApp: `553183002800`, nome `Valeria Zambrano`, `smartphoneConnected=true`.
- Caso auditado: `+593963324529`, mensagem `AC050348A2DE31A0A03BA63359F80618`, audio `.ogg`.
- Proxy do audio auditado: `HTTP 206`, `Content-Type: audio/ogg; codecs=opus`, `Accept-Ranges: bytes`.
- Cache local criado para o audio auditado em `public/media/remote-cache`.

## Testes Executados

- `node --check src/routes/whatsapp.js`
- `node --check src/index.js`
- `git diff --check`
- `node scripts/senior-guard.mjs`
- `node scripts/audit-ec-nitrix-guard.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/guard-public-funnel.mjs`
- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/audit-guide-print-spam-guard.mjs`
- `curl -I https://ec.maxlien.shop/n/`
- `curl -I https://ec.maxlien.shop/m/`
- `curl -I https://ec.maxlien.shop/qr.html?v=freeze-audio-4529`
- `curl https://ec.maxlien.shop/api/zapi/status`
- `curl https://ec.maxlien.shop/api/zapi/device`
- `curl https://ec.maxlien.shop/api/zapi/whatsapp-link?phone=553183002800`

## Regra Operacional Final

Audio de cliente recebido por Z-API deve tocar no painel por URL `.ogg` original via proxy interno. Links temporarios remotos devem ser cacheados pelo painel no primeiro acesso valido. O player nao deve trocar automaticamente audio temporario de cliente para `.mp3` se o original for `.ogg`.

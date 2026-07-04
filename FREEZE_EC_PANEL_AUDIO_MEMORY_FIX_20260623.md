# Freeze EC Painel Audio/Memoria - 2026-06-23

## Problema

O card de audio do painel podia aparecer pronto, mas ficar sem som para o operador. O arquivo publico `ENDERECO_CIDADE_PROVINCIA_AGENCIA.mp3` estava acessivel, mas o player do painel nao tinha fallback robusto para trocar entre `.mp3` e `.ogg` quando o navegador falhava no play/decode.

Tambem foi conferido o erro antigo de memoria/admin `listOnlineAdminLeadsByWindow`; no VPS atual o export existe e importa corretamente.

## Correcao Aplicada

- `public/qr.html`
  - voltou a renderizar audio com `preload="metadata"` e `controls="controls"`;
  - adiciona `data-fallback-src` alternando automaticamente `.mp3` e `.ogg`;
  - adiciona link `Abrir audio`;
  - se o play falhar, tenta o fallback uma vez antes de mostrar somente controles nativos;
  - se o elemento `<audio>` disparar `error`, troca para fallback quando disponivel.

## Evidencia

- URL publica do painel contem:
  - `audioFallbackUrl`;
  - `data-fallback-src`;
  - `preload="metadata" controls="controls"`;
  - `playWithFallback`.
- Audio testado:
  - `https://ec.maxlien.shop/media/templates/EC/ENDERECO_CIDADE_PROVINCIA_AGENCIA.mp3`
  - duracao: `15.412s`;
  - canais: `1`;
  - sample rate: `44100`;
  - volume RMS: `1813`;
  - max sample: `24288`.
- Memoria/admin:
  - `admin_memory_export_ok` no VPS para `listOnlineAdminLeadsByWindow`.
- Saude VPS:
  - `http://127.0.0.1:3001/api/health`: `status=online`, `engine=Z-API`, `ready=true`.
  - `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`, `Ana Lopez 2800`.

## Backup VPS

- `/opt/vitalismen-automacao/current/backups/panel-audio-memory-20260623031009`

## Regra Congelada

Audio no painel deve sempre ter controles nativos, link de abrir audio e fallback `.mp3`/`.ogg`. Se o navegador nao tocar o primeiro formato, o painel deve tentar o outro formato automaticamente antes de declarar erro.

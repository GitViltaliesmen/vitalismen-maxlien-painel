# Freeze EC - Z-API media classification - 2026-07-01

## Problema

O painel EC estava mostrando avisos de imagem/arquivo em mensagens que chegavam pela Z-API como texto ou link sem arquivo real. Em alguns casos, audio com URL `.ogg` tambem podia chegar salvo como `image`, fazendo o painel tentar renderizar como imagem.

## Correcao Aplicada

- `src/routes/zapi.js`
  - normaliza tipo real por MIME/URL antes de salvar a mensagem;
  - reconhece audio por `.mp3`, `.ogg`, `.opus`, `.webm`, `.m4a`, `.aac` e `.wav`;
  - quando a Z-API marca como midia mas nao traz `mediaUrl` e existe texto real, salva como `chat`, sem `hasMedia`;
  - mantem placeholder de midia somente para tokens reais como `[image]`, `[audio]`, `[sticker]`.
- `public/qr.html`
  - prioriza extensao real da URL antes do `type` explicito ao renderizar midia;
  - nao renderiza fallback "Imagem registrada..." quando a mensagem sem arquivo tem texto real;
  - preserva o card de audio com controles nativos, link de abrir audio e fallback `.mp3`/`.ogg`.

## Backup VPS

- `/opt/vitalismen-automacao/current/backups/media-classification-ec-20260701103207`

## Validacao

Local:

- `node --check src/routes/zapi.js`
- check de sintaxe do script inline de `public/qr.html`: `OK inline scripts: 1`
- `npm run guard:freeze-lock`: OK
- `npm run guard:status-panels`: OK
- `npm run senior:check`: OK local

VPS:

- `node --check src/routes/zapi.js`: OK
- check de sintaxe do script inline de `public/qr.html`: `OK inline scripts: 1`
- `pm2 restart vitalismen-automation --update-env`: processo online
- `https://ec.maxlien.shop/api/health`: `status=online`, `engine=Z-API`, `ready=true`, telefone `553183002800`
- `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`, `Ana Lopez 2800`
- `npm run guard:freeze-lock`: OK
- `npm run guard:status-panels`: OK

Observacao: `npm run senior:check` no VPS ainda acusa arquivos antigos de observador com termos proibidos de contexto. Esses arquivos nao foram alterados neste ajuste e devem ser tratados em frente separada.

## Regra Congelada

Mensagem recebida sem arquivo real e com texto real nao deve gerar aviso de imagem no painel. Audio deve ser reconhecido por URL/MIME mesmo quando a Z-API informar tipo incorreto.

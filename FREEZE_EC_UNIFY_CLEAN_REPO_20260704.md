# Freeze EC - Unificacao conservadora e repo limpo

Data: 2026-07-04
Pais: Ecuador / EC

## Fonte canonica

- Painel oficial: `public/qr.html`
- Producao app: `/opt/vitalismen-automacao/current/public/qr.html`
- Dominio vivo: `https://ec.maxlien.shop/qr.html`

## O que foi unificado

- `public/qr.html`, `qr.active.html`, `/opt/vitalismen-automacao/current/public/qr.html` e `/var/www/ec.maxlien.shop/qr.html` ficaram com o mesmo hash:
  `0cb9b77b1a419ef3e35b86c629df9f941a884ee61bcd40ca2e1ab29352369cec`.
- Arquivos que ja estavam iguais ao VPS foram commitados no Git.
- Arquivos locais divergentes foram preservados em patch/copia antes de adotar a versao canonica do VPS.
- Temporarios locais, logs e backups passaram a ser ignorados por `.gitignore`.

## Quarentena restauravel

- Snapshot local: `/Users/greson/Automacao Vitalismen/cleanup-quarantine/ec-unify-20260704T200852Z`
- Backup VPS: `/root/codex_deploy_backups/ec-unify-20260704T200852Z`
- Patch divergente local preservado: `repo/local-divergent-tracked.patch`
- Copias divergentes locais preservadas: `repo/local-divergent-files/`

## Commits desta limpeza

- `370103e chore: ignore local cleanup artifacts`
- `5f41b1a chore: track deployed EC production state`
- `9f7194d chore: adopt EC VPS canonical services`
- `6678681 docs: preserve EC freeze records`

## Regra operacional

- Nao usar `qr.active.html` nem `/var/www/ec.maxlien.shop/qr.html` como fonte de verdade.
- A fonte de verdade do painel EC e `public/qr.html`, publicado pelo app em `127.0.0.1:3001`.
- Qualquer diferenca futura deve ser comparada contra a producao viva antes de publicar.

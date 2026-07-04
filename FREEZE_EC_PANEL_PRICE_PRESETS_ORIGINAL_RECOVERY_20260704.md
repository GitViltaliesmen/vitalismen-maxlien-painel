# Freeze EC - Panel price presets original/recovery

Date: 2026-07-04
Country: Ecuador / EC
Scope: Maxlien customer panel, order details price presets

## Frozen rule

- Left column: original prices.
  - 1 bottle: USD 39.99
  - 3 bottles: USD 95.99
  - 6 bottles: USD 167.99
- Right column: recovery / discount prices.
  - 1 bottle: USD 35
  - 3 bottles: USD 80
  - 6 bottles: USD 147

## Synced files

- Local active file: `/Users/greson/Automacao Vitalismen/qr.active.html`
- Git worktree: `/Users/greson/Documents/Vitalismen Automacao/public/qr.html`
- VPS app release: `/opt/vitalismen-automacao/current/public/qr.html`
- VPS static public file: `/var/www/ec.maxlien.shop/qr.html`

## VPS backup

- `/root/codex_deploy_backups/ec-price-presets-20260704T194850Z/current-public-qr.before.html`
- `/root/codex_deploy_backups/ec-price-presets-20260704T194850Z/static-qr.before.html`

## Validation

- Local, Git worktree, VPS app release, and VPS static HTML all expose the same preset order:
  `1:39.99`, `3:95.99`, `6:167.99`, `1:35`, `3:80`, `6:147`.
- `https://ec.maxlien.shop/qr.html?v=price-presets-20260704` returned HTTP 200.
- VPS health returned `{"status":"ok"}`.
- Z-API EC remained connected on phone `553183002800`.
- Browser render check confirmed the grouped grid with `Preco original` and `Recuperacao / desconto`.

## Git note

The repository already had pending unrelated changes before this freeze, including existing changes in `public/qr.html`. The worktree file is updated, but committing the HTML should be done with a scoped stage/review to avoid mixing older pending changes into this freeze.

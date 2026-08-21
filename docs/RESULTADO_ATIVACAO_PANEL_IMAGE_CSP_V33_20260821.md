# Resultado da ativação V33 — imagens autenticadas no painel

Data: 2026-08-21

## Fonte e release oficiais

- PR: `#25`.
- Commit de produção: `cb8f6fe7d706d6c9ec5546ba8368f5a08b55e336`.
- Tag: `production-20260821-cb8f6fe`.
- Release ativa: `/opt/vitalismen-automacao/releases/20260821T225331Z_production-20260821-cb8f6fe`.
- Backup anterior: `/opt/vitalismen-automacao/backups/pre-v33-20260821T225331Z`.
- Rollback disponível: `/opt/vitalismen-automacao/releases/20260821T222100Z_production-20260821-4dbb541`.
- Storage inbound compartilhado preservado: `/opt/vitalismen-automacao/shared/media/inbound`.

## Validação após a ativação

- Ativação transacional concluída; rollback não executado.
- Permit root específico e de uso único consumido.
- PM2 `vitalismen-automation` online, com `pm_cwd` e `pm_exec_path` apontando por `/opt/vitalismen-automacao/current` para o release ativo.
- Health público `https://ec.maxlien.shop/api/health/`: HTTP 200 e status `online`.
- Z-API oficial: conectada, smartphone conectado e telefone `5515991418416`.
- CSP pública: `img-src 'self' data: blob: https:`; `object-src 'none'` e demais diretivas preservadas.
- Três imagens inbound reais do telefone QA foram baixadas por endpoint autenticado e renderizadas no painel sem erro: `1024×1536`, `1024×1536` e `220×310`.
- Os três arquivos continuaram como JPEG persistido em `READY`; nenhum token foi colocado na URL.
- Nenhuma mensagem, pedido, Dropi ou Meta/CAPI foi acionado por esta correção.

## Testes

- Suíte completa local e de staging: `249/249` testes aprovados.
- Guard V33: `14/14` testes aprovados.
- CI do PR: Node 20, Node 22 e Cloudflare aprovados.
- Lint, freeze lock, microcamada de produto, anti-spam e retirada aprovados.

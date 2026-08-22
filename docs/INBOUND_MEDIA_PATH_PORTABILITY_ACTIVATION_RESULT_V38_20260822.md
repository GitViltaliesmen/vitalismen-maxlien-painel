# Resultado da ativação V38 — portabilidade do caminho de mídia inbound

## Identificação publicada

- Pull request funcional: `#38` —
  `test(midia): corrige portabilidade do caminho inbound`.
- Commit funcional: `154a387`.
- Merge em `production`:
  `dbc3cbd1b910e27a7673b8c90c80d740478f5cec`.
- Tag anotada: `production-20260822-dbc3cbd`.
- GitHub Release:
  `https://github.com/GitViltaliesmen/vitalismen-maxlien-painel/releases/tag/production-20260822-dbc3cbd`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T143218Z_production-20260822-dbc3cbd`.
- Ativação concluída em `2026-08-22T14:33:49Z` pela rotina transacional
  oficial `/usr/local/sbin/vitalismen-stage`.

## Escopo efetivamente alterado

- O teste `tests/inbound-media-storage.test.mjs` agora calcula a expectativa
  de caminho de acordo com a plataforma em execução.
- Em Windows, o teste aceita a resolução nativa `C:\opt\...`; em Linux, mantém
  a expectativa `/opt/...`.
- O serviço congelado `src/services/inboundMediaStorageService.js` permaneceu
  byte a byte inalterado.
- Não houve `skip`, mascaramento de falha nem alteração do contrato de runtime.
- A microcamada sucessora V38 registrou manifesto, hashes, guardas estáticos e
  de runtime e autorização de ativação controlada.

## Backup e rollback

- Backup protegido anterior à troca:
  `/opt/vitalismen-automacao/backups/pre-inbound-media-path-portability-v38-20260822T143218Z`.
- Arquivo dos oficiais substituídos: `v37-overridden-files.tgz`.
- SHA-256 do arquivo:
  `e438a6d063e107e2aaec25cfbaa36a16f9c0d8115b27985ec8d1c893fe3bf7b9`.
- Cópia protegida do ambiente: `environment.before-v38`.
- SHA-256 da cópia de ambiente:
  `0b2c6bddf5d9a7b7d3fcfaa8bc04f2fac298d8f15e8460288dfa4d6a8b6d61d6`.
- Permissões verificadas: diretório `700`; arquivos `600`; propriedade
  `root:root`.
- Rollback disponível:
  `/opt/vitalismen-automacao/releases/20260822T052803Z_production-20260822-f2e7a69`.
- O storage compartilhado de mídia inbound não foi removido nem substituído.

## Auditoria da publicação

- GitHub Actions aprovou Node 20, Node 22 e Cloudflare Pages.
- O staging oficial aprovou `npm ci`, auditoria oficial, freeze lock, senior
  check, microcamada de produto, catálogo Dropi, avisos de retirada, contatos,
  selos operacionais e testes de retirada.
- `npm run senior:check` local: `283/283` testes aprovados, zero falhas e zero
  ignorados.
- `npm run senior:check` no release ativo do VPS: `283/283` testes aprovados,
  zero falhas e zero ignorados.
- Guard específico V38 no VPS: `16/16` aprovado.
- Health público, `/n/` e `/qr.html`: HTTP `200`.
- `/api/zapi/status` anônimo permaneceu protegido: HTTP `401`.
- A tag anotada e `origin/production` apontavam para o merge exato antes do
  staging e da autorização.

## PM2 e efeitos reais

- PID anterior: `2119915`.
- PID após reinício controlado: `2152686`.
- Status: `online`; `unstable_restarts=0`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- O CWD real do PID resolve para a release V38 ativa.
- O symlink `current` resolve para a release V38 ativa.
- A autorização de ativação foi consumida em uso único.
- Nenhuma mensagem de WhatsApp, mídia, pedido, Dropi ou evento Meta/CAPI foi
  criado como canário durante staging ou validação.
- Nenhum outro processo PM2 foi reiniciado ou alterado.

## Resultado funcional

O guard local e o CI voltaram a ficar integralmente verdes nas plataformas
Windows e Linux. A incompatibilidade estava limitada à expectativa do teste;
o armazenamento inbound em produção não precisou ser alterado.

Funil, preços, checkout, Dropi, Meta/CAPI, pixel, Z-API, número oficial, memória
de pedidos, mídias, áudio, scheduler, avisos de retirada e demais rotinas de
pós-venda permaneceram inalterados.

# Resultado da ativação V41 — busca exata de cliente no painel EC

Data: 2026-08-22
País: Equador
Status: ativa e validada em produção

## Fonte imutável

- Pull request funcional: `#45`.
- Commit funcional: `e736d23`.
- Merge em `production`: `1f4895bdf7f00a00831484e9e2fe1b832658dd74`.
- Tag anotada: `production-20260822-1f4895b`.
- GitHub Release: `V41 — busca exata de clientes no painel EC`.
- Freeze: `panel-client-search-v41-20260822`.

A branch `production`, a tag, o commit do staging e o release ativado apontavam
para a mesma árvore antes da autorização root.

## Staging e ativação transacional

- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T180506Z_production-20260822-1f4895b`.
- Processo iniciado após a ativação em `2026-08-22T18:07:45Z`.
- Somente `vitalismen-automation` foi reiniciado.
- PID anterior: `2173631`.
- PID atual após ativação: `2181029`.
- `current`, `pm_cwd`, `pm_exec_path` e o CWD real do PID resolvem para a V41.
- Estado PM2: `online`; `unstable_restarts=0`.
- Autorização root `0600` consumida em uso único.
- Rollback automático não foi executado.
- Release V40 preservada:
  `/opt/vitalismen-automacao/releases/20260822T172707Z_production-20260822-d1a142a`.

O empacotador comum criou primeiro um diretório candidato inativo. O helper root
recusou corretamente reutilizá-lo. Depois de confirmar que o diretório não era
`current`, não era symlink e continha exatamente o commit V41, somente esse
candidato reconstruível foi removido. O helper oficial recriou a release do zero,
validou a tag e concluiu o staging sem alterar a V40 ativa durante os gates.

## Backup

- Arquivo oficial anterior:
  `/opt/vitalismen-automacao/backups/qr.html.before-v41-20260822T180506Z`.
- Dono e permissão: `root:root 0600`.
- SHA-256:
  `4dfecbcb525d329d2f316c19e07e9a06bc8d3068d54a812e569eae47844c764a`.

O release V40 completo também permanece disponível como rollback. Nenhum banco,
storage compartilhado, contato, pedido ou histórico precisa ser revertido.

## Resultado funcional

- a busca da coluna de conversas consulta somente nome e telefone do cliente;
- número completo com ou sem formatação é reconhecido;
- formatos EC `5939...`, `09...` e `9...` convergem para a mesma identidade;
- três ou mais dígitos finais localizam somente telefones com aquele sufixo;
- um ou dois dígitos não exibem lista ampla e pedem pelo menos três dígitos;
- texto da última mensagem, pedido, etiqueta e origem não geram resultados;
- busca por nome ignora maiúsculas e acentos;
- enquanto a busca está preenchida, os filtros visuais são ignorados para mostrar
  o cliente na fila em que ele estiver;
- apagar a busca restaura os filtros anteriores;
- a coluna esquerda continua sem prévia de mensagem.

## Testes e validação pública

- testes V41: `8/8` aprovados, zero falhas e zero ignorados;
- `npm run senior:check`: `316/316` aprovados, além dos 8 testes V41;
- lint: `LINT_JS_SYNTAX=OK files=360`;
- GitHub Actions Node 20 e Node 22: aprovados;
- Cloudflare Pages: aprovado;
- staging oficial: todos os gates de auditoria, freeze, produto, catálogo Dropi,
  retirada, contatos, selos e testes aprovados;
- health oficial: `status=online`, PID `2181029`, Z-API conectada e nenhuma razão
  degradada;
- fila inbound pendente na validação: `0`;
- `https://ec.maxlien.shop/qr.html`: HTTP `200`;
- `https://ec.maxlien.shop/panel-intelligence/chat-search-v41.js`: HTTP `200`;
- `https://ec.maxlien.shop/n/`: HTTP `200`;
- `/api/zapi/status` sem autenticação: HTTP `401`;
- hashes publicados de `qr.html` e `chat-search-v41.js` iguais aos hashes do
  freeze V41;
- navegador oficial: título correto, asset V41 presente uma vez, campo de busca
  presente, placeholder `Buscar nome, número ou últimos 3+ dígitos`,
  `#conversation` presente, nenhuma `.chat-preview .meta` e zero erros de console.

## Efeitos externos e preservação

Nenhuma mensagem real, mídia, pedido, Dropi, Meta/CAPI, escrita de banco ou
migração foi executada durante desenvolvimento, testes, staging ou validação.

Permaneceram preservados: produtos, preços, origem das VSLs, checkout, funis,
áudios, pós-venda, Z-API, número oficial, scheduler, buckets V40 e os demais
processos PM2. O processo externo de aquecimento não foi aberto nem alterado.

O `npm ci` continuou informando três advisories transitivos já existentes no
caminho coexistente Baileys/libsignal/protobufjs. Essa dívida não foi introduzida
pela V41 e não foi alterada porque exigiria mexer no transporte congelado. A Z-API
oficial permaneceu conectada e pronta.

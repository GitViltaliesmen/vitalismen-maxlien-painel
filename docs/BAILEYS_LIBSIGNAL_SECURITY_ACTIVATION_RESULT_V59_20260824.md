# Resultado de ativacao V59 — saneamento Baileys/libsignal/protobufjs

Data: 2026-08-24

## Publicacao

- Pull request funcional: `#74`.
- Commit oficial: `c7061a14e2d329c88c2925c45b327737158ce593`.
- Tag anotada: `production-20260824-c7061a1`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T131742Z_production-20260824-c7061a1`.
- Ativacao transacional concluida em `2026-08-24T13:19:10Z`.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T123239Z_production-20260824-812fb25`.
- PM2: PID `2576593`, `online`, `unstable_restarts=0`; `pm_cwd` e
  `pm_exec_path` apontam para `/opt/vitalismen-automacao/current` e
  `/proc/2576593/cwd` resolve para a release V59.

## Saneamento confirmado

- Antes da ativacao, a release V58 reproduzia `2 high + 1 critical` no
  `npm audit --omit=dev`.
- Depois da ativacao, a release V59 retorna zero vulnerabilidades `info`,
  `low`, `moderate`, `high` e `critical`.
- `@whiskeysockets/baileys` permaneceu em `6.7.24`.
- `libsignal` passou para `6.0.0`, commit
  `bcea72df9ec34d9d9140ab30619cf479c7c144c7`.
- Baileys e libsignal deduplicam para `protobufjs@7.6.5`; a versao aninhada
  `6.8.8` nao existe na arvore ativa.
- A instalacao limpa e o teste de carregamento nao abriram socket, criaram
  sessao nem enviaram mensagem.

## Validacao final

- CI Node 20/22 e Cloudflare: OK.
- Suite completa local: `354/354`; lint: `446` arquivos.
- Guard V59, `senior:check`, produto EC, catalogo Dropi somente leitura,
  anti-spam, notificacoes de retirada, labels operacionais e freeze lock: OK.
- `https://ec.maxlien.shop/api/health/`, `/n/` e `/qr.html`: HTTP `200`.
- Health publico: `online`, sem razoes de degradacao; Z-API `connected`,
  `outboundBlocked=false`, sem erro.
- `current`, PM2 e CWD real do processo apontam para a mesma release V59.

## Preservado

- Z-API continua sendo o transporte oficial.
- Nenhum cliente real ou telefone QA recebeu envio de validacao.
- Nenhum pedido, Shipment, Dropi, Meta/CAPI ou Purchase foi criado ou repetido.
- Painel, funis, produtos, precos, VSL, checkout, pixel, numero oficial,
  credenciais, midias, audios, memoria, bancos, schedulers e pos-venda nao
  foram alterados.

Rollback nao executado; autorizacao root de uso unico consumida. Bancos,
mensagens, pedidos, Shipments e midias compartilhadas permanecem preservados.

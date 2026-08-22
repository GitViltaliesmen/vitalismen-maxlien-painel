# Resultado da ativação V40 — fila interna de relacionamento EC

Data: 2026-08-22
País: Equador
Status: ativa e validada em produção

## Fonte imutável

- Pull request funcional: `#43`.
- Commit funcional: `1eb6032739edaa391e4e8aef3ef7c1ef8fed0baf`.
- Merge em `production`: `d1a142ab44aeb7eca03fef25f91bba39252c13a9`.
- Tag anotada: `production-20260822-d1a142a`.
- GitHub Release: `V40 — fila interna de relacionamento EC`.
- Freeze: `ec-engagement-internal-bucket-v40-20260822`.

A branch `production`, a tag e a candidata apontavam para o mesmo merge antes
da autorização root e da troca de release.

## Staging e ativação transacional

- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T172707Z_production-20260822-d1a142a`.
- Ativação concluída em `2026-08-22T17:29:08Z` pelo helper oficial
  `/usr/local/sbin/vitalismen-stage`.
- Somente `vitalismen-automation` foi reiniciado.
- PID anterior: `2161976`.
- PID atual: `2173631`.
- `current`, `pm_cwd`, `pm_exec_path` e o CWD real do PID resolvem para a V40.
- Estado PM2: `online`; `unstable_restarts=0`.
- A autorização root `0600` foi consumida em uso único.
- Rollback automático não foi executado.

O staging aprovou clone/tag, `npm ci --omit=dev`, auditoria oficial, freeze lock,
senior check, microcamada EC, catálogo Dropi, avisos de retirada, contatos,
selos operacionais e testes de retirada, sem trocar `current` durante os gates.

## Configuração operacional protegida

- `EC_ENGAGEMENT_AUTO_REPLY_ENABLED=true` somente na release V40.
- Delay local: `12–25` segundos.
- Cooldown: `30` minutos.
- Limite: `4` respostas por dia e contato em `America/Guayaquil`.
- Chamadas de modelo por decisão: `0`.
- Custo estimado de IA por decisão: `USD 0`.
- Backup anterior:
  `/opt/vitalismen-automacao/backups/environment.before-v40-20260822T172707Z`.
- SHA-256 do backup:
  `0b2c6bddf5d9a7b7d3fcfaa8bc04f2fac298d8f15e8460288dfa4d6a8b6d61d6`.
- Backup e `.env` candidata: `root:root:600`.
- A release V39 preservada continua com a flag ausente/desligada.

## Resultado funcional

- O painel oficial apresenta `ATENDIMENTO`, `AQUECIMENTO`, `PEDIDOS` e
  `REVISAR` como filas exclusivas da mesma conversa.
- O mesmo `ContactState` conserva contato, histórico, mídia, produto, VSL,
  pedido e memória; nenhum cliente é duplicado.
- `#AQUECE`, `#AQUECEVIP`, `#NAOAQUECE` e `#RISCO` permanecem internos e não
  são enviados ao cliente.
- Compra, produto, preço ou quantidade retornam automaticamente a
  `ATENDIMENTO`.
- Pedido, shipment ou suporte operacional ativo aparecem em `PEDIDOS`.
- Risco, opt-out e ambiguidade de mídia/link aparecem em `REVISAR`.
- Resposta automática só pode existir depois de uma entrada nova e elegível do
  cliente; a camada não inicia conversa, não faz disparo frio e não possui
  caminho de envio em massa.
- Emoji, reação, sticker, imagem, áudio, vídeo, documento ou link simples não
  recebem resposta automática.
- Lock, identidade da entrada, histórico, cooldown, limite diário e ausência
  de repetição são persistidos no `ContactState`.

## Auditoria da população

A auditoria posterior à ativação permaneceu `READ_ONLY` e não executou migração
ou movimento em massa:

- população correlacionada: `823` contatos EC;
- `ATENDIMENTO`: `131`;
- candidatos seguros a `AQUECIMENTO`: `19`;
- `PEDIDOS`: `89`;
- `REVISAR`: `584`.

Esses números são classificação de auditoria, não uma alteração coletiva de
banco. Cada conversa só é persistida por nova entrada real ou ação manual
autenticada.

## Caso EC-ADMIN-2943

O contato auditado `+593984302981`, consolidado como `Gustavo Vargas`, foi o
único ajuste pontual de estado após a ativação:

- bucket anterior: `attendance` por default legado;
- bucket atual: `review`;
- confiança: `high`;
- score: `100`;
- exclusão: `safety_risk`;
- `warmup.allowed=false`, `risk=true`, `manualOnly=true`;
- `lastReplyAt=null`;
- `dailyReplyCount=0`;
- `modelCallCount=0` e `estimatedCostUsd=0`;
- registros técnicos antes e depois: `294`;
- pedidos e shipments ativos: `0`.

A reclassificação alterou somente o `ContactState`. Nenhuma mensagem, mídia,
pedido, Dropi ou evento Meta/CAPI foi criado.

## Testes e validação pública

- `npm run senior:check`: `316/316` aprovados, zero falhas, cancelamentos ou
  testes ignorados.
- `npm run lint`: `LINT_JS_SYNTAX=OK files=356`.
- GitHub Actions: Node 20 e Node 22 aprovados.
- Cloudflare Pages: aprovado.
- Health oficial: `status=online`, PID `2173631`, Z-API conectada e nenhuma
  razão degradada.
- `https://ec.maxlien.shop/n/`: HTTP `200`.
- `https://ec.maxlien.shop/qr.html`: HTTP `200`.
- `/api/zapi/status` sem autenticação: HTTP `401`.
- Navegador: os quatro módulos e o seletor foram encontrados no HTML publicado,
  `#conversation` existe, endpoint e filtro V40 estão ligados e
  `document.querySelectorAll('.chat-preview .meta').length === 0`.
- Console do navegador durante a validação: zero erros.

Não houve canário em cliente real, login operacional no navegador, envio de
WhatsApp, criação de pedido, submissão Dropi ou evento Meta/CAPI durante teste,
staging ou validação.

## Preservado e rollback

VSLs, produtos de origem, preços, checkout, Dropi, Meta/CAPI, pixel, número
oficial, Z-API, funil comercial, mídia, áudio, pós-venda V39, scheduler e demais
processos PM2 permaneceram preservados. O projeto externo de aquecimento não foi
aberto, usado, chamado, copiado ou alterado.

Rollback disponível:

`/opt/vitalismen-automacao/releases/20260822T152503Z_production-20260822-e191a6e`

Para rollback, reativar a V39 e manter
`EC_ENGAGEMENT_AUTO_REPLY_ENABLED=false`. Bancos, mídia compartilhada, contatos,
pedidos e histórico de bucket permanecem preservados.

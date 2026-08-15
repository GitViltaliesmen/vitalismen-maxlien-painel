# Congelamento aprovado EC v5: funil manual, historico e metricas

Data: 2026-08-15

## Escopo preservado da v4

A camada automatica inicial Tex Ultra, a microcamada posterior a confirmacao, os audios, tempos, filas, locks, deduplicacao, pausa por interacao e bloqueio de replay automatico permanecem iguais aos aprovados na v4. O manifesto e o guard da v4 continuam imutaveis como evidencia historica.

## Extensao autorizada nesta versao

1. Cliente originado por VSL continua recebendo o produto automatico da VSL.
2. Depois de o atendente assumir uma conversa EC, o Funil Rapido Tex Ultra fica disponivel como ferramenta manual de texto, independentemente do produto historico.
3. O atalho somente prepara texto para revisao; nao envia mensagem, nao troca produto e nao salva pedido automaticamente.
4. Produto da VSL, produto da negociacao atual e pedido anterior ficam identificados separadamente.
5. Pedido anterior de cliente antigo nao recebe alteracao de produto, dados ou status durante a nova negociacao. A confirmacao completa gera novo pedido com `previousOrderId`.
6. A pagina `funnel-metrics.html` passa a ser versionada e alimentada por `GET /api/funnel-metrics`, com Bearer, papel administrativo, dados EC e calendario `America/Guayaquil`.

## Protecao tecnica

- O manifesto `docs/freeze/tex-ultra-panel-metrics-v5-20260815.json` registra os hashes desta baseline.
- `scripts/guard-tex-ultra-approved-v5.mjs` e o guard de runtime v5 bloqueiam divergencias.
- `senior:check`, `deploy:ec-safe` e `deploy:vps` apontam para a v5.
- A pagina de metricas escapa dados vindos do banco antes de inserir HTML.
- A v4 nao foi reescrita nem apagada.

## Estado de publicacao

Esta baseline foi criada para auditoria e commit. Nenhum deploy, reinicio de PM2, mudanca de symlink ou alteracao de dados de cliente faz parte deste congelamento local.

## Rollback

Antes de eventual publicacao, o rollback continua sendo o release ativo anterior. Depois de publicada uma release v5, o procedimento deve restaurar o symlink anterior e reiniciar o PM2 somente se os health checks local e publico falharem.

# Congelamento — liberação geral Nitrix EC — 11/07/2026

## Escopo

Camada de controle de rollout da entrada Nitrix no Equador. Não altera preço, mídia, áudio, uso, regras de saúde, Vit Power, Dropi, Pixel, banco ou WhatsApp de outro produto ou país.

## Estado publicado

- Liberação inicial: `d861889c3933bc4808c339e628ef7ec4e4a722f6`.
- Correção intermediária de entrada VSL Nitrix: `486616d916cd074056779ba675310b8a3620cdb0`.
- Entrada VSL imediata ativa: `27c6f93767c4345153bb3cdafdcc557d18b735d2`.
- Release VPS ativo: `/opt/vitalismen-automacao/releases/20260712024530_git_27c6f93`.
- Ambiente: `NITRIX_FAST_STATE_ENABLED=true` e `NITRIX_FAST_STATE_ROLLOUT_MODE=full`.
- O código é fechado por padrão: sem `ROLLOUT_MODE=full`, o modo é `qa` e exige telefone de QA configurado.
- Em `full`, não há bypass de deduplicação de áudio/texto do QA.

## Evidências

- Teste da trava: QA configurado aceita somente o telefone permitido; QA sem telefone fica fechado; `full` aceita entrada Nitrix; bypass de QA permanece falso no modo geral.
- Guardas de congelamento, contexto, produto, Nitrix e funil público aprovados.
- Git local, GitHub e Git do VPS apontaram para o mesmo commit.
- PM2, `/health`, `/n/`, `/qr.html`, CTA, mídia inicial e Z-API EC foram validados.
- Não havia cadências Nitrix pendentes no instante da ativação.

## Recuperação

- Backup pré-código: `/root/codex_deploy_backups/ec-pre-full-release-20260711_232920`.
- Backup imediatamente anterior à ativação: `/root/codex_deploy_backups/ec-before-full-activation-20260711233201`.
- O rollback troca somente o symlink `current` para o release registrado no `active-release.txt` do backup e reinicia `vitalismen-automation`.

## Correção pós-entrada real — 12/07/2026

- Causa identificada: o registro de clique VSL colocava toda entrada EC em `human.mode=manual`. Para Nitrix isso podia bloquear o Fast State antes da primeira resposta.
- Correção: uma entrada VSL Nitrix comprovada passa a ser registrada em modo `auto`, sem remover uma retenção manual criada por atendente real. Vit Power mantém a regra anterior.
- Proteção adicional: clique repetido na VSL não atualiza `lastInboundAt` enquanto a cadência Nitrix estiver em execução; portanto não cancela mídia como se fosse uma mensagem do cliente.
- O cliente identificado durante a auditoria foi atendido manualmente e não foi reprocessado pelo bot.
- PM2 reiniciado após a ativação; `/api/health` retornou `online`, sem degradação, WhatsApp/Z-API conectados e fila inbound vazia.
- Backup pós-correção: `/root/codex_deploy_backups/ec-post-nitrix-vsl-auto-20260712T023452Z.tar.gz` (SHA-256 `1ad70ecc67ce95946c29b5e0dfbc67ed688ad44d778ebb28a94aea13d1cd0d98`).

## Entrada VSL sem espera — 12/07/2026

- Regra ativa: entrada VSL Nitrix comprovada inicia o Fast State mesmo quando o cliente ainda não escreveu no WhatsApp.
- A primeira mensagem aprovada de Valeria é sorteada e enviada em 0–800 ms; Áudio 1 segue na janela humana aprovada. Se o cliente escrever em qualquer ponto, as etapas pendentes são canceladas e a pergunta recebe resposta antes de qualquer nova mídia.
- O scheduler Nitrix roda a cada 1 segundo e retoma jobs persistidos após restart; nenhuma etapa depende apenas de timer em memória.
- Teste real controlado: entrada VSL Nitrix sem mensagem recebeu texto de apresentação, Áudio 1, Áudio 2 e prova social, todos aceitos e gravados no estado persistido, sem inbound e sem falha.
- PM2 foi corrigido para iniciar por `/opt/vitalismen-automacao/current/src/index.js`, evitando manter caminho absoluto de release antigo após uma ativação.
- Backup pós-validação: `/root/codex_deploy_backups/ec-nitrix-vsl-immediate-20260712T025232Z.tar.gz` (SHA-256 `4e46285a07fad23b46435720cf9ea674ecea48240936ee85c2bec0a3368b8f6b`).

## Limites operacionais

- O número histórico de QA permanece protegido com `noDropiEver=true` e `purchaseCapiDisabled=true`.
- A indisponibilidade temporária da Dropi é uma camada externa e não autoriza reenvio automático de pedido.
- A próxima camada é observação de 10 entradas VSL Nitrix reais, ou 24 horas de tráfego, sem alterar o funil. Somente depois do resultado congelado podem ser tratados Dropi, painel, Meta ou Motor EC comum.

# Congelamento — liberação geral Nitrix EC — 11/07/2026

## Escopo

Camada de controle de rollout da entrada Nitrix no Equador. Não altera preço, mídia, áudio, uso, regras de saúde, Vit Power, Dropi, Pixel, banco ou WhatsApp de outro produto ou país.

## Estado publicado

- Liberação inicial: `d861889c3933bc4808c339e628ef7ec4e4a722f6`.
- Correção ativa de entrada VSL Nitrix: `486616d916cd074056779ba675310b8a3620cdb0`.
- Release VPS ativo: `/opt/vitalismen-automacao/releases/20260712023500_git_486616d`.
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

## Limites operacionais

- O número histórico de QA permanece protegido com `noDropiEver=true` e `purchaseCapiDisabled=true`.
- A indisponibilidade temporária da Dropi é uma camada externa e não autoriza reenvio automático de pedido.
- A próxima camada é observação de 10 entradas VSL Nitrix reais, ou 24 horas de tráfego, sem alterar o funil. Somente depois do resultado congelado podem ser tratados Dropi, painel, Meta ou Motor EC comum.

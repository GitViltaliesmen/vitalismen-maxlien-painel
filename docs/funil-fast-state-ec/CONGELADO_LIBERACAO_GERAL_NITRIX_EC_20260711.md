# Congelamento — liberação geral Nitrix EC — 11/07/2026

## Escopo

Camada de controle de rollout da entrada Nitrix no Equador. Não altera preço, mídia, áudio, uso, regras de saúde, Vit Power, Colômbia, Dropi, Pixel, banco ou WhatsApp de outro produto/país.

## Estado publicado

- Commit: `d861889c3933bc4808c339e628ef7ec4e4a722f6`.
- Release VPS: `/opt/vitalismen-automacao/releases/20260711233201_git_d861889`.
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

## Limites operacionais

- O número histórico de QA permanece protegido com `noDropiEver=true` e `purchaseCapiDisabled=true`.
- A indisponibilidade temporária da Dropi é uma camada externa e não autoriza reenvio automático de pedido.
- A próxima camada é observação de 10 entradas VSL Nitrix reais, ou 24 horas de tráfego, sem alterar o funil. Somente depois do resultado congelado podem ser tratados Dropi, painel, Meta ou Motor EC comum.

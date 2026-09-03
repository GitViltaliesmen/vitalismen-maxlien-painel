# Congelamento V116 — pós-venda transacional EC

## Objetivo

A V116 separa definitivamente o observador read-only V114 do executor transacional e permite manter o bot de vendas no perfil V78 enquanto o pós-venda roda em processo oneshot isolado. A ativação continua limitada a um shipment elegível por ciclo e uma reserva persistente por dia.

## Correções de segurança

- A cota diária deixa de depender apenas da contagem de envios concluídos. Cada tentativa externa exige uma reserva atômica na coleção `post_sale_dispatch_quotas` antes do provider.
- Dois workers, dois timers ou dois restarts não conseguem consumir a mesma unidade da cota.
- Reservas de deduplicação de pós-venda são criadas com `retryAllowed=false`.
- Timeout, 5xx, perda de resposta ou falha após o início da chamada ao provider são persistidos como `AMBIGUOUS` e exigem reconciliação humana antes de qualquer nova tentativa.
- Rejeição 4xx definitiva é persistida como `FAILED_FINAL`.
- `AMBIGUOUS` e `FAILED_FINAL` são estados terminais do ledger e bloqueiam repetição automática.
- Aceite sem `messageId`, `id` ou `zaapId` não pode ser finalizado como `SENT`.
- O transporte de pós-venda usa uma única tentativa por processo; não executa retry ou failover deliberado depois de resposta ambígua.

## Operação

- Observador: `vitalismen-postsale-next-eligible-v114.timer`, estritamente read-only, a cada cinco minutos.
- Executor: `vitalismen-postsale-transactional-v116.timer`, processo oneshot serial protegido por `flock`, a cada sessenta minutos.
- Perfil inicial e política formal mais recente: `BATCH_MAX=1`, `DAILY_LIMIT=1`, promoção além de um desativada.
- O executor carrega o perfil V105 somente no subprocesso. O PM2 permanece no perfil do bot V78; não há troca global de perfil para cada ciclo.

## Preservado

- backlog histórico e marketing em massa desligados;
- Meta retroativo desligado;
- Dropi automático em `REPORT_ONLY` nesta camada;
- `human.mode=manual` bloqueia o pós-venda;
- preços, checkout, produtos, funil, mídias e número oficial não mudam;
- release baseline e snapshot permanecem disponíveis para rollback.

## Rollback

Desabilitar o timer V116 com `ops/post-sale-v116 contain`, restaurar o symlink `current` pelo mecanismo oficial de release e verificar `pm_cwd`, `pm_exec_path`, health, Mongo, nginx e Z-API. A contenção não apaga ledger, quota ou dedupe já persistidos.

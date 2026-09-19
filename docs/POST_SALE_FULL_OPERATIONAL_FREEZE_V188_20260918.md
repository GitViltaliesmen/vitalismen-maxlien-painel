# V188 — Pós-venda completo operacional EC

Data: 2026-09-18
Base imutável: `e0cd23c7a18552c9c3c56daf788100bc87781dc3`
Branch: `codex/v188-postsale-full-operational`

## Escopo

A V188 habilita exclusivamente o pós-venda EC em executor `systemd` isolado. O
processo principal do PM2 continua no perfil `EC_BOT_CORE_OPERATIONAL`; a V188
não troca nem reinicia o motor comercial para executar os agendamentos.
Todos os arquivos históricos congelados permanecem byte a byte iguais à base;
a cadência ampliada vive somente nos novos arquivos da microcamada V188.

Estágios cobertos: GUIDE, IN_TRANSIT, READY_FOR_PICKUP, RETURNED, DAY1,
SOFT_DAY2, DAY3, SOFT_DAY4, DAY5, SOFT_DAY6, PICKUP_PROOF_REQUEST,
DELIVERED_THANK_YOU, PICKUP_BONUS, PRODUCT_USAGE e
TREATMENT_REFILL_REMINDER.

## Barreiras obrigatórias

- um único aviso elegível por ciclo e lock global por `flock`;
- janela de envio 08:00–19:00 em `America/Guayaquil`;
- Z-API conectada antes do ciclo;
- ledger V66, lock persistente, chave canônica, histórico, marker legado,
  `providerMessageId` e reserva at-most-once preservados;
- SOFT_DAY2 satisfaz PICKUP_PROOF_REQUEST no mesmo envio e no mesmo
  `providerMessageId`, sem segunda mensagem;
- lembretes encerram automaticamente quando o estado deixa de ser
  READY_FOR_PICKUP ou há entrega, retirada ou devolução;
- reposição somente após entrega canônica Servientrega, com 25/50/70 dias e
  decisão central de opt-out/hold humano;
- mídia por produto validada para Tex Ultra, Nitrix e Vit Power;
- Dropi permanece `REPORT_ONLY`, Meta Purchase e retro-send permanecem
  desligados, Baileys permanece desligado e recuperação global de backlog
  permanece desligada.

## Classes de escrita autorizadas no executor

1. `post_sale_ledger`
2. `post_sale_notification_lock`
3. `post_sale_outbound`
4. `post_sale_schedule_state`
5. `post_sale_logistics_state`

Wildcard é proibido. As classes do bot comercial pertencem ao processo PM2
existente e não são ampliadas pelo executor V188.

## Operação e rollback

O timer `vitalismen-postsale-full-v188.timer` roda a cada 15 minutos com lote
máximo um. A ativação exige `install`, dry-run/staging e só então `activate`.
Para contenção imediata usar `ops/post-sale-v188 contain`; isso desliga o timer
e preserva ledgers, markers e confirmações já aceitas, evitando duplicidade no
rollback da release.

## Imutabilidade externa

VSL, `public/qr.html`, `conversationEngine.js`, `agentRouter.js`, funil
comercial, produtos, preços, Meta/CAPI, Dropi apply, Z-API provider, número do
WhatsApp, métricas V185/V186/V187 e Nginx não fazem parte deste sucessor.

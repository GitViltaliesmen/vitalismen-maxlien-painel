# Freeze V105 — control plane transacional de pós-venda EC

Data: 2026-09-03
Escopo: Vitalismen Ecuador, bot oficial e notificações logísticas V66
Pai: V104 (`3550ef487750128b0a6e5a6051693f66100e9779`)

## Objetivo

Ativar o pós-venda transacional V66 sem reabrir Dropi automático, backlog
histórico, Meta retroativo, campanhas ou schedulers comerciais. O perfil
inicial registra somente o dispatcher logístico, com lote máximo e limite
diário iguais a um.

## Perfil fechado

- bot inbound, resposta automática, funil e persistência Z-API permanecem ativos;
- `SHIPMENT_STATUS_DISPATCH_ENABLED=true` com `BATCH_LIMIT=1`, limite diário 1,
  modo adaptativo desligado e reconciliação antes do envio;
- reminders, proof sweep, carrier sweep e guide-print ficam disponíveis no
  runtime V66, mas desligados no primeiro degrau para impedir ciclos paralelos;
- Dropi active sync fica desligado e seu modo efetivo permanece `REPORT_ONLY`;
- backlog recovery, follow-ups, recompra 30d, imports, watchdog, Nitrix fast
  state, Google Contacts e alertas automáticos ficam desligados;
- Meta Purchase e Meta retroativo ficam desligados.

## Barreiras por mensagem

`postSaleNotificationDecisionService` agora consulta o estado humano pelo
telefone EC antes de devolver `SHOULD_SEND`. Qualquer `human.mode=manual`
bloqueia a mensagem. A decisão também impede `GUIDE` após estágio em trânsito
ou posterior e impede `IN_TRANSIT` após retirada/entrega/devolução ou ledger
posterior. Ledger terminal, lock persistente, histórico equivalente, marcador
legado, cooldown e chave idempotente V66 continuam obrigatórios.

## Bridge e ativação

`ops/post-sale-v105` materializa o bridge V66 somente após permit root de uso
único e janela máxima de dez minutos. O bridge é state-only: não envia mensagem
nem cria pedido Dropi. Uma segunda autorização gera overlay hasheado e permit
separado para reiniciar exclusivamente `vitalismen-automation`.

Falha de ativação restaura o overlay V78 na mesma release. `contain` também
restaura somente o bot V78, sem desfazer a correção Dropi ou trocar `current`.

## Lote inicial

O primeiro `batch-run` executa uma vez, com limite um e sem retry automático.
Após o envio, o limite diário persistido no perfil impede outro disparo no
mesmo dia. A expansão futura exige novo perfil versionado e nova autorização.

## Preservado

Não há alteração de produto, preço, VSL, funil comercial, número WhatsApp,
Dataset Meta, schema Mongo, Nginx, Dropi automático, recompra ou outros países.

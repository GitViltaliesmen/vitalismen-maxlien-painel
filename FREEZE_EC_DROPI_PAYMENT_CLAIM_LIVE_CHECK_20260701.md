# Freeze EC - Dropi payment claim live check

Data: 2026-07-01
Pais: Equador
Dominio: ec.maxlien.shop

## Problema

O alerta "Cobrar atualizacao de pagamento Dropi" podia ser enviado quando a
Servientrega ja marcava o pedido como ENTREGADO, mas o status local da Dropi
ainda estava atrasado como EN_RUTA. Isso gerou falso positivo para cobranca,
como no pedido EC-DROPI-5756679 / guia 185292238.

## Causa

A decisao de alerta usava o status Dropi previamente salvo no banco local.
Quando esse status estava stale, o sistema assumia que a Dropi ainda nao estava
verde/ENTREGADO e enviava cobranca para os operadores.

## Correcao

Antes de enviar qualquer alerta de cobranca por entrega confirmada na
Servientrega, o dispatcher agora consulta a Dropi ao vivo via
`syncDroppiEcuadorFromPanel`.

Regra final:

- Servientrega ENTREGADO + Dropi ao vivo ENTREGADO/verde: nao cobrar.
- Servientrega ENTREGADO + Dropi ao vivo diferente de ENTREGADO/verde: avisar para cobrar atualizacao de pagamento Dropi.
- Servientrega ENTREGADO + falha ao consultar Dropi: avisar para conferir pagamento Dropi manualmente.
- Se ja houve falso alerta anterior e a consulta viva confirma Dropi verde, enviar aviso de resolucao "Pagamento Dropi ja esta verde".

## Arquivo alterado

- `src/services/shipmentStatusDispatcherService.js`

## Backup de producao

- `/opt/vitalismen-automacao/current/backups/dropi-payment-claim-live-check-ec-20260701130900`

## Evidencia de teste

Pedido testado:

- Cliente: Eutimio Mora
- Guia: 185292238
- Pedido Dropi: 5756679
- Pedido interno: EC-DROPI-5756679

Resultado apos patch:

- Servientrega: ENTREGADO
- Dropi ao vivo: ENTREGADO
- Evento gravado: `dropi_payment_claim_skipped_paid`
- Motivo: `dropi_already_delivered_green`
- Como existia alerta antigo de cobranca, foi enviado aviso de resolucao:
  `dropi_payment_claim_resolved_notified`

## Saude apos deploy

- PM2 `vitalismen-automation`: online
- `/health`: ok
- `/api/automation/status`: carrierSweepCandidates 0, whatsappQueue 0

## Regra operacional congelada

A fonte fiel para entrega fisica continua sendo Servientrega. A fonte fiel para
pagamento recebido pela operacao continua sendo Dropi verde/ENTREGADO. Portanto,
pedido entregue na Servientrega so entra em cobranca se a Dropi consultada ao
vivo ainda nao estiver verde/ENTREGADO.

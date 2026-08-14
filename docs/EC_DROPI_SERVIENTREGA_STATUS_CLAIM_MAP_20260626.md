# Mapeamento EC: Servientrega Entregue x Dropi / Cobranca De Status E Pagamento

## Objetivo

Criar um fluxo operacional para quando a Servientrega confirma guia entregue/retirada e a Dropi ainda nao atualizou status ou pagamento.

O fluxo deve gerar evidencia, orientar a conversa na Dropi e preservar a cronologia no painel sem misturar com Ficha do Cliente, rate limit, Meta ou funil de venda.

## Regra Mestre

Consultar status com fonte oficial:

1. Servientrega direta pela guia.
2. Dropi pelo pedido/guia.
3. Banco/painel Maxlien.

Enviar mensagem ao cliente ou abrir conversa Dropi somente quando houver diferenca real ou pendencia real.

Nao enviar aviso repetido a cada 6 minutos.

Regra financeira corrigida:

- Dropi verde / `ENTREGADO`: nao cobrar, porque o pagamento ja foi realizado.
- Servientrega retirada/entregue e Dropi ainda nao verde / nao `ENTREGADO`: cobrar a Dropi para atualizar status e liberar o pagamento.

## Estados Mapeados

### Caso A: Servientrega retirada/entregue, Dropi ainda nao verde

Condicao:

- Servientrega: retirada, `ENTREGADO`, `Reportado Entregado`, ou equivalente oficial.
- Dropi: diferente de `ENTREGADO` / nao verde.
- Painel interno: diferente de `ENTREGADO`

Acao:

- Marcar fila: `dropi_payment_claim_required`
- Criar pacote de evidencia.
- Abrir conversa Dropi em:
  - `Transportadora`
  - `Ordenes sin movimiento`
- Solicitar atualizacao para `ENTREGADO` e liberacao do pagamento/recaudo.

Mensagem Dropi curta:

`Pedido enviado y entregado por Servientrega. Guia 185543824, orden 5880721. Solicito actualizar a ENTREGADO y liberar recaudo. Adjunto evidencia oficial.`

### Caso B: Dropi ja verde/entregue, painel interno atrasado

Condicao:

- Servientrega: `ENTREGADO`
- Dropi: `ENTREGADO`
- Painel interno: diferente de `ENTREGADO`

Acao:

- Sincronizar painel interno a partir da Dropi.
- Registrar evento `droppi_panel_sync_completed`.
- Liberar fluxo de entregue/bonus se ainda pendente.
- Nao cobrar a Dropi, porque verde/`ENTREGADO` significa pagamento realizado.
- Nao abrir conversa `Ordenes sin movimiento`, porque a Dropi ja atualizou status.

## Evidencias Obrigatorias

Para cada cobranca/status:

- `orderId` interno.
- `dropiOrderId`.
- Guia Servientrega.
- Cliente e telefone.
- Status Servientrega.
- Data/hora do movimento Servientrega.
- Status Dropi.
- Print Servientrega.
- Print Dropi.
- PDF guia/fatura, se houver.
- Foto do cliente/produto/recibo, quando disponivel.

## Mensagem Para Cliente Pedindo Comprovante

Usar somente quando a evidencia do cliente for necessaria para anexar na cobranca:

`Hola Gregorio, Servientrega ya reporto su pedido como entregado. Para cerrar soporte, por favor envieme una foto del producto o comprobante de retiro. Gracias.`

## Caso Gregorio Ventura / 5245

Pedido interno: `EC-MQSCC6XV-4OBY`

Dropi order: `5880721`

Guia: `185543824`

Cliente: `Gregorio Ventura`

Telefone: final `5245`

Resultado atual:

- Servientrega direta: `ENTREGADO`
- Dropi: `ENTREGADO`
- Painel interno: sincronizado para `ENTREGADO`
- Ordem interna: `delivered`

Arquivos de evidencia locais:

- `backups/ec-dropi-claim-gregorio-5245-20260626/evidence.json`
- `backups/ec-dropi-claim-gregorio-5245-20260626/print-servientrega-185543824-entregado.png`
- `backups/ec-dropi-claim-gregorio-5245-20260626/print-dropi-orders-185543824-entregado-wide.png`

Arquivos de evidencia no VPS:

- `/root/codex_deploy_backups/ec-dropi-claim-gregorio-5245-20260626/evidence.json`
- `/root/codex_deploy_backups/ec-dropi-claim-gregorio-5245-20260626/print-servientrega-185543824-entregado.png`
- `/root/codex_deploy_backups/ec-dropi-claim-gregorio-5245-20260626/print-dropi-orders-185543824-entregado-wide.png`

Neste caso especifico, a conversa `Ordenes sin movimiento` nao deve ser aberta para pedir mudanca de status, porque a Dropi ja mostra `ENTREGADO`.

Como a Dropi esta verde/`ENTREGADO`, nao ha cobranca de pagamento para este pedido. O que havia era atraso do nosso painel interno, que foi sincronizado.

## Implementacao Minima Recomendada

Criar uma fila interna de divergencias:

- `dropi_payment_claim_required`: Servientrega retirada/entregue e Dropi ainda nao verde.
- `dropi_claim_submitted`
- `dropi_claim_resolved`

Arquivos provaveis para uma proxima alteracao:

- novo `src/services/dropiStatusClaimService.js`
- `src/routes/shipments.js`
- opcional `public/qr.html`
- opcional integracao com `src/services/carrierTrackingSweepService.js`

## Regra De Seguranca

Antes de enviar mensagem ou upload para a Dropi:

1. Conferir se Dropi ainda precisa da conversa.
2. Conferir se o anexo correto esta selecionado.
3. Conferir se a mensagem esta no assunto correto.
4. Registrar evento no pedido.
5. Nao enviar cobranca duplicada para a mesma guia/status.

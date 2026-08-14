# Freeze EC Servientrega / Dropi / Cronologia De Entrega - 2026-06-26

## Escopo

Congelamento documental da auditoria de cronologia de guias, faturas e avisos ao cliente no funil Equador.

Este congelamento nao altera codigo, ambiente, Dropi, Servientrega, WhatsApp ou dados de pedidos.

## Estado Atual

Dominio: `https://ec.maxlien.shop`

Painel: `https://ec.maxlien.shop/qr.html`

Release ativo: `/opt/vitalismen-automacao/releases/202606141310`

Servico PM2: `vitalismen-automation`

## Constatacao Principal

O sistema ja possui uma camada de rastreio direto da transportadora em `src/services/carrierTrackingService.js`, mas essa camada ainda nao esta integrada a uma varredura automatica recorrente.

Na producao, a auditoria encontrou `0` eventos `carrier_tracking_checked` nos pedidos recentes. Isso indica que os status recentes ainda estao vindo principalmente do painel Dropi/sync interno, nao da consulta oficial direta da Servientrega.

## Caso Auditado

Cliente: `Gregorio Ventura`

Telefone: final `5245`

Pedido ativo correto: `EC-MQSCC6XV-4OBY`

Guia Servientrega: `185543824`

Dropi order: `5880721`

Status no banco/Dropi no momento da auditoria: `READY_FOR_PICKUP` / `PARA RETIRO EN AGENCIA SERVIENTREGA`

Status direto na Servientrega: `ENTREGADO`

Movimento oficial Servientrega:

- Data: `2026-06-26 10:05`
- Origem: `QUITO (Provincia: PICHINCHA)`
- Destino: `JIPIJAPA (Provincia: MANABI)`
- Movimento: `Reportado Entregado en Agencia JIPIJAPA_VICTOR MANUEL RENDON`

## Evidencias De Teste

Consulta direta sem persistir:

- Guia `185543824`
- Resultado: `ok=true`, `statusAtual=Entregado`, `normalizedStatus=ENTREGADO`
- Tempo aproximado: `18.3s`

Consulta direta sem persistir:

- Guia `185529016`
- Resultado: `ok=true`, `statusAtual=Pendiente`, `normalizedStatus=READY_FOR_PICKUP`
- Tempo aproximado: `16.9s`

## Gargalo Identificado

Configuracao atual de producao:

- `SHIPMENT_STATUS_DISPATCH_ENABLED=true`
- `SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES=60`
- `SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT=3`
- `DROPPI_EC_ACTIVE_SYNC_ENABLED=true`
- `DROPPI_EC_ACTIVE_SYNC_INTERVAL_MINUTES=30`
- `SHIPMENT_MIN_MESSAGE_GAP_MS=1800000`

Tambem foi identificado que `src/services/schedulerService.js` limita o dispatcher a no minimo 10 minutos, mesmo que o ambiente seja configurado para 6 minutos.

## Avaliacao

A recomendacao tecnica e consultar a Servientrega a cada poucos minutos em lote pequeno, mas enviar mensagem ao cliente somente quando houver mudanca real de status.

Nao e recomendado enviar avisos repetidos a cada 6 minutos.

O sistema ja possui travas anti-spam por tipo de aviso:

- `automation.guiaNotifiedAt`
- `automation.readyForPickupNotifiedAt`
- `automation.inTransitNotifiedAt`
- `automation.returnedNotifiedAt`
- `automation.bonusNotifiedAt`
- `automation.lastReminderAt`
- hash global de mensagem

## Proxima Camada Planejada

Mapear e automatizar uma fila operacional para casos onde:

1. Servientrega confirma `ENTREGADO`.
2. Dropi continua com status atrasado, como `PARA RETIRO` ou pedido sem movimento.
3. O pedido precisa ser cobrado/atualizado na Dropi para liberar pagamento.
4. A evidencia oficial da transportadora deve ser anexada na conversa Dropi.

## Arquivos Que Podem Ser Alterados Na Proxima Etapa

Ainda nao alterados neste congelamento:

- `src/services/schedulerService.js`
- `src/services/carrierTrackingService.js`
- novo `src/services/carrierTrackingSweepService.js`
- possivel rota/painel de observacao em `src/routes/automation.js` ou `src/routes/shipments.js`

## Regra Congelada

Nao misturar esta auditoria com novas alteracoes de funil, Ficha do Cliente, rate limiter, Meta, pixel, atendimento humano ou Dropi outbound.

A proxima etapa deve ficar restrita a:

- Servientrega como fonte oficial de status.
- Mapeamento de divergencia Servientrega x Dropi.
- Evidencia para conversa/cobranca na Dropi.
- Aviso ao cliente somente por mudanca real de estado.

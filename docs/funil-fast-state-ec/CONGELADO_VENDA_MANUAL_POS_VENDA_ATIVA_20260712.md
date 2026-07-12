# EC — venda manual e pós-venda ativo

Data: 12/07/2026

## Decisão operacional

- Nenhum bot, funil ou recuperação comercial pode responder ou iniciar uma venda no Equador.
- A conversa de venda passa a ser conduzida manualmente no painel.
- Depois de um pedido fechado, continuam autorizadas apenas as rotinas de pós-venda já aprovadas: guia, atualizações de entrega, lembrete de retirada e recompra pós-venda.

## Travas aplicadas no VPS EC

Foram definidos explicitamente como `false`:

- `WHATSAPP_AUTO_REPLY_ENABLED`
- `WHATSAPP_FUNNEL_ENABLED`
- `WHATSAPP_PRODUCT_FOLLOWUP_ENABLED`
- `PENDING_CHECKOUT_FOLLOWUP_ENABLED`
- `ADMIN_BUY_LATER_FOLLOWUP_ENABLED`
- `NITRIX_FAST_STATE_ENABLED`
- `VSL_FIRST_RESPONSE_WATCHDOG_ENABLED`
- `WHATSAPP_BACKLOG_RECOVERY_ENABLED`
- `ZAPI_CHAT_WATCHDOG_ENABLED`
- `WHATSAPP_AUTO_REJECT_CALLS`

Rotinas preservadas, sem alteração:

- recompra pós-venda de 30 dias;
- despacho de status de entrega;
- lembretes de retirada;
- despacho de impressão de guia.

## Evidência e rollback

- Processo PM2 `vitalismen-automation` reiniciado e online, apontando para `/opt/vitalismen-automacao/current`.
- Logs de inicialização confirmaram as rotinas de venda desativadas e as quatro rotinas de pós-venda ativas.
- Backup da configuração anterior no VPS: `ec-pre-sale-bot-off-20260712T033547Z.env`.
- A Z-API continuava desconectada antes e depois desta camada; essa alteração não tentou reconectar, parear ou enviar mensagens.

## Regra de reabertura

Qualquer retorno de automação comercial exige uma nova camada aprovada, teste controlado e validação de que não interfere no atendimento manual ou no pós-venda.

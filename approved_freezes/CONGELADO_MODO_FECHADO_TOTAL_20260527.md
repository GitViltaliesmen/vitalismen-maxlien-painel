# CONGELADO_MODO_FECHADO_TOTAL_20260527

Data: 2026-05-27

Objetivo: fechar o ambiente e nao deixar automacao publica ou disparo automatico aberto.

## Estado aplicado no VPS

```env
PUBLIC_BASE_URL=https://ec.maxlien.shop/m/
WHATSAPP_AUTO_REPLY_ENABLED=false
ZAPI_ROUTE_INBOUND_TO_BOT=false
WHATSAPP_AUTOMATION_PILOT_ONLY=true
WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS=5515998038637,573183002800,3183002800,553183002800
ZAPI_OUTBOUND_ALLOWED_RECIPIENTS=5515998038637,573183002800,3183002800,553183002800
SHIPMENT_STATUS_DISPATCH_ENABLED=false
SHIPMENT_PICKUP_REMINDERS_ENABLED=false
WHATSAPP_BACKLOG_RECOVERY_ENABLED=false
ADMIN_BUY_LATER_FOLLOWUP_ENABLED=false
WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false
PENDING_CHECKOUT_FOLLOWUP_ENABLED=false
POST_SALE_REPURCHASE_30D_ENABLED=false
DISABLE_SCHEDULER=1
```

## Fechado

- Bot publico desligado.
- Roteamento inbound da Z-API para bot desligado.
- Envio Z-API voltou para lista restrita de teste.
- Envio automatico de guias desligado.
- Lembretes de retirada desligados.
- Recompra/pos-venda desligado.
- Follow-up de produto desligado.
- Follow-up de checkout pendente desligado.
- Backlog recovery desligado.
- Comprar depois desligado.
- Scheduler geral desligado por `DISABLE_SCHEDULER=1`.

## Mantido

- API/painel continuam online para consulta e operacao manual.
- Site oficial continua sendo `https://ec.maxlien.shop/m/`.
- Arquivos, congelamentos e regras implantadas permanecem preservados.
- Nada foi apagado.

## Validacao

```text
593999123456@zapi -> zapi_recipient_not_allowed
553183002800@zapi -> permitido apenas por estar na lista restrita de teste
PM2 vitalismen-automation -> online
unstable restarts -> 0
Scheduler -> desativado por DISABLE_SCHEDULER=1
```

## Observacao

Baileys permanece deslogado e pode registrar tentativa de conexao enquanto o processo sobe, mas a automacao publica esta desligada e a Z-API nao roteia inbound para o bot.

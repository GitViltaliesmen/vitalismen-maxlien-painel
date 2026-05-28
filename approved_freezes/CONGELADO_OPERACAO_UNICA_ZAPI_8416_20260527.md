# Congelamento - Operacao Unica Z-API 8416

Data: 2026-05-27

## Objetivo

Garantir que, com anuncios rodando, o atendimento e os envios automaticos usem somente o numero operacional atual `5515991418416`.

## Configuracao aplicada no VPS

- `WHATSAPP_DEFAULT_SESSION_ID=5515991418416`
- `WHATSAPP_SESSION_IDS=5515991418416`
- `WHATSAPP_ALLOWED_OUTBOUND_SESSION_IDS=5515991418416`
- `WHATSAPP_ALLOWED_OUTBOUND_SESSIONS=5515991418416`
- `WHATSAPP_SELLER_POOL_EC=5515991418416`
- `WHATSAPP_SELLER_POOL=5515991418416`
- `WHATSAPP_SELLER_ROTATION_SEQUENCE_EC=5515991418416`
- `WHATSAPP_SELLER_E164=5515991418416`
- `WHATSAPP_SENDER_DAILY_LIMITS=5515991418416:200`
- `WHATSAPP_SENDER_TARGET_DAILY_LIMITS=5515991418416:200`
- `WHATSAPP_SENDER_WEIGHTS=5515991418416:1`
- `WHATSAPP_SENDER_TARGET_WEIGHTS=5515991418416:1`
- `WHATSAPP_DAILY_LIMITS=5515991418416:200`
- `WHATSAPP_PANEL_OPERATIONAL_NUMBERS=5515991418416`
- `WHATSAPP_PRIORITY_TEST_PHONES=`
- `ZAPI_CONNECTED_PHONE=5515991418416`
- `ZAPI_OPERATION_PHONE=5515991418416`
- `ZAPI_OPERATIONAL_PHONE=5515991418416`
- `WHATSAPP_PAUSED_SESSION_IDS=`
- `WHATSAPP_CONNECT_ENABLED=false`

## Backup

Backup antes/depois no VPS:

`/opt/vitalismen-automacao/backups/operacao-unica-8416-20260528-024400`

## Validacao

- PM2 reiniciado com `--update-env`.
- `/api/zapi/status` retornou `ok:true` com fallback por atividade recente e telefone `5515991418416`.
- `/api/zapi/device` retornou `ok:true` com telefone `5515991418416`.
- Logs mostram webhooks Z-API chegando e Baileys desativado.

## Observacao

O rodizio tecnico antigo ficou neutralizado porque todos os pools, sequencias e limites agora apontam para um unico numero. O envio operacional deve sair somente pelo `5515991418416`.

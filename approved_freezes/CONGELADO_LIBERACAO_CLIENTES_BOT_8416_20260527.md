# Congelado - Liberacao do Bot 8416 para Clientes

Data: 2026-05-27

## Pedido

Liberar o celular `5515991418416` para atender clientes.

## Configuracao aplicada no VPS

Arquivo alterado:

- `/opt/vitalismen-automacao/current/.env`

Flags efetivas:

- `WHATSAPP_AUTO_REPLY_ENABLED=true`
- `WHATSAPP_AUTOMATION_PILOT_ONLY=false`
- `ZAPI_ROUTE_INBOUND_TO_BOT=true`
- `WHATSAPP_OUTBOUND_PROVIDER=hybrid`
- `WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS=`
- `ZAPI_OUTBOUND_ALLOWED_RECIPIENTS=`
- `WHATSAPP_EC_ONLY_INBOUND=true`
- `WHATSAPP_EC_ONLY_OUTBOUND=true`
- `ZAPI_CONNECTED_PHONE=5515991418416`
- `ZAPI_OPERATION_PHONE=5515991418416`

Protecoes mantidas:

- `ZAPI_OPERATIONAL_PHONE=5515998038637`
- `WHATSAPP_BLOCKED_RECIPIENTS=5515996218208,5515998038637`
- `WHATSAPP_BLOCKED_SESSION_IDS=5515996218208,5515998038637`

## Validacao

- App reiniciado com `pm2 restart vitalismen-automation --update-env`.
- `/health` respondeu `ok`.
- `/api/zapi/config` mostrou `connectedPhone=5515...8416`.
- Modo piloto desligado.
- Listas restritas de destinatarios foram esvaziadas.

## Bloqueio externo encontrado

A propria Z-API ainda respondeu:

- `connected=false`
- `session=false`
- `smartphoneConnected=false`
- `error=You are not connected.`

Ou seja: o bot esta liberado para atender clientes, mas a instancia Z-API atual ainda nao esta conectada ao WhatsApp.

Para o atendimento real iniciar, falta um destes pontos fora do codigo:

- conectar o WhatsApp `5515991418416` na instancia Z-API atual; ou
- trocar no `.env` as credenciais `ZAPI_INSTANCE_ID`, `ZAPI_INSTANCE_TOKEN` e `ZAPI_CLIENT_TOKEN` para a instancia Z-API correta do `8416`.

## Backup

- `/opt/vitalismen-automacao/backups/liberar-clientes-8416-20260528-022202`

## Status

Configuracao do bot aplicada e publicada no VPS.

Pendente externo: Z-API precisa ficar conectada.

# Congelado - Celular de Operacao do Bot 8416

Data: 2026-05-27

## Pedido

Padronizar o celular de operacao do bot para:

- `5515991418416`

## Alteracao aplicada no VPS

Arquivo alterado no servidor:

- `/opt/vitalismen-automacao/current/.env`

Configuracoes efetivas apos restart:

- `ZAPI_CONNECTED_PHONE=5515991418416`
- `ZAPI_OPERATION_PHONE=5515991418416`
- `WHATSAPP_DEFAULT_SESSION_ID=5515991418416`
- `WHATSAPP_SESSION_IDS=5515991418416`
- `WHATSAPP_ALLOWED_OUTBOUND_SESSION_IDS=5515991418416`
- `WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS=5515991418416,573183002800,3183002800,553183002800`
- `ZAPI_OUTBOUND_ALLOWED_RECIPIENTS=5515991418416,573183002800,3183002800,553183002800`

Numero legado mantido como bloqueado/protegido:

- `ZAPI_OPERATIONAL_PHONE=5515998038637`
- `WHATSAPP_BLOCKED_RECIPIENTS=5515996218208,5515998038637`
- `WHATSAPP_BLOCKED_SESSION_IDS=5515996218208,5515998038637`

## Validacao

- App `vitalismen-automation` reiniciado com `--update-env`.
- `/health` respondeu `ok`.
- `/api/zapi/config` mostrou `connectedPhone` mascarado como `5515...8416`.
- A VSL `/m/` ja estava abrindo WhatsApp para `5515991418416`.

## Observacao importante

A API da propria Z-API ainda respondeu que o dispositivo conectado na instancia atual e:

- `5515998038637`

Isso significa que a configuracao do bot/painel foi padronizada para `8416`, mas o envio real via Z-API so saira fisicamente pelo `8416` quando a instancia/dispositivo da Z-API tambem estiver conectada nesse numero ou quando as credenciais da instancia do `8416` forem usadas.

Enquanto isso, o `8037` permanece protegido como numero legado/operacional para nao virar cliente.

## Backup

- `/opt/vitalismen-automacao/backups/env-operacao-8416-20260528-020424`

## Escopo

Nao foi alterado:

- Observacao congelada
- VSL, exceto que ela ja estava apontando para `8416`
- Dropi
- planilhas
- historico de clientes

## Status

Configuracao aplicada, publicada no VPS e documentada.

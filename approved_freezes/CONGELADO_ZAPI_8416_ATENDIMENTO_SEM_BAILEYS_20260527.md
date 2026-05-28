# Congelamento - Z-API 8416 Atendimento Sem Baileys

Data: 2026-05-27

## Objetivo

Manter o celular `5515991418416` como numero de operacao para atendimento por Z-API, sem usar numero de cliente como sessao operacional e sem o Baileys tentar conectar esse mesmo numero em paralelo.

## Ajustes congelados

- `WHATSAPP_PAUSED_SESSION_IDS` ficou vazio no VPS, removendo o `5515991418416` da pausa interna.
- `WHATSAPP_CONNECT_ENABLED=false` no VPS, impedindo o motor Baileys local de disputar a sessao usada pela Z-API.
- `/api/zapi/device` agora usa atividade recente de webhook como fallback quando a Z-API responde falso negativo em `/device`.
- `/api/zapi/status` agora usa atividade recente de webhook como fallback quando a Z-API responde `connected:false`, mas webhooks recentes confirmam atividade real.
- O fallback usa `ZAPI_CONNECTED_PHONE` / `ZAPI_OPERATION_PHONE`, mantendo `5515991418416` como telefone operacional exibido.

## Evidencia verificada no VPS

- Backup antes/depois:
  `/opt/vitalismen-automacao/backups/zapi-webhook-fallback-baileys-off-20260528-023406`
- `/api/zapi/device` retornou `ok:true`, `fallback:true`, telefone `5515991418416` e atividade recente de webhook.
- `/api/zapi/status` retornou `ok:true`, `fallback:true`, telefone `5515991418416` e atividade recente de webhook.
- Logs confirmaram Baileys desativado por `WHATSAPP_CONNECT_ENABLED=false`.

## Observacao importante

O endpoint nativo `/status` da Z-API ainda devolveu `connected:false`, mas a propria instancia continuou enviando webhooks e registrando atividade real. Por isso o painel passa a considerar a integracao ativa quando existe webhook recente, evitando travar a operacao por falso negativo da API.

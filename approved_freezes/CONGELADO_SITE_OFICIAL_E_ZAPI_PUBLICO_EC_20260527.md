# CONGELADO_SITE_OFICIAL_E_ZAPI_PUBLICO_EC_20260527

Data: 2026-05-27

## Site oficial

Site oficial para trafego:

```text
https://ec.maxlien.shop/m/
```

Status verificado:
- `https://ec.maxlien.shop/m/` responde `200`.
- `https://ec.maxlien.shop/m` responde `200`.
- `chat.ec.maxlien.shop` nao resolve DNS e nao possui vhost Nginx ativo.

## Ajuste aplicado no VPS

Removida referencia operacional antiga:

```env
PUBLIC_BASE_URL=https://ec.maxlien.shop/m/
```

## Z-API liberada para publico do Equador

Configuracao aplicada:

```env
WHATSAPP_AUTO_REPLY_ENABLED=true
WHATSAPP_AUTOMATION_PILOT_ONLY=false
ZAPI_ROUTE_INBOUND_TO_BOT=true
WHATSAPP_OUTBOUND_PROVIDER=hybrid
WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS=
ZAPI_OUTBOUND_ALLOWED_RECIPIENTS=
WHATSAPP_EC_ONLY_INBOUND=true
WHATSAPP_EC_ONLY_OUTBOUND=true
```

Regra final:
- Cliente Ecuador `593...`: bot pode atender e responder via Z-API.
- Cliente Colombia `57...`: inbound pode ser identificado, mas outbound comercial fica bloqueado pelo filtro EC-only.
- Cliente Brasil/outros: bloqueado.

Validacao executada:

```text
593999123456@zapi -> allowed: true, reason: ok
573001234567@zapi -> allowed: false, reason: non_ec_recipient
5511999999999@zapi -> allowed: false, reason: non_ec_recipient
```

## Baileys

Baileys permanece desconectado por logout humano.

Decisao:
- Para trafego do site oficial, operar pela Z-API.
- Nao depender de reconexao Baileys para atendimento publico.
- Reconectar Baileys depois apenas se quiser manter canal paralelo/painel antigo.

## Observacao

Esta liberacao removeu o bloqueio de lista de teste para o publico do Equador, mantendo filtro de pais, dedupe, cadencia, spintax e travas do funil.

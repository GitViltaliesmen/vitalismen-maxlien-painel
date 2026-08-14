# Freeze EC aprovado - 20260626200518

Data UTC: 2026-06-26T20:05:18.577Z
Aprovacao: Aprovado: implantacao inicial do Freeze Lock EC

## Regras travadas neste momento

- panel_add_contact_button_fixed: Botao Adicionar cliente fica fixo e modal nao fecha por clique acidental no fundo.
- message_inline_hover_popup_disabled: Popup inline de estrategia sugerida nao abre ao passar o mouse em mensagens.
- panel_rate_limit_operational_writes: Salvar ficha, adicionar cliente e acoes operacionais do painel nao podem cair no rate limiter global.
- servientrega_agency_search_not_rate_limited: Busca de agencias Servientrega EC continua liberada da cota global.
- zapi_technical_alert_hidden_from_panel: Alertas tecnicos da Z-API nao aparecem como mensagens de cliente no painel.
- shipment_dispatch_8_per_hour: Lote operacional de avisos/rastreio EC fica em 8 por hora.

## Comandos executados

- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-status-panels-freeze.mjs`
- `node scripts/audit-customer-draft-zero-quantity.mjs`
- `node scripts/guard-public-funnel.mjs`

## Regra operacional

Qualquer mudanca que quebre uma regra ativa em `FREEZE_LOCK_EC.json` exige autorizacao escrita antes do deploy.

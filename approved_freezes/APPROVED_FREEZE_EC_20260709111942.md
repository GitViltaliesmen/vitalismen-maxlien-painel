# Freeze EC aprovado - 20260709111942

Data UTC: 2026-07-09T11:19:42.232Z
Aprovacao: Aprovado: congelar VSL /n Nitrix EC e marcacao de venda Facebook Purchase EC funcionando antes de corrigir painel

## Regras travadas neste momento

- panel_add_contact_button_fixed: Botao Adicionar cliente fica fixo e modal nao fecha por clique acidental no fundo.
- message_inline_hover_popup_disabled: Popup inline de estrategia sugerida nao abre ao passar o mouse em mensagens.
- panel_rate_limit_operational_writes: Salvar ficha, adicionar cliente e acoes operacionais do painel nao podem cair no rate limiter global.
- servientrega_agency_search_not_rate_limited: Busca de agencias Servientrega EC continua liberada da cota global.
- zapi_technical_alert_hidden_from_panel: Alertas tecnicos da Z-API nao aparecem como mensagens de cliente no painel.
- shipment_dispatch_8_per_hour: Lote operacional de avisos/rastreio EC fica em 8 por hora.
- vsl_nitrix_mobile_entry_ec: VSL /n do Equador permanece no funil Nitrix mobile aprovado, com desktop fora da VSL e entrada WhatsApp no telefone oficial.
- meta_pixel_lead_ec_dataset: Marcacao Facebook/Meta da VSL usa dataset EC correto, PageView/Lead deduplicados e CAPI EC sem token de outro pais.
- meta_purchase_confirmed_order_lock_ec: Venda/Purchase Facebook EC dispara somente em pedido confirmado, com valor positivo, moeda USD, produto EC e lock anti-duplicidade no painel.

## Comandos executados

- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-status-panels-freeze.mjs`
- `node scripts/audit-customer-draft-zero-quantity.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-ec-nitrix-guard.mjs`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/guard-public-funnel.mjs`

## Regra operacional

Qualquer mudanca que quebre uma regra ativa em `FREEZE_LOCK_EC.json` exige autorizacao escrita antes do deploy.

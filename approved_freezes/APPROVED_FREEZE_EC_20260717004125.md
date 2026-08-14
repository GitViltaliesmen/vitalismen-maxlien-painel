# Freeze EC aprovado - 20260717004125

Data UTC: 2026-07-17T00:41:25.316Z
Aprovacao: Aprovado: trocar VSL /n EC para teste AB VTurb mantendo caminho, CTA, Meta, painel e WhatsApp

## Regras travadas neste momento

- panel_add_contact_button_fixed: Botao Adicionar cliente fica fixo e modal nao fecha por clique acidental no fundo.
- message_inline_hover_popup_disabled: Popup inline de estrategia sugerida nao abre ao passar o mouse em mensagens.
- panel_rate_limit_operational_writes: Salvar ficha, adicionar cliente e acoes operacionais do painel nao podem cair no rate limiter global.
- servientrega_agency_search_not_rate_limited: Busca de agencias Servientrega EC continua liberada da cota global.
- zapi_technical_alert_hidden_from_panel: Alertas tecnicos da Z-API nao aparecem como mensagens de cliente no painel.
- shipment_dispatch_8_per_hour: Lote operacional de avisos/rastreio EC fica em 8 por hora.
- vsl_nitrix_mobile_entry_ec: VSL /n do Equador permanece no funil Nitrix mobile aprovado, com desktop fora da VSL e entrada WhatsApp no telefone oficial 8416, definido por configuracao e confirmado pela instancia Z-API conectada.
- meta_pixel_lead_ec_dataset: Marcacao Facebook/Meta da VSL usa dataset EC correto, PageView/Lead deduplicados e CAPI EC sem token de outro pais.
- meta_purchase_confirmed_order_lock_ec: Venda/Purchase Facebook EC dispara somente em pedido confirmado, com valor positivo, moeda USD, produto EC e lock anti-duplicidade no painel.
- site_entry_lead_panel_path_before_vsl_ab_ec: Antes do teste A/B de VSL, a entrada EC fica congelada no mesmo caminho: /n/ mobile, CTA WhatsApp/Z-API, Meta EC e Leads Clientes/Painel Unificado EC.
- vsl_ab_test_player_entry_phrases_ec: Teste A/B de VSL no /n/ EC usa somente o player VTurb AB aprovado e grava a variante com frase de entrada em espanhol no WhatsApp, painel, visita VSL e Meta Lead.
- ops_alerts_click_to_attend_ec: Alertas operacionais EC ficam clicaveis por cliente, abrem atendimento, registram baixa auditavel e nao contam retomada ja respondida por humano.
- customer_ficha_autosave_orderid_ec: Ficha do cliente EC preserva orderId/sourceOrderId e salva alteracoes manuais automaticamente sem perder rascunho durante refresh do painel.
- ops_alert_post_sale_reengagement_guard_ec: Alerta de retomada EC nao inclui telefone fora do Equador nem cliente que ja esta em pos-venda/pedido ativo.
- panel_product_autodetect_customer_draft_ec: Painel EC auto-seleciona Nitrix/Vit Power por pedido ativo ou mencao explicita e registra produto correto na ficha.
- panel_real_entry_metrics_ec: Painel EC usa total real de clientes e entradas VSL/WhatsApp nas metricas, sem depender do limite de conversas carregadas.
- manual_funnel_text_send_direct_ec: Textos do funil manual EC, incluindo Oferta, sao enviados diretamente ao clicar Enviar e nao ficam como rascunho.
- panel_chat_entry_time_badge_ec: Lista e cabecalho do painel EC mostram horario de primeira entrada do cliente e se ele e novo hoje ou antigo.

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

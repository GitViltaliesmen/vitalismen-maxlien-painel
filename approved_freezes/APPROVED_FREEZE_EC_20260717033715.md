# Freeze EC aprovado - 20260717033715

Data UTC: 2026-07-17T03:37:15.912Z
Aprovacao: Aprovado: funil inicial Nitrix EC completo, pos-fechamento ativo e teste 2958 validado

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
- vsl_manual_test_2958_skipmeta_ec: Telefone 2958 fica liberado somente como teste manual da VSL EC, com skipMeta/testEntry/testLead, sem transformar numero BR em cliente real nem trocar vendedor oficial 8416.
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

## Evidencia operacional aprovada

- Dominio validado: `https://ec.maxlien.shop/n/`.
- Painel validado: `https://ec.maxlien.shop/qr.html`.
- Z-API validada no telefone oficial EC `5515991418416`.
- Teste manual limpo no 2958 usou `https://ec.maxlien.shop/n/?showForm=1&allowTestPhone=2958`.
- Variante AB observada: `b`.
- Frase de entrada registrada no painel: `Hola, deseo recibir mas informacion sobre el producto.`
- Fluxo persistido em `nitrix_ec.fastState.entryLayer=full_sequence`.
- Jobs enviados e gravados no painel:
  - `opening_text`: texto inicial de Valeria.
  - `audio_01`: `NITRIX_INICIO_01_VALERIA_ZAMBRANO_UNIVERSAL`.
  - `audio_02`: `NITRIX_INICIO_02_VALERIA_ZAMBRANO_UNIVERSAL`.
  - `name_intro`: identificacao curta de Valeria e pedido de nome.
  - `proof`: prova social `social_02`.
  - `bottle`: frasco `/media/sales/ec/nitrix_bottle.png`.
- Estado final do teste: `waiting_bottle_confirmation`.
- Pergunta final enviada: `¿Es este el producto que desea?`
- Primeira tentativa de teste identificou bloqueio apenas do numero de QA por `strict_duplicate_audio`; o dedupe antigo do 2958 foi limpo com backup e a segunda rodada completou a sequencia.

## Backups operacionais

- `/root/codex_deploy_backups/ec-enable-post-close-notices-20260717_032005`
- `/root/codex_deploy_backups/ec-enable-real-postclose-pilot-off-20260717_032134`
- `/root/codex_deploy_backups/ec-reset-2958-with-dedupe-20260717T033244Z`

## Regras de ambiente congeladas

- `NITRIX_FAST_STATE_ENABLED=true`
- `NITRIX_FAST_STATE_ROLLOUT_MODE=full`
- `NITRIX_FAST_STATE_ENTRY_LAYER=full_sequence`
- `POST_SALE_REPURCHASE_30D_ENABLED=true`
- `SHIPMENT_STATUS_DISPATCH_ENABLED=true`
- `SHIPMENT_PICKUP_REMINDERS_ENABLED=true`
- `SHIPMENT_GUIDE_PRINT_DISPATCH_ENABLED=true`
- `SHIPMENT_CARRIER_STATUS_SWEEP_ENABLED=true`
- `DROPPI_EC_ACTIVE_SYNC_ENABLED=true`
- `WHATSAPP_AUTOMATION_PILOT_ONLY=false`
- `WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false`
- `PENDING_CHECKOUT_FOLLOWUP_ENABLED=false`
- `ADMIN_BUY_LATER_FOLLOWUP_ENABLED=false`
- `WHATSAPP_BACKLOG_RECOVERY_ENABLED=false`

## Regra operacional

Qualquer mudanca que quebre uma regra ativa em `FREEZE_LOCK_EC.json` exige autorizacao escrita antes do deploy.

Depois da entrada inicial Nitrix EC, a automacao deve parar em confirmacao do frasco ou responder ao cliente se ele escrever no meio do processo. Follow-up pre-venda permanece desligado; a retomada automatica aprovada e somente pos-fechamento, envio, retirada, devolucao, bonus e recompra pos-venda.

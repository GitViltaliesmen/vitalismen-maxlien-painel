# Freeze EC - Z-API, Funil, Servientrega e Cobranca Dropi

Data: 2026-06-26
Escopo: Equador / Vit Power / Funil Fast State EC / Painel qr.html / Z-API / Servientrega / Dropi

## Resumo congelado

- Alertas tecnicos do Z-API watchdog deixam de virar bolha visivel no painel.
- Novos eventos do watchdog ficam como evento tecnico oculto, sem alterar `lastInboundText` como fala do cliente e sem adicionar etiqueta visual nova.
- Mensagens antigas de alerta continuam no banco para auditoria, mas as rotas/lista/conversa do painel filtram `zapi_chat_watchdog` e corpo `ALERTA: o WhatsApp conectado...`.
- Funil agora trava contexto comercial antes de responder quando ja existe pedido/remessa ativa ou entregue.
- Aviso de retirada Servientrega fica mais claro com `*PEDIDO LISTO PARA RETIRO*`, guia em destaque, agencia e documento.
- Caption de guia/fatura PDF agora sempre explica o contexto do arquivo.
- Ciclo de status consulta Servientrega direto antes de decidir aviso/cobranca; se Dropi falhar, Servientrega continua rodando.
- Cobranca Dropi para 8637 so dispara quando Servientrega constar entregue/retirado e Dropi ainda nao estiver verde. Se Dropi ficar verde depois, avisa resolvido somente se existia cobranca previa.
- Agencia corrigida para `SAN MIGUEL DE LOS BANCOS/PICHINCHA`; `Sucua/Sucua` validado no guard.

## Arquivos alterados

- `public/qr.html`
- `src/routes/whatsapp.js`
- `src/routes/zapi.js`
- `src/services/agentRouter.js`
- `src/services/conversationEngine.js`
- `src/services/shipmentMessageService.js`
- `src/services/shipmentStatusDispatcherService.js`
- `src/services/servientregaEcuadorAgencyService.js`
- `src/services/zapiChatWatchdogService.js`
- `src/services/schedulerService.js` somente local para alinhamento do watchdog; no VPS nao foi sobrescrito para preservar camadas de producao.

## Deploy e backup

- VPS: `/opt/vitalismen-automacao/current`
- PM2: `vitalismen-automation`
- Backup remoto antes do deploy:
  - `/opt/vitalismen-automacao/backups/codex_zapi_funil_servientrega_20260626_152853`
- Observacao: `shipmentMessageService.js` do VPS tinha exports de producao (`ensureGuidePrintImage`, `notifyGuidePrintImage`). Ele foi preservado e atualizado cirurgicamente; a copia local foi alinhada para nao reintroduzir regressao em deploy futuro.

## Evidencias de producao

- Health local VPS `http://127.0.0.1:3001/api/health`: `200 OK`, Z-API conectado.
- Dominio `https://ec.maxlien.shop/qr.html`: `200 OK`.
- PM2: `vitalismen-automation online`, `unstable restarts 0`.
- Agencias:
  - Quito retorna `200` e agencias.
  - `SAN MIGUEL DE LOS BANCOS` retorna `Los Bancos Principal / Pichincha`.
  - `Sucua/Sucua` retorna `Sucua Principal / Morona Santiago`.
- Auditoria seca sem envio real:
  - final `5245`: pedido `EC-MQSCC6XV-4OBY`, guia `185543824`, status `ENTREGADO`; nao cobra Dropi.
  - final `4263/64263`: pedido `EC-MQOP97E1-9H7D`, guia `185528969`, status `READY_FOR_PICKUP`.
  - final `1066`: pedido `EC-MQOKJKVS-VN1N`, guia `185530583`, status `READY_FOR_PICKUP`.
  - final `8637`: numero de aviso/teste sem pedido ativo.
  - alertas tecnicos visiveis apos filtro: `0` para 5245, 4263, 64263, 1066 e 8637.

## Testes executados

- `node --check` nos arquivos alterados: OK.
- `node scripts/senior-guard.mjs`: OK.
- `node scripts/guard-status-panels-freeze.mjs`: OK.
- `node scripts/audit-customer-draft-zero-quantity.mjs`: OK, 23 verificacoes.
- `node scripts/eval-observer-attentive-reader.mjs`: OK.
- `node scripts/audit-funil-context-rules.mjs`: OK.
- `node scripts/guard-public-funnel.mjs`: OK, 0 avisos, inclui VPS/PM2/nginx/API.

## Observacoes e riscos

- `npm` nao estava disponivel no shell local do Codex; os scripts foram executados diretamente via `node`, que e o comando real chamado pelos scripts do `package.json`.
- A sessao Dropi browser apareceu expirada no log (`storage state quarantined: expired`). A correcao evita que isso bloqueie Servientrega, mas o login Dropi ainda deve ser renovado para sincronismo completo do painel Dropi.
- Mensagens antigas de alerta nao foram apagadas do banco. Elas ficam ocultas no painel por filtro.
- O ciclo permanece em 60 minutos e lote 3, conforme decisao aprovada; nao e tempo real.
- O watchdog novo nao cria etiqueta visual nova, mas estados antigos ainda podem ter tags historicas ate uma limpeza/migracao explicita.

## Freeze operacional da camada

Data/hora do congelamento operacional: 2026-06-26.

- Camada anterior publicada e congelada como funcional.
- Estado em producao: `vitalismen-automation` online, Z-API conectada, `unstable restarts 0`.
- Configuracao real do ciclo de status:
  - `SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES=60`.
  - `SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT=3`.
  - `SHIPMENT_STATUS_DISPATCH_ADAPTIVE_ENABLED=true`.
  - `SHIPMENT_STATUS_DISPATCH_ACTIONS=guide,in_transit,ready_for_pickup,returned,delivered_bonus`.
- Regra adaptativa confirmada no codigo:
  - ate 24 pendentes: lote 3;
  - a partir de 25 pendentes: lote 5;
  - a partir de 60 pendentes: lote 8.
- Avaliacao operacional:
  - para trafego atual/fraco, 60 minutos com lote adaptativo cobre bem os avisos sem pressionar WhatsApp/Z-API;
  - para meta de 40 pedidos/dia, a configuracao continua utilizavel, mas nao e garantia matematica de zero atraso se o backlog de retirada/guia/entrega acumular;
  - se a fila passar de 25 pendentes com frequencia, a proxima menor mudanca recomendada e reduzir intervalo para 30 minutos ou aumentar lote base para 5, mantendo anti-duplicidade e limites por sessao.

## Ajuste operacional 8 por hora

Data/hora do ajuste: 2026-06-26.

- Decisao: aumentar a capacidade de status/avisos para ate 8 por hora, mantendo intervalo de 60 minutos.
- Configuracao aplicada:
  - `SHIPMENT_STATUS_DISPATCH_BATCH_LIMIT=8`.
  - `SHIPMENT_STATUS_DISPATCH_INTERVAL_MINUTES=60`.
  - `SHIPMENT_STATUS_DISPATCH_ADAPTIVE_ENABLED=true`.
  - teto adaptativo permanece `max=8`.
- Ritmo humano preservado:
  - `WHATSAPP_HUMAN_PACING_ENABLED=true`.
  - `WHATSAPP_HUMAN_PACING_MIN_MS=2600`.
  - `WHATSAPP_HUMAN_PACING_MAX_MS=11000`.
  - `SHIPMENT_MIN_MESSAGE_GAP_MS=1800000` por cliente.
- Interpretacao operacional:
  - o sistema envia no maximo 8 pendencias por ciclo, nao 8 mensagens obrigatorias;
  - se houver 2 pendencias reais, envia 2;
  - se houver fila acumulada, limpa ate 8 por hora;
  - os tempos de envio continuam variaveis, sem padronizar todos no mesmo intervalo.
- Backup do `.env` remoto antes do ajuste:
  - `/opt/vitalismen-automacao/backups/env_before_dispatch_8h_20260626_155529.env`
- Validacao apos restart:
  - PM2 `vitalismen-automation` online;
  - health local `http://127.0.0.1:3001/api/health` OK;
  - Z-API conectada.

## Auditoria de avisos, guia, fatura/print e bonus

Data/hora da auditoria: 2026-06-26.
Modo: leitura em producao, sem disparo real.

Numeros auditados:

- `988144779` / `EC-MQMIZ2U7-LTYL` / guia `185529016` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: FALTA.
  - Print da fatura/guia: FALTA.
  - Bonus: nao devido ainda, pois nao consta entregue/retirado.
- `959678914` / `EC-MQUHLY93-UDJ8` / guia `185551475` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: OK.
  - PDF/fatura: OK.
  - Print da fatura/guia: OK.
  - Bonus: nao devido ainda.
- `993210059` / `EC-MQRL6GWN-N5S6` / guia `185541911` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: OK.
  - PDF/fatura: falhou no envio registrado (`send_failed`).
  - Print da fatura/guia: OK.
  - Bonus: nao devido ainda.
- `963636646` / `EC-MQPE5V1U-1S73` / guia `185531271` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: OK.
  - PDF/fatura: sem registro de envio.
  - Print da fatura/guia: OK.
  - Bonus: nao devido ainda.
- `980379323` / `EC-MQP95Q1I-GBYM` / guia `185530197` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: OK.
  - PDF/fatura: sem registro de envio.
  - Print da fatura/guia: OK.
  - Bonus: nao devido ainda.
- `992364263` / `EC-MQOP97E1-9H7D` / guia `185528969` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: OK.
  - PDF/fatura: sem registro de envio.
  - Print da fatura/guia: OK.
  - Bonus: nao devido ainda.
- `967971066` / `EC-MQOKJKVS-VN1N` / guia `185530583` / `READY_FOR_PICKUP`
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: OK.
  - PDF/fatura: sem registro de envio.
  - Print da fatura/guia: OK.
  - Bonus: nao devido ainda.

Varredura geral EC:

- Remessas com guia/status auditadas: 15.
- Sem aviso de guia: 3 pedidos antigos/importados.
- Sem aviso de retirada: 3 pedidos antigos/importados.
- Entregue/retirado sem bonus: 1 pedido (`EC-MQSCC6XV-4OBY`, Gregorio Ventura, final `5245`).
- Sem fonte de fatura/PDF: 7.
- Sem evento de PDF/fatura enviado: 14.
- Sem print da fatura/guia: 7.

Conclusao operacional:

- A camada nova de aviso esta montando texto com numero de guia e print quando existe fonte de fatura.
- O maior buraco atual esta nos pedidos antigos/importados sem `invoiceUrl`/`invoicePath`, que impedem PDF e print.
- Bonus deve disparar somente quando status ficar `ENTREGADO`/retirado; nos numeros auditados em `READY_FOR_PICKUP`, bonus ainda nao e devido.
- Ha um caso entregue sem bonus pendente: Gregorio Ventura (`EC-MQSCC6XV-4OBY`, final `5245`).

## Congelamento extra: finais 22572/95286 e botao Adicionar cliente

Data/hora: 2026-06-26 16:14 -03.

Escopo:

- Auditoria de producao dos finais `22572` e `95286`, sem disparo real.
- Correcao pequena no painel para o botao `Adicionar` cliente e modal de novo contato.

Resultado da auditoria:

- `22572` encontrado:
  - Pedido: `EC-MQK8ELKZ-ZXZS`.
  - Cliente: Isidro isidoro solis yepez.
  - Guia: `185519919`.
  - Status: `READY_FOR_PICKUP`.
  - Aviso de guia: OK.
  - Aviso de retirada: OK.
  - Fonte de fatura/PDF: FALTA.
  - Print da fatura/guia: FALTA.
  - Bonus: nao devido ainda, pois nao consta entregue/retirado.
- `95286` nao encontrado:
  - Sem match em remessas, pedidos ou mensagens recentes.

Correcao aplicada:

- Arquivo alterado: `public/qr.html`.
- O botao `Adicionar` cliente recebeu largura fixa para nao encolher/sumir na barra de busca.
- O modal `Novo cliente` nao fecha mais por clique acidental no fundo; ele fecha por `Fechar`, `Cancelar` ou automaticamente apos `Adicionar` com sucesso.

Backup de producao:

- `/opt/vitalismen-automacao/backups/codex_new_contact_modal_20260626_161352/qr.html`

Publicacao:

- `public/qr.html` copiado para `/opt/vitalismen-automacao/current/public/qr.html`.
- Validado por HTTP em `https://ec.maxlien.shop/qr.html`.

Testes/guards:

- `node scripts/guard-status-panels-freeze.mjs`: OK.
- `node scripts/audit-customer-draft-zero-quantity.mjs`: OK, 23 verificacoes.
- `node scripts/guard-public-funnel.mjs`: OK, 0 avisos.

Risco residual:

- O `22572` precisa de recuperacao/associacao da fonte de fatura/print se voce quiser reenviar comprovante visual; a camada de aviso esta OK, mas esse pedido antigo/importado nao tem a fonte anexada.
- O `95286` pode estar com outro telefone/codigo, pois nao apareceu pelo final informado.

## Congelamento extra: rate limit da ficha e popup inline de mensagem

Data/hora: 2026-06-26 16:51 -03.

Problema:

- O botao `Adicionar` ficou aprovado, mas algumas escritas do painel ainda podiam cair no rate limiter global e mostrar `Too many requests, please try again later.`.
- A bolha flutuante `Estrategia sugerida` voltava ao passar o mouse em mensagens do cliente e atrapalhava a operacao.

Correcao aplicada:

- Arquivos alterados:
  - `src/index.js`.
  - `public/qr.html`.
- `src/index.js`:
  - `POST /api/whatsapp/contacts` liberado como escrita operacional do painel.
  - `POST /api/whatsapp/chats/action` liberado como escrita operacional do painel.
  - Escritas administrativas de status/revisao em `orders` e `shipments` liberadas para nao serem bloqueadas pela cota consumida pelo proprio painel.
  - Envio livre de WhatsApp (`/api/whatsapp/send`) nao foi liberado nesta regra.
- `public/qr.html`:
  - `inlineMessageObserverHintsEnabled = false`.
  - `renderMessageObserverHint` nao renderiza mais a bolha inline.
  - `openObserverHintForBubble` retorna sem abrir bolha.
  - Gatilho `mouseover` do painel de mensagens removido.
  - Cópia/uso manual por clique/dados da ficha foi preservado.

Backup de producao:

- `/opt/vitalismen-automacao/backups/codex_rate_limit_popup_20260626_165020/index.js`
- `/opt/vitalismen-automacao/backups/codex_rate_limit_popup_20260626_165020/qr.html`

Publicacao:

- `src/index.js` e `public/qr.html` copiados para `/opt/vitalismen-automacao/current/`.
- PM2 `vitalismen-automation` reiniciado.
- Health local `http://127.0.0.1:3001/api/health`: OK, Z-API conectada.
- `https://ec.maxlien.shop/qr.html` validado com `inlineMessageObserverHintsEnabled = false` e sem listener `mouseover`.
- `POST /api/whatsapp/contacts` respondeu erro normal de validacao (`400`) em vez de `429`, confirmando que nao caiu no rate limiter global.

Testes/guards:

- `node --check src/index.js`: OK.
- `node scripts/guard-status-panels-freeze.mjs`: OK.
- `node scripts/audit-customer-draft-zero-quantity.mjs`: OK, 23 verificacoes.
- `node scripts/guard-public-funnel.mjs`: OK, 0 avisos.

Risco residual:

- O popup inline foi desligado por chave fixa e gatilho de mouse removido, mas o codigo antigo do Observador ainda existe para o laboratorio/analise interna. Se algum deploy antigo sobrescrever `public/qr.html`, a bolha pode voltar; por isso esta correcao foi aplicada no arquivo fonte local e no VPS atual.
- Se ainda aparecer `Too many requests` ao salvar, a proxima verificacao deve identificar o endpoint exato no DevTools/Network, pois os caminhos principais de ficha/cliente/status agora estao fora da cota global.

# Arquivos oficiais e fonte de verdade

## Microcamada V40 — fila interna de relacionamento EC (2026-08-22)

- Contrato: `docs/EC_ENGAGEMENT_INTERNAL_BUCKET_FREEZE_V40_20260822.md`.
- Estado e memória únicos: `src/models/ContactState.js`.
- Classificador determinístico: `src/services/ecConversationBucketService.js`.
- Resposta local somente após inbound: `src/services/ecEngagementReplyService.js`.
- Entrada oficial Z-API: `src/routes/zapi.js`.
- API/painel oficial: `src/routes/whatsapp.js` e `public/qr.html`.
- Auditoria sem escrita: `scripts/audit-ec-engagement-readonly.mjs`.
- Guard: `scripts/guard-ec-engagement-v40.mjs`.
- Testes: `tests/ec-engagement-buckets-v40.test.mjs`.
- Não existe arquivo, processo, banco ou integração com o projeto externo de
  aquecimento; o rótulo `AQUECIMENTO` é apenas uma fila visual do painel oficial.
- Nenhuma migração em massa ou mensagem real faz parte da implementação/teste.

Regra geral: antes de mexer em qualquer fluxo, primeiro localizar, ler e confirmar o arquivo oficial. Copias temporarias servem apenas para comparar ou preparar patch, nunca como fonte final.

## Regra obrigatoria

1. Identificar o ambiente oficial do fluxo.
2. Ler o arquivo oficial atual.
3. Se estiver no VPS, fazer backup antes de substituir.
4. Aplicar alteracao pequena.
5. Validar no endpoint/URL oficial.
6. Registrar resultado.

## VPS

- Host: `root@maxlien.shop`
- Chave: `~/.ssh/vps_auditoria_codex`
- O VPS tem prioridade sobre qualquer copia local quando o assunto for site, VSL, checkout, painel online e arquivos em producao.

## Mapa atual

### VSL / checkout Equador

- URL oficial: `https://maxlien.shop/m/`
- QA com formulario aberto: `https://maxlien.shop/m/?showForm=1`
- Arquivo oficial no VPS: `/var/www/ec.maxlien.shop/m/index.html`
- JSON publico de mensagens CTA: `/var/www/ec.maxlien.shop/cta-vit-power-messages.json`
- Copia local de preparacao: `.codex-tmp/vps-vsl/maxlien-m-index.html`
- Ultimo backup conhecido antes do ajuste de mensagens CTA:
  - `/root/codex_deploy_backups/maxlien-m-index-before-cta-messages-20260506-030628.html`
- Ultimo ajuste oficial:
  - 2026-05-24: reduziu atrito da entrada WhatsApp da VSL. O campo `Nombre completo` continua sendo enviado quando preenchido, mas a pagina nao bloqueia mais visitantes que digitam apenas primeiro nome. Motivo: trafego novo estava parando antes de abrir WhatsApp apos a atualizacao do funil Vit Power 2026.
  - Backup feito no VPS antes do ajuste: `/root/codex_deploy_backups/maxlien-m-index-before-name-friction-20260524-*.html`
  - 2026-05-06: formulario recebeu `Punto de referencia`, quantidade ficou em `1/3/6`, e a mensagem WhatsApp passou a enviar `Punto de referencia`.
  - Backup feito no VPS antes do ajuste: `/root/codex_deploy_backups/maxlien-m-index-before-reference-field-20260506-*.html`
- Validacao obrigatoria:
  - `curl -sL 'https://maxlien.shop/m/?showForm=1'`
  - confirmar `INITIAL_CTA_MESSAGES`
  - confirmar `pickInitialCtaMessage() + "\\n\\n"` no `const msg`
  - confirmar `name="reference"` e `Punto de referencia:`

### Bot / automacao WhatsApp local

- Pasta local oficial: `/Users/greson/Documents/Vitalismen Automacao`
- Entrada do painel local: `http://127.0.0.1:3001/qr.html`
- Funil inicial e deteccao de CTA:
  - `src/services/initialFunnelTriggers.js`
  - `src/services/conversationEngine.js`
  - `src/services/agentRouter.js`
- Processo oficial congelado:
  - `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`
- Ritmo humano do funil:
  - `INITIAL_FUNNEL_AFTER_AUDIO_MIN_MS/MAX_MS`
  - `INITIAL_FUNNEL_AFTER_IMAGE_MIN_MS/MAX_MS`
  - `INITIAL_FUNNEL_BEFORE_PRICE_MIN_MS/MAX_MS`
- Audios aprovados EC:
  - `public/media/templates/EC/PERGUNTA_AGENCIA_DOMICILIO.ogg`
  - `public/media/templates/EC/ENDERECO_CIDADE_PROVINCIA_AGENCIA.ogg`
  - `public/media/templates/EC/Agradecimento_Agencia_01.ogg`
  - `public/media/templates/EC/BONUS_RETIRADA.ogg`
  - `public/media/templates/EC/CONFIRMACION_Y_REGALITO_ESPECIAL.ogg`
  - `public/media/templates/EC/Chegou_01.ogg`
  - `public/media/templates/EC/Chegou_02.ogg`
  - `public/media/templates/EC/Chegou_03.ogg`

### Dropi Equador

- Servico principal local:
  - `src/services/droppiEcuadorBrowserService.js`
  - `src/services/droppiEcuadorService.js`
  - `src/routes/shipments.js`
  - `public/qr.html`
- Estado validado: fluxo para em `dropi_payment_required` quando nao ha saldo.
- Nao refazer esse fluxo do zero.

### Painel integrado local

- Entrada oficial local: `http://127.0.0.1:3001/`
- Redireciona para: `/qr.html`
- Arquivo principal: `public/qr.html`
- Baseline EC integrada congelada em:
  - `docs/BASELINE_EC_INTEGRADA_2026-06-12.md`
  - `public/qr.html`
  - `public/leads-window.html`
- Ajuste operacional autorizado em 2026-07-26:
  - `public/leads-window.html` preserva o status atual do lead quando um pedido operacional antigo ainda estiver como `confirmed`;
  - estados `atendendo`, `pedido_enviado`, `entregue`, `finalizado`, `cancelado` e `devolvido` não podem voltar visualmente para `confirmado`;
  - pedidos efetivamente enviados permanecem acessíveis pelo filtro `pedido_enviado`;
  - ao receber confirmação de envio da Dropi, `public/leads-window.html` atualiza `_opsStatus` e notifica imediatamente o painel integrado com `vitalismen:lead-status-updated`;
  - a extensão local v0.11.4 consulta `/api/whatsapp/chats?country=EC&fast=1` a cada 3,5 segundos e reconhece `processing`/`submitted` como `pedido_enviado`, mantendo a ficha aberta alinhada sem recarregar a página;
  - teste de regressão: `tests/leads-window-status-merge.test.cjs`;
  - backup anterior no VPS: `/opt/vitalismen-automacao/backups/leads-window-before-status-view-20260727003734.html`.

### Extensao Chrome WhatsApp oficial

- Fonte oficial versionada:
  - `extensions/vitalismen-whatsapp-official`
- Copia local carregada sem compactacao no Chrome deste computador:
  - `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\CARREGAR_ESTA_PASTA_FUNIL_FLUTUANTE_V051`
- Versao oficial em 2026-07-27: `0.11.5`.
- A fonte versionada e a copia carregada foram conferidas por SHA-256, excluindo apenas `node_modules`.
- O ajuste `0.11.5` libera o clique humano em `Enviar completo` sem o conflito do evento do elemento expansivel e valida novamente a conversa ativa antes de cada etapa.
- A extensao nunca deve enviar o funil automaticamente; o envio completo continua exigindo clique humano.
- `node_modules`, tokens, senhas, arquivos `.env` e diagnosticos locais nao fazem parte da fonte versionada.
- O deploy da aplicacao publica inclui esta fonte para auditoria e recuperacao, mas o Chrome executa a copia local carregada sem compactacao. Depois de atualizar a copia local, e obrigatorio clicar em `Atualizar` na extensao em `chrome://extensions`.
- Release local preparada em 2026-08-14: `0.13.5`, com padronização de nome/cidade/província e bloqueio de sugestões de agências fora de uma cidade confirmada.
- Registro técnico e rollback: `docs/EXTENSAO_PADRONIZACAO_DADOS_EC_20260814.md`.

## Como trabalhar com copia temporaria

### Microcamada V17 — 2026-08-17

- Fonte lida antes da alteracao: release `/opt/vitalismen-automacao/releases/20260817T022344Z_production-20260816-e0e2c54`, commit `e0e2c548be9aeecf076fc5b5ec2a1405f0e0e0e0`.
- Fonte Git oficial confirmada: branch `production` e tag `production-20260816-e0e2c54` no GitHub oficial.
- Arquivos oficiais da mudanca: `src/routes/whatsapp.js`, `src/routes/zapi.js`, `src/routes/observation.js`, `public/qr.html`, `src/services/ecuadorProductService.js`, `src/services/droppiEcuadorBrowserService.js`, `src/services/metaConversionsService.js`, `src/routes/orders.js` e `src/routes/leads.js`.
- Freeze/rollback: `docs/PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_V17_20260817.md`.
- Escopo: autenticar dados operacionais sensiveis e impedir fallback silencioso de produto; sem preco, funil, envio, scheduler, schema ou migracao de banco.
- A validacao de producao deve registrar aqui o novo release, tag, health e PM2 depois da ativacao.

### Microcamada V18 — 2026-08-17

- Evidencia real: Dropi aceitou manualmente Santa Elena/Santa Elena e Orellana/El Coca usando os dados persistidos pelo bot.
- Causas confirmadas: sessao vencida mascarada por token antigo em El Coca; correspondencia por sufixo escolheu `El Tambo Santa Elena` no envio automatico de Santa Elena.
- Arquivo oficial alterado: `src/services/droppiEcuadorBrowserService.js`.
- Teste sem envio externo: `tests/dropi-automatic-submit-regression.test.mjs`.
- Freeze/rollback: `docs/DROPI_AUTOMATIC_SUBMIT_RELIABILITY_FREEZE_V18_20260817.md`; o rollback funcional permanece no commit V17 `5b7f823670cad8a650af644d1f03f88c0708e85c` enquanto a V18 nao for ativada.
- Preservado: produto, precos, funil, autorizacao manual, deduplicacao, scheduler, WhatsApp, Meta/CAPI, schema e memoria de pedidos.
- A validacao de producao deve acrescentar release, tag, health, `pm_cwd` e `pm_exec_path` somente depois da ativacao real.

### Microcamada V19 — 2026-08-17

- Evidencia real: pedido `EC-MSWR401B-KNHS`, final `6060`, aceito pela Meta com `events_received: 1`; leads duplicados `3382` e `3383` possuem o mesmo `event_id` persistido como `sent`.
- Causa confirmada: a mesclagem por telefone vinculava o pedido operacional a somente uma linha e a API de flags ignorava `purchase_capi_lock`, produzindo o falso rotulo `Meta offline` na outra.
- Arquivos oficiais alterados: `src/routes/shipments.js` e `public/leads-window.html`.
- Teste sem envio externo: `tests/meta-purchase-panel-linkage.test.mjs`.
- Freeze/rollback: `docs/META_PURCHASE_PANEL_LINKAGE_FREEZE_V19_20260817.md`; rollback funcional no commit V18 `7fc27b43f0aacc1777f89a11d46353f862beda26` enquanto a V19 nao for ativada.
- Preservado: endpoint Meta/CAPI, `event_id`, `tracking.metaPurchaseSentAt`, payload, pixel, Dropi V18, produto, precos, funil, scheduler, WhatsApp, schema e memoria.
- A validacao de producao deve acrescentar release, tag, health, `pm_cwd`, `pm_exec_path` e conferencia visual do final `6060` somente depois da ativacao real.

### Microcamada V20 — 2026-08-17

- Origem: revisao final local dos commits V17 `5b7f823`, V18 `7fc27b4` e V19 `fe7d4ca`, sem alteracao desses commits historicos.
- Riscos corrigidos: estado operacional em criacao publica de pedido, resolucao permissiva de produto conflitante e rascunho promovido para `pending` sem produto EC explicito.
- Arquivo funcional alterado: `src/routes/orders.js`.
- Testes sem envio externo: `tests/review-v17-v19-p1.test.mjs`, `tests/order-public-product-integrity-v20.test.mjs` e a regressao preservada `tests/meta-purchase-panel-linkage.test.mjs`.
- Freeze/guard: `docs/ORDER_PUBLIC_PRODUCT_INTEGRITY_FREEZE_V20_20260817.md`, `docs/freeze/order-public-product-integrity-v20-20260817.json` e `scripts/guard-order-public-product-integrity-v20.mjs`.
- Estado: candidato validado, nao publicado; nenhuma branch remota, PR, producao, PM2 ou symlink foi alterado nesta preparacao.
- Preservado: V17, Dropi V18, painel Meta V19, produto/precos, funil, scheduler, WhatsApp, schema, memoria e autorizacao humana Dropi.
- A validacao de producao deve ser registrada somente depois de autorizacao separada e ativacao real.

### Microcamada V21 — 2026-08-17

- Fonte base: commit de producao `3b6adfb081f2391262e7b356d47473013e071cc7` em worktree isolado; producao nao foi alterada.
- Painel oficial alterado: `public/qr.html`; o backend V16 de contexto permanece versionado, mas o bloco tecnico nao e montado na ficha principal.
- Chamada oficial: `src/services/callAutoReplyPolicy.js`, `src/services/callAutoReplySafetyService.js`, `src/models/CallAutoReplyState.js`, `src/routes/zapi.js` e `src/whatsapp/connection.js`.
- Dropi oficial: `src/services/droppiEcuadorService.js` passa a usar `src/services/dropiDataNormalizationService.js` e o catalogo `src/services/servientregaEcuadorAgencyService.js` antes do formulario.
- Teste sem envio externo: `tests/panel-call-dropi-safety.test.mjs`.
- Freeze/guard: `docs/PANEL_CALL_DROPI_SAFETY_FREEZE_V21_20260817.md`, `docs/freeze/panel-call-dropi-safety-v21-20260817.json` e `scripts/guard-panel-call-dropi-safety-v21.mjs`.
- Estado: candidato local, nao publicado; resposta de chamada desligada por padrao; nenhuma mensagem, pedido Dropi, evento Meta, branch remota, PR, release, PM2 ou symlink foi alterado.
- Rollback funcional: retornar ao commit `3b6adfb081f2391262e7b356d47473013e071cc7`; nenhuma migracao destrutiva de banco e necessaria.

### Microcamada V22 — 2026-08-18

- Fonte base: commit ativo `46a81f5fe5f0dc89cc41353ae5eacefce08e82a5`, copiado para o worktree isolado `/home/codex/worktrees/vitalismen-tex-ultra-entry-unread-20260818`; producao nao foi alterada.
- Abertura Tex Ultra: `src/services/texUltraProductProfile.js`, `src/services/texUltraEntryGreetingService.js`, `src/services/texUltraInitialLayerService.js` e `src/services/texUltraFunnelService.js`.
- Leitura do painel: `src/services/panelReadStateService.js`, `src/routes/whatsapp.js` e `public/qr.html`.
- Testes sem envio: `tests/tex-ultra-entry-unread-v22.test.mjs`, `tests/whatsapp-chat-read-persistence-v22.test.mjs`, `scripts/test-tex-ultra-initial-cadence.mjs` e `scripts/test-tex-ultra-initial-concurrency.mjs`.
- Freeze/guard: `docs/TEX_ULTRA_ENTRY_UNREAD_FREEZE_V22_20260818.md`, `docs/freeze/tex-ultra-entry-unread-v22-20260818.json` e `scripts/guard-tex-ultra-entry-unread-v22.mjs`.
- Audio candidato: `public/media/templates/EC/CONHECER_NECESSIDADES_CLIENTES.ogg`; risco de ausencia de transcricao apresentado e conteudo ativo aprovado pelo operador em 2026-08-18.
- Estado: candidato local, nao publicado; nenhum envio, pedido Dropi, evento Meta, alteracao de banco oficial, PM2, `current`, servico ou producao.
- Rollback funcional: retornar ao commit `46a81f5fe5f0dc89cc41353ae5eacefce08e82a5`.

### Microcamada V23 — 2026-08-18

- Fonte base: candidato V22 no worktree isolado `/home/codex/worktrees/vitalismen-tex-ultra-entry-unread-20260818`; producao nao foi alterada.
- Identidade textual: `.env.example`, `src/services/agentProfiles.js`, `src/services/openaiService.js`, `src/services/aiRouter.js`, `src/services/vitPowerEvolvedWorkflow.js`, `src/services/adminBuyLaterFollowupService.js`, `src/services/shipmentMessageService.js`, `src/services/vitPowerAudioComplementService.js`, `src/services/nitrixProductProfile.js` e `public/qr.html`.
- Midia fail-closed: `src/services/audioService.js` exige `ELEVENLABS_VOICE_ID_ANA_LOPEZ`; audios Nitrix identificados com a persona anterior ficam fora de `src/services/audioTemplateService.js`, do painel e da extensao.
- Compatibilidade segura: `src/services/conversationEngine.js` reconhece apresentacoes antigas pela estrutura generica da mensagem, sem conservar o nome da persona desativada no runtime.
- Freeze/guard/teste: `docs/EC_ANA_IDENTITY_FREEZE_V23_20260818.md`, `docs/freeze/ec-ana-identity-v23-20260818.json`, `scripts/guard-ec-ana-identity-v23.mjs`, `scripts/audit-ec-ana-identity.mjs` e `tests/ec-ana-identity-v23.test.mjs`.
- Estado: candidato local aprovado para publicacao, ainda nao publicado; aceite da identidade Ana Lopez e da biblioteca ativa registrado em 2026-08-18; nenhum envio, pedido Dropi, evento Meta, banco oficial, PM2, `current`, servico ou producao foi alterado.
- Rollback funcional: retornar ao commit `46a81f5fe5f0dc89cc41353ae5eacefce08e82a5`.

### Microcamada V24 — 2026-08-18

- Fonte base: release ativa `20260818T042423Z_production-20260818-bb2d92f`, commit `bb2d92f65040fc678685358b626c2a4a8a5e9623`; desenvolvimento somente no worktree `/home/codex/worktrees/vitalismen-buy-later-reminder-20260818`.
- Painel e persistencia: `public/qr.html`, `public/leads-window.html`, `src/routes/whatsapp.js` e `src/models/ContactState.js` registram a data desejada e a agenda por produto.
- Lembrete: `src/services/adminBuyLaterFollowupService.js`, `src/services/schedulerService.js` e `src/services/buyLaterConfirmationService.js` preservam produto, nome, lock, comprovante de envio e resposta.
- Teste sem envio: `tests/buy-later-date-reminder-v24.test.mjs`.
- Freeze/guard: `docs/BUY_LATER_DATE_REMINDER_FREEZE_V24_20260818.md`, `docs/freeze/buy-later-date-reminder-v24-20260818.json` e `scripts/guard-buy-later-date-reminder-v24.mjs`.
- Estado: candidato local; nenhum cliente foi identificado ou agendado, nenhuma mensagem foi enviada e nenhum pedido, Dropi, Meta/CAPI, banco oficial, PM2, `current`, servico ou producao foi alterado.
- Rollback funcional: retornar ao commit `bb2d92f65040fc678685358b626c2a4a8a5e9623`; o novo subdocumento Mongo e aditivo e pode permanecer sem uso.

### Microcamada V25 — 2026-08-18

- Fonte base: branch local `codex/command-center-mvp-20260818`, commit `d8ea5f0efbc96a6b4c9fd536aae4b485e9c52743`; producao permanecia na release `20260818T042423Z_production-20260818-bb2d92f` durante a implementacao.
- Abertura: `src/services/texUltraEntryGreetingService.js` e `public/qr.html` preservam a frase aprovada e acrescentam somente o rodizio de um emoji discreto no inicio.
- Interrupcao: `src/services/texUltraInitialLayerService.js` conserva as duas verificacoes de entrada nova; `src/services/texUltraFunnelService.js` responde preco, quantidade e uso de modo deterministico e passa outras duvidas ao humano com a cadencia pausada.
- Minutagem preservada: 2–6s, +4–8s, +21–25s, +28–33s e +35–40s; total de 90–112s.
- Testes sem envio: `tests/tex-ultra-entry-interrupt-v25.test.mjs`, `tests/tex-ultra-entry-unread-v22.test.mjs`, `scripts/test-tex-ultra-initial-cadence.mjs` e `scripts/test-tex-ultra-initial-concurrency.mjs`.
- Freeze/guard: `docs/TEX_ULTRA_ENTRY_INTERRUPT_FREEZE_V25_20260818.md`, `docs/freeze/tex-ultra-entry-interrupt-v25-20260818.json` e `scripts/guard-tex-ultra-entry-interrupt-v25.mjs`.
- Estado: candidato local aprovado para publicacao controlada em 2026-08-18T14:12:47Z, exclusivamente para teste no telefone `5515998038637`; nenhum envio, pedido, Dropi, Meta/CAPI, banco oficial, PM2, `current`, servico ou producao havia sido alterado no momento da aprovacao.
- Rollback funcional: retornar ao commit `d8ea5f0efbc96a6b4c9fd536aae4b485e9c52743` enquanto a V25 nao for publicada.

### Microcamada V26 — 2026-08-18

- Base Git: `e268e61f6d18c4057bb3b01e4e30c0df0c3ae725`, com a V25 integrada na branch `production`; VPS ainda executando `20260818T042423Z_production-20260818-bb2d92f` durante o diagnostico.
- Evidencia: no QA `5515998038637`, a cadencia antiga respondeu a entrada inicial, mas `Hola, quiero el tratamiento.` nao exibiu resposta posterior.
- Causa: o roteador geral marcava `quiero` como compra, mas `src/services/texUltraFunnelService.js` nao possuia a rota forte correspondente; o fallback ainda podia ser barrado pelo antirrepeticao persistente do teste.
- Correcao: classificar compra forte, reconhecer quantidade contextual, perguntar `1, 2, 3 ou 6`, e passar pergunta livre ao humano mesmo depois da oferta.
- Teste: `tests/tex-ultra-strong-intent-v26.test.mjs`, sem transporte ou envio real.
- Freeze/guard: `docs/TEX_ULTRA_STRONG_INTENT_FREEZE_V26_20260818.md`, `docs/freeze/tex-ultra-strong-intent-v26-20260818.json` e `scripts/guard-tex-ultra-strong-intent-v26.mjs`.
- Estado: candidato local autorizado para publicacao controlada em 2026-08-18T14:38:20Z, exclusivamente para teste no telefone `5515998038637`; nenhum reset, envio, banco, PM2, `current`, servico ou producao havia sido alterado no momento da autorizacao.
- Rollback funcional: retornar ao commit `e268e61f6d18c4057bb3b01e4e30c0df0c3ae725`.

### Microcamada V27 — 2026-08-18

- Base Git: `23a395e9a4eec72450cee0608ba4bb32606fa53e`, merge oficial da V26; VPS ainda executando `20260818T042423Z_production-20260818-bb2d92f` durante a implementacao.
- Evidencia: a VSL envia `Hola, quiero el tratamiento.` junto com `Nombre`, `CIUDAD` e `PROVINCIA` em uma unica mensagem multilinha.
- Arquivo funcional alterado: `src/services/texUltraFunnelService.js`; a VSL e `src/routes/zapi.js` permanecem inalterados.
- Correcao: capturar os tres campos antes da cadencia, preencher somente lacunas e, depois da quantidade, pedir entrega sem repetir nome/cidade/provincia.
- Teste sem envio: `tests/tex-ultra-vsl-payload-v27.test.mjs` e regressoes V26/atribuicao VSL.
- Freeze/guard: `docs/TEX_ULTRA_VSL_PAYLOAD_FREEZE_V27_20260818.md`, `docs/freeze/tex-ultra-vsl-payload-v27-20260818.json` e `scripts/guard-tex-ultra-vsl-payload-v27.mjs`.
- Estado: candidato local; autorizacao V26 nao reutilizada. Nenhum reset, envio, pedido, Dropi, Meta/CAPI, banco, PM2, `current`, servico ou producao foi alterado.
- Rollback funcional: retornar ao commit `23a395e9a4eec72450cee0608ba4bb32606fa53e`.

### V28 — Customer Identity, Location & Delivery — 2026-08-18

- Base Git: commit local V27 `15b9857f7b6e33975af52a5f61f797cd7468e102`; branch `codex/customer-data-resolution-v28-20260818`.
- Motor canônico: `src/services/customerDataResolutionService.js`.
- Persistência: `src/models/ContactState.js` e `src/models/Order.js`.
- Gates: `src/services/texUltraFunnelService.js`, `src/routes/whatsapp.js` e `src/routes/orders.js`.
- UX oficial: `public/qr.html`, com modalidade, agência autorizada, score, estados e motivos de bloqueio.
- Fonte de localidades/agências: `src/data/agencia_LISTA.json`; nenhum serviço externo acionado.
- Testes sem envio: `tests/customer-data-resolution-v28.test.mjs` e `tests/customer-data-resolution-v28-integration.test.mjs` mais regressão V27/V26/painel/pedido.
- Freeze/guard: `docs/CUSTOMER_IDENTITY_LOCATION_DELIVERY_FREEZE_V28_20260818.md`, `docs/freeze/customer-data-resolution-v28-20260818.json` e `scripts/guard-customer-data-resolution-v28.mjs`.
- Estado: candidato local, não publicado e sem autorização de deploy. Nenhuma VSL, mensagem real, pedido real, Dropi, Meta/CAPI, banco oficial, PM2, `current`, serviço ou produção foi alterado.
- Rollback funcional: retornar ao commit `15b9857f7b6e33975af52a5f61f797cd7468e102`; schema aditivo pode permanecer sem uso.

Pode baixar arquivo oficial para `.codex-tmp/` apenas para preparar diff. Depois:

1. Validar a copia local.
2. Criar backup do arquivo oficial.
3. Subir a copia corrigida para o caminho oficial.
4. Validar em producao.

Se a tarefa envolver site online, sempre perguntar: "qual URL/caminho oficial?" quando isso nao estiver claro.

### Microcamada V30 — mídia inbound persistente e painel autenticado — 2026-08-21

- Base Git reconstruída: `production` em `b26bacdd6c72711a70834e69915285e677649f1a`; branch isolada `codex/media-durability-auth-20260821`.
- Produção lida antes da alteração: `/opt/vitalismen-automacao/current`, release funcional baseada em `b26bacd`; nenhum arquivo de produção foi substituído nesta preparação.
- Causa comprovada: `/api/whatsapp/media-proxy` está após `authMiddleware`, enquanto `<audio>` e `<img>` não enviavam Bearer; a chamada anônima retornava 401. O cache do proxy estava em `public/media/remote-cache` dentro do release.
- Captura e persistência: `src/services/inboundMediaStorageService.js`, `src/routes/zapi.js` e os campos aditivos de `src/models/Message.js`.
- Leitura autenticada e Range: `src/routes/whatsapp.js`, endpoint `/api/whatsapp/media/:messageId`.
- UX sem segredo na URL: `public/panel-intelligence/authenticated-media.js` e `public/qr.html`.
- Contrato outbound endurecido: `src/services/zapiClient.js` rejeita arquivo/MIME incompatível, data URL inválida e URL remota não HTTPS antes da chamada ao provider.
- Testes sem envio: `tests/inbound-media-storage.test.mjs`, `tests/panel-authenticated-media.test.mjs`, `tests/zapi-outbound-audio-contract.test.mjs` e regressões V29.
- Freeze/guard: `docs/MEDIA_DURABILITY_AUTH_FREEZE_V30_20260821.md`, `docs/freeze/media-durability-auth-v30-20260821.json` e `scripts/guard-media-durability-auth-v30.mjs`.
- Storage oficial quando ativado: `/opt/vitalismen-automacao/shared/media/inbound`; o runtime cria subdiretórios por data com nomes derivados de SHA-256, sem telefone ou token.
- Estado: PR rascunho #17 publicado; ativação controlada autorizada em `2026-08-21T18:00:25Z`, sem disparos em massa e com Z-API preservada até o WhatsApp Web estar pronto. No momento da autorização, nenhuma mensagem real, pedido, Dropi, Meta/CAPI, banco oficial, PM2, symlink ou serviço havia sido alterado.
- Rollback funcional: retornar a `b26bacdd6c72711a70834e69915285e677649f1a`; os campos Mongo aditivos podem permanecer sem uso.

### Microcamada V31 — áudio de uso Tex Ultra — 2026-08-21

- Base de produção lida antes da alteração: `/opt/vitalismen-automacao/releases/20260821T185008Z_production-20260821-7cd0238`; os quatro arquivos funcionais comparados tinham os mesmos hashes da cópia local.
- Áudio oficial fornecido pelo operador: `public/media/templates/EC/MODO_DE_USO_TEX_ULTRA.mp3`, SHA-256 `5bd4a1661f0ee3dee7b45cd146ba0b37d6776339f1835bda4613949d71a38a8a`, 28,24 segundos, mono, 44,1 kHz e 128 kbps.
- Nota de voz derivada: `public/media/templates/EC/MODO_DE_USO_TEX_ULTRA.ogg`, OGG/Opus 48 kHz mono, SHA-256 `c232e5fff4d9418698397e2aa736e56446fff211d62a2943ea53860d1a909d1d`.
- Seleção por produto: `src/services/texUltraProductProfile.js`, `src/services/audioTemplateService.js` e `src/services/shipmentMessageService.js`; Vit Power e Nitrix conservam seus próprios áudios.
- Pergunta de uso: `src/services/texUltraHowToUseAudioService.js` e `src/services/texUltraFunnelService.js`; uma chave `OutboundDedupe` compartilhada entre pergunta e retirada impede repetição automática.
- Testes sem envio: `tests/tex-ultra-how-to-use-audio-v31.test.mjs`, `tests/shipment-pickup-notification.test.mjs` e regressões do funil/pós-venda.
- Freeze/guard: `docs/TEX_ULTRA_HOW_TO_USE_AUDIO_FREEZE_V31_20260821.md`, `docs/freeze/tex-ultra-how-to-use-audio-v31-20260821.json` e `scripts/guard-tex-ultra-how-to-use-v31.mjs`.
- Ponto externo V30: o anexo local não substitui uma mídia inbound real; a prova final exige nova mídia enviada pelo WhatsApp de teste e validada como `READY` no storage/painel autenticado.
- Autorização: implementação e finalização operacional solicitadas pelo operador nesta tarefa em `2026-08-21T19:24:02Z`, sem disparos em massa.
- Rollback funcional: retornar à release `/opt/vitalismen-automacao/releases/20260821T185008Z_production-20260821-7cd0238`; o storage inbound compartilhado deve ser preservado.

### Microcamada V32 — telefone oficial e teste de mídia — 2026-08-21

- Base oficial lida antes da alteração: release ativa `/opt/vitalismen-automacao/releases/20260821T193942Z_production-20260821-03cee3a`, commit `03cee3af70538862a5424d4e3e4266577eab435c`.
- Número oficial confirmado pelo device Z-API e pela configuração do VPS: `5515991418416`.
- Telefone único de teste autorizado: `5515998038637`.
- Fontes públicas: `public/n/index.html`, `public/qr.html` e `src/routes/whatsapp.js`.
- Configuração versionada: `.env.example` e `docs/WHATSAPP_POOL_ATE_6_NUMEROS.md`.
- Scripts operacionais sem defaults desativados: `scripts/apply-historical-client-consolidation.mjs`, `scripts/audit-historical-client-consolidation.mjs`, `scripts/send-opt-in-rescue-bonus.mjs`, `scripts/reconcile-whatsapp-to-unified-panel.mjs` e `scripts/plan-2800-failover-rescue.mjs`.
- Freeze: `docs/OFFICIAL_WHATSAPP_PHONE_TEST_V32_20260821.md` e `docs/freeze/official-whatsapp-phone-test-v32-20260821.json`.
- Autorização: ajuste, deploy e canário individual de áudio/imagem solicitados pelo operador em `2026-08-21T22:05:22Z`; disparo em massa continua proibido.
- Rollback: retornar à release `/opt/vitalismen-automacao/releases/20260821T193942Z_production-20260821-03cee3a` e restaurar o backup do `.env` V32.

### Microcamada V33 — imagem autenticada no painel — 2026-08-21

- Produção lida antes da alteração: `/opt/vitalismen-automacao/releases/20260821T222100Z_production-20260821-4dbb541`.
- Evidência real: três imagens inbound JPEG em `READY`; endpoint autenticado HTTP 200/206; `<img>` com URL `blob:` bloqueado pela CSP pública.
- Causa: `src/index.js` autorizava `blob:` em `media-src`, mas não em `img-src`.
- Correção oficial: adicionar somente `blob:` à diretiva `img-src` do Helmet.
- Testes: `tests/panel-authenticated-media.test.mjs` e `tests/panel-image-csp-v33.test.mjs`.
- Freeze/guard: `docs/PANEL_IMAGE_CSP_BLOB_FREEZE_V33_20260821.md`, `docs/freeze/panel-image-csp-blob-v33-20260821.json` e `scripts/guard-panel-image-csp-v33.mjs`.
- Preservado: autenticação, endpoint, storage, áudio, Z-API, números, clientes, pedidos, Dropi, Meta/CAPI, funil e pós-venda.
- Rollback funcional: retornar à release V32 e preservar o storage compartilhado inbound.

### Microcamada V34 — Protocolo G abre Tex Ultra — 2026-08-22

- Base Git: `production` em `4bd6903a9f470fb075554670348743bf3e59735c`; branch isolada `codex/protocolo-g-tex-ultra-v34-20260821`.
- VSL externa oficial: `https://vilaliemen.shop/protocolo-g`; produto comercial Tex Ultra Ecuador e nome legado do asset Pixel Vit Power preservado.
- Resolução da origem: `src/routes/zapi.js` e `src/routes/whatsapp.js`.
- Separação entre origem e negociação atual: `src/services/vslProductAssignmentService.js`; a escolha manual por cliente não reescreve `vslProductKey`.
- Painel: `public/qr.html` não foi alterado; seletor dos três produtos e gate V28 de qualidade permanecem congelados.
- Testes sem envio: `tests/protocolo-g-tex-ultra-origin-v34.test.mjs`, regressões V28–V33 e guards oficiais.
- Freeze/guard: `docs/PROTOCOLO_G_TEX_ULTRA_ORIGIN_FREEZE_V34_20260822.md`, `docs/freeze/protocolo-g-tex-ultra-origin-v34-20260822.json` e `scripts/guard-protocolo-g-tex-ultra-v34.mjs`.
- No momento do candidato: nenhuma mensagem, pedido, Dropi, Meta/CAPI, escrita no banco oficial, PM2, symlink ou deploy do dashboard havia sido executado.
- Rollback funcional: retornar à release V33 `/opt/vitalismen-automacao/releases/20260821T225331Z_production-20260821-cb8f6fe` e preservar o storage compartilhado inbound.

### Microcamada V35 — ingredientes isolados por produto EC — 2026-08-22

- Serviço oficial: `src/services/ecProductIngredientsService.js`.
- Ponto de composição: `src/services/conversationEngine.js`, antes das
  barreiras isoladas de Tex Ultra e Nitrix e antes do funil Vit Power.
- Teste: `tests/ec-product-ingredients-v35.test.mjs`.
- Freeze/guard: `docs/EC_PRODUCT_INGREDIENTS_FAQ_FREEZE_V35_20260822.md`,
  `docs/freeze/ec-product-ingredients-v35-20260822.json` e
  `scripts/guard-ec-product-ingredients-v35.mjs`.
- Preservado: origem VSL, seleção manual, funis, preços, mídias, pedidos,
  Dropi, Meta/CAPI, transporte, scheduler e pós-venda.
- No momento do candidato V35: nenhuma mensagem, pedido, Dropi, Meta/CAPI,
  escrita no banco oficial, PM2, symlink ou deploy havia sido executado.
- Rollback funcional: retornar à release
  `/opt/vitalismen-automacao/releases/20260822T025119Z_production-20260822-eedf503`
  e preservar o storage compartilhado inbound.

### Microcamada V36 — lista consolidada de ingredientes EC — 2026-08-22

- Serviço oficial: `src/services/ecProductIngredientsService.js`.
- Respostas individuais V35 permanecem ativas e isoladas por produto.
- Novo gatilho: pedido de todos, comparação ou citação de pelo menos dois
  produtos em pergunta de ingredientes/comparação.
- Teste: `tests/ec-all-products-ingredients-v36.test.mjs`.
- Freeze/guard: `docs/EC_ALL_PRODUCTS_INGREDIENTS_FREEZE_V36_20260822.md`,
  `docs/freeze/ec-all-products-ingredients-v36-20260822.json` e
  `scripts/guard-ec-all-products-ingredients-v36.mjs`.
- Preservado: ficha/produto atual, origem VSL, seleção manual, funis, preços,
  mídias, pedidos, Dropi, Meta/CAPI, transporte, scheduler e pós-venda.
- No momento do candidato V36: nenhuma mensagem, pedido, Dropi, Meta/CAPI,
  escrita no banco oficial, PM2, symlink ou deploy havia sido executado.
- Rollback funcional: retornar à release V35
  `/opt/vitalismen-automacao/releases/20260822T033359Z_production-20260822-503c49d`
  e preservar o storage compartilhado inbound.

### Microcamada V37 — status Z-API após autenticação — 2026-08-22

- Painel oficial: `public/qr.html`.
- Evidência: instância `EQUADOR_8416` conectada e health Z-API saudável,
  enquanto a tela sem login mostrava `No token provided`.
- Causa: `checkStatus()` era executado antes de `bootstrapAuth()` e consultava
  a rota protegida sem Bearer.
- Correção: autenticar primeiro, não consultar status sem token, limpar o
  indicador no logout e traduzir `401/403` para sessão expirada.
- Teste: `tests/panel-zapi-auth-status-v37.test.mjs`.
- Freeze/guard: `docs/PANEL_ZAPI_AUTH_STATUS_FREEZE_V37_20260822.md`,
  `docs/freeze/panel-zapi-auth-status-v37-20260822.json` e
  `scripts/guard-panel-zapi-auth-status-v37.mjs`.
- Preservado: autenticação obrigatória da rota, número oficial, transporte,
  funis, preços, mídias, pedidos, Dropi, Meta/CAPI, scheduler e pós-venda.
- No momento do candidato V37: nenhuma mensagem, pedido, Dropi, Meta/CAPI,
  escrita no banco oficial, PM2, symlink ou deploy havia sido executado.
- Rollback funcional: retornar à release V36
  `/opt/vitalismen-automacao/releases/20260822T035923Z_production-20260822-1dbbbe5`
  e preservar o storage compartilhado inbound.

### Microcamada V38 — portabilidade do teste de caminho inbound — 2026-08-22

- Serviço preservado: `src/services/inboundMediaStorageService.js`, sem
  alteração em relação ao hash protegido pela V30.
- Teste corrigido: `tests/inbound-media-storage.test.mjs`.
- Teste da camada: `tests/inbound-media-path-portability-v38.test.mjs`.
- Freeze/guard: `docs/INBOUND_MEDIA_PATH_PORTABILITY_FREEZE_V38_20260822.md`,
  `docs/freeze/inbound-media-path-portability-v38-20260822.json` e
  `scripts/guard-inbound-media-path-portability-v38.mjs`.
- Escopo: expectativa de caminho nativa no Windows e contrato POSIX no Linux;
  nenhum teste é pulado.
- Preservado: comportamento da mídia inbound, painel, Z-API, funis, preços,
  pedidos, Dropi, Meta/CAPI, scheduler e pós-venda.
- Estado: ativação transacional autorizada em `2026-08-22T14:27:24Z`, sujeita a
  PR, tag oficial, staging, permit root de uso único e validações pós-ativação.
- No momento do candidato V38: nenhuma mensagem, pedido, Dropi, Meta/CAPI,
  escrita no banco oficial, PM2, symlink ou deploy havia sido executado.

### Microcamada V39 — produto direto, nome e anti-reenvio — 2026-08-22

- Serviço novo: `src/services/ecDirectProductInquiryService.js`.
- Composição oficial: `src/services/conversationEngine.js`, antes das barreiras
  isoladas de Tex Ultra/Nitrix e sem substituir o motor principal.
- Entrada/roteamento: `src/routes/zapi.js` e
  `src/services/agentRouter.js`; a consulta direta pode ser respondida mantendo
  o modo humano e sem apagar seleção manual divergente.
- Painel: `src/routes/whatsapp.js` e `public/qr.html`; nome de pedido/ficha/perfil
  aparece no cabeçalho e preenche a ficha, sem prévia de mensagem à esquerda.
- Pós-venda preservado e reforçado:
  `src/services/texUltraConfirmedPostSaleLayerService.js`, com consulta de
  histórico antes dos dois áudios já congelados.
- Teste: `tests/ec-direct-product-name-v39.test.mjs`.
- Freeze/guard:
  `docs/EC_DIRECT_PRODUCT_NAME_POSTSALE_FREEZE_V39_20260822.md`,
  `docs/freeze/ec-direct-product-name-postsale-v39-20260822.json` e
  `scripts/guard-ec-direct-product-name-postsale-v39.mjs`.
- Preço fora da VSL: normal primeiro; promoção somente após objeção explícita.
- Origem VSL, checkout, Dropi, Meta/CAPI, pixel, transporte, número, mídias,
  ordem dos funis e outros projetos permanecem preservados.
- Rollback funcional: release V38
  `/opt/vitalismen-automacao/releases/20260822T143218Z_production-20260822-dbc3cbd`.
- No momento do candidato V39: nenhuma mensagem, pedido, Dropi, Meta/CAPI,
  escrita no banco oficial, PM2, symlink ou deploy havia sido executado.

### Microcamada V45 — recompra após entrega EC — 2026-08-22

- Base oficial lida antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260822T195713Z_production-20260822-50b6a6c`,
  commit `50b6a6cb95493957fe8dc68cd9021a60270891e8`.
- Política determinística: `src/services/ecDeliveredRepurchaseService.js`.
- Projeção do histórico no painel: `src/routes/whatsapp.js` e `public/qr.html`.
- Criação autenticada do novo pedido: `src/routes/orders.js`.
- Sincronização do novo ciclo no lead único:
  `src/services/adminPanelStatusService.js`.
- Teste: `tests/ec-delivered-repurchase-v45.test.mjs`.
- Freeze/guard: `docs/EC_DELIVERED_REPURCHASE_FREEZE_V45_20260822.md`,
  `docs/freeze/ec-delivered-repurchase-v45-20260822.json` e
  `scripts/guard-ec-delivered-repurchase-v45.mjs`.
- Contrato: pedido entregue permanece histórico; nova confirmação cria
  `EC-RECOMPRA-*`; Dropi continua dependendo de autorização manual.
- A fila V44 continua separando `AQUECIMENTO` de `Novas`; intenção comercial e
  pedido novo permanecem prioritários.
- Rollback funcional: release V44 acima, preservando pedidos, Shipments, bancos
  e mídias compartilhadas.

### Microcamada V46 — preservação da recompra na ficha EC — 2026-08-22

- Base funcional: V45, release
  `/opt/vitalismen-automacao/releases/20260822T203010Z_production-20260822-a4cc06d`.
- Correção: `src/services/ecDeliveredRepurchaseService.js` e
  `src/routes/whatsapp.js` preservam a linhagem da ordem `EC-RECOMPRA-*` durante
  o salvamento da ficha.
- Teste: `tests/ec-repurchase-sync-preservation-v46.test.mjs`.
- Freeze/guard:
  `docs/EC_REPURCHASE_SYNC_PRESERVATION_FREEZE_V46_20260822.md`,
  `docs/freeze/ec-repurchase-sync-preservation-v46-20260822.json` e
  `scripts/guard-ec-repurchase-sync-preservation-v46.mjs`.
- Preservado: pedido e Purchase já criados, entrega histórica, Dropi manual,
  preços/produtos e exclusão de AQUECIMENTO da aba global `Novas`.

### Microcamada V47 — serialização SQLite da recompra EC — 2026-08-22

- Base funcional: V46, release
  `/opt/vitalismen-automacao/releases/20260822T204600Z_production-20260822-ee9bc9d`.
- Correção: `src/services/adminPanelStatusService.js` converte
  `repurchase_cycle` para inteiro `1/0` antes de montar o script Python.
- Teste: `tests/ec-repurchase-sqlite-serialization-v47.test.mjs`.
- Freeze/guard: `docs/EC_REPURCHASE_SQLITE_SERIALIZATION_FREEZE_V47_20260822.md`,
  `docs/freeze/ec-repurchase-sqlite-serialization-v47-20260822.json` e
  `scripts/guard-ec-repurchase-sqlite-serialization-v47.mjs`.
- Preservado: ordem/Purchase existentes, entrega histórica, Dropi manual e
  separação de AQUECIMENTO da aba `Novas`.

### Microcamada V49 — recuperação da indisponibilidade WhatsApp EC — 2026-08-23

- Base oficial lida antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260822T232706Z_production-20260822-cd61ae1`,
  commit `cd61ae1df2103c31790dde2b45d03be36f3de34f`.
- Diagnóstico externo: Z-API conectada para leitura/webhook, mas saídas bloqueadas
  por assinatura inativa; renovação manual permanece responsabilidade do operador.
- Health somente leitura: `src/routes/health.js`.
- Roteamento contextual: `src/services/ecConversationBucketService.js`.
- Teste: `tests/whatsapp-outage-recovery-v49.test.mjs`.
- Freeze/guard: `docs/WHATSAPP_OUTAGE_RECOVERY_FREEZE_V49_20260823.md`,
  `docs/freeze/whatsapp-outage-recovery-v49-20260823.json` e
  `scripts/guard-whatsapp-outage-recovery-v49.mjs`.
- Preservado: clientes reais sem canário/replay, pedido `3837` sem criação
  retroativa, Dropi/Meta sem reenvio, produtos, preços, VSLs, mídias, scheduler e
  número oficial.
- A primeira tentativa transacional da V49 marcou corretamente o health como
  `degraded`, mas o helper legado exigia o literal `online`; o rollback automático
  restaurou integralmente a V48. O contrato ajustado expõe a conexão Z-API como
  `online` sem retirar `ready=false`, `outboundBlocked=true` ou
  `zapi_subscription_inactive` do estado geral.
- Rollback funcional: release V48 acima, sem remover bancos ou mídias
  compartilhadas.

### Microcamada V50 — persistência da edição manual no painel EC — 2026-08-23

- Base oficial lida antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260823T231500Z_production-20260823-cbc845b`,
  commit `cbc845b977930d586626c993d965d3633e0b929f`.
- Painel oficial: `public/qr.html`.
- Política local e testável:
  `public/panel-intelligence/customer-edit-guard-v50.js`.
- Persistência do nome: rotas autenticadas em `src/routes/whatsapp.js` e lock
  humano preservado por `src/services/customerNameResolutionService.js`; ambos
  foram inspecionados e não alterados.
- Teste: `tests/panel-manual-edit-persistence-v50.test.mjs` e navegador real com
  API simulada, duas respostas fora de ordem e recarga periódica.
- Freeze/guard: `docs/PANEL_MANUAL_EDIT_PERSISTENCE_FREEZE_V50_20260823.md`,
  `docs/freeze/panel-manual-edit-persistence-v50-20260823.json` e
  `scripts/guard-panel-manual-edit-persistence-v50.mjs`.
- Preservado: nenhum cliente real editado no teste; nenhum envio WhatsApp,
  pedido, Dropi, Meta/CAPI, produto, preço, VSL, mídia ou scheduler alterado.
- Rollback funcional: release V49 acima, preservando bancos, mensagens e mídias
  compartilhados.

### Microcamada V51 — isolamento da ficha selecionada no painel EC — 2026-08-24

- Base oficial lida antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260823T235000Z_production-20260823-a17e519`,
  commit funcional `a17e51905c88c0d8bc2d605c7f3f837f2dd5b8d1`.
- Incidente auditado em modo somente leitura: o final `1150` recebeu
  temporariamente `Mira / Carchi / Mira Principal`, dados presentes na ficha do
  final `2490`; a operação já havia restaurado `Guayaquil / Guayas` antes desta
  implementação.
- Painel oficial: `public/qr.html`.
- Política local e testável:
  `public/panel-intelligence/customer-selection-guard-v51.js`.
- Testes: `tests/panel-customer-selection-isolation-v51.test.mjs` e
  `scripts/test-panel-customer-selection-browser-v51.mjs`, com troca simulada
  `2490 -> 1150`, resposta atrasada de Mira e verificação de autosave único.
- Freeze/guard:
  `docs/PANEL_CUSTOMER_SELECTION_ISOLATION_FREEZE_V51_20260824.md`,
  `docs/freeze/panel-customer-selection-isolation-v51-20260824.json` e
  `scripts/guard-panel-customer-selection-isolation-v51.mjs`.
- Preservado: auditoria de produção sem escrita; teste sem cliente real, envio
  WhatsApp, pedido, Dropi, Meta/CAPI, produto, preço, VSL, mídia ou scheduler.
- Rollback funcional: release V50 acima, preservando bancos, mensagens e mídias
  compartilhados.

### Microcamada V52 — persistência do áudio e mídia manual no painel EC — 2026-08-24

- Base oficial lida antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260824T001100Z_production-20260824-bab7bbb`,
  commit funcional `bab7bbbb8fab1d9a539a1df12097d7ba2953a735`.
- Arquivos oficiais alterados: `public/qr.html`, `src/routes/whatsapp.js` e
  `src/services/logisticsCommunicationV29.js`.
- Causa reproduzida: o atalho `/chegou|pickup|retir|agencia|ready/i` marcava
  `Agradecimento_Agencia_01` como áudio de retirada antecipada. A API bloqueava
  a tentativa e o painel removia imediatamente a bolha provisória.
- Auditoria do catálogo ativo: 51 áudios; somente `Chegou_01`, `Chegou_02` e
  `Chegou_03` são classificados como etapa de retirada. Nove falsos positivos
  comerciais deixam de ser bloqueados.
- Testes sem envio real:
  `tests/panel-funnel-media-confirmation-v52.test.mjs`, testes V29 de logística,
  `senior:check` e `scripts/audit-ec-product-micro-layer.mjs`.
- Freeze/guard: `docs/PANEL_MEDIA_PERSISTENCE_FREEZE_V52_20260824.md`,
  `docs/freeze/panel-media-persistence-v52-20260824.json` e
  `scripts/guard-panel-media-persistence-v52.mjs`.
- Preservado: nenhum cliente recebeu mídia de teste; não houve criação/alteração
  de pedido, Dropi, Meta/CAPI, produto, preço, VSL, scheduler ou número oficial.
- Rollback funcional: release V51 acima, preservando bancos, mensagens e mídias
  compartilhados.

### Microcamada V53 — saúde e recuperação segura do pós-venda EC — 2026-08-24

- Base oficial inspecionada antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260824T020500Z_production-20260824-1bf5013`.
- Fila de retirada e antispam:
  `src/models/Shipment.js`,
  `src/services/shipmentMessageService.js`,
  `src/services/postSalePickupReconciliationPolicy.js` e
  `src/services/schedulerService.js`.
- Fila imediata Tex Ultra:
  `src/services/texUltraConfirmedPostSaleLayerService.js`.
- Isolamento da recompra:
  `src/services/reengagementService.js`,
  `src/services/conversationEngine.js` e
  `src/services/shipmentMessageService.js`.
- Guard V39 atualizado para a fonte oficial de nome
  `resolveCustomerDisplayName`, sem alterar o painel.
- Testes: `tests/shipment-pickup-notification.test.mjs` e
  `tests/post-sale-health-v53.test.mjs`.
- Freeze/guard:
  `docs/POST_SALE_HEALTH_RECOVERY_FREEZE_V53_20260824.md`,
  `docs/freeze/post-sale-health-recovery-v53-20260824.json` e
  `scripts/guard-post-sale-health-v53.mjs`.
- Preservado: nenhum canário em cliente real, nenhum replay massivo, nenhuma
  autorização Dropi, nenhuma mudança de preço/produto/VSL/checkout/Meta/pixel.
- Rollback funcional: release V52 acima, preservando bancos, pedidos, Shipments,
  mensagens e mídias compartilhadas.

### Microcamada V54 — fechamento logístico Tex Ultra EC — 2026-08-24

- Base oficial inspecionada antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260824T025315Z_production-20260824-04b1e8e`;
  hashes de `texUltraFunnelService`, `customerDataResolutionService` e
  `servientregaEcuadorAgencyService` idênticos à cópia local.
- Arquivos funcionais: `src/services/texUltraFunnelService.js`,
  `src/services/customerDataResolutionService.js` e
  `src/services/servientregaEcuadorAgencyService.js`.
- Agência: frase do cliente preservada como evidência; nome, ID e endereço do
  pedido saem do catálogo oficial. Empate oferece seleção `A/B/C` e não cria ID.
- Domicílio: texto de modalidade não é aceito como endereço; referência continua
  exclusiva do modo domiciliar.
- Confirmação: correções rotuladas voltam ao motor determinístico e o resumo é
  reapresentado antes de aceitar `SI`.
- Reparo controlado: `scripts/repair-tex-ultra-agency-order-v54.mjs`, limitado a
  um `order-id` exato, confirmação literal e backup absoluto, sem envio externo.
- Testes: `tests/tex-ultra-delivery-closure-v54.test.mjs`, regressões V27/V28 e
  `tests/whatsapp-outage-recovery-v49.test.mjs` incluído no `senior:check`.
- Freeze/guard: `docs/TEX_ULTRA_DELIVERY_CLOSURE_FREEZE_V54_20260824.md`,
  `docs/freeze/tex-ultra-delivery-closure-v54-20260824.json` e
  `scripts/guard-tex-ultra-delivery-closure-v54.mjs`.
- Preservado: preços, produtos, VSL, checkout, Dropi bloqueado, Meta/CAPI, pixel,
  Z-API, número oficial, mídia, pós-venda e scheduler.
- Rollback funcional: release V53 acima e backup específico do pedido reparado.

### Microcamada V55 — persistência integral da ficha EC — 2026-08-24

- Base oficial inspecionada antes da alteração: release
  `/opt/vitalismen-automacao/releases/20260824T040419Z_production-20260824-8801624`,
  commit `c8bcfe9c805aee0568d79040b533c96502d11f82`.
- Painel oficial: `public/qr.html`; política testável no navegador:
  `public/panel-intelligence/customer-form-persistence-guard-v55.js`.
- API e materialização de agência: `src/routes/whatsapp.js` e
  `src/services/panelCustomerFormPersistenceService.js`.
- Varredura somente leitura: 199 pedidos e 856 estados EC. Encontrados dois
  pedidos de agência com endereço vazio (finais 4663 e 1150) e uma ficha antiga
  cujo telefone do rascunho divergia da conversa (5541/4364).
- Reparo controlado: `scripts/repair-panel-customer-form-v55.mjs`, limitado aos
  três registros exatos, com confirmação literal e backup absoluto.
- Teste: `tests/panel-customer-form-persistence-v55.test.mjs`, mais regressões
  V50, V51 e V54 no guard dedicado.
- Freeze/guard: `docs/PANEL_CUSTOMER_FORM_PERSISTENCE_FREEZE_V55_20260824.md`,
  `docs/freeze/panel-customer-form-persistence-v55-20260824.json` e
  `scripts/guard-panel-customer-form-persistence-v55.mjs`.
- Preservado: mensagens e pedido entregue histórico; nenhum WhatsApp, Meta/CAPI,
  Dropi, produto, preço, VSL, checkout, mídia, pós-venda ou scheduler alterado.
- Rollback funcional: release V54 acima e backup específico V55.

### Microcamada V56 — reparo residual exato da ficha EC — 2026-08-24

- Base oficial inspecionada: release
  `/opt/vitalismen-automacao/releases/20260824T043635Z_production-20260824-0642d0d`,
  commit `0642d0d7c8f1a7d1a406093bfdfe02a09df4e333`.
- Resultado de ativação V55:
  `docs/PANEL_CUSTOMER_FORM_PERSISTENCE_ACTIVATION_RESULT_V55_20260824.md`.
- Reparo controlado: `scripts/repair-panel-customer-residual-v56.mjs`, limitado
  a quatro pedidos de agência e aos estados exatos 5201/6060.
- Teste: `tests/panel-customer-residual-repair-v56.test.mjs`, mais a regressão
  V55 no guard dedicado.
- Freeze/guard: `docs/PANEL_CUSTOMER_RESIDUAL_REPAIR_FREEZE_V56_20260824.md`,
  `docs/freeze/panel-customer-residual-repair-v56-20260824.json` e
  `scripts/guard-panel-customer-residual-repair-v56.mjs`.
- Preservado: pedido enviado `EC-MSWR401B-KNHS`, mensagens, Meta/CAPI, Dropi,
  produtos, preços, VSL, checkout, mídia, pós-venda e scheduler.
- Rollback funcional: release V55 acima e backup específico V56.

### Microcamada V57 — alias local da ficha 5541 — 2026-08-24

- Base oficial inspecionada: release
  `/opt/vitalismen-automacao/releases/20260824T045200Z_production-20260824-e17aa9d`,
  commit `e17aa9d8c3e240beac7f6ddd9b5f116f9df63d00`.
- Resultado de ativacao V56:
  `docs/PANEL_CUSTOMER_RESIDUAL_REPAIR_ACTIVATION_RESULT_V56_20260824.md`.
- Reparo: `scripts/repair-panel-customer-alias-v57.mjs`, limitado ao alias
  `_id` `6a7de6b3f24ae26732b45816` e ao estado canonico V55 usado como fonte.
- Freeze/guard: `docs/PANEL_CUSTOMER_ALIAS_REPAIR_FREEZE_V57_20260824.md`,
  `docs/freeze/panel-customer-alias-repair-v57-20260824.json` e
  `scripts/guard-panel-customer-alias-repair-v57.mjs`.
- Preservado: pedidos, mensagens, Shipments, lead, Dropi, Meta/CAPI, produto,
  preco, funil, midia, pos-venda e scheduler.
- Rollback funcional: release V56 acima e backup especifico V57.

### Microcamada V58 — frasco e continuidade do B01 Tex Ultra — 2026-08-24

- Base oficial inspecionada: release
  `/opt/vitalismen-automacao/releases/20260824T045910Z_production-20260824-33e48fc`,
  commit `33e48fc82d480646993fe52abdb9a31bf071357d`.
- Painel oficial alterado: `public/qr.html`, somente nas referencias Tex Ultra
  do M01, do bloco `tex_ultra_inicio_completo` e na reconciliacao persistente
  das etapas manuais do mesmo bloco.
- Arquivo oficial preservado: `public/media/sales/ec/tex_ultra.png`, SHA-256
  `450122a3db3823d012770a20f25f311be66a564b8fb23d9d0d47f0207d3ce2f7`.
- Teste: `tests/panel-tex-ultra-bottle-block-v58.test.mjs`.
- Freeze/guard: `docs/PANEL_TEX_ULTRA_BOTTLE_BLOCK_FREEZE_V58_20260824.md`,
  `docs/freeze/panel-tex-ultra-bottle-block-v58-20260824.json` e
  `scripts/guard-panel-tex-ultra-bottle-block-v58.mjs`.
- Preservado: sequencia B01, tabela promocional oficial, demais produtos,
  Dropi, Meta/CAPI, Z-API, numero, memoria, scheduler e pos-venda.
- Rollback funcional: release V57 acima, preservando bancos, mensagens,
  pedidos e midias compartilhadas.

### Microcamada V59 — saneamento Baileys/libsignal/protobufjs — 2026-08-24

- Base oficial inspecionada: release
  `/opt/vitalismen-automacao/releases/20260824T123239Z_production-20260824-812fb25`,
  commit funcional `812fb25f0e585c0906cde47f4d4b1570511c3fda`.
- Arquivos de dependencia oficiais: `package.json` e `package-lock.json`.
- Baileys preservado em `6.7.24`; `libsignal` atualizado para a release oficial
  `6.0.0`, commit `bcea72df9ec34d9d9140ab30619cf479c7c144c7`.
- `protobufjs@6.8.8` removido; a cadeia inteira usa `protobufjs@7.6.5`.
- Teste sem transporte: `tests/baileys-libsignal-security-v59.test.mjs` carrega
  Baileys e libsignal sem criar socket, sessao ou mensagem.
- Freeze/guard: `docs/BAILEYS_LIBSIGNAL_SECURITY_FREEZE_V59_20260824.md`,
  `docs/freeze/baileys-libsignal-security-v59-20260824.json` e
  `scripts/guard-baileys-libsignal-security-v59.mjs`.
- Preservado: Z-API oficial, painel, numero, funis, produtos, precos, VSL,
  checkout, Dropi, Meta/CAPI, pixel, midias, pedidos, scheduler e pos-venda.
- Rollback funcional: release V58 acima, preservando bancos, mensagens,
  pedidos e midias compartilhadas.

# Arquivos oficiais e fonte de verdade

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

Pode baixar arquivo oficial para `.codex-tmp/` apenas para preparar diff. Depois:

1. Validar a copia local.
2. Criar backup do arquivo oficial.
3. Subir a copia corrigida para o caminho oficial.
4. Validar em producao.

Se a tarefa envolver site online, sempre perguntar: "qual URL/caminho oficial?" quando isso nao estiver claro.

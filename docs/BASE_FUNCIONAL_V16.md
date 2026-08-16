# Base funcional V16 — auditoria de produção e HEAD local

Data da auditoria: 2026-08-16

Escopo: MAXLIEN EC — Vitalismen oficial. Este documento é uma fotografia de auditoria e não autoriza deploy, ativação de automação, envio a cliente, alteração de pedido, acesso ao banco ou publicação de refs.

## 1. Regra de leitura desta base

Uma funcionalidade só é marcada como `PRODUÇÃO` quando o arquivo correspondente existe no commit realmente implantado no VPS:

```text
dbe5f3af960cb0b48009ac81736b552d54e910b5
```

Release ativa confirmada durante esta auditoria:

```text
/opt/vitalismen-automacao/releases/20260815T153200Z_ec_manual_product_lead_badge_v12_dbe5f3a
```

O HEAD local auditado é:

```text
36a6fb3c1421f888711aec938292abbd1e0b153b
```

O fato de um arquivo existir no HEAD local não significa que ele esteja em produção. A sequência auditada é:

```text
produção V12  dbe5f3a
    ↓
V13           f8734e8  — não publicada
    ↓
V14           e479ab6  — não publicada/sem alteração no código de execução
    ↓
V15           a19c271  — congelada, não publicada
    ↓
hardening     c62be2c  — fonte canônica de release
    ↓
hardening     44504f2  — remoção de credencial literal do painel público
    ↓
bootstrap     36a6fb3  — documentação e scripts operacionais, sem função de negócio
```

### Estados usados

- `PRODUÇÃO`: código presente na release `dbe5f3a`. Quando a ativação depende de variável do VPS e essa variável não pôde ser lida, isso é declarado separadamente.
- `IMPLEMENTADO LOCALMENTE`: existe no HEAD `36a6fb3`, mas não na release ativa.
- `CONGELADO`: comportamento protegido por regra permanente, freeze ou manifesto; não deve ser refeito sem autorização explícita.
- `EM TESTE`: possui validação local, mas ainda requer piloto ou integração real controlada antes de publicação.
- `INCOMPLETO`: existe parcialmente ou falta evidência operacional necessária.
- `AUSENTE`: não foi encontrada implementação ou especificação aprovada no escopo auditado.

## 2. Evidência executada nesta auditoria

### Baseline e operação

- `scripts/start-codex-work.ps1`: passou e mostrou `AMBIENTE PRONTO PARA TRABALHO`.
- raiz, branch, upstream, origin, HEAD local, release ativa e HEAD da produção: confirmados.
- `public/media` é idêntico entre `dbe5f3a` e `36a6fb3`.
- `src/services/conversationEngine.js`, `botHandler.js`, `agentRouter.js`, `memoryStore.js` e `src/whatsapp/` são idênticos entre produção e HEAD.
- endpoint público de status: integração Z-API conectada; a sessão Baileys consultada estava em estado de leitura de QR, não pronta.
- `GET https://ec.maxlien.shop/health` respondeu `404`, enquanto `GET https://ec.maxlien.shop/api/health/` respondeu `200`. O diagnóstico posterior confirmou que a aplicação Node responde `200` em `127.0.0.1:3001/health`, mas o path público `/health` é encaminhado pelo proxy para o serviço legado na porta `5055`, que responde `404`.
- as flags não secretas da `.env` da release não puderam ser revalidadas pelo alias de leitura porque o arquivo retornou `Permission denied`. Portanto, código presente e automação operacionalmente ativa são tratados como afirmações diferentes.

### Testes e guards

- suíte Node da raiz: `67/67` testes passaram.
- suíte da extensão: `15/15` testes passaram.
- `audit:no-regression`: passou.
- `audit:funil-context`: passou, incluindo quantidade, confirmações, nome, cidade, província e agência.
- `audit:customer-draft-zero`: passou, com 27 verificações.
- `guard:freeze-lock`: passou, com 19 regras congeladas.
- `guard:ec-dropi-catalog`: passou, com 3 produtos e 24 combinações; não houve envio real.
- `guard:pickup-notifications`: passou.
- `guard:whatsapp-status-contacts`: passou.
- `guard:ec-nitrix`, `test:nitrix-rollout-gate` e `test:nitrix-two-audio-entry`: passaram.
- `guard:ec-product-micro-layer` e `guard:ec-tex-ultra`: passaram.
- `guard:guide-print-spam`: passou.
- `test:meta-attribution`: `8/8` passaram.
- `test:customer-form`, `test:manual-funnel` e `test:funnel-metrics`: passaram.
- inventário do funil evoluído: `27/27` grupos esperados têm ao menos um arquivo `.ogg` ou `.mp3` local; a documentação que ainda enumera áudios faltantes está desatualizada.

Na auditoria inicial, dois gates não estavam verdes:

1. `npm run senior:check` executou com sucesso o guard V15 e os 13 testes internos, mas o `senior-guard` final bloqueou uma referência textual já existente em `docs/INFRAESTRUTURA_OFICIAL.md` a um contexto externo proibido.
2. `guard:status-panels` bloqueou porque procura um `app.py` de outro componente fora da raiz oficial. O guard não é autocontido nesta worktree e não pode comprovar integração fim a fim do painel externo.

Os dois bloqueios locais foram saneados e revalidados na seção **Bloqueadores pré-V16 — estado após saneamento**. A validação opcional do painel externo continua separada da validação desta raiz.

Nenhum teste desta auditoria enviou mensagem, mídia, evento Meta, pedido Dropi ou alteração ao VPS.

## 3. Evolução funcional por versão

### Produção V12 — `dbe5f3a`

Estado: `PRODUÇÃO + CONGELADO`.

O commit V12 consolida o marcador estruturado do produto escolhido na ficha atual e sua preservação em lead, pedido e envio manual ao Dropi. A seleção manual atual prevalece sobre histórico antigo; inferência por preço não é fonte de verdade. A release também já contém todas as camadas anteriores de painel, WhatsApp, bot, funil, produtos, pedidos, logística, Meta, extensão e métricas descritas nas seções seguintes.

Proteção principal:

- `docs/EC_MANUAL_PRODUCT_LEAD_BADGE_FREEZE_V12_20260815.md`
- `docs/freeze/ec-manual-product-lead-badge-v12-20260815.json`
- `tests/ec-manual-product-dropi-hotfix.test.mjs`

### V13 — `f8734e8`

Estado: `IMPLEMENTADO LOCALMENTE + CONGELADO + EM TESTE`.

Isola a biblioteca manual de funis iniciais por produto. Tex Ultra recebe início, prova, frasco e oferta próprios; Vit Power e Nitrix preservam seus blocos e mídias. O envio continua dependente de clique humano. A extensão passa à versão `0.13.7`.

Fontes e proteção:

- `public/qr.html`
- `extensions/vitalismen-whatsapp-official/legacy-funnel-library.js`
- `extensions/vitalismen-whatsapp-official/whatsapp-funnel-launcher.js`
- `extensions/vitalismen-whatsapp-official/product-funnels/tex-ultra-ec.js`
- `docs/EC_PRODUCT_FUNNEL_ISOLATION_FREEZE_V13_20260815.md`
- `tests/ec-product-funnel-isolation-v13.test.mjs`
- `extensions/vitalismen-whatsapp-official/tests/product-funnel-isolation.test.cjs`

O manifesto registra `publicationStatus: not_published`.

### V14 — `e479ab6`

Estado: `IMPLEMENTADO LOCALMENTE + CONGELADO + INCOMPLETO`.

Documenta `WHATSAPP_AUTO_REJECT_CALLS=false` como política aprovada. Não altera `src/whatsapp/connection.js`; muda somente exemplo de ambiente, auditor e freeze. A `.env` ativa não foi alterada pela V14 e não pôde ser lida nesta auditoria. Portanto, a política está congelada no HEAD, mas sua ativação real no VPS não está comprovada.

Fontes e proteção:

- `.env.example`
- `scripts/official-state-audit.mjs`
- `docs/WHATSAPP_AUTO_REJECT_POLICY_FREEZE_V14_20260815.md`
- `docs/freeze/whatsapp-auto-reject-policy-v14-20260815.json`

### V15 — `a19c271`

Estado: `IMPLEMENTADO LOCALMENTE + CONGELADO + EM TESTE`.

Acrescenta inteligência conservadora de dados do cliente:

- CTA genérica usa o produto ativo configurado e aceita dados explicitamente anexados;
- nome rotulado pode corrigir somente nome claramente concatenado, sem superar edição manual;
- cidade e província só são canonizadas pelo catálogo oficial de agências;
- OCR de imagem é iniciado manualmente, mostra prévia e exige confirmação;
- OCR não extrai telefone, documento, pagamento ou produto;
- saída estruturada usa `store: false`;
- Dropi continua separado e manual.

Fontes e proteção:

- `public/panel-intelligence/customer-data-normalizer.js`
- `public/panel-intelligence/conversation-data-extractor.js`
- `src/services/customerImageDataReaderService.js`
- `src/services/servientregaEcuadorAgencyService.js`
- `src/routes/whatsapp.js`
- `src/routes/zapi.js`
- `extensions/vitalismen-whatsapp-official/sidepanel.js`
- `docs/CUSTOMER_DATA_INTELLIGENCE_FREEZE_V15_20260815.md`
- `tests/customer-image-data-reader.test.mjs`
- `tests/customer-form-intelligence.test.cjs`
- testes de normalização, extração e agência da extensão

O manifesto registra `publicationStatus: not_published` e não existe evidência de piloto real desta versão.

### Hardenings — `c62be2c` e `44504f2`

Estado: `IMPLEMENTADO LOCALMENTE + EM TESTE`.

- `c62be2c`: exige repositório, branch, tag e commit canônicos antes de futura criação de release; protegido por `tests/release-source-policy.test.mjs`.
- `44504f2`: remove do JavaScript público uma credencial administrativa literal; protegido por `tests/public-admin-credential.test.mjs`.

O segundo hardening é um bloqueio de segurança para promoção futura: a produção `dbe5f3a` é anterior à remoção. O valor não é reproduzido neste documento.

### Bootstrap — `36a6fb3`

Estado: `IMPLEMENTADO LOCALMENTE`, sem mudança funcional.

Acrescenta documentação e scripts de diagnóstico somente leitura. Não muda painel, WhatsApp, bot, funil, clientes, pedidos ou integrações.

## 4. Inventário funcional detalhado

### 4.1 Painel

Estado: `PRODUÇÃO + CONGELADO`; melhorias V13/V15 e hardening de segurança estão `IMPLEMENTADO LOCALMENTE + EM TESTE`.

Produção contém o painel integrado de conversas, ficha, ações manuais, produto atual, status e acesso às rotinas operacionais. A coluna esquerda deve continuar sem prévia de mensagem; o conteúdo fica no painel central após seleção do contato. O HEAD acrescenta isolamento da biblioteca manual por produto, leitura assistida de dados e remoção da credencial literal.

Fonte: `public/qr.html`, `src/routes/whatsapp.js`, `src/routes/zapi.js`.

Commits identificáveis: produção até `dbe5f3a`; V13 `f8734e8`; V15 `a19c271`; segurança `44504f2`.

Testes: `ec-manual-product-dropi-hotfix`, `manual-quick-funnel`, `customer-form-intelligence`, `public-admin-credential`, testes de painel da extensão e guards EC.

### 4.2 WhatsApp

Estado do código: `PRODUÇÃO + CONGELADO`. Estado operacional completo: `INCOMPLETO` nesta auditoria.

Transporte Baileys, entrada Z-API, envio de texto/áudio/imagem/vídeo/documento, isolamento EC, roteamento de sessão e deduplicação já estão na produção. O núcleo em `src/whatsapp/` não mudou no HEAD; as rotas `src/routes/whatsapp.js` e `src/routes/zapi.js` receberam apenas a camada local V15 de inteligência de dados. A consulta pública mostrou Z-API conectada e a sessão Baileys consultada ainda não pronta. As flags de automação no VPS não puderam ser lidas.

Fonte: `src/whatsapp/connection.js`, `dispatcher.js`, `sessionRouter.js`, `outboundGuard.js`, módulos `send*`, `src/routes/zapi.js`.

Commit identificável: código atual já contido em `dbe5f3a`, principalmente consolidado por `dd85054` e pelo snapshot `2ed9665`.

Testes: `ecuador-only-operation`, guards de país/produto, testes da ponte WA-JS da extensão. Falta teste comportamental dedicado de múltiplas sessões.

### 4.3 Bot

Estado do motor: `PRODUÇÃO + CONGELADO`. Ativação comercial real: `INCOMPLETO`.

O motor determinístico, roteador de agente, leitura de intenção forte, respostas de segurança, memória e complementos existem na produção. Esses arquivos são idênticos no HEAD. A documentação mais recente de venda manual registra automação comercial desligada, enquanto documentos históricos registram combinações diferentes de flags. Sem leitura da `.env` ativa, não é correto afirmar que respostas comerciais automáticas estejam ligadas.

Fonte: `src/services/conversationEngine.js`, `botHandler.js`, `agentRouter.js`, `agents/vitPowerAgent.js`, `initialFunnelTriggers.js`, `passiveFunnelObserverService.js`.

Commit identificável: presente em `dbe5f3a`; núcleo atual consolidado no snapshot `2ed9665`.

Testes: `audit:funil-context`, `senior:check` completo, guards Nitrix/Tex Ultra e testes de origem de produto. Falta piloto real controlado do conjunto completo.

### 4.4 Funil

Estado: núcleo A/B e contratos existentes em `PRODUÇÃO + CONGELADO`; biblioteca manual isolada V13 em `IMPLEMENTADO LOCALMENTE + CONGELADO + EM TESTE`; operação automática fim a fim `INCOMPLETO`.

O funil aprovado preserva entrada sem dados e entrada com dados, intenção forte antes da etapa rígida, memória de quantidade, escolha agência/domicílio, confirmação final e entrega manual ao Dropi. O HEAD não muda o motor central; V13 corrige especificamente os blocos manuais por produto no painel e extensão.

Fonte: `src/services/conversationEngine.js`, `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`, `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`, `public/qr.html`, biblioteca de funis da extensão.

Commits: produção até `dbe5f3a`; V13 `f8734e8`.

Testes: `audit:funil-context`, `manual-quick-funnel`, `ec-product-funnel-isolation-v13` e testes da extensão.

### 4.5 Captura automática do nome

Estado: captura explícita básica em `PRODUÇÃO`; refinamento V15 em `IMPLEMENTADO LOCALMENTE + CONGELADO + EM TESTE`.

Produção já lê nome em formulário/conversa e permite edição manual. V15 torna a correção mais conservadora: só nome explicitamente rotulado pode corrigir concatenação clara; localidade, confirmação e frase logística não viram nome; edição humana permanece prioritária.

Fonte: `public/panel-intelligence/conversation-data-extractor.js`, `customer-data-normalizer.js`, equivalentes da extensão, `conversationEngine.js`.

Commits: base de produção `b53e575`/`dbe5f3a`; refinamento `a19c271`.

Testes: `customer-form-intelligence`, `conversation-data-extractor`, `customer-data-normalizer`, `audit:funil-context`.

### 4.6 Memória do cliente

Estado: `PRODUÇÃO + CONGELADO`.

Há memória persistente por contato/pedido para etapa, quantidade, dados, finalidade de mídia, histórico de envio, produto, negociação e locks. O núcleo não mudou após produção.

Fonte: `src/models/ContactState.js`, `Message.js`, `Order.js`, `src/services/memoryStore.js`, `funnelPurposeMemoryService.js`, campos de automação em `Shipment.js`.

Commit: contido em `dbe5f3a`; núcleo consolidado no snapshot `2ed9665`.

Testes: `audit:funil-context`, `manual-quick-funnel`, `shipment-pickup-notification`, `audit:customer-draft-zero` e guards anti-spam.

### 4.7 Dados completos do cliente

Estado: ficha e fluxo determinístico em `PRODUÇÃO + CONGELADO`; normalização/OCR V15 em `IMPLEMENTADO LOCALMENTE + EM TESTE`.

Produção mantém nome, telefone, cidade, província, endereço/agência, referência e quantidade, pede somente o campo faltante e exige confirmação. V15 melhora extração e normalização e adiciona OCR manual com prévia.

Fonte: módulos `public/panel-intelligence/*`, `conversationEngine.js`, `ContactState.js`, `Order.js`, rotas de WhatsApp.

Commits: produção até `dbe5f3a`; V15 `a19c271`.

Testes: `customer-form-intelligence`, `customer-image-data-reader`, `audit:customer-draft-zero`, testes de autosave e normalização da extensão.

### 4.8 Seleção de produto

Estado: marcador estruturado e troca manual por pedido em `PRODUÇÃO + CONGELADO`; isolamento do funil manual V13 em `IMPLEMENTADO LOCALMENTE + EM TESTE`.

A origem da VSL fica separada do produto atual do pedido. A escolha manual atual prevalece, não altera outras VSLs e não deve ser inferida por preço ou conversa antiga.

Fonte: `src/services/ecuadorProductService.js`, `productRouteLockService.js`, `public/qr.html`, `src/routes/shipments.js`, extensão oficial.

Commits: origem/seleção `3654f1e`; V12 `dbe5f3a`; isolamento V13 `f8734e8`.

Testes: `ecuador-product-origin`, `extension-product-origin`, `ec-manual-product-dropi-hotfix`, `manual-quick-funnel`, `ec-product-funnel-isolation-v13`.

### 4.9 Tex Ultra

Estado: produto, origem da VSL, funil manual anterior e métricas em `PRODUÇÃO + CONGELADO`; bloco inicial isolado V13 em `IMPLEMENTADO LOCALMENTE + EM TESTE`; envio Dropi específico `INCOMPLETO` até revalidar a flag/catálogo ativo.

A entrada `/n/`, produto, preços, nomenclatura em frascos, mídias próprias e separação dos outros produtos estão protegidos. O código de Dropi exige habilitação explícita e alvo validado antes de aceitar submissão Tex Ultra; a configuração ativa não foi comprovada nesta auditoria.

Fonte: `src/services/texUltraProductProfile.js`, `texUltraFunnelService.js`, `ecuadorProductService.js`, `public/n/index.html`, painel e extensão.

Commits: camadas V3/V4/V5 anteriores e contidas em `dbe5f3a`; V13 `f8734e8`.

Testes: `guard:ec-tex-ultra`, `guard:ec-product-micro-layer`, testes de origem, catálogo e isolamento V13.

### 4.10 Vit Power

Estado: `PRODUÇÃO + CONGELADO`; ativação automática fim a fim `INCOMPLETO`.

Perfil, motor, preços, entrada própria, mídias, memória e logística existem na produção. O funil A/B não deve ser reordenado. A presença do código não comprova que a automação comercial esteja ativa no VPS.

Fonte: `src/services/agents/vitPowerAgent.js`, `conversationEngine.js`, `vitPowerAudioComplementService.js`, `vitPowerEvolvedWorkflow.js`, `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`.

Commit: contido em `dbe5f3a`, núcleo `2ed9665`.

Testes: `audit:funil-context`, `senior:check` completo, inventário de áudio e guards gerais.

### 4.11 Nitrix Oxide

Estado: perfil, entrada e dois áudios em `PRODUÇÃO + CONGELADO`; envio Dropi específico `INCOMPLETO` até revalidar a flag/catálogo ativo.

Nitrix mantém perfil, estado rápido e sequência própria, sem reutilizar automaticamente funil ou mídia de outro produto. O código do Dropi bloqueia submissão se a habilitação ou o alvo exato não estiverem configurados.

Fonte: `src/services/nitrixProductProfile.js`, `nitrixFastStateService.js`, `nitrixEntryTwoAudioLayer.js`, `droppiEcuadorBrowserService.js`.

Commit: contido em `dbe5f3a`.

Testes: `guard:ec-nitrix`, `test:nitrix-rollout-gate`, `test:nitrix-two-audio-entry`, testes de origem e catálogo.

### 4.12 Dropi

Estado: fluxo manual, segurança, recibo e sincronização em `PRODUÇÃO + CONGELADO`; prontidão dos alvos Tex Ultra/Nitrix `INCOMPLETO`.

V8–V12 protegem seleção manual, sessão persistente, permissões, recibo de submissão, prevenção de duplicidade, preservação após sincronização e marcador estruturado. Nenhum envio real foi feito nesta auditoria. O guard de catálogo valida código e preços, não substitui login, saldo, alvo de produto e pedido piloto controlado.

Fonte: `src/routes/shipments.js`, `src/services/droppiEcuadorBrowserService.js`, `droppiEcuadorService.js`, `dropiOutboundOrderGuardService.js`, `Order.js`, `Shipment.js`.

Commits: V8–V12, culminando em `dbe5f3a`; recibo verificado em `2861c64`.

Testes: `ec-manual-product-dropi-hotfix`, `whatsapp-dropi-status-sync`, `guard:ec-dropi-catalog`, guard de microcamada.

### 4.13 Servientrega

Estado: catálogo e busca em `PRODUÇÃO + CONGELADO`; normalização adicional V15 em `IMPLEMENTADO LOCALMENTE + EM TESTE`.

Produção usa exclusivamente `src/data/agencia_LISTA.json`, com correspondência por cidade/província e até três opções. V15 endurece a recusa a cidade desconhecida ou ambígua.

Fonte: `src/services/servientregaEcuadorAgencyService.js`, `src/data/agencia_LISTA.json`, catálogos do painel e extensão.

Commits: produção até `dbe5f3a`; V15 `a19c271`.

Testes: `audit:funil-context`, `agency-catalog.test.cjs`, `agency-batch.test.cjs`, `customer-image-data-reader`.

### 4.14 Agência e domicílio

Estado: `PRODUÇÃO + CONGELADO`; robustez de leitura V15 em `IMPLEMENTADO LOCALMENTE + EM TESTE`.

Agência é a primeira condução logística; domicílio entra após recusa ou pedido explícito. Confirmações curtas só valem no contexto pendente correto. A escolha de agência usa fonte oficial e a entrega domiciliar exige endereço e referência.

Fonte: `conversationEngine.js`, `servientregaEcuadorAgencyService.js`, formulário do painel e extensão.

Commits: base em `dbe5f3a`; V15 `a19c271`.

Testes: `audit:funil-context`, testes de catálogo, lote de agências e formulário.

### 4.15 Pedidos

Estado: `PRODUÇÃO + CONGELADO`.

Pedidos têm dados do cliente, pacote, total, produto, origem, estado, confirmação, histórico, ligação com envio e proteção de duplicidade. Pedido antigo permanece histórico; negociação atual pode gerar pedido novo com vínculo ao anterior. Dropi exige autorização separada.

Fonte: `src/models/Order.js`, `src/routes/orders.js`, `src/routes/shipments.js`, `orderDuplicateGuardService.js`, `customerPurchaseEligibilityService.js`.

Commit: contido em `dbe5f3a`.

Testes: `manual-quick-funnel`, `ec-manual-product-dropi-hotfix`, `whatsapp-dropi-status-sync`, `shipment-novedad-admin-status`.

### 4.16 Meta Purchase/CAPI

Estado: `PRODUÇÃO + CONGELADO`.

Purchase fica ligado a pedido confirmado, valor positivo, USD, `event_id` e trava de duplicidade. A auditoria local usou payload seco; nenhum evento foi enviado.

Fonte: `src/services/metaConversionsService.js`, `src/routes/metaEvents.js`, campos de `Order.js`.

Commit: contido em `dbe5f3a`.

Testes: `meta-attribution-bridge.test.mjs`, teste do botão Meta da extensão, `audit:no-regression`.

### 4.17 Atribuição Meta

Estado: `PRODUÇÃO + CONGELADO`.

A ponte relaciona a primeira mensagem a uma visita recente somente quando há uma candidata única, exata e com identificador de anúncio. Zero ou múltiplas candidatas não recebem atribuição. `sourceUrl` isolada não é prova suficiente.

Fonte: `src/services/metaAttributionBridgeService.js`, `metaAttributionService.js`, `src/models/VslVisit.js`, rotas de entrada WhatsApp/VSL.

Commit: `42e3746`, ancestral de `dbe5f3a`.

Testes: `test:meta-attribution` (`8/8`) e `audit:no-regression`.

### 4.18 Áudios

Estado dos arquivos e serviços: `PRODUÇÃO + CONGELADO`. Validação de reprodução/envio real por etapa: `EM TESTE`.

Serviço, PTT, transcrição de entrada, complementos, fila, cadência e mídias por produto existem na produção. A árvore de mídia não mudou no HEAD. Os 27 grupos esperados pelo inventário atual têm arquivo local. Isso não substitui teste controlado de codec, entrega, ordem, cancelamento por resposta humana e não repetição.

Fonte: `src/services/audioService.js`, `audioTemplateService.js`, `inboundAudioTranscriptionService.js`, `vitPowerAudioComplementService.js`, `src/whatsapp/sendAudio.js`, `public/media/templates/EC`.

Commit: contido em `dbe5f3a`.

Testes: guards de Nitrix, pickup, anti-spam, extensão e inventário local. Não há teste real nesta auditoria.

### 4.19 Imagens

Estado de envio e mídia aprovada: `PRODUÇÃO + CONGELADO`; OCR V15: `IMPLEMENTADO LOCALMENTE + EM TESTE`.

Produção envia somente mídia aprovada no contexto do produto. V15 acrescenta leitura manual de imagem para dados permitidos, com prévia e confirmação, sem autoaplicar dados sensíveis.

Fonte: `src/whatsapp/sendImage.js`, `src/services/salesMediaCatalog.js`, `public/media`, `customerImageDataReaderService.js`, painel e extensão.

Commits: produção até `dbe5f3a`; OCR `a19c271`.

Testes: `customer-image-data-reader`, testes de extensão e guards de isolamento de produto.

### 4.20 Respostas automáticas

Estado do código: `PRODUÇÃO + CONGELADO`. Estado ativo no VPS: `INCOMPLETO`.

Há motor e gates para resposta automática, piloto, observador e roteamento Z-API. O último freeze operacional encontrado registra venda manual e automações comerciais desligadas. Outros documentos históricos registram modos diferentes. Como a `.env` ativa não pôde ser lida, não considerar resposta comercial automática como produção ativa.

Fonte: `conversationEngine.js`, `botHandler.js`, `automationSafety.js`, `dispatcher.js`, rotas Z-API/automação.

Commit: código contido em `dbe5f3a` e igual no HEAD.

Testes: guards do funil e produtos. Exige piloto real autorizado antes de qualquer ativação.

### 4.21 Intervenção humana

Estado: `PRODUÇÃO + CONGELADO`.

Assunção humana pausa/cancela etapas automáticas pendentes, o funil rápido só aparece em atendimento manual EC e a ação do operador não deve provocar reenvio automático. Ajuste manual de status não altera pedido, Dropi ou Meta.

Fonte: `src/services/operationalChatStatusService.js`, `operatorNoAutoResendService.js`, estados de `ContactState.js`, `public/qr.html`, extensão.

Commit: contido em `dbe5f3a`.

Testes: `manual-quick-funnel`, `operational-chat-status`, `leads-window-status-merge`, guard de contatos/status.

### 4.22 Anti-loop e anti-spam

Estado: `PRODUÇÃO + CONGELADO`.

Existem deduplicação de saída, hashes persistidos, locks, histórico, uma próxima etapa por ciclo, cancelamento por intervenção e campos de já enviado. A mesma mídia/mensagem não deve ser repetida automaticamente ao mesmo cliente/pedido.

Fonte: `outboundDedupeService.js`, `operatorNoAutoResendService.js`, `src/whatsapp/outboundGuard.js`, `Shipment.js`, despachantes de status.

Commit: contido em `dbe5f3a`.

Testes: `guard:guide-print-spam`, `guard:pickup-notifications`, `shipment-pickup-notification`, `audit:funil-context`.

### 4.23 Chamadas

Estado do suporte de flag: `PRODUÇÃO`; política V14: `IMPLEMENTADO LOCALMENTE + CONGELADO`; ativação real: `INCOMPLETO`.

O código de produção já encerra antes de rejeitar/enviar resposta quando `WHATSAPP_AUTO_REJECT_CALLS=false`. V14 não muda o código; apenas congela `false` como política e atualiza o auditor/exemplo. A flag ativa do VPS não foi lida.

Fonte: `src/whatsapp/connection.js`, `.env.example`, freeze V14.

Commits: execução em `dbe5f3a`; política `e479ab6`.

Teste: auditor oficial possui a verificação de política, mas o gate completo não está verde por problema documental independente.

### 4.24 Clientes antigos

Estado: `PRODUÇÃO + CONGELADO`.

Histórico antigo não deve trocar produto/status do pedido anterior. Nova negociação fica separada, pode gerar novo pedido e mantém vínculo de auditoria. Reenvio/duplicidade é bloqueado por telefone e recibo.

Fonte: `Order.js`, `orderDuplicateGuardService.js`, `customerPurchaseEligibilityService.js`, painel e rotas de pedido.

Commit: contido em `dbe5f3a`.

Testes: `manual-quick-funnel` cobre pedido antigo versus negociação atual; testes Dropi cobrem recibo e duplicidade.

### 4.25 Clientes novos

Estado do fluxo de entrada: `PRODUÇÃO + CONGELADO`; automação ativa `INCOMPLETO`.

Entrada da VSL, origem de produto, visita Meta, criação de ficha, seleção de remetente e funil inicial existem. O comportamento automático real depende das flags do VPS e deve ser validado sem usar cliente antigo.

Fonte: rotas `vsl-entry`, `VslVisit.js`, `ecuadorProductService.js`, `initialFunnelTriggers.js`, `sellerRotationService.js`.

Commit: contido em `dbe5f3a`.

Testes: origem de produto, atribuição Meta, funil manual e isolamento V13. Falta piloto novo fim a fim.

### 4.26 Multi-número

Estado do código: `PRODUÇÃO`; prontidão operacional: `INCOMPLETO`.

Há sessões configuráveis, afinidade por contato, capacidade por remetente, limites diário/horário, pausa e fallback. A consulta pública desta auditoria não comprovou um pool Baileys pronto; mostrou apenas a integração Z-API conectada e a sessão Baileys consultada não pronta. Também não existe teste unitário comportamental específico para rotação, afinidade, limite e failover.

Fonte: `src/whatsapp/connection.js`, `sessionRouter.js`, `outboundGuard.js`, `sendText.js`, `sendAudio.js`, `docs/WHATSAPP_POOL_ATE_6_NUMEROS.md`.

Commit: código contido em `dbe5f3a`, consolidado por `dd85054`.

Teste atual: somente guards estáticos de país/rota. Próxima ação é criar teste isolado antes de qualquer mudança operacional; não ativar números nesta etapa.

### 4.27 Extensão WhatsApp

Estado: versão existente em `PRODUÇÃO + CONGELADO`; V13/V15 em `IMPLEMENTADO LOCALMENTE + EM TESTE`.

Produção contém sidepanel, status, ficha, autosave, funis assistidos, ponte WA-JS e seleção de produto. O HEAD acrescenta versão `0.13.7`, isolamento V13 e inteligência V15. Não há evidência de que a pasta carregada no navegador operacional tenha sido atualizada para esse HEAD.

Fonte: `extensions/vitalismen-whatsapp-official/`.

Commits: base `3654f1e`/`dbe5f3a`; V13 `f8734e8`; V15 `a19c271`.

Testes: `15/15` testes da extensão passaram, incluindo integridade, autosave, extração, normalização, agência, funis, catálogo e ponte WA-JS.

### 4.28 Dashboard

Estado: páginas e integração internas em `PRODUÇÃO`; validação cruzada opcional do painel externo `INCOMPLETO`.

Produção contém janela de leads, rotas, sincronização de status e dashboard de métricas. O guard específico agora valida integralmente esta raiz e retorna aviso, sem falso erro, quando o componente externo não está disponível. A validação cruzada só acontece quando `MAXLIEN_APP_PATH` é informado ou o arquivo existe no ambiente integrado.

Fonte: `public/leads-window.html`, `src/routes/leads.js`, `adminPanelStatusService.js`, `public/funnel-metrics.html`.

Commits: `dd85054`, `b53e575`, ambos ancestrais de `dbe5f3a`.

Testes: `leads-window-status-merge`, `operational-chat-status`, testes de métricas. `guard:status-panels` passou localmente com aviso explícito de que a parte externa não foi validada.

### 4.29 Métricas

Estado do código implantado: `PRODUÇÃO + CONGELADO`.

A página e API de métricas consultam somente EC, exigem autenticação administrativa, usam janela civil do Equador, limitam período e devolvem `no-store`. O commit `b53e575` é ancestral da release real, então o código está em produção mesmo que o manifesto histórico V5 ainda diga `not_published`; esse campo do manifesto está desatualizado em relação à árvore implantada.

Fonte: `public/funnel-metrics.html`, `src/routes/funnelMetrics.js`, `src/services/funnelMetricsService.js`.

Commit: `b53e575`, contido em `dbe5f3a`.

Testes: `test:funnel-metrics` (`7/7`).

### 4.30 Inteligência de dados V15

Estado: `IMPLEMENTADO LOCALMENTE + CONGELADO + EM TESTE`; em produção: `AUSENTE`.

O conjunto V15 completo não existe em `dbe5f3a`. A produção tem a base anterior de formulário/normalização, mas não o serviço de OCR nem os refinamentos V15. Os testes locais passaram; não houve piloto, atualização da extensão operacional ou deploy.

Fonte: módulos e freeze V15 listados na seção 3.

Commit: `a19c271`.

Testes: OCR, formulário, normalização, extração, agência e guard V15.

## 5. Funcionalidades aprovadas e congeladas

Não devem ser alteradas por uma V16 genérica:

1. isolamento permanente EC e raiz oficial única;
2. coluna esquerda do painel sem conteúdo de mensagens;
3. funil A/B e regra de intenção forte antes da etapa rígida;
4. memória por contato/pedido e não repetição de etapa/mídia;
5. origem da VSL separada da seleção manual do pedido;
6. separação de Tex Ultra, Vit Power e Nitrix, inclusive textos, preços, mídias e funis;
7. seleção manual do produto atual como fonte estruturada;
8. agência Servientrega antes de domicílio, usando somente o catálogo oficial;
9. confirmação humana antes de envio do pedido ao Dropi;
10. recibo/lock/anti-duplicidade do Dropi;
11. Purchase somente para pedido confirmado, positivo e sem duplicidade;
12. atribuição Meta somente por evidência única e não ambígua;
13. intervenção humana com cancelamento das pendências automáticas;
14. anti-loop/anti-spam persistente;
15. status operacional e ajustes manuais sem mutar pedido/Dropi/Meta;
16. política de não rejeitar chamada automaticamente, congelada na V14;
17. contratos V15 de OCR manual, prévia, confirmação e exclusão de dados sensíveis, caso V15 seja promovida.

## 6. Implementado no HEAD, mas ainda não publicado

1. V13: isolamento dos funis manuais iniciais por produto.
2. V14: documentação e auditoria da política de chamadas, sem mudança de execução.
3. V15: refinamento de nome/localidade, CTA genérica por produto ativo e OCR manual assistido.
4. Hardening de origem de release canônica.
5. Remoção da credencial administrativa literal do painel público.
6. Bootstrap operacional e scripts de diagnóstico.

Os itens 4–6 não são novas funções comerciais. Nenhum deles está na produção `dbe5f3a`.

## 7. Funcionalidades em teste

- V13 e a extensão `0.13.7`: testes locais verdes, sem atualização do navegador operacional e sem piloto real.
- V15: testes locais verdes, sem piloto com imagem real controlada e sem deploy.
- mídia e áudio: inventário completo e guards verdes, mas sem teste real de entrega/reprodução nesta auditoria.
- bot/funil automático: motor e contratos presentes, mas ativação real não confirmada; exige piloto autorizado.
- multi-número: implementação presente, porém sem suíte comportamental e sem pool Baileys pronto comprovado.
- dashboard cruzado: páginas internas testadas, guard externo não autocontido.
- Dropi Tex Ultra/Nitrix: código protegido, porém flags, alvo real, sessão, saldo e pedido piloto não revalidados.

## 8. Problemas conhecidos realmente abertos

### Bloqueadores restantes antes de qualquer deploy

1. **Segurança do painel em produção:** `dbe5f3a` antecede `44504f2`; a remoção da credencial literal ainda não está na release. Antes de promoção, também é necessário rotacionar ou excluir no banco qualquer conta de teste equivalente, sem registrar o segredo.
2. **Flags ativas desconhecidas:** o acesso de auditoria não pode ler `.env`, o ambiente do processo root nem o endpoint administrativo. Bot, respostas automáticas, schedulers, rotação, habilitação Dropi por produto e Meta Purchase permanecem `NÃO CONFIRMADO`.
3. **Health operacional degradado:** `/api/health/` funciona, mas declara Baileys como primário, uma sessão em leitura de QR, zero sessão pronta e `no_connected_whatsapp_session`. O endpoint próprio da Z-API respondeu conectado; essa divergência precisa ser compreendida antes de ativar automações.
4. **V13/V15 sem piloto:** testes unitários não substituem navegador operacional, sessão real, banco, mídia, webhook e integração de transporte.
5. **Prontidão Dropi por produto:** Tex Ultra e Nitrix têm bloqueio explícito por flag/alvo. O guard de catálogo não prova que o ambiente ativo esteja habilitado.

### Dívida de documentação e teste

6. Os dois freezes citados diretamente por `AGENTS.md` foram restaurados exatamente do snapshot `71e10ec`. O documento restaurado também cita `approved_freezes/diff_congelamento_total_vitalismen_20260517_021215.patch`, que existe no histórico, mas não foi restaurado porque esta tarefa autorizou somente os dois artefatos ausentes identificados.
7. A documentação do funil ainda lista grupos de áudio como faltantes, embora o inventário atual tenha encontrado `27/27` grupos.
8. Documentos históricos divergem sobre flags de automação e pool de números; não devem substituir a leitura do ambiente ativo.
9. Não existe teste comportamental dedicado para afinidade, limite, pausa e failover multi-número.
10. O smoke test público deve usar `/api/health/`; o path legado `/health` continua apontando para a porta `5055` e responde `404`.
11. A parte cross-project do guard de status não foi validada porque nenhum `MAXLIEN_APP_PATH` foi fornecido nesta raiz.
12. Não há documento aprovado de requisitos da V16. Planos e backlogs históricos não devem ser convertidos automaticamente em escopo novo.

## 9. Funcionalidades que ainda queremos criar

Nenhuma nova funcionalidade V16 foi autorizada nesta auditoria. O que existe é uma lista de candidatos, não um compromisso de implementação:

1. **Contexto atual do cliente, somente assistivo:** uma visão única e auditável que reconcilie telefone, nome, cidade/província, origem da VSL, produto atual, pedido histórico e negociação atual, mostrando fonte, confiança e conflito antes de qualquer aplicação manual.
2. **Teste isolado do pool de números:** simular afinidade, capacidade, limite, pausa e failover sem sessão real e sem envio.
3. **Matriz de prontidão por produto para Dropi:** leitura administrativa das flags/alvos e motivo de bloqueio, sem oferecer botão de habilitação automática.
4. **Gate autocontido de painel/status:** validar somente componentes presentes na raiz ou declarar formalmente a dependência externa, sem acessar outro projeto por suposição.

Esses candidatos preservam o controle humano e não autorizam autoenvio, alteração de pedido ou ativação de infraestrutura.

## 10. Respostas executivas

### A. O que já funciona e não devemos tocar?

O núcleo de produção: painel e conversa central; transporte WhatsApp/Z-API; memória; funil A/B congelado; coleta determinística de dados; seleção estruturada de produto; separação Tex Ultra/Vit Power/Nitrix; catálogo Servientrega e agência/domicílio; pedidos; envio manual protegido ao Dropi; recibo e anti-duplicidade; Meta Purchase/CAPI; ponte de atribuição; mídia aprovada; intervenção humana; anti-loop; clientes antigos versus negociação atual; status e métricas internas. “Funciona” aqui significa código presente em `dbe5f3a`; onde depende de flag, o estado ativo ainda precisa ser comprovado.

### B. O que está pronto no HEAD mas ainda não chegou à produção?

V13, V14, V15, hardening de release, remoção da credencial literal e bootstrap. As funções novas propriamente ditas são o isolamento V13 e a inteligência assistida V15; V14 é política/documentação, e os hardenings são segurança/operação.

### C. O que precisa ser testado antes de qualquer deploy futuro?

1. preservar `senior:check` e `guard:status-panels` verdes;
2. quando uma mudança realmente envolver o painel externo, informar `MAXLIEN_APP_PATH` explicitamente e validar a integração sem copiar arquivos para esta raiz;
3. obter por canal autorizado as flags não secretas ainda não confirmadas: bot, respostas automáticas, schedulers, rotação, Meta e Dropi por produto;
4. piloto V13 da extensão e painel, produto por produto, sempre manual;
5. piloto V15 de nome, localidade e OCR com prévia/recusa/edição manual;
6. teste de cliente novo e antigo sem alterar histórico;
7. teste de agência e domicílio com cidade válida, ambígua e inexistente;
8. teste de mídia/áudio/codec e cancelamento por intervenção humana;
9. teste de multi-número sem envio real e, só depois, piloto operacional autorizado;
10. dry-run Meta e Dropi, seguido de um pedido controlado somente com autorização específica;
11. validação de segurança do painel e rotação/exclusão da conta de teste equivalente;
12. smoke test de painel, métricas, PM2/release e rollback antes de qualquer promoção.

### D. Quais são os problemas ainda realmente abertos?

Os bloqueios locais de documentação, HEAD, freezes e execução dos guards foram resolvidos. Continuam abertos: credencial removida apenas no HEAD; flags ativas sem evidência; health Baileys degradado apesar de Z-API conectada; V13/V15 sem piloto; Dropi Tex Ultra/Nitrix sem prontidão comprovada; validação cross-project não executada; patch histórico citado pelo freeze restaurado ainda ausente; documentação antiga de áudio/flags; multi-número sem teste comportamental; nenhum escopo V16 aprovado.

### E. Qual deve ser a primeira melhoria funcional da V16?

Nenhuma função nova deve começar antes de fechar os bloqueadores de segurança e os gates. Depois disso, a primeira melhoria funcional recomendada é **Contexto atual do cliente, somente assistivo**: consolidar no painel a origem e a confiança de nome, localidade, produto, pedido histórico e negociação atual por telefone, sem autoaplicar, autoenviar ou alterar pedidos. É a menor evolução que aproveita a V15, reduz erros com clientes antigos/novos e prepara multi-número sem tocar no motor congelado do bot.

## 11. Tabela final

| FUNCIONALIDADE | PRODUÇÃO | HEAD LOCAL | TESTE | CONGELADA? | PRÓXIMA AÇÃO |
| --- | --- | --- | --- | --- | --- |
| Painel integrado | Sim, V12 | V13/V15 + hardening | Local verde; segurança verde no HEAD | Sim | Piloto visual e promover segurança antes do restante |
| WhatsApp/Z-API | Código sim; Z-API conectada | Igual no núcleo | Guards estáticos verdes | Sim | Revalidar flags e não testar com cliente real sem autorização |
| Bot | Motor sim; ativação não comprovada | Igual à produção | Contexto/guards verdes; piloto ausente | Sim | Ler flags por canal autorizado e fazer piloto controlado |
| Funil A/B | Código sim; operação ativa não comprovada | Núcleo igual; V13 manual adicional | Testes locais verdes | Sim | Não alterar núcleo; validar piloto |
| Captura do nome | Base sim | Refinamento V15 | Verde | Parcialmente | Pilotar conflitos e prioridade da edição manual |
| Memória do cliente | Sim | Igual | Guards e testes indiretos verdes | Sim | Não refazer; adicionar teste de reconciliação se V16 aprovada |
| Dados completos | Base sim | OCR/normalização V15 | Verde local | Sim | Pilotar sem autoaplicar |
| Seleção de produto | Sim, V12 | Isolamento V13 | Verde | Sim | Validar três produtos manualmente |
| Tex Ultra | Sim | Bloco V13 | Verde local | Sim | Revalidar Dropi e piloto do bloco manual |
| Vit Power | Sim | Sem mudança no núcleo | Verde local; piloto ausente | Sim | Preservar A/B e verificar ativação |
| Nitrix Oxide | Sim | Sem mudança relevante pós-V12 | Guards verdes | Sim | Revalidar alvo Dropi antes de envio |
| Dropi | Manual protegido sim | Mesma base | Catálogo/recibo/sync verdes; sem envio | Sim | Verificar sessão, saldo, flags e um piloto autorizado |
| Servientrega | Sim | Normalização V15 | Verde | Sim | Pilotar casos ambíguos |
| Agência/domicílio | Sim | Robustez V15 | Verde | Sim | Teste controlado de contexto e confirmação |
| Pedidos | Sim | Igual no núcleo | Verde | Sim | Preservar histórico e autorização manual |
| Meta Purchase/CAPI | Sim | Igual | Dry payload verde | Sim | Dry-run antes de qualquer evento real |
| Atribuição Meta | Sim | Ajustes de teste V15 | `8/8` | Sim | Validar observabilidade, sem retroenvio |
| Áudios | Arquivos/serviços sim | Igual | 27/27 grupos; sem teste real | Sim | Testar codec, ordem e cancelamento em piloto |
| Imagens | Envio sim | OCR V15 | Verde local | Sim | Pilotar prévia/recusa |
| Respostas automáticas | Código sim; ativação incerta | Igual | Guards verdes; piloto ausente | Sim | Não ativar até ler flags e autorizar piloto |
| Intervenção humana | Sim | Igual | Verde | Sim | Preservar prioridade humana |
| Anti-loop/anti-spam | Sim | Igual | Guards verdes | Sim | Teste de concorrência antes de deploy |
| Chamadas | Código suporta política | Política V14 documentada | Auditor parcial | Sim | Comprovar `false` no ambiente ativo |
| Clientes antigos | Sim | Igual | Verde | Sim | Manter pedido histórico imutável |
| Clientes novos | Código sim | V13/V15 adicionam assistência | Local verde; fim a fim ausente | Sim | Piloto novo controlado |
| Multi-número | Código sim; pool pronto não comprovado | Igual | Teste comportamental ausente | Não formalmente | Criar teste isolado; não ativar agora |
| Extensão WhatsApp | Base sim | `0.13.7` V13/V15 | `15/15` | Sim em partes | Piloto manual e verificação da versão carregada |
| Dashboard | Interno sim | Igual | Guard local verde; parte externa não confirmada | Sim em partes | Usar `MAXLIEN_APP_PATH` somente quando a integração externa entrar no escopo |
| Métricas | Sim em `dbe5f3a` | Igual | `7/7` | Sim | Corrigir metadado histórico divergente |
| Inteligência V15 | Não | Sim | Verde local; piloto ausente | Sim | Pilotar e só então decidir promoção |
| Escopo funcional V16 | Não | Não | Não aplicável | Não | Aprovar requisito antes de programar |

## 12. Limite desta auditoria

Na auditoria funcional inicial, esta tarefa criou apenas este documento. O saneamento posterior ficou limitado a documentação, restauração de dois artefatos históricos e ajuste do guard de status. Não houve implementação V16, commit, push, merge, alteração de branch, alteração de staging, deploy, alteração de produção, envio a cliente, envio ao Dropi, evento Meta ou alteração de banco.

## Bloqueadores pré-V16 — estado após saneamento

Data do saneamento: 2026-08-16.

### 1. `senior:check`

Estado final: **VERDE, exit code 0**.

A regra `forbiddenContextPatterns` de `scripts/senior-guard.mjs` percorre os arquivos Markdown em `docs/` e rejeita nomes de contextos externos. Uma linha de isolamento em `docs/INFRAESTRUTURA_OFICIAL.md` citava nominalmente um país externo justamente para proibi-lo; a menção negativa também satisfazia a expressão regular. O texto foi generalizado para “projetos de outros paises ou operacoes externas”, preservando a proibição sem acionar o padrão.

Resultado final do comando:

- guard V15: passou;
- testes V13/V12/isolamento EC: `13/13` passaram;
- `senior-guard`: passou;
- falhas totais: `0`.

### 2. `guard:status-panels`

Estado final local: **VERDE, exit code 0, com aviso explícito**.

O guard esperava um `app.py` por uma destas fontes:

1. `MAXLIEN_APP_PATH`, quando informado;
2. `.codex-tmp/status-align/maxlien/app.py`;
3. `/opt/maxlien-mvp/app.py` em ambiente não Windows.

Esse `app.py` não pertence a esta worktree e sua ausência produzia falso erro local, seguido de várias asserções sobre corpo vazio. Foi adotada a solução C: formalizar a parte cross-project e impedir falso erro local. O guard continua bloqueando regressões em `public/qr.html`, rotas e serviço desta raiz. Se o arquivo externo existir, ele continua sendo validado integralmente; se `MAXLIEN_APP_PATH` for informado explicitamente e estiver inválido, o comando continua falhando. Nenhum código externo foi copiado.

### 3. Documentação do HEAD

Estado final: **CORRIGIDA**.

- `docs/INFRAESTRUTURA_OFICIAL.md` agora registra `36a6fb3c1421f888711aec938292abbd1e0b153b` como HEAD operacional atual e mantém `44504f2` como hardening histórico.
- `docs/FONTE_OFICIAL_GITHUB_VPS_WINDOWS.md` agora registra `36a6fb3c1421f888711aec938292abbd1e0b153b` como HEAD operacional atual.
- a ref local `staging` continua documentada em `44504f2`, porque esse é o estado real da branch e não uma referência obsoleta ao HEAD atual.
- referências históricas de `44504f2` na evolução V15/hardening foram preservadas.

### 4. Freezes ausentes

Estado final: **LOCALIZADOS E RESTAURADOS COM IDENTIDADE EXATA**.

Artefatos:

- `docs/CONGELAMENTO_TOTAL_VITALISMEN_2026-05-17.md`;
- `approved_freezes/CONGELADO_TOTAL_VITALISMEN_20260517_021215.txt`.

Evidência:

- ambos existem juntos no snapshot oficial `71e10ece955645b8e5765b27190056f53eeb8e2b`;
- o documento principal também existe com o mesmo blob em `b3751b7` e `0d56d3c`;
- não foi encontrada evidência de renomeação ou substituição equivalente;
- blob restaurado do documento: `b39a6415673387d989acf268d50ea675547f0826`;
- blob restaurado do registro aprovado: `44b371d109c302c0970eef2e19f8ce3a2ac48a64`.

O documento restaurado cita um patch histórico adicional que continua ausente da árvore atual. Esse terceiro artefato não foi restaurado porque a autorização desta tarefa se restringiu aos dois arquivos referenciados diretamente por `AGENTS.md`.

### 5. Flags operacionais do VPS

Nenhum `.env` foi aberto e nenhum valor secreto foi impresso. A `.env`, o ambiente `/proc` do processo e o PM2 root não são legíveis pelo usuário de auditoria; `/api/automation/status` exige autenticação e respondeu `401` sem credenciais.

| Pergunta | Estado comprovado | Evidência segura |
| --- | --- | --- |
| Bot ativo? | `NÃO CONFIRMADO` | a flag não está em endpoint público seguro |
| Respostas automáticas ativas? | `NÃO CONFIRMADO` | `WHATSAPP_AUTO_REPLY_ENABLED` não pôde ser lida |
| Schedulers ativos? | `NÃO CONFIRMADO` | flags de scheduler não estão expostas sem autenticação |
| Multi-número ativo? | `NÃO CONFIRMADO` | uma sessão Baileys foi listada, em leitura de QR, com zero sessão pronta; rotação não é exposta |
| Dropi por produto habilitado? | `NÃO CONFIRMADO` | flags Tex Ultra/Nitrix e alvos não estão expostos com segurança |
| Meta Purchase habilitado? | `NÃO CONFIRMADO` | presença do Pixel/token não é exposta sem autenticação |

Informação adicional comprovada sem segredo:

- Z-API está habilitada, configurada e conectada;
- `/api/health/` declara Baileys como motor primário, `WHATSAPP_CONNECT_ENABLED=true`, zero sessão pronta e estado degradado por `no_connected_whatsapp_session`;
- a divergência entre motor primário e Z-API conectada deve ser resolvida por leitura autorizada de configuração, não por suposição.

Uma consulta inicial ao CLI PM2 como usuário restrito iniciou um daemon vazio no perfil desse usuário. Foi confirmado que ele gerenciava zero processos; o daemon foi encerrado e a pasta de metadados criada pela consulta foi removida. O PM2 root, o processo `vitalismen-automation`, a release e a configuração de produção não foram acessados ou reiniciados por esse CLI.

### 6. `/health`

Causa provável com alta confiança: **roteamento do proxy para a porta errada para esse path legado**.

- `src/index.js` registra `GET /health` na aplicação Node;
- `127.0.0.1:3001/health` responde `200`;
- `127.0.0.1:3001/api/health` responde `200` pela rota de observabilidade;
- `127.0.0.1:5055/health` responde `404` pelo serviço legado;
- `https://ec.maxlien.shop/health` responde `404`;
- `https://ec.maxlien.shop/api/health` redireciona para o path com barra final;
- `https://ec.maxlien.shop/api/health/` responde `200`.

O arquivo Nginx ativo do domínio está com permissão `0600` e não pôde ser lido pelo usuário de auditoria. Um backup legível mostra o desenho histórico de `/health` para `127.0.0.1:5055/health`, e o comportamento atual das duas portas é consistente com esse roteamento. O path público correto para a automação é `/api/health/`. Nenhum arquivo Nginx foi alterado e nenhum serviço foi recarregado.

### 7. Arquivos alterados pelo saneamento

- `docs/BASE_FUNCIONAL_V16.md`;
- `docs/INFRAESTRUTURA_OFICIAL.md`;
- `docs/FONTE_OFICIAL_GITHUB_VPS_WINDOWS.md`;
- `scripts/guard-status-panels-freeze.mjs`;
- `docs/CONGELAMENTO_TOTAL_VITALISMEN_2026-05-17.md`, restaurado do histórico;
- `approved_freezes/CONGELADO_TOTAL_VITALISMEN_20260517_021215.txt`, restaurado do histórico.

Nenhum arquivo de `src/`, `public/`, extensão funcional, modelo, rota funcional ou configuração de produção foi alterado.

### 8. Riscos restantes

1. flags operacionais solicitadas permanecem `NÃO CONFIRMADO`;
2. health declara Baileys primário degradado, apesar de a Z-API responder conectada;
3. a validação cross-project do painel não foi executada;
4. o patch histórico citado pelo freeze restaurado continua ausente;
5. o hardening de credencial pública continua somente no HEAD, não em produção;
6. V13/V15 continuam sem piloto operacional;
7. Dropi Tex Ultra/Nitrix continua sem prontidão ativa comprovada;
8. multi-número continua sem teste comportamental dedicado;
9. não existe escopo funcional V16 aprovado.

### 9. Prontidão para iniciar V16

Estado: **PRONTO COM CONDIÇÃO PARA DESENVOLVIMENTO LOCAL; NÃO PRONTO PARA DEPLOY**.

Os gates locais e a documentação operacional estão saneados. Antes de iniciar código V16, este conjunto documental/operacional deve ser consolidado separadamente para não ser misturado com uma futura alteração funcional, e o operador deve aprovar o escopo V16. As flags não confirmadas e o health degradado bloqueiam ativação/deploy, mas não impedem desenvolvimento local isolado depois dessa separação.

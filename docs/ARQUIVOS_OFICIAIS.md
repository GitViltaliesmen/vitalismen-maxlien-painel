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

Pode baixar arquivo oficial para `.codex-tmp/` apenas para preparar diff. Depois:

1. Validar a copia local.
2. Criar backup do arquivo oficial.
3. Subir a copia corrigida para o caminho oficial.
4. Validar em producao.

Se a tarefa envolver site online, sempre perguntar: "qual URL/caminho oficial?" quando isso nao estiver claro.

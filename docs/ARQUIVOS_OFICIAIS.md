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
- Endpoint backend esperado pela VSL publica: `POST /api/lead`
- O endpoint `POST /api/lead` deve registrar o rascunho, preservar `fbclid/fbc/fbp/UTMs/sourceUrl` e enviar `Lead` via Meta CAPI usando o mesmo `event_id` da VSL para deduplicacao.
- Copia local de preparacao: `.codex-tmp/vps-vsl/maxlien-m-index.html`
- Ultimo backup conhecido antes do ajuste de mensagens CTA:
  - `/root/codex_deploy_backups/maxlien-m-index-before-cta-messages-20260506-030628.html`
- Ultimo ajuste oficial:
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
  - `public/media/templates/EC/Inicio_01.ogg`
  - `public/media/templates/EC/Inicio_02.ogg`
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

## Como trabalhar com copia temporaria

Pode baixar arquivo oficial para `.codex-tmp/` apenas para preparar diff. Depois:

1. Validar a copia local.
2. Criar backup do arquivo oficial.
3. Subir a copia corrigida para o caminho oficial.
4. Validar em producao.

Se a tarefa envolver site online, sempre perguntar: "qual URL/caminho oficial?" quando isso nao estiver claro.

# FREEZE - EC Leitor Atento Bot + Reset 8637 - 2026-06-22

## Problema

O bot precisava usar a camada de Leitor Atento no atendimento automatico, nao apenas no Observador. O numero piloto `5515998038637` tambem continuava preso em memoria de compra finalizada/order_closed e nao reiniciava teste real no WhatsApp `553183002800`.

## Correcao

- `src/services/conversationEngine.js`
  - Leitor Atento plugado antes de respostas genericas, data/agendamento e fallback.
  - Autoenvio limitado a categorias de alta confianca: preco, prostatitis, logistica/agencia e acolhimento.
  - Audio automatico limitado a preco e prostatitis para evitar rajada.
  - Flags:
    - `ATTENTIVE_READER_BOT_ENABLED=true`
    - `ATTENTIVE_READER_BOT_MIN_CONFIDENCE=0.82`
- `src/services/observerAttentiveReaderService.js`
  - Reconhece preco sem quantidade e responde promocao `1/3/6`.
  - Reconhece prostatitis/prostata e sugere `Ajuda_Prostata`.
  - Logistica/Servientrega antes de data.
  - `Ricaurte` sozinho pede cidade/provincia.
  - `Ricaurte Babahoyo` confirma agencia correta.
  - Cidades com muitas agencias perguntam setor/nome/localizacao.
  - `otras/mas` continua numeracao em blocos `5-8`, `9-12`.
- `scripts/eval-observer-attentive-reader.mjs`
  - Eval automatizado com casos reais do funil.

## Deploy Publico

- VPS: `/opt/vitalismen-automacao/current`
- Backup remoto: `backups/attentive-reader-bot-20260622/`
- Processo reiniciado:
  - `pm2 restart vitalismen-automation --update-env`
  - `vitalismen-automation` voltou `online`.

## Reset 8637

- Executado no VPS publico.
- Backup: `/opt/vitalismen-automacao/releases/202606141310/backups/reset-8637-attentive-reader-20260622`
- Resultado:
  - `statesMatched=1`
  - `statesModified=1`
  - `messagesDeleted=2`
  - `dedupeDeleted=2`
  - `messagesAfter=0`
  - `dedupeAfter=0`
- Estado final:
  - `human.mode=auto`
  - tags `TESTE_8637_PRIORIDADE`, `TESTE_FIXO_NAO_MEXER`, `BOT_TESTE_LIBERADO`
  - `metadata.botTestEnabled=true`
  - `metadata.noDropiEver=true`
  - `metadata.lastKnownFunnelStage=''`
  - `metadata.orderStatus=''`
  - `metadata.perAgentMemory.vit_power_ec={}`

## Evidencia

- Local:
  - `node --check src/services/observerAttentiveReaderService.js` OK
  - `node --check src/services/conversationEngine.js` OK
  - `node scripts/eval-observer-attentive-reader.mjs` OK
- VPS:
  - `node --check src/services/observerAttentiveReaderService.js` OK
  - `node --check src/services/conversationEngine.js` OK
  - `node scripts/eval-observer-attentive-reader.mjs` OK
  - `node scripts/audit-funil-context-rules.mjs` OK
- API publica:
  - `https://ec.maxlien.shop/api/zapi/status`: conectado, phone `553183002800`, device `Ana Lopez 2800`
  - `https://ec.maxlien.shop/api/whatsapp/messages/5515998038637?fast=1&limit=10`: `[]`

## Regra Operacional

Para testar com `8637`, usar sempre o VPS publico. O numero esta liberado para teste do bot automatico e protegido contra Dropi por `metadata.noDropiEver=true`.

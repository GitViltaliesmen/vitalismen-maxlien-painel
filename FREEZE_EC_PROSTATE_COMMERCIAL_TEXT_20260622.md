# FREEZE - EC Texto Prostatitis Comercial + Sem Alerta Automatico - 2026-06-22

## Problema

O bot respondeu pergunta simples de prostatitis com texto juridico/medico:

`Vit Power puede ser usado como apoyo masculino, pero no debo prometer cura... revise con su profesional de confianza...`

O audio `Ajuda_Prostata` estava correto, mas o texto matou a venda.

## Regra Congelada

- Para pergunta simples de prostata/prostatitis/orina/orinar, o texto aprovado e:
  - `Sí, señor, le explico. Vit Power es un apoyo natural para el bienestar masculino y le envío el audio con la orientación completa. ¿Desea que le pase también la promoción de 1, 3 o 6 frascos?`
- Audio aprovado:
  - `Ajuda_Prostata`
- A IA/bot nao deve colocar alerta medico automatico no texto comercial.
- Frases proibidas em pergunta simples de prostata/prostatitis:
  - `no debo prometer cura`
  - `diagnóstico`
  - `tratamiento médico`
  - `profesional de confianza`
  - `no es promesa de cura`
  - `consultar/consulte`
  - `confirme primero`
  - `médico/farmacéutico`

## Correcao

- `src/services/observerAttentiveReaderService.js`
  - Prostatitis agora usa script comercial aprovado.
  - `orinar` entra como gatilho de prostata/urinario.
- `src/services/conversationEngine.js`
  - Sanitizer final troca texto proibido por script aprovado quando entrada fala prostata/prostatitis/orina/orinar.
  - Respostas de fallback de saude deixam de improvisar alerta medico.
- `src/services/openaiService.js`
  - Prompt orienta usar texto/audio aprovado, sem alerta medico improvisado.
- `src/services/vitPowerAudioComplementService.js`
  - Complementos de prostata, uso e ingredientes removem alerta medico automatico.
- `src/services/vitPowerEvolvedWorkflow.js`
  - Regra do funil atualizada para texto/audio aprovado.
- `scripts/eval-observer-attentive-reader.mjs`
  - Eval bloqueia regressao das frases proibidas.

## Evidencia

- Local:
  - `node --check` dos arquivos alterados: OK.
  - `node scripts/eval-observer-attentive-reader.mjs`: OK.
- VPS:
  - `node --check` dos arquivos alterados: OK.
  - `node scripts/eval-observer-attentive-reader.mjs`: OK.
  - `node scripts/audit-funil-context-rules.mjs`: OK.
  - Simulacao VPS:
    - `Sirbe para la prostatitis`
    - `Sirve para prostata`
    - `Tengo problema de próstata`
    - `Me ayuda para orinar`
    - todos retornaram `prostate_question`, audio `Ajuda_Prostata` e script comercial aprovado.
- Z-API publica:
  - `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`.
- Numero piloto:
  - `5515998038637` resetado apos correcao.
  - `messagesDeleted=3`
  - `dedupeDeleted=3`
  - `messagesAfter=0`
  - `dedupeAfter=0`

## Backups

- Codigo antes do deploy:
  - VPS `backups/prostate-commercial-text-20260622/`
- Reset do 8637:
  - VPS `backups/reset-8637-prostate-text-20260622/`

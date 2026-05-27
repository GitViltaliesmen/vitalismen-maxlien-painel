# CONGELADO_CAMADA_CADENCIA_HUMANA_ZAPI_WHATSAPP_20260527

Data: 2026-05-27

Objetivo: manter os funis aprovados sem rajada de mensagens, com cadencia segura e experiencia mais natural para o cliente.

Escopo congelado:
- Nao altera a logica dos funis principais, camada de 2 frascos, pos-fechamento, domicilio, cidade/provincia ou objeções.
- Atua somente na camada comum de envio usada pelos funis: texto, audio, imagem e video.
- Mantem dedupe, guarda de destinatario, fila por contato e logs de pacing.

Regras aplicadas:
- Todo envio por Baileys continua usando presence real:
  - texto/imagem/video: composing
  - audio/PTT: recording
- Todo envio por Z-API usa espera equivalente antes do envio:
  - sem fingir presence quando a API nao expõe recurso de digitando/gravando
  - loga como `composing:wait-only` ou `recording:wait-only`
- Todo contato passa por fila propria antes do envio.
- Existe intervalo global aleatorio entre envios para reduzir rajadas entre contatos.
- Existe pausa apos cada envio:
  - texto: `WHATSAPP_HUMAN_AFTER_TEXT_MIN_MS/MAX_MS`
  - audio: `WHATSAPP_HUMAN_AFTER_AUDIO_MIN_MS/MAX_MS`
  - midia: `WHATSAPP_HUMAN_AFTER_MEDIA_MIN_MS/MAX_MS`
- Audio pode aguardar por duracao real do arquivo quando `WHATSAPP_AUDIO_WAIT_BY_DURATION=true`.
- Rota manual `/api/zapi/send-text` nao faz parte do funil conversacional e nao foi considerada comportamento aprovado para disparo automatico.

Arquivos principais:
- `src/whatsapp/humanPacing.js`
- `src/whatsapp/sendText.js`
- `src/whatsapp/sendAudio.js`
- `src/whatsapp/sendImage.js`
- `src/whatsapp/sendVideo.js`

Observacao de seguranca:
- Esta camada nao foi feita para burlar plataforma.
- A finalidade e reduzir repeticao, excesso de mensagens, rajadas e respostas fora de contexto.
- Qualidade de atendimento, consentimento, opt-out, janela de conversa e limites oficiais continuam sendo responsabilidade da operacao.

# Freeze EC VSL/Z-API Auto-Resolvedor - 2026-06-23

## Problema

Lead VSL EC entrou pela Z-API `553183002800`, mas a resposta podia tentar sair por sessao Baileys quando `sessionId` vinha como numero. Isso atrasava ou impedia a primeira resposta e podia deixar de enviar o audio inicial.

## Correcao Aplicada

- Entrada VSL EC continua detectando `Hola, acabo de ver el video`, `Nombre completo` e `Telefono`.
- Entrada VSL EC roteia com `sessionId: zapi`.
- `vsl_entry_lead` foi autorizado no Leitor Atento automatico.
- Audio inicial VSL agora usa saudacao oficial por horario:
  - `01_B_Buenos_dias`
  - `01_C_Buenos_tardes`
  - `01_A_buenas_noches`
- Texto VSL conduz para promocao 1/3/6 sem assumir compra de 1 frasco.
- `sendText` e `sendAudio` ganharam fallback unico para Z-API quando Baileys/sessao falhar.
- Fallback registra `metadata.senderWallet.fallbackToZapi*` no `ContactState`.
- Watchdog VSL reprocessa com `recovered: true` se nao houver outbound apos o prazo configurado.

## Arquivos

- `src/routes/zapi.js`
- `src/services/agentRouter.js`
- `src/services/conversationEngine.js`
- `src/whatsapp/sendText.js`
- `src/whatsapp/sendAudio.js`
- `scripts/eval-observer-attentive-reader.mjs`

## Backup VPS

Backup criado antes do deploy:

- `/opt/vitalismen-automacao/current/backups/vsl-zapi-autoresolver-20260623023910`

## Validacao

Local:

- `node --check` nos arquivos alterados: OK
- `node scripts/eval-observer-attentive-reader.mjs`: OK
- Caso `Pedro Carbo` classificado como `vsl_entry_lead`, nao agencia/cidade: OK

VPS:

- `node --check` nos arquivos alterados: OK
- `node scripts/eval-observer-attentive-reader.mjs`: OK
- `pm2 restart vitalismen-automation --update-env`: OK
- `https://ec.maxlien.shop/api/health`: `status=online`, `engine=Z-API`, `ready=true`
- `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`, `Ana Lopez 2800`

## Regra Congelada

Para VSL EC no WhatsApp `553183002800`, a saida oficial e Z-API. Se uma camada tentar sair por Baileys e falhar por sessao, o auto-resolvedor tenta Z-API uma unica vez e registra auditoria. O audio inicial nao deve ser removido da categoria `vsl_entry_lead`.

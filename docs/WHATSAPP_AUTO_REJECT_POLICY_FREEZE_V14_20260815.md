# Freeze v14 — política de chamadas recebidas

Data: 2026-08-15
País: Ecuador (`EC`)

## Decisão operacional

`WHATSAPP_AUTO_REJECT_CALLS=false` é a política operacional aprovada. O exemplo de ambiente e o auditor oficial passam a registrar e exigir esse mesmo valor.

Com `false`, o tratamento de uma oferta de chamada registra somente o diagnóstico técnico e encerra o processamento antes de `rejectCall`. Consequentemente, essa chamada não provoca rejeição automática, envio de áudio, envio de texto nem gravação de resposta automática.

## Escopo e preservação

- nenhuma alteração foi feita em `src/whatsapp/connection.js` ou em outro código de execução;
- o freeze v13 e todos os freezes anteriores permanecem inalterados;
- a `.env` ativa, a VPS, o PM2, clientes, banco, WhatsApp real, Dropi, Meta e Z-API permanecem fora do escopo;
- esta camada não atualiza dependências e não cria envio automático;
- a publicação desta camada limita-se ao GitHub; a ativação na VPS exige autorização operacional separada.

## Rollback

O rollback no Git consiste em retornar ao commit pai `f8734e87b6f75a4c97c4988bf495d2ac09bc1c87`. Nenhum rollback operacional é necessário enquanto esta camada não for publicada na VPS.

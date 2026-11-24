# V268 — envio manual de mídia pelo dispositivo vinculado

## Problema observado

No painel EC, a conversa de Roman Cardenas exibiu áudio e imagem de 24/11/2026 como `não enviado`. O runtime V267 opera em `baileys_text`: a trava de transporte recusava toda mídia antes de alcançar o socket, e a trava de canário não admitia superfícies de áudio, imagem, vídeo ou documento para clientes EC. A classificação do painel também não reconhecia o recibo de mídia do dispositivo vinculado.

## Alteração delimitada

- Admitir mídia somente a partir de `/api/whatsapp/send` com sessão autenticada, `sendMode=manual_panel`, país `EC` e autoridade selada atual do dispositivo vinculado.
- Permitir apenas as superfícies manuais de mídia na trava de canário. O funil automático continua sem envio de mídia por esse transporte.
- Fazer uma única tentativa para cada mídia manual. Resultado sem ID do provedor ou erro após a tentativa permanece `sem confirmação`, exigindo conferência no celular antes de novo envio.
- Registrar o ID retornado pelo socket e exibir `enviado` somente com esse recibo. `Enviado` significa aceite pelo dispositivo, não leitura pelo cliente.
- Guardar novas mídias recebidas no armazenamento compartilhado já usado para uploads, mantendo a URL `/media/inbound/...`. O arquivo gerado no release V267 deve ser copiado e conferido por hash antes da ativação; após parar V267, movê-lo para o compartilhado para que o release anterior volte a passar no selo.

## Preservado

VSL, CTA, número, inbound, respostas de texto, funis, pedidos, Dropi, Meta, agendadores e mídia automática. Nenhuma mídia antiga foi reenviada ao cliente. A autoridade V267 permanece disponível para rollback.

## Gates de publicação

Executar testes de política, classificação de recibo, lint, guard de produto e senior guard no release materializado. Antes de ativar, comparar hashes com V267 e guardar o release e a autoridade anteriores. Após ativar, confirmar PM2 no release novo, health e sessão vinculada. Fazer um teste manual de áudio e imagem somente com o contato de QA autorizado, com um recibo por item e persistência após recarga. Não repetir envio cujo resultado seja incerto.

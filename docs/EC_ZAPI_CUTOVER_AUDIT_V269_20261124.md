# V269 — auditoria do desvio manual para Z-API

## Evidência observada

Em 24/11/2026, um áudio e uma imagem enviados pelo painel ao contato de QA `5515998038637` ficaram como `não enviado`, sem ID do provedor. Não houve reenvio. O PM2 do release V268 permaneceu online e a sessão do dispositivo vinculado apareceu conectada no health.

## Primeira quebra encontrada

O painel usa o país da ficha selecionada. Para o contato brasileiro de QA, esse país pode ser `BR`. A rota `/api/whatsapp/send` autorizava mídia manual somente quando `country === 'EC'`, recusando a tentativa antes de chamar o socket. A mesma rota forçava `effectiveSessionId = 'zapi'` para o contato de QA e para números EC, mesmo quando `EC_WHATSAPP_TRANSPORT=baileys_text`. Com isso, um teste manual não provava o transporte vinculado.

## Candidata local

- Em modo `baileys_text`, a rota não força mais a sessão `zapi` para envio manual.
- Apenas o telefone de QA já autorizado pode receber mídia manual EC quando sua ficha informa `BR`. Outros números brasileiros continuam fora dessa exceção.
- A mídia de clientes EC continua exigindo autenticação, `sendMode=manual_panel`, país EC e autoridade selada atual.

## Varredura de referências

Uma busca em `src`, `public` e `scripts` encontrou 203 arquivos com `zapi`, `z-api` ou `zaap` (113 em `src`, 5 em `public`, 85 em `scripts`). São referências de runtime, compatibilidade, testes, registros históricos e rollback. O roteador `src/whatsapp/zapiOutboundRouting.js` já retorna `false` quando o modo vinculado está ativo; o painel mostra o dispositivo vinculado em vez do cartão legado nesse modo. Não se deve apagar esses arquivos em massa: a autoridade selada e os guards ainda dependem de hashes de vários deles.

## Validação e publicação

Os testes de transporte, recibo de mídia e isolamento de canário passaram localmente, assim como o lint. O teste de recuperação V115 exige módulo instalado somente no VPS. O guard V129 usa um hash antigo de `public/qr.html` e já diverge do V268 ativo; ele não serve como aprovação desta candidata. A correção requer sucessor selado próprio e teste real de **novos arquivos** de áudio e imagem com recibo do dispositivo, sem repetir os dois resultados incertos. Até lá, V268 continua sendo o release de produção.

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

Os testes de transporte, recibo de mídia e isolamento de canário passaram localmente, assim como o lint. O teste de recuperação V115 exige módulo instalado somente no VPS. O guard V129 usa um hash antigo de `public/qr.html` e já diverge do V268 ativo; ele não serve como aprovação desta candidata.

Em 24/11/2026, o sucessor selado V269 foi registrado para o commit `60bf27ec1472d52e2bc27a8ead2d984baba7e045`, com hashes e ativação próprios. O preflight selado, o senior guard isolado e os testes dirigidos passaram no VPS. A execução longa de `npm run senior:check` encontrou a expectativa histórica `if (zapi.configured.enabled)` no teste de health, embora `src/routes/health.js` não tenha mudado entre V268 e V269; a suíte foi interrompida depois do teste 289 para liberar recursos durante a recuperação de produção. Não registrar a suíte completa como aprovada.

O backup anterior à troca está em `/var/lib/vitalismen-deploy/v269-preactivation-backup-20261124/`. A primeira reinicialização foi revertida quando o health público ainda retornava 502 durante o preload. Após confirmar que o V268 também demora aproximadamente dois minutos para abrir a porta, a V269 foi ativada novamente e iniciou dentro dessa janela. `current` aponta para `20261124T162817Z_production-20261124-60bf27e`; PM2 está online com `pm_cwd` e `pm_exec_path` em `current`, `EC_WHATSAPP_TRANSPORT=baileys_text`; `/api/health/` respondeu HTTP 200 com sessão vinculada pronta. V268 permanece íntegro para rollback.

## Prova real de mídia manual

Após confirmação do operador para dois envios de QA, o painel enviou exatamente uma vez cada arquivo novo ao contato exclusivo `5515998038637`:

| Arquivo | Registro persistido | Recibo do dispositivo vinculado | Estado após recarga |
| --- | --- | --- | --- |
| `QA_V269_AUDIO_673HZ.mp3` | `manual_1795550954518_34e29429` | `3EB056E580C02DFFF3C939` | `sent`, provedor `baileys` |
| `QA_V269_IMAGEM.png` | `manual_1795550986260_1d9d2efa` | `3EB0EC85305FBC0C8DB5D9` | `sent`, provedor `baileys` |

Os dois registros apareceram no chat depois de recarregar o painel. A consulta somente leitura da base de QA encontrou zero pedidos, zero ciclos Dropi e zero eventos Meta para esse contato. Os IDs distintos demonstram que não houve duplicação desses dois arquivos. As três tentativas anteriores continuam com `request_failed` e sem ID de provedor; não foram repetidas.

**Pendente:** confirmar que ambos os arquivos chegaram ao telefone de QA. O recibo `sent` do dispositivo e a persistência no painel não substituem essa observação. Se faltar recebimento, interromper novos envios e restaurar V268. Até a confirmação, não declarar mídia manual funcional.

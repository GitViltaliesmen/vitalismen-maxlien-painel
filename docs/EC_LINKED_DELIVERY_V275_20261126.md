# V275 — recibos do WhatsApp vinculado e recuperação de mensagem

## Escopo e evidência

A release ativa na auditoria foi V274 (`20261126T024208Z_production-20261126-4d8efd8`). Os hashes de `connection.js`, `qr.html` e do classificador do painel no checkout coincidiam com os da release ativa. O PM2 estava online e apontava para `current`. Nenhuma mensagem de cliente foi reenviada.

Os prints de 25 e 26/11 mostram bolhas “Aguardando mensagem” no WhatsApp Business, um tique “enviado” no painel e registros antigos “não enviado”. Isso não comprova entrega nem falha definitiva das mensagens individuais. Logs do dispositivo vinculado contêm `failed to decrypt message`/`No session record` para uma mensagem inbound, sem vínculo comprovado com as bolhas dos prints. O socket V274 não registrava `messages.update` nem `message-receipt.update`; a configuração Baileys usava `getMessage` padrão, que retorna `undefined` quando o WhatsApp solicita recuperação do conteúdo.

## Candidata local

- `src/whatsapp/linkedDeliveryReceipts.js` normaliza a escala Baileys (2/3/4/5) para a escala histórica do painel (1/2/3), identifica a mensagem exclusivamente pelo ID retornado pelo dispositivo e só avança o estado com recibo posterior.
- `src/whatsapp/linkedRetryMessageStore.js` guarda o conteúdo protobuf **das novas mensagens enviadas** sob a pasta privada de autenticação, com nome derivado do hash do ID, permissões 0700/0600, limite de 1 MiB, retenção de 7 dias e máximo de 1000 arquivos. `getMessage` responde apenas a pedido do WhatsApp para o mesmo ID. Não executa replay de mensagens antigas.
- O painel passa a exibir separadamente “aceito · aguardando entrega”, “entregue” e “lido”; erro ambíguo com ID aparece como “sem confirmação”. Registros sem prova externa não são promovidos a entregue ou lido. O azul de leitura depende de recibo real.
- O cliente Z-API bloqueia chamadas em modo `baileys_text`; a rota `/api/zapi` retorna 410 nesse modo e a produção não inicia se o transporte legado for selecionado. O painel deixa de consultar o status legado e de oferecer ações que o acionavam. Artefatos selados e registros históricos não foram reescritos.

## Validação e limite

Dez testes locais dirigidos passaram, incluindo aceite/entrega/leitura, ausência de promoção para inbound/grupo, estado ambíguo, recuperação protobuf por ID e bloqueio do transporte legado em produção. `node --check` e `git diff --check` passaram. `npm run senior:check` no Windows parou antes da suíte porque importa `/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs`, disponível somente no VPS.

**Status: CANDIDATA, NÃO PUBLICADA.** Para ativar, emitir autoridade selada sucessora de V274 para o commit/árvore/hashes V275, materializar em release isolada, executar todos os guards no VPS e comparar `current` com `pm_cwd`/`pm_exec_path`. A prova final exige novo envio exclusivo ao QA `5515998038637`, recibos do dispositivo e leitura visual no celular. Mensagens antigas que mostram “Aguardando mensagem” não podem ser classificadas retroativamente sem recibo do mesmo ID; não repetir envios de resultado incerto.

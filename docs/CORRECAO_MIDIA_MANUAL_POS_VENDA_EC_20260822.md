# Correção de mídia manual no pós-venda EC — 2026-08-22

## Escopo autorizado

O operador solicitou em caráter urgente que áudio e vídeo enviados e recebidos pelo painel oficial voltassem a funcionar como no teste realizado em 2026-08-21. A autorização desta conversa cobre somente a correção do envio manual de mídia no WhatsApp EC, sua publicação controlada e um canário individual no telefone de QA oficial.

## Produção auditada antes da alteração

- URL oficial: `https://ec.maxlien.shop/`.
- VPS oficial: `root@72.60.137.77`.
- release ativa: `/opt/vitalismen-automacao/releases/20260822T002400Z_production-20260822-b50a86b`;
- tag ativa: `production-20260822-b50a86b`;
- transporte oficial: Z-API conectada;
- armazenamento durável de inbound: `/opt/vitalismen-automacao/shared/media/inbound`.

A varredura de 36 horas encontrou 23 áudios inbound recentes, com os arquivos novos terminando em `READY`, MIME/codec válidos e leitura pelo endpoint autenticado. Os áudios outbound com ID da Z-API possuíam confirmações `sent`, `delivered` ou `read`.

Foram encontrados oito registros manuais `unconfirmed` sem `providerMessageId`, sem `provider` e sem qualquer evidência de aceite pela Z-API: sete imagens e um áudio. O caso que motivou o incidente coincidiu no log com `reason=dropi_order_exists`.

## Causa confirmada

A rota `POST /api/whatsapp/send` já identificava o envio como `manual_panel` e pretendia autorizar o atendimento manual depois da criação do pedido. Porém, o dispatcher não propagava `allowExistingDropiOrder` para `sendAudio`, `sendImage` e `sendVideo`.

Consequentemente, o guard de pedido Dropi bloqueava a mídia antes da chamada à Z-API. Como o emissor retornava `false` sem ID do provedor, o painel persistia a tentativa com a mensagem genérica `WhatsApp nao retornou confirmacao da midia`.

## Alteração mínima

Arquivos funcionais:

- `src/whatsapp/sendAudio.js`;
- `src/whatsapp/sendImage.js`;
- `src/whatsapp/sendVideo.js`.

Cada emissor agora considera `sendMode === 'manual_panel'` como autorização explícita para atravessar somente a trava de pedido Dropi existente. O próprio `checkDropiOrderBeforeOutbound` continua presente e bloqueia normalmente qualquer automação sem essa autorização.

Teste de regressão:

- `tests/manual-panel-media-existing-order.test.mjs`.

## Preservado

- Z-API continua sendo o transporte oficial;
- número oficial e telefone único de QA não mudam;
- guards de país, sessão, destinatário, auto-reenvio, deduplicação e logística continuam ativos;
- scheduler e pós-venda automático não foram alterados;
- nenhuma mídia automática foi liberada para pedido existente;
- funil, produtos, preços, Dropi, Meta/CAPI, pixel, checkout, schema e memória não foram alterados;
- nenhuma tentativa antiga sem ID do provedor foi promovida artificialmente a `sent` ou `delivered`.

## Validação antes da publicação

- teste específico: 2/2 aprovado;
- sintaxe dos três emissores: aprovada;
- runtime guard V34: aprovado;
- guard de produto EC: aprovado;
- guard de retirada: aprovado;
- guard anti-spam de guia: aprovado;
- suíte local Windows: 256/257; a única falha é preexistente e específica da conversão de `/opt/...` pelo `path` do Windows no teste de raiz compartilhada;
- a suíte integral precisa passar no candidato Linux antes da ativação.

## Publicação, canário e rollback

A publicação deve partir de commit imutável na branch `production`, com tag `production-AAAAMMDD-abcdef0`, release nova e backup anterior à ativação. A ativação deve usar o helper transacional root com permit de uso único.

Após ativar:

1. validar `pm_cwd`, `pm_exec_path`, `current`, health e conexão somente leitura da Z-API;
2. enviar um áudio OGG/Opus aprovado e um vídeo MP4 já versionado somente ao telefone QA `5515998038637`;
3. exigir `providerMessageId` e callback de entrega para os dois;
4. validar os últimos áudios/vídeos inbound reais já persistidos, sem inventar confirmação;
5. não executar disparo em massa nem reenviar mídia aos clientes usados na auditoria.

Rollback: reativar a release `20260822T002400Z_production-20260822-b50a86b` pelo helper transacional, preservar `/opt/vitalismen-automacao/shared/media/inbound` e restaurar o `.env` anterior somente se o helper indicar necessidade.

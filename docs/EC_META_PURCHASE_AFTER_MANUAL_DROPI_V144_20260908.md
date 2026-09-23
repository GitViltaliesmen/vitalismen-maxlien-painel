# V144 — Purchase Meta depois do envio manual Dropi

## Causa comprovada

A V141 chamava `sendPurchaseEventForOrder` depois de um resultado positivo do Dropi. Em produção, o perfil `EC_BOT_CORE_OPERATIONAL` classifica qualquer efeito `meta` como bloqueado. O resultado bloqueado era persistido sem `tracking.metaPurchaseSentAt`; por isso o painel mantinha `Meta pendente` e as métricas registravam a venda elegível sem Purchase enviado.

Também havia duas chamadas no caminho de pedido já enviado. Elas podiam transformar uma nova abertura da ação em tentativa retroativa. A V144 fecha esse caminho.

## Correção cirúrgica

- O Purchase usa a classe de efeito `meta_purchase`.
- A exceção operacional exige o perfil V78 íntegro, rota `POST .../submit`, contexto de escrita, autenticação administrativa, ação humana V138 e identidade do pedido solicitado.
- O emissor só é chamado quando a execução corrente acabou de receber sucesso real do Dropi (`freshDropiSubmission=true`).
- Um pedido Dropi já existente retorna `historical_or_existing_dropi_submission` e faz zero chamadas CAPI.
- `metaPurchaseSentAt` e o lock do formulário só são gravados quando a Meta retorna `events_received > 0`.
- Falha ou resposta sem aceite permanece visível como `Meta erro`, com diagnóstico persistido no Order.

## Preservado

- anúncios, campanhas, conjuntos, criativos, orçamento e Dataset não são alterados;
- não existe backfill ou Purchase retroativo;
- salvar/confirmar a ficha não envia Dropi, não cria shipment e não envia CAPI;
- autorizar sem executar o envio não envia CAPI;
- Dropi e shipment continuam dependentes da ação humana explícita;
- VSL, Meta browser events, Servientrega, pós-venda, Z-API e produtos permanecem inalterados;
- o painel continua lendo somente os campos canônicos do Order e do lock SQLite.

## Casos reais auditados sem mutação

Os pedidos `EC-ADMIN-3501`, `EC-ADMIN-3503` e `EC-ADMIN-3504` já possuíam Dropi e Shipment antes da ativação operacional V143. Nenhum tinha `metaPurchaseEventId` ou `metaPurchaseSentAt`. Eles permanecem sem reenvio; qualquer correção retroativa exige uma decisão separada do operador.

## Validação

Os testes cobrem liberação no contexto autenticado, bloqueio fora dele, zero CAPI para pedido histórico, deduplicação, aceite obrigatório da Meta, persistência usada pelo painel e conservação dos guards V138–V143.

## Rollback

Retornar ao commit V143 `8cbc5b0ca427af9ab27aeaad085c2bd70d5ca668`. Isso volta a bloquear Purchase Meta no perfil V78 e mantém os pedidos existentes sem envio retroativo.

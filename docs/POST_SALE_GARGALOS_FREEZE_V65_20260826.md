# Freeze V65 — gargalos estruturais de pós-venda EC

Data: 2026-08-26
Escopo: Vitalismen Ecuador, painel WhatsApp, `Order`, `Shipment`, Dropi EC,
Servientrega e schedulers de pós-venda.
Pai: `dropi-customer-full-name-v64-20260826`.
Publicação: candidata local; deploy não autorizado.

## Causas-raiz encerradas

1. O campo de busca filtrava somente o lote rápido já presente no navegador.
2. A ficha misturava `metadata.customerDraft`, `Order` e `Shipment`, permitindo
   que `Novo` e aliases antigos escondessem logística e identidade oficiais.
3. `dropi_rejected/manual_send_required` era preservado indefinidamente mesmo
   depois de prova logística autoritativa posterior.
4. A sincronização de pedidos ativos escolhia o primeiro candidato plausível,
   dependia das linhas DOM e não explicava por que uma linha não fora aplicada.

## Arquitetura aprovada

### Busca global

O carregamento inicial permanece em `/api/whatsapp/chats?fast=1`. Quando a
consulta válida não existe no lote local, o frontend aplica debounce de 350 ms
e consulta `GET /api/whatsapp/chats/search`. A rota é autenticada, somente
leitura, limitada e consulta `ContactState`, `Order`, `Shipment` e mensagens
apenas para recuperar a identidade da conversa. Ela não cria contato, pedido,
Shipment ou espelho administrativo.

Consultas numéricas exigem três dígitos, nomes exigem dois caracteres e regex
de usuário é sempre escapada. Telefone completo tem alternativa exata coberta
por índice; finais curtos usam consulta limitada. A resposta omite o corpo da
mensagem e retorna no máximo 20 registros.

### Read model canônico

`projectPanelCustomerReadModel()` é a projeção reutilizável. A hierarquia é:

1. logística: `Shipment`;
2. identidade e dados do pedido existente: `Order`;
3. dados ainda ausentes: `metadata.customerDraft`;
4. fallback visual: perfil/contato/mensagem.

O nome da conversa (`contactName`) e o nome oficial do pedido
(`officialOrderName`) são campos diferentes. Se houver pedido, o nome oficial
preenche a ficha; o alias continua visível como contexto e nunca substitui
`Order.customer.name`. Uma seleção determinística prioriza entidade logística
ativa e autoritativa e aceita preferência exata quando a busca foi por pedido,
Dropi ID ou guia.

### Resolução de `dropi_rejected`

Somente a combinação exata abaixo é elegível:

```text
manualOnly=true
reviewReason=dropi_rejected
reviewStatus=manual_send_required
```

`canResolveStaleDropiRejectedReview()` exige fonte autorizada, identidade local
coerente, Dropi ID ou tracking válido e estado logístico posterior fechado.
Outros motivos de revisão não são tocados. A atualização usa lock e predicado
atômicos, grava antes/depois, evidência, origem, timestamp e histórico.

Ao resolver, o estágio logístico histórico já vencido entra em
`review.suppressedNotificationKinds`. Isso transforma recuperação de estado em
reconciliação silenciosa; ela não é um comando para replay.

### Anti-repetição

`decidePostSaleNotification()` é chamado antes de guia, trânsito, retirada e
devolução. A decisão considera, nesta ordem, marker/evento/ledger estruturado,
histórico outbound humano ou automático equivalente, supressão histórica,
revisão manual, elegibilidade logística atual e lock persistente por tipo.

Resultados públicos:

```text
SHOULD_SEND
ALREADY_NOTIFIED_STRUCTURED
ALREADY_NOTIFIED_MANUALLY
HISTORICAL_EVENT_SUPPRESSED
MANUAL_REVIEW_REQUIRED
NOT_ELIGIBLE
```

O lock persiste no `Shipment`, portanto concorrência, reinício de processo e
segunda execução do scheduler não abrem uma janela de duplicidade.

### Reconciliação Dropi

A ordem de matching é Dropi ID, tracking, identificador interno e telefone
normalizado. Nome é apenas auxiliar para reduzir mais de um candidato de mesmo
telefone; nome sozinho nunca associa. Mais de um candidato continua como
`AMBIGUOUS_MATCH`. Divergência de produto é `PRODUCT_CONFLICT`; guia inválida é
`INVALID_TRACKING`; ausência de identidade é `NO_MATCH`. Nenhum desses casos
cria `EC-DROPI-*` artificial.

O ciclo lê primeiro a API de pedidos Dropi e usa DOM somente como fallback. Em
modo `dryRun/reportOnly`, não chama o upsert. Em modo operacional futuro, um
match estrito atualiza o Shipment existente e pode resolver apenas o
`dropi_rejected` obsoleto conforme a política anterior.

### Observabilidade

Cada ciclo começa como `RUNNING` antes da sessão de navegador e termina em
`COMPLETED` ou `FAILED`. `DropiSyncCycle` registra estados `SEEN`, `PARSED`,
`MATCHED`, `UPDATED`, `UNCHANGED`, `NOT_PARSED`, `NO_MATCH`,
`AMBIGUOUS_MATCH`, `PRODUCT_CONFLICT`, `INVALID_TRACKING` e `ERROR`, além de
contadores. Não armazena token, segredo, payload cru ou telefone completo.

### Reconciliação histórica

`scripts/reconcile-post-sale-historical-v65.mjs` opera em `DRY_RUN` por padrão.
Ele lista alteração proposta, evidência, risco, decisão de mensagem equivalente
e se algum evento automático seria elegível. `--apply` exige uma variável de
aprovação explícita e, mesmo autorizado, apenas resolve a revisão; não envia
WhatsApp e não submete Dropi. Nesta missão o modo apply não foi executado.

## Casos de regressão

- final 9599: revisão é elegível para resolução com prova autoritativa; retirada
  histórica fica suprimida e não há replay;
- final 7146/990287146: os dois textos humanos equivalentes resultam em
  `ALREADY_NOTIFIED_MANUALLY`; nunca há terceira mensagem;
- final 6457: Dropi ID 6652142 e guia 189411028 podem reconciliar somente com
  match estrito; a mensagem humana da guia bloqueia repetição;
- final 4818: `EN_RUTA` sem liberação explícita resulta em `NOT_ELIGIBLE` para
  pronto para retirada;
- 984583448: `DEVUELTO` do Shipment prevalece sobre rascunho `Novo`;
- 969253940: `JULIO GARCIA` do Order prevalece na ficha, mantendo
  `garciajul96` apenas como nome da conversa;
- 979820815 e 990287146: recuperáveis pela busca remota sem `Adicionar`.

## V64 preservada

O payload Dropi continua usando somente `Order.customer.name`. Nome e sobrenome
humanos são obrigatórios e `DROPI_CUSTOMER_FULL_NAME_REQUIRED` continua
falhando fechado no builder e em todos os caminhos de autorização, fila,
preparo manual e envio. Pedido já submetido não é reaberto.

## Rollback

Como não houve deploy, o rollback operacional é manter o release ativo
`20260826T054900Z_production-20260826-cc85952`. Para rollback de código local,
reverter somente os arquivos listados no manifesto V65; não alterar freezes
ancestrais nem apagar histórico. Se esta candidata vier a ser publicada no
futuro, o rollback consiste em reativar o symlink do release anterior e
recriar somente o processo `vitalismen-automation` se o PM2 ainda apontar ao
release revertido.

## Estado terminal desta candidata

```text
deployAuthorized = false
productionChanged = false
realMessagesSent = 0
realDropiSubmissions = 0
historicalApplyExecuted = false
```

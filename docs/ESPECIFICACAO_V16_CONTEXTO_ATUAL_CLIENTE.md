# Especificação V16 — Contexto atual do cliente

Status: escopo funcional proposto, sem implementação.

Data da especificação: 2026-08-16.

Baseline local auditado: `3a0e0e1c8b049fd706c9146c03ed472f3352ae12`.

Produção real preservada: `dbe5f3af960cb0b48009ac81736b552d54e910b5`.

Branch operacional: `codex/source-of-truth-hardening-20260816`.

Escopo inicial: painel integrado Vitalismen, Ecuador, em modo exclusivamente assistivo e de leitura.

## Conclusão executiva

É possível construir a primeira versão de **CONTEXTO ATUAL** sem tocar no motor congelado do bot, no funil, nos envios de WhatsApp, na integração Dropi, na Meta/CAPI ou no banco como fonte de escrita.

A implementação mínima segura é uma projeção calculada sob demanda a partir dos registros já existentes. Ela deve:

1. consultar dados persistidos sem modificá-los;
2. manter candidatos concorrentes em vez de escolher silenciosamente;
3. mostrar valor, origem, confiança e data de cada campo;
4. separar produto de origem da VSL de produto da negociação atual;
5. separar pedido atual de pedidos históricos;
6. não oferecer aplicação automática na primeira fase;
7. não chamar serviços externos durante a leitura do contexto;
8. não reutilizar rotas de salvamento, sincronização ou envio.

O principal limite do estado atual é que `ContactState.metadata.customerDraft` guarda um retrato da ficha, mas não guarda proveniência por campo. A extensão também protege edições manuais apenas em memória, por meio de `manualFieldIds`; essa informação se perde ao recarregar. Portanto, a V16 inicial consegue informar a coleção e o registro de origem, mas não pode chamar uma ficha persistida de “edição manual confirmada” sem evidência adicional. Quando essa prova não existir, a origem deve ser apresentada como **dado estruturado persistido**, nunca como confirmação manual presumida.

## 1. Objetivo

Criar no painel uma área chamada **CONTEXTO ATUAL** que consolide, por cliente e telefone, a situação comercial e logística relevante para o atendimento humano.

A área deve responder, de modo visual e auditável:

- quem é o cliente;
- quais dados foram detectados na conversa;
- qual é a localização atual conhecida;
- qual VSL originou o contato;
- qual produto está sendo negociado agora;
- qual é o pedido atual, se houver;
- quais pedidos pertencem ao histórico;
- em qual etapa está a negociação/funil;
- de onde veio cada valor;
- quando cada fonte foi atualizada;
- qual é a confiança de cada informação;
- quais fontes divergem.

Esta primeira funcionalidade V16 não é um novo cadastro, não é um motor de decisão e não é um automatizador. É uma camada assistiva de leitura para reduzir decisões erradas do atendente.

## 2. Problema resolvido

Hoje os dados relevantes estão distribuídos entre ficha, conversa, pedido, envio, visita de VSL, memória, captura Z-API, extensão e catálogo Servientrega. O painel já exibe parte desses dados, mas não apresenta uma origem e uma confiança consistentes por campo.

Isso cria cinco riscos operacionais principais:

1. um dado antigo pode parecer atual;
2. o produto da VSL pode ser confundido com o produto da negociação atual;
3. um pedido histórico pode ser reutilizado como pedido atual;
4. uma extração automática pode parecer uma edição manual confirmada;
5. duas fontes divergentes podem ser reduzidas a um único valor sem que o atendente veja o conflito.

O **CONTEXTO ATUAL** resolve o problema tornando as fontes visíveis e impedindo que ausência de certeza seja mascarada como certeza.

## 3. Limites da primeira versão

### 3.1 Dentro do escopo

- leitura por telefone EC normalizado;
- consolidação de dados já persistidos;
- extração determinística local de mensagens recebidas;
- apresentação de candidatos, fontes, confiança e conflitos;
- indicação do pedido atual e histórico quando essa separação for comprovável;
- indicação da etapa de funil/memória sem avançá-la;
- leitura de origem VSL e atribuição já persistida;
- leitura do último retrato local de Dropi/Servientrega já persistido;
- interface no painel integrado.

### 3.2 Fora do escopo

- salvar ou corrigir ficha;
- aplicar automaticamente qualquer candidato;
- criar, editar, confirmar, cancelar ou reenviar pedido;
- alterar pedido histórico;
- autorizar ou enviar pedido ao Dropi;
- consultar Dropi ao vivo durante a abertura do contexto;
- disparar ou reenviar evento Meta;
- enviar mensagem, áudio, imagem, documento ou vídeo;
- executar OCR automaticamente;
- iniciar, avançar, reiniciar ou corrigir funil;
- assumir ou liberar atendimento humano;
- alterar memória do bot;
- alterar status operacional;
- alterar dados da extensão;
- unir telefones diferentes como se fossem a mesma pessoa sem prova explícita;
- ler ou expor `providerPayload`, `raw`, tokens, cookies, credenciais ou segredos;
- usar outro projeto, outro banco, outro domínio ou outra infraestrutura como fonte.

### 3.3 Regra de produção

Esta especificação descreve uma futura funcionalidade do HEAD local. Nada aqui está em produção. A produção real continua no commit `dbe5f3af960cb0b48009ac81736b552d54e910b5`.

## 4. Dados utilizados

### 4.1 Matriz dos campos solicitados

| Campo da interface | Fontes atuais preferenciais | Fontes auxiliares | Limitação atual |
|---|---|---|---|
| Nome atual | pedido atual confirmado; `ContactState.metadata.customerDraft.name` | `Order.customer.name`, `Shipment.client.name`, nome de perfil WhatsApp | ficha não registra proveniência por campo |
| Nome detectado na conversa | mensagens recebidas + extrator V15 | `Message.notifyName` como nome de perfil, nunca como confirmação do cliente | detecção não significa confirmação |
| Telefone | `ContactState.phoneDigits` e telefone EC completo | ficha, pedido, envio e mensagem | correspondência por cauda deve ser apenas fallback único |
| Cidade | pedido atual; ficha estruturada | extração de conversa, OCR solicitado e catálogo Servientrega | cidade ambígua não pode ser canonizada |
| Província | pedido atual; ficha estruturada | catálogo Servientrega quando a cidade tem correspondência única | inferência deve ser marcada como inferida |
| Endereço | pedido atual; ficha estruturada | envio, conversa e OCR solicitado | endereço histórico não pode preencher negociação nova automaticamente |
| Setor/bairro | agência exata do catálogo Servientrega | texto do endereço | não existe campo dedicado em `Order`, `Shipment` ou `customerDraft` |
| Agência Servientrega | `Shipment.logistics.agencyName`; memória do pedido pendente | ficha/endereço + resolução exata no catálogo | texto contendo “Servientrega” não prova agência única |
| Agência/domicílio | `Shipment.logistics.agencyPickup`; pedido pendente `deliveryMode` | heurística textual apenas como provável | `Order` não possui campo explícito de modalidade |
| Origem da VSL | `VslVisit.page/path/sourceUrl` e metadados VSL do contato | tracking do pedido | visita deve ser ligada por identificador exato ou atribuição comprovada |
| Produto da VSL | `ContactState.metadata.vslProductKey` e `VslVisit.productKey` | `vslProductName` | deve permanecer separado do produto atual |
| Produto negociado | produto estruturado do pedido/ficha atual | extração determinística recente somente como candidato | nunca usar produto histórico como decisão automática |
| Quantidade | pedido atual; ficha atual | extração determinística recente | quantidade histórica não deve migrar para recompra |
| Valor | pedido atual; ficha atual | valor explícito recente; catálogo apenas como referência | catálogo não prova acordo comercial |
| Pedido atual | vínculo explícito de pedido ativo | único pedido não terminal do telefone | dois pedidos ativos sem vínculo explícito geram ambiguidade |
| Pedidos anteriores | demais `Order` do telefone | `Shipment` por `orderId` | histórico deve ser somente leitura |
| Status anteriores | `Shipment` e `Order` de cada pedido histórico | resolvedor de status operacional | não substituir o valor bruto; mostrar também a normalização |
| Negociação atual | ficha, pedido atual e memória pendente do agente | mensagens recentes | não deve ser construída a partir de um pedido antigo isolado |
| Estágio do funil | `metadata.lastKnownFunnelStage`, memória por agente e `Order.conversationMemory.funnelStage` | pedido pendente | divergência de etapas deve ser visível |
| Origem dos dados | coleção, documento, caminho do campo e evidência | identificador de mensagem/visita/pedido | não existe hoje um ledger único de proveniência |
| Última atualização | timestamp do registro-fonte | timestamp da mensagem/evento | `customerDraft.updatedAt` vale para a ficha inteira, não para cada campo |
| Confiança | calculada pela regra V16 | confiança OCR/VSL existente | nunca converter ausência de prova em alta confiança |
| Conflitos | comparação entre candidatos normalizados | relação VSL versus negociação | divergência informativa não autoriza correção automática |

### 4.2 Forma conceitual de um campo

Cada campo apresentado deve ter o seguinte contrato conceitual:

```json
{
  "field": "currentProduct",
  "value": "Tex Ultra Ecuador",
  "rawValue": "tex_ultra_ec",
  "source": {
    "kind": "current_confirmed_order",
    "collection": "orders",
    "entityId": "EC-EXEMPLO",
    "path": "tracking.productKey",
    "evidenceId": "EC-EXEMPLO"
  },
  "confidence": "CONFIRMADO",
  "observedAt": "2026-08-16T12:00:00.000Z",
  "inferred": false,
  "conflicted": false,
  "candidates": []
}
```

Esse é um contrato de especificação, não um campo implementado ou persistido neste momento.

## 5. Fontes existentes

### 5.1 `ContactState`

Arquivo: `src/models/ContactState.js`.

Chave principal atual: `chatId`, com `phoneDigits` indexado.

Dados úteis:

- país e agente atribuído;
- histórico de agentes e tags;
- modo humano, responsável, nota e timestamps manuais;
- primeira e última entrada;
- última saída;
- `metadata.customerDraft`;
- `metadata.productKey`, `productName` e `productMedia`;
- `metadata.vslProductKey`, `vslProductName`, `vslPath`, `vslSourceUrl`, `vslTestId` e `vslVariant`;
- `metadata.lastKnownFunnelStage`;
- `metadata.perAgentMemory` e `pendingCheckoutOrder`;
- `metadata.aiMemory.history`;
- dados de continuidade de sessão/número;
- marcadores Z-API e status manual do painel.

Limitações:

- `metadata` é `Mixed` e não tem contrato de proveniência por campo;
- `customerDraft.updatedAt` é global para a ficha;
- `human.lastManualAt` prova ação humana no contato, mas não prova qual campo foi editado;
- a leitura de chats atual pode sincronizar produto/pedido na ficha por meio de `panelProductContextForChat`; essa função não pode ser reutilizada pelo novo contexto de leitura.

### 5.2 `VslVisit`

Arquivo: `src/models/VslVisit.js`.

Dados úteis:

- `visitorKey`, `visitorId` e `sessionId`;
- país, página, path, URL de origem e referrer;
- nome/telefone quando ligados à visita;
- `productKey`, `productName` e `productSource`;
- teste/variante e mensagem de entrada;
- tracking Meta/UTM já persistido;
- clique, visualização e timestamps;
- vínculo de atribuição com telefone e hashes de auditoria.

Uso V16:

- informar a origem e o produto da VSL;
- mostrar a confiança do vínculo já gravado;
- nunca disparar eventos de página, lead, checkout ou compra;
- nunca chamar a rota de captura da VSL para “consultar” dados.

### 5.3 `Order`

Arquivo: `src/models/Order.js`.

Dados úteis:

- cliente: nome, telefone, endereço, referência, cidade e província;
- pacote: identificador, rótulo e quantidade;
- total, moeda, status e origem;
- cadeia de recompra: `entryReason`, `previousOrderId` e `previousDeliveredAt`;
- IDs e status Dropi;
- `purchaseIntent`;
- tracking de produto, VSL e Meta;
- `conversationMemory` com intenção, estágio e resumo;
- timestamps de entrada, confirmação, criação e atualização.

Uso V16:

- o pedido atual só pode ser escolhido por vínculo explícito ou por unicidade comprovada;
- um pedido confirmado atual tem prioridade sobre rascunho para os dados daquele pedido;
- pedido entregue, devolvido, cancelado ou substituído permanece no histórico;
- `previousOrderId` é um vínculo histórico, não permissão para alterar o pedido anterior.

### 5.4 Histórico de pedidos

O histórico já pode ser obtido pela coleção `Order`, correlacionada por telefone EC normalizado, e complementado por `Shipment` usando `orderId`.

A rota atual `GET /api/whatsapp/customer-profile/:phone` consulta até dez pedidos, porém devolve apenas um `activeOrder` e uma linha do tempo resumida. Ela não devolve a lista estruturada completa necessária para o novo bloco de histórico.

A V16 deve devolver cada pedido histórico como item independente, preservando:

- `orderId`;
- produto daquele pedido;
- quantidade e total daquele pedido;
- status bruto do pedido;
- status logístico derivado do envio correspondente;
- datas relevantes;
- vínculo de recompra;
- indicação de que o item é histórico.

### 5.5 Memória

Arquivos principais:

- `src/services/memoryStore.js`;
- `src/services/funnelPurposeMemoryService.js`;
- `ContactState.metadata.aiMemory`;
- `ContactState.metadata.perAgentMemory`;
- `Order.conversationMemory`.

Dados úteis:

- histórico recente de mensagens;
- nome já presente na ficha;
- última etapa conhecida;
- pedido pendente por agente;
- itens de mídia já usados por finalidade.

Regra V16:

- usar somente leitura direta;
- não chamar `pushHistory`;
- não marcar item como enviado;
- não escrever nova etapa;
- não usar memória antiga para trocar o produto atual.

### 5.6 Dados da extensão

Arquivos principais:

- `extensions/vitalismen-whatsapp-official/sidepanel.js`;
- `extensions/vitalismen-whatsapp-official/conversation-data-extractor.js`;
- `extensions/vitalismen-whatsapp-official/customer-data-normalizer.js`;
- `extensions/vitalismen-whatsapp-official/agency-catalog.js`.

Estado real:

- a extensão consome `/api/whatsapp/chats`, `/messages` e `/customer-profile`;
- a ficha é persistida no backend em `ContactState.metadata.customerDraft`;
- campos manuais são protegidos em runtime por `manualFieldIds`;
- `manualFieldIds` não é persistido;
- a extensão agenda autosave para campos detectados;
- `chrome.storage.local` guarda rótulos operacionais e preferências visuais, não uma fonte autoritativa completa do cliente.

Consequência:

A V16 não deve tratar “veio da extensão” como sinônimo de “manual”. Sem uma marca persistida específica, o dado deve ser classificado como `contact_state_customer_draft`.

### 5.7 Dados Z-API

Arquivos principais:

- `src/routes/zapi.js`;
- `src/models/Message.js`;
- `src/models/ContactState.js`.

Dados úteis já persistidos:

- mensagem, tipo, mídia, direção e timestamp;
- `notifyName`;
- identificadores e status do provedor;
- marcador de contato capturado;
- data e origem da captura;
- produto/origem VSL quando comprovados;
- vínculo de atribuição já realizado.

Regras V16:

- não consultar a Z-API ao vivo;
- não enviar nada à Z-API;
- não expor `Message.providerPayload`;
- tratar `notifyName` como nome de perfil, não como nome confirmado pelo cliente.

### 5.8 Dados WhatsApp

Arquivo principal: `src/models/Message.js`.

Dados úteis:

- corpo da mensagem;
- tipo e presença de mídia;
- direção (`isFromMe`, `isBot`);
- telefone par e chat;
- data/hora;
- nome de notificação;
- provedor e status de entrega;
- vínculo opcional com pedido.

A extração deve considerar somente mensagens recebidas do cliente. Mensagens do atendente ou bot podem servir para interpretar uma confirmação contextual, mas nunca podem fornecer o valor do campo como se o cliente o tivesse declarado.

### 5.9 Dados Dropi

Fontes locais:

- `Order.dropiOrderId` e `Order.shippingStatus`;
- `Shipment.provider`;
- `Shipment.logistics`;
- `Shipment.outcomes`;
- `Shipment.events`.

Regras V16:

- ler apenas o último estado persistido localmente;
- identificar claramente “último retrato local”, sem afirmar que é uma consulta ao vivo;
- não abrir navegador Dropi;
- não autorizar submissão;
- não executar dispatch;
- não expor `Shipment.raw`.

### 5.10 Dados Servientrega

Arquivos principais:

- `src/data/agencia_LISTA.json`;
- `src/services/servientregaEcuadorAgencyService.js`.

Campos disponíveis na agência:

- nome;
- província;
- cidade;
- setor;
- endereço;
- horários.

Uso V16:

- canonizar cidade/província somente com correspondência segura;
- preencher setor apenas como dado derivado de uma agência resolvida de forma única;
- múltiplas agências compatíveis geram `AMBIGUO`;
- nenhuma busca de agência altera a ficha.

### 5.11 Origem Meta/VSL

Arquivos principais:

- `src/models/VslVisit.js`;
- `src/services/metaAttributionBridgeService.js`;
- `src/services/metaAttributionService.js`;
- tracking de `Order` e de `ContactState`.

A ponte atual só atribui uma visita quando há candidata única, mensagem exata e janela recente. Essa prova pode ser exibida como origem de alta confiança.

O novo contexto pode mostrar apenas campos seguros, como:

- path/URL pública da VSL;
- produto e variante;
- fonte de atribuição;
- confiança da atribuição;
- campanha/conteúdo UTM quando já persistidos.

Ele não deve mostrar payloads brutos, IDs sensíveis desnecessários nem disparar eventos.

### 5.12 Campos e capacidades V15

Commit de referência: `a19c2711bc28ba9ddffc04b0c226c1e42a342071`.

Arquivos principais:

- `public/panel-intelligence/conversation-data-extractor.js`;
- `public/panel-intelligence/customer-data-normalizer.js`;
- `public/panel-intelligence/customer-form-intelligence.js`;
- `src/services/customerImageDataReaderService.js`;
- cópias equivalentes na extensão;
- testes `tests/customer-form-intelligence.test.cjs` e `tests/customer-image-data-reader.test.mjs`.

Capacidades reutilizáveis:

- nome explicitamente rotulado;
- cidade e província;
- endereço/agência e referência;
- quantidade e valor;
- produto explícito;
- normalização de nome/localização;
- leitura OCR manual com evidência e confiança;
- resolução por catálogo Servientrega.

Limites:

- o extrator não devolve proveniência completa para todos os campos;
- o autosave existente pode persistir campos vazios preenchidos;
- o resultado OCR aplicado perde a origem por campo depois de salvo;
- o resolvedor de produto atual possui fallback legado quando não encontra produto; a V16 não pode usar esse fallback para preencher um produto desconhecido.

## 6. Prioridade das fontes

### 6.1 Hierarquia aprovada para avaliação

1. edição manual confirmada pelo atendente;
2. dado confirmado explicitamente pelo cliente;
3. pedido atual confirmado;
4. dado estruturado já persistido;
5. extração determinística da conversa;
6. inferência assistiva;
7. histórico antigo.

Essa hierarquia é tecnicamente adequada, com quatro ajustes obrigatórios.

### 6.2 Ajustes obrigatórios

#### Ajuste 1 — manual exige prova por campo

`human.mode = manual` ou `human.lastManualAt` não basta para elevar todos os campos ao nível 1. É necessária uma evidência ligada ao campo, como decisão registrada, pedido manual confirmado ou marcador técnico específico já existente.

Sem essa prova, `customerDraft` ocupa o nível 4.

#### Ajuste 2 — pedido atual precisa estar resolvido

Um pedido só ocupa o nível 3 quando for o pedido atual por:

1. vínculo explícito (`activeOrderId`, `customerDraft.orderId` ou equivalente válido);
2. mesmo telefone EC completo;
3. consistência de país;
4. ausência de conflito com outro pedido ativo.

Se houver dois pedidos ativos e nenhum vínculo explícito, o resultado é `AMBIGUO`.

#### Ajuste 3 — status logístico tem autoridade própria

Para status de entrega, `Shipment` pode ser mais atual do que `Order` e `customerDraft`. Deve ser preservada a regra já testada por `operationalChatStatusService`:

1. override manual explícito;
2. logística;
3. pedido;
4. ficha.

Essa exceção vale apenas para status operacional, não para nome, endereço ou produto.

#### Ajuste 4 — VSL e negociação são campos diferentes

`productFromVsl` e `currentProduct` nunca competem pela mesma posição. Uma diferença entre eles gera um cartão de divergência informativa, mas não reduz a confiança individual das duas fontes.

### 6.3 Algoritmo de resolução por campo

1. coletar candidatos sem escrever;
2. registrar fonte, entidade, caminho e timestamp de cada candidato;
3. normalizar apenas para comparação;
4. preservar o valor bruto para auditoria;
5. remover duplicatas equivalentes;
6. ordenar pela hierarquia aplicável ao campo;
7. verificar se candidatos de prioridade relevante divergem;
8. se houver divergência, manter todos e marcar `CONFLITO`;
9. se houver múltiplos candidatos indistinguíveis, marcar `AMBIGUO`;
10. se não houver prova, devolver `DESCONHECIDO`;
11. nunca persistir o resultado do cálculo.

## 7. Modelo de confiança

Na primeira fase, todos os campos são somente leitura. Portanto, `applicationAllowed` deve ser sempre `false`, independentemente da confiança. A coluna “aplicação futura” abaixo descreve apenas uma fase posterior, que exigirá autorização separada.

| Estado | Origem típica | Critério | Interface | Aplicação futura |
|---|---|---|---|---|
| `CONFIRMADO` | decisão manual por campo; correção explícita do cliente; pedido atual confirmado | prova inequívoca, ligada ao campo e ao contexto atual | selo verde, fonte e data visíveis | não aplicar automaticamente; manter ou alterar apenas com confirmação humana |
| `ALTA_CONFIANCA` | registro estruturado único; atribuição VSL exata; agência/cidade única no catálogo; snapshot logístico consistente | fonte forte, sem conflito, mas sem confirmação explícita por campo | selo azul, indicação “estruturado” | poderá ser aplicado por ação humana explícita, nunca por carregamento |
| `PROVAVEL` | extração determinística recente; província inferida de cidade única; modo de entrega por sinal textual | uma candidata plausível, com evidência, mas não confirmada | selo amarelo e texto de evidência | somente após prévia e confirmação humana |
| `AMBIGUO` | duas cidades/agências/pedidos plausíveis | não há candidata única | selo laranja, lista de opções | bloqueado até o humano escolher uma opção |
| `CONFLITO` | fontes relevantes com valores diferentes | valores não equivalentes e prioridade insuficiente para ocultar a divergência | selo vermelho e comparação lado a lado | bloqueado; exige resolução humana explícita |
| `DESCONHECIDO` | ausência de evidência segura | campo ausente ou somente sinal inválido | selo cinza e “sem dado comprovado” | não aplicável |

### 7.1 Regras específicas

- nome de perfil WhatsApp: no máximo `PROVAVEL`;
- nome com rótulo explícito na mensagem: `ALTA_CONFIANCA`;
- correção explícita “meu nome correto é ...”: `CONFIRMADO`, se ligada ao cliente atual;
- cidade/província com catálogo único: `ALTA_CONFIANCA`;
- província inferida da cidade: `PROVAVEL` e `inferred = true`;
- OCR `high`: no máximo `ALTA_CONFIANCA`, ainda exigindo revisão humana;
- OCR `medium`: `PROVAVEL`;
- OCR `low` ou `none`: `DESCONHECIDO` para aplicação;
- produto estruturado do pedido atual confirmado: `CONFIRMADO`;
- produto da ficha persistida sem prova manual: `ALTA_CONFIANCA`;
- menção casual a produto na conversa: no máximo `PROVAVEL`;
- produto de pedido histórico: histórico, nunca candidato automático ao produto atual;
- ausência de produto: `DESCONHECIDO`, sem fallback implícito.

## 8. Regras de conflito

### 8.1 Tipos de conflito

| Código conceitual | Situação | Comportamento |
|---|---|---|
| `NAME_MISMATCH` | nome atual difere do nome explicitamente detectado | preservar o atual e mostrar comparação |
| `LOCATION_MISMATCH` | cidade/província divergem entre pedido, ficha e conversa | não canonizar nem aplicar até revisão |
| `DELIVERY_MODE_MISMATCH` | agência e domicílio aparecem como atuais | não escolher modalidade |
| `AGENCY_MISMATCH` | duas agências diferentes são candidatas atuais | listar ambas; não preencher |
| `CURRENT_PRODUCT_MISMATCH` | ficha/pedido atual divergem sobre produto negociado | bloquear escolha automática |
| `VSL_NEGOTIATION_DIVERGENCE` | produto da VSL difere da negociação atual | informar; não corrigir nenhuma das duas fontes |
| `QUANTITY_TOTAL_MISMATCH` | quantidade/valor não formam uma oferta coerente | mostrar os dois campos e bloquear aplicação futura |
| `MULTIPLE_ACTIVE_ORDERS` | mais de um pedido atual plausível | nenhum pedido é escolhido silenciosamente |
| `FUNNEL_STAGE_MISMATCH` | memória, ficha e pedido indicam etapas diferentes | mostrar as etapas e a data de cada uma |
| `PHONE_MATCH_AMBIGUOUS` | correlação por cauda encontra mais de um cliente | interromper a consolidação daquele vínculo |

### 8.2 Comparação sem destruição

Para detectar equivalência, a camada pode normalizar:

- espaços, caixa e acentos para comparação textual;
- telefone para dígitos EC completos;
- produto para as três chaves aprovadas;
- quantidade para inteiro;
- valor para decimal com tolerância monetária mínima;
- status para a taxonomia visual já existente.

O valor original deve permanecer no candidato. A normalização nunca deve ser gravada de volta pela leitura do contexto.

### 8.3 Produto VSL versus produto atual

Exemplo:

```text
Produto da VSL: Vit Power
Origem: visita/captura VSL
Confiança: ALTA_CONFIANCA

Produto atual: Tex Ultra
Origem: negociação/pedido atual
Confiança: CONFIRMADO

Aviso: VSL_NEGOTIATION_DIVERGENCE
Nenhuma correção automática necessária.
```

O aviso deve aparecer no bloco **CONFLITOS**, mas não deve substituir nenhum campo e não deve fazer o produto da VSL “vencer” ou “perder”.

## 9. Interface proposta

### 9.1 Local e natureza

Adicionar um bloco recolhível **CONTEXTO ATUAL** na coluna de detalhes do cliente do painel integrado, próximo da ficha e do histórico permanente.

O bloco deve ser:

- somente leitura;
- independente dos inputs da ficha;
- sem listeners ligados ao autosave;
- sem botões de envio;
- sem botão de Dropi;
- sem botão Meta;
- sem botão de avanço de funil;
- atualizado quando o cliente selecionado mudar;
- identificado visualmente como “assistivo”.

### 9.2 Cabeçalho

Mostrar:

- telefone canônico;
- data/hora de geração;
- método de correlação do telefone;
- quantidade de fontes consultadas;
- quantidade de conflitos;
- selo “SOMENTE LEITURA”.

### 9.3 Blocos

#### IDENTIDADE

- nome atual;
- nome detectado;
- telefone;
- nome de perfil como evidência auxiliar;
- conflitos de identidade.

#### LOCALIZAÇÃO

- cidade;
- província;
- endereço;
- setor/bairro;
- agência;
- modalidade agência/domicílio.

#### PRODUTO ATUAL

- produto negociado;
- quantidade;
- valor;
- origem da decisão atual;
- indicação de pedido vinculado.

#### ORIGEM/VSL

- página/path de origem;
- produto da VSL;
- variante/teste quando existir;
- fonte/confiança do vínculo;
- divergência em relação à negociação atual.

#### PEDIDO ATUAL

- `orderId`;
- status comercial;
- status logístico;
- produto, quantidade e valor;
- modalidade de entrega;
- guia/transportadora quando já persistidas;
- vínculo explícito usado para classificá-lo como atual.

#### HISTÓRICO

- lista cronológica de pedidos anteriores;
- status final e datas;
- produto/quantidade/valor originais;
- relação de recompra;
- selo “HISTÓRICO — NÃO ALTERAR”.

#### FUNIL

- etapa atual mais forte;
- etapas concorrentes e suas fontes;
- última mensagem recebida e última saída em data/hora;
- modo humano/automático apenas como estado informativo.

#### CONFLITOS

- código;
- campo afetado;
- candidatos lado a lado;
- origem e data de cada candidato;
- orientação “revisão humana necessária”;
- nenhuma ação automática.

### 9.4 Linha padrão de campo

Cada linha deve mostrar:

1. **VALOR**;
2. **ORIGEM**;
3. **CONFIANÇA**;
4. **ÚLTIMA ATUALIZAÇÃO**;
5. indicação **INFERIDO**, quando aplicável;
6. indicador de conflito, quando aplicável.

### 9.5 Contrato de resposta proposto

Uma rota autenticada e somente leitura pode devolver:

```text
schemaVersion
generatedAt
readOnly
identityKey
match
fields
currentOrder
orderHistory
funnel
sources
conflicts
warnings
```

Regras da resposta:

- `readOnly` deve ser sempre `true`;
- `fields` usa o envelope definido na seção 4.2;
- `orderHistory` não contém operações;
- `sources` não contém payload bruto nem segredos;
- `warnings` declara limitações, como proveniência manual não comprovada;
- cabeçalho HTTP recomendado: `Cache-Control: no-store`.

## 10. Contratos que não podem ser alterados

1. O motor principal do bot permanece intocado.
2. O funil congelado permanece intocado.
3. Nenhuma etapa é avançada pela leitura do contexto.
4. Nenhuma mensagem, áudio ou mídia é enviada.
5. Nenhum evento Meta é criado ou reenviado.
6. Nenhum pedido é criado, alterado ou confirmado.
7. Nenhum pedido é autorizado ou enviado ao Dropi.
8. Nenhum status de pedido ou envio é atualizado.
9. Pedido histórico permanece imutável.
10. Produto da VSL permanece separado do produto atual.
11. Produto atual não pode ser inferido de histórico antigo.
12. Ausência de produto não pode acionar fallback silencioso.
13. Campo manual comprovado não pode ser sobrescrito.
14. Dado do cliente explicitamente confirmado tem prioridade sobre extração.
15. Inferência e OCR devem permanecer marcados.
16. Conflito exige decisão humana em uma fase autorizada posterior.
17. A lista esquerda de conversas continua sem prévia textual de mensagens.
18. Filtros de país, grupos, broadcast e IDs técnicos permanecem congelados.
19. O isolamento Ecuador permanece obrigatório.
20. Nenhum projeto paralelo pode ser consultado ou usado como fonte.
21. O freeze V15 deve ser sucedido formalmente; não pode ser simplesmente desativado.

### 10.1 Funções e caminhos que a leitura não pode reutilizar

Por possuírem efeitos colaterais ou responsabilidades de escrita, o agregador não deve chamar:

- `panelProductContextForChat` em sua forma atual;
- `persistSelectedCustomerData`;
- `performAutomaticDraftSave`;
- `scheduleCustomerFieldAutoSave`;
- `pushHistory`;
- `markPurposeItemSent`;
- `ensureOperationalOrderForConfirmedDraft`;
- sincronizações do painel administrativo;
- serviços `send*`;
- serviços de dispatch/submissão Dropi;
- serviços de envio Meta;
- `readEcuadorCustomerImage` automaticamente.

O agregador deve trabalhar com consultas `lean()` e funções puras de resolução.

## 11. Modelo de persistência proposto

### 11.1 Primeira fase — sem nova persistência

A primeira versão não precisa de tabela, coleção ou campo novo.

O contexto deve ser calculado sob demanda a partir de:

- `ContactState`;
- `Message`;
- `Order`;
- `Shipment`;
- `VslVisit`;
- catálogo Servientrega local.

O resultado não deve ser salvo. A auditoria vem das referências às fontes originais.

Vantagens:

- zero migração;
- zero risco de reescrever cliente/pedido;
- histórico permanece na fonte original;
- rollback simples;
- menor superfície de regressão.

Limitação aceita:

Sem proveniência por campo, algumas origens aparecerão como “ficha persistida” em vez de “manual” ou “automática”. A interface deve declarar essa limitação, não tentar adivinhar.

### 11.2 Fase posterior opcional — decisões humanas append-only

Se futuramente o operador autorizar botões de confirmar/aplicar conflitos, será necessária proveniência durável por campo.

O modelo recomendado é um registro append-only de decisões, separado dos pedidos históricos, contendo conceitualmente:

- telefone EC canônico;
- campo;
- valor escolhido;
- hash/ID dos candidatos vistos;
- fonte escolhida;
- atendente;
- data/hora;
- motivo;
- versão do esquema;
- referência ao pedido atual, quando aplicável.

Essa fase pode usar uma coleção nova ou uma estrutura aditiva cuidadosamente limitada. Não deve reescrever eventos anteriores. Ela não faz parte da implementação mínima.

### 11.3 Identidade e correlação

Ordem de correlação:

1. telefone EC completo e normalizado;
2. `chatId` explicitamente ligado ao mesmo telefone;
3. identificador exato de pedido/visita;
4. cauda de telefone somente quando houver uma única candidata EC;
5. mais de uma candidata resulta em `PHONE_MATCH_AMBIGUOUS`.

Não é permitido fundir dois telefones de clientes diferentes por nome, endereço ou semelhança de conversa.

## 12. Casos de teste obrigatórios

### 12.1 Matriz de cenários

| # | Cenário | Preparação | Resultado obrigatório |
|---:|---|---|---|
| 1 | Cliente novo sem histórico | contato e mensagens, nenhum pedido | identidade e negociação possíveis; histórico vazio; pedido atual desconhecido; nenhuma escrita |
| 2 | Cliente antigo comprando novamente | pedido entregue antigo + negociação recente | pedido antigo no histórico; nova negociação separada; dados antigos não são aplicados |
| 3 | Cliente antigo mudando de produto | histórico Vit Power + negociação Tex Ultra | produto atual Tex Ultra; produto histórico permanece Vit Power; sem troca automática de pedido antigo |
| 4 | Nome digitado errado | ficha persistida difere de nome explícito recente | `NAME_MISMATCH`; ambos visíveis; nenhum overwrite |
| 5 | Nome corrigido pelo cliente | mensagem explícita “meu nome correto é...” | candidato do cliente com prioridade 2; atual só muda em fase futura após decisão autorizada |
| 6 | Cidade válida | cidade com correspondência única no catálogo | cidade canônica em alta confiança; província inferida marcada como inferida |
| 7 | Cidade ambígua | texto compatível com múltiplas localidades | `AMBIGUO`; nenhuma província escolhida |
| 8 | Agência informada | agência exata e única no catálogo | nome/endereço/setor como alta confiança; modalidade agência como candidata |
| 9 | Mudança de agência | agência do pedido antigo difere da conversa atual | agência antiga fica histórica; divergência atual visível; nenhuma alteração no envio antigo |
| 10 | Endereço domiciliar | endereço atual sem sinal de agência | modalidade domicílio provável/confirmada conforme fonte; agência vazia |
| 11 | VSL Vit Power + negociação Tex Ultra | VSL estruturada Vit Power; pedido/ficha atual Tex Ultra | dois campos preservados; `VSL_NEGOTIATION_DIVERGENCE`; nenhuma correção |
| 12 | VSL Tex Ultra + negociação Vit Power | VSL estruturada Tex Ultra; pedido/ficha atual Vit Power | mesmo comportamento inverso; sem trocar VSL nem negociação |
| 13 | Pedido antigo não retirado | envio histórico devolvido/não retirado | status histórico exibido; não transformar esse pedido em atual; eventual restrição comercial apenas informativa |
| 14 | Pedido entregue | pedido e envio com entrega concluída | item histórico entregue; datas/status visíveis; imutável |
| 15 | Dois pedidos simultâneos | dois pedidos não terminais, sem ponte explícita | `MULTIPLE_ACTIVE_ORDERS`; nenhum selecionado silenciosamente |
| 16 | Dado manual diferente da extração | decisão manual comprovada diverge do extrator | manual permanece vencedor; `CONFLITO` visível; extração não aplicada |
| 17 | Imagem/OCR com endereço | OCR acionado pelo operador retorna evidência | candidato marcado OCR/inferido; confiança mapeada; confirmação necessária; nenhum OCR automático |
| 18 | Dado inferido não confirmado | extração/inferência sem fonte superior | `PROVAVEL` ou `AMBIGUO`; `applicationAllowed=false` |

### 12.2 Testes técnicos de ausência de efeitos colaterais

1. comparar `updatedAt` e conteúdo dos documentos antes e depois de abrir o contexto;
2. confirmar zero `save`, `updateOne`, `findOneAndUpdate`, `insert`, `delete` ou `bulkWrite` no serviço;
3. confirmar que o endpoint usa somente consultas de leitura;
4. confirmar que nenhum mock de WhatsApp/Z-API recebe chamada;
5. confirmar que nenhum mock de Meta recebe chamada;
6. confirmar que nenhum mock de Dropi recebe chamada;
7. confirmar que nenhum mock de OpenAI recebe chamada na abertura;
8. confirmar que nenhum pedido histórico é retornado como editável;
9. confirmar que `providerPayload` e `Shipment.raw` não aparecem na resposta;
10. confirmar que telefone ambíguo bloqueia a associação;
11. confirmar que produto ausente permanece `DESCONHECIDO`;
12. confirmar que carregar/trocar cliente não marca formulário como sujo nem agenda autosave.

### 12.3 Testes de regressão existentes que devem continuar verdes

- `npm run senior:check`;
- `npm run guard:status-panels`;
- `npm run guard:freeze-lock`;
- `npm run test:customer-form`;
- `npm run test:meta-attribution`;
- `npm run test:operational-labels`;
- `node --test tests/manual-quick-funnel.test.cjs`;
- `node --test tests/ec-manual-product-dropi-hotfix.test.mjs`;
- testes da extensão, especialmente normalizador, extrator, autosave e origem de produto;
- `git diff --check`.

## 13. Critérios de aceite

### 13.1 Funcionais

1. O painel mostra os oito blocos definidos.
2. Cada campo mostra valor, origem, confiança e atualização.
3. Nome atual e nome detectado aparecem separadamente.
4. Produto da VSL e produto atual aparecem separadamente.
5. Pedido atual e histórico aparecem separadamente.
6. Status de cada pedido histórico é mostrado sem alterar a fonte.
7. Estágio de funil mostra a fonte e eventuais divergências.
8. Conflitos mostram todos os candidatos relevantes.
9. Campo desconhecido aparece explicitamente como desconhecido.
10. Nenhum valor histórico é promovido por simples recência.

### 13.2 Segurança

1. A rota é autenticada e restrita ao painel autorizado.
2. O serviço não possui dependência de envio.
3. A resposta não contém segredos nem payload bruto.
4. Nenhuma leitura altera `updatedAt` de documentos.
5. Nenhuma leitura cria pedido, envio, visita, mensagem ou estado.
6. Nenhuma leitura dispara Meta, Dropi, WhatsApp, Z-API, OCR ou funil.
7. A interface não contém botões de aplicação na primeira fase.
8. A interface não reutiliza inputs da ficha nem seus listeners de autosave.

### 13.3 Consistência

1. Telefones são correlacionados de forma canônica e auditável.
2. Duas candidatas por telefone geram ambiguidade.
3. Dois pedidos ativos geram ambiguidade quando não há vínculo explícito.
4. Valores iguais normalizados não geram conflito falso.
5. Valores brutos permanecem disponíveis para auditoria.
6. Datas vêm do registro-fonte, não do momento de renderização.
7. VSL diferente da negociação gera aviso, não correção.
8. Produto ausente não recebe produto padrão.

### 13.4 Governança

1. O freeze V15 recebe sucessor formal V16.
2. Arquivos congelados não são modificados sem manifesto e guard correspondentes.
3. A implementação permanece em commit isolado.
4. Nenhum deploy ocorre junto com a implementação local.
5. Produção continua separada até piloto e autorização específicos.

## 14. Riscos

### 14.1 Risco máximo — efeito colateral por reutilização de caminho de escrita

O painel existente possui rotas e funções que, ao salvar ficha ou alinhar produto/pedido, podem:

- atualizar `ContactState`;
- atualizar/criar `Order`;
- sincronizar painel administrativo;
- registrar locks/eventos associados a compra;
- agendar autosave.

Se o contexto reutilizar esses caminhos, uma simples abertura do cliente pode deixar de ser assistiva. Esse é o maior risco de regressão e deve ser bloqueado por testes de ausência de escrita.

### 14.2 Correlação incorreta por telefone

Consultas atuais usam caudas de 8–10 dígitos em alguns fluxos. Isso ajuda a recuperar formatos diferentes, mas pode unir registros indevidos. A V16 deve preferir telefone completo e aceitar cauda apenas quando o resultado for único.

### 14.3 Pedido atual escolhido por recência

Escolher simplesmente o pedido mais atualizado pode transformar envio antigo com status novo em negociação atual. O vínculo explícito deve vencer; múltiplos ativos sem vínculo geram ambiguidade.

### 14.4 Proveniência manual inexistente por campo

`manualFieldIds` é local à sessão da extensão. Depois do reload, não existe prova de qual campo foi manual. O contexto deve assumir menos, não mais.

### 14.5 Fallback de produto

O resolvedor atual possui fallback quando não encontra produto. Para o contexto, ausência deve permanecer `DESCONHECIDO`, porque escolher um produto por padrão violaria o isolamento VSL/negociação.

### 14.6 OCR e inferência

Mesmo com saída estruturada, OCR pode ler texto incorreto. Nenhum OCR deve ocorrer ao abrir a área e nenhum resultado deve ser promovido sem revisão humana.

### 14.7 Status divergente

Ficha, pedido e envio podem estar em momentos diferentes. O contexto deve mostrar status bruto e status normalizado, com a fonte e a data.

### 14.8 Exposição excessiva de dados

Payloads de provedor, tracking bruto e registros `raw` podem conter informação desnecessária. A resposta deve usar allowlist de campos seguros.

### 14.9 Freeze V15

`public/qr.html`, `src/index.js`, rotas, serviços V15 e scripts estão protegidos por hashes. Alterá-los sem sucessão formal bloqueia os gates e pode bloquear o startup. A V16 precisa herdar o freeze V15 e declarar somente os arquivos efetivamente sucedidos.

### 14.10 Desempenho

Consultas ilimitadas a mensagens, pedidos, envios e visitas podem deixar a troca de cliente lenta. A implementação deve usar índices existentes, limites explícitos e seleção de campos, sem cache persistente na primeira fase.

## 15. Arquivos que provavelmente precisariam ser alterados

### 15.1 Implementação mínima recomendada

| Arquivo | Ação provável | Motivo |
|---|---|---|
| `src/services/customerCurrentContextService.js` | criar | agregador puro, resolução de candidatos/confiança/conflitos |
| `src/routes/customerContext.js` | criar | endpoint autenticado e somente leitura, isolado das rotas de escrita |
| `src/index.js` | modificar minimamente | montar a nova rota e o guard V16 |
| `public/panel-intelligence/customer-current-context.js` | criar | renderizador isolado e sem autosave |
| `public/qr.html` | modificar minimamente | adicionar container e carregar o renderizador |
| `tests/customer-current-context.test.mjs` | criar | 18 cenários e regras de prioridade/conflito |
| `tests/customer-current-context-route.test.mjs` | criar | contrato HTTP, autenticação e ausência de escrita |
| `tests/customer-current-context-panel.test.cjs` | criar | garantir que a área não toca inputs/autosave/envios |

### 15.2 Governança obrigatória do freeze

| Arquivo | Ação provável | Motivo |
|---|---|---|
| `docs/CUSTOMER_CURRENT_CONTEXT_FREEZE_V16_20260816.md` | criar após validação | registrar o contrato aprovado implementado |
| `docs/freeze/customer-current-context-v16-20260816.json` | criar | manifesto sucessor do freeze V15 |
| `scripts/guard-customer-current-context-v16.mjs` | criar | gate local da nova camada |
| `src/services/customerCurrentContextFreezeRuntimeGuardV16.js` | criar | bloquear startup se a camada aprovada divergir |
| `package.json` | modificar minimamente | incluir o guard/teste V16 sem apagar os gates anteriores |

### 15.3 Arquivos que não precisam ser alterados na primeira versão

- `src/services/conversationEngine.js`;
- `src/services/botHandler.js`;
- `src/services/agentRouter.js`;
- serviços de WhatsApp `send*`;
- serviços Dropi;
- serviços Meta/CAPI;
- `src/models/Order.js`;
- `src/models/Shipment.js`;
- `src/models/ContactState.js`;
- `src/models/VslVisit.js`;
- extensão WhatsApp;
- funis por produto;
- schedulers;
- banco e seus dados existentes.

Se a área for exigida também dentro da extensão em uma etapa posterior, `sidepanel.html`, `sidepanel.js`, estilos, versão e testes da extensão entrarão em um escopo separado. Eles não são necessários para o primeiro painel assistivo.

## 16. Plano de implementação mínimo

### Etapa 1 — contrato e funções puras

1. criar tipos conceituais de candidato, campo e conflito;
2. implementar normalizadores somente para comparação;
3. implementar seleção de pedido atual conservadora;
4. implementar resolução de confiança;
5. implementar os 18 cenários com dados sintéticos;
6. validar que produto ausente permanece desconhecido.

### Etapa 2 — agregador de leitura

1. consultar `ContactState`, `Message`, `Order`, `Shipment` e `VslVisit` com `lean()`;
2. usar telefone EC completo como chave;
3. limitar e selecionar os campos consultados;
4. não importar serviços de envio/sincronização;
5. devolver allowlist segura;
6. provar que nenhuma consulta altera timestamps.

### Etapa 3 — rota isolada

1. criar endpoint autenticado;
2. validar telefone e país;
3. devolver `readOnly: true`;
4. usar `Cache-Control: no-store`;
5. não registrar resultado no banco;
6. testar falhas e ambiguidades.

### Etapa 4 — painel assistivo

1. adicionar um container separado da ficha;
2. renderizar os oito blocos;
3. não usar inputs editáveis;
4. não chamar funções de autosave;
5. recarregar somente ao trocar cliente ou por ação explícita de atualizar;
6. mostrar erro/indisponibilidade sem alterar a ficha.

### Etapa 5 — gates e freeze

1. criar sucessor V16 do freeze V15;
2. proteger novos arquivos e versões modificadas;
3. rodar testes V16;
4. rodar todos os gates congelados;
5. auditar o diff por efeitos colaterais;
6. manter implementação sem deploy até autorização separada.

## Respostas finais

### A. Podemos construir isso sem tocar no motor congelado do bot?

Sim. O desenho recomendado usa um serviço novo de agregação somente leitura, uma rota autenticada nova e um renderizador novo no painel. Não há necessidade de alterar `conversationEngine`, `botHandler`, `agentRouter`, funis, schedulers, serviços de envio ou memória ativa.

Será necessário tocar minimamente em arquivos de composição do servidor/painel e suceder formalmente o freeze V15, mas não no motor do bot.

### B. Quais arquivos seriam alterados?

No mínimo:

- criar `src/services/customerCurrentContextService.js`;
- criar `src/routes/customerContext.js`;
- modificar `src/index.js` somente para montar a rota/guard;
- criar `public/panel-intelligence/customer-current-context.js`;
- modificar `public/qr.html` somente para o container e carregamento;
- criar três testes específicos;
- criar manifesto, documento e guards do freeze V16;
- ajustar `package.json` para incluir o novo gate.

Modelos, bot, funis, WhatsApp, Dropi, Meta, schedulers e extensão não precisam mudar na primeira versão.

### C. Alguma mudança de banco é realmente necessária?

Não para a implementação mínima assistiva e somente leitura. As coleções atuais já contêm os dados necessários para montar uma visão conservadora.

Entretanto, a origem manual por campo não é persistida hoje. Se uma fase futura exigir confirmação/aplicação auditável e durável, será necessário acrescentar um ledger append-only de decisões. Isso não é necessário para a primeira versão e não deve ser antecipado agora.

### D. Qual é a implementação mínima possível?

Uma rota autenticada que agrega as fontes existentes sem escrever e um bloco somente leitura no painel que mostra:

- identidade;
- localização;
- produto atual;
- origem/VSL;
- pedido atual;
- histórico;
- funil;
- conflitos.

Sem botões de aplicar, sem autosave, sem consultas externas e sem mudança de schema.

### E. Qual é o maior risco de regressão?

O maior risco é reutilizar, direta ou indiretamente, caminhos atuais de salvamento/sincronização. Uma simples abertura do contexto poderia então atualizar `ContactState`, criar ou alterar `Order`, sincronizar o painel administrativo ou tocar em locks/eventos associados a compra.

A mitigação obrigatória é manter o agregador isolado, com consultas `lean()`, sem imports de serviços de envio/escrita, e criar testes que provem zero mutações antes e depois de carregar o contexto.

## Decisão proposta

Aprovar como primeira funcionalidade V16 apenas o seguinte recorte:

> **CONTEXTO ATUAL V16 — painel assistivo, autenticado, calculado sob demanda, sem aplicação e sem qualquer efeito colateral.**

Qualquer botão de confirmar/aplicar, persistência de proveniência, integração com a extensão ou ativação em produção deve ser tratado como etapa posterior e depender de autorização específica.

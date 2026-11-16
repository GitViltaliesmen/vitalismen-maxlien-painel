# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

## Resultado executivo

**FAIL — o teste integrado não concluiu a marcação da venda. Dois bloqueios funcionais foram reproduzidos no código publicado.** Nenhum pedido confirmado foi criado nos bancos descartáveis e nenhuma compra foi enviada à Meta. Não se apresenta o teste como funcionamento integral aprovado.

Código oficial: `642ff478e73a4a760ca54c5ec87a2851284a5844`, release `/opt/vitalismen-automacao/releases/20261116T135533Z_production-20261116-642ff47`. Produção preservada no PID `3647046`, sem deploy ou restart. A auditoria foi concluída em 16/11/2026 12:25:25 no horário de São Paulo.

Passaram 13 verificações integradas antes do bloqueio e 55 testes complementares de memória, confirmação e mensuração. Esses resultados parciais não anulam o FAIL do percurso completo.

Saudação inicial: **6.986 segundos** entre a entrada persistida e o aceite do provedor local, dentro da janela de 5–30 segundos. As perguntas interromperam a apresentação de mídias conforme a prioridade conversacional.

## Método e isolamento

A aplicação HTTP real do release publicado foi executada em namespace privado de rede e mounts, com MongoDB descartável em RAM e SQLite criado somente com o esquema das tabelas EC, sem copiar registros de clientes. Releases e contratos permaneceram somente leitura. O provedor WhatsApp foi substituído por servidor HTTP local; ACKs simulados percorreram a rota oficial de delivery. As janelas de silêncio de um minuto transcorreram em tempo real na execução final.

A IA foi simulada por respostas e tool calls pré-definidas. As ferramentas, validações, memória, roteamento, classificadores e persistência foram executados pelo código oficial. Portanto, esta execução testa o processamento e as travas; não é prova de qualidade de todas as gerações futuras da OpenAI nem de entrega física pelo WhatsApp. Nenhum cliente real foi usado.

## Percurso percorrido

| Fase | Resultado observado | Pedidos confirmados |
|---|---|---|
| Entrada e saudação | Dados e resposta conferidos | 0 |
| Preço e composição em ordem | Dados e resposta conferidos | 0 |
| Quantidade e cidade | Dados e resposta conferidos | 0 |
| Nome e entrega | Dados e resposta conferidos | 0 |
| Dados completos e resumo | Resumo preparado, aguardando confirmação | 0 |
| Correção do endereço e novo resumo | Resumo preparado, aguardando confirmação | 0 |
| Resposta “Sí, confirmo” | FAIL: persistida, desviada para Revisar antes do bot | 0 |
| Resposta “Confirmo el pedido” | FAIL: registro recusado por divergência do snapshot do resumo | 0 |

## F1 — confirmação curta não chega ao bot

Após várias trocas, o cliente respondeu “Sí, confirmo” a um resumo atual entregue/lido, com três frascos, USD 95,99, Quito/Pichincha e endereço completo. O callback foi persistido, mas retornou `routeToBot=false`, bucket `review`, motivo `insufficient_high_confidence`, score 55, sem risco ou opt-out. Nenhuma venda foi criada. O texto “Confirmo el pedido” retornou `routeToBot=true`.

O replay da função oficial do classificador produziu:

| Resposta | Classificação |
|---|---|
| Sí | review: insufficient_high_confidence |
| Sí, confirmo | review: insufficient_high_confidence |
| Correcto | review: insufficient_high_confidence |
| Confirmo el pedido | orders: support_intent |

Causa localizada em `src/services/ecConversationBucketService.js`: o reconhecimento de contexto comercial ativo utiliza etapas `awaiting_`/`sdr_awaiting_`; a memória conversacional com resumo pendente não fornece uma dessas etapas. Com mais de quatro entradas e sem palavra comercial na resposta atual, o classificador deixa de reconhecer o contexto. A confirmação do SDR nem chega a ser consultada.

## F2 — resumo rejeitado sem alteração comercial

Na execução final, “Confirmo el pedido” alcançou `register_confirmed_order`. A ferramenta respondeu `summary_changed_confirmation_required`. Nome, produto, quantidade, preço, cidade, província, modalidade e endereço permaneceram iguais. Não houve pedido confirmado.

Causa reproduzida pelo cálculo oficial do fingerprint: `capture_customer_detail` inclui `productKey` no draft e o resumo calcula o hash desse objeto. A persistência/contextualização de `principalSdrFreeflowRuntimeService.js` usa `copyDraft`, cuja lista de campos omite `productKey`. No turno seguinte, o mesmo resumo é comparado com o draft sem esse campo interno. Os hashes divergem embora os dados comerciais sejam iguais.

- Snapshot persistido/com `productKey`: `49638155a36376f4490ef011700f20e02e5334b97faefad5dc06cba12d0370fe`.
- Mesmo conteúdo comercial, sem `productKey`: `d963aa6def3bc904c12f02a6b470b2360f395285e279e65cc727d4427c278934`.

A prova mostra zero chamadas de registro concluídas e nenhuma tentativa persistida de registro após essa recusa. O bloqueio ocorre antes da criação do pedido, não em uma rejeição externa da Dropi.

## Perguntas e respostas capturadas

### Entrada e saudação

Cliente: Hola, vengo del video.
Quiero conocer la oferta disponible de Vit Power.
¡Me interesa aprovechar la mejor promoción y hacer mi pedido! ¿Me ayudan?
Nombre: Carlos Prueba

Últimas saídas capturadas no provedor local:

- ¡Hola! Buenos días, Carlos! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Vit Power. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.

Ficha persistida: `{"name": "Carlos Prueba", "productKey": "vit_power_ec"}`.

### Preço e composição em ordem

Cliente: Preço de 3 frascos, depois composição

Últimas saídas capturadas no provedor local:

- ¡Hola! Buenos días, Carlos! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Vit Power. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.
- Precio: 3 frascos: USD 95.99. / Composición de Vit Power: borojó, chontaduro, noni, L-arginina, maca, guaraná, vitaminas. / ¿Cuántos frascos desea?

Ficha persistida: `{"name": "Carlos Prueba", "productKey": "vit_power_ec"}`.

### Quantidade e cidade

Cliente: Quiero 3 frascos. Estoy en Quito.

Últimas saídas capturadas no provedor local:

- ¡Hola! Buenos días, Carlos! Soy Ana Lopez, del equipo de la Dra. María Fernandes. Gracias por tu interés en Vit Power. Estoy aquí para ayudarte y aclarar tus dudas. Te comparto una breve presentación y seguimos conversando.
- Precio: 3 frascos: USD 95.99. / Composición de Vit Power: borojó, chontaduro, noni, L-arginina, maca, guaraná, vitaminas. / ¿Cuántos frascos desea?
- Tengo 3 frascos y Quito. ¿Prefiere una agencia Servientrega o domicilio?

Ficha persistida: `{"name": "Carlos Prueba", "quantity": 3, "total": 95.99, "city": "Quito", "productKey": "vit_power_ec"}`.

### Nome e entrega

Cliente: Me llamo Carlos Prueba. Entrega a domicilio.

Últimas saídas capturadas no provedor local:

- Precio: 3 frascos: USD 95.99. / Composición de Vit Power: borojó, chontaduro, noni, L-arginina, maca, guaraná, vitaminas. / ¿Cuántos frascos desea?
- Tengo 3 frascos y Quito. ¿Prefiere una agencia Servientrega o domicilio?
- Gracias, Carlos. ¿Cuál es la dirección de entrega?

Ficha persistida: `{"name": "Carlos Prueba", "quantity": 3, "total": 95.99, "city": "Quito", "deliveryMode": "home", "productKey": "vit_power_ec"}`.

### Dados completos e resumo

Cliente: La provincia es Pichincha. Dirección: Avenida Simulada 123. Referencia: junto al parque.

Últimas saídas capturadas no provedor local:

- Tengo 3 frascos y Quito. ¿Prefiere una agencia Servientrega o domicilio?
- Gracias, Carlos. ¿Cuál es la dirección de entrega?
- Carlos Prueba: 3 frascos de Vit Power por USD 95.99. Quito, Pichincha. Entrega: Avenida Simulada 123. Confirma estos datos y el pedido?

Ficha persistida: `{"name": "Carlos Prueba", "quantity": 3, "total": 95.99, "city": "Quito", "province": "Pichincha", "address": "Avenida Simulada 123", "deliveryMode": "home", "productKey": "vit_power_ec"}`.

### Correção do endereço e novo resumo

Cliente: La dirección correcta es Avenida Simulada 456.

Últimas saídas capturadas no provedor local:

- Gracias, Carlos. ¿Cuál es la dirección de entrega?
- Carlos Prueba: 3 frascos de Vit Power por USD 95.99. Quito, Pichincha. Entrega: Avenida Simulada 123. Confirma estos datos y el pedido?
- Carlos Prueba: 3 frascos de Vit Power por USD 95.99. Quito, Pichincha. Entrega: Avenida Simulada 456. Confirma estos datos y el pedido?

Ficha persistida: `{"name": "Carlos Prueba", "quantity": 3, "total": 95.99, "city": "Quito", "province": "Pichincha", "address": "Avenida Simulada 456", "deliveryMode": "home", "productKey": "vit_power_ec"}`.

## Mensuração e página pública

A página pública respondeu HTTP 200 com identificação de player. O arquivo atual `assets/cta.js` respondeu HTTP 200 com User-Agent móvel/Referer da própria página e contém captura de nome, mensagem Vit Power e destino final 2958. A verificação foi somente HTTP, sem executar JavaScript ou emitir eventos comerciais.

Os 55 testes complementares passaram, incluindo exigência de confirmação para Purchase, deduplicação e preservação de fbp/fbc/IP/User-Agent. Nesta conversa integrada não havia visita atribuída e não foi fabricada atribuição. Como a criação do pedido não foi concluída, a prova posterior de Purchase com esse pedido ficou sem pré-requisito (`NO_CONFIRMED_SIMULATED_ORDER`). Não há aceite real da Meta comprovado por esta simulação.

## Correção indicada antes de nova aprovação

1. Reconhecer confirmações curtas quando houver conversa e resumo comercial atuais comprovados do mesmo contato/produto; preservar opt-out, risco, humano, pedidos ativos e demais exclusões.
2. Calcular o snapshot do resumo e da confirmação sobre a mesma representação canônica de campos, sem retirar a verificação de mudança de dados.
3. Repetir o percurso completo com “Sí”, “Sí, confirmo”, “Correcto” e “Confirmo el pedido”, cobrindo correção de endereço, recusa, dados incompletos e repetição.
4. Com o pedido confirmado realmente persistido no ambiente isolado, conferir o espelho `confirmado` e o evento Purchase idempotente. Publicação de correções não fez parte desta execução de auditoria.

## Tentativas preservadas

Tentativa 1: o relógio acelerado do simulador conflitou com a preparação do esquema Date. Tentativa 2: o relógio acelerado não concluiu a resposta agrupada sob os contratos selados; não foi aceito como prova. Tentativa 3: a confirmação antecipada interrompeu o percurso e foi separada do caminho de dados completos. Tentativa 4: a confirmação curta reproduziu F1; a frase completa passou no roteamento, mas faltava esse texto no mock da IA. O mock foi ajustado, sem alterar a aplicação. A execução final, com relógio nativo e ferramenta de confirmação correta, reproduziu F2. As falhas não foram convertidas em PASS.

## Evidências, encerramento e limites

Evidências locais: `C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao\ops\observations\funnel-sale-simulation-v229-20261116`. Manifesto SHA-256: `AUDIT_SHA256.json`; resultado final: `RESULT.json`; callbacks F1: `CONFIRMATION_PROBE.json`; classificação: `CLASSIFIER_REPLAY.json`; diferença do resumo: `SUMMARY_FINGERPRINT_REPLAY.json`; tool calls: `MODEL_TRACE.jsonl`.

Ambiente temporário encerrado e removido. Produção conferida online, mesmo release/PID, Z-API conectada. Zero deploys, restarts, gravações de produção, mensagens reais, pedidos Dropi reais e eventos Meta reais. O backup global MongoDB continua FAIL por consistência, separado deste resultado funcional.

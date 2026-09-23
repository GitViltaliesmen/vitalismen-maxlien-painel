# V161 — precedência de desistência e Comprar depois no funil EC

Data: 2026-09-14
Base imutável: V160, commit `0902194ecd5454d0f720466c4bd2bc081cfd97a0`,
tree `462aaa34a289ca596bec28158985f42c0ad6322c`.

## Defeito comprovado

Na fonte V160, expressões positivas contidas em frases negativas eram avaliadas
antes de existir uma decisão canônica de desistência. Em checkout pendente,
`No deseo el pedido` era classificado como `purchase_intent`, e os fallbacks
podiam repetir perguntas de quantidade, dados ou entrega. Expressões temporais
como `No por ahora` também não entravam de modo uniforme no contrato existente
`comprar_depois`/`buy_later`.

A reprodução foi feita somente com fixture sanitizada e imports locais. O caso
histórico cujo telefone termina em `0268` não foi lido para mutação nem reparado.

## Contrato funcional

A microcamada `src/services/ecNegativeIntentBuyLaterV161Service.js` executa
antes de intenção positiva, continuação de quantidade, pergunta de entrega,
coleta de dados e fallback rígido do funil oficial Vit Power EC. Tex Ultra e
Nitrix continuam em seus gates de atendimento manual, sem mutação ou resposta
automática V161.

Precedência efetiva:

1. uma intenção negativa/deferida consulta primeiro se já existe `Order` ou
   `Shipment` do telefone;
2. opt-out explícito prevalece e não recebe resposta automática;
3. deferimento temporal explícito prevalece em mensagem mista, para preservar
   o exemplo `No deseo... Tal vez para el próximo mes` como `buy_later`;
4. cancelamento/desistência interrompe o checkout atual;
5. só depois permanece válida a intenção positiva e o restante do funil.

Se qualquer `Order` ou `Shipment` persistido for localizado, a camada falha
fechada: não altera pedido/remessa, não cancela Dropi, não sincroniza status
comercial e não envia resposta. Apenas pausa a automação do contato e registra
handoff humano. Isso cobre explicitamente `confirmed`, `processing`, `shipped`,
`delivered` e `returned`, além de conservar estados antigos ou inesperados.

Sem `Order`/`Shipment`, uma desistência limpa somente o
`pendingCheckoutOrder`, preserva histórico e usa o status já existente
`cancelado`. Um deferimento usa somente `comprar_depois`/`buy_later`. Datas são
gravadas apenas quando inferíveis pelo contrato existente: próximo mês, fim do
mês ou quinzena. Timing vago deixa o reminder inativo e pergunta somente em que
dia o cliente deseja novo contato.

O scheduler `ADMIN_BUY_LATER_FOLLOWUP_ENABLED` continua desligado por padrão.
Esta versão persiste intenção e agenda canônica quando determinada; ela não
habilita execução automática de follow-up.

## Efeitos explicitamente proibidos

- criação de `Order` ou `Shipment` pela microcamada;
- cancelamento ou atualização automática na Dropi;
- emissão de Meta Purchase/CAPI;
- mudança de preço, produto, VSL, pixel, número, transporte ou mídia;
- mudança em V114, V116, V141, V70, V78 ou `vitalismen-authorize`;
- liberação de scheduler mutante;
- mensagem real durante teste/canário;
- reparo do contato histórico `0268`.

## Qualificação do contrato V148 — Processo 8A

O teste `tests/meta-funnel-v148.test.mjs` preservava a expectativa original da
V148 de bloquear `orders.insertOne` mesmo dentro do webhook Z-API autorizado.
A mesma asserção falhou no commit V160 imutável e na candidata V161.

A V153 substituiu explicitamente essa expectativa ao restaurar somente
`orders.insertOne` e `orders.updateOne` em `POST /api/zapi/webhook` e
`POST /api/zapi/webhook/received`, sempre com perfil V78 operacional e
`writeContext=true`. O freeze e o teste V153 protegem essa tupla exata; deleção,
rota genérica, coleção diferente e contexto sem escrita continuam bloqueados.

O Processo 8A foi classificado como `STALE_TEST_CONTRACT`. Apenas o teste V148
foi alinhado ao contrato sucessor já vigente na V160: a inserção exata passou a
ser esperada como permitida, enquanto `orders.deleteMany` e
`shipments.insertOne` permanecem esperados como bloqueados. Nenhum código
runtime V148, V153 ou V161 foi alterado por essa reconciliação.

## Arquivos e relação direta

```text
FILE=src/services/ecNegativeIntentBuyLaterV161Service.js
WHY_REQUIRED=centraliza classificação, fail-closed de Order/Shipment e persistência canônica
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=src/services/conversationEngine.js
WHY_REQUIRED=executa a decisão antes das continuações e fallbacks que reproduziram o defeito
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=tests/negative-intent-buy-later-v161.test.mjs
WHY_REQUIRED=cobre fixtures, precedência, checkout pendente e ausência de efeitos externos
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=tests/meta-funnel-v148.test.mjs
WHY_REQUIRED=alinha a expectativa obsoleta V148 à permissão exata e protegida pela sucessora V153
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=scripts/guard-negative-intent-buy-later-v161.mjs
WHY_REQUIRED=impõe manifesto, ordem de integração e limites de segurança
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=scripts/lib/ec-runtime-successor-v155-context.mjs
WHY_REQUIRED=registra V161 como sucessor e mantém os congelamentos ancestrais fail-closed
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=docs/freeze/ec-negative-intent-buy-later-v161-20260914.json
WHY_REQUIRED=congela hashes e política da microcamada sucessora
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=docs/EC_NEGATIVE_INTENT_BUY_LATER_FREEZE_V161_20260914.md
WHY_REQUIRED=documenta o contrato funcional e os limites operacionais
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=docs/ARQUITETURA_AUTOMACAO_OFICIAL.md
WHY_REQUIRED=registra a nova precedência na arquitetura oficial do funil
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=docs/FUNIL_ATENDIMENTO_FECHAMENTO.md
WHY_REQUIRED=registra a interrupção canônica do checkout no fluxo oficial
DIRECT_RELATION_TO_PROCESS_8=YES

FILE=docs/ARQUIVOS_OFICIAIS.md
WHY_REQUIRED=registra fontes, freeze, manifesto, guard e teste oficiais V161
DIRECT_RELATION_TO_PROCESS_8=YES
```

## Validação sem provider

Os testes V161 usam dublês de `ContactState`, `Message`, `Order`, `Shipment`,
transporte e sincronização do painel. Portanto:

```text
REAL_WHATSAPP_MESSAGES=0
DROPI_CALLS=0
META_CALLS=0
SHIPMENT_CREATED=0
ORDER_CREATED_BY_TEST=0
KNOWN_RESIDUAL_PHONE_TAIL=0268
DATA_REPAIR=DEFERRED
```

O guard oficial é `scripts/guard-negative-intent-buy-later-v161.mjs`; o
manifesto canônico é
`docs/freeze/ec-negative-intent-buy-later-v161-20260914.json`.

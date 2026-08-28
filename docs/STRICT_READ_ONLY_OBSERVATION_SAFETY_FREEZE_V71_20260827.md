# STRICT READ ONLY OBSERVATION SAFETY — V71

Freeze ID: `strict-read-only-observation-safety-v71`

Parent: `deploy-publication-attestation-safety-v70-20260827`

Data compatibility version: `66`

Status: implementação local validada; sem push, tag, instalação de helper, stage, publicação, ativação ou mutação de produção.

## Contrato congelado

Quando o runtime oficial estiver em `SAFE_OBSERVATION_ONLY`, a política efetiva é obrigatoriamente `STRICT_READ_ONLY`. Configuração ausente, inválida ou ambígua dentro de um runtime safe falha fechada. A lista de classes de escrita permitidas é vazia.

O serviço central `src/services/strictReadOnlyObservationService.js` é a fonte única para resolução de modo, bloqueio de mutações, bloqueio de rotas, persistência de transporte, startup Baileys, política Z-API, política de VSL, health e barreira global Mongoose.

No modo estrito:

- Mongo business/bookkeeping writes: `0`;
- criação/migração de índices: `0` (`autoIndex=false`);
- escrita de sessão Baileys: `0` e startup Baileys não executado;
- callbacks ACK/delivery e inbound Z-API: HTTP `202 accepted/ignored`, sem leitura operacional prévia, persistência, roteamento, retry storm ou provider;
- `ZAPI_ROUTE_INBOUND_TO_BOT=false` é consumido no runtime;
- `/api/whatsapp/vsl-stage` e `/api/whatsapp/vsl-entry`: HTTP `202 accepted/ignored`, sem `VslVisit`;
- GETs e dashboard permanecem disponíveis como read model;
- POST/PUT/PATCH/DELETE mutantes retornam `423` com `STRICT_READ_ONLY_OPERATION_BLOCKED` antes do handler;
- `/api/auth/login` permanece disponível, sem atualizar `lastLoginAt`;
- schedulers, Dropi APPLY, outbound e telemetria mutante: `0`.

## Defesa em profundidade

A barreira Mongoose intercepta insert, update, replace, find-and-modify, delete, bulk write, index creation/removal, drop, rename e mutações de collection/database. Serviços de outbound, Z-API, dedupe e lock Shipment também bloqueiam antes de qualquer efeito. Não há exceções de escrita nesta política.

## Baseline documental read-only

`scripts/audit-document-level-baseline-readonly.mjs` usa apenas leitura Mongo monitorada e cobre:

- shipments;
- orders;
- contactstates;
- outbounddedupes;
- messages;
- dropisynccycles;
- operational_safety_states;
- vslvisits.

Cada documento produz `_id` canônico, `fullDocumentSha256`, `criticalFieldsSha256` e `updatedAt`; cada coleção produz `aggregateSha256` e `documentCount`. `VslVisit` usa o documento inteiro como projeção crítica. Qualquer comando mutante observado encerra a auditoria com falha.

## Overlay futuro, não instalado nesta missão

O helper candidato passa a declarar:

```text
VITALISMEN_STRICT_READ_ONLY=true
SAFE_OBSERVATION_POLICY=STRICT_READ_ONLY
WHATSAPP_CONNECT_ENABLED=false
ZAPI_ROUTE_INBOUND_TO_BOT=false
ZAPI_PERSIST_INBOUND_ENABLED=false
ZAPI_PERSIST_ACK_ENABLED=false
VSL_STAGE_PERSIST_ENABLED=false
```

O helper instalado em produção não foi alterado.

## Evidência obrigatória

Os gates canônicos são `npm run guard:runtime-chain-v71` e `npm run guard:predeploy-v71`. A cadeia é V71 → V70 → V69 → V68 → V67 → V66 → ancestrais, com propagação de falha e overrides sucessores declarados. Os testes V71 cobrem health, dashboard, foto, VSL, ACK correspondente, inbound EC, Baileys, painel mutante, dedupe, Shipment direto, comandos Mongo, baseline antes/depois e regressão operacional.

## Limite operacional

Esta freeze não autoriza push, tag, instalação, stage, publicação, `/current`, PM2, bridge, scheduler, provider, Dropi, mensagem real ou escrita em dados de produção. A V70 histórica permanece no commit `288e49b73564bd17184174db0d5b0fa25f223225`, tree `e4732ca0ae4b6e33c41af4271f2597e3eb9a39f8` e manifesto byte-intacto.

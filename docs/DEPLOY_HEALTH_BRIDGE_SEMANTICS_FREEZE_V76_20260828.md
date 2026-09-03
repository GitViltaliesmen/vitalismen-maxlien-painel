# Freeze V76 — semântica do health para bridge persistente V66

Data: 2026-08-28
Freeze ID: `deploy-health-bridge-semantics-v76`
Parent: `canary-isolation-safety-v75`
Estado: candidata exclusivamente local; não publicada, não staged e não ativada.

## Objetivo e causa raiz

A V76 corrige exclusivamente um falso negativo do health transacional do helper
versionado `ops/vitalismen-stage`. Depois da bridge A4, o documento persistente
`post-sale-safety-v66` registra `bridgeComplete=true` como prova de que a
migração de compatibilidade de dados terminou. O predicado anterior interpretava
esse fato histórico como se uma bridge operacional estivesse habilitada e
recusava um runtime corretamente contido.

A distinção obrigatória passa a ser:

- `automationSafety.compatibilityBridgeComplete=true`: migração persistente V66
  concluída, com `dataCompatibilityVersion=66` e `minimumRuntimeVersion=66`;
- `POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false`: bridge operacional continua
  desligada no processo;
- `POST_SALE_V66_MUTATIONS_ENABLED=false`: writes pós-venda continuam desligados;
- autorizações de mutação e bridge permanecem vazias;
- schedulers mutantes permanecem zero e `DISABLE_SCHEDULER=1`;
- Dropi permanece `REPORT_ONLY`, sem APPLY.

## Limite da microlayer

A alteração funcional está restrita ao consumidor do health dentro do helper.
`src/routes/health.js` permanece byte-intacto: ele continua expondo
`compatibilityBridgeComplete` a partir de `bridgeComplete` persistido. Nenhum
schema, documento MongoDB, bridge, rota, provider, scheduler, Meta, Dropi,
WhatsApp, Z-API, PM2, `.env`, release ou tráfego é alterado.

O helper exige simultaneamente política `STRICT_READ_ONLY`, lista vazia de
classes de escrita, persistências inbound/ACK desligadas, Baileys desligado,
rotas mutantes desligadas, zero schedulers mutantes, mutações operacionais
desligadas, migração V66 concluída e Dropi em `REPORT_ONLY`. A prova persistente
não concede nenhuma capacidade operacional.

## Contrato fail-closed

O contrato executável V76 valida separadamente o health e o overlay do processo.
Qualquer uma destas divergências bloqueia:

- `bridgeComplete` ausente/falso ou versões diferentes de 66;
- bridge-ready ou mutações habilitadas;
- autorização não vazia;
- qualquer scheduler, conexão/provider ou auto reply habilitado;
- classe de write, rota mutante ou scheduler mutante no health;
- Dropi fora de `REPORT_ONLY` ou APPLY permitido;
- regressão ao predicado legado `compatibilityBridgeComplete !== false`.

Os testes também exercitam as barreiras existentes: `STRICT_READ_ONLY` recusa
provider, banco, Dropi APPLY e Meta; o gate V75 continua recusando Dropi e Meta
até para o único telefone QA.

## Arquivos e cadeia

- contrato: `scripts/lib/deploy-health-bridge-semantics-contract-v76.mjs`;
- helper versionado: `ops/vitalismen-stage`;
- guard estático: `scripts/guard-deploy-health-bridge-semantics-v76.mjs`;
- runtime guard: `src/services/deployHealthBridgeSemanticsSafetyFreezeRuntimeGuardV76.js`;
- testes: `tests/deploy-health-bridge-semantics-v76.test.mjs`;
- manifesto: `docs/freeze/deploy-health-bridge-semantics-v76-20260828.json`.

A cadeia passa a ser V76 → V75 → V74 → V73 → V72 → V71, mantendo
`RUNTIME_GUARD_CHAIN_VERSION=71` e `DATA_COMPATIBILITY_VERSION=66`.

## Rollback

Enquanto esta candidata permanecer local, o rollback é a reversão integral do
diff V76 para o commit pai V75 `0950a303c24782cf9a3f47eda93890e69e6d3a85`.
Nenhum rollback de dados é necessário ou autorizado, pois a V76 não escreve no
banco e preserva `bridgeComplete=true` como evidência A4. Qualquer publicação,
stage ou ativação futura exigirá autorização nova, identidades exatas e gates
separados.

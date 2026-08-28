# DEPLOY HELPER V71 CHAIN ALIGNMENT SAFETY — V72

Freeze ID: `deploy-helper-v71-chain-alignment-safety-v72`

Parent imutável: `strict-read-only-observation-safety-v71`, manifesto SHA-256 `9321d038b53eaa5148c37fc6662d184a95e6b7fd8e623488b8f54a011df8de86`.

Status: microcorreção exclusivamente local validada; sem push, tag, instalação do helper, stage em VPS, publicação, permit, ativação ou mutação de produção.

## Versões independentes

```text
FREEZE_VERSION = 72
DEPLOY_HELPER_CONTRACT_VERSION = 72
RUNTIME_GUARD_CHAIN_VERSION = 71
DATA_COMPATIBILITY_VERSION = 66
```

A V72 corrige apenas a materialização e o contrato de deploy do runtime V71. Ela não cria uma nova semântica operacional, não cria `runtime-chain-v72` e termina obrigatoriamente validando `npm run guard:runtime-chain-v71`.

## Causa formal

A candidata histórica V71 consolidou `STRICT_READ_ONLY`, mas o helper versionado ainda materializava plumbing V70: `runtime_guard_chain_version=70`, `guardChainVersion=70`, `guard:predeploy-v70` e staging atestado como 70. A classificação é `DEPLOY HELPER CONTRACT VERSION MISMATCH`; não é falha do runtime V71.

## Contrato do helper sucessor

O caminho real `stage` executa e registra:

- `npm run guard:runtime-chain-v71`;
- `npm run guard:predeploy-v71`;
- `.release-source.json` com helper/freeze 72, guard/runtime 71, predeploy `v71`, dados 66 e política `STRICT_READ_ONLY` sem classes de escrita;
- `.staging-complete.json` com a mesma identidade, hashes/fingerprints, commit, tree e source ref;
- publicação e preflight com atestações 71;
- validação de ativação fail-closed antes de carregar/consumir permit e antes de qualquer troca de `/current`.

Qualquer envelope com `guardChainVersion`, `runtimeGuardChainValidated` ou `predeployValidated` divergentes falha. Não existe fallback para 70. Nomes de ações/saídas V70 preservados por compatibilidade de CLI são referências históricas, não declarações ativas de versão.

## Contratos herdados e preservados

A máquina fechada de publicação V70 permanece: enum de dois estados, tag remota exata, hashes imutáveis, envelope separado, TTL do preflight, permit single-use e independência de `production`.

O runtime V71 permanece funcionalmente idêntico: `allowedWriteClasses=[]`, ACK/inbound/VSL/dashboard/foto sem persistência, Baileys sem startup, rotas mutantes bloqueadas, schedulers/outbound/Dropi APPLY/Mongo writes em zero e baseline documental read-only nas oito coleções oficiais.

## Identidade histórica preservada

- V71 commit: `35b9f704aa8186b79cfffb3e54fbbf73ad63336c`;
- V71 tree: `6e29ee3d5736a3bb3cbf8fc1b8b5699c115416a4`;
- V71 helper SHA-256: `dbbdc1283617b36fc51f305d75d0bc41fb1e2431179451a50d8e953265b80571`;
- V71 manifest SHA-256: `9321d038b53eaa5148c37fc6662d184a95e6b7fd8e623488b8f54a011df8de86`.

V70 e V71 continuam recuperáveis byte a byte em suas identidades históricas. Nenhum freeze ou manifesto anterior foi reescrito.

## Limite operacional

Esta freeze não autoriza push, tag, helper install, VPS stage, publication, `/current`, PM2, activation permit, activation, bridge, scheduler, provider, mensagem, Dropi APPLY ou escrita em banco. O último estado conhecido de produção é apenas contexto documental e não foi reconfirmado nesta missão local.

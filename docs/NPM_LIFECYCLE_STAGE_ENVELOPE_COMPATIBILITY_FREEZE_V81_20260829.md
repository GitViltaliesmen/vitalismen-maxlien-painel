# V81 — compatibilidade do preload com o envelope oficial de stage

## Necessidade comprovada

A V80 permanece imutável e corrige corretamente o uso do preload durante npm
lifecycle. Antes de sua publicação operacional, porém, a inspeção do helper
oficial versionado e instalado comprovou uma divergência de identidade: a V80
aceita `.release-source.json` somente com `freezeVersion=80`, enquanto
`ops/vitalismen-stage`, SHA-256
`ff3d9c5ac129a98902b12ecda443cf97876b32142561ad46c70f3540c87c5853`,
materializa o contrato histórico e ainda canônico V72/V71/V66.

O bootstrap V80 falha fechado nesse envelope com
`release_source_identity_invalid`. Reescrever a V80 ou o helper congelado foi
recusado. A V81 é, portanto, a menor sucessora indispensável.

## Correção única

A V81 adiciona um novo bootstrap de stage. Ele reutiliza integralmente a raiz,
manifesto, hashes, classificação de lifecycle e contexto sucessor da V80, mas
valida separadamente o envelope exato produzido pelo helper oficial:

```text
freezeVersion=72
deployHelperContractVersion=72
guardChainVersion=71
runtimeGuardChainValidated=71
predeployValidated=v71
dataCompatibilityVersion=66
strictReadOnly=true
safeObservationPolicy=STRICT_READ_ONLY
allowedWriteClasses=[]
```

O helper precisa conservar o SHA atestado e todos os campos do envelope. Git,
release, commit, tree, source ref, política strict e compatibilidade pós-venda
continuam fail-closed. Lifecycles de dependência não recebem contexto sucessor;
guards npm oficiais mantêm o contexto V79/V80/V81.

Não há bypass de scripts, cópia de preload para `node_modules`, edição de
release, mudança de helper, lógica do bot, Dataset, CTA, VSL, WhatsApp, Dropi,
Meta ou scheduler.

## Ancestralidade

```text
PARENT_VERSION=V80
PARENT_COMMIT=e1396b1650b2a5e0cb556f2f47c5af91fe38452e
PARENT_TREE=bf51cbd2d8b60be11bfc75ca4a4ddaeb495cb8ec
PURPOSE=OFFICIAL_STAGE_ENVELOPE_COMPATIBILITY
```

## Estado de criação

```text
PUSH=NO
TAG=NO
STAGE=NO
DEPLOY=NO
PM2_RESTART=NO
QA_CANARY=NO
WHATSAPP_MESSAGES=0
META_EVENTS=0
DROPI_APPLY=NO
MUTATING_SCHEDULERS=0
COLOMBIA_OPERATIONAL_INFRA_TOUCHED=NO
```

A publicação e o stage permanecem condicionados aos gates integrais desta
sucessora e à autorização operacional já emitida pelo operador.

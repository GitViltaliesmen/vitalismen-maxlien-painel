# V80 — compatibilidade do bootstrap de preload com npm lifecycle

## Escopo

A V80 sucede a V79 exclusivamente para corrigir a propagação do contexto
sucessor durante `npm ci`. V78 e V79 permanecem imutáveis. Nenhuma lógica do
bot, VSL, Dataset, CTA, WhatsApp, Dropi ou scheduler integra esta mudança.

## Causa raiz confirmada

O preload V79 era relativo ao diretório corrente. Quando o lifecycle do Baileys
executou dentro de `node_modules/@whiskeysockets/baileys`, o Node resolveu
`./scripts/lib/ec-bot-core-readiness-v79-successor-context.mjs` dentro da
dependência e encerrou antes do script com `ERR_MODULE_NOT_FOUND`.

## Contrato V80

O bootstrap canônico é identificado por uma URL `file:` absoluta derivada do
arquivo versionado dentro da própria release. O resolvedor valida o marcador do
projeto, os manifestos V79/V80, todos os arquivos protegidos e, quando existe,
a identidade Git ou `.release-source.json`. `INIT_CWD`, raiz explícita e cwd
são validados; traversal, raiz falsa, arquivo fora da raiz e classificação
ambígua falham fechados.

O transporte oficial usa `npm_config_node_options` com o import absoluto. Assim,
o CLI do npm não depende do cwd e os processos Node de lifecycle recebem um
bootstrap resolvível. Lifecycle de dependência é reconhecido positivamente por
`INIT_CWD`, `npm_package_json`, cwd em `node_modules` e evento lifecycle exato;
ele não recebe contexto sucessor e continua executando normalmente. Scripts de
guard oficiais são reconhecidos por allowlist exata e recebem o contexto
V79/V80. O import é removido de `NODE_OPTIONS` após o bootstrap para não vazar a
subprocessos genéricos; a configuração npm permanece apenas nos guards, de modo
que encadeamentos oficiais via npm continuam protegidos.

Scripts lifecycle permanecem habilitados. Não há cópia do preload para
`node_modules`, edição pós-checkout, bootstrap não versionado ou caminho fixo de
uma release futura.

## Ancestralidade

```text
PARENT_VERSION=V79
PARENT_COMMIT=f31e3cf011286fca9c26490e580185ed49ffaf1b
PARENT_TREE=66e6abcd3f3bc2a35eeeb7a429dafe2aef0e9308
PURPOSE=NPM_LIFECYCLE_PRELOAD_BOOTSTRAP_COMPATIBILITY
```

## Preservação operacional

```text
CANONICAL_SHARED_DATASET=1468946114265008
BROWSER_CAPI_EQUALITY=PASS
VSL_PUBLIC_ORIGIN_CONFORMANCE=PASS
PUSH=NO
NEW_REMOTE_TAG=NO
DEPLOY=NO
PM2_RESTART=NO
QA_RESET=NO
QA_CANARY=NO
WHATSAPP_MESSAGES=0
META_EVENTS=0
DROPI_APPLY=NO
MUTATING_SCHEDULERS=0
SAFE_OBSERVATION_ONLY=YES
STRICT_READ_ONLY=YES
COLOMBIA_OPERATIONAL_INFRA_TOUCHED=NO
```

O único próximo passo admissível é aguardar autorização explícita para publicar
a V80, executar novo stage oficial e, em decisão separada, o canário QA.

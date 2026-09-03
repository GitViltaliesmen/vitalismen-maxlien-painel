# Macro 2 — instalação do helper e preflight real V66

Data operacional: 2026-08-26.

## Escopo executado

Foi instalado atomicamente o helper containment-safe proveniente do commit
`d863cef1fafe4868fb36ff402b18db7748567ae0`, sem ativar a aplicação:

```text
PATH=/usr/local/sbin/vitalismen-stage
SHA256=13f29b9f1adadbbd49d9ac0d201ae58af307af4a9cb2b17ef09b51575f58a713
OWNER_MODE=root:root:0755
```

O helper anterior foi preservado com conteúdo, owner, mode e mtime originais:

```text
BACKUP=/var/lib/vitalismen-deploy/backups/vitalismen-stage.pre-v66.20260826T214948Z
SHA256=0c2cf0d0b13d0149ad8c76ff8c94e4b7295d42c474ae6d45ff21a2cf1767b9b6
OWNER_MODE=root:root:0755
SHA_SIDECAR=/var/lib/vitalismen-deploy/backups/vitalismen-stage.pre-v66.20260826T214948Z.sha256
```

## Release staged

```text
RELEASE=/opt/vitalismen-automacao/releases/20260826T215201Z_production-20260826-c97c298
FUNCTIONAL_COMMIT=c97c29815aa4a4c47eb44bb091dcde0f861a733e
FUNCTIONAL_TREE=f836f7a498170870bca169cb84d0aaa697c8702b
SOURCE_REF=refs/heads/codex/post-sale-safety-v66
SOURCE_REF_COMMIT=d863cef1fafe4868fb36ff402b18db7748567ae0
PRODUCTION_BRANCH_CHANGED=false
PRODUCTION_TAG_PUBLISHED=false
```

A ref Codex foi publicada para tornar os commits auditados acessíveis. A branch
`production` permaneceu em `1a3b9a517960d8f48d871d33a4a4098ee63d6fbd` e nenhuma
tag foi criada. O checkout funcional foi destacado em `c97c298`; o commit do
helper não integra o tree da aplicação staged.

O primeiro `official-state-audit` bloqueou corretamente enquanto a construção
estava em `/opt/vitalismen-automacao/staging`. O diretório foi movido para o path
staged definitivo em `/releases`, sem alterar `/current`, e todos os gates foram
reexecutados com sucesso na raiz oficial.

## Gates e preflight

Passaram:

- compatibilidade real V66 contra Mongo;
- official state audit;
- runtime freeze e guard post-sale V66;
- freeze lock antes/depois;
- senior check;
- guards de produto, catálogo Dropi, retirada, contatos e labels;
- `v66-plan` real;
- `v66-preflight` real;
- rollback-plan de `cc85952` como `UNSAFE_OR_NOT_SUPPORTED`.

Resultado de compatibilidade:

```text
COMPATIBILITY_STATE=null
POST_SALE_DATA_COMPATIBILITY=OK runtime=66 minimum=0
V66_SAFE_BOOT=PERMITTED
MUTATIONS=NOT_PERMITTED
BRIDGE=NOT_COMPLETE
```

O overlay protegido foi criado sem alterar o `.env` base:

```text
SAFE_PROFILE=V66_SAFE_OBSERVATION_ONLY
SAFE_OVERLAY_SHA256=1bedef6a75258fb7beb01314cb136ffb95cf8d86aa3cb776b23f8b19475795cf
DROPPI_EC_ACTIVE_SYNC_ENABLED=false
DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY
DISABLE_SCHEDULER=1
POST_SALE_V66_MUTATIONS_ENABLED=false
POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false
```

Não foi criado permit de ativação. `v66-activate-safe` não foi chamado.

## Sudo policy

`/etc/sudoers.d/vitalismen-codex-stage` passou no `visudo`. As regras NOPASSWD
específicas não possuem `SETENV`, wildcard, shell ou argumentos genéricos. Existe
uma permissão administrativa interativa geral, anterior a esta macro e protegida
por senha; ela não foi criada nem ampliada. O comando exato legado `activate`
permanece listado, mas o helper novo o bloqueia antes de qualquer mutação.

## Estado final contido

```text
vitalismen-automation=stopped
PID=0
RESTARTS=101
CURRENT=/opt/vitalismen-automacao/releases/20260826T054900Z_production-20260826-cc85952
V66_ACTIVE=false
ACTIVATION_PERMIT=absent
ACTIVATION_COMPLETE_MARKER=absent
BRIDGE_EXECUTED=false
MUTATIONS_ENABLED=false
PRODUCTION_DATA_MUTATIONS=0
REAL_MESSAGES=0
REAL_DROPI_SUBMISSIONS=0
REAL_DROPI_UPDATES=0
```

Próximo passo permitido somente mediante nova autorização: Macro 3, com nova
revalidação de estado, renovação do preflight se o marker estiver expirado e permit
root de uso único antes de `v66-activate-safe`.

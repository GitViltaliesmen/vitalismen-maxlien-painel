# Hardening containment-safe do helper V66 — 2026-08-26

## Escopo e estado de produção

Esta macroetapa criou e testou uma candidata versionada para o helper oficial de
ativação. Ela não autorizou instalação, release V66, troca de `/current`, startup
do PM2, bridge, mutações, Dropi APPLY ou mensagens.

O estado real preservado durante o trabalho foi:

```text
vitalismen-automation = stopped
pid = 0
restart_time = 101
/current = /opt/vitalismen-automacao/releases/20260826T054900Z_production-20260826-cc85952
```

## Origem e fonte canônica

Não existia fonte versionada correspondente ao script root crítico instalado em
`/usr/local/sbin/vitalismen-stage`. O artefato instalado foi importado byte a byte
como evidência somente leitura:

```text
ops/reference/vitalismen-stage.installed-20260826.sh
SHA256_INSTALLED_HELPER=0c2cf0d0b13d0149ad8c76ff8c94e4b7295d42c474ae6d45ff21a2cf1767b9b6
```

A fonte canônica candidata para revisão e uma futura instalação atômica é:

```text
ops/vitalismen-stage
SHA256_SOURCE_HELPER=13f29b9f1adadbbd49d9ac0d201ae58af307af4a9cb2b17ef09b51575f58a713
```

Qualquer instalação futura deve recalcular o SHA do arquivo já commitado e exigir
igualdade byte a byte com o artefato instalado. Esta macro não instalou o arquivo.

## Causa raiz

O helper anterior modelava ativação como transição entre dois runtimes online.
Por isso exigia PID não zero e health do baseline, não aceitava containment com
PID 0 e unia rollback do symlink a restart automático do runtime anterior. Essa
última união podia iniciar `cc85952` depois de uma falha da candidata, mesmo quando
o contrato de dados já classificava esse runtime como incompatível.

## Contrato novo

A candidata distingue `ONLINE` e `STOPPED_CONTAINMENT`. No segundo estado, PID 0 é
válido e o health anterior é explicitamente pulado. Em ambos os estados, `pm_cwd`,
`pm_exec_path`, `/current` e a metadata da release precisam corresponder ao caminho
oficial.

As operações são separadas:

- `v66-plan RELEASE`: somente leitura; descreve a troca e declara que o runtime
  antigo nunca será iniciado implicitamente;
- `v66-preflight RELEASE`: valida release, commit, manifestos, metadata V66,
  compatibilidade de dados, estado PM2 e produz overlay/marker seguro sem trocar
  `/current` e sem ação PM2;
- `v66-activate-safe RELEASE`: exige preflight fresco e permit root de uso único,
  repete o preflight de compatibilidade antes do symlink, troca `/current`, inicia
  somente a candidata e valida ambiente PM2 e health efetivos;
- `v66-contain`: para somente `vitalismen-automation`, confirma PID 0 e não altera
  banco nem inicia runtime;
- `v66-rollback-plan RUNNER TARGET`: classifica o target antes de qualquer ação;
  target inseguro fica bloqueado e target seguro ainda exige autorização separada.

O comando legado `activate` está bloqueado.

## Perfil `V66_SAFE_OBSERVATION_ONLY`

O `.env` base é preservado. O preflight cria um overlay de release com hash e o
startup injeta os mesmos valores como ambiente efetivo do PM2, com precedência
sobre o dotenv da aplicação. Depois do startup, o helper relê `pm2 jlist` e falha
se qualquer valor efetivo divergir.

O perfil fixa, entre outros controles:

```text
DISABLE_SCHEDULER=1
DROPPI_EC_ACTIVE_SYNC_ENABLED=false
DROPPI_EC_ACTIVE_SYNC_MODE=REPORT_ONLY
POST_SALE_V66_MUTATIONS_ENABLED=false
POST_SALE_V66_MUTATIONS_AUTHORIZATION=
POST_SALE_V66_COMPATIBILITY_BRIDGE_READY=false
POST_SALE_V66_BRIDGE_APPLY_APPROVED=
```

O health ainda precisa confirmar `SAFE_OBSERVATION_ONLY`, mutações desabilitadas,
bridge incompleta, Dropi `REPORT_ONLY`, APPLY falso e ausência de degradação.

## Falha e rollback

Depois do switch, qualquer falha para a candidata produz:

```text
STOP CANDIDATE
EVALUATE ROLLBACK TARGET COMPATIBILITY
OPTIONAL RESTORE SYMLINK
DO NOT START OLD RUNTIME
FINAL PM2 STATE = stopped
```

Rollback de symlink e rollback de runtime não são equivalentes. A candidata não
possui caminho de runtime rollback executável. Mesmo quando o target é seguro, o
plano exige uma autorização operacional separada; quando é inseguro ou
inconclusivo, o runtime start fica bloqueado.

## Auditoria sanitizada

O helper registra JSONL protegido com activation id, timestamp, candidata, commit,
release anterior, estado PM2 inicial, compatibilidade, perfil safe, ação de
symlink, startup, health, containment, compatibilidade do rollback e indicação de
startup do runtime antigo. Secrets e conteúdo do `.env` não são registrados.

## Verificação local sem produção

O harness em `tests/vitalismen-stage-v66.test.mjs` substitui PM2, readlink, ln,
curl/health, compatibility preflight, guard, sleep e flock. Os dez testes cobrem:

1. plan sem escrita;
2. baseline online e candidata saudável;
3. baseline stopped/PID 0 e candidata saudável;
4. falha antes do symlink;
5. falha depois do symlink com `cc85952` incompatível;
6. rollback target inseguro;
7. rollback target seguro com autorização separada;
8. containment explícito do processo nomeado;
9. metadata V66 ausente, com bloqueio fail-closed;
10. overlay safe alterado, bloqueado antes do symlink.

O teste específico do incidente comprova candidata parada, symlink opcionalmente
restaurado, PID final 0, zero starts do `cc85952`, zero provider calls, zero bridge
calls e zero production mutation calls.

O gate estático `scripts/guard-vitalismen-stage-v66.mjs` valida sintaxe Bash,
snapshot instalado, ordenação preflight → symlink → startup, perfil seguro, plan,
separação de rollback e ausência de restart no handler de falha.

Comandos executados localmente e aprovados:

```text
node scripts/guard-vitalismen-stage-v66.mjs
node --test tests/vitalismen-stage-v66.test.mjs  # 10/10 PASS
npm test                                         # exit 0; senior suite 454/454 PASS
npm run official:path                            # official root OK
```

## Diferença auditável

Na comparação inicial entre snapshot instalado e candidata:

```text
1 file changed, 823 insertions(+), 333 deletions(-)
```

A divergência é intencional: remove a ativação transacional insegura, importa a
fonte para versionamento, adiciona o contrato V66 containment-safe, safe overlay,
permit específico, compatibilidade pré-switch, auditoria e comandos separados.

## Próxima macroetapa

O helper está preparado para revisão de instalação, mas continua não instalado.
Uma futura Macro 2 precisa, no mínimo: confirmar novamente produção stopped/PID 0,
comparar o SHA commitado, fazer backup root do instalado, instalar atomicamente,
validar owner/mode e executar somente `status`/preflight real. Ela não deve ativar
a aplicação sem nova autorização explícita.

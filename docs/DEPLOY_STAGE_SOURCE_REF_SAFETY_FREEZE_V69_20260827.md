# Freeze V69 — stage por ref remota exata

Data: 2026-08-27
País e sistema: Vitalismen EC, VPS Hostinger oficial
Parent imutável: `deploy-helper-runtime-safety-v68-20260827`
Compatibilidade persistente: V66

## Causa raiz

O contrato V68 de `stage` selecionava a fonte por `refs/heads/production`,
exigia uma tag `production-*` e obrigava clone, tag local, branch remota e tag
remota a apontarem para o mesmo commit. Esse contrato é adequado depois da
publicação, mas acopla indevidamente a seleção da fonte ao estado de publicação
quando a entrada é uma candidata imutável ainda não promovida.

A candidata V68 não falhou por identidade. Ela foi bloqueada corretamente
porque seu commit não estava na branch `production` nem possuía tag oficial. A
V69 separa transporte, identidade criptográfica e publicação.

## Contrato V69

O comando local é:

```sh
VITALISMEN_STAGE_AUTHORIZED_SOURCE_REF=refs/heads/codex/candidate-v69 \
  vitalismen-stage stage \
  refs/heads/codex/candidate-v69 \
  EXPECTED_COMMIT_40_HEX \
  EXPECTED_TREE_40_HEX \
  YYYYMMDDTHHMMSSZ_production-YYYYMMDD-SHORTSHA
```

A variável e o argumento são obrigatórios e devem ser idênticos. A V69 aceita
somente uma full ref no namespace fechado `refs/heads/codex/`, rejeita sintaxe
ambígua de revision, valida a ref também com `git check-ref-format` e exige
COMMIT e TREE completos em hexadecimal minúsculo. A autorização vale apenas
para o `stage`; não autoriza push, merge, tag, publicação ou ativação.

## Sequência fail-closed

1. valida ref autorizada, commit, tree e nome da release;
2. fotografa `refs/heads/production` no remoto oficial;
3. inicializa repositório privado vazio;
4. executa fetch exato `SOURCE_REF:refs/vitalismen-stage/authorized-source`
   com `--no-tags`;
5. resolve o objeto fetched para commit e o compara com `EXPECTED_COMMIT`;
6. faz checkout detached do hash já resolvido, sem consultar novamente a ponta
   móvel da branch;
7. calcula `HEAD^{tree}` e o compara com `EXPECTED_TREE`;
8. observa opcionalmente a tag derivada apenas para recusar contradição; a
   ausência da tag é válida e a tag nunca substitui COMMIT/TREE;
9. executa a cadeia V69 → V68 → V67 → V66 → ancestrais e os gates congelados;
10. fotografa novamente `production` e falha se ela tiver mudado;
11. grava o marcador completo somente após preservar `/current` e PID PM2.

Uma mudança da branch candidata depois do fetch não altera a release: todas as
operações posteriores usam o commit detached já aprovado. Uma mudança de
`production` durante o stage torna o ambiente inconsistente, remove a release
incompleta e encerra com falha.

## Metadata

`.release-source.json` distingue:

- `releaseChannel: production`, que identifica o canal operacional futuro;
- `sourceRef`, que registra a origem Git real;
- `sourceRefResolvedCommit`, `functionalCommit` e `functionalTree`, que fixam a
  identidade aprovada;
- `productionBranchChanged: false`;
- `productionTagRequiredForStaging: false`.

Uma candidata staged não declara `branch: production` nem `tag`. `v66-plan` e
`v66-preflight` podem validar sua compatibilidade, mas `v66-activate-safe`
permanece bloqueado enquanto a candidata não tiver passado por uma publicação
e autorização separadas.

## Preservado

- A V68 e seu manifesto SHA-256
  `90c1c19433d5f5a2f358be4c0b7aead6f3d8e81615df8005ea62f9348a0dad1e`
  permanecem históricos e byte a byte.
- `run_protected()` continua único, anterior a todas as chamadas, executa
  `"$@"`, não usa `eval`/shell reparse, preserva exit status e mantém log
  sanitizado.
- Containment, PID 0, `SAFE_OBSERVATION_ONLY`, Dropi `REPORT_ONLY`, permit de
  uso único e bloqueio do rollback inseguro continuam ativos.
- `DATA_COMPATIBILITY_VERSION` e runtime mínimo continuam 66.
- Produto, preço, checkout, WhatsApp, Z-API, Dropi, Meta/CAPI, funil, memória,
  schedulers e dados de produção não foram alterados.

## Autorização desta candidata

Esta implementação é exclusivamente local. Não autoriza instalar o helper,
executar stage na VPS, criar release real, alterar `/current`, iniciar/reiniciar
PM2, criar ref/tag, fazer push/merge, executar bridge, enviar mensagem, aplicar
Dropi ou mutar dados de produção.

## Rollback local

Antes de qualquer publicação, descartar o commit V69 retorna exatamente ao
commit V68. Nenhum rollback de VPS ou dados é necessário porque esta missão não
executa mutação de produção.

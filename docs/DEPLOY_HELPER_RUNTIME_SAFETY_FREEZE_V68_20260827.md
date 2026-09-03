# Freeze V68 — segurança de execução do helper de deploy

Data: 2026-08-27
País/projeto: EC / Vitalismen Automação oficial
Estado: candidata local; sem push, tag, staging, instalação, deploy ou startup

## Causa raiz

O commit `d863cef1fafe4868fb36ff402b18db7748567ae0` introduziu ao mesmo
tempo o snapshot histórico do helper e a fonte containment-safe reescrita. O
snapshot preservou `run_protected()`; a fonte nova passou a chamar a função no
caminho `stage`, mas omitiu sua definição. Não houve commit posterior de
remoção: a omissão nasceu no próprio commit de criação da fonte versionada.

A V67 `157e77f703297d785df232bd66128c3ef6adfe07` acrescentou a décima
sexta chamada protegida e congelou corretamente o helper que recebeu. Ela não
causou a omissão. O guard anterior verificava `bash -n`, ordenação de blocos e
testes de plan/preflight/activate/contain, mas nunca executava o ramo `stage` e
não contava definições. Sintaxe Bash válida não prova resolução de função em
tempo de execução.

## Contrato V68

`run_protected()` possui uma única definição anterior a todas as chamadas. Ela
exige `LABEL` e `COMMAND`, valida o executável, chama o comando diretamente por
`"$@"`, preserva argumentos e o status não-zero e não usa `eval`, `bash -c`,
`sh -c` ou `set +e`.

O stdout/stderr de cada gate fica em arquivo de modo `0600`. A trilha JSONL
sanitizada registra somente label normalizado, timestamps inicial/final e exit
status; argumentos, headers, tokens, senhas e conteúdo de `.env` não entram no
audit log.

A chamada adicional `predeploy_v68` eleva o total legítimo de 16 para 17. O
stage futuro precisa atravessar a cadeia runtime V68 e o predeploy V68 antes dos
demais gates. A V68 herda V67 → V66 → ancestrais sem alterar seus manifests.

## Testes obrigatórios

O harness sintético usa apenas diretórios temporários e um repositório Git
local. PM2, Node de guards, npm, readlink, flock e providers são substituídos
por mocks controlados. O caminho real `stage` percorre todos os 17 labels sem
internet, `/opt`, `/usr/local`, Mongo, Z-API ou Dropi.

São cobertos: sucesso, falha, comando ausente, label/comando ausentes,
argumentos com espaços, payload inofensivo de metacaracteres, definição
ausente/duplicada/fora de ordem, clone não-zero, limpeza fail-closed,
containment com PID 0 e bloqueio de rollback inseguro.

## Preservação operacional

- compatibilidade de dados continua `66`;
- runtime mínimo depois do bridge continua `66`;
- `SAFE_OBSERVATION_ONLY`, `REPORT_ONLY`, overlay, permit de uso único,
  containment e bloqueio de `cc85952` permanecem inalterados;
- helper instalado não é editado;
- `/current` e PM2 não são tocados;
- nenhuma mensagem, submissão Dropi, scheduler, bridge ou mutação de produção
  é autorizada por este freeze.

## Rollback local

Antes de publicação, descartar o commit V68 retorna exatamente à V67. Não há
rollback de produção ou dados porque esta missão gera somente candidata local.

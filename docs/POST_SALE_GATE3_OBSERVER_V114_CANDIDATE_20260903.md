# Candidato V114 — separacao entre observador e Gate 3 transacional

Status: candidato local, nao publicado, nao instalado e nao autorizado para producao.

## Problema comprovado

A unidade V113 publicada chama `post-sale-next-eligible-v113 run`. O wrapper V113
delega essa acao para V112, cujo fluxo pode consumir o permit, autorizar V105 e
executar o lote transacional quando surgir um elegivel. Isso nao satisfaz o
contrato operacional posterior que exige monitor observador e scheduler
transacional desligado ate o Gate 3.

## Microcamada proposta

O helper V114 expoe somente `status` e `observe`. A acao `observe` delega para
`post-sale-next-eligible-v112 check RELEASE`, que executa a varredura protegida
por guard Mongoose read-only, sem adquirir lock de notificacao, sem consumir o
permit e sem chamar V105.

A unit V114 chama exclusivamente `observe`. Nenhum instalador ou comando de
ativacao foi incluido neste candidato; trocar timers continua sendo uma acao de
producao separada, proibida nesta etapa.

## Limites deste candidato

Esta microcamada corrige apenas a separacao monitor/gatilho. Ela nao aprova o
Gate 3 e nao resolve as lacunas independentes de timeout ambiguo do provider,
persistencia posterior ao aceite, falhas parciais de Mongo e limite diario sob
concorrencia distribuida. Esses pontos precisam de testes e desenho fail-closed
antes de staging transacional.

## Rollback futuro

Como nada foi instalado, o rollback atual e descartar esta branch/worktree. Se
uma versao futura for instalada, o rollback deve desabilitar apenas o timer V114
e restaurar a unidade observadora aprovada; nunca deve reativar automaticamente
o caminho V112/V113 `run`.

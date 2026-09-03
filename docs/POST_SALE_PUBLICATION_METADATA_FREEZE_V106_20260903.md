# Freeze V106 — vínculo do pós-venda ao envelope V70

Data: 2026-09-03
Escopo: permit do control plane pós-venda V105
Pai: V105 (`275f1e35296bcace64e0c87b5b7bcc22718007d9`)

## Causa

O V105 exigia `publicationTag` e `production_published` no arquivo
`.release-source.json`. Pelo contrato V70 esse arquivo permanece imutável como
`staged_candidate`; a prova de publicação pertence a `.release-publication.json`
e sua conclusão a `.publication-complete.json`. O permit falhou fechado antes do
bridge, de mensagens ou de chamadas Dropi.

## Correção

O contrato passa a combinar as três provas oficiais: identidade funcional e
hash de `.release-source.json`, tag/status/identidade de
`.release-publication.json` e conclusão/hash de `.publication-complete.json`.
Commit, árvore, release e tag precisam coincidir em todo o envelope.
O teste legado V105 também declara e carrega explicitamente o contexto sucessor,
para permanecer determinístico quando executado isoladamente.

## Preservado

O perfil V105, lote máximo um, limite diário um, bridge sem replay, bot, funil,
Z-API, Dropi `REPORT_ONLY`, backlog desligado e Meta retroativo desligado não
mudam. Esta microcamada não executa bridge, mensagem, Dropi ou restart.

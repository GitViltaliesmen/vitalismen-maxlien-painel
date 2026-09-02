# Congelamento V103 — validação da release moderna ativa

## Objetivo único

Permitir que o helper oficial opere sobre uma release moderna já ativada e
publicada sem exigir um diretório `.git` dentro do artefato staged.

## Incidente reproduzido

Depois da ativação segura da candidata
`20260902T220500Z_production-20260902-f66ed8c`, o comando oficial de contenção
V78 fechou antes de qualquer mutação porque `detect_source_process_state`
tentava executar `git rev-parse` dentro da release. A release foi criada pelo
staging oficial como artefato e, corretamente, não contém `.git`.

## Contrato corrigido

Quando `.release-source.json` existe, o helper chama a validação integral já
existente da release sucessora. Commit, tree, payload, source ref, tag remota,
staging, publicação, overlay e envelopes continuam sendo validados. A origem
moderna somente é aceita com `publicationStatus=production_published`.

O caminho legado V102 permanece separado e continua exigindo a attestation
`LEGACY_BASELINE_VERIFIED`. Ausência de ambas as provas continua fail-closed.

## Preservado

Não foram alterados bot, funil, painel, perfil, preços, produtos, banco,
WhatsApp, Z-API, Dropi, Meta/CAPI, scheduler, Nginx, Mongo ou outros processos
PM2. A V103 modifica somente o helper e a composição versionada do guard.

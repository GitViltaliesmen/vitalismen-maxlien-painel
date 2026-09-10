# Sucessão atestada da configuração de runtime

Escopo exclusivo: tooling de deploy. A candidata V147 R3 `b73cabb745508c4be1b56703a03dc74620d1b678` e sua árvore permanecem intactas. Esta alteração não publica nem ativa a candidata.

O helper instalado coincide com `ops/vitalismen-stage` da base, SHA-256 `803481d66f89b235e3d1451050dfe3d64764389f14aa6596bba65cf381e18f99`. O materializador usa `install` para gerar uma cópia regular do `.env` na release. As rotações operacionais posteriores substituíram atomicamente esse arquivo, sem atualizar os envelopes históricos. O helper antigo só reconhece o hash original.

A extensão reutiliza o modelo oficial de attestations em `/var/lib/vitalismen-deploy`, com JSON canônico e selo SHA-256 separados, protegidos por root. Não há serviço, scheduler, alteração de segredo ou caminho alternativo de publicação.

O novo validador em `/usr/local/lib/vitalismen-deploy/runtime-config-successor-v1.cjs` exige uma cadeia finita que vincula release, commit, tree, fingerprint funcional, hashes dos quatro envelopes originais, configuração original, configuração atual, backups, provas de autorização, recibos existentes e hashes do tooling instalado. Os arquivos e o selo são root:root 0400, em diretório 0700. Backups protegidos são lidos apenas em memória para comparar os nomes das chaves e todos os demais bytes. Nenhum valor é emitido, inclusive em erros.

O registro novo é uma attestation feita na data da auditoria, baseada em evidências anteriores. Não substitui nem se apresenta como recibo retroativo de instalação. Os quatro envelopes antigos continuam vinculados ao hash de configuração que registraram. Cada hash atual precisa corresponder ao último sucessor autorizado; divergência sem cadeia, rollback isolado do segredo, alteração de código, metadata, recibo, chave não autorizada, permissões ou tooling falha fechada.

Instalação: arquivar o helper instalado e seu hash fora das releases; instalar o módulo e o helper pelo pacote de tooling revisado; registrar hashes próprios. Nenhum arquivo dentro de release publicada ou staged é substituído. Reexecutar `vitalismen-stage v66-plan` para a candidata exata, sem publicação, permit ou restart.

Rollback do tooling: restaurar somente o helper arquivado pelo caminho oficial `/usr/local/sbin/vitalismen-stage`; ele voltará a bloquear a divergência de configuração original. Preservar attestations e recibos. Não restaurar `.env`, não reiniciar aplicação, não mover `current`.

## Validação do tooling

`bash -n`, `node --check` e 48 testes passaram: 27 cenários novos de sucessão de configuração, mais as suítes existentes de alinhamento V72 e attestation legacy V102. Os testes novos incluem cadeia com duas rotações, rollback indevido, adulteração de evidência, código, metadata, permissões e ausência de autorização.

A execução ampliada de quatro suítes históricas resultou em 22 PASS e 21 FAIL, tanto com o helper original instalado quanto com o corrigido, com a mesma lista de falhas. Os fixtures V70 e V66 falham antes da nova validação por não materializarem o preload V97 e/ou envelopes de staging atuais. Esses testes não foram alterados nem considerados aprovados. Logs integrais dos dois resultados estão preservados no diretório do tooling na VPS. O comando real `v66-plan` da candidata congelada será o teste de integração do contrato atual.

## Proveniência preservada

O staging V146-R2 foi concluído em `2026-09-08T23:43:12Z` com SHA-256 de configuração `9be40dbdf31d9b1e7a97b93c2eae2865bfe7ab133be4eba2ed01ad8181d2d541`. A publicação foi atestada em `2026-09-09T00:10:57Z` com o mesmo hash.

1. Rotação CAPI de `2026-09-09T06:13:47.375Z` a `06:16:07.251Z`: somente `META_ACCESS_TOKEN_EC`; recibo existente `meta-token-rotation-v146-20260909T061347375Z-4178461.json`; hash resultante `d3df172425ba65c0acb3a4123e15e36c06d8bd406239be69792537820c64e232`.
2. Rotação CAPI de `2026-09-09T18:45:30.232Z` a `18:48:30.170Z`: somente `META_ACCESS_TOKEN_EC`; recibo existente `meta-token-rotation-v146-20260909T184530232Z-10698.json`; hash resultante `1300d950c2fa1df9f22808d77cacb03eedf6c689f5b19dcdbcf36f273d64a280`.
3. Instalação Ads em `2026-09-09T23:22:57.432383Z`: somente `META_ACCESS_TOKEN`; comprovada pelo backup protegido, autorização original e saída existente da instalação root, extraída com seus identificadores de tarefa/turno/comando. Hash resultante `4e17c7f06df31e29c6c746fbaef29e70174076a2fb69c44a999d97400a3b0b4d`.

Cada par de backups e o arquivo atual foi comparado em memória: nenhuma chave inesperada e nenhum outro byte alterado. A extração em `docs/evidence` identifica explicitamente sua data atual e natureza de cópia de registros preexistentes. Não há recibo retroativo criado.

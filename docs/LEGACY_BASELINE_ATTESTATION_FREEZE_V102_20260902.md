# Congelamento V102 — attestation formal de baseline legado EC

## Objetivo único

Permitir que o helper oficial reconheça a release V60 já ativa antes do contrato
moderno de staging, sem criar, copiar ou simular `.release-source.json`.

## Baseline fechado

- release: `20260902T064628Z_production-v60-dropi-bff-a691b7e`;
- commit: `a691b7e52defd369cab3a7e451425197f1571642`;
- tree: `177537cc1ad0d12a55f56aa230ab40d301d31ff9`;
- ref Git oficial: `refs/heads/codex/dropi-manual-bff-v60-20260902`;
- fingerprint funcional restrito:
  `aea6779fbac4892b472a4a1e7ab90c52321bd5b88d1e3a217de6a10607e85afb`;
- host oficial: `srv1182009`, vinculado também pelo SHA-256 de
  `/etc/machine-id` sem publicar o identificador original.

O fingerprint usa exclusivamente `package.json`, `package-lock.json`, `ops/`,
`scripts/` e `src/`, com caminho relativo, byte NUL, tipo/permissão executável,
conteúdo e byte NUL. Logs e demais artefatos mutáveis não integram a prova.

## Comando oficial

`vitalismen-stage legacy-baseline-verify RELEASE EXPECTED_COMMIT EXPECTED_TREE EXPECTED_FINGERPRINT`
exige uma frase explícita de autorização, a release como `current`, PM2 online e
apontando para `current`, Git remoto exato, working tree rastreada limpa,
fingerprints idênticos, healths 200, Z-API conectada, Mongo e Nginx saudáveis.

A prova é gravada como `LEGACY_BASELINE_VERIFIED`, `root:root 0400`, com seal
SHA-256 separado. Ela declara expressamente `modernMetadataAbsent=true` e
`stagedSourceClaimed=false`. Release moderna/staged, outro host, outro PID,
conteúdo divergente, health inválido ou prova alterada falham fechados.

## Publicação V70

O caminho moderno com `.release-source.json` continua inalterado. Quando a
origem não possui metadata moderna, `v70-publish` aceita somente a attestation
V102 integralmente revalidada ao vivo. Nesse caso os envelopes usam versão 2 e
registram tipo, release, commit, tree, fingerprint e hash da prova legada.

A prova é single-use. Uma publicação concluída cria marcador de consumo
imutável vinculado à candidata, commit, tag e hash do envelope. Permit antigo
continua recusado e ausência total de prova continua bloqueando o publish.

## Composição com sucessoras

A V102 declara como overrides ancestrais somente o helper e os três serviços
de composição V98, V99 e V101. Esses serviços passaram a reconhecer o mesmo
conjunto global de arquivos substituídos pela sucessora ao validar o pai e o
próprio manifesto. Os manifestos e hashes históricos V97–V101 não foram
reescritos; V100 já possuía esse contrato e permaneceu intacto.

## Preservado

Não foram alterados bot, funil, mensagens, mídia, preços, produtos, painel,
perfil de cliente, banco, Z-API, Meta/CAPI, Dropi, scheduler, Nginx, Mongo,
VSLs ou infraestrutura de outro país. A compatibilidade de dados permanece V66,
a cadeia runtime permanece V71 e a candidata funcional permanece o commit
`f66ed8c`.

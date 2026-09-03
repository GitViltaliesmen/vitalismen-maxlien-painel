# Congelamento V94 — vínculo do preload ao `current` oficial EC

## Objetivo único

Corrigir a divergência entre o caminho físico usado para validar a candidata e o
caminho estável exigido pelo controlador PM2, sem alterar código comercial.

## Causa confirmada

A V93 passou por stage, publicação e preflight. A ativação segura foi contida
antes de iniciar HTTP porque o helper entregou ao PM2 o caminho físico da release,
enquanto o controlador V89 aceita somente o preload canônico via
`/opt/vitalismen-automacao/current`.

## Microcorreção

- stage e guards continuam carregando o preload pela release física candidata;
- após a troca atômica do symlink, o PM2 recebe exclusivamente o caminho
  `/opt/vitalismen-automacao/current/scripts/lib/ec-runtime-successor-v94-context.mjs`;
- o perfil operacional V78 exige exatamente o mesmo caminho estável;
- a cadeia V71–V94 continua integral, sem reescrever hashes ancestrais;
- falhas continuam contidas com o processo parado e sem iniciar a release antiga.

## Preservado

Não foram alterados VSL móvel, página informativa, Pixel/Dataset, CTA, banco,
Z-API, mensagens, funil, Dropi, schedulers, preços ou infraestrutura de outro
país. Os hashes externos congelados permanecem:

- desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.

## Validação obrigatória

```sh
node scripts/guard-ec-runtime-current-binding-v94.mjs
node --test tests/ec-runtime-current-binding-v94.test.mjs
npm run guard:predeploy-v71
```

# Congelamento V95 — limpeza da identidade operacional no boot seguro EC

## Objetivo único

Impedir que uma identidade operacional V78 persistida anteriormente no cadastro
PM2 seja herdada pelo boot seguro V66.

## Causa confirmada

A V94 corrigiu o caminho do preload e o controlador PM2 passou. O health conteve
a candidata porque `VITALISMEN_EC_BOT_CORE_OPERATIONAL=true` permaneceu no
ambiente histórico do PM2, enquanto todas as demais flags já estavam no perfil
`STRICT_READ_ONLY`. A combinação parcial falhou fechada antes de abrir HTTP.

## Microcorreção

- o overlay seguro grava `VITALISMEN_EC_BOT_CORE_OPERATIONAL=false`;
- versão e hash do perfil operacional ficam vazios no boot seguro;
- a verificação do ambiente PM2 exige essa limpeza explicitamente;
- a ativação operacional continua sendo feita somente pelo controlador V78,
  após autorização exclusiva;
- a cadeia V71–V95 permanece integral e sem reescrever hashes ancestrais.

## Preservado

Não foram alterados VSL móvel, página informativa, Pixel/Dataset, CTA, banco,
Z-API, mensagens, funil, Dropi, schedulers, preços ou infraestrutura de outro
país. Os hashes externos congelados permanecem:

- desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.

## Validação obrigatória

```sh
node scripts/guard-ec-runtime-safe-reset-v95.mjs
node --test tests/ec-runtime-safe-reset-v95.test.mjs
npm run guard:predeploy-v71
```

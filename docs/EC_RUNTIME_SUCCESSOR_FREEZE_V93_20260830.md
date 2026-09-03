# Congelamento V93 — contexto sucessor no boot EC

## Objetivo único

Propagar a cadeia sucessora V78–V93 ao processo PM2 tanto no boot seguro V66
quanto na ativação operacional V78, sem ampliar permissões comerciais.

## Causa confirmada

O stage, a publicação, o preflight e o audit oficial da V92 passaram. No boot
seguro, o cadastro PM2 preservou o `NODE_OPTIONS` ancestral V78; o runtime V77H
rejeitou a alteração declarada do helper antes de abrir a porta HTTP. O helper
conteve a candidata e não iniciou a release anterior.

## Microcorreção

- o helper V66 usa o reinício programático isolado V89 para substituir, e não
  herdar, o `NODE_OPTIONS` do processo alvo;
- o controlador Node começa com `NODE_OPTIONS` vazio e injeta somente o preload
  absoluto da release corrente imediatamente antes do restart PM2;
- o perfil operacional V78 exige o mesmo preload sucessor V93;
- o contexto V93 valida o manifesto antes de declarar overrides e então executa
  integralmente a cadeia V92 → V78;
- os guards ancestrais continuam ativos e nenhum hash histórico é reescrito.

## Preservado

Não foram alterados VSL móvel, página informativa, Pixel/Dataset, CTA, banco,
Z-API, mensagens, funil, Dropi, schedulers, preços ou infraestrutura de outro
país. Os hashes externos congelados permanecem:

- desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.

## Validação obrigatória

```sh
node scripts/guard-ec-runtime-successor-v93.mjs
node --test tests/ec-runtime-successor-v93.test.mjs
npm run guard:predeploy-v71
```

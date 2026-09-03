# Congelamento V92 — contexto sucessor no audit oficial

## Objetivo único

Permitir que o subprocesso somente-leitura `senior-guard.mjs`, executado por
`official-state-audit.mjs`, receba o mesmo contexto sucessor absoluto e vinculado
à candidata que já foi validado pelos gates V91.

## Causa confirmada

O V73 e o predeploy V91 passaram no servidor. O gate seguinte iniciou o audit
oficial sem transmitir o contexto ao processo filho. Por isso o senior guard
voltou a interpretar arquivos V90/V91 com regras anteriores à sucessão.

## Microcorreção

- o helper entrega a opção absoluta por uma variável privada do audit;
- o audit copia essa opção somente para `NODE_OPTIONS` do subprocesso do senior;
- a variável privada é removida do ambiente entregue ao filho;
- o contexto V92 valida o manifesto antes de declarar qualquer exceção;
- o senior guard reconhece somente o serviço V90 e o documento V91 nos conjuntos
  restritos já existentes, mantendo todas as demais proibições;
- o `senior:check` deixa de repetir dois guards estáticos V77H/V77H2 cujos hashes
  históricos já foram validados pela cadeia runtime V71–V92 do predeploy;
- nenhum guard, teste ou hash ancestral foi desativado.

## Preservado

Não foram alterados arquivos das páginas externas, Pixel/Dataset, CTA, banco,
Z-API, mensagens, funil, Dropi, schedulers, preços ou infraestrutura de outro
país. Os hashes externos congelados permanecem:

- desktop: `ddf1a65ff3696a10ce7105523397592a85566cb837447210eecb100d3953cf27`;
- celular: `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b`.

## Validação obrigatória

```sh
node scripts/guard-official-audit-successor-v92.mjs
node --test tests/official-audit-successor-v92.test.mjs
npm run guard:predeploy-v71
```

# V152-E-R2 — pairing code nativo controlado

## Escopo autorizado

A V152-E-R2 acrescenta exclusivamente o comando isolado `pair-code` ao helper V152-E. O comando usa `requestPairingCode` do Baileys já instalado para vincular somente a linha de teste `5531983002800` ao namespace externo `V152_TEST_WEB_01`.

## Tratamento do segredo

O código de oito caracteres existe somente em memória e na interação controlada do operador. Enquanto o código estiver presente e a sessão não estiver registrada, `saveCreds` é adiado. Depois da confirmação real, o campo é removido antes da gravação das credenciais. O guard exige `PAIRING_CODE_PERSISTENCE=0` e o receipt não contém o código.

## Preservado

- Z-API e linha de produção `5531971862958`;
- VSL, Pixel, CAPI e Funnel Metrics;
- lógica comercial do bot e painel core;
- clientes, pedidos, Dropi, Servientrega e pós-venda;
- canal de teste em `shadow=true`, `draining=true`, `weight=0` e `capacity=0`;
- migração, roteamento de clientes, handoff, failover e cutover bloqueados.

## Verificação obrigatória

```sh
npm run guard:v152-e-r2
node --test tests/v152-e-controlled-real-pairing.test.mjs
npm test
node scripts/run-with-v144-context.mjs senior:check
npm audit --omit=dev --audit-level=moderate
```

O pareamento real só pode ser executado a partir de candidata staged, nunca pela release ativa. A sessão deve continuar fora da release e uma nova aprovação humana é obrigatória antes de qualquer cutover.

## Rollback

O rollback da sessão permanece restrito ao namespace `V152_TEST_WEB_01` pelo comando versionado com confirmação explícita. A Z-API não é desligada nem drenada.

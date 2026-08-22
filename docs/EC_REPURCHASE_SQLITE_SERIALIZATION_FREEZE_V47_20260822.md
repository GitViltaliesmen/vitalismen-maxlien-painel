# Freeze V47 — serialização SQLite da recompra EC

Data: 2026-08-22
País: EC
Pai: `ec-repurchase-sync-preservation-v46-20260822`

## Incidente observado

O sincronizador do painel administrativo interpola um objeto JavaScript em um
script Python. O campo novo `repurchase_cycle` nasceu como booleano e foi
renderizado como `true`/`false`, tokens inválidos em Python. A ordem e a ficha
permaneceram corretas, mas a atualização SQLite foi recusada antes de escrever.

## Contrato congelado

- `repurchase_cycle` é sempre o inteiro `1` ou `0` antes da interpolação;
- a regra continua verdadeira somente com `previousOrderId` e
  `entryReason=repeat_purchase_after_delivered`;
- o ciclo legítimo pode mover o lead único de `entregue` para `confirmado`;
- ordem, Shipment e Purchase existentes não são recriados;
- Dropi continua sem autorização ou submissão automática;
- AQUECIMENTO permanece excluído da aba comercial global `Novas`.

## Validação obrigatória

```sh
node scripts/guard-ec-repurchase-sqlite-serialization-v47.mjs
node --test tests/ec-repurchase-sqlite-serialization-v47.test.mjs
npm run senior:check
```

## Rollback

Reativar a release V46 preservando bancos, ordens, Shipments e eventos Purchase.

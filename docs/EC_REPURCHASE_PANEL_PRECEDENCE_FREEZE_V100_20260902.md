# Congelamento V100 — precedência da recompra no painel EC

Data: 2026-09-02

## Objetivo

Impedir que um pedido histórico entregue substitua visualmente uma recompra mais recente quando os dois pedidos pertencem ao mesmo telefone.

## Contrato congelado

- A API operacional continua entregando pedidos por `entryAt` e `createdAt` decrescentes.
- A tela `Leads Clientes` mescla somente o primeiro pedido operacional de cada telefone, portanto conserva o ciclo mais recente.
- O pedido histórico permanece no banco, com guia, Dropi e entrega intactos.
- A correção não autoriza nem envia pedido ao Dropi.
- A correção não envia WhatsApp, não altera o funil, preços, produto ou pixel.

## Validação obrigatória

```sh
node scripts/guard-ec-repurchase-panel-precedence-v100.mjs
node --test tests/ec-repurchase-panel-precedence-v100.test.mjs tests/leads-window-status-merge.test.cjs
```

O manifesto canônico está em `docs/freeze/ec-repurchase-panel-precedence-v100-20260902.json`.

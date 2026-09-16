# V168B — sincronização do status de retirada Dropi

## Incidente confirmado

Pedidos recentes enviados à Dropi podiam permanecer como `PENDIENTE/UNKNOWN` no
MongoDB e no painel Vitalismen mesmo quando a API autenticada da Dropi já retornava
`PARA RETIRO EN AGENCIA SERVIENTREGA` com guia válida. O executor V116 calculava a
ação antes da atualização viva e encerrava o item no preflight sem sincronizá-lo.

## Contrato operacional

- A atualização da Dropi ocorre antes do preflight mutável do pós-venda.
- Somente `dropi_orders_api` pode comprovar a liberação de retirada pela Dropi.
- O status deve ser explícito, com ID Dropi, guia, modalidade de agência e
  Servientrega coerentes.
- HTML, DOM, cópia manual, texto de conversa ou correspondência parcial não
  comprovam retirada.
- Entrega, devolução, exceção, não retirada ou retorno informados pela
  transportadora continuam tendo precedência.
- Histórico de mensagens, ledger persistente, lock e dedupe são consultados antes
  de qualquer envio. Um aviso já enviado manualmente é reconciliado, nunca repetido.
- A busca semântica no histórico humano também permanece obrigatória quando o evento
  já possui identidade canônica; a identidade canônica não pode pular o anti-spam.
- O preload oficial V97 recebe a mesma lista exata de hashes V168B antes de executar
  os guards ancestrais; não há wildcard, bypass ou alteração de asserções históricas.
- O adaptador da API preserva `rawStatus` separadamente do status canônico; somente
  o valor bruto vindo de `orders_api_v2` pode ser usado como `dropiRawStatus` para
  provar a liberação de retirada.
- Não há criação de pedido, chamada Dropi de escrita, alteração Meta/CAPI, troca de
  provider WhatsApp ou disparo em massa.

## Caso usado na prova

O pedido exibido pelo operador já continha no histórico o aviso manual de retirada e
a guia. Ele deve ter o status sincronizado, mas o envio deve permanecer bloqueado
por histórico/ledger.

## Verificação

```sh
node scripts/guard-dropi-pickup-status-sync-v168b.mjs
node --test tests/dropi-pickup-status-sync-v168b.test.mjs
```

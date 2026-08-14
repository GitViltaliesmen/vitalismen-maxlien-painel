# Meta CAPI retroativo

## Objetivo

Enviar eventos retroativos `Purchase` para a Meta Conversion API usando os pedidos salvos no MongoDB oficial da Vitalismen.

O script oficial e:

```text
scripts/send-meta-retro-purchases.mjs
```

## Segurança

Por padrao, o script roda em dry-run e nao envia nada para a Meta.

```sh
npm run meta:retro:purchases
```

Para enviar de verdade:

```sh
META_RETRO_SEND=YES npm run meta:retro:purchases
```

Nao execute envio real sem conferir antes:

```sh
npm run official:path
npm run senior:check
npm run official:audit
npm run meta:retro:purchases
```

## Variaveis

```text
META_PIXEL_ID_EC=
META_ACCESS_TOKEN_EC=
META_CAPI_API_VERSION=v20.0
META_RETRO_COUNTRY=EC
META_RETRO_DAYS=62
META_RETRO_LIMIT=500
META_RETRO_STATUSES=confirmed,processing,shipped,delivered
META_RETRO_ACTION_SOURCE=system_generated
META_RETRO_INCLUDE_SENT=false
META_RETRO_SEND=
```

## Event time

O `event_time` usa a data original da venda nesta ordem:

1. `Criado online:` dentro de `notes`, para pedidos importados do dashboard;
2. `purchaseIntent.readyConfirmedAt`;
3. `updatedAt`;
4. `createdAt`.

## Dados enviados

O payload envia `Purchase` com:

- `event_id`: `orderId`;
- `event_time`: horario original da venda;
- `action_source`: `system_generated` por padrao;
- `user_data`: telefone, nome, sobrenome, cidade, provincia e pais com SHA256 quando disponiveis;
- `custom_data`: moeda, valor, pedido, produto, quantidade e preco unitario.

## Observacao operacional

Eventos mais recentes tendem a ter melhor atribuicao. A rotina aceita `META_RETRO_DAYS` como janela operacional, mas limita automaticamente eventos de servidor/CAPI a no maximo 7 dias reais, pois a Meta rejeita `Purchase` de servidor com `event_time` mais antigo. Historico maior deve ser tratado por uma rotina propria de Eventos Offline, se essa fonte estiver habilitada na conta.

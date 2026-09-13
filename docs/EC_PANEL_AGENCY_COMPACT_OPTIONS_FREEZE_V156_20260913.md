# V156 — opções compactas de agência no painel EC

Data operacional: 2026-09-13.

A V156 altera somente o texto enviado manualmente pelo painel ao listar agências Servientrega. Cada opção passa a ocupar uma linha no formato `Opción N: Servientrega Nome - Endereço - Sector Setor - Cidade, Província`. O setor é omitido quando estiver vazio, sem deixar separadores duplicados.

A numeração usa a posição absoluta no resultado da busca. O primeiro lote conserva `1` a `4`; os próximos lotes continuam em `5`, `6`, `7`, `8` e assim sucessivamente. O limite operacional de no máximo quatro agências por clique permanece para evitar rajadas de mensagens. O envio individual usa o mesmo número absoluto exibido na página.

Preservado:

- seleção e aplicação da agência na ficha do cliente;
- catálogo oficial `src/data/agencia_LISTA.json` e seus dados;
- máximo de quatro agências por clique e intervalo entre mensagens;
- envio manual autenticado pelo painel;
- motor automático do funil, memória, preços, produtos, Dropi, Meta/CAPI e Z-API;
- pós-venda, quotas, locks, deduplicação, chronology guard e bloqueio de backlog histórico;
- V155 e sua reconciliação de callback por `providerMessageId`.

Validação mínima:

```sh
node scripts/guard-panel-agency-compact-options-v156.mjs
node --test tests/panel-agency-compact-options-v156.test.mjs tests/customer-form-intelligence.test.cjs tests/panel-customer-selection-isolation-v51.test.mjs
```

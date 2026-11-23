# PLUSMEN TEX V257 — auditoria após publicação (23/11/2026)

## Estado publicado

- A V257 foi publicada em 23/11/2026 às 17:57:50 UTC no único asset `/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js`.
- O guard `node scripts/guard-plusmen-tex-reference-v257.mjs --expect-after` passou: hash do asset e cinco arquivos preservados coincidem com o manifesto.
- A URL pública do asset respondeu HTTP 200, `Cache-Control: no-store` e `CF-Cache-Status: BYPASS`.
- O dispositivo Z-API atual retorna `553171862958`; o backend registra o proprietário canônico `5531971862958`. A equivalência histórica está documentada no recibo V152. Não foi feita troca de número.

## Evidência real observada

- Na origem, após a publicação, o diário de referências V243 não tinha nova referência emitida. O access log mostrou consultas de estado de referências antigas; essas consultas não comprovam nova visita identificada ou CTA clicada.
- No backend oficial, entre a publicação e a leitura desta auditoria, havia uma mensagem inbound equatoriana persistida; ela não mencionava Tex nem continha `TX243`.
- Portanto, o vínculo `visita Plusmen → mensagem enviada pelo cliente → inbound Z-API → Lead → compra` permanece **NOT_PROVEN** para a V257. Não foi criado evento artificial nem reenviada compra histórica.

## Testes executados

- `node ops/publications/tex-reference-v257/tests.mjs`: PASS, simulação sem rede do clique, mensagem, fallback e deduplicação.
- Testes isolados da origem `tests/tex-measurement-v243.test.js`: 8 passaram, 0 falharam; usam diretório temporário e transporte Meta simulado.
- Testes isolados do backend `tests/tex-measurement-v243.test.mjs`: 10 passaram, 0 falharam na execução conjunta.
- `tests/tex-measurement-purchase-routing-v243.test.mjs`: 3 falharam com `ReferenceError: integrationPolicyV254 is not defined` no contexto `vm` do próprio teste. Essa falha precisa ser corrigida e reexecutada antes de usar a bateria como gate de uma próxima alteração de backend; não é recibo de falha de compra em produção.

## Próximo critério de conclusão

Após uma nova mensagem Tex real contendo `TX243`, conferir o ID inbound persistido, `ContactState.metadata.texMeasurementV243`, recibo `Lead` no dataset `1100892582698669` e, se houver pedido novo confirmado, o recibo `Purchase` sem repetição. Sem esse evento, não declarar atribuição individual ou venda Meta comprovada. A V257 já está publicada; nenhuma nova alteração de produção decorre desta auditoria.

# Congelamento V131 — busca de clientes e reconciliação pós-venda EC

Estado aprovado para produção em 2026-09-05.

- A busca do painel atravessa as filas operacionais quando existe consulta explícita, mantendo os filtros de país, grupo e identidade.
- Clientes encontrados no histórico de pedidos e remessas exibem os avisos persistidos de guia, retirada e devolução.
- Pedidos EC enviados ao Dropi nos últimos sete dias, ainda pendentes localmente e com identificador persistido, entram na reconciliação antes da decisão de aviso.
- O executor pós-venda continua isolado, com lote máximo um, cota diária um, lock persistente, histórico obrigatório, idempotência e sem repetição automática.
- O modo global automático de aplicação Dropi permanece desligado.
- Meta/CAPI, pixel, produto, preço, checkout, funil e transporte WhatsApp permanecem inalterados.

Rollback: retornar ao commit pai `ef3b0b2ca24b2c176057ea8ff58576c16d944240` e restaurar o release anterior pelo mecanismo oficial.

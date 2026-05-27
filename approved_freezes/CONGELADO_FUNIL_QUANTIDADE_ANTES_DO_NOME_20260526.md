# Congelado - Quantidade antes do nome nao avanca

Data: 2026-05-26

Problema observado:

- Cliente perguntou preco/quantidade antes de informar nome.
- O atalho antigo `selectedQuantityFromPrice` confirmou 3 frascos e avancou para entrega sem pedir nome.
- O pedido chegou a fechar com `Nome:` vazio.

Correcoes publicadas:

- O atalho de quantidade/preco agora exige nome confiavel antes de confirmar valor e avancar.
- Se detectar quantidade antes do nome, o sistema guarda quantidade e valor, mas responde:
  - confirma a quantidade/preco de forma curta
  - pede nome completo
  - mantem etapa `sdr_awaiting_name`
- Na etapa `sdr_awaiting_name`, se o cliente repetir quantidade, o bot nao avanca; guarda a quantidade e pede nome.
- Numero piloto `5515998038637` foi limpo apos o teste contaminado.

Arquivo alterado:

- `src/services/conversationEngine.js`

Verificacao:

- `node --check src/services/conversationEngine.js`
- PM2 `vitalismen-automation` reiniciado.
- `/api/zapi/status` retornou conectado.

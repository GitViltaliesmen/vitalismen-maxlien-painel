# Congelado - Funil nome primeiro

Data: 2026-05-26

Regra aprovada:

- Quando o cliente entra no funil, o bot deve tratar identidade antes de qualquer outra etapa.
- Se houver nome confiavel em memoria ou na mensagem inicial, o bot confirma o nome.
- Se nao houver nome confiavel, o bot pergunta nome completo antes de quantidade, valor, agencia ou endereco.
- Se o cliente enviar quantidade antes do nome, o funil nao avanca sem nome; ele pede/valida nome primeiro.

Implementacao:

- Novo estado: `sdr_awaiting_name_confirmation`.
- Nova mensagem: confirmar nome registrado antes de seguir.
- Entrada livre do Vitalismen EC agora direciona para:
  - `sdr_awaiting_name_confirmation`, se existir nome confiavel.
  - `sdr_awaiting_name`, se nao existir nome confiavel.
- A etapa `sdr_after_initial` nao inicia mais por quantidade; ela prioriza nome.
- Apos confirmar/corrigir nome, o funil continua para quantidade ou confirma valor se a quantidade ja estava guardada.

Arquivo alterado:

- `src/services/conversationEngine.js`

Verificacao:

- `node --check src/services/conversationEngine.js`
- `GET /api/zapi/status` retornou conectado.
- Numero piloto `5515998038637` liberado para teste novo.

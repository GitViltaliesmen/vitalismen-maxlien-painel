# Congelado - Responde pergunta antes do nome e retorna ao nome

Data: 2026-05-26

Regra aprovada:

- Nome continua sendo a primeira etapa obrigatoria do pedido.
- Se o cliente perguntar algo antes de informar nome, o bot responde curto e volta para o nome completo.
- A resposta nao deve abrir funil paralelo nem avancar para quantidade sem nome.

Perguntas cobertas antes do nome:

- Preco/promocao/frascos.
- Envio/agencia/domicilio/Servientrega.
- Funciona/prova/confiança/resultado.
- Como tomar/dose.
- Ingredientes/composicao.
- Interesse de compra/reserva.

Arquivo alterado:

- `src/services/conversationEngine.js`

Verificacao:

- `node --check src/services/conversationEngine.js`
- PM2 `vitalismen-automation` reiniciado.
- `/api/zapi/status` retornou conectado.
- Numero piloto `5515998038637` liberado para novo teste.

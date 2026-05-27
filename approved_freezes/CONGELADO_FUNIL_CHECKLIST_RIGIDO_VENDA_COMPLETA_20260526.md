# Congelado - Checklist rigido da venda completa

Data: 2026-05-26

Regra aprovada:

- O bot pode conversar e responder fora da ordem.
- As etapas obrigatorias da venda precisam ser cumpridas a risca antes de resumo e fechamento.
- A ordem da conversa pode mudar, mas a checklist do pedido nao pode ficar incompleta.

Checklist obrigatoria antes do resumo/fechamento:

1. Nome completo confiavel do cliente.
2. Quantidade.
3. Confirmacao do valor/promocao.
4. Cidade.
5. Provincia/departamento.
6. Modalidade de entrega.
7. Dados logisticos:
   - Agencia: agencia Servientrega oficial/validada.
   - Domicilio: endereco completo de entrega.
8. Referencia de entrega/retirada quando aplicavel.
9. Resumo final com todos os dados.
10. Autorizacao/confirmacao do despacho.
11. Agradecimento.
12. Audio/aviso de bonus-retirada quando aplicavel.

Correcoes publicadas:

- Cidade/provincia agora sao obrigatorias tambem para domicilio, nao apenas para agencia.
- Endereco completo enviado pelo cliente tenta extrair cidade/provincia antes do resumo.
- A barreira `principalSdrNextRequiredSalesStep` impede resumo/fechamento com dados incompletos.
- `principalSdrConfirmOrder` continua protegido contra caminhos antigos de fechamento direto.
- Numero piloto `5515998038637` liberado para novo teste.

Arquivo alterado:

- `src/services/conversationEngine.js`

Verificacao:

- `node --check src/services/conversationEngine.js`
- PM2 `vitalismen-automation` reiniciado.
- `/api/zapi/status` retornou conectado.

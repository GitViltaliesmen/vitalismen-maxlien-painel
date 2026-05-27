# Congelado - Barreira de fases da venda

Data: 2026-05-26

Regra aprovada:

- O bot pode responder o cliente fora de ordem.
- O pedido nao pode avancar fora de ordem.
- Antes de resumo final e antes de fechamento, o sistema verifica se as etapas obrigatorias estao completas.

Etapas obrigatorias ate fechamento:

1. Nome completo confiavel.
2. Quantidade valida.
3. Confirmacao de valor/promocao.
4. Modalidade de entrega.
5. Dados logisticos:
   - Agencia: cidade/provincia e agencia Servientrega.
   - Domicilio: endereco completo e referencia.
6. Resumo final com dados completos.
7. Confirmacao/autorizacao do despacho.

Correcoes publicadas:

- Nova barreira `principalSdrNextRequiredSalesStep`.
- Nova resolucao de entrega `principalSdrResolveDeliveryType`.
- Resumo de agencia e resumo de domicilio agora chamam a barreira antes de enviar resumo.
- Fechamento final chama a barreira antes de confirmar o pedido.
- `principalSdrConfirmOrder` tambem chama a barreira, protegendo contra caminhos antigos que tentem fechar direto.
- Numero piloto `5515998038637` liberado para novo teste.

Arquivo alterado:

- `src/services/conversationEngine.js`

Verificacao:

- `node --check src/services/conversationEngine.js`
- PM2 `vitalismen-automation` reiniciado.
- `/api/zapi/status` retornou conectado.

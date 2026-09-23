# Freeze da candidata V141 — reconciliação Meta e funil EC

Esta camada parte do commit V140 `13e752adc08cd089181eeebe2ff527dbe97f5fa9` e preserva a VSL externa, o funil comercial, conteúdo do bot, preços, Dropi, Servientrega, pós-venda e os pedidos reais.

O escopo autorizado contém somente:

- leitura e apresentação das fontes Meta/Z-API/bot/pedido/CAPI;
- cálculo event-based no horário `America/Guayaquil`;
- cache Meta com identidade de janela, diagnóstico de falha e refresh independente;
- radar bloqueado quando os dados não permitem decisão;
- criação de Purchase em vendas futuras depois de ação humana Dropi bem-sucedida, com deduplicação existente;
- testes, guard e documentação V141.

É proibido usar esta camada para enviar Purchase retroativo, modificar cliente/pedido/conversa real, alterar anúncio, token, orçamento, Pixel/Dataset ou qualquer arquivo da VSL.

O guard V141 deve validar os hashes desta candidata e herdar V140. A candidata somente pode ser publicada após aprovação explícita do operador e após renovação comprovada da credencial Meta `ads_read` se o gate operacional exigir `META_LIVE_FETCH=PASS`.


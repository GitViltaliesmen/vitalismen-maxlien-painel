# Aprovação EC — telefone oficial e canário de mídia V32

Data: 2026-08-21

## Autorização escrita do operador

O operador autorizou:

- corrigir o telefone oficial ativo para `5515991418416`;
- retirar números brasileiros antigos das configurações e rotas operacionais;
- manter `5515998038637` como único telefone de teste;
- testar, de forma controlada, envio e recebimento de um áudio e uma imagem;
- manter a Z-API conectada durante o período de transição.

## Limites preservados

- Nenhum disparo em massa.
- O telefone QA não cria pedido, não envia ao Dropi e não registra conversão Meta/CAPI.
- Clientes, pedidos, funil, preços, checkout, pixel e produtos não foram alterados.
- Documentos históricos imutáveis permanecem somente como evidência datada.
- A mídia inbound precisa ser nova e enviada pelo telefone QA ao número oficial para comprovar o elo real do provider.

## Regra operacional vigente

- Telefone oficial: `5515991418416`.
- Único telefone QA: `5515998038637`.

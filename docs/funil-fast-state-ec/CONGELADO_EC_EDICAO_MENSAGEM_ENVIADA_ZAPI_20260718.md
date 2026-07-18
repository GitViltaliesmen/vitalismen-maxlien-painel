# Congelado — edição de mensagem enviada no painel EC

Data: 2026-07-18

Escopo aprovado:

- O lápis `✎` aparece em mensagens de texto verdes enviadas manualmente pelo atendente através da Z-API.
- Ao clicar, o compositor entra em modo **Salvar edição** com o texto original selecionado.
- Salvar chama a edição real da Z-API com `editMessageId`; não cria nem reenvia uma nova mensagem.
- O painel mostra **editada** após a confirmação e conserva texto anterior, autor e horário no histórico de auditoria.

Guardas:

- Apenas texto manual, enviado pela Z-API e com ID retornado pelo provedor.
- Janela máxima de 15 minutos, igual à regra do WhatsApp.
- Mensagens de cliente, bot, mídia, mensagens antigas e mensagens sem ID ficam bloqueadas.
- Nenhuma mensagem é alterada durante deploy ou validação; a edição depende de clicar em **Salvar edição**.

Isolamento: mudança exclusiva do painel e Z-API do Equador no Hostinger; VSL, bot, destino, dados e Colômbia preservados.

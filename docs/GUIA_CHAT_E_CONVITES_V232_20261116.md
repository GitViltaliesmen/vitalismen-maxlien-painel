# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

## Como localizar uma conversa

No painel oficial, abra **Chat do site** e use **Buscar cliente no chat do site**. A busca aceita nome já informado, identificação do visitante e cidade já registrada. Não há identificação automática do telefone de um visitante anônimo. As conversas do WhatsApp continuam na lista principal; a busca do popup consulta as conversas do site.

O popup permanece na lateral, sem bloquear o atendimento. A busca não envia mensagens, não altera fichas e não marca pedidos como vendidos.

## Link para o cliente

https://taviazen.shop/vitpower_2026g#consulta-pedido

Esse link abre o chat e o formulário **Estado de mi pedido**. O cliente precisa do código privado fornecido pela equipe após a verificação de identidade já existente. O link não contém credencial e não revela pedidos por nome ou telefone. O código deve ser digitado no formulário específico, nunca no texto da conversa.

## Texto do convite para consultar o pedido

> Hola, [nombre]. Soy Ana Lopez, del equipo Vitalismen Ecuador. 💬
> Ya puedes consultar el estado registrado de tu pedido en nuestro chat, además de resolver tus dudas sobre Vit Power.
> Abre el chat aquí:
> https://taviazen.shop/vitpower_2026g#consulta-pedido
> Elige Estado de mi pedido e introduce tu código privado. Si aún no lo tienes, solicítalo por este WhatsApp para verificar tu identidad. No compartas tu código.

O primeiro nome é usado quando consta no pedido. O convite de consulta é único por pedido ativo Vit Power confirmado, em processamento ou enviado. Uma recompra possui outro ID de pedido.

## Convites para o site parceiro

Foram adicionados somente os textos abaixo ao Vitalismen. Nenhum arquivo, serviço, preço, checkout ou configuração do parceiro é alterado.

**Convite 1**

> 🎁 ¡Tenemos kits en promoción con ofertas especiales! 🔥
> 🌐 Visita nuestro sitio web asociado y descubre sus promociones: https://gira21x.com/
>
> Si no deseas recibir estas invitaciones, responde STOP.

**Convite 2**

> Nace GIRAUP LATAM
> Después de años acompañando preguntas, experiencias y diferentes caminos en salud y bienestar, damos un nuevo paso.
> Con la Dra. Maria Fernandes y otros especialistas invitados, nace un espacio para hablar de estudios, nuevas perspectivas y preguntas que todavía merecen ser investigadas.
> Si alguna vez te preguntaste por qué algo funciona para algunas personas y no de la misma manera para otras, este espacio es para ti.
> 🎥 Mira nuestro primer video en YouTube:
> https://youtu.be/xguISlUDFVM
> 🌐 Conoce GIRAUP LATAM:
> https://gira21x.com
>
> Si no deseas recibir estas invitaciones, responde STOP.

## Regras da fila

- Uma tentativa de convite a cada 10 minutos no conjunto da fila, entre 08h e 19h no Equador.
- Os avisos operacionais anteriores têm prioridade. Uma execução que enviou aviso operacional não envia convite.
- Convite 1 após retirada/entrega comprovada ou pelo menos 12 horas sem atividade de entrada ou saída.
- Convite 2 somente após confirmação de envio do primeiro, intervalo mínimo de 12 horas e nova verificação de ausência de atividade por 12 horas.
- Cada convite de parceiro é único por telefone, independentemente da quantidade de pedidos.
- Exclusão de contatos sem entrada oficial comprovada, números brasileiros, QA 8637, atendimento humano, pausa, bloqueios existentes, cancelamentos, devoluções e solicitação de saída.
- STOP histórico é considerado e a supressão é persistida. Retomar uma conversa não remove automaticamente essa supressão.
- Reserva, lock e tentativa são gravados antes do transporte. Resultado incerto fica bloqueado para repetição automática.
- A fila verifica até 1.200 contatos EC por execução; a auditoria examinou 1.060 registros válidos de contato EC. O painel apresentava 1.051 clientes EC no baseline. O limite deve ser revisto antes de ultrapassar essa capacidade.
- O histórico do chat do site continua limitado a 7 dias e 40 mensagens por conversa. Visitantes sem nome continuam anônimos.

## Operação e rollback

O estado efetivamente publicado e habilitado deve ser consultado em `RELATORIO_CHAT_CONVITES_V232_20261116.md`, acompanhado dos recibos de publicação e ativação.

Na primeira execução real não havia destinatários elegíveis. Os 9 contatos com entrada comprovada na sessão oficial atual estavam em atendimento humano e pausa. Outros registros com mensagens históricas de Z-API não foram associados automaticamente à sessão atual. A rotina aguarda elegibilidade e não modifica esses controles para produzir um envio. O primeiro recibo real de convite continua pendente; o transporte e os intervalos foram comprovados em ambiente isolado.

Para suspender exclusivamente os convites, o controlador root desta entrega oferece a ação `disable-invites`, sem reiniciar PM2 ou apagar a memória de envio. A retomada deve preservar o ledger e a cadência.

O rollback de código retorna ao release V231-R2, remove somente o drop-in desta entrega e mantém o ledger de convites. Não restaurar um backup antigo do ledger sobre dados vivos: isso pode apagar a memória antirrepetição. Nenhum rollback deve recriar pedidos, reenviar mensagens ou eventos Meta.

O backup global MongoDB permanece FAIL por falta de consistência comprovada do banco standalone. A recuperação de código/configuração e a cópia consistente restrita ao novo ledger são resultados separados; não representam backup completo dos bancos comerciais.

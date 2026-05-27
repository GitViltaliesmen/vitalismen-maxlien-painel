# Congelado - Pos-fechamento curto sem reabrir funil

Data: 2026-05-26

Status: CONGELADO APROVADO EM TESTE REAL.

Regra aprovada:
- Depois que o pedido esta fechado, o bot nao deve reiniciar a venda.
- Nao deve mandar tabela de preco.
- Nao deve oferecer frascos novamente.
- Nao deve criar novo pedido.
- Para agradecimento curto, pode responder curto ou ficar silencioso.
- Para conversa solta curta, manter o estado `order_closed`.

Teste real aprovado:
- Canal: Z-API producao.
- Telefone piloto: 553183002800.
- Estado anterior: pedido fechado em `order_closed`.
- Entrada do cliente: "Gracias".
- Resposta validada do bot: "Gracias 😊".
- Entrada seguinte do cliente: "👍".
- Resultado validado: sem tabela de preco, sem reinicio de funil e sem nova oferta.

Comportamento esperado daqui para frente:
- `Gracias`, `ok`, `perfecto`, `correcto`, emoji ou agradecimento curto nao reabrem o funil.
- Se o cliente perguntar por guia, retirada ou pedido, responder somente sobre acompanhamento/logistica.
- Nova venda so pode iniciar por regra propria de recompra, fora desta camada.

Trava de preservacao:
- NAO mexer nesta camada sem criar camada corretiva separada.
- NAO alterar a base mae 1, 3 e 6 por causa desta regra.
- NAO transformar agradecimento pos-fechamento em nova oferta.

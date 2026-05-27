# Congelado - Camada especial de 2 frascos sob pedido

Data: 2026-05-26

Status: CONGELADO APROVADO EM TESTE REAL.

Regra mae:
- As promocoes divulgadas ao cliente continuam sendo 1, 3 e 6 frascos.
- O bot nao deve oferecer 2 frascos na lista inicial.

Camada especial:
- Se o cliente pedir 2 frascos espontaneamente, o bot aceita.
- Preco: 2 frascos por 70 USD.
- A regra de fluxo e a mesma dos demais pacotes:
  - fala o preco;
  - pede confirmacao;
  - depois segue nome, cidade, provincia, entrega, resumo e autorizacao.

Objetivo:
- Nao confundir a oferta principal.
- Nao perder venda quando o cliente pede 2 frascos por conta propria.

Teste real aprovado:
- Canal: Z-API producao.
- Telefone piloto: 553183002800.
- Entrada do cliente: "quiero 2 frascos".
- Resposta validada do bot: "Muy buena elección 👍 2 frascos le queda en $70. ¿Está correcto?"
- Confirmacao seguinte: "si".
- Continuidade validada: bot perguntou envio por agencia Servientrega e seguiu o fluxo oficial.
- Logs confirmaram: quantidade=2 e valor confirmado antes de pedir dados.

Trava de preservacao:
- NAO mexer nesta camada.
- NAO incluir 2 frascos na oferta principal.
- NAO alterar a base mae 1, 3 e 6 por causa desta excecao.
- Se algum ajuste futuro for indispensavel, criar nova camada corretiva por cima, preservando este congelado.

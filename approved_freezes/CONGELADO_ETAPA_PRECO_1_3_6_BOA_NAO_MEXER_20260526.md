# Congelado - Etapa preco 1, 3 e 6

Data: 2026-05-26

Status: APROVADO. Nao mexer mais nesta etapa sem pedido explicito.

Regra congelada:
- Depois da entrada/apresentacao, o bot deve apresentar a tabela principal com:
  - 1 botella/frasco por 39 USD;
  - 3 botellas/frascos por 95.99 USD;
  - 6 botellas/frascos por 167.99 USD.
- Deve informar pagamento contra entrega.
- Deve perguntar qual promocao o cliente deseja reservar.
- A tabela principal nao deve exibir 2 frascos.

Camada separada:
- 2 frascos continua existindo somente como opcao interna sob pedido do cliente.
- Se o cliente pedir 2 frascos espontaneamente, a camada especial responde 2 frascos por 70 USD e segue o funil.

Regra de protecao:
- Qualquer ajuste futuro em quantidade, nome, agencia, domicilio ou fechamento nao pode alterar esta etapa de preco principal.

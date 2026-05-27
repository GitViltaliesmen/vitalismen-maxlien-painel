# Congelado - Camada quantidade confirma valor

Data: 2026-05-26

Regra:
- Depois da tabela/audio de preco, quando o cliente escolhe quantidade, o bot deve confirmar quantidade e valor.
- O bot nao deve pedir nome antes dessa confirmacao.
- O bot deve esperar confirmacao do cliente para continuar.

Exemplo:
```
Cliente: 1 frasco
Bot: Perfecto, señor. Le envio 1 frasco por 39 USD. ¿Esta bien?
```

Follow-up:
- Se o cliente nao responder em aproximadamente 10 minutos, enviar uma lembranca curta e variada da mesma pergunta.
- Se continuar sem resposta, depois de aproximadamente 24 horas perguntar uma unica vez se ainda ha interesse.
- Depois disso, nao insistir mais ate o cliente escrever novamente.

Escopo:
- Esta camada corrige apenas escolha de quantidade e confirmacao de valor.
- Nome, cidade, agencia, domicilio e fechamento ficam para camadas seguintes.

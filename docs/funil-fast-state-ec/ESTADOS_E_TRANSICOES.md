# Estados e Transicoes

## Principio

O funil novo funciona por estado, mas nao engessa a conversa. A IA escuta texto/audio, identifica intencao e atualiza memoria. O codigo valida o estado antes de enviar qualquer resposta.

## Estados principais

```text
novo_contato
quantidade_detectada
valor_confirmado
cidade_pedida
cidade_detectada
escolher_modo_entrega
aguardando_agencia
agencia_escolhida
coletando_endereco_domicilio
endereco_confirmado
nome_pedido
pedido_confirmado
dropi_enviado
guia_gerada
retirado
entregue
comprar_depois
humano_assumiu
```

## Caminho rapido por agencia

```text
Cliente: Quero 3 frascos Vit Power.
Ana: Claro. Le envio 3 frascos por 95.99. Esta de acuerdo?

Cliente: Si.
Ana: Perfecto. En que ciudad esta?

Cliente: Cuenca.
Sistema: grava city=Cuenca, province=Azuay.
Ana: Puedo enviar su pedido para retirar en una agencia Servientrega?

Cliente: Claro que si.
Ana: Por favor, elija una agencia:

1) Servientrega Cuenca Centro
Av. ...

2) Servientrega Feria Libre
Av. ...

3) Servientrega El Vergel
Calle ...

Cliente: 2
Ana: Muy bien. Cual es su nombre completo?

Cliente: Pedro Souza.
Ana: Gracias, Pedro. Su pedido queda listo para envio por Servientrega.
```

Depois podem entrar audios:

- `Agradecimento_Agencia_01`
- `BONUS_RETIRADA`
- futuro `FAST_BONUS_RETIRADA_FOTO_01`

## Caminho por domicilio

Agencia e o caminho principal. Domicilio entra quando o cliente pede ou rejeita agencia.

```text
cidade_detectada
-> escolher_modo_entrega
-> coletando_endereco_domicilio
-> endereco_confirmado
-> nome_pedido
-> pedido_confirmado
```

Resposta curta:

```text
Perfecto. Envieme su direccion completa con referencia, color de casa o local cercano.
```

Depois de formatar:

```text
Lo tengo asi:

Av. Remigio Crespo, atras del Tia, casa verde segundo piso, Cuenca, Azuay.

Esta correcto?
```

## Memoria por estado

Exemplo:

```json
{
  "active": true,
  "stage": "aguardando_agencia",
  "intent": "fechamento_quantidade",
  "lastQuestion": "escolher_agencia",
  "slots": {
    "quantity": 3,
    "total": 95.99,
    "city": "Cuenca",
    "province": "Azuay",
    "deliveryMode": "agency",
    "agency": "",
    "name": "",
    "addressRaw": "",
    "addressFormatted": ""
  },
  "missingSlots": ["agency", "name"],
  "answeredQuestions": ["preco", "quantidade", "cidade"],
  "sentAudios": [],
  "sentImages": [],
  "sentTexts": [],
  "trustLevel": "medio",
  "humanTone": "direto"
}
```

## Travas

O funil novo nao entra se:

- humano assumiu;
- cliente esta em pos-venda;
- pedido ja foi enviado para Dropi;
- guia ja existe;
- conversa e de retirada/entrega;
- existe risco de duplicidade;
- modo estiver `off` ou fora da lista piloto.

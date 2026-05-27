# Congelado - Funil ate nome, domicilio e 2 frascos

Data: 2026-05-26

## Camadas aprovadas em teste real

- Entrada inicial do funil Vit Power Equador.
- Apresentacao inicial com midias/preco.
- Camada oculta de 2 frascos quando o cliente pede espontaneamente.
- Confirmacao de 2 frascos por $70.
- Confirmacoes curtas com ruido, como `Ai, correcto`, nao reiniciam funil.
- Pergunta agencia/domicilio apos confirmacao.
- Quando cliente escolhe domicilio, enviar um audio de orientacao e depois texto de apoio.
- Enviar apenas um audio de domicilio por vez, alternando candidatos aprovados quando aplicavel.
- Coleta chegou corretamente ate pedido de nome.

## Nao mexer

- Nao alterar ordem inicial do funil.
- Nao alterar oferta oficial 1, 3 e 6.
- Nao apresentar 2 frascos de forma ativa.
- Nao mexer na etapa de 2 frascos ja aprovada, exceto se um novo teste real reprovar essa propria camada.
- Nao remover audio + texto apos escolha de domicilio.

## Proxima camada em trabalho

- A partir da leitura de cidade/provincia em mensagens de domicilio.
- Corrigir casos como `Vivo en Guayquil, Gauayas, Calle...`, priorizando `Guayaquil / Guayas` e nao palavras da rua, bairro ou referencia.
- Estender aliases de escrita de cidade/provincia: `quayaquil`, `guayquil`, `guaykil`, `gauayas`, entre outras variacoes comuns.

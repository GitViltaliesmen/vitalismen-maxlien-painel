# Funil evoluido Vit Power EC

Status: frente local de teste, nao publicada no VPS.

Objetivo: consolidar a proxima versao do funil em uma unica frente local. O VPS so recebe essa versao depois de `npm run official:audit`, teste piloto e comando explicito de deploy.

## Blocos congelados em 2026-05-08

Estas duas entradas estao aprovadas ate os audios `Agradecimento_Agencia_01` + `BONUS_RETIRADA`. Nao alterar ordem, textos principais, midias, precos ou decisoes de roteamento sem pedido explicito.

### Etapa A: cliente entra sem dados completos

Status: congelado. Esta estrutura foi aprovada e nao deve ser alterada enquanto trabalhamos na proxima estrutura de cliente que ja informa dados no inicio.

1. Cliente envia `Hola`, interesse simples ou mensagem curta sem dados do pedido.
2. Bot envia a sequencia congelada:
   - `Inicio_01`;
   - `Inicio_02`;
   - `Prova_01`;
   - `Prova_02`;
   - imagem oficial do frasco Vit Power.
3. Bot apresenta valores oficiais:
   - 1 frasco: 39.99 USD;
   - 3 frascos: 95.99 USD;
   - 6 frascos: 167.99 USD.
4. Bot pergunta a quantidade: `Cuantos frascos desea llevar: 1, 3 o 6?`
5. Se o cliente responder `1`, `3` ou `6`, bot confirma a quantidade e valor:
   - `¡Excelente decisión! Le envío 1 frasco por 39.99 USD. ¿Listo?`
   - `¡Excelente decisión! Le envío 3 frascos por 95.99 USD. ¿Listo?`
   - `¡Excelente decisión! Le envío 6 frascos por 167.99 USD. ¿Listo?`
6. Se o cliente confirmar com `SI`, `LISTO`, `OK`, `CORRECTO` ou equivalente, bot envia `PERGUNTA_AGENCIA_DOMICILIO` para saber se o envio sera para agencia Servientrega ou domicilio.
7. Se o cliente responder agencia sem indicar dados, bot envia `ENDERECO_CIDADE_PROVINCIA_AGENCIA`.
8. Quando o cliente enviar cidade/provincia/direcao/agencia, bot confirma os dados recebidos e pede somente o nome completo do cliente.
9. Quando o cliente enviar o nome completo, bot resume nome, cidade, provincia e direcao/agencia e pergunta se esta de acordo ou quer alterar algo.
10. Se o cliente confirmar os dados, bot envia texto humano curto de fechamento, pede para guardar o numero como `Ana - Vit Power`, depois `Agradecimento_Agencia_01` e `BONUS_RETIRADA`.

Formato congelado da confirmacao limpa:

```text
✅ ¡Perfecto! Su pedido ha sido registrado con éxito.

👤 Cliente: [Nome]
📍 Destino: [Cidade], [Província]
🏢 Punto de Retiro: Agencia Servientrega [Nome da Agência]
🏠 Dirección: [Endereço limpo]

¿Los datos son correctos para proceder con el envío hoy mismo?
```

Regra congelada de limpeza: remover redundancias como `Por favor envíeme a`, `Agencia de Servientrega`, saudacoes, repeticoes e textos desnecessarios antes de confirmar os dados.

### Etapa B: cliente entra com dados desde o inicio

Status: congelado. Esta estrutura foi aprovada para clientes que ja chegam com dados do pedido na primeira mensagem.

1. Cliente envia dados do pedido desde a primeira mensagem, com campos como nome, endereco, referencia, cidade/provincia e quantidade.
2. Bot envia primeiro a mesma sequencia congelada:
   - `Inicio_01`;
   - `Inicio_02`;
   - `Prova_01`;
   - `Prova_02`;
   - imagem oficial do frasco Vit Power.
3. Se os dados estiverem completos, bot nao envia tabela de precos e nao pede para responder quantidade.
4. Bot envia resumo de conferencia limpo com nome, destino, ponto de retiro/endereco, quantidade pedida e total oficial daquela quantidade.
5. Bot pergunta se esta tudo correto e pede confirmacao com `SI`.
6. Se o cliente confirmar com `SI`, `LISTO`, `OK`, `CORRECTO` ou equivalente, bot envia `Agradecimento_Agencia_01` e depois `BONUS_RETIRADA`.
7. Se faltar algum dado, bot pede apenas o dado faltante e mantem a etapa B, sem reiniciar o funil.

Formato de confirmacao da Etapa B:

```text
✅ ¡Perfecto! Ya recibí sus datos para el pedido.

👤 Cliente: [Nome]
📍 Destino: [Cidade], [Província]
🏢 Punto de Retiro: Agencia Servientrega [Nome da Agência, quando houver]
🏠 Dirección: [Endereço limpo]
📦 Pedido: [Quantidade] frasco(s) de VIT POWER
💰 Total a pagar al recibir: [Valor oficial da quantidade]

¿Los datos son correctos para proceder con el envío hoy mismo?
```

Resumo funcional: esta estrutura evita repetir tabela de valores quando o cliente ja escolheu quantidade. O sistema usa a quantidade recebida para calcular o valor correto, confirma os dados e pede apenas a aprovacao final.

## Persona

- Nome comercial: Ana Lopez.
- Papel: assessora comercial da equipe da doctora Maria Fernandes para Vit Power no Equador.
- Tom: persuasivo, direto, humano, seguro e com prova social.
- Limite: nao prometer cura, nao garantir resultado e orientar cliente com condicao medica a consultar profissional de confianca.

## Workflow

### 1. Recepcao e filtro inteligente

- Primeiro contato: `Inicio_01` + `Inicio_02` + prova social + imagem oficial `Vit Power`.
- Se o cliente ja enviou dados, o bot valida o que recebeu e solicita somente o que falta.
- Dados obrigatorios:
  - nome completo;
  - endereco exato;
  - ponto de referencia;
  - cidade;
  - provincia;
  - quantidade.
- Audio esperado quando faltar dados: `NOME_CIUDAD_PROVICINCIA`.

### 2. Persuasao e valor

- Quando falar de qualidade, reforcar que Vit Power liquido tem absorcao mais rapida que capsulas.
- Audio esperado: `PRODUDO_LIQUIDO_X_CAPSULA_MELHOR`.
- Precos oficiais:
  - 1 frasco: 39.99 USD;
  - 3 frascos: 95.99 USD;
  - 6 frascos: 167.99 USD.
- Audio esperado de preco: `TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6`.
- Regra critica: se formulario vier com `Cantidad: 3` ou `Cantidad: 6`, respeitar essa quantidade e valor. Nunca forcar 1 frasco.

### 3. Logistica e fechamento

- Ao fechar depois do cliente confirmar `SI, ESTA CORRECTO`, enviar audio de agradecimento e audio de bonus aprovado.
- Audio de agradecimento congelado: `Agradecimento_Agencia_01`.
- Audio de bonus aprovado: `BONUS_RETIRADA`.
- O funil congelado para aqui. Fluxos de guia, retirada e pos-retirada ficam fora desta etapa.

### 4. Bonus pos-retirada

Quando o cliente enviar foto/comprovante de retirada, enviar:

```text
🔥 Un regalo solo para ti... Un bonus para calentar la noche y preparar la llegada de momentos mas ardientes. Contenido exclusivo solo para adultos... Normalmente cuesta $40 al mes, pero para ti te lo envio GRATIS: https://zapgersonecvo.cloud
```

Depois enviar o audio `COMO_SE_TOMA_VIT_POWER`, se aprovado.

## Gatilhos

| Gatilho | Midia/audio esperado |
| --- | --- |
| Primeiro "Hola" | `Inicio_01` + `Inicio_02` + `social_01` + `vit_power_bottle` |
| Cliente ligou | `CLIENTES_QUE_LIGAM` |
| Duvida sobre prostata | `PROSTADA_FUNCIONA_E_QUANDO_CHEGA` ou `Ajuda_Prostata` |
| Resistência a agencia | `ENTREGAS_A_SERVIENTREGAS_MELHOR_OPCAO` |
| Quanto tempo demora | `TEMPO_DEMORA_PRODUTO_CHEGAR` |
| Perguntar agencia ou domicilio | `PERGUNTA_AGENCIA_DOMICILIO` |
| Agencia sem dados | `ENDERECO_CIDADE_PROVINCIA_AGENCIA` |
| Medo de golpe | video `prova_social_video_boquet` + `ENVIO_AGENCIA_100_SEGURO` |
| Nao pode retirar | `QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO` |
| Como tomar | `COMO_SE_TOMA_VIT_POWER` ou `TEMPO_RESULTADO_VIT_POWER` |
| Guia/rastreio | `CONFIRMACION_Y_REGALITO_ESPECIAL` |
| Pedido na agencia | `Chegou_01` + `CONFIRMACION_Y_REGALITO_ESPECIAL`, depois `Chegou_02`, depois `Chegou_03` |

Memoria anti-spam do envio:
- cada etapa grava data propria (`guiaNotifiedAt`, `readyForPickupNotifiedAt`, lembretes e bonus).
- cada mensagem grava hash em `automation.sentMessageHashes`.
- textos de guia e chegada na agencia variam por cliente com emojis, mas a escolha e estavel por pedido/guia para evitar duplicidade.
- cada audio grava tentativa em `automation.sentAudioLog`, incluindo nome do arquivo e resultado.
- audios em sequencia usam pausa aleatoria curta entre envios para reduzir rajada artificial.
- depois de enviar audio, a fila espera a duracao real aproximada do audio mais uma variacao humana curta antes do proximo envio.
- quando varios clientes entram ao mesmo tempo, existe fila por cliente e uma fila global com intervalo curto aleatorio para distribuir os atendimentos.
- cliente com retirada/entrega confirmada fica liberado para novo pedido contra entrega.
- cliente com devolucao/nao retirada fica marcado como `prepaidOnly` e novo pedido exige pagamento antecipado.

## Escassez e movimento

Se o cliente nao fechar apos preco/interesse, revezar prova social de envio/retirada quando existir contexto real:

```text
Mire, acabamos de enviar mas pedidos para su zona esta manana. Quiere que coloque el suyo en el proximo lote?
```

Usar apenas quando houver envio/operacao real, sem inventar cidade ou lote.

## Inventario atual

O inventario de audios esperados fica em `src/services/vitPowerEvolvedWorkflow.js`.

`npm run official:audit` mostra quais grupos de audio ainda estao faltando. Audios faltantes nao bloqueiam desenvolvimento local, mas bloqueiam deploy operacional se a etapa depender deles.

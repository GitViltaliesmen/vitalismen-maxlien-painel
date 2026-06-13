# Camada - Perguntas sobre ingredientes Vit Power

Data: 2026-05-25

Status: aplicada como complemento lateral.

## Objetivo

Responder de forma curta quando o cliente perguntar quais ingredientes contem no Vit Power, sem reiniciar funil, sem alterar preco, quantidade, agencia, fechamento ou Dropi.

## Perguntas provaveis do cliente

Homem acima de 40 anos, publico hispano atendido no funil Equador, pode perguntar:

- `Que contiene el producto?`
- `Que ingredientes tiene?`
- `Cuales son los ingredientes?`
- `Que trae el frasco?`
- `Que tiene Vit Power?`
- `Cual es la composicion?`
- `Es natural?`
- `Tiene quimicos?`
- `Tiene borojó?`
- `Tiene chontaduro?`
- `Tiene noni?`
- `Tiene maca?`
- `Tiene L-arginina?`
- `Tiene guaraná?`
- `Tiene vitaminas?`
- `Eso tiene cafeina?`
- `Para que sirve cada ingrediente?`
- `Lo puedo tomar si tengo presion alta?`
- `Lo puedo tomar si soy diabetico?`
- `Puedo tomarlo si tomo medicamentos?`

## Resposta curta aplicada

`Claro, señor. Vit Power tiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas.`

`Es una formula natural de apoyo para hombres. Si usted tiene presion alta, diabetes, problema del corazon o usa medicamentos, confirme primero con su medico antes de usar cualquier suplemento.`

`¿Le paso las opciones?`

## Regra de seguranca

Se a mensagem falar de pressao alta, diabetes, coracao, remedio, cirurgia, rim, figado, alergia ou contraindicacao, a camada de seguranca medica tem prioridade antes da camada de ingredientes.

Nessa camada medica, o bot envia primeiro um texto curto de cuidado e depois o audio aprovado:

- `100_NATURAL_SEM_CONTRA_INDICACAO`

O audio nao deve sair sozinho quando o cliente citou condicao sensivel. O texto seguro vem antes para evitar promessa absoluta.

## Arquivo alterado

- `src/services/vitPowerAudioComplementService.js`

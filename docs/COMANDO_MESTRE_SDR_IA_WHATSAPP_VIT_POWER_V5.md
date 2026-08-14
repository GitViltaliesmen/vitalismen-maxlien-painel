# Comando-Mestre SDR IA WhatsApp Vit Power V5

Status: regra oficial de trabalho para evoluir o `FUNIL_VIT_POWER_2026`.

Este documento transforma o comando do operador em uma governanca pratica para o projeto Vitalismen/Vit Power Ecuador. Ele nao autoriza reescrever o motor atual, recriar funil aprovado ou misturar arquiteturas novas sem aprovacao expressa.

## Fonte De Verdade

O funil oficial continua sendo:

- `docs/FUNIL_VIT_POWER_2026.md`
- congelamento VPS: `/opt/vitalismen-automacao/freezes/FUNIL_VIT_POWER_2026`
- motor atual: Principal SDR em `src/services/conversationEngine.js`

Sempre que houver conflito, prevalece o funil aprovado e congelado. O V5 orienta como melhorar sem contaminar.

## Principio Central

Nao inventar.
Nao recriar.
Nao confundir.
Nao contaminar.
Nao reescrever o que ja esta aprovado.

Toda melhoria deve ser incremental, pequena, testavel e reversivel.

## Modo Operacional Obrigatorio

Antes de alterar qualquer comportamento do funil:

1. Mapear arquivos afetados.
2. Explicar o que sera alterado, por que sera alterado e impacto esperado.
3. Criar backup automatico.
4. Dividir em etapas pequenas.
5. Validar antes de subir.
6. Atualizar o congelamento aprovado quando o operador aprovar.
7. Zerar o telefone de teste `5515998038637` depois de cada conversa de ajustes.

Nunca:

- alterar multiplas areas ao mesmo tempo;
- reescrever a engine inteira;
- mudar estrutura sem necessidade;
- apagar regras aprovadas;
- substituir fluxos estaveis;
- remover travas anti-loop;
- criar logica paralela duplicada.

## Personagem Fixa

Ana Lopez:

- 32 anos;
- casada;
- 3 filhos;
- equipe da doutora Maria Fernandes.

Personalidade:

- humana;
- acolhedora;
- feminina;
- calma;
- discreta;
- organizada;
- segura.

Ana nunca deve falar como IA, bot, sistema ou automacao.

## Cadencia De Atendimento

Regra de UX:

1. texto curto;
2. um audio ou uma midia quando a etapa pedir;
3. uma pergunta simples.

O bot nunca deve:

- parecer formulario;
- enviar blocos gigantes;
- mandar varios audios em sequencia sem necessidade;
- perguntar algo ja salvo;
- repetir audio ao mesmo cliente;
- pular etapa obrigatoria.

Se o cliente perguntar algo fora da etapa, responder a duvida e voltar exatamente para a etapa onde estava.

## Etapas Conceituais V5

As etapas conceituais do funil sao:

1. `01_ENTRADA`
2. `02_QUALIFICACAO`
3. `03_PROVA`
4. `04_OBJECOES`
5. `05_OFERTA`
6. `06_COLETA_DADOS`
7. `07_LOGISTICA`
8. `08_RESUMO`
9. `09_CONFIRMADO`
10. `10_POSVENDA`

Essas etapas sao o mapa de organizacao. A migracao tecnica para nomes novos so pode acontecer em etapa separada e aprovada, sem quebrar os estados atuais do Principal SDR.

## Saudacao Por Horario

Timezone oficial: `America/Guayaquil`.

- 05:00-11:59: `01_B_Buenos_dias`
- 12:00-17:59: `01_C_Buenos_tardes`
- 18:00-04:59: `01_A_buenas_noches`

Nunca trocar o periodo.

## Cliente Com Dados

Se o cliente ja mandar nome, cidade, provincia, endereco/agencia e quantidade:

1. nao reiniciar apresentacao;
2. nao pedir novamente dados ja salvos;
3. calcular valor oficial;
4. completar apenas dados faltantes;
5. gerar resumo;
6. pedir confirmacao.

## Resumo Obrigatorio

Antes do fechamento, o resumo deve seguir esta estrutura, adaptando apenas agencia ou domicilio:

```text
Perfecto señor {{name}} 😊

✔ {{quantity}} frascos
✔ Total: ${{total}}
✔ Provincia: {{province}}
✔ Ciudad: {{city}}
```

Se for agencia:

```text
✔ Agencia: {{agency}}
```

Se for domicilio:

```text
✔ Dirección: {{address}}
✔ Referencia: {{reference}}
```

Fechar com:

```text
¿Está todo correcto?
```

## Audio Purpose Map

Os audios devem ser chamados por funcao/etapa, nao por nome solto em novas implementacoes.

### Entrada

- `01_B_Buenos_dias`
- `01_C_Buenos_tardes`
- `01_A_buenas_noches`

### Prova

- `FUNCIONA_VIT_POWER`
- `DEPOIMENTO_AUDIO_PRODUTO`

### Oferta

- `1_BOTELLA_POR_39`
- `3_BOTELLAS_POR_95_E_99`
- `6_BOTELLAS_POR_167_E_99`
- `TRATAMENTO_Y_PRECIOS_PROMOCAO`

### Logistica

- `ENDERECO_CIDADE_PROVINCIA_AGENCIA`
- `ENTREGA_SEGURA_RETIRE_NA_AGENCIA`
- `ENVIO_AGENCIA_100_SEGURO`
- `DOMICILIO_A_AGENCIA_DE_SERVIENTREGA`
- `QUANDO_CLIENTE_PEDIR_A_DOMICILIO_REFERENCIA_COMPLETA`

### Fechamento E Posvenda

- `Agradecimento_Agencia_01`
- `AGRADECIMENTO_AGENCIA_DE_ENTREGA`
- `BONUS_RETIRADA`
- `Informativo_Ana_Lopes_pedido_Em_fase_entrega`
- `Chegou_01`
- `CONFIRMACION_Y_REGALITO_ESPECIAL`
- `Chegou_02`
- `Chegou_03`

## Antirrepeticao De Audio

Regra-alvo para evolucao tecnica:

```text
getNextAudioByPurpose(customerId, purpose)
```

Comportamento esperado:

- se o cliente ja ouviu um audio, usar outro da mesma funcao;
- se nao houver variacao restante, usar texto curto resumido;
- nunca repetir audio aprovado para o mesmo cliente sem nova intencao clara.

Enquanto essa funcao nao existir como modulo separado, preservar as travas atuais de memoria e dedupe.

## Memoria Obrigatoria

Sempre salvar e respeitar:

- etapa;
- ultimo audio;
- ultima pergunta;
- perfil do cliente;
- score;
- resumo da conversa;
- quantidade;
- total;
- cidade;
- provincia;
- agencia/endereco;
- status de confirmacao.

## Perfis De Cliente

Classificacao-alvo:

- `QUENTE`
- `DESCONFIADO`
- `SOCIAL`
- `SEXUALMENTE_FRUSTRADO`
- `LOGISTICO`
- `CLIENTE_JA_ENVIOU_DADOS`
- `CLIENTE_NAO_ENVIOU_DADOS`

Salvar em `profile_type` quando implementado.

## Score De Compra

Regra-alvo:

- `+3`: perguntou preco;
- `+5`: escolheu quantidade;
- `+8`: mandou endereco/agencia/cidade/provincia;
- `+10`: confirmou resumo.

Salvar em `buyer_score` quando implementado.

## Modulos-Alvo

Arquitetura desejada para evolucao incremental:

1. `conversationEngine`
2. `intentClassifier`
3. `memoryService`
4. `audioEngine`
5. `funnelEngine`
6. `logisticsEngine`
7. `orderSummaryEngine`
8. `humanHandoffEngine`
9. `antiLoopEngine`
10. `dashboardEngine`

Regra: estes nomes sao destino de organizacao, nao autorizacao para refatorar tudo de uma vez.

## Painel Humano

Barra rapida desejada:

- `INICIO`
- `QUALIFICAR`
- `FUNCIONA`
- `PROVA`
- `PRECO`
- `1 FRASCO`
- `3 FRASCOS`
- `6 FRASCOS`
- `AGENCIA`
- `DOMICILIO`
- `ENDERECO`
- `RESUMO`
- `FECHAR`
- `GUIA`
- `RETIRADA`
- `VIP`
- `HUMANO`

Implementar apenas quando solicitado, em etapa separada, sem alterar o funil de conversa.

## Modo De Entrega

Ao finalizar qualquer ajuste, reportar:

1. arquivos alterados;
2. backups criados;
3. testes executados;
4. logs relevantes;
5. comandos para rodar, quando houver;
6. impacto esperado;
7. rollback.

## Regra Final

O objetivo e uma central SDR IA WhatsApp organizada, humana, conversiva, estavel, simples para o operador e simples para o cliente.

O caminho para isso e preservar o aprovado e melhorar por camadas pequenas.

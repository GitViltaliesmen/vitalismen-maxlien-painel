# Funil Vit Power 2026

Nome operacional oficial:

`Funil Vit Power 2026`

Nome tecnico:

`FUNIL_VIT_POWER_2026`

Este nome aponta para o funil restaurado e testado da madrugada:

`/opt/vitalismen-automacao/backups/freeze-all-vitalismen-20260521_062230`

## Regra

Sempre que o operador disser **Funil Vit Power 2026**, considerar este funil como a referencia oficial.

Nao restaurar outro congelamento, nao misturar partes de outro funil e nao trocar a base sem pedido explicito do operador.

O modo de evolucao e governanca deste funil fica definido no documento:

`docs/COMANDO_MESTRE_SDR_IA_WHATSAPP_VIT_POWER_V5.md`

Esse comando mestre orienta como melhorar o projeto sem contaminar, recriar ou substituir etapas ja aprovadas.

## Componentes principais

- Produto: Vit Power Ecuador.
- Motor: Principal SDR.
- Saudacao inicial por horario do Ecuador:
  - manha: `01_B_Buenos_dias`
  - tarde: `01_C_Buenos_tardes`
  - noite: `01_A_buenas_noches`
- Aceite de confirmacao com `correcto`, `ok correcto`, `de acuerdo`, `confirmo`, `proceda` e sinonimos equivalentes.
- Servientrega/agencia dentro do fluxo Principal SDR.

## Congelamento das frases iniciais de entrada WhatsApp

Status: aprovado e congelado em 2026-05-22.

Escopo: somente as frases pre-preenchidas que abrem o WhatsApp pelo clique da pagina/anuncio e a lista interna que reconhece essas frases como entrada oficial do funil.

Nao altera: audios iniciais, ordem do funil, preco, quantidade, coleta de dados, agencia, fechamento, `order_closed` ou trava pos-venda.

Frases oficiais congeladas:

- `Hola, vengo del video`
- `Hola, acabo de ver el video`
- `Hola, vi la presentacion`
- `Hola, llegue desde la pagina`
- `Hola, vengo de la informacion del video`
- `Hola, termine de ver el video`
- `Hola, estoy entrando desde el video`
- `Hola, vi el video completo`

Regra de entrada sem preco:

- as frases oficiais de clique/VSL nao devem mencionar preco, promocao, desconto, frascos ou pedido prioritario;
- no primeiro contato oficial, o bot envia saudacao por horario, prova social e imagem do produto, sem tabela de preco;
- preco/promocao so entra quando o cliente pergunta por preco/valor/promocao ou quando demonstra intencao de compra/quantidade;
- deduplicacao e sanitizacao continuam obrigatorias antes de qualquer envio ao cliente.

Arquivos de referencia:

- `public/cta-vit-power-messages.json`
- `src/services/initialFunnelTriggers.js`
- VPS publico: `/var/www/ec.maxlien.shop/cta-vit-power-messages.json`
- fallback da pagina publica: `/var/www/ec.maxlien.shop/m/index.html`

Regra: qualquer mudanca futura nessas frases deve ser tratada como alteracao pontual de entrada/CTA, documentada em novo congelamento, sem mexer no motor do funil pronto.

## Congelamento ate preco e quantidade

Status: aprovado e congelado ate a etapa em que o cliente recebe preco e confirma a quantidade do produto.

Nao alterar:

- entrada inicial do funil;
- saudacao por horario;
- envio de provas;
- imagem do frasco;
- texto/audio de preco;
- reconhecimento de quantidade `1`, `3` ou `6`;
- confirmacao de quantidade e valor.

Tambem fica congelada a resposta imediata apos a escolha da quantidade, no formato:

- quantidade escolhida pelo cliente;
- valor oficial correspondente;
- pergunta curta de confirmacao, como `¿Listo?`, `¿Correcto?`, `¿Está de acuerdo?` ou equivalente.

Excecao autorizada:

- nessa pergunta contextual de quantidade/valor, aceitar respostas naturais de confirmacao como `esta bien`, `ok`, `correcto`, `listo`, `de acuerdo`, `hagale`, `mande nomas`, `envie nomas`, `me sirve`, `todo bien`, `todo ok` e equivalentes de uso regional;
- esse aceite e contextual somente para a etapa `sdr_awaiting_value_confirmation`, sem alterar outras confirmacoes do funil;
- apos o cliente confirmar quantidade e valor, remover duplicacao de texto e perguntar somente:
  `¿Puedo enviar su pedido para una agencia de Servientrega? Sí o no?`
- se responder sim, pedir cidade e provincia somente com o audio aprovado `ENDERECO_CIDADE_PROVINCIA_AGENCIA`, sem texto redundante junto desse audio;
- buscar agencias pela cidade/provincia em `src/data/agencia_LISTA.json`, priorizando cidade como criterio dominante;
- sempre pedir o cliente para escolher agencia por `A`, `B` ou `C`;
- se nenhuma das tres servir, enviar mais tres opcoes ate o cliente escolher;
- nao alterar as regras ja existentes de normalizacao/grafia de Servientrega fora dessa etapa.

## Caminho nomeado no VPS

`/opt/vitalismen-automacao/freezes/FUNIL_VIT_POWER_2026`

## Congelamento de fechamento com agencia

Status: aprovado inteiro ate o fechamento com agencia.

Este bloco completo deve ficar no mesmo bloco mestre do `FUNIL_VIT_POWER_2026`, como parte congelada do funil principal. Nao criar copia paralela nem ramificacao duplicada.

Senha operacional para autorizar mudanca neste bloco:

`AUTORIZO ALTERAR BLOCO FECHAMENTO AGENCIA VIT POWER 2026`

Sem essa frase expressa do operador, qualquer pedido futuro deve ser tratado como duvida, auditoria, teste, documentacao ou melhoria fora do bloco congelado.

Nao alterar sem autorizacao expressa:

- pergunta de envio para agencia Servientrega;
- audio-only `ENDERECO_CIDADE_PROVINCIA_AGENCIA` apos o cliente responder sim para agencia;
- coleta de cidade/provincia;
- busca de agencia em `src/data/agencia_LISTA.json`;
- escolha de agencia por `A`, `B` ou `C`;
- resumo final;
- confirmacao final;
- envio de `Agradecimento_Agencia_01`;
- envio de `BONUS_RETIRADA`;
- marcacao interna `order_closed`.

Regra pos-fechamento com agencia:

- depois de `order_closed`, o bot pode responder duvidas simples do cliente sobre pedido, guia, agencia ou retirada;
- o bot nunca deve reabrir o funil de fechamento, repetir oferta, gerar novo fechamento ou iniciar novo pedido antes da retirada/entrega confirmada pela logistica;
- enquanto o pedido estiver ativo para agencia, qualquer tentativa de nova compra deve receber resposta curta informando que o pedido ja esta confirmado e que outro fechamento so pode ocorrer apos a retirada;
- se o pedido voltar como devolvido/nao retirado, o cliente fica bloqueado para novo envio contra entrega e deve ir para revisao humana/pre-pago conforme regra operacional.

Hotfix operacional 2026-05-21:

- apos envio de `Agradecimento_Agencia_01`/`AGRADECIMENTO_AGENCIA_DE_ENTREGA` e `BONUS_RETIRADA`, considerar venda fechada imediatamente;
- marcar memoria do contato como `order_closed`, `PEDIDO_CONFIRMADO` e `postOrderNoResumeUntilPickup`;
- limpar qualquer `pendingCheckoutOrder` antigo, principalmente etapas `sdr_awaiting_final_confirmation`;
- bloquear frases de retomada como `Retomamos el pedido aqui` depois do fechamento;
- qualquer nova mensagem do cliente deve cair somente em pos-venda/duvida/logistica, sem reentrar no funil de venda.

Atualizacao autorizada 2026-05-22:

- operador autorizou com `AUTORIZO ALTERAR BLOCO FECHAMENTO AGENCIA VIT POWER 2026`;
- alterar somente a ultima frase textual apos os audios de fechamento;
- para agencia, confirmar agencia Servientrega e endereco escolhido;
- para domicilio, confirmar o endereco do cliente;
- manter inalterados: `order_closed`, `PEDIDO_CONFIRMADO`, envio dos audios de fechamento, pausa para humano e trava anti-retorno ao atendimento inicial;
- apos esta alteracao, o bloco volta a ficar congelado e exige a mesma senha operacional para nova mudanca.

Senha operacional especifica para alterar essa trava pos-fechamento:

`AUTORIZO ALTERAR TRAVA POS FECHAMENTO VIT POWER 2026`

Sem essa frase expressa do operador, esta trava deve ser tratada como congelada e intocavel.

## Comandos de parada por cliente

Comandos manuais ja aceitos no painel para marcar venda fechada e pausar automacao longa para o cliente:

- `#fechado`
- `/fechado`
- `#pedido_confirmado`
- `/pedido_confirmado`
- `#venda_concluida`
- `/venda_concluida`

Para parar o bot por cliente sem marcar venda fechada, usar a acao de atendimento manual/claim no painel. Ela coloca o contato em `human.mode = manual` e pausa a automacao daquele cliente durante a janela manual.

Regra operacional:

- apos fechamento, o proprio funil ja bloqueia retomada de venda;
- se o bot estiver enviando algo desnecessario ou com risco de spam, operador deve assumir/claim manualmente o cliente;
- se for fechamento manual, usar um dos comandos acima;
- se for bloqueio por devolucao/nao retirada, manter cliente travado para novo contra entrega e encaminhar para humano/pre-pago.

## Rotina de teste

Depois de cada conversa de ajustes no funil, zerar o telefone de teste `5515998038637` antes de liberar novo teste do inicio.

A limpeza deve remover memoria do contato, mensagens, travas/dedupe, pedidos de teste e registros do painel ligados a esse telefone, sem afetar clientes reais.

## Rotina de revisao: bot aguardando resposta

Esta rotina entra no plano geral de atualizacao do `FUNIL_VIT_POWER_2026`.

Objetivo:

- revisar as 46 conversas mais urgentes em que a ultima mensagem do cliente ficou sem resposta;
- identificar o problema apresentado em cada mensagem;
- sugerir uma solucao operacional individual;
- transformar repeticoes em novas regras do funil, sem quebrar blocos congelados.

SLA de primeira resposta:

- contato novo deve receber um primeiro sinal humano entre 10 segundos e 1 minuto e 59 segundos;
- alvo operacional do bot: micro-resposta inicial entre 10 e 45 segundos, antes de audio/prova/imagem;
- 2 minutos sem resposta ja e atraso operacional e deve entrar no relatorio;
- 5 minutos: alerta tardio para preco, quantidade, agencia, confirmacao final, guia, pedido e retirada;
- 10 minutos: auditoria de abandono/fila antiga, nao tempo aceitavel de espera do cliente.

Comando:

```sh
npm run review:unanswered -- --minutes=2 --hot-minutes=2 --limit=46
```

Relatorios gerados:

- `docs/REVISAO_BOT_AGUARDANDO_RESPOSTA_YYYY-MM-DD.md`;
- `docs/REVISAO_BOT_AGUARDANDO_RESPOSTA_YYYY-MM-DD.json`.

Cada item deve conter telefone/chat, tempo sem resposta, etapa do funil, ultima mensagem, problema, solucao e resposta sugerida.

Regra fora do plano de vendas:

- mensagens sociais ou links organicos de TikTok/Instagram/Facebook podem receber resposta curta e humana, como `👍 Lo vi, gracias por compartirlo.`;
- essa resposta nao deve abrir preco, nao deve iniciar funil, nao deve criar pedido e nao deve alterar bloco de fechamento;
- objetivo operacional: manter conversa organica e cordial quando a mensagem nao tem intencao comercial clara.

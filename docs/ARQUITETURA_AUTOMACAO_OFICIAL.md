# Arquitetura oficial da automacao Vitalismen

Data da auditoria: 2026-05-08.

## Decisao oficial

O foco operacional atual e um unico funil:

- produto: Vit Power;
- pais/logistica: Equador;
- persona e autoridade oficial: Ana Lopez, equipe da doctora Maria Fernandes;
- site/VSL oficial: `https://maxlien.shop/m/`;
- checkout oficial no VPS: `/var/www/ec.maxlien.shop/m/index.html`;
- bot/automacao WhatsApp oficial: projeto Node em `/Users/greson/Documents/Vitalismen Automacao`;
- entrada local do painel: `http://127.0.0.1:3001/qr.html`.

Nao criar novo funil, novo painel ou novo bot antes de verificar este documento, `AGENTS.md` e `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`.

O funil evoluido local fica documentado em `docs/FUNIL_EVOLUIDO_VIT_POWER_EC.md`. Ele ainda nao deve ser considerado publicado no VPS ate passar por teste piloto e deploy explicito.

## Funil oficial ativo

### Estrutura congelada: cliente sem dados no inicio

Em 2026-05-08, a estrutura do caminho sem dados no inicio ficou congelada:

1. entrada por CTA/interesse;
2. `Inicio_01`;
3. `Inicio_02`;
4. prova social 1;
5. prova social 2;
6. imagem oficial Vit Power;
7. texto de valores;
8. cliente escolhe `1`, `3` ou `6` frascos;
9. bot confirma pacote/valor e pergunta `¿Listo?`;
10. se cliente confirma, bot envia `PERGUNTA_AGENCIA_DOMICILIO`;
11. se cliente responde apenas agencia, bot envia `ENDERECO_CIDADE_PROVINCIA_AGENCIA`;
12. se cliente informa agencia/cidade/provincia/endereco, bot confirma dados limpos e pede nome completo;
13. ao receber nome, bot envia confirmacao limpa com `Cliente`, `Destino`, `Punto de Retiro` e `Dirección`;
14. se cliente confirma, bot envia texto humano curto, `Agradecimento_Agencia_01` e `BONUS_RETIRADA`.

Nao alterar esta estrutura enquanto a proxima frente estiver sendo trabalhada.

### Estrutura congelada: cliente com dados no inicio

Em 2026-05-09, a estrutura do caminho com dados no inicio tambem ficou congelada:

1. cliente envia primeira mensagem com dados do pedido, como nome, provincia, cidade, endereco/agencia, referencia, quantidade e total;
2. bot identifica que e mensagem de dados e nao deixa cair em IA livre;
3. bot envia `Inicio_01`;
4. bot envia `Inicio_02`;
5. bot envia provas sociais/imagem oficial quando aplicavel;
6. bot nao envia tabela completa de precos;
7. bot usa a quantidade informada para calcular o valor oficial:
   - 1 frasco: 39.99 USD;
   - 3 frascos: 95.99 USD;
   - 6 frascos: 167.99 USD;
8. bot envia resumo limpo com `Cliente`, `Destino`, `Punto de Retiro`, `Dirección`, `Pedido` e `Total`;
9. bot pergunta se os dados estao corretos para proceder com o envio;
10. se cliente confirma, bot envia texto humano curto, `Agradecimento_Agencia_01` e `BONUS_RETIRADA`;
11. se faltar dado, bot pede somente o dado faltante e mantem esta estrutura.

Nao alterar as estruturas A ou B sem pedido explicito.

### Regra de imutabilidade A/B

As estruturas A e B sao o nucleo congelado do funil. A partir desta decisao, qualquer melhoria nova deve entrar como camada de complemento, sem trocar a ordem, textos essenciais, audios obrigatorios ou condicoes de fechamento ja aprovadas.

Bloqueios praticos:

- nao mudar a ordem `Inicio_01` -> `Inicio_02` -> provas sociais -> imagem -> valores;
- nao remover `PERGUNTA_AGENCIA_DOMICILIO` nem `ENDERECO_CIDADE_PROVINCIA_AGENCIA` do caminho sem dados;
- nao remover a confirmacao limpa de dados antes do fechamento;
- nao remover `Agradecimento_Agencia_01` e `BONUS_RETIRADA` apos confirmacao;
- nao fazer pedido subir automaticamente para Dropi sem autorizacao manual;
- nao reativar funil legado, scheduler paralelo de envio ou IA livre antes do roteiro oficial.

### Camada de complementos fora do nucleo A/B

Novas necessidades que nao seguem exatamente as estruturas A/B devem ser tratadas como modulos laterais. Eles podem observar contexto e ajudar o atendimento, mas nao podem reescrever o caminho congelado.

Tipos permitidos de complemento:

- resposta de duvidas antes/depois do funil, como uso, beneficio, tempo de resultado, preco e objecoes;
- cliente interrompe o funil com pergunta ou audio inesperado;
- cliente quer trocar agencia, domicilio, quantidade ou nome depois da confirmacao;
- cliente ja comprou, retirou, devolveu ou quer recomprar;
- consulta de agencias Servientrega pela lista oficial interna;
- pos-envio: guia, chegada na agencia, retirada, bonus, devolucao e bloqueio para pagamento antecipado;
- operacao Dropi: sincronizar, dry-run, autorizacao manual e envio controlado.

Regra de desenho: complemento novo deve ter nome, gatilho, resposta esperada, memoria anti-spam e criterio de retorno ao funil A/B.

### Complemento lateral: audios de duvidas e objecoes

Em 2026-05-09, foi criado o complemento lateral `vitPowerAudioComplementService`, sem alterar o nucleo A/B. Ele responde perguntas/nuances de duvida com audios gravados aprovados.

Gatilhos principais:

- preco/promocao/tratamento: `TRATAMENTO_Y_PRECIOS_PROMOCAO_1_3_6`;
- como tomar/usar/dose: `COMO_SE_TOMA_VIT_POWER`;
- funciona/duvida leve: `FUNCIONA_VIT_POWER` + `DEPOIMENTO_AUDIO_PRODUTO`;
- prostata/urina: `Ajuda_Prostata`;
- tempo de resultado: `TEMPO_RESULTADO_VIT_POWER`;
- medo de golpe/seguranca/confianca: provas sociais `social_03`, `social_04` + `ENVIO_AGENCIA_100_SEGURO`;
- cliente nao pode retirar em agencia: `QUANDO_DIZER_NAO_PODE_RETIRAR_PRODUTO`;
- perguntas pessoais insistentes sobre Ana: `INFORMACOES_PESSOAIS_NAIS`;
- ligacao recebida: `CLIENTES_QUE_LIGAM` pelo tratamento de chamada do WhatsApp.
- cliente insiste em chamada por mensagem: `QUANDO_CLIENTE_INSISTE_EM_LIGAR` + `QUANDO_CLIENTE_LIGA_01`.

Memoria anti-spam:

- cada complemento usa `metadata.perAgentMemory.vit_power_ec.audioComplements`;
- cooldown padrao: 30 minutos por tipo de complemento e contato;
- se estiver em etapa estrita de confirmacao/agencia/referencia, o nucleo A/B tem prioridade.

Midias instaladas:

- depoimento em audio instalado como `public/media/templates/EC/DEPOIMENTO_AUDIO_PRODUTO.ogg`;
- depoimento em audio teve silencio inicial cortado; backup original em `public/media/templates/EC/DEPOIMENTO_AUDIO_PRODUTO.original.ogg`;
- audio `FUNCIONA_VIT_POWER` instalado de `AUDIOS EQUADOR PARA AUTOMACAO.zip` como `public/media/templates/EC/FUNCIONA_VIT_POWER.ogg`;
- biblioteca oficial de audios do zip `AUDIOS EQUADOR PARA AUTOMACAO.zip` importada para `public/media/templates/EC`;
- importacao preserva arquivos existentes e cria nomes tecnicos limpos em `.mp3` e `.ogg` para uso futuro via `resolveCountryAudio`;
- arquivo com nome de contexto externo foi ignorado por regra de contexto Equador/Vit Power;
- video de prova social Boquet configurado como `prova_social_video_boquet` com `viewOnce=true` quando usado na recuperacao.
- audio de perguntas pessoais instalado como `INFORMACOES_PESSOAIS_NAIS.ogg`.
- audios importados do material paralelo util em `New project 3`: `QUANDO_CLIENTE_INSISTE_EM_LIGAR` e `QUANDO_CLIENTE_LIGA_01`.

Regra de persona:

- se o cliente insistir em detalhes pessoais, Ana pode responder de forma curta que e casada e cuida sua privacidade;
- nao entrar em detalhes como endereco, rotina, familia, fotos pessoais ou conversas fora do produto;
- voltar para Vit Power e para o pedido.

Recuperacao:

- `WHATSAPP_PRODUCT_SOFT_FOLLOWUP_DELAY_MINUTES=120`;
- apos 2h sem resposta depois da apresentacao inicial, o sistema envia lembrete curto de surpresa especial/bonus;
- `WHATSAPP_PRODUCT_FOLLOWUP_DELAY_MINUTES=1440`;
- apos 24h sem resposta depois da apresentacao inicial, o sistema usa a mensagem do lote de retirada e alterna provas sociais: `social_01`, `social_02`, `social_03`, `social_04`, `DEPOIMENTO_AUDIO_PRODUTO` e `prova_social_video_boquet`.

Arquivo principal:

- `src/services/conversationEngine.js`

Entrada das mensagens:

- `src/whatsapp/dispatcher.js`
- `src/services/agentRouter.js`
- `src/services/agents/vitPowerAgent.js`

Deteccao de CTA:

- `src/services/initialFunnelTriggers.js`
- `public/cta-vit-power-messages.json`
- VPS: `/var/www/ec.maxlien.shop/cta-vit-power-messages.json`

Ordem congelada da apresentacao inicial:

1. `Inicio_01`
2. `Inicio_02`
3. `social_01`
4. `social_02`
5. `vit_power_bottle`
6. texto de valores com chamada direta para a quantidade escolhida no formulario, quando existir

Regra de memoria:

- a apresentacao so e considerada concluida quando todas as chaves existem:
  - `audio:Inicio_01`
  - `audio:Inicio_02`
  - `image:social_01`
  - `image:social_02`
  - `image:vit_power_bottle`
  - `text:price`
- `initialProductPresentationSentAt` sozinho nao basta para pular o funil.

Regra de formulario CTA:

- mensagem com `Nombre`, `Provincia`, `Ciudad`, `Dirección`, `Cantidad` e `Total` nunca deve ir para IA livre;
- se faltar `Punto de referencia`, perguntar somente esse campo;
- se estiver completo, responder que os dados e a agencia foram recebidos e iniciar apresentacao gravada;
- apos a apresentacao, pedir confirmacao direta da quantidade do formulario (`1 FRASCO`, `3 FRASCOS` ou `6 FRASCOS`);
- se o formulario trouxer `Cantidad: 3`, o bot deve falar 3 frascos e 95.99 USD;
- se o formulario trouxer `Cantidad: 6`, o bot deve falar 6 frascos e 167.99 USD;
- quando o cliente responder a quantidade pedida, confirmar a mesma quantidade + valor + agencia/endereco em uma mensagem;
- no caminho sem dados, depois que o cliente confirmar valor/quantidade, perguntar se o envio sera para agencia Servientrega ou domicilio com `PERGUNTA_AGENCIA_DOMICILIO`;
- se o cliente responder agencia sem indicar cidade/provincia/agencia/endereco, enviar `ENDERECO_CIDADE_PROVINCIA_AGENCIA`;
- depois que o cliente informar cidade/provincia/direcao/agencia, confirmar os dados recebidos e pedir somente o nome completo;
- depois que o cliente informar nome completo, confirmar nome, cidade, provincia e direcao/agencia e perguntar se esta de acordo ou deseja alterar algo;
- apos `Si/Correcto`, marcar pedido como confirmado, enviar texto humano curto de confirmacao, enviar `Agradecimento_Agencia_01` e depois `BONUS_RETIRADA`;
- marcadores internos como `[AUDIO] Agradecimento_Agencia_01` ou `[AUDIO] BONUS_RETIRADA` nunca devem aparecer para o cliente.

## Automacoes paralelas apagadas

Estas partes foram removidas do caminho automatico do sistema para evitar confusao futura:

- `src/services/funnelService.js`
  - status: apagado;
  - motivo: dispara outro funil por pedido pendente (`audio01`, confirmacao de endereco e oferta), conflitando com o funil CTA oficial;
- recuperacao automatica de rascunho em `src/services/schedulerService.js`
  - status: codigo removido do scheduler;
  - motivo: gera mensagem/Audio TTS de recuperacao fora do roteiro gravado;
- `src/services/aiService.js`
  - status: apagado;
  - motivo: servia ao fluxo legado de recuperacao/rewrite e podia induzir resposta fora do funil oficial;
- avisos automaticos de envio/retirada em `src/services/shipmentSchedulerService.js`
  - status: apagado;
  - motivo: so ativar depois de validar textos/audios de pos-envio;
- TTS gerado em `public/media/generated`
  - status: nao oficial para o funil Vit Power;
  - regra: `BOT_USE_APPROVED_AUDIO_ONLY=true`.

## Flags oficiais atuais

```text
BOT_FORCE_AGENT=vit_power_ec
WHATSAPP_AUTO_REPLY_ENABLED=true
WHATSAPP_FUNNEL_ENABLED=false
WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=true
BOT_USE_APPROVED_AUDIO_ONLY=true
```

`WHATSAPP_FUNNEL_ENABLED` fica falso para impedir retorno do fluxo antigo. Nao recriar flags de funil legado, recuperacao de rascunho ou envio automatico de entrega sem decisao explicita.

## Comando senior

Antes de testar, rodar:

```sh
npm run senior:check
```

Antes de encerrar um ciclo de trabalho ou retomar depois de uma pausa, rodar:

```sh
npm run official:audit
```

Esse comando confere local + VPS, flags oficiais, guard local, guard do VPS, API/WhatsApp local quando estiverem rodando, e divergencias recentes entre formulario `Cantidad` e pedido salvo.

Esse comando bloqueia:

- retorno de `src/services/funnelService.js`;
- retorno de `src/services/aiService.js`;
- retorno de `src/services/shipmentSchedulerService.js`;
- referencias ao funil pendente legado;
- flags antigas de automacao paralela;
- mencoes a `protocolo` no codigo;
- `.env` fora do foco `BOT_FORCE_AGENT=vit_power_ec`.

No VPS, tambem rodar:

```sh
cd /opt/vitalismen-automacao/current
npm run senior:check
```

Esse comando confirma que o funil antigo do `whatsapp-local.js` continua desligado, que o `ai-worker` antigo continua bloqueado e que o VPS segue concentrado no fluxo oficial Vit Power.

## Audios oficiais aprovados

Pasta oficial:

- `public/media/templates/EC`

Audios existentes:

- `Inicio_01`
- `Inicio_02`
- `PERGUNTA_AGENCIA_DOMICILIO`
- `ENDERECO_CIDADE_PROVINCIA_AGENCIA`
- `Agradecimento_Agencia_01`
- `BONUS_RETIRADA`
- `CONFIRMACION_Y_REGALITO_ESPECIAL`
- `Chegou_01`
- `Chegou_02`
- `Chegou_03`

Imagens oficiais:

- `public/media/sales/shared/social_01.jpeg`
- `public/media/sales/shared/social_02.jpeg`
- `public/media/sales/shared/social_03.jpeg`
- `public/media/sales/shared/social_04.jpeg`
- `public/media/sales/ec/vit_power.jpeg`

Audios ainda faltantes para cumprir 90% do funil em audio gravado:

- explicacao curta de beneficios do Vit Power;
- como usar;
- tempo esperado de percepcao/rotina;
- resposta para duvida de saude com aviso responsavel;
- resposta para preco/custo-beneficio;
- resposta para "funciona mesmo?";
- resposta para "esta caro";
- pedido de dados;
- pedido de ponto de referencia;
- confirmacao de pedido por agencia;
- confirmacao de pedido por domicilio;
- follow-up sem resposta apos valores;
- lembrete de retirada;
- audio de bonus pos-agradecimento instalado como `BONUS_RETIRADA`;
- audio de incentivo para guia/rota instalado como `CONFIRMACION_Y_REGALITO_ESPECIAL`.
- audio de aviso quando o pedido chegou na agencia envia `Chegou_01` primeiro e `CONFIRMACION_Y_REGALITO_ESPECIAL` logo depois para incentivar a retirada.
- cada tentativa de audio de envio fica registrada em `automation.sentAudioLog` com etapa, nome do audio, data, sessao e resultado.
- avisos de envio usam hash em `automation.sentMessageHashes`, data por etapa e intervalo minimo para evitar repeticao/spam.
- textos de guia e chegada na agencia usam variantes humanas com emojis, escolhidas de forma estavel por pedido/guia para variar entre clientes sem quebrar anti-spam.
- cadencia humana: mensagens saem por fila por cliente e por fila global; audios usam `recording`, texto usa `composing`, e depois de audio o sistema espera a duracao real aproximada do arquivo mais uma variacao curta antes de continuar.
- sincronizacao Dropi EC usa API interna de pedidos com janela padrao de 90 dias e paginacao, para encontrar pedidos/telefones/guias que nao aparecem nos filtros curtos da tela.
- lista local oficial de agencias Servientrega Ecuador instalada em `src/data/agencia_LISTA.json` com 591 agencias, 219 cidades e 24 provincias.
- em 2026-05-09, decisao operacional do projeto: considerar essa lista como lista oficial interna de agencias aptas para uso no funil Vit Power Ecuador.
- o funil consulta `servientregaEcuadorAgencyService` para conferir agencia informada pelo cliente; se houver match seguro, usa nome/endereco oficiais na confirmacao e informa que a agencia foi confirmada na lista oficial de Servientrega.
- se o cliente informar apenas cidade/provincia ou uma agencia incerta, o bot lista ate 3 opcoes de Servientrega e pede para responder `A`, `B` ou `C` antes de pedir o nome completo. Numeros ficam reservados para quantidade de frascos (`1`, `3`, `6`).
- consulta administrativa de agencias: `GET /api/shipments/servientrega/ec/agencies?city=Manta&province=Manabi&limit=3`.
- envio de pedidos para Dropi EC nao e automatico: o lote `/api/shipments/droppi/ec/dispatch/run` so processa pedidos marcados antes em `/api/shipments/droppi/ec/orders/:orderId/authorize-submit`; sem essa autorizacao manual, o dry-run e o envio real retornam fila vazia.
- a autorizacao manual fica registrada no envio em `automation.dropiSubmitAuthorizedAt`, `automation.dropiSubmitAuthorizedBy` e no evento `dropi_submit_authorized`; pode ser removida em `/api/shipments/droppi/ec/orders/:orderId/revoke-submit-authorization`.
- quando a retirada/entrega e confirmada, o envio marca `pickedUp=true`, `delivered=true`, limpa `prepaidOnly` e libera o telefone para novo pedido contra entrega.
- quando o pedido e devolvido/nao retirado, o envio marca `prepaidOnly=true` e novos pedidos contra entrega pelo mesmo telefone retornam mensagem de pagamento antecipado.

Enquanto esses audios nao forem gravados e aprovados, o sistema deve usar texto curto nas etapas sem template e nao gerar TTS.

## VPS

Mapa encontrado:

- Site Vit Power Equador: `/var/www/ec.maxlien.shop`
- VSL/checkout oficial: `/var/www/ec.maxlien.shop/m/index.html`
- Admin/CRM online: `/opt/maxlien-mvp`
- Banco CRM EC: `/opt/maxlien-mvp/leads_ec.sqlite3`
- Automacao oficial atual: `/opt/vitalismen-automacao/current`
- PM2 oficial atual: `vitalismen-automation`.

O VPS tem muitos backups e paginas antigas (`m-sandbox`, `m-treino`, `m2`). Eles sao referencia historica, nao fonte principal do funil atual.

### Bloqueio oficial aplicado no VPS

- backups de deploy ficam em `/opt/vitalismen-automacao/backups` e releases em `/opt/vitalismen-automacao/releases`;
- `.env` da automacao atual deve manter:
  - `VITALISMEN_OFFICIAL_ONLY=true`;
  - `VITALISMEN_OFFICIAL_PRODUCT=Vit Power`;
  - `VITALISMEN_OFFICIAL_AGENT=Ana Lopez`;
  - `VITALISMEN_OFFICIAL_DOCTOR=Dra. Maria Fernandes`;
  - `BOT_FORCE_AGENT=vit_power_ec`;
  - `WHATSAPP_AUTO_REPLY_ENABLED=true`;
  - `WHATSAPP_FUNNEL_ENABLED=false`;
  - `BOT_USE_APPROVED_AUDIO_ONLY=true`;
- comando oficial no VPS: `cd /opt/vitalismen-automacao/current && npm run senior:check`.

## Regra para avancar

Antes de mudar qualquer resposta:

1. verificar se a mensagem pertence ao funil oficial, formulario CTA, pedido, Dropi ou pos-envio;
2. alterar primeiro o ponto oficial correspondente;
3. manter automacoes legadas desligadas;
4. atualizar este documento se uma regra operacional mudar;
5. testar com um contato piloto antes de liberar para mais numeros.

## Regra de finalizacao e retomada

No fim de cada ciclo de trabalho:

1. rodar `npm run official:audit`;
2. registrar se local e VPS passaram;
3. registrar se a API local ficou ligada ou desligada;
4. registrar o estado do WhatsApp (`connected`, QR ou desconectado);
5. nao considerar o ciclo finalizado se houver divergencia entre formulario e pedido salvo.

Ao retomar:

1. entrar na pasta oficial local;
2. rodar `npm run official:audit`;
3. ler o resultado antes de qualquer alteracao;
4. so mexer no funil depois de confirmar que o VPS segue com o fluxo antigo bloqueado.

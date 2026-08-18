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

Regra superior de isolamento total: aplicar `docs/ISOLAMENTO_TOTAL_VITALISMEN_PRODUCAO.md`. Vitalismen e producao critica; para isolamento absoluto pratico, deve operar em ambiente exclusivo, sem comunicacao tecnica, operacional ou de dados com Aquecimento ou qualquer projeto paralelo.

Para Vitalismen em producao isolada, nao usar supervisor compartilhado com Aquecimento. A regra antiga `docs/REGRA_ISOLAMENTO_BOTS_E_SEGURANCA.md` so vale como referencia historica para cenarios menos restritos; a regra atual superior e isolamento total sem comunicacao.

O funil evoluido local fica documentado em `docs/FUNIL_EVOLUIDO_VIT_POWER_EC.md`. Ele ainda nao deve ser considerado publicado no VPS ate passar por teste piloto e deploy explicito.

## Funil oficial ativo

### Estrutura congelada: cliente sem dados no inicio

Em 2026-05-08, a estrutura do caminho sem dados no inicio ficou congelada:

1. entrada por CTA/interesse;
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

- nunca mostrar ao cliente, no texto nem no rodape visual da conversa, que a mensagem foi enviada por IA, bot, automacao, sistema, assistente virtual ou ferramenta comercial;
- nao remover `PERGUNTA_AGENCIA_DOMICILIO` nem `ENDERECO_CIDADE_PROVINCIA_AGENCIA` do caminho sem dados;
- nao remover a confirmacao limpa de dados antes do fechamento;
- nao remover `Agradecimento_Agencia_01` e `BONUS_RETIRADA` apos confirmacao;
- nao fazer pedido subir automaticamente para Dropi sem autorizacao manual;
- nao reativar funil legado, scheduler paralelo de envio ou IA livre antes do roteiro oficial.

### Regra de intencao forte antes de etapa rigida

Em 2026-05-21, o funil passou a seguir uma regra operacional superior para atender clientes que nao respondem em ordem perfeita:

1. primeiro identificar intencoes fortes do cliente;
2. depois salvar qualquer dado util recebido;
3. por ultimo perguntar somente o proximo campo faltante.

Intencoes fortes que tem prioridade sobre a etapa atual:

- escolha clara de quantidade: `1`, `uno`, `1 frasco`, `3`, `tres`, `3 frascos`, `6`, `seis`, `6 frascos`;
- confirmacao clara de fechamento: `si`, `listo`, `correcto`, `confirmo`, `envielo`, `mande`;
- envio de dados do pedido em qualquer ordem: nome, cidade, provincia, endereco, referencia, agencia e quantidade;
- escolha de entrega: agencia Servientrega ou domicilio;
- correcao de dados ja informados.

Regra critica: se houver intencao forte de quantidade apos a apresentacao/preco, o bot deve confirmar a quantidade e enviar o audio especifico da quantidade antes de qualquer complemento de audio. O audio grande `TRATAMENTO_Y_PRECIOS_PROMOCAO` nao deve substituir audios especificos de 1, 3 ou 6 frascos.

Audios oficiais da quantidade:

- `1_BOTELLA_POR_39.mp3`;
- `3_BOTELLAS_POR_95_E_99.mp3`;
- `6_BOTELLAS_POR_167_E_99.mp3`.

O funil nao deve reiniciar quando o cliente quebrar a ordem. Ele deve responder ao que o cliente disse, atualizar memoria e retomar o proximo dado faltante.

### Congelamento: quantidade aprovada e memoria de pedido

Em 2026-05-21, ficou aprovado o comportamento de quantidade:

- se o cliente escolher `1`, `3` ou `6` depois da apresentacao/preco, o bot envia o audio especifico da quantidade;
- logo depois do audio, o bot envia um resumo em texto com quantidade, valor e confirmacao curta;
- a quantidade e o valor ficam salvos em `selectedQuantity` e no pedido pendente;
- se o cliente confirmar e depois informar nome, cidade ou provincia, o bot nao deve perguntar quantidade de novo;
- depois de cidade/provincia com quantidade ja salva, a proxima pergunta deve ser agencia Servientrega ou domicilio;
- perguntas iguais repetidas em poucos minutos devem ser bloqueadas pelo anti-duplicidade do funil principal SDR.

### Congelamento: Servientrega primeiro

Em 2026-05-21, a etapa logistica do funil passou a priorizar agencia Servientrega antes de domicilio:

- a primeira pergunta logistica deve ser: `¿Puedo enviar su pedido por una agencia de Servientrega cercana a usted?`;
- o texto deve orientar que agencia e a opcao mais segura para retirar e pagar contra entrega;
- quando houver audio aprovado, enviar o audio e tambem o texto de apoio;
- se o audio nao estiver disponivel, enviar somente o texto;
- domicilio entra apenas se o cliente recusar agencia ou pedir domicilio de forma clara;
- respostas como `si`, `correcto`, `listo`, `agencia`, `servientrega`, cidade/provincia ou nome de setor devem seguir para busca/confirmacao de agencia, nao para domicilio.

### Congelamento: cidade, provincia e lista de agencias

Em 2026-05-21, ficou definido que a coleta logistica deve evitar pedir cidade e provincia na mesma pergunta:

- primeiro perguntar somente a cidade;
- depois perguntar somente a provincia;
- usar `src/data/agencia_LISTA.json` como fonte oficial para localizar agencias Servientrega;
- se o cliente informar uma cidade, como `Palanda`, usar essa cidade para buscar agencias no JSON;
- se cidade e provincia ja estiverem salvas, ao cliente responder `SI` para agencia, listar as agencias encontradas sem pedir novamente setor/agencia;
- a lista deve vir em blocos separados por linha, com letras `A`, `B`, `C`;
- a instrucao deve ser: `Señor, por favor, elija una de las agencias abajo. Responda solo con la letra de la agencia:`;
- se o cliente quiser domicilio, pedir: endereco completo, bairro/setor e ponto de referencia.

### Ajuste: confirmacao contextual de agencia

Em 2026-05-21, a etapa logistica recebeu regra contextual para evitar confusao:

- nome desta frente: `Funil Vitalismen EC - Logistica Servientrega`;
- etapa: `Agencia Servientrega apos cidade/provincia`;
- se cidade e provincia ja estiverem em memoria e existir agencia oficial exata naquela cidade, o bot deve perguntar pela agencia especifica, por exemplo: `¿Puedo enviar su pedido para la agencia de Servientrega de Sucua, Morona Santiago?`;
- para `Sucua, Morona Santiago`, a lista oficial contem `Sucua Principal`;
- respostas como `si`, `ok`, `ck`, `perfecto`, `perfeicto`, `de acuerdo`, `esta bien`, `envieme`, `envie`, `envielo`, `mande` e equivalentes so confirmam a agencia quando a etapa pendente for de confirmacao/selecionar agencia;
- essas confirmacoes nao devem virar regra generica para qualquer etapa do funil;
- a pergunta em espanhol deve deixar saida clara para troca: `Si desea cambiar la ciudad o la agencia, escriba: cambiar ciudad.`;
- se o cliente negar ou pedir troca de cidade/agencia nessa etapa, o bot deve pedir nova cidade, provincia e agencia de referencia em espanhol, limpando a cidade/agencia anterior para evitar contaminacao;
- quando a cidade tiver match exato na lista oficial, nao listar agencias de outras cidades apenas porque sao da mesma provincia; usar outras cidades somente se nao houver agencia na cidade pedida.

### Regra anti-duplicacao por telefone

O telefone real do cliente e a chave operacional principal. O painel e os avisos logisticos nao podem tratar varios pedidos, varios atendentes ou varios espelhos `EC-ADMIN-*` como clientes diferentes quando o telefone for o mesmo.

- ao sincronizar com o painel, procurar lead existente por telefone antes de procurar por `event_id` ou id administrativo;
- um telefone deve manter uma ficha principal no painel; novas entradas do mesmo telefone devem atualizar a ficha existente;
- avisos logisticos (`guia`, `in_transit`, `ready_for_pickup` e lembretes de retirada) devem usar trava por telefone + tipo de aviso dentro da janela global;
- se outro pedido/espelho do mesmo telefone ja recebeu o aviso, o sistema deve marcar o registro atual como aviso recuperado, sem enviar nova mensagem;
- duplicidade antiga deve ser consolidada por rotina controlada/auditada, nunca apagada sem backup.

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

- preco/promocao/tratamento: `TRATAMENTO_Y_PRECIOS_PROMOCAO`;
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

3. `social_01`
4. `social_02`
5. `vit_power_bottle`
6. texto de valores com chamada direta para a quantidade escolhida no formulario, quando existir
7. audio de valores `TRATAMENTO_Y_PRECIOS_PROMOCAO`

Regra de memoria:

- a apresentacao so e considerada concluida quando todas as chaves existem:
  - `image:social_01`
  - `image:social_02`
  - `image:vit_power_bottle`
  - `text:price`
  - `audio:TRATAMENTO_Y_PRECIOS_PROMOCAO`
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
- scheduler oficial atual de pós-venda:
  - arquivo: `src/services/schedulerService.js`;
  - serviço de mensagens: `src/services/shipmentMessageService.js`;
  - status: autorizado para guia, status Servientrega, chegada, lembretes 1–6,
    comprovante e bônus;
  - cobertura obrigatória: todos os pedidos EC de Nitrix Oxide, Tex Ultra e
    Vit Power seguem a mesma cadência logística; nenhum produto pode bloquear
    chegada, lembretes, confirmação de retirada ou bônus;
  - somente a orientação de uso é específica: Vit Power usa
    `COMO_SE_TOMA_VIT_POWER`, Nitrix usa `NITRIX_USO_OXIDE_EC` e Tex Ultra fica
    sem áudio de uso enquanto não houver mídia própria aprovada;
  - regra de evidência e recuperação:
    `FREEZE_EC_PICKUP_NOTICE_EVIDENCE_20260727.md`;
  - o arquivo legado `shipmentSchedulerService.js` continua proibido e não deve
    ser recriado.
- TTS gerado em `public/media/generated`
  - status: nao oficial para o funil Vit Power;
  - regra: `BOT_USE_APPROVED_AUDIO_ONLY=true`.

## Modos oficiais de automacao

O contrato executavel de `scripts/senior-guard.mjs` e `scripts/official-state-audit.mjs` distingue exatamente dois modos. Nao existe modo intermediario e nenhuma flag acoplada pode ser alterada isoladamente.

Flags comuns aos dois modos:

```text
BOT_FORCE_AGENT=vit_power_ec
WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false
PENDING_CHECKOUT_FOLLOWUP_ENABLED=false
OBSERVER_OPENAI_ENABLED=true
BOT_USE_APPROVED_AUDIO_ONLY=true
```

### Modo observacao / nao operacional

Quando `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true` nao esta ativo, o guard exige:

```text
VIT_POWER_FUNNEL_ACTIVE=false
WHATSAPP_AUTO_REPLY_ENABLED=false
ZAPI_ROUTE_INBOUND_TO_BOT=false
WHATSAPP_FUNNEL_ENABLED=false
DISABLE_SCHEDULER=1
SHIPMENT_STATUS_DISPATCH_ENABLED=false
SHIPMENT_PICKUP_REMINDERS_ENABLED=false
PICKUP_PROOF_SWEEP_ENABLED=false
```

Nesse modo, `WHATSAPP_FUNNEL_ENABLED=false` e a trava contra ativacao acidental do funil legado.

### Modo operacional aprovado

Quando `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, o guard exige o conjunto completo:

```text
VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true
VIT_POWER_FUNNEL_ACTIVE=true
WHATSAPP_AUTO_REPLY_ENABLED=true
ZAPI_ROUTE_INBOUND_TO_BOT=true
WHATSAPP_FUNNEL_ENABLED=true
DISABLE_SCHEDULER=0
SHIPMENT_STATUS_DISPATCH_ENABLED=true
SHIPMENT_PICKUP_REMINDERS_ENABLED=true
PICKUP_PROOF_SWEEP_ENABLED=true
```

Nesse modo completo, `WHATSAPP_FUNNEL_ENABLED=true` nao e uma violacao. A flag nao recria nem autoriza `src/services/funnelService.js`, recuperacao de rascunho ou schedulers paralelos removidos. Nunca alterar apenas `WHATSAPP_FUNNEL_ENABLED`: a troca entre modos e coordenada, exige decisao operacional explicita e deve preservar toda a combinacao validada pelos guards.

### Transporte e health operacional

Na operacao EC atual, Z-API e o transporte oficial de entrada/saida publica conforme os freezes aprovados. Baileys pode coexistir habilitado, inclusive em `scanning`, sem substituir a Z-API por inferencia.

O health deve consultar o status Z-API sempre que ela estiver configurada. Z-API conectada torna o transporte oficial pronto mesmo quando nao existe sessao Baileys autenticada; nesse caso, a ausencia Baileys nao pode gerar `no_connected_whatsapp_session`. Z-API desconectada deve manter o health degradado com `zapi_not_connected`. Se Z-API nao estiver configurada e Baileys for o transporte exigido pela configuracao, a ausencia de sessao Baileys continua gerando `no_connected_whatsapp_session`. Outros motivos de degradacao permanecem cumulativos.

A consulta de health e somente leitura: nao envia mensagem, nao cria/autentica sessao, nao escaneia QR, nao escreve banco e nao altera credenciais.

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
  - o conjunto integral do modo observacao ou do modo operacional aprovado descrito em `Modos oficiais de automacao`;
  - no modo operacional aprovado, `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true` e `WHATSAPP_FUNNEL_ENABLED=true` permanecem coordenados com todas as demais flags exigidas pelo guard;
  - `WHATSAPP_PRODUCT_FOLLOWUP_ENABLED=false`;
  - `PENDING_CHECKOUT_FOLLOWUP_ENABLED=false`;
  - `BOT_USE_APPROVED_AUDIO_ONLY=true`;
- comando oficial no VPS: `cd /opt/vitalismen-automacao/current && npm run senior:check`.

## Regra para avancar

## Camada V17 de seguranca publica e integridade de produto

O freeze `docs/PRODUCTION_SECURITY_PRODUCT_INTEGRITY_FREEZE_V17_20260817.md` sucede a reconciliacao operacional V16 sem alterar seus dois modos. Rotas que exibem QR, telefone/aparelho Z-API ou relatorios com texto/telefone de clientes exigem o Bearer do painel. A VSL, o resolvedor publico de link WhatsApp, os webhooks Z-API e o health somente leitura permanecem publicos.

Produto EC desconhecido nao recebe mais um produto real por default. A chave fica vazia ate existir sinal estruturado de `tex_ultra_ec`, `nitrix_ec` ou `vit_power_ec`; neste estado, pedido/lead novo, Purchase Meta e alvo Dropi ficam bloqueados. A escolha manual por cliente e a origem separada da VSL permanecem preservadas.

Esta camada nao muda preco, funil, cadencia, audio, midia, numero, pixel, scheduler, memoria, schema ou regra de autorizacao Dropi.

## Microcamada V18 de confiabilidade do envio Dropi

O freeze `docs/DROPI_AUTOMATIC_SUBMIT_RELIABILITY_FREEZE_V18_20260817.md` sucede a V17 e corrige duas causas comprovadas nos pedidos reais de Santa Elena e El Coca:

- token antigo presente no navegador nao autentica uma pagina que continua exibindo o login do Dropi;
- a cidade esperada `Santa Elena` nao aceita mais a opcao distinta `El Tambo Santa Elena` apenas porque o nome esperado aparece como sufixo.

Se a sessao expirar ao abrir o produto, o navegador tenta novamente uma vez e, persistindo a tela de login, registra erro de autenticacao em vez de declarar falsamente que o produto nao existe. A autorizacao humana, deduplicacao, produto Tex Ultra, tabela oficial, transportadora e modo `CON RECAUDO` permanecem inalterados.

## Microcamada V19 de vinculo do comprovante Meta Purchase

O freeze `docs/META_PURCHASE_PANEL_LINKAGE_FREEZE_V19_20260817.md` sucede a V18 sem mudar o envio CAPI. O painel consulta `purchase_capi_lock` por `lead_id`, inclusive quando o mesmo telefone possui linhas historicas duplicadas, e exibe `Meta Purchase enviado` quando existe comprovante persistido com status `sent` ou `events_received > 0`.

Ausencia de vinculo passa a ser apresentada como `Meta sem vinculo`, pois nao permite concluir que a Meta esteja offline. O `event_id`, o bloqueio por `tracking.metaPurchaseSentAt`, o payload, o pixel, a confirmacao de pedido e todas as integracoes externas permanecem inalterados. A consulta e somente leitura e nao cria reenvio.

## Microcamada V20 de integridade do pedido publico EC

O freeze `docs/ORDER_PUBLIC_PRODUCT_INTEGRITY_FREEZE_V20_20260817.md` sucede a V19 no candidato ainda nao publicado. A criacao publica de pedido aceita apenas `draft` e `pending`; estados operacionais continuam restritos ao painel autenticado, e Meta Purchase na criacao direta exige esse contexto autenticado.

Produto EC ausente, invalido ou conflitante e bloqueado antes de persistencia ou efeito externo. A captura inicial de rascunho sem produto permanece permitida, mas a conversao para `pending` exige produto explicito e valido. Precos, ofertas, funil, Dropi, Meta/CAPI, scheduler, WhatsApp, schema e memoria permanecem inalterados.

Antes de mudar qualquer resposta:

1. verificar se a mensagem pertence ao funil oficial, formulario CTA, pedido, Dropi ou pos-envio;
2. alterar primeiro o ponto oficial correspondente;
3. manter automacoes legadas desligadas;
4. atualizar este documento se uma regra operacional mudar;
5. testar com um contato piloto antes de liberar para mais numeros.

## Microcamada V21 de painel, chamadas e destino Dropi

O freeze `docs/PANEL_CALL_DROPI_SAFETY_FREEZE_V21_20260817.md` sucede a V20 como candidato ainda nao publicado.

- O funil rapido Tex Ultra continua exclusivamente manual e agora oferece o frasco oficial `/media/sales/ec/tex_ultra.png` com confirmacao humana antes do envio. Quantidade vem antes de cidade; cidade, agencia e nome mantem uma opcao primaria e alternativas recolhidas; nome fica por ultimo.
- O contexto tecnico V16 continua disponivel no backend para auditoria, mas deixa de ser montado na ficha principal. A ficha mostra uma busca inteligente compacta, alimentada somente por mensagens recebidas, que preserva campos preenchidos e exige clique do operador para aplicar dados encontrados.
- Chamadas usam estado persistente por telefone e uma trava unica entre Z-API e Baileys. A politica permite uma tentativa de audio `CLIENTES_QUE_LIGAM`, ignora repeticoes proximas, permite no maximo um texto curto em nova tentativa posterior e ignora as demais durante a janela. `WHATSAPP_CALL_AUTO_REPLY_ENABLED=false` mantem esta automacao desligada por padrao; ativacao operacional exige decisao separada.
- O payload final Dropi passa pelo normalizador oficial `dropiDataNormalizationService`, que cruza cidade, provincia e agencia com o catalogo Servientrega antes de abrir o formulario. A validacao estrita V18 e a autorizacao humana antes do envio permanecem obrigatorias.

Esta camada nao altera precos, ofertas, produto de origem, pixel, Meta/CAPI, scheduler, symlink, PM2, servicos ou producao. Nenhum pedido Dropi ou mensagem real faz parte dos testes da camada.

## Microcamada V22 de abertura Tex Ultra e leitura persistente

O freeze `docs/TEX_ULTRA_ENTRY_UNREAD_FREEZE_V22_20260818.md` sucede a V21 como candidato local nao publicado. A abertura Tex Ultra deixa de tratar os audios de manha e tarde como uma sequencia: envia primeiro um texto com nome validado e periodo calculado em `America/Guayaquil`, depois somente o audio candidato `CONHECER_NECESSIDADES_CLIENTES`, seguido da prova, frasco e oferta ja existentes.

A frase com Ana Lopez e Dra. Maria Fernandes nasceu nesta abertura Tex Ultra. A decisao posterior V23 amplia Ana Lopez para toda nova comunicacao EC. O repositorio nao possui transcricao confiavel do audio candidato; esse risco foi apresentado e a biblioteca ativa recebeu aceite explicito do operador em 2026-08-18.

O POST autenticado de leitura passa a persistir todos os aliases do telefone e o timestamp da ultima entrada visivel. O GET continua somente leitura, e o painel persiste a leitura quando uma conversa aberta recebe nova mensagem. Nenhum preco, pedido, Dropi, Meta/CAPI, scheduler, chamada, PM2 ou producao e alterado por esta camada.

## Microcamada V23 de identidade oficial Ana Lopez

O freeze `docs/EC_ANA_IDENTITY_FREEZE_V23_20260818.md` sucede a V22 como candidato local aprovado para publicacao, ainda nao publicado. Tex Ultra, Nitrix e Vit Power usam `Ana López` em toda nova saida textual: prompts, primeira resposta, follow-ups, acompanhamento logistico, rejeicao de chamada e painel. O nome da persona desativada foi removido do runtime; conversas antigas continuam reconhecidas pela estrutura generica de uma apresentacao, sem conservar o nome anterior no codigo.

Os dois pares MP3/OGG Nitrix explicitamente identificados com a persona anterior foram excluidos do diretorio publico e os jobs antigos os marcam como `legacy_identity_audio_quarantined`, sem envio. O painel usa as iniciais `AL`, pois nao existe foto oficial Ana no repositorio ou na URL publica. TTS fica fail-closed sem `ELEVENLABS_VOICE_ID_ANA_LOPEZ`.

O operador aceitou expressamente a identidade Ana Lopez e os audios ativos em 2026-08-18. O gate local de publicacao foi liberado, mas este registro nao autoriza commit, push, merge, deploy ou mudanca de producao. Esta camada nao altera produto, preco, Dropi, Meta/CAPI, banco, scheduler, transporte, PM2, `current`, servicos ou producao.

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

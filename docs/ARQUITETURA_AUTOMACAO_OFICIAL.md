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

## Microcamada V24 de Comprar depois com data

O freeze `docs/BUY_LATER_DATE_REMINDER_FREEZE_V24_20260818.md` sucede a V23 a partir do commit ativo `bb2d92f65040fc678685358b626c2a4a8a5e9623`, em candidato local ainda nao publicado. Ao selecionar `Comprar depois`, o painel exige a data desejada pelo cliente e grava uma agenda explicita no `ContactState`.

Cada agenda conserva o produto selecionado na ficha (`tex_ultra_ec`, `nitrix_ec` ou `vit_power_ec`) e nao altera a origem VSL. Entre 4 e 3 dias antes da data, em horario do Equador, a camada pode enviar um unico texto nominal de Ana Lopez perguntando se o pedido pode ser preparado para a data combinada. A mensagem nao cria pedido, nao confirma venda, nao abre Dropi, nao envia Meta/CAPI e nao inclui audio ou outra midia.

O envio e fail-closed por `ADMIN_BUY_LATER_FOLLOWUP_ENABLED=false` quando a flag estiver ausente ou desligada. Quando houver ativacao operacional separada, o scheduler exige lock atomico persistido, campo `sentAt`, chave antirrepeticao e consulta do historico antes de qualquer tentativa. Falha de transporte libera o lock, grava `failedAt` sem preencher `sentAt` e nao e repetida automaticamente; trocar data ou produto cria uma nova agenda, enquanto salvar novamente a mesma agenda preserva o comprovante anterior.

## Microcamada V25 de abertura variada e interrupcao Tex Ultra

O freeze `docs/TEX_ULTRA_ENTRY_INTERRUPT_FREEZE_V25_20260818.md` sucede a V24. A frase aprovada da abertura Tex Ultra permanece textual e estruturalmente igual, recebendo apenas um emoji discreto no inicio. O runtime e o painel manual usam o rodizio `👋`, `😊`, `🙂`, `🙏`, `✅`, sem dois itens iguais consecutivos dentro do processo ativo.

A cadencia aprovada permanece inalterada: abertura em 2–6 segundos; audio universal 4–8 segundos depois; prova 21–25 segundos depois; frasco 28–33 segundos depois; oferta 35–40 segundos depois. O total teorico permanece entre 90 e 112 segundos desde a entrada.

Qualquer nova entrada do cliente durante essa cadencia cancela os timers restantes e volta a conferir o cancelamento imediatamente antes de um envio enfileirado. Preco, quantidade e modo de uso recebem a resposta deterministica Tex Ultra correspondente. Outra duvida recebe uma confirmacao curta, entra em `human.mode=manual` e fica marcada como `AGUARDANDO_ATENDIMENTO`; nenhuma midia restante do funil continua automaticamente. A continuidade automatica so ocorre quando o cliente pede explicitamente para continuar.

Esta camada nao altera produtos, precos, audios, imagens, pedidos, Dropi, Meta/CAPI, numero WhatsApp, transporte, scheduler, PM2, `current` ou producao.

O operador autorizou o deploy controlado da V25 em 2026-08-18T14:12:47Z para teste exclusivo no telefone `5515998038637`. A ativacao continua condicionada ao staging oficial, permit root de uso unico, validacao de health e rollback transacional.

## Microcamada V26 de intencao forte Tex Ultra

O freeze `docs/TEX_ULTRA_STRONG_INTENT_FREEZE_V26_20260818.md` sucede a V25 depois do teste visual no telefone `5515998038637`. A frase `Hola, quiero el tratamiento.` passa a ser intencao forte de compra no funil Tex Ultra, coerente com o sinal que o roteador geral ja registrava.

Na primeira entrada, a frase generica da VSL continua iniciando a cadencia oficial. Se o cliente declarar compra durante a cadencia, os timers restantes param e o bot pergunta somente a quantidade `1, 2, 3 ou 6`. Depois da oferta, a mesma intencao pergunta quantidade sem repetir texto de abertura, audio, prova, frasco ou tabela. Quantidade acompanhada de `frasco(s)`/`botella(s)` tem prioridade e segue a coleta deterministica.

Perguntas livres passam ao atendimento humano mesmo depois da cadencia concluida. A confirmacao curta da pausa permanece uma unica tentativa protegida pelo antirrepeticao. Nenhum scheduler, produto, preco, midia, pedido, Dropi, Meta/CAPI, transporte ou numero WhatsApp e alterado.

A autorizacao anterior era especifica para V25 e nao foi reutilizada. Em 2026-08-18T14:38:20Z, o operador autorizou expressamente o deploy controlado da V26 para teste exclusivo no telefone `5515998038637`, mantendo staging oficial, permit root de uso unico, validacao de health e rollback transacional obrigatorios.

## Microcamada V27 de payload multilinha da VSL Tex Ultra

O freeze `docs/TEX_ULTRA_VSL_PAYLOAD_FREEZE_V27_20260818.md` sucede a V26 para aceitar o contrato real da VSL sem alterar a pagina. A primeira linha `Hola, quiero el tratamiento.` pode ser seguida por linhas `Nombre:`, `CIUDAD:` e `PROVINCIA:` na mesma mensagem.

Somente esses tres campos rotulados sao capturados por esta microcamada, e apenas quando a CTA oficial ocupa a primeira linha. O `customerDraft` recebe apenas lacunas: dado ja salvo ou corrigido nunca e sobrescrito. A captura ocorre antes da cadencia, de modo que o nome pode ser usado na saudacao. Depois da quantidade, nome, cidade e provincia ja conhecidos nao sao perguntados novamente; o proximo campo e entrega/endereco.

A V27 nao muda frase, emojis, minutagem, midia, oferta, preco, produto, pedido, Dropi, Meta/CAPI, transporte, scheduler ou numero. A autorizacao de deploy da V26 nao e transferida para o novo artefato; publicacao e ativacao V27 permanecem bloqueadas ate nova autorizacao explicita.

## V28 — resolução profissional de identidade, localização e entrega

O freeze `docs/CUSTOMER_IDENTITY_LOCATION_DELIVERY_FREEZE_V28_20260818.md` sucede a V27 sem alterar a VSL. A extração multilinha continua sendo a fonte inicial, mas nenhum texto não vazio é tratado automaticamente como dado operacional válido.

`src/services/customerDataResolutionService.js` preserva o valor bruto, produz valor canônico separado, registra proveniência/confiança/estado por campo e aplica hierarquia de fontes. Correção humana explicitamente salva e confirmação do cliente recebem locks persistentes. Nome de perfil é somente pista e nunca sobrescreve dado explícito. Concatenação suspeita não recebe espaços inventados; o funil pergunta uma única vez e impede a cadência inicial até a resposta ou revisão humana.

Cidade e província são resolvidas pelo registro EC determinístico derivado do catálogo interno autorizado. Fuzzy só é aceito quando único e acima do limiar; divergência cidade/província vira conflito. Agência operacional só existe quando encontrada em `src/data/agencia_LISTA.json`. Coordenadas ausentes são declaradas como indisponíveis, sem simular proximidade geográfica.

O painel executa preflight de qualidade antes de qualquer escrita de pedido, mostra score/estados/bloqueios e exige modalidade de entrega. O backend do painel, as rotas de pedido e o fechamento Tex Ultra repetem o `ORDER_DATA_READY` gate antes de confirmação ou Purchase. VSL, player, campanhas, Meta/Pixel/CAPI, Z-API, preço, mídia e cadência permanecem preservados.

A V28 é apenas candidato local. Nenhuma autorização de versão anterior é reutilizada; deploy, staging remoto, ativação, PM2, `current` e produção permanecem bloqueados até nova autorização escrita específica.

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

## Microcamada V30 de durabilidade e autenticação de mídia

O freeze `docs/MEDIA_DURABILITY_AUTH_FREEZE_V30_20260821.md` sucede a V29.2 sem alterar funil, produto, preço, Dropi, Meta/CAPI, scheduler, número WhatsApp ou regras de pós-venda. A causa reproduzida no painel era arquitetural: `PANEL_AUTH_DISABLED=false`, mas elementos HTML de áudio e imagem tentavam abrir diretamente o proxy protegido sem poder enviar o Bearer, gerando HTTP 401. Além disso, o cache remoto ficava dentro de cada release e não sobrevivia à próxima ativação.

Para toda nova mídia inbound Z-API, o webhook registra `RECEIVED`, baixa uma única vez, passa por `FETCHING`, valida HTTPS/allowlist, redirects, limite, assinatura, MIME e codec, grava atomicamente na raiz compartilhada `/opt/vitalismen-automacao/shared/media/inbound`, marca `STORED` e somente então libera `READY`. Falhas ficam em `FAILED` com um código explícito e sem novo download automático durante a apresentação do painel.

O `Message` preserva `providerMessageId`, `providerMediaId`, MIME original e armazenado, codec, tamanho, SHA-256, timestamps e diagnóstico. A URL temporária do provedor fica fora da resposta comum do painel. O navegador usa o endpoint autenticado `/api/whatsapp/media/:messageId`, envia Bearer por `fetch` e aplica uma URL `blob:` ao player/imagem; nenhum token é colocado em query string.

Histórico anterior continua usando o proxy autenticado com o mesmo carregamento por Blob. Se a URL antiga já expirou, o painel mostra o motivo em vez de renderizar player ou imagem quebrados. A apresentação V29 continua responsável por unificar registros com o mesmo provider ID: uma mensagem real permanece uma bolha e seus estados `sent/delivered/read` continuam na mesma identidade.

A V30 foi publicada no PR rascunho #17 e recebeu autorização posterior ao relatório em `2026-08-21T18:00:25Z` para ativação controlada. A autorização exige canário de áudio/imagem, proíbe disparos em massa e preserva a Z-API até o WhatsApp Web estar efetivamente conectado; retirada do transporte Z-API continua sendo uma migração separada.

## Microcamada V31 de orientação de uso do Tex Ultra

O freeze `docs/TEX_ULTRA_HOW_TO_USE_AUDIO_FREEZE_V31_20260821.md` sucede a V30 e aprova exclusivamente o áudio `MODO_DE_USO_TEX_ULTRA` para o produto `tex_ultra_ec`. O MP3 fornecido pelo operador é preservado e a cópia OGG/Opus 48 kHz mono é a mídia enviada como nota de voz.

Existem dois gatilhos e uma única chave persistente de antirrepetição: confirmação de retirada/entrega no pós-venda oficial e pergunta determinística de uso (`como se toma`, `como se usa`, `como tomar`, `como usar`, `modo de uso`, `dosis` ou `posologia`). Se qualquer gatilho já tiver enviado o áudio ao telefone, o outro não o reenvia automaticamente. Falha de transporte permanece retentável; arquivo ausente falha fechado e nunca usa áudio de Vit Power ou Nitrix como fallback.

O pós-venda continua em `src/services/shipmentMessageService.js`, sem scheduler paralelo. A pergunta continua no funil isolado `src/services/texUltraFunnelService.js`, com memória em `metadata.perAgentMemory.tex_ultra_ec.howToUseAudio`. Preços, oferta, pedido, Dropi, Meta/CAPI, pixel, número WhatsApp, Z-API, Vit Power e Nitrix permanecem inalterados.

A mídia anexada diretamente a esta tarefa não comprova o elo inbound do provider porque não atravessou o WhatsApp/Z-API. A comprovação V30 continua exigindo uma nova mídia enviada pelo WhatsApp de teste ao número oficial, seguida da conferência de `READY`, arquivo no storage compartilhado e reprodução autenticada no painel. Esse canário é individual e não autoriza disparo em massa.

## Microcamada V32 de telefone oficial e QA de mídia

O freeze `docs/OFFICIAL_WHATSAPP_PHONE_TEST_V32_20260821.md` sucede a V31 e
fixa `5515991418416` como único número oficial de recebimento e saída. A Z-API
continua sendo o transporte oficial. Slots, pool, fallback e configuração ativa
não podem usar outro número brasileiro como origem da operação.

O único telefone brasileiro autorizado para QA é `5515998038637`. Ele é aceito
na entrada Z-API, no envio individual pelo painel/provider e na lista do painel,
mas continua protegido contra pedido, Dropi, Meta/CAPI e disparo em massa.
Overrides públicos adicionais e defaults de failover antigos foram removidos.

O canário V32 permite uma saída individual de áudio e imagem aprovados para o
telefone de QA. A confirmação inbound exige que o operador responda a partir
desse telefone com uma mídia de voz e uma imagem novas; só então podem ser
comprovados provider, `READY`, storage compartilhado e painel autenticado.

## Microcamada V33 de imagem autenticada no painel

O freeze `docs/PANEL_IMAGE_CSP_BLOB_FREEZE_V33_20260821.md` sucede a V32 e
corrige exclusivamente a política de conteúdo do painel. A captura inbound,
persistência `READY` e endpoint autenticado já entregavam JPEG válido, mas a
diretiva `img-src` não permitia a URL `blob:` criada no navegador depois do
`fetch` com Bearer. A diretiva passa a aceitar `blob:` para imagens, assim como
`media-src` já aceitava para áudio e vídeo.

Autenticação, Bearer, endpoint `/api/whatsapp/media/:messageId`, storage
compartilhado, `default-src`, `object-src`, `script-src`, Z-API, números,
clientes, pedidos, Dropi, Meta/CAPI, funil e pós-venda permanecem inalterados.

## Microcamada V34 de origem independente do Protocolo G

O freeze `docs/PROTOCOLO_G_TEX_ULTRA_ORIGIN_FREEZE_V34_20260822.md` sucede a
V33 e fixa a VSL `https://vilaliemen.shop/protocolo-g` como origem de **Tex
Ultra Ecuador**. O nome legado `vitpowers` do asset de Pixel não participa da
seleção comercial e permanece preservado.

O endpoint público reconhece o caminho `/protocolo-g` antes de qualquer chave
legada. A entrada Z-API reconhece tanto a nova primeira linha explícita `Hola,
quiero el tratamiento Tex Ultra.` quanto o payload multilinha legado estrito
com `Nombre`, `CIUDAD` e `PROVINCIA`, sem consultar
`VITALISMEN_ACTIVE_VSL_PRODUCT`. `/n/`, `/m/` e Nitrix mantêm seus contratos
independentes.

A origem fica em `metadata.vslProductKey`/`vslProductName`/`vslProductSource`.
O produto da negociação atual continua em `metadata.productKey` e
`customerDraft.productKey`. Quando o operador salva uma escolha no seletor do
painel, uma `productRouteLock` de fonte `panel_customer_product_selection`
impede cliques ou mensagens posteriores da VSL de sobrescrever essa negociação,
sem apagar a origem histórica.

O bloco V28 `Qualidade dos dados` permanece obrigatório. Ele valida identidade,
telefone, cidade/província e modalidade/endereço/agência antes de permitir
pedido, Dropi ou Purchase; o score visual nunca elimina um bloqueador.

## Microcamada V35 de ingredientes por produto EC

O freeze `docs/EC_PRODUCT_INGREDIENTS_FAQ_FREEZE_V35_20260822.md` sucede a V34
como complemento lateral determinístico. Perguntas por ingredientes,
composição, fórmula ou conteúdo recebem texto em espanhol conforme o produto
atual da ficha.

Tex Ultra usa maca peruana, Tribulus terrestris, catuaba, marapuama, zinco e
magnésio. Nitrix Oxide usa feno-grego, Tribulus terrestris, ginseng Panax,
ashwagandha, Ginkgo biloba e L-arginina. Vit Power preserva borojó, chontaduro,
noni, L-arginina, maca, guaraná e vitaminas.

A camada não troca produto por texto livre. Uma pergunta que nomeia produto
diferente da ficha não recebe fórmula automática. Memória, lock e cooldown são
persistidos por `productKey`; falha de transporte não marca envio. Condição de
saúde ou medicamento continua sob segurança médica/atendimento humano.

Preço, oferta, cadência, áudio, imagem, pedido, Dropi, Meta/CAPI, pixel, Z-API,
número, scheduler, pós-venda, PM2 e origem da VSL permanecem inalterados.

## Microcamada V36 de lista consolidada de ingredientes EC

O freeze `docs/EC_ALL_PRODUCTS_INGREDIENTS_FREEZE_V36_20260822.md` sucede a
V35. Quando o cliente pedir todos os produtos, comparar fórmulas ou citar pelo
menos dois produtos, o bot pode enviar uma única mensagem com três seções
claramente identificadas: Tex Ultra, Nitrix Oxide e Vit Power.

A V36 não transforma as três fórmulas em uma só. Cada seção conserva os
ingredientes registrados na V35, e a própria mensagem explica que as fórmulas
são diferentes e não devem ser confundidas. Perguntas de um único produto
continuam usando somente sua resposta individual.

A lista consolidada exige ficha EC ativa, não muda o produto atual, não
reescreve a origem VSL e não altera a etapa do funil. Usa memória, lock,
cooldown e anti-spam próprios para não colidir com a resposta individual.

Preço, oferta, cadência, mídia, pedido, Dropi, Meta/CAPI, pixel, transporte,
scheduler, pós-venda e PM2 permanecem inalterados.

## Microcamada V37 de status Z-API após autenticação

O freeze `docs/PANEL_ZAPI_AUTH_STATUS_FREEZE_V37_20260822.md` sucede a V36 e
corrige um falso alerta visual do painel. A instância Z-API oficial permanecia
conectada, mas `public/qr.html` consultava `/api/zapi/status` antes de terminar
o bootstrap de autenticação. Sem Bearer, o `401` correto era exibido ao
operador como `No token provided`.

A V37 mantém a rota sensível autenticada e faz o frontend retornar antes da
consulta quando não há token. O bootstrap começa pela autenticação; logout e
sessão expirada limpam o falso erro e mostram estado neutro `SEM LOGIN`. Uma
leitura Z-API só ocorre depois que o painel possui sessão válida.

Credenciais, Z-API, número oficial, funil, mídia, pedidos, Dropi, Meta/CAPI,
scheduler, pós-venda, banco, PM2 e storage inbound permanecem inalterados.

## Microcamada V38 de portabilidade do teste de caminho inbound

O freeze `docs/INBOUND_MEDIA_PATH_PORTABILITY_FREEZE_V38_20260822.md` sucede a
V37 e corrige somente a expectativa multiplataforma do teste de armazenamento
inbound. O serviço oficial permanece byte a byte igual ao contrato V30.

No Linux, a raiz de releases `/opt/vitalismen-automacao/` continua apontando
para o storage compartilhado. No Windows, caminhos e separadores locais são
comparados com `path.resolve()` e `path.join()`, sem fingir que o runtime atual
é a VPS Linux e sem pular o teste.

A ativação transacional da V38 foi autorizada em `2026-08-22T14:27:24Z`, com
commit, PR, tag imutável, staging, permit root de uso único, rollback preservado
e validação obrigatória de `current`, PM2, health e domínio. Funil, preço,
mídia, pedido, Dropi, Meta/CAPI, Z-API, número, scheduler, pós-venda e banco
permanecem inalterados.

## Microcamada V39 de produto direto, nome e anti-reenvio pós-venda

O freeze `docs/EC_DIRECT_PRODUCT_NAME_POSTSALE_FREEZE_V39_20260822.md` sucede
a V38. A composição ocorre antes das barreiras isoladas dos produtos, mas
somente para uma consulta direta explicitamente reconhecida. A camada não
substitui nem reordena os funis de VSL.

`src/services/ecDirectProductInquiryService.js` mantém memória, lock, histórico
e deduplicação próprios. Uma entrada fora da VSL recebe informação do produto
pedido e, quando perguntar preço, começa pela tabela normal. A tabela
promocional só fica disponível após objeção explícita de preço ou pedido de
desconto/valor mais baixo. Se dois produtos forem citados, a camada pede uma
escolha antes de responder.

`src/routes/zapi.js` deixa de classificar uma citação direta simples como prova
de origem VSL, registra um nome de perfil válido na ficha vazia e libera essa
consulta específica sem desativar um atendimento humano existente.
`src/services/agentRouter.js` conserva o modo humano enquanto permite somente
a microresposta direta. Uma seleção manual divergente e `metadata.vslProduct*`
continuam soberanos e imutáveis.

O painel prioriza nome de pedido, ficha e perfil, mostra nome e telefone no
`#activeMeta` e continua sem texto de mensagem na lista esquerda.

O pós-venda confirmado conserva os áudios
`AGRADECIMENTO_AGENCIA_DE_ENTREGA` e `BONUS_RETIRADA`. Além de `sentAt`, lock e
deduplicação, `src/services/texUltraConfirmedPostSaleLayerService.js` consulta
explicitamente o histórico por mensagem/mídia antes de tentar enviar. Nenhum
áudio já registrado pode ser repetido.

Checkout, pedido, Dropi, Meta/CAPI, pixel, número, transporte, mídias de produto,
ordem dos funis, scheduler e operações fora do Equador permanecem preservados.

## Microcamada V40 de fila interna de relacionamento EC

O freeze `docs/EC_ENGAGEMENT_INTERNAL_BUCKET_FREEZE_V40_20260822.md` sucede a
V39. `AQUECIMENTO` passa a ser somente o rótulo visual de um bucket interno do
mesmo atendimento Vitalismen. Nenhum projeto externo de aquecimento é ligado,
consultado, copiado ou integrado.

Cada contato continua único e recebe uma das filas `ATENDIMENTO`, `AQUECIMENTO`,
`PEDIDOS` ou `REVISAR`. Pedido/suporte, intenção comercial, risco e opt-out têm
prioridade sobre relacionamento. `#AQUECE`, `#NAOAQUECE` e `#RISCO` continuam
internos e nunca são enviados ao cliente.

A camada não inicia conversa. Uma resposta local só pode nascer de nova entrada
voluntária, exige elegibilidade, lock persistente, histórico, cooldown e teto
diário. Emoji, mídia, sticker, link simples e reação isolada não geram resposta.
O classificador e os templates usam zero chamadas de modelo e custo de IA zero.

Produto, preço, origem VSL, checkout, pedido, Dropi, Meta/CAPI, pixel, Z-API,
número oficial, funis, mídias, pós-venda, scheduler e PM2 permanecem inalterados.

## Microcamada V42 de comando e resposta local do AQUECIMENTO EC

O freeze `docs/EC_ENGAGEMENT_COMMAND_REPLY_FREEZE_V42_20260822.md` sucede a V41
e corrige a apresentação da fila interna V40. O painel passa a confiar primeiro
no `conversationBucket` projetado pelo backend. Um identificador administrativo
histórico `EC-ADMIN-*`, sem `Order` ou `Shipment` real, não transforma mais um
contato manualmente aprovado em `PEDIDOS`. Obrigações operacionais reais continuam
projetadas como `orders` pelo backend e permanecem soberanas.

`#AQUECE`, `#AQUECE#` e `/AQUECE` são aliases internos equivalentes, nunca
enviados ao cliente. As tags de auditoria continuam persistidas, mas rótulos
visuais idênticos são consolidados em uma única etiqueta `AQUECE`.

Somente contatos aprovados manualmente para `AQUECIMENTO` recebem a extensão de
resposta passiva V42. Nova entrada voluntária sem pergunta — saudação curta,
`gracias`, emoji, mídia, sticker ou link isolado — pode receber uma confirmação
local curta e sem pergunta. A camada não abre link, não analisa mídia, não
transcreve áudio e não chama modelo de IA. Debounce, atividade humana recente,
cooldown, teto diário, lock, histórico e antirrepetição da V40 permanecem
obrigatórios.

Intenção comercial, suporte, risco e opt-out continuam bloqueando essa resposta e
movendo a conversa para a fila prioritária adequada. Produtos, preços, origem VSL,
checkout, pedido, Dropi, Meta/CAPI, pixel, Z-API, número oficial, funis, mídias,
pós-venda e scheduler permanecem inalterados.

## Microcamada V43 de prioridade e confirmação local do AQUECIMENTO EC

O freeze `docs/EC_ENGAGEMENT_PRIORITY_FREEZE_V43_20260822.md` sucede a V42.
`Tudo` passa a ser o filtro principal de mensagens ao abrir o painel. Os demais
filtros são aplicados somente após clique do operador.

Conversas do bucket `engagement` deixam de compor o contador e o filtro
`Novas`. Suas não lidas são exibidas em selo próprio no botão `AQUECIMENTO`,
mantendo a prioridade comercial separada sem esconder a atividade social.

Contatos aprovados manualmente por `#aquece` acumulam um contador persistente e
recebem somente `👍` depois de lotes alternados de duas e três entradas
voluntárias. O envio confirmado zera o lote e muda o próximo alvo entre 2 e 3.
A decisão é determinística, local, sem prompt, sem chamada de modelo e sem custo
de IA.

Produto, preço, pedido, suporte, risco e opt-out permanecem prioritários e
retiram o contato do caminho passivo antes de qualquer `👍`. Debounce, atividade
humana recente, cooldown, teto diário, lock, histórico, deduplicação e ausência
de retry automático continuam obrigatórios. Produtos, ofertas, origem VSL,
checkout, Dropi, Meta/CAPI, pixel, Z-API, número oficial, mídias, pós-venda,
scheduler e PM2 permanecem inalterados.

## Microcamada V44 de fila global de novas mensagens comerciais EC

O freeze `docs/PANEL_GLOBAL_NEW_MESSAGES_FREEZE_V44_20260822.md` sucede a V43 e
corrige a divergência entre o contador `Novas` e a lista renderizada. Ao clicar
em `Novas`, o painel deixa temporariamente de aplicar a fila operacional ativa e
mostra todas as conversas comerciais novas de `ATENDIMENTO`, `PEDIDOS` e
`REVISAR`, usando exatamente o mesmo predicado do contador.

`AQUECIMENTO` continua excluído de `Novas` e conserva seu selo próprio de não
lidas. A visão global não destaca uma fila operacional; ao retornar a `Tudo`,
`ATENDIMENTO` é restaurado se nenhuma fila tiver sido escolhida. A busca V41 e a
regra de não renderizar texto de mensagem na coluna esquerda permanecem intactas.

A alteração é somente visual e local ao navegador. Produtos, ofertas, funis,
checkout, pedidos, Dropi, Meta/CAPI, pixel, Z-API, número oficial, mídias,
pós-venda, banco, scheduler e PM2 permanecem inalterados.

## Microcamada V45 de recompra após entrega EC

O freeze `docs/EC_DELIVERED_REPURCHASE_FREEZE_V45_20260822.md` sucede a V44 e
corrige a tentativa de confirmar uma nova venda para cliente cujo Shipment já
está entregue, mas cujo `Order` antigo ainda aparece com status não terminal.

O Shipment entregue passa a projetar o pedido anterior como histórico no
painel. Ao selecionar `Confirmar pedido`, a ação autenticada exige o mesmo
telefone e evidência de entrega, preserva o pedido anterior e cria um novo
`EC-RECOMPRA-*` com `previousOrderId`, `previousDeliveredAt` e motivo explícito
de recompra. O lead único pode voltar para `confirmado` somente por esse novo
ciclo. A confirmação continua gerando o Purchase próprio da venda nova, mas não
autoriza nem envia automaticamente para Dropi.

A fila V44 permanece inalterada: `AQUECIMENTO` só fica fora de `Novas` enquanto
o bucket for `engagement`. Intenção comercial e pedido novo têm prioridade e
devem aparecer nas filas comerciais.

## Microcamada V46 de preservação da recompra ao salvar a ficha EC

O freeze `docs/EC_REPURCHASE_SYNC_PRESERVATION_FREEZE_V46_20260822.md` sucede a
V45. O salvamento da ficha reconhece uma ordem já criada com
`entryReason=repeat_purchase_after_delivered` e conserva `previousOrderId`,
`previousDeliveredAt`, o motivo de entrada e as notas de auditoria.

Assim, o sincronizador administrativo mantém a prova necessária para permitir o
novo ciclo `confirmado` depois de `entregue`. A ordem existente e seu Purchase
são reaproveitados; nenhum pedido, evento, Shipment, autorização ou submissão
Dropi adicional é criado. A separação V44 entre `Novas` e `AQUECIMENTO` continua
inalterada.

## Microcamada V47 de serialização SQLite da recompra EC

O freeze `docs/EC_REPURCHASE_SQLITE_SERIALIZATION_FREEZE_V47_20260822.md`
sucede a V46. O campo interno `repurchase_cycle` passa a ser serializado como
inteiro `1/0`, compatível com o script Python que atualiza o SQLite do painel
administrativo. A regra funcional não muda: somente a ordem com vínculo de
entrega preservado pode iniciar o novo ciclo `confirmado`.

Nenhuma ordem, Shipment ou Purchase é recriado. Dropi continua manual e a fila
global `Novas` permanece sem contatos do bucket `AQUECIMENTO`.

## Microcamada V49 de recuperação da indisponibilidade WhatsApp EC

O freeze `docs/WHATSAPP_OUTAGE_RECOVERY_FREEZE_V49_20260823.md` sucede a V48.
O transporte oficial continua sendo a Z-API, mas o health deixa de considerar
o sistema pronto quando há um erro persistido de assinatura posterior à última
saída bem-sucedida. A consulta é somente leitura e não envia canário.

Durante uma etapa comercial ativa `awaiting_*` ou `sdr_awaiting_*`, texto útil
do cliente permanece em `ATENDIMENTO` e chega ao funil determinístico. Handoff,
pausa e etapas terminais continuam bloqueadas. A correção não renova assinatura,
não repete mensagens históricas e não cria pedidos ou autorizações Dropi.

## Microcamada V50 de persistência da edição manual no painel EC

O freeze `docs/PANEL_MANUAL_EDIT_PERSISTENCE_FREEZE_V50_20260823.md` sucede a
V49. A ficha captura o contato, a revisão de edição e os campos marcados como
correção humana antes de iniciar o salvamento. Recargas periódicas preservam o
rascunho enquanto o operador está editando, e respostas assíncronas antigas não
podem reaplicar valores anteriores nem atingir outro cliente.

Os salvamentos são serializados e continuam usando as rotas autenticadas V28.
Nome digitado ou aplicado por uma ação aceita pelo operador permanece com
prioridade `human_correction`, `corrected_by_human=true` e lock persistente. A
camada não envia WhatsApp, não altera pedido, Dropi, Meta/CAPI, produto, preço,
VSL, funil, mídia, scheduler ou PM2.

## Microcamada V51 de isolamento da ficha selecionada no painel EC

O freeze `docs/PANEL_CUSTOMER_SELECTION_ISOLATION_FREEZE_V51_20260824.md`
sucede a V50. Cada seleção de conversa recebe uma geração própria, vinculada ao
`chatId` e ao `ContactState`. A troca de cliente invalida buscas de agência,
autosalvamentos e respostas assíncronas da ficha anterior antes de hidratar os
novos campos.

A fila de salvamento volta a validar essa geração quando a operação realmente
começa. Uma agência automática que já está aplicada deixa de produzir novo
autosalvamento, encerrando o ciclo de `resolve-customer-data` e `PATCH`.

Nome, cidade, província, endereço, agência, quantidade e status continuam com as
mesmas regras V28/V50. A camada não envia WhatsApp e não altera bot, produto,
preço, VSL, funil, mídia, pedido, Dropi, Meta/CAPI, banco ou scheduler.

## Microcamada V52 de persistência do áudio e mídia manual no painel EC

O freeze `docs/PANEL_MEDIA_PERSISTENCE_FREEZE_V52_20260824.md` sucede a V51.
O envio manual deixa de classificar todo arquivo que contenha `agencia` ou
`retir` como aviso de pedido pronto para retirada. Somente os áudios de etapa
logística real `Chegou_01`, `Chegou_02`, `Chegou_03` e equivalentes técnicos
explícitos continuam submetidos ao bloqueio `READY_FOR_PICKUP` verificado.

`Agradecimento_Agencia_01`, `AGRADECIMENTO_AGENCIA_DE_ENTREGA`,
`BONUS_RETIRADA` e os áudios comerciais de endereço, modalidade e segurança de
agência continuam aprovados em suas etapas originais e não são confundidos com
aviso de retirada. A proteção contra avisar retirada antes da hora permanece
fechada para os três áudios `Chegou_*`.

Áudio e mídia disparados pela biblioteca manual passam a enviar um
`clientGeneratedId`, confirmar a mesma bolha com o registro persistido e manter
na tela um estado `sem confirmação` quando a API rejeitar a tentativa. A camada
não realiza disparo de validação, não muda automação, pedido, Dropi, Meta/CAPI,
produto, preço, VSL, scheduler, Z-API ou número oficial.

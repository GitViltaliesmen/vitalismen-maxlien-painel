# Plano de execução — Principal SDR Freeflow e preservação V218

PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL
Data: 15/11/2026. Status: levantamento concluído; baseline congelado documentalmente; plano para a próxima microcamada, sem aplicar comportamento novo nesta revisão.

## Decisão

A melhor base existente é **Principal SDR Freeflow V212**, já instalada e operacional no release8993d2a. O nome procurado corresponde a principalSdrFreeflowService.js e principalSdrFreeflowRuntimeService.js, usados pela conversationEngine.js.

O prompt já manda responder à pergunta concreta antes de retomar a negociação, usar memória e não impor roteiro. Há dez ferramentas estritas, catálogo oficial, captura de dados com citação da mensagem atual, resumo e confirmação verificável antes de registrar pedido. O runtime utiliza ContactState/Message/Order/OutboundDedupe existentes, identidade exata do inbound e lease do roteador. Não é necessário criar outro bot, número, banco ou integração.

## Comparação dos caminhos encontrados na origem oficial

| Caminho | Papel atual / limite | Decisão |
|---|---|---|
| Principal SDR Freeflow V212 | Agente generativo, memória persistida, catálogo e finalizador existentes; políticas/estoque ainda retornam indisponível | Evoluir este caminho |
| B01 V216 | Saudação e quatro mídias com pausa; interrompe ao cliente responder e em comando humano | Preservar como apresentação genérica; não usar como roteiro de perguntas |
| Handlers determinísticos da engine | Intenções negativas, dados de pedido, quantidade, respostas oficiais e fechamento | Preservar suas garantias; ajustar somente a prioridade da pergunta quando aplicável |
| aiRouter.js | Caminho anterior com quatro ferramentas; createOrderNote retorna saved:true, mas o arquivo contém TODO sem persistência | Não promover ou religar |
| openaiService.js | Adaptador de geração de texto mais antigo, com instruções e marcadores de mídia | Não substituir o runtime atual por esse caminho |
| agentRouter.js | Transporte de turnos, locks e encaminhamento | Reutilizar a infraestrutura |

Não foram usados projetos externos, cópias antigas ou automações paralelas como referência. A inspeção foi da fonte current na VPS e da documentação oficial correspondente.

## Achados que delimitam o trabalho

1. B01 já diferencia entrada genérica de pergunta específica. Nova entrada durante o bloco interrompe os itens pendentes. Isso deve permanecer e receber teste de regressão.
2. Na engine, handlers de pergunta direta sobre produto e de composição rodam antes do Freeflow. É necessário verificar a decisão por intenção/pergunta, evitando que um handler genérico substitua o conjunto de dúvidas do cliente por uma apresentação ou tabela.
3. No runtime, policy e stock retornam explicitamente ok:false/unavailable:true. Hoje a consequência correta é transferência humana, e não invenção de condição comercial. Conectar fontes oficiais é trabalho distinto de mudar o prompt.
4. A KB antiga é insuficiente como fonte automática geral: policies.md tem três linhas genéricas, e product_ec.md contém brindes que não serão promovidos a ofertas aprovadas por simples cópia. Preço continua vindo do catálogo em uso. Não criar garantia, prazo ou estoque a partir desses textos.
5. O agente já limita a execução a cinco rodadas, dez chamadas de ferramentas e cerca de25s por turno. Manter os limites e a credencial/modelo atuais; validar comportamento sob indisponibilidade.
6. O congelamento é documental e versionado. Não para serviços, muda permissões de produção, bloqueia clientes ou congela gravações do banco.

## Preservação obrigatória

- Backend ativo8993d2af3e110ecfc2deb04c9eff58ac6fd36c6e, B01 e suas pausas18–30s, saudação por horário EC e primeiro nome opcional separado do nome completo.
- Painel V218/commit605c29a2253946a9d770814174be2d9660832414: Comprar depois com confirmação explícita, ano automático editável e datas existentes preservadas.
- CTA/sitebb1160bc2dcaca5b36ce8ee44c6d0f0151259706: mensagem sem referência técnica visível, formulário opcional, player e timing aprovados.
- Sessão Z-API, número oficial, catálogo/preços, filtros EC, QA8637 permanente e suas janelas, estados humanos, memória e pedidos existentes.
- Travas contra repetição, reserva antes do envio e ausência de retry automático quando o resultado é incerto.
- Resumo/consentimento do cliente antes de pedido; QA sem pedidos reais, Dropi ou eventos Meta.
- Pós-venda, recompra, Dropi, Pixel/CAPI e demais produtos sem mudanças nesta microcamada.

## Fase 1 — prioridade conversacional mínima

Objetivo: cliente que pergunta fora da ordem recebe a resposta da pergunta, sem refazer infraestrutura.

Ordem de decisão proposta:

1. Aplicar identidade/país, opt-out, humano no comando, pedido protegido, deduplicação e lock.
2. Capturar dados novos e intenção forte pelos validadores existentes. Formulário estruturado continua determinístico; IA não interpreta o formulário como autorização de pedido.
3. Se houver pergunta concreta, responder às perguntas na ordem em que aparecem, consultando fontes oficiais. Se vier quantidade + dúvida, salvar quantidade e responder à dúvida antes de solicitar o próximo dado. Uma dúvida não apaga o que já foi capturado.
4. Encaminhar ao Freeflow quando houver conversa livre elegível; priorizar ferramentas/respostas verificadas, preservando handlers determinísticos necessários.
5. Só depois perguntar um dado realmente faltante ou oferecer continuidade. Não avançar de etapa por conta própria.
6. Para entrada genérica sem pergunta, manter a saudação/B01. Se o cliente interromper, parar mídias pendentes e atender a pergunta; não reiniciar o bloco.

Alterações esperadas: pequeno ponto de decisão na engine e ajustes focados do núcleo/runtime/testes. Sem refatoração da engine inteira, migração de schema ou scheduler novo. Reutilizar a memória por cliente/produto e os ledgers atuais.

## Fase 2 — fontes comerciais verificadas

- Mapear fatos comerciais para uma fonte oficial com produto, versão/data e escopo. Reutilizar leitores existentes; não criar promessa comercial.
- Preços: manter getEcuadorOffer e seus totais oficiais.
- Pagamento/entrega/garantia: fornecer somente o que tiver evidência comercial aprovada. Ambiguidade ou ausência continua no humano.
- Estoque: somente leitura identificável por produto, com data/validade e tratamento de erro. Sem saldo verificável, responder que precisa confirmar e transferir. Não usar silêncio do sistema como disponível.
- Não alterar o finalizador de pedidos nem iniciar envio Dropi como efeito de uma consulta.

A existência de um texto antigo no repositório não basta para declarar que a condição continua aprovada.

## Fase 3 — critérios de aceite e testes

Matriz mínima, com origem real do código e fixtures isoladas:

- Preço antes do nome; entrega antes do preço; cidade e quantidade em uma mensagem.
- Duas ou três perguntas no mesmo texto: respostas na mesma ordem, sem ignorar as demais.
- Cliente muda de assunto e retoma; dados conhecidos não são solicitados novamente.
- Correção de cidade/quantidade preserva os demais campos e a origem VSL.
- Pergunta durante cada pausa B01 cancela mídias ainda não enviadas e produz só a resposta aplicável.
- Formulário completo, quantidade isolada e confirmação seguem os validadores oficiais.
- Garantia/estoque/pagamento sem fonte não geram promessa; transferência humana persistida.
- Timeout, quota/API indisponível e chamada de ferramenta inválida resultam em falha explícita/encaminhamento, sem repetição automática.
- Duplo webhook, concorrência, reinício e retry não geram duas respostas ou pedidos.
- Humano, opt-out, pedido ativo e outros produtos conservam seus bloqueios.
- Regressão do formulário/nome, Comprar depois, ano automático, CTA e painel.

Executar testes focados, npm run senior:check, auditoria de produto EC e controles exigidos pelo sucessor selado. Guard rejeitado não vira PASS e não é desabilitado. Testes de mensagens e pedidos usam rede/banco descartáveis; nada sintético é vendido, enviado ao Dropi ou contabilizado na Meta.

Depois, QA real somente8637, em janela delimitada e sem pedido: perguntas fora de ordem, memória e interrupção B01. Recibo do provedor, espelho no painel e recebimento no WhatsApp são provas diferentes. A prova física depende de uma nova mensagem real; não pode ser substituída por injeção de webhook.

## Fase 4 — publicação e rollback

Preparar um release sucessor exato do baseline atual, com diff permitido, aprovação dos guards, configuração protegida e recibos. Validar primeiro a nova capacidade no escopo QA, mantendo o atendimento existente dos demais contatos. Promover somente o comportamento qualificado para novos turnos Vit Power EC elegíveis; não liberar atendimentos humanos antigos em lote.

Conferir current, PM2 pm_cwd/pm_exec_path e cwd real do processo, health e Z-API, além de uma nova entrada observada. Caso a troca de release exija reinício do processo, fazer uma única troca controlada e verificar a fila; não prometer zero interrupção física antes dessa validação.

Rollback do novo comportamento deve retornar ao **baseline V216 atual**, preservando a interface V218 e a CTA atual quando não alteradas. Não voltar ao SDR antigo removendo B01, restaurar banco, reabrir pedidos ou repetir mensagens.

## Estimativa de tempo

São faixas de trabalho técnico, não uma promessa de horário exato:

| Entrega | Trabalho estimado | Condição |
|---|---:|---|
| Prioridade de perguntas sobre a base atual | 30–50min | Ajuste local e testes focados, sem refazer engine |
| Regressão, controles e qualificação | 30–50min | Suíte completa anterior levou cerca de11min; reservar revisão e correções |
| Publicação controlada e verificação QA | 30–50min | Somente após PASS; tempo da mensagem/resposta física pode acrescentar espera |
| **Entrega mínima funcional qualificada** | **90–150min** | Mantém encaminhamento humano para fatos comerciais indisponíveis |
| Fontes comerciais verificadas, cenários adicionais e auditoria ampliada | +90–150min | Depende de fontes oficiais existentes e acessíveis |
| **Entrega completa prevista** | **3–5h** | Inclui ferramentas conectadas quando houver fonte; não inclui espera externa |

Se faltar política aprovada, acesso à fonte de estoque ou prova física WhatsApp, concluir as partes independentes e registrar o bloqueio específico. Não inventar informação nem prometer término integral dentro da faixa sem esses requisitos.

A fundação conversacional já funciona hoje. A estimativa é para melhorar a prioridade e qualificar o conjunto, não para criar um bot novo.

## Congelamento e limites publicados

Manifesto: docs/freeze/vitalismen-ec-atendimento-baseline-v218-20261115.json. Cópias estáticas e fontes verificadas fora do Git em C:/Users/Wolfe/Backups/VITALISMEN_EC/FREEZE_ATENDIMENTO/20261115T1800Z/. O manifesto registra hashes, permissões/metadados dos arquivos públicos, commits das três fontes e identidade do processo.

A coincidência entre Git e produção foi verificada para o núcleo, painel e CTA; as tags correspondentes já existem no Git oficial. O plano e o manifesto recebem publicação própria, sem merge de alterações locais não relacionadas e sem deploy/restart do bot durante este levantamento.

STATUS_BACKUP_GLOBAL=FAIL permanece por consistência não comprovada do MongoDB standalone. Este congelamento é de código/arquivos estáticos e estado operacional seguro; não é backup restaurável integral de banco nem resolve a lacuna de atribuição e o callback sem gravação descritos em docs/REVISAO_PERCURSO_VSL_BOT_20261115_1406.md. Esses problemas não serão ocultados sob a entrega conversacional.

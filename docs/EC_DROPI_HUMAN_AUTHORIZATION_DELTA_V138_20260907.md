# Delta V138 — envio Dropi somente por ação explícita do operador

Estado: candidata não publicada, posterior a 0efea9b594cebacb9d2d8bd0d078f33f89151afb. A instrução do operador de 2026-09-07 exige novo commit/tree/staging e a expressão APROVADO PARA PUBLICAR antes de qualquer ativação. A candidata anterior não é mais publicável para esta missão.

## Fonte oficial, escopo e backup

Produção permanece no commit c542ef91bbf8865c9263b97b12389e07da1949ce, tree ef154efa92ccb14d03818f2b9c5f85f2d5beb835, release /opt/vitalismen-automacao/releases/20260906T001014Z_production-20260906-c542ef9, VPS Hostinger 72.60.137.77.

Os seis arquivos funcionais deste delta foram lidos e tiveram identidade conferida com a versão oficial antes do patch. A adaptação do guard V101 também foi comparada com o arquivo oficial. Backup antes do staging: /opt/vitalismen-automacao/backups/ec-human-dropi-prestage-20260907T145748Z/official-source-before.tar.gz, SHA256 1f5dd053716dd68de0423d178f4734846b9cbd510bd21a2e5c3a3fbbf2d0d0f8. Conteúdo verificado por tar; inclui HTML, rotas, importador, transporte, integração V78, guard V101, loader, guard V129 e metadados.

Arquivos de Atendimento/Aquecimento, Novas, read state e métricas continuam idênticos à candidata anterior: public/qr.html, src/routes/whatsapp.js, public/funnel-metrics.html, src/routes/funnelMetrics.js e src/services/protocoloGCommercialMetricsService.js. Nenhuma alteração em ofertas, produtos, VSL, funil, áudios, WhatsApp, Meta/CAPI, schema ou configuração operacional.

## Regra e implementação

READY é calculado a partir dos dados canônicos: país EC, confirmação comercial, nome completo, telefone EC, endereço/cidade/província, produto explícito, quantidade e valor de uma oferta oficial, modalidade válida, agência validada quando aplicável e resolução de dados completa. Zero explícito nunca usa o package.id antigo como fallback.

AUTHORIZED reutiliza automation.dropiSubmitAuthorizedAt/By. O middleware posterior à autenticação só carrega contexto humano nas rotas individuais authorize-submit e submit, para administrador ativo autenticado. O transporte exige também o contexto da ação submit do mesmo pedido; uma autorização persistida anterior não autoriza execução de scheduler. A fila existente preserva o contexto da requisição.

O backend valida antes de criar a remessa manual e novamente após obter o lock e reler Order/Shipment. Falha na leitura ou registro ausente bloqueia o envio. Produto, catálogo, cotação e lookup de duplicação do transporte existente permanecem ativos. SENT continua sendo persistido somente após retorno confirmado do provedor. Idempotência, reconciliação de timeout ambíguo e status sync são preservados.

O importador de confirmados continua criando/atualizando Order comercial quando permitido pelo modo operacional; deixou de criar Shipment. Espelhos existentes continuam atualizáveis. O painel exige seleção explícita: o botão fica desabilitado sem pedidos marcados e não usa mais todos os visíveis como fallback. Salvar ficha/produto recalcula readiness; não marca checkbox, autoriza ou envia.

O comando existente mantém suas duas etapas: quando falta autorização, autoriza após confirmação humana e exige outro clique para enviar. Não foi criado outro mecanismo de envio.

## Matriz dos call sites

PODE_CHAMAR_DROPI abaixo significa CRIAR novo pedido no provedor. Consultas de status estão discriminadas na última coluna. A varredura incluiu src, scripts, ops, imports, criação de Shipment, gravação de autorização, fila, despacho, cron e webhook.

| CALL_SITE | ORIGEM | BOT? | WEBHOOK? | SCHEDULER? | PAINEL? | OPERADOR? | PODE_CHAMAR_DROPI? | Efeito e trava |
|---|---|---|---|---|---|---|---|---|
| routes/shipments: authorize-submit | rota individual | Não | Não | Não | Sim | Obrigatório | Não | Valida; prepara Shipment manual e persiste autorização existente |
| routes/shipments: submit → enqueueDropiSubmitJob | rota individual/fila existente | Não | Não | Não | Sim | Obrigatório | Sim | V78 + autenticação + V138 + autorização + readiness + duplicação |
| services/droppiEcuadorBrowserService: submitDroppiEcuadorOrder → submitOrderInPanel → submitOrderViaDropiApi | transporte único | Bloqueado | Bloqueado | Bloqueado | Sim | Obrigatório | Somente contexto humano do pedido | Revalida antes/depois do lock; POST BFF único; ID antes de SENT |
| routes/shipments: dispatch/run | despachante legado em lote | Não | Não | Potencial legado | Sim | Não fornece contexto individual | Não | Bloqueado por V78 e, independentemente, pelo guard do transporte V138 |
| routes/shipments: requeue-dropi-submit | ação legada manual | Não | Não | Não | Sim | Manual | Não | V78 bloqueia rota; não chama provedor; selo antigo não satisfaz V138 |
| schedulerService → adminPanelImportService: importConfirmedAdminPanelOrders → ensureShipmentMirror | importação de lead confirmado | Possível origem dos dados | Possível origem dos dados | Sim | Não | Não | Não | Order comercial preservado; se não houver Shipment, retorna sem criar |
| routes/shipments: ensureShipmentForOrder | preparação local | Não | Não | Não | Sim | Rotas manuais | Não | Upsert local após validação nas rotas autorizadas; legadas continuam bloqueadas por V78 |
| routes/shipments: criação local, manual-link, prepare-manual, revisão/reenvio e guia manual | ações locais existentes | Não | Não | Não | Sim | Manual | Não | Persistência local; não importam/chamam criação BFF fora do transporte guardado |
| droppiEcuadorImportService: importDroppiEcuadorText → upsertDroppiEcuadorShipment | importação manual de registros do provedor | Não | Não | Não | Sim | Manual | Não | Espelha pedido já existente; não cria pedido no provedor |
| droppiEcuadorBrowserService: syncActiveDroppiEcuadorOrdersFromPanel | consulta/reconciliação | Não | Não | Sim | Sim | Não é autorização | Não | REPORT_ONLY preservado; APPLY só espelha linha existente no provedor |
| droppiEcuadorBrowserService: syncDroppiEcuadorFromPanel / syncDroppiEcuadorInvoiceForShipment | status/fatura de remessa existente | Não | Não | Possível | Sim | Não é autorização | Não | Consultas e atualizações preservadas; nenhuma chamada de create |
| conversationEngine: syncShipmentFromDropiPhoneLookup | reconciliação inbound | Sim | Indireto | Não | Não | Não | Não | Exige Shipment local e uma única correspondência de pedido existente no provedor |
| droppiEcuadorService: upsertDroppiEcuadorShipment | primitiva local | Via chamadas acima | Via chamadas acima | Via chamadas acima | Via chamadas acima | Conforme origem | Não | Não contém HTTP create; dois usos são preparação manual e espelho de pedido já existente |
| scripts/fix-returning-buyer-repurchase.mjs | reparo pontual local | Não | Não | Não | Não | Execução explícita | Não | Cria registro local de reparo; não é cron nem chama criação Dropi |
| systemd V114 / V116 | observação e pós-venda | Não | Não | Sim | Não | Não | Não | V114 somente leitura; V116 notificações de remessas existentes, dropiMode REPORT_ONLY/dropiApply false |
| orders, bot, funil e webhook de atendimento | ficha comercial | Sim | Sim | Conforme fluxo | Possível | Não autoriza logística | Não | Sem call site de submit/create Dropi |

Resultado: os dois chamadores do transporte foram identificados (fila individual e despachante legado). O único POST de criação está dentro da cadeia privada do transporte. O caminho automático de criação de Shipment no importador foi removido. Os serviços legados push-dropi-orders.service e sync-dropi-ec.service não estão instalados/ativos na captura. Não foi observado envio automático real em produção; o modo V78 já continha bloqueios, reforçados estruturalmente por este delta.

## Lead 3501

Leitura nativa MongoDB e SQLite mode=ro às 2026-09-07T14:55:51Z: status confirmado, quantidade 0, valor 0, modalidade vazia, productKey tex_ultra_ec, orderDataReady false, bloqueio DELIVERY_MODE_REQUIRED. Order EC-ADMIN-3501 e Shipment não existem. Nenhum dado foi preenchido por suposição.

Fluxo normal: abrir Completar dados, informar dados verdadeiros e modalidade/agência quando aplicável, salvar a ficha, selecionar oferta oficial no comando Produto e preço e salvar. A resposta de flags recalcula readiness e a tabela é renderizada pelo refresh normal já executado ao salvar. Quando completa, a seleção é habilitada e permanece desmarcada. O operador marca e executa o comando de envio existente.

## Validação e limites

- Suíte V138: 12 testes, incluindo A/B/F para três produtos, autorização/contexto, fluxo real de rotas/fila com POST mock único, repetição, dados alterados depois do lock, falha de banco, importador, seleção explícita e prontidão após completar dados.
- Regressão ampliada: 155/155, zero falhas/skipped, incluindo isolamento, leitura/refresh/background, três produtos, catálogo, transporte, duplicação, status sync e métricas.
- npm test: 773 testes, zero falhas; senior:check incluído (500 testes) e SENIOR-GUARD OK.
- Lint: 806 arquivos, PASS.
- O teste V60 de cotação tinha uma expectativa antiga já falhando em 0efea9b: procurava a implementação dentro de buildTexUltraBffQuote. Foi atualizado para verificar a delegação para buildEcuadorProductBffQuote e o perfil oficial do depósito Tex Ultra. As mesmas exigências de catálogo, cotação, cidade/província e contrato foram mantidas. Não houve mudança funcional nessa cotação.
- Manifests ancestrais não foram regravados. V138 protege os arquivos do delta; os guards V129/V137 e a identidade V101 reconhecem o sucessor validado.
- Nenhuma chamada Dropi real, mensagem WhatsApp, escrita em dados de clientes ou ativação foi usada como teste.
- A indisponibilidade histórica da consulta fast=0 em produção continua documentada no relatório anterior. Regressão de background/read state foi testada isoladamente; não se declara corrigido esse tempo de resposta.
- O resultado do staging, commit/tree e comparação final de produção serão registrados na evidência privada da missão e no relatório final ao operador. Este documento não autoriza publicar.

## Rollback

Antes da aprovação, não há ativação para reverter. Current e PM2 devem permanecer no release c542ef9 acima. Após eventual publicação autorizada, rollback deve usar o fluxo oficial para esse release preservado, validando pm2 jlist, readlink -f current, pm_cwd/pm_exec_path e /proc/PID/cwd, seguido de health/Z-API/Nginx/Mongo. Não substituir pelo antigo origin/production, cujo commit não representa esta baseline.

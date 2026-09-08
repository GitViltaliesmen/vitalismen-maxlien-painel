# V145 — saúde operacional e histórico CAPI

Base: V144 `c68163e1013782e013456baeba65538770a7c220`, tree `495d32f9547a9ebd223fcdf035ae62881049fdc6`.
Produção oficial: `/opt/vitalismen-automacao/current`, VPS Equador `72.60.137.77`.
Estado: candidata; ativação e publicação não autorizadas.

## Provas e causa

O gate inicial confirmou release, commit, tree, recibo SHA-256
`1960d20a032668fd62d11a097b8b97a596784d5eec9e61d0b79d333dcc2db413` e payload funcional
`d024dedf3a75a43c640e358d326a2c8a6701eb757ee06e73e0d9be3194f70198`.
PM2 resolve `current`; Mongo, Nginx, Z-API e `/api/health` responderam corretamente.

O agregador V141 calcula Z-API com `totals.zapiInbound > 0 ? 'OK' : 'DEGRADED'`.
Esse total depende dos contatos que ingressaram na janela selecionada. `dataThrough`
também se limita às mensagens desses contatos. Nenhum status do provider, fila real
ou erro operacional participa dessa fórmula. A UI renderiza `Até -` para ausência.

A fórmula CAPI V141 é `max(0, purchaseEligible - purchaseSent)`. O item `1` nos
filtros de 3 e 7 dias é o Order `EC-ADMIN-3501`, ID Mongo `6a9ee3f355d6e058e8f4653d`.
Foi criado em `2026-09-07T16:18:59.967Z`, confirmado nesse instante e enviado ao
Dropi em `2026-09-07T17:59:49.571Z`. Não há evento Purchase, resposta Meta ou
marcador de envio. Não existe registro de fila CAPI separado para esse `1`.
Retry count e contagem histórica de chamadas Meta não são persistidos nesse Order;
ausência de resposta não comprova zero chamadas históricas.

No escopo EC global há seis elegíveis sem Purchase enviado, todos com timestamp
Dropi anterior à V144: `EC-ADMIN-1888`, `EC-ADMIN-1895`, `EC-ADMIN-2100`,
`EC-ADMIN-3501`, `EC-ADMIN-3503`, `EC-ADMIN-3504`. Fila operacional ativa: zero.
Os três últimos permanecem com Order, Shipment e tracking intactos.
O último Purchase com aceite persistido é de `2026-09-02T21:52:33.551Z`.

A consulta direta GET Z-API `/status` e `/me` respondeu HTTP 200, conexão true,
callbacks em `https://ec.maxlien.shop/api/zapi/webhook`, pagamento PAID.
Fonte da semântica somente leitura: https://developer.z-api.io/instance/me.
Último inbound observado: `2026-09-08T12:36:25.285Z`; último outbound observado:
`2026-09-08T14:41:23.970Z`; callback entregue em `2026-09-08T14:41:25.633Z`.
Log Nginx: último webhook observado `2026-09-08T14:52:06Z`, HTTP 200; houve dois
502 às `03:47:53Z`, antes da V144. Não houve erro outbound persistido nas últimas
24 horas. O último erro histórico é timeout em `2026-08-24T03:02:17.021Z`.

Meta account e insights GET responderam HTTP 200. Cache atualizado às
`2026-09-08T14:49:36.766Z`, sem stale; timer ativo, último serviço com exit 0.
A auditoria não executou refresh com escrita: leu o cache e fez GETs diretamente.

## Microcamada

Somente `src/routes/funnelMetrics.js` e `public/funnel-metrics.html` são alterados
entre os arquivos operacionais preexistentes. A fixture V138 recebe a dependência
Purchase V144 que faltava em sua VM, com sender e persistência exclusivamente
simulados; as asserções anteriores permanecem. Novos serviços calculam saúde global por evidência
independente dos filtros. O agregador V141, seus totais e regras de coorte ficam
preservados. A projeção do Order passa a incluir event ID e os marcadores de
atribuição que o agregador já consulta; valores não persistidos não são inferidos.

O modelo expõe `healthStatus`, `providerConnected`, `lastSuccessAt`, `lastError`,
`queueDepth`, separados de `selectedWindow`, `eventCountInWindow`,
`lastEventInWindow`, `dataThroughInWindow`. Ausência na janela recebe
`NO_DATA_IN_WINDOW`, sem rebaixar o provider. Todas as integrações exibem sucesso,
data da janela, fila e erro separadamente.

Z-API usa status GET, callbacks oficiais e evidência persistida de inbound/ACK.
A fila é a mesma fila em memória usada pelo health oficial, com limite 50.
Erros recentes usam 15 minutos fixos, fora do filtro, e sucesso posterior resolve
falha de transporte; bloqueio de assinatura persiste até sucesso posterior.
Nenhum webhook sintético é enviado. Essa leitura confirma configuração e evidência
de entrega; não fabrica prova de callback durante períodos sem tráfego.

CAPI histórico exige envio Dropi persistido anterior à ativação do release V144
(`2026-09-08T06:13:58Z`). A data de criação do Order sozinha não prova histórico.
Timestamp ausente ou pendência posterior fica visível para diagnóstico. Pedido
aguardando ação humana Dropi aparece separadamente. `retryable` é classificação
diagnóstica; `retryAuthorized=false` em todos os itens. Não há consumidor, retry,
scheduler, envio ou alteração de política. V78, payload inválido, rede e falta de
aceite Meta mantêm causas distintas e degradam saúde quando exigem atenção.

## Contratos preservados e validação

Todos os arquivos protegidos pelo manifesto V144 continuam byte a byte iguais,
inclusive sender, Shipment, guard, bootstrap, package e testes V144. Nenhum
arquivo VSL, checkout, produto, preço, bot, routing, Z-API, webhook ou banco muda.
O hash público VSL informado foi confirmado com leitura explicitamente autorizada
de `https://vilaliemen.shop/protocolo-g`; `/n/` é outro artefato e não foi alterado.

O guard V145 valida seus próprios hashes e concede somente os dois overrides
operacionais e o arquivo de fixture acima à cadeia ancestral; depois executa integralmente o guard V144. Para testes
e qualquer futura revisão de ativação é obrigatório o preload explícito
`--import ./scripts/lib/ec-runtime-successor-v145-context.mjs`. A candidata não
altera o bootstrap congelado V144. Não iniciar `src/index.js` sem esse preload.

Testes novos cobrem provider sem eventos, provider desconectado, webhook sem
evidência, fila e erro operacional, história sem retry, nova pendência, timestamps
ausentes, duplicidade de Shipment, filtros Hoje/3/7/custom, invariantes e zero envio.
As suites ancestrais são executadas com dependências próprias na worktree. A
primeira execução do senior antes de instalar dependências locais falhou somente
na resolução de `libsignal`; a instalação segue `package-lock.json` intacto.
O senior exige uma `.env` local de observação sem credenciais. O validador
`scripts/validate-integration-health-v145.mjs` mantém as rotas mockadas no contexto
de biblioteca, com sinais operacionais vazios somente nos processos de teste;
isso evita que o import legado de áudio carregue a política de observação da
fixture e transforme as respostas esperadas em no-ops 202. Não há flags de
produção copiadas ou alteradas. Comandos: `node scripts/validate-integration-health-v145.mjs`
com argumento `focused`, `test` ou `senior`.

## Rollback

Como a V145 não será ativada, produção permanece na V144. Descartar a candidata
não exige ação em PM2, banco, Nginx ou providers. Uma futura publicação depende
de aprovação humana e de validar novamente a identidade congelada da produção.

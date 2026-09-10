# V147-R4 — candidato, publicação pendente

Base: b73cabb745508c4be1b56703a03dc74620d1b678, tree 51c596f96c0c72096d311ee4da5a00b63d897ad2.

O executor V116 passa a chamar processCarrierStatusSweep antes do dispatch existente.
O flock do executor permanece responsável por serializar ciclos. A seleção e aquisição
atômica do lock persistido automation.dispatchLockedUntil repetem o critério de cadência.
O intervalo usa SHIPMENT_CARRIER_STATUS_SWEEP_INTERVAL_MINUTES, fallback canônico de
60 minutos, respeitando também o mínimo preexistente de 50 minutos. lastCheckedAt é
persistido pelo serviço de tracking já existente, inclusive em falhas do provider.

Somente shipments EC ativos da Servientrega entram nessa chamada. Estados terminais
históricos são excluídos. O watermark vem de activatedAt no recibo oficial
.activation-complete.json da release; sua ausência impede execução mutável. No primeiro
DELIVERED observado sem evidência forward, as supressões existentes de P5/P6/P7 são
persistidas antes do lifecycle. Uma observação anterior válida não terminal posterior
ao watermark ou uma data de movimento explícita com timezone posterior ao watermark
comprova forward. READY atual conserva a elegibilidade e os locks/dedupe de V147-R3.

O polling reutiliza trackCarrierGuide, normalizador V147, saveCarrierTrackingResult e
applyShipmentLifecycleStatus. Provider inválido/UNKNOWN não altera estado; falhas do
provider ficam por item, e falhas de persistência/infraestrutura encerram o ciclo.
Não há chamadas de envio no polling nem alteração no motor de mensagens, templates,
regras de conclusão, scheduler global, systemd, Meta, VSL, Dropi ou transporte.

Na passagem para dispatch, a decisão existente é consultada antes da atualização de
provider para evitar consultas repetidas de eventos já suprimidos. Eventos elegíveis
continuam sendo revalidados ao vivo. Uma falha dessa consulta bloqueia A07; o limite de
refresh nunca autoriza enviar uma fila READY sem revalidação. A projeção Servientrega
obtida nessa fase não é sobrescrita pela projeção Dropi do dispatcher. Esses ajustes
existem somente na chamada do V116 após o polling e não mudam a operação manual Dropi.
Após uma falha transitória, a evidência canônica válida persistida também pode provar
a cronologia forward. Erros de validação do documento ficam por item; falhas globais
de persistência continuam propagadas.

Identidades sem Shipment continuam usando a reconciliação canônica V140 já existente,
com vínculo exato por telefone/cliente/pedido/Dropi/guia. A reconciliação do alvo em
produção depende da publicação aprovada; staging usa dados e transporte isolados.

Os hashes ancestrais permanecem nos respectivos manifestos. O bootstrap R4 valida
todos os hashes novos antes de autorizar somente os arquivos desta microcamada.
Os guards antigos continuam validando suas regras e arquivos sem alteração autorizada.
Tooling instalado, recibos e runtime attestation não fazem parte deste diff.
O guard funcional V146 reconhece hashes dos manifestos sucessores cujo preload
validou a identidade; seus manifestos e regras originais permanecem obrigatórios.
Essa compatibilidade também cobre a ordem dos imports sequenciais no bootstrap.

Publicação, troca de current e ativação exigem aprovação da identidade congelada.
Nenhum resultado de teste ou staging deve ser considerado aprovado antes dos logs
e recibos externos correspondentes. Rollback funcional: voltar à identidade R3
preservando os registros persistidos de dedupe e supressão histórica.

O ensaio SINK usa Mongo e SQLite exclusivos e intercepta somente I/O do provider,
transporte e caminho do painel. Executa o script V116 real, as funções canônicas de
reconciliação/lifecycle e os envios/ledgers existentes. O watermark de teste é uma
fixture; atrasos de mídia são acelerados somente no ensaio. Inclui retomada sem
duplicação, fila READY obsoleta, lock Mongo concorrente e 123 terminais excluídos.

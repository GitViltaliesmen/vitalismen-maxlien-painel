# V128 — produto da ficha no pedido administrativo Dropi EC

A autorização Dropi materializava EC-ADMIN a partir de notas do SQLite. Uma
ficha confirmada salva pelas camadas V122–V125 podia ter produto explícito,
agência e validação no ContactState, mas nenhum marcador de produto no SQLite.
Assim, o pedido criado perdia o produto escolhido e era bloqueado.

A ponte V128 consulta a ficha do mesmo telefone somente ao criar um novo pedido
administrativo. Preserva a oferta do lead e exige igualdade com quantidade,
valor, nome e destino da ficha. Exige produto explícito, dados validados,
confirmação e agência identificada quando aplicável. Copia produto, catálogo,
entrega e validação para o pedido, mantendo origem VSL separada. Divergências
retornam erro antes de salvar o pedido. Um marcador DROPI_PRODUCT já configurado
continua no caminho anterior.

O endpoint de flags de Leads Clientes projeta o mesmo produto validado em
leitura, permitindo que o selo e o botão existentes reconheçam a ficha antes
da criação do pedido. A consulta é agrupada por telefone; dados internos do
snapshot SQLite são removidos da resposta. Não há gravação no GET.

O hook funcional fica em src/routes/shipments.js; a regra está isolada em
src/services/ecAdminDropiDraftBridgeV128Service.js. A cadeia sucessora declara
somente os arquivos alterados e verifica os hashes herdados. Nenhuma mudança
no motor de conversa, preços, transporte Dropi, WhatsApp, Meta, scheduler,
autorização individual ou proteção de duplicidade.

Casos de produção auditados: leads 3494 (Vit Power, 3 frascos, USD 95.99) e
3464 (Tex Ultra, 1 frasco, USD 35.99). Ambos tinham ficha validada, status
confirmado, nenhum Order/Shipment e submit-status authorization_required.

Fonte oficial: /opt/vitalismen-automacao/current na VPS EC 72.60.137.77.
Baseline ativo: /opt/vitalismen-automacao/releases/20260904T180145Z_production-20260904-bc71c0e.
Os hashes de shipments.js, droppiEcuadorBrowserService.js, dropiBffAdapter.js e
leads-window.html foram comparados com a fonte local antes da edição.

Validação exigida: testes V128, regressões de autorização/multiproduto, guard de
produto EC e senior:check com o preload sucessor oficial. O comando senior
sem preload falha no mesmo hash herdado V47 tanto local quanto em produção;
o contexto sucessor V97 é necessário para avaliar a cadeia atual.

Publicação: release imutável pelo helper oficial, preservando ambiente atual,
com backup do baseline e conferência do CWD real do PM2 e health público.
Resultado operacional e backup serão registrados em documento separado.
Rollback: retornar ao baseline acima com o helper oficial; não apagar pedidos
ou autorizações legítimas que tenham sido criados após a publicação.

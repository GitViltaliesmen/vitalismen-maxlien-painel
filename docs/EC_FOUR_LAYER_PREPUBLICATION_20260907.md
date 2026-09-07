# Vitalismen EC — candidata de quatro microcamadas, 7 de setembro de 2026

Estado: candidata, sem autorização de publicação. A decisão do operador exige concluir os testes e o staging, e aguardar a expressão "APROVADO PARA PUBLICAR". Este documento não declara freeze operacional final.

## Fonte oficial e snapshot

- Produção: https://ec.maxlien.shop/qr.html; VPS Hostinger 72.60.137.77.
- Current literal/real: /opt/vitalismen-automacao/releases/20260906T001014Z_production-20260906-c542ef9.
- Commit: c542ef91bbf8865c9263b97b12389e07da1949ce. Tree: ef154efa92ccb14d03818f2b9c5f85f2d5beb835. Tag declarada no release-source: production-20260906-c542ef9.
- PM2: vitalismen-automation, PID 3832658, online, 212 reinícios; pm_cwd e pm_exec_path usam current; /proc/PID/cwd resolve o release acima.
- Snapshot inicial de metadados, serviços e hashes: evidência privada .audit/baseline-production.json na worktree desta missão.
- Backup de arquivos oficiais antes do staging: /opt/vitalismen-automacao/backups/ec-four-layer-prestage-20260907T141953Z/official-source-before.tar.gz.
- SHA256 do backup: a8381b2c99744b895da84106d6a69cab8ce8d90c3a9381f494ced1d31a6a986c. Conteúdo listado e arquivo verificado por tar. Não é um dump dos bancos; nenhum dado de negócio será migrado nesta candidata.
- Arquivos oficiais lidos no VPS antes do patch: public/qr.html, public/leads-window.html, public/funnel-metrics.html e respectivas rotas/serviços. Alterações somente em worktree originada no commit ativo.

## Atendimento, Aquecimento e Novas

Falha reproduzida na produção, sem selecionar cliente: a busca textual V131 ultrapassava o limite do bucket engagement. O filtro Novas também era ignorado durante busca. A lista lateral renderizava a frase de entrada VSL, contrariando a regra permanente de não mostrar mensagens.

V135 mantém a busca entre filas comerciais e aplica o limite de Aquecimento inclusive na busca. Novas aplica seu predicado com ou sem busca. Remove somente a renderização da frase VSL na lista lateral. A rota dashboard-metrics passa a calcular os períodos comerciais com commercialContacts, já existente.

A camada persistente de leitura V129 já estava funcional; não foi reescrita. Testes cobrem recarga, sincronização completa/background, marcas persistidas, atribuição humana, nova entrada e preservação da conversa B. Teste de navegador isolado: atendimento contém A, aquecimento contém B, busca por B não o mostra em atendimento, leitura de A limpa apenas A, reload preserva, nova entrada simulada reabre A em Novas. Texto aparece no centro e zero previews na lista.

## Dropi: matriz canônica, sem correção de dados reais

Leitura via MongoDB nativo e SQLite mode=ro, sem salvar, confirmar, enviar ou consultar transporte externo. Havia dois leads com status comercial confirmado. Ambos carecem dos requisitos do fluxo canônico, e nenhum possuía Order materializado.

| Lead | Resultado da função resolveEcAdminDropiDraftBridgeV128 | Evidência persistida |
| --- | --- | --- |
| EC-ADMIN-3501 | ready=false; admin_dropi_draft_offer_mismatch | quantidade 0 no SQLite e no customerDraft, total 0/vazio, modalidade de entrega vazia e orderDataReady=false/DELIVERY_MODE_REQUIRED. Origem Tex Ultra válida não substitui quantidade, oferta nem entrega. |
| EC-ADMIN-3397 | ready=false; admin_dropi_draft_confirmation_required | quantidade 1/valor 35.99 existem, mas falta a confirmação atual da ficha exigida pelo bridge e a seleção explícita da oferta Dropi. |

A avaliação canônica acima prevalece sobre a triagem preliminar por campos genéricos. Status comercial confirmado na V125 não equivale a pedido completo: essa camada preserva intencionalmente o status sem materializar pedidos incompletos. Não foi comprovada perda de persistência pelo código atual; portanto não houve patch no Dropi nem preenchimento presumido. O fluxo autenticado V129 de configuração, salvamento e confirmação da oferta continua sendo o caminho aplicável quando o operador obtiver os dados verdadeiros.

Regressão específica: 83 testes passaram, incluindo Tex Ultra, Nitrix, Vit Power, dados incompletos, seleção persistente, transporte simulado, deduplicação e sincronização. Nenhum envio real ao Dropi ou cliente.

## Protocolo-G e métricas

Origem externa explicitamente autorizada: https://vilaliemen.shop/protocolo-g, VPS Contabo via alias vilaliemen-protocolo-g. Arquivos oficiais somente lidos: /opt/cloaker/private/vsl/protocolo-g.html; /opt/cloaker/public/assets/js/meta-ec-protocolo-g-bridge.js; /opt/cloaker/routes/metaEcProtocoloGBridge.js.

O pipeline já encaminha bridge/stage para https://ec.maxlien.shop/api/whatsapp/vsl-entry e /vsl-stage. A VSL, as URLs, a oferta, o telefone, pixels, Meta/CAPI, criativos e campanhas não foram alterados. O health público é /api/health/; a variante sem barra retorna 301.

V136 acrescenta leitura de ContactState e Shipment à rota existente /api/funnel-metrics e completa a tabela existente "Por anúncio". Vinculação usa vslVisitId, visitorKey/attributionVisitorKey e IDs explícitos de pedido. Não usa telefone ou nome para atribuição. Exclui Aquecimento/QA e relações ambíguas; conflitos ou ausência de anúncio viram SEM_ATRIBUICAO. Pedidos sem prova da própria origem Protocolo-G ficam fora do recorte, com quantidade exibida na cobertura.

Os dados representam pedidos criados no período e seu status canônico atual, não datas de transição reconstruídas. Inbound é quantidade de contatos com entrada, não volume de mensagens. Valor de pedidos não significa receita recebida. Purchase só é contado quando há marca persistida de envio; nenhum evento é criado. A origem pode permanecer Protocolo-G após troca manual de produto.

O capturador existente fornece ad_id/campaign_id/adset_id; creative_id não foi encontrado e não é inventado. A interface identifica explicitamente esse limite. Na leitura real de sete dias, o agregado anterior retornou 1532 landing, 19 formulários enviados, 1 clique WhatsApp, 0 conversas e 0 pedidos atribuídos ao Protocolo-G. Isso limita conclusões históricas: a candidata não faz backfill nem recupera identificadores que nunca foram capturados.

## Validação e limites

- Senior check da baseline local e da produção: PASS com o contexto sucessor oficial scripts/lib/ec-runtime-successor-v97-context.mjs. /root/wa_wpp também passou sem religar flags antigas.
- 138 testes direcionados finais: PASS, zero falhas, zero skipped. Log privado candidate-four-layer-regression.log.
- Guard de produto EC: PASS. Lint final após V137: 803 arquivos PASS.
- O primeiro teste geral revelou uma asserção V41 que exigia ignorar Novas na busca. V137 atualiza exclusivamente essa asserção e o teste correspondente ao comportamento V135 autorizado. Os demais testes e as verificações de hash permanecem. O sucessor V137 tem manifesto próprio; manifestos anteriores permanecem intactos.
- npm test final após V137: PASS, 773 testes somados nas suítes (incluindo 500 do senior check), zero falhas e senior guard OK. Executar staging na candidata exata. Logs das tentativas, inclusive falhas, ficam preservados em .audit; não são tratados como PASS.
- O navegador foi validado com os HTMLs reais da candidata e API de fixtures somente em 127.0.0.1:3187, com saídas externas bloqueadas. Persistência real de banco é coberta pelos testes de serviço/rota; não houve teste artificial em cliente real.
- Consulta real fast=1 do painel respondeu 200. Uma consulta fast=0 excedeu 60 segundos; não afirmar que a sincronização completa real passou. As simulações de sincronização e persistência passaram.
- Z-API oficial configurada/conectada; health 200, MongoDB e Nginx ativos. Não houve mensagem de teste, alteração de flags, restart, ativação nem reclassificação de clientes.

## Publicação e rollback

Staging deve usar exclusivamente /usr/local/sbin/vitalismen-stage stage com ref, commit, tree e release exatos. SHA256 do helper instalado, do helper no release ativo e do arquivo versionado: 803481d66f89b235e3d1451050dfe3d64764389f14aa6596bba65cf381e18f99. Não executar publicação, ativação nem mover current antes da aprovação.

A referência e o resultado efetivo do staging serão entregues no relatório pré-publicação e conservados nas evidências da missão. Ao aprovar, verificar novamente commit/tree e baseline antes de qualquer ação.

Rollback: nenhuma reversão operacional é necessária enquanto a candidata não for ativada. O release ativo c542ef9 permanece disponível e íntegro. Após publicação autorizada, eventual retorno deve usar o mecanismo oficial documentado para aquele release e apenas o processo vitalismen-automation, validando pm_cwd, pm_exec_path, /proc/PID/cwd, health e Z-API. Sem downgrade de banco, restore de clientes, limpeza de histórico ou rollback global. O backup acima permite comparação/restauração pontual, não autoriza editar release publicada.

# EC V129 — revisão de produto Dropi e atendimento persistente

Estado: candidata isolada. Publicação proibida até a aprovação literal
`APROVADO PARA PUBLICAR`. Esta documentação não declara freeze operacional.

## Baseline realmente ativa no início

- `CURRENT_LITERAL=/opt/vitalismen-automacao/releases/20260904T223442Z_production-20260904-40f9ddb`
- `CURRENT_REALPATH` e `ACTIVE_RELEASE`: mesmo caminho.
- `ACTIVE_COMMIT=40f9ddba7d00eec59fa1c322f684092d1a8c0560`
- `ACTIVE_TREE=ec1bdfef66b8a86e52bbd1bcd700de80eeeb5024`
- `ACTIVE_TAG=production-20260904-40f9ddb`
- Tag de freeze separada: não identificada nas referências locais; não inventada.
  Consulta das tags remotas confirmou somente `production-20260904-40f9ddb`
  para esse commit.
- Fonte: `.release-source.json`, `.activation-complete.json`, hashes dos arquivos
  oficiais e `/proc/3699183/cwd`. PM2 `vitalismen-automation`, PID 3699183,
  `pm_cwd=/opt/vitalismen-automacao/current`, execução `current/src/index.js`.
- Contexto efetivo: `EC_BOT_CORE_OPERATIONAL`, automação operacional aprovada,
  Z-API oficial conectada. O marcador histórico de ativação descreve observação;
  o health e o ambiente efetivo do processo confirmam o modo atual.
- Nginx e Mongo ativos; health local porta 3001 HTTP 200. Porta 3000 não é
  a porta do serviço e recusou conexão na primeira sondagem.
- `senior:check`: PASS local/VPS com o preload sucessor oficial V97. Sem preload,
  o comando local falha no hash ancestral V47 da CI; falha anterior à missão.
- `/root/wa_wpp`: senior guard PASS, sem mudança de flags ou código.

Worktree criada a partir dessa baseline em `.codex-worktrees/v129-dropi-handled`,
branch `codex/ec-dropi-handled-v129-20260904`. A candidata V126 foi consultada
somente como diff de read-state; seus demais módulos não foram incorporados.

## Evidência A — produto Dropi

A V128 já está ativa. Em leitura, os endpoints oficiais retornaram:

| Lead | Produto explicitamente persistido na ficha | Oferta | Estado Dropi |
| --- | --- | --- | --- |
| 3494 | `vit_power_ec`, escolha manual registrada | 3 frascos, USD 95.99 | `authorization_required`, sem Order criado |
| 3464 | `tex_ultra_ec`, escolha manual registrada | 1 frasco, USD 35.99 | `authorization_required`, sem Order criado |
| 3435 | `tex_ultra_ec`, Order `EC-MT6LDRMJ-2MM4` existente | 1 frasco, USD 35.99 | somente referência, sem envio |

As flags dos leads 3494/3464 já incluem `productSelection`. Os valores acima
vêm da escolha salva pelo operador, não de inferência pelo preço. A antiga
ausência de produto no SQLite é coberta pela ponte V128. O catálogo público
autenticado lista os três produtos com `dropiEnabled=true`.

Falhas residuais reproduzidas na baseline:

1. O guard V78 retorna HTTP 423 para o handler existente
   `POST /api/shipments/droppi/ec/admin-leads/:leadId/configure-order`.
2. O botão de salvar chama `submitLeadToDropi` logo após configurar o pedido.
3. O seletor usa `mes/meses`, contrariando a nomenclatura de frascos.

Elegibilidade visual já depende de pedido completo e produto explícito,
sem depender do vínculo Meta. Não há correção Meta a aplicar.

Mapeamentos V120/V121 preservados: Tex Ultra 110681/1261/802, Nitrix
105825/1544/802 e Vit Power 103743/1261/802 (produto/depósito/origem).

## Evidência B — atendimento

Angel foi auditado somente por leitura, sem enviar ou apagar mensagens.
Na captura, o último inbound foi às 23:04:05 UTC e o áudio humano entregue
às 23:07:44 UTC em 2026-09-04. O texto e o áudio estavam `isFromMe=true`,
`senderRole=human`. Ecos existentes mantinham `providerPayload.fromMe=true`
na mesma mensagem lógica. Não foi comprovada inversão de direção.

Os GETs rápido e completo retornaram `unreadCount=9`, `unansweredCount=0`,
mesmo mostrando o áudio outbound como última mensagem. O marcador de leitura
estava em 2026-09-02, mas `human.lastManualAt` e `lastOutboundAt` já estavam
persistidos na data do atendimento.

Falhas reproduzidas:

1. `POST /api/whatsapp/chats/read` retorna HTTP 423 no guard operacional,
   impedindo persistência do clique de leitura.
2. Unread desconsidera o marcador humano persistido.
3. Unanswered desconsidera leitura humana e, no caminho rápido, usa somente
   outbounds presentes na janela das últimas 700 mensagens.

A correção reutiliza `panelLastReadAt`, `panelLastReadMessageTimestamp`,
`human.lastManualAt` e `lastOutboundAt`. Como capturas e handoffs automáticos
também escrevem `lastManualAt`, esse campo só vale como atendimento quando há
operador atribuído e `lastManualBy` coincide com `assignedName`. Captura Z-API,
encaminhamento automático para humano e resposta do bot não avançam leitura
humana. A semântica anterior de resposta do bot para unanswered é preservada.
GET continua sem escrita; nenhum histórico, timestamp antigo, pedido,
shipment ou ID do provider é alterado.

## Escopo e verificação

As duas microcamadas possuem testes e manifestos próprios:
`ec-dropi-selection-v129a` e `ec-conversation-handled-v129b`. O contexto
sucessor valida hashes antes de permitir overrides ancestrais. Manifestos
anteriores não são regravados.

Os testes usam fixtures e mocks; não usam clientes reais nem criam Dropi,
Meta ou mensagens. O teste QA real fica para depois da publicação aprovada,
somente em `5515998038637`, mantendo NO_ORDER/NO_DROPI/NO_META_PURCHASE.

Arquivos funcionais A:

- `public/leads-window.html`: salvar sem iniciar envio; texto de frascos.
- `src/services/ecManualDropiReleaseV119Service.js`: decisão sucessora V129
  permite exclusivamente configurar produto em um lead numérico; o contrato
  público V119 continua limitado às duas rotas originais.
- `src/services/ecBotCoreRuntimeIntegrationV78Service.js`: usa essa decisão
  sucessora no mesmo contexto manual Dropi. Efeito externo só em `submit`.

Arquivos funcionais B:

- `src/services/ecPanelCustomerPersistenceV122Service.js`: permite o endpoint
  exato de leitura com a restrição existente de escrita apenas em ContactState.
- `src/services/panelReadStateService.js`: máximo dos marcadores persistidos.
- `src/routes/whatsapp.js`: usa o mesmo handled-through nos dois GETs.
- `public/qr.html`: após confirmação do salvamento da leitura, limpa ambos
  os indicadores locais da conversa selecionada e seus aliases.

Guard comum de carregamento: `scripts/lib/ec-runtime-successor-v97-context.mjs`.
Diff funcional A: 18 linhas adicionadas e 7 removidas em três arquivos.
Diff funcional B: 35 adicionadas e 5 removidas em quatro arquivos.
O carregamento comum acrescenta seis linhas; total existente: 59/12.

Testes novos: `tests/ec-dropi-selection-v129a.test.mjs`,
`tests/ec-dropi-transport-regression-v129a.test.mjs` e
`tests/ec-conversation-handled-v129b.test.mjs`.
Guards novos: `scripts/guard-ec-dropi-selection-v129a.mjs` e
`scripts/guard-ec-conversation-handled-v129b.mjs`.
Documentação: este relatório e os manifestos de integridade da candidata em
`docs/freeze/ec-dropi-selection-v129a.json` e
`docs/freeze/ec-conversation-handled-v129b.json`. Esses manifestos não declaram
freeze de produção nem substituem a validação operacional após aprovação.

Nenhum arquivo de V114/V116, VSL, preço, oferta, catálogo, checkout, transporte
Dropi, parser Z-API, Meta ou scheduler mudou.

Validações adicionais já concluídas:

- Baseline: `npm test` 758/758; senior 497/497; regressão dirigida 135/135.
- Candidata final: `npm test` 758/758, sem falhas ou skips, incluindo
  `senior:check` 497/497 e resultado final `SENIOR-GUARD OK`. Execução com
  `NODE_OPTIONS=--import=./scripts/lib/ec-runtime-successor-v97-context.mjs`.
- Candidata final: regressão dirigida 156/156 (135 anteriores + 21 novos).
- Transporte: 9 dos testes novos usam o pipeline e a fila reais carregados em VM,
  dependências externas substituídas por mocks. Cobrem os três produtos,
  consulta antes do POST, ID confirmado em fixture, duplicidade, timeout e fila.
- Lint final: 784 arquivos, `LINT_JS_SYNTAX=OK`. Scripts inline dos dois HTMLs
  compilados sem erro. `git diff --check` e os guards próprios A/B e de produto
  EC também passaram.
- Chrome headless: página real com todas as requisições interceptadas. Uma
  conversa renderizada sem preview, `.chat-preview .meta=0`, clique seleciona
  contato, bolha no centro e retorno do POST de leitura zera os dois contadores.
- API oficial somente leitura: 200 conversas, zero broadcast/grupo/LID sem
  telefone. `https://ec.maxlien.shop/api/health` HTTP 200, `online`, WhatsApp ready.
- Produtos sem token pela URL pública: HTTP 401; autenticação preservada.

Tentativas de validação corrigidas, sem ocultar falhas:

- Primeira ampliação direta da decisão V119 conflitou com um teste ancestral;
  foi substituída por decisão sucessora. O teste original permaneceu intacto.
- Worktree sem `node_modules` local não resolvia o caminho interno de libsignal;
  a junction aponta para as dependências da pasta oficial, sem trocar versões.
- Worktree sem `.env` falhou no senior por ausência das flags locais; recebeu
  cópia do `.env` local oficial, ignorada pelo Git. Nenhum ambiente de produção
  foi modificado. A execução completa foi repetida e passou nessa configuração.
- O primeiro fixture de browser inseria IDs técnicos diretamente no estado,
  contornando a filtragem da API. O renderer confia nesse contrato. A filtragem
  foi verificada na API oficial e nos testes herdados; o smoke de UI usa a
  resposta válida do backend. Não se alterou a lista para expandir o escopo.

## Matriz antes/depois

`PASS testes` descreve código validado com mocks/fixtures/guards. Não representa
um disparo de mensagem ou pedido real. `Preservado` descreve a produção V128,
que permanece ativa durante a missão.

| Item | Baseline | Candidata |
| --- | --- | --- |
| AUTH | API sem token 401; testes PASS | PASS testes; mesmas regras |
| BOT_INBOUND / WEBHOOK | Entradas reais persistidas; guards PASS | PASS testes; parser preservado |
| BOT_AUTO_REPLY / FUNNEL | Flags e guards PASS; sem canário nesta missão | PASS testes; QA real após aprovação |
| BOT_MANUAL_SEND | Texto/áudio humano confirmado em leitura | PASS testes; envio real não repetido |
| WHATSAPP / ZAPI | Conectado; health pronto | Produção preservada |
| CUSTOMER_SAVE / CUSTOMER_STATUS | Fichas 3494/3464 persistidas; guards PASS | PASS testes V122–V125 |
| READ_STATE / UNREAD_COUNT | Rota de leitura 423; Angel unread=9 | PASS testes; leitura autorizada; atendimento humano preservado |
| UNANSWERED_COUNT | Ignora leitura e outbound fora da janela rápida | PASS testes; handled-through persistente |
| OUTBOUND_NOT_INBOUND | Direção correta no caso observado | PASS texto/áudio/imagem/template e eco; parser preservado |
| DROPI_TEX_ULTRA / DROPI_NITRIX / DROPI_VIT_POWER | Perfis V120/V121 e ponte V128 PASS | READY em fixtures válidas/autorizadas |
| PRODUCT_SELECT_PERSISTENCE | Guard bloqueia configure-order | PASS handler + refresh, um pedido por ciclo |
| META_LINK_NOT_REQUIRED_FOR_DROPI | Já separado | PASS; sem mudança Meta |
| DROPI_DUPLICATION / ONE_POST / NO_RETRY | Guards e testes PASS | PASS consulta, zero POST se existente, concorrência e timeout |
| DROPI_STATUS_SYNC | V121 PASS | PASS; arquivo preservado |
| V114 / V116 / V118 | 135 testes dirigidos anteriores PASS | Todos continuam PASS |
| PM2 / MONGO / NGINX / HEALTH | Online/ativos/200 | Produção preservada; rechecagem após staging |

Evidência de transporte nas 24 horas consultadas: 39 mensagens inbound e 25
outbound humano da Z-API, sem conteúdo copiado. Não foram encontrados outbounds
marcados como bot nessa janela; por isso BOT_AUTO_REPLY em produção não recebe
PASS de canário real, apenas validação de configuração e testes.

Commits funcionais separados:

- A: `5f4ac23` — configuração manual Dropi separada do envio.
- B: `183a09b` — atendimento persistente e integração dos guards sucessores.

Riscos residuais: o teste de ponta a ponta no telefone QA e o primeiro envio
Dropi legítimo ainda dependem da publicação aprovada e da ação humana definida
na solicitação. A liberação de configurar produto continua atrás de autenticação
e não concede autorização de envio. Não há migração, backfill ou retry novo.

## Rollback e publicação

Nenhuma publicação foi autorizada nesta missão. A candidata deve passar pelo
staging oficial e apresentar commit/tree exatos antes do gate humano.
Depois da aprovação: snapshot, release imutável, helper oficial, health e
conferência do CWD real do PM2. O alvo de rollback é a baseline V128 acima.
Não há migração nem backfill; rollback não apaga atendimentos ou pedidos.

O primeiro envio Dropi real exige que o operador selecione um pedido legítimo
e acione explicitamente autorização/envio. Exigir um único POST e ID real;
resposta ambígua exige consulta autoritativa, sem retry automático.

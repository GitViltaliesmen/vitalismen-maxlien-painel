# Freeze candidato V126 — QA, estado atendido e recuperação pós-venda EC

Data: 2026-09-04
País: Equador
Baseline imutável: `production-20260904-475ab88`
Referência funcional: `production-20260825-75ed74b`

## Escopo autorizado

Esta candidata trata somente quatro objetivos: manter o QA `5515998038637`
apto a testar o bot, persistir corretamente o estado atendido, preparar um reset
transitório preservando histórico e reconectar os lembretes legítimos de retirada
e recompra ao executor isolado V116. Nenhuma VSL, oferta, preço, checkout,
produto, Meta/CAPI, Dropi ou infraestrutura externa foi alterada.

O snapshot read-only anterior a qualquer edição está em
`docs/evidence/vitalismen-ec-v126-pre-mission-snapshot-20260904.json`.

## Causas-raiz

- QA: V118 mantém o contato em AQUECIMENTO, a projeção Z-API excluía esse bucket
  e o `human.mode=manual`, enquanto o claim V78 expirava e possuía teto de oito
  mensagens. O inbound era salvo, mas deixava de chegar ao bot.
- Estado atendido: `metadata.panelLastReadAt` já era persistente e controlava
  `unreadCount`; `unansweredCount`, porém, era recalculado somente contra o último
  outbound e ressuscitava o inbound no refresh/sync.
- Pós-venda: as seis etapas V53 e a recompra por produto ainda existem. O executor
  V116 atual não as seleciona, e o scheduler PM2 antigo está corretamente
  desativado.

## Matriz pós-venda — 25/08 versus baseline V125

| Função | 25/08 | Atual V125 | Diferença | Ação V126 |
|---|---|---|---|---|
| pedido confirmado | ativo no fluxo existente | preservado | nenhuma perda provada | preservar |
| pedido enviado | ativo | preservado | nenhuma | preservar |
| ID Dropi | persistido | preservado com controles mais fortes | atual é melhor | preservar |
| status | scheduler PM2 | V114 observa e V116 executa isolado | arquitetura mudou com ganho de segurança | preservar V114/V116 |
| guia | ativa | ação `guide` no V116 | atual é melhor | preservar |
| rastreio | ativo | sincronização REPORT_ONLY e tracking atual | atual é melhor | preservar |
| em trânsito | ativo | ação `in_transit` no V116 | atual é melhor | preservar |
| chegada à agência | ativa | `READY_FOR_PICKUP` verificado | atual é melhor | preservar |
| disponível para retirada | ativo | ação `ready_for_pickup` no V116 | atual é melhor | preservar |
| primeiro aviso | V53 ativo | função existe, sem ligação no V116 | comportamento perdido | reconectar ao V116 |
| segundo aviso | V53 ativo | função existe, sem ligação no V116 | comportamento perdido | reconectar ao V116 |
| último aviso | V53 ativo | função existe, sem ligação no V116 | comportamento perdido | reconectar ao V116 |
| entregue | ativo | `delivered_bonus` no V116 | atual é melhor | preservar e calcular vencimento de recompra |
| não retirado | ativo | status final continua controlado | nenhuma perda provada | preservar |
| devolvido | ativo | ação `returned` no V116 | atual é melhor | preservar |
| pós-entrega | bônus V60 | bônus idempotente no V116 | atual é melhor | preservar |
| recompra | V53 por produto | função segura V66 existe, sem ligação no V116 | comportamento perdido | reconectar função central ao V116 |
| cooldown | presente | `SHIPMENT_MIN_MESSAGE_GAP_MS` | preservado | preservar |
| dedup | hash/lock V53 | ledger/idempotência V66/V116 | atual é melhor | preservar |
| idempotência | por etapa | chave central V66 + terminal V116 | atual é melhor | preservar |
| `human.mode` | casos manuais bloqueados | decisão central bloqueia manual | atual é melhor | preservar |
| claim | lock por Shipment | lock central persistente | atual é melhor | preservar |
| atendimento humano | excluído da automação | histórico e modo manual verificados | atual é melhor | preservar |
| scheduler | PM2 | desativado intencionalmente | não deve voltar | não reativar |
| timer | scheduler interno | V114 5 min + V116 60 min | atual é melhor | reutilizar V116 |
| fila | múltiplos por lote | máximo um candidato/dia | atual é mais conservador | preservar cota 1 |
| provider ID | persistido | obrigatório para `SENT` | atual é melhor | preservar |
| timeout ambíguo | podia liberar nova tentativa não concluída | terminal `AMBIGUOUS` | atual é melhor | preservar |
| retry | tentativa não concluída podia repetir | sem retry automático após provider | atual é melhor | preservar |

## Microcamadas funcionais

### QA permanente e reset seguro

A exceção exige simultaneamente telefone/chat exatos, as três tags congeladas e
cinco flags booleanas de teste. Ela não se aplica a nenhum outro contato. O QA
pode sair do bloqueio de AQUECIMENTO para uma entrada VSL válida, uma continuação
VSL ainda vigente ou uma pergunta direta que identifique explicitamente o
produto. Uma mensagem aleatória não recebe Tex Ultra por inferência.

O reset V126 possui relatório sem mutação por padrão e frase exata para aplicar.
Ele exige um único ContactState canônico e zero Orders/Shipments. Remove apenas
hold, claim, lock, rascunho e memória transitória; preserva `_id`, telefone,
mensagens, provider IDs, timestamps, timeline e dedupe histórico.

### Estado atendido

`unansweredCount` usa agora o maior valor entre último outbound e o marcador
persistido de leitura. Abrir/atender persiste o marcador já existente. Refresh,
reabertura e sync continuam atendidos; somente um inbound com timestamp maior
reabre a conversa. Nenhum campo paralelo e nenhuma exclusão foram introduzidos.

### Recuperação pós-venda

O executor continua sendo exclusivamente `post-sale-v116`. Um cursor root-only
criado apenas por `activate-lifecycle-v126` define a primeira data elegível. Tanto
`readyForPickupNotifiedAt` quanto `deliveredConfirmedAt` precisam ser iguais ou
posteriores ao cursor; assim, nenhum histórico pode entrar na seleção.

Status V116 tem prioridade. Somente se ele não tiver tentativa elegível e a janela
e cota estiverem disponíveis, a V126 avalia lembrete/recompra. O candidato usa a
mesma decisão V66, ledger, bloqueio humano e cota atômica diária V116. O lote
continua 1, o limite diário continua 1, timeout ambíguo continua terminal e não há
retry cego. Prova automática de retirada permanece desligada.

## Preservado

- V118 para todos os contatos não-QA;
- origem individual de Tex Ultra, Nitrix e Vit Power;
- funis, áudios, imagens e ofertas de cada produto;
- pedidos, Shipment, Dropi e Meta bloqueados para o QA;
- V114 estritamente read-only;
- V116 com cota atômica e provider ID obrigatório;
- backlog histórico, marketing em massa e Meta retroativo desligados;
- banco e schema sem migração ou backfill.

## Ativação e rollback

Publicar a candidata não cria o cursor e, portanto, não liga a recuperação
pós-venda. Após aprovação humana e publicação, a ativação exige:

`/opt/vitalismen-automacao/current/ops/post-sale-v116 activate-lifecycle-v126 I_UNDERSTAND_NEW_EVENTS_ONLY_NO_BACKFILL`

Rollback de código: repontar `current` para
`/opt/vitalismen-automacao/releases/20260904T051254Z_production-20260904-475ab88`
e validar PM2. Containment do pós-venda move o overlay e o cursor root-only para
arquivos auditáveis; banco, histórico, mensagens, Orders, Shipments e ContactStates
permanecem intactos.

Esta candidata não foi publicada. `PRODUCTION_CHANGED=NO`.

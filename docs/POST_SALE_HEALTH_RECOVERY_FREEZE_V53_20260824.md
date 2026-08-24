# Freeze V53 — saúde e recuperação segura do pós-venda EC

Data: 2026-08-24
País: Equador
Pai: `panel-media-persistence-v52-20260824`

## Incidentes confirmados

- A fila de retirada possuía 14 etapas vencidas e repetia `0/3`: o histórico
  reduzia textos diferentes de `day1`, `soft_day2`, `soft_day4` e `soft_day6`
  à mesma chave semântica.
- O lote sempre parava nos primeiros registros bloqueados, deixando os demais
  clientes sem tentativa.
- Dois Shipments marcados com `review.manualOnly=true` ainda apareciam na fila
  automática de retirada.
- A fila imediata Tex Ultra consultava somente `batch * 8` pedidos. Com lote 1,
  os oito pedidos antigos completos escondiam pendências posteriores.
- A recompra pós-venda usava texto, memória, prova e áudio Vit Power mesmo
  quando o Shipment era Nitrix ou Tex Ultra. Foram encontrados 20 registros
  históricos contaminados: 16 Nitrix e 4 Tex Ultra.
- O guard V39 procurava a expressão de nome anterior à resolução V48/V50.

## Correções autorizadas

- Chave antirrepetição distinta para cada etapa aprovada da retirada, mantendo
  bloqueio rígido da repetição da mesma etapa.
- `manualOnly` bloqueado na consulta, na política da etapa e no envio final.
- Lembrete de retirada e recompra passam a adquirir lock persistente no
  Shipment antes do transporte e a liberar/registrar erro após a tentativa.
- O limite da fila passa a controlar envios confirmados, não tentativas; um
  registro bloqueado não pode impedir a avaliação dos seguintes.
- Tex Ultra passa a varrer uma janela independente do lote e inicia uma
  verificação 45 segundos após o processo subir.
- Pedidos Tex Ultra com até 72 horas podem seguir na fila automática, um por
  ciclo. Histórico mais antigo é apenas reconciliado; passo ausente recebe
  `stale_missing_not_replayed` e nunca é disparado tardiamente em massa.
- A recompra resolve o produto pelo Shipment:
  - Vit Power: `TEMPO_RESULTADO_VIT_POWER` e provas Vit Power aprovadas;
  - Nitrix: `NITRIX_USO_OXIDE_EC`, sem prova Vit Power;
  - Tex Ultra: `MODO_DE_USO_TEX_ULTRA`, sem prova Vit Power;
  - produto desconhecido: automação bloqueada.
- Texto, memória, chave antispam e evento da recompra registram o produto e o
  áudio realmente selecionados.
- O guard V39 passa a validar `resolveCustomerDisplayName`, sucessor oficial da
  expressão anterior.

## Proteções preservadas

- Nenhum reenvio massivo de backlog.
- Nenhum cliente real é usado como canário de implantação.
- Lock persistente, histórico, dedupe e ledger continuam obrigatórios.
- Casos manuais não recebem automação de retirada nem recompra.
- Dropi, Meta/CAPI, pixel, checkout, preço, VSL, número oficial, credenciais,
  transporte Z-API e ordem do funil não são alterados.
- Os áudios logísticos universais `Chegou_01`, `Chegou_02` e `Chegou_03`
  permanecem inalterados.

## Validação obrigatória

- `npm run guard:post-sale-health-v53`
- `npm run guard:ec-direct-product-name-postsale-v39`
- `npm run guard:pickup-notifications`
- `npm run guard:guide-print-spam`
- `npm run guard:ec-product-micro-layer`
- `npm run senior:check`
- `npm test`

O rollback retorna ao release V52 ativo antes desta camada, preservando banco,
mensagens, mídias, Shipments, Orders e ContactStates.

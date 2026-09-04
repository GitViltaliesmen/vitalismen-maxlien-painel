# Freeze V120 — cadastro autenticado e Dropi manual multiproduto EC

Data: 2026-09-04
Escopo: painel Vitalismen Ecuador e envio manual individual ao Dropi
Baseline pai: `production-vitalismen-ec-dropi-manual-v119-20260904-r4`
Commit pai: `12a29c7cb26b1473e1104049aded40daa2386315`

## Incidentes confirmados

1. O formulário autenticado `Novo cliente` chamava `POST /api/whatsapp/contacts`,
   mas a barreira operacional V78 não encaminhava essa rota ao handler existente.
2. O envio Vit Power preparava dados, agência e preço corretamente, porém dependia
   da tela privada de produto. A tentativa do pedido
   `EC-RECOMPRA-MTKEFGCW-RZA8` terminou antes do POST de criação ao Dropi.

## Decisão autorizada

- Liberar somente `POST /api/whatsapp/contacts`, depois da autenticação já
  obrigatória, preservando validação de telefone EC e idempotência por contato.
- Aplicar o contrato BFF autoritativo da V104 aos três produtos que já existem no
  seletor controlado: `tex_ultra_ec`, `nitrix_ec` e `vit_power_ec`.
- Resolver produto pelo pedido atual, consultar produto/estoque no catálogo e
  cotar o destino antes de qualquer criação.
- Manter autorização e envio como duas ações manuais separadas por pedido.

## Catálogo e depósitos validados em leitura

- Tex Ultra: produto `110681`, depósito `1261`, origem `802`.
- Nitrix: produto `105825`, depósito `1544`, origem `802`.
- Vit Power: produto `103743`, depósito `1261`, origem `802`.
- A cotação de Nitrix e Vit Power para Guayaquil retornou HTTP 200 e incluiu
  Servientrega. Essa validação não criou pedido.

## Segurança preservada

- nenhum produto é inferido quando estiver `Não definido / revisar`;
- produto, quantidade e preço precisam corresponder a uma oferta EC oficial;
- pedido entregue não é reutilizado; recompra usa `EC-RECOMPRA-*` novo;
- busca autoritativa de duplicidade ocorre antes do único POST de criação;
- resultado ambíguo não recebe retry automático;
- somente ID real do Dropi permite declarar envio concluído;
- lote, backfill, scheduler, marketing e envio automático continuam bloqueados;
- WhatsApp, Meta/CAPI, VSL, funil, preços e pós-venda não foram alterados.

## Operação

A autorização geral dos três produtos significa disponibilidade para envio manual
individual quando houver um pedido válido. Ela não pré-autoriza pedidos futuros e
não elimina o clique humano de autorização por pedido exigido pela V119.

## Publicação e rollback

A publicação deve usar release imutável, validar o processo PM2 contra o mesmo
release, executar guards e conferir health/timers. O rollback imediato é a release
V119 `/opt/vitalismen-automacao/releases/20260904T001809Z_production-20260904-12a29c7`.

# Congelamento aprovado EC v6: atribuição Meta Purchase

Data: 2026-08-15

## Autorização escrita

O pedido escrito anexado à tarefa em 2026-08-15 autorizou auditar e corrigir a atribuição Meta/CAPI EC de ponta a ponta, preservando anúncios, criativos, VSL, checkout, funil e dados antigos. A alteração somente poderia avançar depois de evidência técnica da causa. A auditoria `AUDITORIA_META_PURCHASE_ATTRIBUTION_V2.md` documenta essa evidência.

O v5 não foi reescrito. Este v6 herda integralmente seus comportamentos e hashes estáveis e acrescenta uma nova baseline para os arquivos Meta autorizados.

## Invariantes Meta adicionados

1. `event_id` continua sendo o `orderId` estável.
2. Um claim Mongo atômico precede o POST da Graph API.
3. Retry conserva o mesmo `event_id` e incrementa `metaPurchaseAttempts`.
4. Somente resposta com `events_received > 0` grava `metaPurchaseSentAt`.
5. `event_time` usa `confirmedAt`, com fallbacks históricos determinísticos.
6. Purchase web exige URL HTTP(S) real da jornada; painel, localhost, rede privada e backend não são aceitos.
7. Pedido manual/WhatsApp sem prova web usa `business_messaging`, sem URL fabricada.
8. IP/UA enviados pertencem ao cliente original, nunca à requisição administrativa.
9. `fbclid`, `fbc`, `fbp`, UTMs, external ID e IDs de campanha/anúncio são preservados quando existem e nunca inventados.
10. Nenhum pedido antigo é reenviado ou retroatribuído sem dados originais e nova autorização.
11. O guard público é somente leitura por padrão; criação/limpeza de lead em produção exige `PUBLIC_FUNNEL_MUTATION_TEST=YES` explícito.

## Preservação herdada

- camada automática inicial Tex Ultra, tempos, filas, áudios e pausa por interação;
- pós-venda confirmado e proteção de reenvio;
- Funil Rápido manual universal sem alterar produto/pedido histórico;
- ficha inteligente EC;
- métricas autenticadas em `/api/funnel-metrics`;
- operação exclusiva EC e catálogo/preços aprovados.

## Estado de publicação

Baseline local para auditoria. Criar o freeze não autoriza evento externo, backfill, venda teste, mudança na landing externa, deploy, reinício PM2 ou alteração de symlink. A validação mutável do funil público permanece opt-in.

## Rollback

Restaurar a release/commit v5 `b53e575b832e28a970bf9c8165e2513e933c0890`. Os campos Mongo novos são opcionais e a release anterior continua capaz de ler os pedidos existentes.

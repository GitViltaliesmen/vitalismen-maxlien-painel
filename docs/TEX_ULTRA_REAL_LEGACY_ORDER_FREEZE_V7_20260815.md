# Congelamento aprovado EC v7: pedido histórico administrativo real

Data: 2026-08-15

## Autorização escrita

O operador autorizou expressamente corrigir o caso real do Angel e casos equivalentes, reconhecendo como histórico apenas o ID administrativo com entrada antiga que não pertença à negociação atual. Também autorizou criar o freeze v7, atualizar os gates, executar a auditoria completa e gerar um novo commit local.

Não autoriza publicação na VPS, push, reinício PM2, mudança de symlink, backfill, venda real, evento Meta, mensagem WhatsApp, envio Dropi ou mutação de cliente.

## Relação com o v6

O freeze `tex-ultra-meta-purchase-attribution-v6-20260815` permanece intacto como pai. O v7 herda as proteções de atribuição Meta/CAPI, métricas autenticadas, ficha inteligente, isolamento EC, funil automático, preços, áudios, pós-venda e proteção contra reenvio. A única mudança funcional é a detecção conservadora do pedido administrativo histórico na negociação manual atual.

## Evidência do caso real

O registro real usado pelo painel possuía:

- país `EC`;
- modo humano `manual`;
- `orderId` administrativo `EC-ADMIN-3338`;
- status `atendendo`;
- `currentNegotiationOrderId` vazio;
- entrada anterior ao dia atual;
- tags operacionais reais, sem `ANTIGO` ou `CLIENTE ANTIGO` persistidos.

A interface calculava visualmente “Antigo/Cliente antigo” pela data de entrada, enquanto a política v6 dependia de tags persistidas. O teste antigo usava tags que não existiam no registro real.

## Regra congelada v7

Um identificador administrativo é histórico somente quando:

1. corresponde ao padrão `EC-ADMIN-<número>` ou equivalente de país administrativo;
2. a entrada é classificada como antiga pela mesma função temporal usada pelo painel;
3. o identificador não coincide com `currentNegotiationOrderId`.

Status terminal já histórico e tags legadas persistidas continuam respeitados. Uma entrada administrativa nova não é convertida em histórico. A propriedade explícita da negociação atual prevalece e impede separação indevida.

Ao confirmar uma nova venda sobre um histórico reconhecido:

- o registro administrativo anterior não é sincronizado nem reescrito;
- o novo pedido recebe outro `orderId`;
- `previousOrderId` aponta para o identificador anterior;
- `currentNegotiationOrderId` passa a apontar para o novo pedido;
- o produto atual permanece separado da origem e da compra anterior.

## Estado de publicação

Baseline local autorizada para auditoria e commit. A produção permanece no release `20260815T045340Z_ec_universal_metrics_b53e575`. O release `20260815T061819Z_meta_attribution_dd1abb3` permanece inativo. Uma publicação futura exige autorização escrita contendo o novo hash do commit v7.

## Rollback futuro

Se uma publicação v7 vier a ser autorizada e falhar, restaurar o symlink para `/opt/vitalismen-automacao/releases/20260815T045340Z_ec_universal_metrics_b53e575`, reiniciar somente `vitalismen-automation`, salvar o PM2 e validar `/health` local, `/api/health/` público, painel, métricas autenticadas e o caso real do Angel em leitura.

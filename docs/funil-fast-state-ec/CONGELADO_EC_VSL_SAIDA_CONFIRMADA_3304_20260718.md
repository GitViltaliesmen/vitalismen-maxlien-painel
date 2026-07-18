# EC — saída confirmada da VSL e atenção do painel

Data: 2026-07-18 (UTC)

## Escopo

Equador somente: `ec.maxlien.shop/n/`, Nitrix EC e o painel EC. Nenhum recurso da Colômbia foi consultado, alterado ou publicado.

## Causa

O painel usa `lastOutboundAt` para retirar o alerta `VSL · sem atendimento` depois da primeira saída aprovada. O Fast State gravava as mensagens, mas não persistia esse campo no estado do contato. Por isso um cliente com sequência entregue podia continuar com `!`.

## Correção

- O Fast State passa a salvar `lastOutboundAt` após cada saída efetivamente enviada.
- Após a abertura inicial aprovada, remove somente a etiqueta operacional `AGUARDANDO_ATENDIMENTO`; nenhuma conversa assumida por humano é alterada.
- O estado do contato final 3304 foi corrigido a partir da última saída registrada com entrega confirmada, sem enviar nova mensagem.

## Validação

- VSL mobile permanece com as duas CTAs em espanhol e o desktop mantém a página informativa.
- O serviço PM2 permanece no release EC ativo e a Z-API continua conectada.
- Não há mudança de Pixel, Dropi, pedido, preço, moeda, callback, banco de outro país ou histórico de mensagens.

## Registro de publicação

- Release ativo: /opt/vitalismen-automacao/releases/20260718T131036Z_ec_vsl_outbound_state_3304.
- Backup prévio: /root/codex_deploy_backups/20260718T131036Z_pre_ec_vsl_outbound_state_3304.

# V147-R2 — pós-venda EC completo com agradecimento após retirada

## Escopo

A V147-R2 sucede o candidato imutável `dfff5d9e465d48538fce5f325cb756885b038101`, árvore `a8d36e27ac7b4be1ead6fb8f66dbece77dbbc6de`. A alteração reutiliza o áudio aprovado `OBRIGADO_PAGOU` como P5 depois de retirada ou entrega confirmada. Nenhum arquivo de mídia foi alterado.

## Separação das mensagens

O agradecimento de fechamento da venda continua no fluxo de confirmação com `AGRADECIMENTO_AGENCIA_DE_ENTREGA`. O áudio `OBRIGADO_PAGOU` passa a pertencer exclusivamente à etapa P5, posterior ao estado canônico `DELIVERED` ou aos desfechos persistidos `pickedUp`/`delivered`.

P5 possui estágio, marcador, lock, ledger, evento e deduplicação próprios. P6 permanece o texto de acesso ao bônus. P7 permanece o áudio de modo de uso específico de Tex Ultra, Vit Power ou Nitrix. O dispatcher executa P5 antes de P6/P7 e relê o Shipment entre as etapas.

## Segurança operacional

O envio continua sujeito à decisão central, histórico de mensagens, lock persistente e estado terminal no ledger. A chave P5 inclui cliente, pedido, Shipment, evento `P5` e template `P5_DELIVERED_THANKYOU_NEUTRAL`. Se o transporte aceitar o áudio e a finalização local falhar, o registro de mensagem e a deduplicação física impedem repetição no próximo ciclo.

Não há backfill histórico. O candidato usa transporte sink durante os testes, envia zero mensagens reais, não altera produção, não muda o symlink `current` e não reinicia PM2.

## Evidência histórica

`docs/PICKUP_BONUS_DELIVERY_FREEZE_V60_20260824.md` registra `OBRIGADO_PAGOU` após retirada. `docs/PICKUP_BONUS_DELIVERY_ACTIVATION_RESULT_V60_20260824.md` confirma contagem física única. `approved_freezes/APPROVED_PICKUP_BONUS_DELIVERY_V60_20260824.txt` proíbe replay do agradecimento. A decisão explícita do operador em 2026-09-10 confirmou que este é o áudio posterior à retirada, distinto do agradecimento enviado após o fechamento da venda.

## Rollback

Como esta etapa cria apenas um candidato congelado sem ativação, produção continua na release anterior. Um eventual rollback do candidato consiste em manter `current` intacto e descartar a release de staging sem remover ledger, histórico ou deduplicação.

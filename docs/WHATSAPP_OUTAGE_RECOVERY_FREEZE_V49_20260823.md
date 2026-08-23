# Freeze V49 — recuperação da indisponibilidade WhatsApp EC

A V49 sucede a V48 e registra a correção pontual do incidente informado em
2026-08-23 para os contatos terminados em `2490`, `0754`, `7428`, `2327` e
`3837`.

## Causa confirmada

A Z-API continuava respondendo como conectada, mas toda tentativa de saída
falhava com `To continue sending a message, you must subscribe to this instance
again`. O primeiro erro persistido foi observado em `2026-08-23T22:11:39Z`; a
última saída bem-sucedida anterior foi observada em `2026-08-23T20:51:06Z`.
Webhooks de entrada e o armazenamento de mídia continuaram ativos.

O caso terminado em `3837` também expôs uma falha independente: a resposta
curta `SI`, recebida enquanto o funil aguardava confirmação, era classificada
como revisão e não chegava ao roteador. O pedido não foi criado porque a cidade
`FRANCISCO DE ORELLANA` também permanece pendente de canonização; essa trava de
integridade não é contornada por esta microcamada.

## Alteração autorizada

- O health correlaciona o último erro de assinatura com a última saída Z-API
  bem-sucedida e retorna `zapi_subscription_inactive` enquanto não houver
  sucesso posterior.
- Texto útil recebido em uma etapa `awaiting_*` ou `sdr_awaiting_*` de produto
  EC estruturado permanece em `ATENDIMENTO` e alcança o funil correspondente.
- Etapas de handoff, pausa, conclusão, falha ou fechamento não são reativadas.

## Preservado

Não há compra/renovação da assinatura por código, envio de canário para cliente
real, replay de falhas, criação retroativa do pedido `3837`, autorização Dropi,
reenvio Meta/CAPI, alteração de preço, produto, VSL, número oficial, mídia,
scheduler ou motor principal. A retomada externa depende da renovação manual da
instância oficial Z-API terminada em `8416`.

## Validação e rollback

O guard V49, os testes de regressão, `senior:check`, o audit de microcamada de
produto e a conferência do PM2 são obrigatórios. O rollback funcional é a
release V48
`/opt/vitalismen-automacao/releases/20260822T232706Z_production-20260822-cd61ae1`.
Mensagens, mídias e bancos compartilhados não devem ser removidos no rollback.

# V147-R3 — gate canônico de pagamento para bônus e modo de uso

A V147-R3 sucede a candidata imutável `1878f956d6e2b7d44ef3057ff50f4b000097cd4c`, árvore `e6b09121a270bea8d175808ee6342ad76e300647`. O P5 e o áudio `OBRIGADO_PAGOU` permanecem byte a byte inalterados. A alteração restringe somente P6 e P7 conforme a decisão comercial do operador em 2026-09-10.

## Prova de pagamento

`shipmentCanonicalPaymentEvidence()` classifica a evidência antes de `shipmentPaymentConfirmed()` retornar verdadeiro. Entrega, retirada, `CAN_PICKUP` e `READY_FOR_PICKUP` nunca provam pagamento.

A auditoria live encontrou seis ocorrências do evento existente `dropi_payment_claim_skipped_paid`, mas as seis derivam exclusivamente de status verde `ENTREGADO`. Isso não satisfaz a regra comercial deste gate e o evento não é aceito como pagamento. A lista autenticada de 190 pedidos do Dropi também não expõe campo financeiro de recaudo ou liquidação, e as rotas de Wallet disponíveis para a conta retornaram `403` na consulta somente leitura.

Os campos `raw.paymentConfirmedAt`, `raw.payment.confirmedAt`, `raw.payment.status` e `raw.latestDroppiPayload.paymentStatus` não possuem produtor nem ocorrência nos 202 Shipments EC auditados. Eles não são aceitos como prova. A confirmação de venda em `Order.confirmedAt` também não é prova de recebimento do pagamento contra entrega. Portanto, a fonte canônica está indisponível e o mapper retorna `UNKNOWN` com confiança `CANONICAL_PROVIDER_SOURCE_UNAVAILABLE` para todos os Shipments.

## Sequência P5, P6 e P7

P5 continua elegível somente após entrega ou retirada canônica, com seu ledger, lock, dedupe e marcador próprios. P6 exige, além disso, P5 aceito ou recuperado, pagamento canônico, elegibilidade do bônus, URL HTTPS válida e ausência de `bonusNotifiedAt`.

P7 agora possui o estágio `PRODUCT_USAGE`, o marcador `automation.usageNotifiedAt`, lock, ledger, histórico e dedupe próprios. Ele exige entrega ou retirada, pagamento canônico, P6 aceito ou recuperado e produto canônico. O áudio permanece `MODO_DE_USO_TEX_ULTRA`, `COMO_SE_TOMA_VIT_POWER` ou `NITRIX_USO_OXIDE_EC` conforme o pedido.

Para Tex Ultra, o P7 compartilha o dedupe persistente `tex_ultra_how_to_use_audio_v31` com o gatilho manual já aprovado. Um envio manual anterior é recuperado no ledger P7 sem nova chamada ao provider; uma corrida concorrente também permanece protegida pela reserva atômica do mesmo dedupe.

P6 e P7 aguardam pacing antes da borda do provider. Com a fonte atual indisponível, ambos falham fechados e não chegam à borda do provider. A matriz testa a sequência com uma prova canônica injetada exclusivamente no transporte sink; nenhuma fonte ou campo de produção é fabricado. Pagamento posterior à entrega reabre somente P6/P7 quando uma futura fonte canônica comprovada for ligada. Pagamento anterior à entrega não libera nenhuma etapa. Restart após a sequência completa envia zero duplicatas.

## Validação e publicação

A matriz A–F usa transporte simulado e envia zero mensagens reais. O alvo `EC-ADMIN-3484` permanece `ENTERING_AGENCY`, com `CAN_PICKUP=NO`, portanto A07, P5, P6 e P7 permanecem bloqueados. Não há replay histórico, troca de `current`, reinício de PM2 ou publicação nesta candidata. Uma nova aprovação do operador é obrigatória antes da ativação.

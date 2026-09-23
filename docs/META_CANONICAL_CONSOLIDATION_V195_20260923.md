# V195 — consolidação Meta canônica no dataset 920

Data: 2026-09-23

## Autorização

O operador autorizou explicitamente:

`AUTORIZO_CONSOLIDAR_META_NO_DATASET_920532663934291=SIM`

O escopo é exclusivamente a microcamada Meta do Vitalismen EC / Protocolo G.

## Estado anterior

- Browser Pixel da VSL móvel: `920532663934291`.
- CAPI e Purchase: `1468946114265008`.
- Dataset histórico dedicado do Protocolo G: `2048099902484149`.
- O dataset `1468946114265008` permanece referência histórica e rollback, mas não pode receber novos eventos depois da ativação V195.
- O dataset `2048099902484149` não pode ser fallback depois da ativação V195.

## Provas pré-corte

- Token `META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G`: presente.
- `debug_token`: HTTP 200, `is_valid=true`, tipo `SYSTEM_USER`.
- Test Event CAPI `PageView`: HTTP 200, `events_received=1`, destino `920532663934291`.
- VSL móvel: HTTP 200, variante `vsl-mobile`, `fbq` inicializado com `920532663934291`.
- Provas técnicas de browser `PageView` e `ViewContent`: HTTP 200 no Pixel `920532663934291`.
- Nenhum Purchase falso, pedido artificial, replay histórico ou dual send foi usado.

## Contrato V195

A ativação exige simultaneamente:

```text
META_CANONICAL_CONSOLIDATION_EC_APPROVED=true
META_CANONICAL_DATASET_EC=920532663934291
META_ACCESS_TOKEN_EC_TEX_ULTRA_PROTOCOLO_G=<segredo válido>
```

Sem as duas flags, o comportamento legado é preservado. Configuração parcial, dataset divergente ou token ausente falham fechados e nunca retornam silenciosamente ao `146...` ou ao `2048...`.

Quando ativada, a V195 projeta todos os novos eventos de servidor EC para `920532663934291`, incluindo os caminhos V148 de `InitiateCheckout` e `Purchase`. Os gatilhos de negócio, locks, ledger, `event_id`, ação humana e confirmação Dropi permanecem inalterados.

## Deduplicação

- `Purchase`: server-only; `event_id` permanece o ID persistente do pedido.
- `InitiateCheckout`: server-only no fluxo operacional atual; `event_id` permanece o ciclo persistente V148.
- `PageView` e `ViewContent`: browser-only em produção; CAPI foi usado somente no Test Events controlado.
- `Lead` e `Contact`: não foram fabricados durante a migração.
- Não há dual send para `146...` e `920...`.

## Preservado

- VSL e VTurb.
- CTA e telefone.
- Bot comercial e funil.
- Z-API e WhatsApp.
- Dropi e transportadora.
- Produtos e preços.
- Campanhas e orçamento.
- Pós-venda.
- Pedidos e Purchase históricos.

## Linhagem dos guards

A V195 não desliga nem ignora os freezes anteriores. O preload V195 valida seu
manifesto canônico antes de carregar a cadeia V194 e fornece, somente para os
arquivos exatos listados e congelados no manifesto V195, o hash sucessor que
cada guard ancestral deve exigir. Alteração fora da allowlist ou divergência de
qualquer hash continua encerrando o processo em fail-closed.

Os bridges de contexto modificados têm finalidade exclusiva de reconhecer a
linhagem V195; não habilitam evento, scheduler, mensagem, Dropi ou Purchase.
O perfil operacional V78 continua exigindo seu conjunto completo de flags e o
hash do perfil. Quando — e somente quando — a V195 está integralmente ativa,
ele aceita o preload congelado V195 e recalcula a assinatura do perfil; sem a
ativação completa, o preload oficial V97 permanece obrigatório.

## Observação separada

O Pixel móvel está funcional, mas a carga normal da VSL atual apenas inicializa `fbq`; não foi observado `PageView` automático. Corrigir esse comportamento exigiria autorização separada para microajuste na VSL e não faz parte da V195.

## Rollback

Rollback operacional consiste em remover as duas flags de ativação V195 e reativar o release anterior conhecido. O token legado e os contratos históricos não são apagados. Nunca usar rollback com dual send nem reenviar evento já aceito.

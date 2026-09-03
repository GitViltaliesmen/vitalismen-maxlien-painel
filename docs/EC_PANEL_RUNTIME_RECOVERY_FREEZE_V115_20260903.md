# Freeze V115 — recuperação autenticada do envio manual e status real

Data: 2026-09-03
Escopo: painel WhatsApp oficial Vitalismen Ecuador
Baseline: `026317886960c32f8dc4c8d4cf83e51bd7f77e0f`
Runtime herdado: V111

## Causas comprovadas

O perfil operacional V78 declarava `panel_attendance_state` como classe de
escrita permitida, mas a allowlist HTTP aceitava somente webhooks Z-API e as
duas entradas da VSL. Por isso, o middleware global devolvia HTTP 423 antes da
autenticação e do handler de `/api/whatsapp/send`, `/claim` e `/release`.

O painel também tratava `unconfirmed` e `pending_confirmation` como
`✓ enviado`. Assim, até a resposta HTTP 423 era apresentada como sucesso. O
cliente Z-API aceitava ainda uma resposta HTTP 2xx sem `messageId`, `id` ou
`zaapId` como envio bem-sucedido.

O `pausedUntil` aproximadamente em 2036 foi gravado pelo controle manual da
baseline: `LONG_MANUAL_HOLD_DAYS=3650` representa atendimento humano mantido
até o operador usar `Liberar auto`. Não foi causado pelo HTTP 423. Essa
proteção é preservada; o rótulo incorreto `Renovar 10 min` passa a refletir a
semântica real sem liberar contatos antigos.

## Correção mínima

- libera somente `POST /api/whatsapp/send`, `POST .../claim` e
  `POST .../release` no perfil V78;
- a liberação falha fechado se `PANEL_AUTH_DISABLED` não for exatamente
  `false`;
- o handler de envio exige `sendMode=manual_panel`;
- nenhuma outra rota `/api/whatsapp/*` é liberada;
- uma resposta Z-API sem ID real é falha, inclusive para mídia;
- o estado inicial com ID real é `provider_accepted`, nunca `sent`;
- `sent`, `delivered` e `read` dependem dos ACKs/callbacks existentes;
- HTTP 4xx/5xx e falha de provider aparecem como `request_failed`/`failed`;
- novos leads continuam em automático; assumir explicitamente mantém humano
  no comando até `Liberar auto`.

## Preservado

Produtos, preços, checkout, funis, mídias, número oficial, Z-API, Dropi,
Meta/CAPI, pedidos, recompra, pós-venda, schedulers, banco e histórico não são
alterados por esta camada. Não há replay, blast, backlog ou migração em massa.

## Publicação e rollback

A V115 deve passar por guards, staging e publicação imutável V70. O rollback é
a troca formal de `current` para a baseline congelada, seguida da recriação
apenas do processo PM2 `vitalismen-automation` se `pm_cwd` ou `pm_exec_path`
continuarem apontando para a release nova.


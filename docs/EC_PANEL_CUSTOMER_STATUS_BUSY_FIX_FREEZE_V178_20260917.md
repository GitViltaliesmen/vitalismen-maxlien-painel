# V178 — Ficha do cliente independente do bloqueio global

Data: 2026-09-17
Base: V177 `cfc314de10a795c0995d30ae57c9765a3173e25c`

## Escopo autorizado

Corrigir somente a gravação da ficha do cliente em `public/qr.html`, incluindo os status:

- Novo;
- Atendendo;
- Comprar depois;
- Confirmar pedido;
- Pedido enviado;
- Entregue;
- Recompra;
- Cancelado;
- Devolvido.

## Causa comprovada

A função `applyCustomerDraftToChat` montava o cliente atualizado, mas não retornava o objeto. Na primeira edição, `state.selectedChat` virava `undefined` e o autosave encerrava antes de chamar a API. A ausência de `PATCH` nos acessos recentes de produção confirmou que a falha acontecia no navegador.

Além disso, a ficha reutilizava `state.busy`, uma trava global compartilhada com ações independentes do painel. Quando outra ação permanecia ocupada, a gravação da ficha também era bloqueada. O autosave de status reiniciava a função completa enquanto aguardava, repetindo a confirmação do operador.

## Correção congelada

- A ficha usa `customerFormSaveInFlight`, isolada de `state.busy`.
- `applyCustomerDraftToChat` retorna o cliente atualizado e preserva a seleção durante a edição.
- Salvamentos da própria ficha continuam serializados por `customerDataSaveQueue`.
- O autosave aguarda apenas gravações da própria ficha.
- A confirmação de mudança de status ocorre uma única vez por seleção.
- Todos os nove status permanecem disponíveis.

## Preservado

Nenhuma mudança em VSL, bot, funil, produtos, preços, Dropi, Meta, Pixel, CAPI, Purchase, áudios, pós-venda, Z-API, Baileys, MongoDB, Nginx ou rotas backend.

Produção não foi alterada por esta preparação local. Publicação continua condicionada a autorização explícita e gates completos.

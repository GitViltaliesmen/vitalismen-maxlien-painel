# Candidata V270: pós-venda pelo dispositivo vinculado

Data: 2026-11-24. Checkout isolado autorizado `codex/ec-postsale-v270`.

## Implementado nesta candidata

- Importada a validação recente da fonte Dropi/Servientrega usada na candidata V263 para as etapas de guia, trânsito e retirada. Histórico sem prova atual e guia divergente permanecem inelegíveis.
- Criado controlador puro que limita a um envio físico por ciclo, recusa concorrência, exige cutoff válido e dispositivo vinculado, bloqueia envio fora da janela e verifica que simulação produz zero envio.
- Criado adaptador de seleção somente para reconciliação Dropi e as etapas textuais `guide`, `in_transit` e `ready_for_pickup`. Esta restrição evita ativar áudio automático pelo transporte atual.
- A etapa `ready_for_pickup` recebe apenas o componente `TEXT` no V270; o comportamento padrão da função existente permanece completo para outros chamadores.
- Os notificadores de guia, trânsito e retirada expõem tentativa física mesmo quando a persistência final falha; o ciclo para nesse ponto e não parte para outra etapa com resultado incerto.
- Preparada autenticação de requisição local por HMAC, nonce único, janela de 30 segundos e commit do sucessor selado.
- Preparada rota interna exata no processo que detém o socket. O guard V78 exige HMAC antes da rota, concede contexto de gravação somente à chamada `run` e restringe coleções e métodos. A exceção do canário para cliente EC depende desse mesmo contexto e do commit selado.
- Preparado controlador local que assina uma única chamada, usa somente `127.0.0.1:3000`, valida o recibo e não repete resultado incerto. Ainda falta instalá-lo como sucessor do serviço V203 com o lock e a política de parada do timer.

## Testes executados

- `node --test tests/post-sale-linked-v270-auth.test.mjs tests/post-sale-linked-v270-cycle.test.mjs tests/post-sale-linked-v270-controller.test.mjs`: 14 testes passaram. Cobrem HMAC, replay, origem, cutoff, janela, transporte, concorrência, recibo e limite de envio.
- `node --check` dos módulos novos e `git diff --check`: passaram.
- No release V269 ativo no VPS, 38 testes históricos passaram. Eles não executam os módulos desta candidata.

## Gates ainda não atendidos

1. A rota e a exceção de canário existem apenas no checkout candidato. Faltam teste autenticado na release materializada, teste das gravações permitidas e prova de recibo. Um sinalizador local sozinho não libera o fluxo.
2. A candidata ainda não possui unidade systemd instalada, autoridade selada V270 ou release materializado. O preload V269 contém registro fechado de releases até V269 e rejeitaria uma V270 apenas copiada para `current`.
3. O código de envio ainda tem referências Z-API legadas. Em `EC_WHATSAPP_TRANSPORT=baileys_text`, `shouldUseZapiForOutbound` retorna falso, mas a prova do pós-venda deve inspecionar o recibo e o chat de cada etapa no dispositivo vinculado. O executor isolado V188/V263 continua consultando Z-API; não deve ser religado.
4. A sequência completa ainda depende de uma capacidade selada para mídia automática. `notifyDeliveredThankYou` envia áudio; `notifyShipmentReminder` pode enviar texto e áudio no mesmo ciclo; o transporte V269 aceita mídia apenas em `manual_panel`. Ligar essas funções agora violaria o limite de uma saída. `PICKUP_BONUS` precisa de prova canônica de entrega ou retirada, da etapa P5 confirmada e de recibo distinto. Estas etapas permanecem fora da candidata.

## Estado operacional

Esta é uma candidata incompleta, sem publicação ou ativação. Não ligar V203 nem V188/V263, não setar `POST_SALE_V270_RUNTIME_ACTIVE`, não enviar a clientes com esta candidata. V269 continua como release ativo e rollback. Nenhuma mensagem foi enviada nesta execução.

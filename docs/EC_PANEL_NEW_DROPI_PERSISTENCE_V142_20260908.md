# V142 — persistência de Novas e preparação manual Dropi

Baseline imutável: V140 `13e752adc08cd089181eeebe2ff527dbe97f5fa9`, árvore `2b9c9608d110979eb56d7025d08d3506b475c4fb`.

A V142 corrige dois pontos do painel integrado EC observados em produção. Uma ficha manual podia ser salva no `ContactState` e no SQLite, mas desaparecer de **Novas** por estar sem mensagens não lidas e sem entrada VSL pendente. Uma ficha confirmada e completa também podia continuar apenas com o identificador administrativo do SQLite: o guard operacional bloqueava a tentativa genérica de gravar `Order`, deixando o fluxo Dropi sem pedido Mongo e sem `Shipment`.

## Contato novo

O endpoint de conversas expõe os horários já persistidos `manuallyCreatedAt` e `panelLastReadAt`. A política V142 mantém o contato manual em **Novas** enquanto a criação for posterior à última leitura explícita. Salvar a ficha ou atualizar o status não encerra essa condição. A ação existente de marcar a conversa como lida continua sendo a saída explícita da fila. Reabrir ou salvar um contato já existente preserva a data original de criação manual em vez de renová-la.

## Preparação do pedido

Salvar ou confirmar explicitamente uma ficha EC completa com ID `EC-ADMIN-*` chama somente a rota canônica autenticada `configure-order`. Essa rota grava a seleção estruturada de produto/preço e cria ou atualiza o `Order` local que ficará selecionável em Leads Clientes. O catálogo é resolvido pela combinação exata de quantidade e valor; o empate de 2 frascos por USD 70 usa a tabela promocional oficial sem alterar quantidade ou preço.

A preparação não autoriza o envio, não chama o Dropi e não cria `Shipment`. A autorização humana e o envio continuam em ações separadas no painel Leads. Ficha incompleta, qualidade V28 bloqueada, preço fora das tabelas, produto desconhecido ou status diferente de confirmado são ignorados de forma segura. Um pedido já preparado com os mesmos dados não é reconfigurado, preservando eventual autorização ainda válida.

## Evidência do incidente

O caso operacional recente do lead 3503 estava confirmado e completo no SQLite e no `ContactState`, com qualidade V28 igual a 100, porém tinha zero `Order` e zero `Shipment`. O log registrou `customer_state_saved_order_sync_not_authorized` após o guard bloquear `orders.insertOne`. A V142 desloca a preparação para a rota manual já autorizada, preservando as travas V138:

- `BOT_AUTOMATIC_DROPI_SEND=OFF`;
- `BOT_AUTOMATIC_SHIPMENT=OFF`;
- `DROPI_MANUAL_AUTH_REQUIRED=YES`;
- `DROPI_CALLS_ON_SAVE=0`.

O snapshot anterior à camada está em `/opt/vitalismen-automacao/backups/pre-v142-panel-dropi-persistence-20260908T023314Z` e a referência Git local é `snapshot-pre-v142-panel-dropi-persistence-20260908T023314Z`.

# V140 — reconciliação Servientrega por telefone

Baseline imutável: V139 `b0e5f51cfc71995c9c0c26c6fbbf1ac0b74c9e69`, árvore `f2afcb2daa9c3f288c2a0ab07160c3a9874b239d`.

A V140 adiciona um bootstrap limitado para pedidos EC históricos que já existem no Dropi e no banco local. O match começa obrigatoriamente pelo telefone móvel EC em E.164. Se houver mais de um pedido para o telefone, a seleção cruza guia, ID Dropi, Shipment, Order, produto e data; empate permanece sem alteração.

A fonte Dropi é o leitor autenticado já existente e a situação logística vem do rastreador direto Servientrega restaurado na V139. A aplicação usa o `applyShipmentLifecycleStatus` da V139 sobre Order e Shipment já existentes. A ficha, o painel e a timeline continuam pelo mecanismo canônico existente.

Cada ciclo automático executa primeiro um dry-run sem escrita e sem mensagem. Somente telefone válido, match inequívoco, autorização humana Dropi persistida, guia válida e resposta Servientrega válida permitem aplicação. Nenhum caminho V140 cria Order, Shipment ou envio Dropi.

O primeiro estado histórico suprime mensagens de etapas já vencidas. `GUIA_GENERADA` sem prova de aviso fica em revisão e não reenvia a guia. Trânsito e ingresso em agência não liberam retirada. `READY_FOR_PICKUP` continua exigindo confirmação direta do transportador e mantém o ledger transacional para envio único. Em `ENTREGADO`, guia, trânsito e retirada antigos permanecem suprimidos; somente o pós-entrega atual pode ser avaliado.

As travas V138 e V139 permanecem: envio Dropi automático desligado, criação automática de shipment desligada e autorização humana obrigatória.

# Freeze v12 — produto manual persistente na ficha Leads Clientes

Esta camada preserva o freeze v11 e fecha somente a reidratação visual do produto manual na ficha administrativa do Equador.

- A rota autenticada e somente de leitura `GET /api/shipments/droppi/ec/admin-leads/flags` volta a existir.
- O produto, a tabela, a quantidade e o total são publicados para a tela somente quando há marcador estruturado `[DROPI_PRODUCT]` persistido no lead.
- Notas internas não são devolvidas à tela, e a rota não classifica recompra, revisão manual ou status sugerido.
- É proibido inferir ou impor produto por preço, quantidade, nome do cliente ou conversa histórica.
- A rota não altera lead, pedido, Shipment, Dropi, WhatsApp, Meta, banco ou status operacional.
- O envio real dos sete pedidos já concluídos não é repetido por esta camada.

Qualquer alteração futura nesses contratos exige autorização escrita e uma nova camada de freeze descendente.

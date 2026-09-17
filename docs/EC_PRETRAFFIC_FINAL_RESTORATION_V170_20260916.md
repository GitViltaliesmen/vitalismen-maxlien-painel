# Freeze final pré-tráfego EC V170 — 2026-09-16

Escopo oficial único: `ec.maxlien.shop`, VPS Hostinger `72.60.137.77` e `/opt/vitalismen-automacao/current`.

Esta microcamada fixa como fonte de verdade do painel o status atual persistido em `ContactState.metadata.customerDraft.status`. Pedido histórico não pode sobrescrever `novo`, `atendendo`, `comprar_depois`, `confirmado`, `recompra` ou `cancelado`. Apenas evidência logística persistida em `Shipment` pode avançar a visualização para `pedido_enviado`, `entregue` ou `devolvido`.

A qualidade de dados exibida é recalculada de forma determinística sobre a ficha atual. Entrega em agência exige agência Servientrega autorizada e não exige endereço residencial; nenhum endereço ou agência é inventado.

O envio ao Dropi permanece exclusivamente humano, autenticado, unitário e multiproduto para Tex Ultra Ecuador, Nitrix Oxide Ecuador e Vit Power Ecuador. Não existe envio em lote ou automático nesta camada.

O evento Meta `Purchase` continua fora do WhatsApp: somente o caminho canônico posterior ao sucesso fresco do envio humano ao Dropi pode executá-lo, com `event_id` estável e persistência apenas depois de aceitação positiva.

Z-API permanece preservada como transporte público oficial. WhatsApp Web permanece em `SHADOW`. Protocolo-G não é alterado.

Os hashes do manifesto `docs/freeze/ec-pretraffic-final-restoration-v170-20260916.json` são validados em fail-closed. Qualquer alteração futura nos arquivos protegidos exige autorização explícita do operador e um sucessor versionado; editar silenciosamente esta baseline é proibido.

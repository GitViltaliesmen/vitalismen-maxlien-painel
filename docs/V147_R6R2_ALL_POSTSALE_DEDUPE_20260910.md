# V147-R6R2 — registro compartilhado de retirada

Base exata: `83b70ab78821b5df12832ee125803d0abe9682c8`, tree `8d572312718383fd24e886bd7ef7e75a46f5dce4`.
Hash funcional da R6 e recibo da candidata revalidados na VPS oficial. A produção permanece no release R4 `20260910T153848Z_production-20260910-b821dc0`.

## Estado de trabalho

Implementação em andamento, sem autorização de publicação ou ativação. Ainda não é uma candidata congelada.

A07/A10/A19 passam pelo classificador exato de mídia da R6, pela identidade customer/order/shipment/event/template e pelo mesmo `Shipment.automation.postSaleSafetyLedger` e `notificationLocks`. Histórico anterior ao ledger exige ID do provedor, prova de aceite, mídia exata, destinatário e janela do pedido; nenhuma mensagem histórica é alterada. A reconciliação preserva a data real do aceite e entradas anteriores.

O adaptador manual reconhece as três etapas. A10/A19 usam a reserva canônica no notificador existente, metadados e dedupeKey no áudio e rechecagem do estado persistido antes do transporte. Reserva obsoleta é encerrada sem aceite fabricado ou chamada ao provedor. O prazo usa A07 acceptedAt +72h/+120h. INTENDED expirado e resultado ambíguo continuam bloqueando retry automático.

P5/P6/P7 conservam sua sequência e regras. Nenhuma alteração no polling, scheduler, transporte Z-API, Chromium, ProtectHome, produto, human.mode, Meta, VSL, Dropi ou recompra.

## Decisão pendente sobre A07

O A07 automático atual envia texto, PDF quando disponível e Chegou_01. O pedido R6R2 exige uma chamada total ao provedor e simultaneamente restringe a mudança ao dedupe. É necessário esclarecer se uma chamada se refere ao áudio A07 mantendo os outros componentes ou se o evento passa a enviar somente Chegou_01. A integração final do transporte A07 e a matriz completa dependem dessa decisão; não declarar o contrato completo aprovado antes disso.

## Verificação parcial

Onze testes R6/R6R2 passaram sob preload oficial V97. Sessenta e dois testes V65/V66 passaram após adequação das fixtures A07 ao contrato de evidência exata aceita, em lugar de frase aproximada sem ID do provedor.

O senior local inicialmente apresentou essas quatro expectativas antigas e uma falha de carregamento de dependência Baileys no Windows. As expectativas A07 foram corrigidas e revalidadas; a execução Linux oficial de staging ainda é necessária. O script SINK testa A10/A19 e as corridas P5/P6/P7; A07 está explicitamente pendente e seu recibo parcial não autoriza freeze.

REAL_MESSAGES_SENT=0. Nenhuma reconciliação foi aplicada ao banco de produção. O caso 6886247 continua reservado à regressão SINK da R6.

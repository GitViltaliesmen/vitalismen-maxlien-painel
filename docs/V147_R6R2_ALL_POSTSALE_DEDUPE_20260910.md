# V147-R6R2 — dedupe compartilhado de pós-venda

Base preservada: `83b70ab78821b5df12832ee125803d0abe9682c8`, tree `8d572312718383fd24e886bd7ef7e75a46f5dce4`.
Produção esperada: R4 `20260910T153848Z_production-20260910-b821dc0`.

## Contrato aprovado

A07 conserva o texto oficial V29, o PDF/guia disponível e Chegou_01. Uma execução pode chamar o provedor mais de uma vez. A corrida painel/V116 deve igualar a baseline normal, com zero duplicatas de cada componente.

O mesmo `Shipment.automation.postSaleSafetyLedger.READY_FOR_PICKUP` contém a reserva lógica pai e os componentes TEXT, GUIDE_PDF e AUDIO. A reserva pai mantém UUID e contagem 1. Cada componente tem identidade customer/order/shipment/A07/component, incluindo guia ou template quando aplicável. O mesmo `notificationLocks.READY_FOR_PICKUP` serializa o envio dos componentes; não existe ledger, scheduler ou poller paralelo.

Histórico só satisfaz o componente exato mediante destinatário, janela do pedido, providerMessageId e aceite comprovado. Texto usa o template exato; PDF usa fonte/arquivo/hash exatos; áudio usa a mídia oficial. Ausência de PDF não cria documento. Componentes aceitos não são reenviados. INTENDED expirado e resultado ambíguo exigem reconciliação com prova antes de qualquer retry. Falha comprovadamente anterior ao provedor permite retomar o componente pendente. Entradas antigas e mensagens são preservadas.

A âncora acceptedAt do pai conserva a data anterior ou o aceite do texto A07. A10/A19 mantêm +72h/+120h e o bloqueio após DELIVERED. P5/P6/P7 e suas regras de produto/human.mode permanecem preservados. O adaptador do painel e o notificador existente compartilham reserva, histórico e revalidação do estado antes do provedor, inclusive depois da preparação do PDF.

## Verificação e publicação

O SINK mede baseline, duas ordens de corrida em processos separados, histórico completo/parcial, PDF ausente, falha parcial, timeout ambíguo, reconciliação, restart e DELIVERED antes do envio. A10/A19 e P5/P6/P7 mantêm a matriz R6R2. O replay R6 de 6886247 deve permanecer com zero chamadas futuras e histórico original intacto.

Preload V97 e manifests sucessores validam os arquivos alterados e os congelamentos anteriores. O guard de retirada passa a exigir a reserva canônica do componente TEXT em vez do antigo bypass por force. Os 74 testes focados e o lint local de 889 arquivos passaram. O primeiro staging passou senior, mas parou nessa expectativa antiga do guard; foi corrigida e revalidada. A suíte local completa parou na dependência libsignal ausente no Windows; a validação final será a execução Linux instalada pelo vitalismen-stage.

A candidata só pode ser congelada após staging oficial, suíte completa, senior, lint e todos os recibos SINK passarem. Recibos e logs ficam fora dos releases imutáveis em `/var/lib/vitalismen-deploy/evidence/v147-r6r2-all-postsale-20260910`. Nenhuma publicação ou ativação está autorizada nesta camada.

CURRENT_UNCHANGED=YES. PRODUCTION_CHANGED=NO. REAL_MESSAGES_SENT=0.

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

Preload V97 e manifests sucessores validam os arquivos alterados e os congelamentos anteriores. O guard de retirada exige a reserva canônica do componente TEXT em vez do antigo bypass por force. A normalização de PDF reconhece o mesmo caminho público, URL oficial e caminho do release; outro host ou outra guia não satisfazem o componente.

Antes do commit final, o staging `0e2f7ad` passou todos os gates oficiais, inclusive senior e preload V97, npm test com 1.492 testes e zero falhas, lint de 889 arquivos e regressões SINK R4/R5/R6. A suíte local completa parou na dependência libsignal ausente no Windows; a suíte Linux instalada pelo mecanismo oficial passou. Os testes focados locais da revisão final somam 75 aprovações, incluindo equivalência exata dos caminhos de PDF.

A matriz SINK R6R2 do mesmo runtime passou integralmente com a correção de uma assertion de teste (lock ausente no histórico completo é equivalente a lock null). Baseline A07=3; corrida iniciada pelo painel=3; corrida iniciada pelo V116=3; duplicatas TEXT/PDF/AUDIO=0; histórico completo=0; sem PDF=2. Histórico parcial, falha parcial, timeout ambíguo sem retry cego, recuperação por prova, restart e DELIVERED antes do provedor passaram. A10/A19 e P5/P6/P7 passaram. O replay 6886247 teve zero chamadas futuras, preservando mensagens e o incidente anterior.

## Identidade final e recibo

O commit final incorpora as correções de teste e o reconhecimento do PDF oficial. Antes de criar as tags, repetir staging, npm test, senior, lint, preload e matrizes SINK sobre esse commit exato. As tags imutáveis são `candidate-v147-r6r2-all-postsale-dedupe-20260910` e `freeze-candidate-v147-r6r2-all-postsale-dedupe-20260910`. O recibo final registra commit/tree/hash, resultados, hashes das evidências e preservação da produção em `/var/lib/vitalismen-deploy/receipts/v147-r6r2-all-postsale-dedupe-candidate-freeze-20260910.json`.

Logs e recibos ficam fora dos releases imutáveis em `/var/lib/vitalismen-deploy/evidence/v147-r6r2-all-postsale-20260910`. O recibo final só pode declarar freeze após todos os gates passarem sobre a identidade final. Nenhuma publicação ou ativação está autorizada nesta camada; a candidata congelada aguarda aprovação humana final.

CURRENT_UNCHANGED=YES. PRODUCTION_CHANGED=NO. REAL_MESSAGES_SENT=0.

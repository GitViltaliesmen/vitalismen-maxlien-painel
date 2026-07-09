# Ficha autosave e Dropi final 3426 EC - 2026-07-09

## Diagnostico

- Telefone validado: `+593969213426`.
- Pedido encontrado: `EC-MRCXC21Q-9WPF`, cliente `Nestor Antonio Mora Oquendo`, produto Nitrix EC, pacote 3, total `95.99`, status `confirmed`.
- Dropi nao recebeu ID nem guia: `dropiOrderId` vazio, `trackingNumber` vazio e `submittedToDroppiAt` nulo.
- A submissao entrou na fila, mas o navegador Dropi fechou no meio do processamento: evento `droppi_browser_transient_retry` com `locator.count: Target page, context or browser has been closed`.
- O shipment ficou em `dropi_submit_locked_waiting`, compatível com interrupcao durante deploy/restart, nao com pedido enviado.

## Correcoes

- O rascunho da ficha no `ContactState` agora preserva `orderId` e `sourceOrderId`.
- O painel cria cache local enquanto o atendente digita para nao perder alteracao entre atualizacoes.
- Campos da ficha disparam autosave com debounce em input/change/blur.
- Atalhos que preenchem campos por codigo, como trecho da conversa e agencia, tambem disparam autosave.
- A rota `POST /api/automation/alerts/acknowledge` entrou na lista de escritas operacionais permitidas do painel.

## Acao operacional esperada

- Depois do deploy estavel, recolocar `EC-MRCXC21Q-9WPF` em etapa `Enviar para Dropi` pela rota segura de requeue, desde que siga sem Dropi ID e sem guia.

# Alerta operacional clicavel e baixa por atendimento - 2026-07-09

## Problema

O topo do painel mostrava alertas de atendimento que podiam ficar falsos depois que o operador ja havia atendido o cliente.

Exemplo observado:

- final `9733` / telefone `961469733`;
- alerta aparecia como `Pedido exige revisao manual`;
- o operador precisava clicar no alerta e ir direto ao cliente correto.

Tambem havia falso positivo em `Clientes aguardando retomada`: a rotina removia a conversa se o bot respondesse, mas nao removia quando a resposta era humana.

## Correcao

Arquivos alterados:

- `src/services/reengagementService.js`
- `src/routes/automation.js`
- `src/models/Shipment.js`
- `public/qr.html`

Mudancas:

- `listReengagementCandidates()` agora ignora conversa que ja teve qualquer resposta enviada pelo painel depois da ultima mensagem do cliente.
- A mesma rotina tambem ignora conversa com `human.lastManualAt`, `metadata.lastHumanActionAt` ou baixa operacional posterior a ultima entrada do cliente.
- `/api/automation/status` agora devolve `manualReviewOrders` e `reengagementCandidates` como lista de clientes clicaveis.
- Criado `POST /api/automation/alerts/acknowledge`.
- Alerta do painel agora mostra cada cliente com botao `Atender`.
- Ao clicar em `Atender`, o painel:
  - abre a conversa do cliente;
  - assume/renova atendimento humano por 5 minutos;
  - registra baixa do alerta operacional;
  - atualiza a lista de alertas.

## Regra operacional

O alerta do topo deve indicar trabalho pendente real.

- Se o cliente ja recebeu resposta humana depois da ultima mensagem, ele nao entra mais em `Clientes aguardando retomada`.
- Se o operador abriu o cliente pelo alerta e assumiu o atendimento, o alerta sai do topo.
- A baixa de alerta nao apaga pedido, guia, historico, revisao Dropi nem lock Meta/Purchase.

## Validacoes locais

- `node --check src/routes/automation.js`
- `node --check src/services/reengagementService.js`
- `node --check src/models/Shipment.js`
- parse inline do `public/qr.html`
- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-status-panels-freeze.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-ec-nitrix-guard.mjs`

Resultado: OK.

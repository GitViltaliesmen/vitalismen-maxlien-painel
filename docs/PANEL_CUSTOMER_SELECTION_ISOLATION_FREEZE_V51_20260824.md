# Freeze V51 — isolamento da ficha ao trocar de cliente no painel EC

A V51 sucede a V50 e corrige exclusivamente a troca de conversa na ficha do
cliente do painel oficial `public/qr.html`.

## Incidente confirmado

O cliente final `1150` entrou pela VSL com `Guayaquil / Guayas`, mas a ficha
mostrou e salvou temporariamente `Mira / Carchi / Mira Principal`, pertencentes
ao cliente final `2490`. O histórico persistido registrou a contaminação às
`2026-08-23T23:54:19Z`. A própria operação corrigiu depois a ficha para
`Guayaquil / Guayas / Guayaquil Los Almendros`; a auditoria somente leitura não
encontrou `Order` Mongo desse telefone.

## Causa confirmada

Temporizadores de autosave e consultas assíncronas de agência podiam sobreviver
à troca de conversa. A fila de salvamento validava o cliente antes de aguardar,
mas iniciava a operação efetiva somente quando chegava sua vez. Além disso, uma
agência automática já aplicada era reaplicada a cada renderização, criando um
ciclo de `resolve-customer-data` e `PATCH`.

## Alteração autorizada

- Cada seleção recebe uma geração monotônica vinculada ao `chatId` e à chave do
  `ContactState`.
- Trocar de cliente invalida timers de status, ficha e agência, limpa
  imediatamente os campos visuais antigos e só então hidrata a nova ficha.
- Busca, resposta, erro, autosave, fila e retorno de persistência só atualizam a
  tela se a geração original continuar ativa.
- Sair e voltar ao mesmo cliente também invalida respostas da geração anterior.
- A mesma agência já aplicada é idempotente e não cria novo autosave.

## Preservado

Não foram alterados motor do bot, produto, preço, VSL, funil, áudio, imagem,
transporte Z-API, número oficial, pedido, checkout, Dropi, Meta/CAPI, pixel,
banco, scheduler ou PM2. O teste de navegador usa APIs simuladas e não envia
mensagem, não cria pedido e não edita cliente real.

## Validação e rollback

São obrigatórios o teste V51, a simulação de navegador `2490 -> 1150`, os guards
V50/V51, `senior:check` e `node scripts/audit-ec-product-micro-layer.mjs`.
O rollback funcional é a release V50
`/opt/vitalismen-automacao/releases/20260823T235000Z_production-20260823-a17e519`.
Bancos, mensagens e mídias compartilhados não devem ser removidos no rollback.

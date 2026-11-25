# V271 — confirmação explícita de recompra no painel EC

## Diagnóstico em produção

Em 25/11/2026, a ficha do pedido `EC-RECOMPRA-MWVKPZ5K-4HPR` tinha produto Vit Power, 3 frascos, USD 95,99 e dados de entrega validados. O pedido Mongo continuava `draft`, com quantidade e valor zerados. A ficha permanecia em `recompra`; o painel mostrava "Pedido já está em fluxo" e o botão genérico "Salvar dados". A fila Dropi exige pedido confirmado. Uma varredura somente leitura encontrou dois rascunhos de recompra vinculados a fichas; apenas um tinha oferta completa. Nenhum pedido foi enviado ou confirmado durante a auditoria.

## Mudança candidata

No painel compartilhado pelos três produtos EC, uma nova recompra com oferta e dados completos apresenta "Confirmar recompra". O clique exige confirmação humana, usa a persistência confirmada existente e só declara sucesso depois da prova de leitura e visibilidade em Confirmados. Enquanto faltarem dados, a ficha pode continuar sendo salva como rascunho. O envio à Dropi permanece manual. VSL, funis, transporte WhatsApp, preços, Dropi, Meta e pedidos históricos não foram modificados.

## Testes

- Simulação isolada no navegador para Vit Power, Tex Ultra e Nitrix: uma oferta completa não confirma sem clique; o clique envia `confirmado` à rota autenticada simulada.
- Simulação de resposta sem prova de persistência: o painel volta a `recompra` e não declara sucesso.
- `tests/panel-confirmed-persistence-v158.test.mjs`: dez casos aprovados.
- `tests/panel-customer-status-busy-v178.browser.test.mjs`: aprovado.
- `npm run lint`: aprovado.
- `npm run guard:panel-confirmed-v158`: bloqueado pelo hash histórico de `public/qr.html`; o commit de produção V270 já diverge do hash V158, que requer sucessor selado. Não alterar o guard histórico.
- `tests/v146-definitive-normalization.test.mjs` no Windows: não executa porque importa módulo selado instalado apenas no VPS.

## Estado de publicação

Candidata local. A ativação exige autoridade selada sucessora vinculada ao commit e à release materializada, validação dos guards no VPS, backup, smoke autenticado e comparação do PM2 e do painel após troca. Não declarar a correção publicada antes desses recibos.

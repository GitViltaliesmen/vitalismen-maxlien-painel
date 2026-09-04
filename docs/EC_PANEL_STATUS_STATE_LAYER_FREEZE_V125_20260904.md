# Freeze V125 — status da ficha separado da liberação do pedido

Data: 2026-09-04
País e operação: Vitalismen Ecuador
Baseline pai: V124, commit `264e9715a33c89e81e40f998dc69647bbaee072e`, tree `568588fc92c19227c3962578d9059eebdb259521`

## Fechamento do incidente

O salvamento da ficha já estava separado das rotas genéricas de pedido na V124. Restava uma validação visual anterior ao `PATCH`: ao selecionar `confirmado` com dados logísticos ainda incompletos, o navegador revertia o seletor para o status anterior. O backend também devolvia `422` depois de persistir o estado, fazendo a interface interpretar o salvamento como falha.

## Microcamada V125

O status escolhido pelo operador e os dados preenchidos são persistidos como estado da ficha. Se faltarem dados obrigatórios, a resposta confirma o salvamento e informa separadamente que o pedido continua bloqueado. Nenhum pedido é criado, liberado ou enviado até que a validação operacional esteja completa.

O botão específico de confirmação completa e as ações de pedido/Dropi continuam exigindo os dados obrigatórios.

## Preservado

- V124: salvamento comum em modo state-only;
- V123: `ContactState.save()` antes de qualquer sincronização opcional;
- escopo Mongo limitado a `contactstates`;
- VSL, funil, WhatsApp, aquecimento, produtos e preços;
- Dropi, Meta/CAPI e pós-venda;
- banco sem migração ou backfill.

## Rollback

Retornar ao release V124:

`/opt/vitalismen-automacao/releases/20260904T045139Z_production-20260904-264e971`

# Freeze candidato V64 — nome completo obrigatório na Dropi EC

Data: 2026-08-26
País: Equador
Estado: implementação local validada, sem autorização de deploy

## Incidente e evidência

- A ficha da conversa final `3940` conservava o identificador técnico
  `garciajul96`, embora a própria mensagem do cliente identificasse
  `JULIO GARCIA` e o pedido/Shipment histórico já usasse o nome completo.
- O payload histórico enviado à Dropi não contém `garciajul96`; a divergência
  está no read model da ficha do painel.
- Apesar disso, `buildDroppiEcuadorOrderPayload` aceitava um único token e
  produzia `lastName` vazio. Assim, outro pedido poderia chegar à Dropi sem
  sobrenome caso a correção humana não ocorresse antes do envio.

## Regra rígida

- O único nome enviado para a Dropi é `Order.customer.name`, normalizado no
  construtor canônico do payload.
- O nome deve conter pelo menos dois componentes humanos substantivos: nome e
  sobrenome.
- São aceitos acentos, apóstrofo, hífen e partículas de nomes compostos.
- São bloqueados nome vazio, apenas um nome, nome concatenado em um único
  token, dígitos, e-mail, URL, `@`, sublinhado e identificador técnico.
- A mesma regra bloqueia autorização, fila automática, envio e preparação
  manual. O construtor final do payload repete a validação para que nenhuma
  rota futura consiga contorná-la.
- Pedido que já possui comprovante persistido de submissão Dropi permanece
  somente leitura e não é reaberto nem alterado por esta camada.

## Preservado

- Não se altera formulário/VSL, que pode continuar capturando primeiro nome e
  pedir os dados faltantes na conversa.
- Não se altera produto, preço, quantidade, checkout, agência, endereço,
  telefone, Dropi já enviado, rastreio, Servientrega, funil, pós-venda,
  scheduler, Meta/CAPI, pixel, Z-API, número oficial ou mensagens históricas.
- Esta implementação e seus testes não envia WhatsApp, Dropi ou Meta/CAPI.
- Nenhum cliente real é usado como canário.

## Validação obrigatória

- `npm run guard:dropi-customer-full-name-v64`
- `npm run guard:ec-product-micro-layer`
- `npm run guard:guide-print-spam`
- `npm run senior:check`
- `npm test`
- antes de uma eventual publicação: nova aprovação explícita, backup da
  release oficial, deploy pelo fluxo oficial e validações read-only de PM2,
  symlink, health, Z-API e `/n/`.

A herança V28–V63 é validada por
`src/services/dropiCustomerFullNameFreezeRuntimeGuardV64.js` e pelo manifesto
`docs/freeze/dropi-customer-full-name-v64-20260826.json`. O manifesto declara
explicitamente `deployAuthorized=false`.

Rollback local: reverter somente
`src/services/droppiEcuadorService.js`, `src/routes/shipments.js`, o teste, os
guards, o manifesto e esta documentação. Bancos, mensagens, pedidos e Shipments não precisam
de restauração porque esta camada não os migra.

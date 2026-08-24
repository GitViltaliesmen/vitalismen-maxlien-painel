# Freeze V57 — ultimo alias legado da ficha 5541

Data: 2026-08-24
Pais: Equador
Pai: `panel-customer-residual-repair-v56-20260824`

## Evidencia

A varredura posterior a V56 normalizou os telefones locais do Equador. Cinco
aparentes divergencias eram apenas equivalencias `09...`/`5939...`. Restou um
unico documento real:

- `_id` `6a7de6b3f24ae26732b45816`, `chatId` `0983125541@c.us`, que e o
  alias local da conversa final 5541, ainda conservava `phoneDigits` e rascunho
  do final 4364.

O estado canonico `_id` `6a7de6a3f24ae26732b457a8`, final 5541, ja foi
reparado pela V55 e contem os dados verificados de Sergio Ventura Villacis
castro, Muey/Santa Elena e agencia Servientrega autorizada.

## Reparo autorizado

- Copiar somente identidade, resolucao e rascunho canonicos do estado 5541 para
  o alias local do mesmo telefone.
- Limpar no alias os vinculos de pedido cruzados ja vazios no estado canonico.
- Preservar `chatId` local para compatibilidade com mensagens historicas e
  registrar os dois aliases em `linkedChatIds`.
- Preservar lead administrativo, Dropi e estado entregue ja pertencentes a
  Sergio; nenhum pedido ou mensagem e consultado para mutacao.

## Travamentos

- Somente os dois `_id` declarados podem ser lidos como fonte/alvo e somente o
  alias local pode ser atualizado.
- A aplicacao exige confirmacao literal, backup absoluto `0600` e pre-condicoes
  exatas de chat, telefone, nome e marcador V55.
- Nenhum Order, Message, Shipment, WhatsApp, Meta/CAPI ou Dropi e importado ou
  chamado.
- Nao ha canario real, reenvio, criacao de pedido ou alteracao de produto/preco.

## Validacao obrigatoria

- `npm run guard:panel-customer-alias-v57`
- `npm run senior:check` e `npm test`
- guards de produto, anti-spam e freeze lock
- dry-run na release candidata antes de aplicar
- apos aplicar: zero divergencias reais de identidade apos normalizacao EC,
  zero mensagens e zero pedido alterado.

O rollback reativa a V56 e restaura somente o alias pelo backup V57.

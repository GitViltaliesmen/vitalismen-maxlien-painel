# Freeze V56 — reparo residual exato da ficha EC

Data: 2026-08-24
Pais: Equador
Pai: `panel-customer-form-persistence-v55-20260824`

## Resultado da varredura posterior a V55

A correcao preventiva V55 esta ativa e impede que o telefone editavel troque a
identidade da conversa ou que uma agencia verificada grave endereco vazio. A
varredura completa posterior encontrou registros antigos ainda produzidos na
janela anterior a ativacao:

- quatro pedidos Tex Ultra de agencia com endereco vazio apenas no `Order`:
  `EC-MT6FF9N1-AFWE`, `EC-MT6FJHIS-YRQQ`, `EC-MT6H0NR2-SBM5` e
  `EC-MT6KIOUM-EGZK`;
- a ficha da conversa final `5201` conservava o telefone e o pedido da conversa
  final `6060`;
- a conversa final `6060`, cuja primeira entrada identifica `Charly`, conservava
  os dados de Segundo Bermeo.

## Reparo autorizado

- Os quatro pedidos recebem somente o endereco canonico da agencia ja validada,
  `reference` vazio e a resolucao V28/V55 correspondente. Status, quantidade,
  total, Dropi e Purchase Meta permanecem inalterados.
- A ficha `5201` volta a identidade WhatsApp `593994885201`, preserva os dados
  explicitos de Segundo Bermeo e a agencia oficial, mas perde qualquer vinculo
  com o pedido historico de outra conversa. Fica em atendimento/revisao.
- A ficha `6060` volta a conter somente `Charly` e seu telefone WhatsApp. Cidade,
  provincia, entrega, agencia, quantidade e total ficam vazios ate nova
  confirmacao do proprio cliente. Nenhum dado de Segundo e reaproveitado.
- O pedido enviado `EC-MSWR401B-KNHS`, seus eventos, mensagens e entrega
  historica permanecem byte a byte inalterados.

## Travamentos

- O script aceita apenas os quatro IDs de pedido e os dois `_id` de estado
  declarados no manifesto.
- A aplicacao exige confirmacao literal, backup absoluto com modo `0600` e
  pre-condicoes de telefone, agencia, status, Dropi e Purchase existentes.
- Nenhum transporte WhatsApp, Meta/CAPI ou Dropi e importado ou chamado.
- Nao ha canario com cliente real, reenvio, criacao de pedido ou mutacao de
  mensagens.
- Produto, preco, VSL, checkout, pixel, numero oficial, funil, midia, pos-venda e
  scheduler nao mudam.

## Validacao obrigatoria

- `npm run guard:panel-customer-residual-v56`
- `npm run guard:ec-product-micro-layer`
- `npm run guard:guide-print-spam`
- `npm run senior:check`
- `npm test`
- dry-run V56 no staging e no release ativo antes de `--apply`;
- apos aplicar: zero pedidos de agencia verificada com endereco vazio, zero
  divergencias de identidade nas duas fichas, pedido historico inalterado e zero
  envios WhatsApp, Meta ou Dropi.

O rollback reativa a release V55 e restaura somente os documentos exatos do
backup V56. Nenhum outro banco, pedido, mensagem, midia ou Shipment e tocado.

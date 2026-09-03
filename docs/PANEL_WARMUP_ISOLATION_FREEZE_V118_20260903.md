# Freeze V118 — isolamento visual da fila AQUECIMENTO

Data: 2026-09-03
Escopo: painel integrado Vitalismen Ecuador
Baseline: `BASELINE_VITALISMEN_EC_VSL_TEX_ULTRA_20260903`
Commit pai: `33fc61a1ea8e1a4289584c6cc41151bb10ad3ab6`

## Decisão autorizada

A fila interna `AQUECIMENTO` passa a ser uma visão operacional separada. Contatos
cujo bucket efetivo seja `engagement` aparecem somente quando o operador seleciona
o botão AQUECIMENTO. Eles não aparecem em ATENDIMENTO, PEDIDOS, REVISAR, Novas,
busca da fila normal, equipe, métricas comerciais nem na lista normal de Leads
Clientes.

A pesquisa deixa de atravessar a fronteira do AQUECIMENTO. A busca continua
funcionando por nome e telefone, mas somente dentro da fila selecionada. O contador
próprio do AQUECIMENTO permanece visível e continua sendo calculado com o conjunto
completo de conversas.

## Número QA autorizado

O único telefone brasileiro autorizado para teste, `5515998038637`, pode ser
movido manualmente para o bucket `engagement` apesar da exclusão histórica
`protected_test_contact`. A exceção é exclusivamente de organização do painel.

- a resposta automática de relacionamento continua bloqueada para esse QA;
- risco, opt-out e obrigação ativa de pedido continuam impedindo a permanência;
- nenhum outro telefone recebe a exceção;
- o comando de aplicação é report-only por padrão, exige autorização textual
  exata para gravar e não envia mensagem.

## Preservação de compradores

Uma obrigação de pedido ativa continua tendo precedência e aparece em PEDIDOS,
mesmo se o bucket persistido anterior for AQUECIMENTO. Em Leads Clientes, um
pedido ativo confirmado ou em envio também permanece visível. A camada não apaga,
duplica ou altera cliente, mensagem, ficha, pedido ou shipment.

## Fora de escopo

Não foram alterados motor do bot, funis, textos, áudio, imagem, preço, produto,
checkout, número oficial, Z-API, Dropi, Meta/CAPI, pixel, pós-venda, schedulers,
recompra ou histórico. Não existe envio frio, replay, backfill ou disparo em massa.

## Publicação e rollback

A publicação deve ocorrer em release imutável, com `senior:check`, guard V118,
suíte V118, guard de produto e health aprovados. O rollback é a reativação formal
da release pai `production-20260903-33fc61a`. A única mutação de dados autorizada
é a mudança auditável do bucket do QA final 8637; ela pode ser revertida para
`attendance` sem apagar seu histórico.

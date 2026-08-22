# Microcamada V35 — ingredientes por produto EC

## Autorização e objetivo

Em 2026-08-22, o operador pediu uma resposta em espanhol para clientes que
perguntarem pelos ingredientes de Tex Ultra, Nitrix Oxide ou Vit Power.

A V35 é um complemento lateral determinístico. Ela não altera a apresentação,
a oferta, a coleta de dados, o fechamento nem o pós-venda congelados.

## Composição registrada

- Tex Ultra: maca peruana, Tribulus terrestris, catuaba, marapuama, zinco e
  magnésio.
- Nitrix Oxide: feno-grego (fenugreek), Tribulus terrestris, ginseng Panax
  (ginseng vermelho coreano), ashwagandha, Ginkgo biloba e L-arginina.
- Vit Power: preserva a composição já aprovada — borojó, chontaduro, noni,
  L-arginina, maca, guaraná e vitaminas.

## Texto em espanhol

### Tex Ultra

`Claro, señor. La fórmula de Tex Ultra contiene maca peruana, Tribulus terrestris, catuaba, marapuama, zinc y magnesio.`

`Si usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de usar cualquier suplemento. ¿Desea que le explique el modo de uso o que continuemos con las opciones disponibles?`

### Nitrix Oxide

`Claro, señor. La fórmula de Nitrix Oxide contiene fenogreco (fenugreek), Tribulus terrestris, ginseng Panax (ginseng rojo coreano), ashwagandha, Ginkgo biloba y L-arginina.`

`Si usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de usar cualquier suplemento. ¿Desea que le explique el modo de uso o que continuemos con la información del producto?`

### Vit Power

`Claro, señor. La fórmula de Vit Power contiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas.`

`Si usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de usar cualquier suplemento. ¿Desea que le explique el modo de uso o que continuemos con las opciones disponibles?`

## Gatilhos e retorno ao funil

- Reconhece perguntas por ingredientes, composição, fórmula, componentes ou
  o que o produto contém, inclusive a grafia provável `ingriendentes`.
- Usa somente o produto atual da ficha.
- Se a mensagem citar explicitamente outro produto, não responde com a fórmula
  diferente e não troca a negociação atual.
- Depois da resposta, preserva a etapa anterior do funil; nenhuma apresentação
  ou mídia é reiniciada.

## Segurança e antirrepetição

- Pergunta que também menciona condição médica, medicamento, alergia ou
  contraindicação não recebe a resposta comercial; permanece na camada de
  segurança médica ou no atendimento humano do produto.
- Cada produto possui memória persistida própria em
  `metadata.perAgentMemory.<productKey>.productIngredientsFaq`.
- A resposta usa lock persistido de dois minutos e cooldown de trinta minutos.
- Como é resposta direta a uma pergunta inbound, pode responder mesmo quando o
  cliente já possui pedido Dropi; isso não autoriza apresentação, recuperação
  ou reenvio automático.
- Falha de transporte libera o lock e não marca a resposta como enviada.
- Atendimento humano real ativo continua soberano.

## Preservado

- origem da VSL e seleção manual por cliente;
- ordem e cadência dos funis;
- preços, quantidades e ofertas;
- áudios, imagens e provas sociais;
- pedido, Dropi, Meta/CAPI e pixel;
- Z-API, número oficial e telefone QA;
- scheduler, pós-venda, locks logísticos e PM2.

Nenhuma mensagem real, pedido, Dropi, Meta/CAPI, escrita no banco oficial ou
deploy foi produzido durante a criação deste congelamento.

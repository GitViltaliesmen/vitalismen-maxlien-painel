# Microcamada V36 — lista consolidada de ingredientes EC

## Autorização e objetivo

Em 2026-08-22, o operador aprovou explicitamente a opção de apresentar, em
uma única mensagem em espanhol, os ingredientes de Tex Ultra, Nitrix Oxide e
Vit Power, mantendo cada fórmula identificada em sua própria seção.

A V36 sucede a V35 sem substituir as respostas individuais. A lista
consolidada existe somente para perguntas que peçam todos os produtos,
comparação entre produtos ou citem pelo menos dois produtos.

## Texto consolidado aprovado

```text
Claro. Estos son los ingredientes de cada uno de nuestros productos:

🔵 *Tex Ultra*
Contiene maca peruana, Tribulus terrestris, catuaba, marapuama, zinc y magnesio.

🟠 *Nitrix Oxide*
Contiene fenogreco (fenugreek), Tribulus terrestris, ginseng Panax —también conocido como ginseng rojo coreano—, ashwagandha, Ginkgo biloba y L-arginina.

🟢 *Vit Power*
Contiene borojó, chontaduro, noni, L-arginina, maca, guaraná y vitaminas.

Cada producto tiene una fórmula diferente; por eso, los ingredientes de un producto no deben confundirse con los de los demás.

Si usa medicamentos o tiene alguna condición de salud, consulte a su médico antes de utilizar cualquier suplemento.

¿Sobre cuál de los tres productos desea recibir más información: Tex Ultra, Nitrix Oxide o Vit Power?
```

## Gatilhos determinísticos

A resposta consolidada é permitida quando a mensagem:

- pergunta pelos ingredientes/conteúdo dos produtos no plural;
- pede todos, os três, diversos ou vários produtos;
- pede diferença/comparação entre todos ou entre pelo menos dois produtos; ou
- cita explicitamente pelo menos dois entre Tex Ultra, Nitrix Oxide e Vit
  Power em uma pergunta de ingredientes ou comparação.

Pergunta que cita somente um produto conserva a resposta individual V35.
Mensagem sem pergunta de ingredientes/comparação não recebe a lista.

## Isolamento e continuidade

- Uma ficha ativa EC continua obrigatória.
- A resposta consolidada não modifica `assignedAgent`, `metadata.productKey`,
  `customerDraft.productKey`, origem VSL ou seleção manual.
- A pergunta final oferece continuidade, mas a escolha escrita pelo cliente
  não troca automaticamente o produto atual da negociação.
- O funil retorna à etapa anterior sem reiniciar apresentação, mídia ou oferta.
- Contexto médico sensível permanece fora da resposta comercial.

## Segurança e antirrepetição

- A memória consolidada é separada em
  `metadata.perAgentMemory.<productKey>.productIngredientsFaqAllProducts`.
- Lock persistido de dois minutos e cooldown de trinta minutos são preservados.
- O transporte usa o escopo anti-spam
  `product_ingredients_faq:all_products`, além da busca de histórico global.
- Falha de transporte libera o lock e não marca a lista como enviada.
- Atendimento humano real ativo continua soberano.

## Preservado

- fórmulas individuais V35;
- produto atual e origem de cada VSL;
- ordem e cadência dos funis;
- preços, quantidades e ofertas;
- áudios, imagens, vídeos e provas sociais;
- pedidos, Dropi, Meta/CAPI, pixel e checkout;
- Z-API, número oficial e telefone QA;
- scheduler, pós-venda, avisos de retirada, locks logísticos e PM2.

Nenhuma mensagem real, pedido, Dropi, Meta/CAPI, escrita no banco oficial ou
deploy foi produzido durante a criação deste congelamento.

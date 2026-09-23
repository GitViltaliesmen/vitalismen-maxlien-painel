# V176 — fila operacional somente com contatos aproveitáveis

Data: 2026-09-17

Status: candidata local autorizada pelo operador para o ponto exato descrito
abaixo. Ainda não publicada.

## Problema confirmado

A leitura somente leitura da API oficial encontrou oito projeções
`vslPrelead=true` da VSL Tex Ultra. As oito possuem:

- zero telefone real em `phone`;
- zero telefone na ficha `customerDraft.phone`;
- zero mensagem de WhatsApp;
- apenas identificadores de visita/sessão da VSL.

Esses identificadores não são telefone e nunca podem ser convertidos em um
número inventado. Enquanto o primeiro WhatsApp real não chega, não existe ação
comercial possível sobre esses cartões.

## Mudança autorizada

`public/qr.html` deixa de incluir na fila operacional qualquer item que atenda
simultaneamente às duas condições:

1. `vslPrelead === true`;
2. ausência de dígitos em `phone` e em `customerDraft.phone`.

Se um telefone legítimo estiver disponível em qualquer um desses dois campos,
o contato permanece visível. Um identificador técnico em `chat.id` nunca é
aceito como substituto de telefone.

## Preservado

- nenhum `VslVisit`, cliente, mensagem, pedido ou histórico é apagado;
- a API e a persistência VSL continuam inalteradas;
- a correlação do primeiro WhatsApp real continua inalterada;
- a página V175 continua mostrando os pré-leads anônimos separadamente;
- bot, funil, VSL, produtos, preços, Dropi, Meta/CAPI, Pixel, Purchase, Z-API,
  WhatsApp Web/Baileys, MongoDB e PM2 permanecem inalterados;
- nenhum telefone é criado, inferido ou cruzado sem evidência.

## Efeito esperado no painel

- os oito cartões `VSL · TEX ULTRA / AGUARDANDO WHATSAPP` deixam de ocupar a
  lista e os contadores operacionais;
- as 195 conversas comerciais identificadas permanecem visíveis;
- quando uma entrada VSL for consolidada com um WhatsApp real, o contato
  identificado volta a aparecer pelo fluxo normal;
- a telemetria Sales-first mantém os oito pré-leads para auditoria, sem tratá-los
  como clientes históricos ou vendas.

## Arquivos funcionais

- `public/qr.html` — única mudança de comportamento;

Os demais arquivos desta camada são exclusivamente contrato, guard e teste da
sucessão do congelamento V171.

## Rollback

Restaurar o release anterior remove somente o filtro visual. Nenhum rollback de
banco ou migração é necessário, pois a V176 não escreve nem remove dados.


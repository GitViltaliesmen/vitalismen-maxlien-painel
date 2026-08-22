# Microcamada V41 — busca exata de cliente no painel EC

Data: 2026-08-22.

## Decisão autorizada

Esta microcamada sucede a V40 e altera exclusivamente a busca da coluna de
conversas do painel oficial `public/qr.html`. O pedido do operador é localizar um
cliente pelo nome, telefone completo ou últimos dígitos, sem apresentar uma lista
de números sem relação com o que foi digitado.

## Causa comprovada

A função anterior pesquisava também em `lastMessage.body`, `orderId`, origem e
etiquetas. Na comparação numérica, aceitava ainda `queryDigits.includes(value)`,
permitindo que um trecho curto de pedido, mensagem ou marcador técnico coincidisse
com o telefone procurado. Por isso a lista podia parecer aleatória.

## Contrato V41

- a busca textual consulta somente os campos de identidade/nome do cliente;
- a busca numérica consulta somente campos plausíveis de telefone;
- telefone completo com ou sem formatação é reconhecido;
- telefone EC nos formatos `5939...`, `09...` e `9...` é tratado como a mesma identidade;
- os últimos dígitos usam comparação de sufixo do telefone;
- são exigidos pelo menos três dígitos para uma busca numérica;
- um ou dois dígitos não exibem uma lista ampla e mostram orientação objetiva;
- enquanto houver busca, os filtros de fila e `Novas/Tudo/Favoritas/Etiquetas` são ignorados somente na apresentação dos resultados;
- apagar a busca restaura imediatamente os filtros que já estavam selecionados;
- última mensagem, transcrição, mídia, pedido, etiqueta e origem não participam da decisão de busca;
- a coluna esquerda continua sem prévia de mensagem.

## Arquivos funcionais

- `public/panel-intelligence/chat-search-v41.js`;
- `public/qr.html`;
- `tests/panel-client-search-v41.test.mjs`.

## Preservado

Esta camada não altera contato, mensagem, histórico, bucket, nome persistido,
pedido, shipment, Dropi, Meta/CAPI, checkout, produto, preço, VSL, funil, áudio,
imagem, Z-API, número oficial, scheduler ou banco. A busca é inteiramente local no
navegador e não envia mensagens nem faz escrita na API.

Permanecem preservadas as quatro filas V40, a resposta inbound segura, os ajustes
V39 de nome/produto/pós-venda e todos os freezes anteriores.

## Testes obrigatórios

- últimos dígitos encontram apenas o telefone correspondente;
- telefone internacional formatado encontra apenas o cliente correto;
- formatos local e internacional EC convergem;
- nome ignora maiúsculas e acentos;
- texto da última mensagem e número do pedido não geram correspondência;
- um ou dois dígitos não geram lista ampla;
- busca ativa localiza o contato independentemente da aba/fila;
- a coluna esquerda permanece sem prévia de mensagem.

## Publicação e rollback

O pedido do operador em 2026-08-22 autoriza ajuste, validação, commit e publicação
da correção no painel oficial. A publicação continua transacional, com CI, tag,
staging, backup e validação posterior no navegador.

Rollback funcional: reativar a release V40
`/opt/vitalismen-automacao/releases/20260822T172707Z_production-20260822-d1a142a`.
Nenhum dado precisa ser revertido porque a V41 não escreve no banco.

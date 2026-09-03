# Dropi manual transport freeze V104 — 2026-09-02

## Objetivo

Corrigir a falha mascarada como `HTTP 0` no envio manual EC sem criar automação de pedidos, sem retentativa cega e sem alterar os demais produtos, funis ou transportes.

## Causa comprovada

O pedido não alcançava o `POST /bff/orders`. A execução ficava presa na tela legada de produto privado e terminava em `private catalog product not found`, mas o tratamento anterior descartava a etapa e a causa, devolvendo apenas `DROPI_ERROR HTTP_0`.

O produto oficial `110681` é público no catálogo BFF atual. Acrescentar `privated=true` à URL forçava uma rota incompatível. A sessão oficial já contém o catálogo EC de províncias e cidades; por isso não é necessário adivinhar IDs nem usar a API legada recusada.

## Microcamada V104

- Tex Ultra usa o catálogo BFF autenticado e exige o ID oficial configurado no produto.
- Província, cidade, bodega e origem são resolvidas nos catálogos persistidos pela sessão Dropi.
- A cotação ocorre em `/bff/orders/quote` e precisa devolver a transportadora escolhida com orçamento válido.
- O contrato de criação acompanha os campos do frontend BunnyHop atual.
- A busca autoritativa ocorre imediatamente antes do único POST de criação.
- Não existe segunda tentativa automática. Qualquer falha após despacho obriga nova busca autoritativa e retorna ao operador.
- O ciclo registra, sem segredo ou dado pessoal, início, despacho, resposta, parse, tempo, host, path e categoria de transporte.
- A dependência transitiva `qs` fica fixada em `6.16.0`, sem alterar a versão principal do Express, para que a auditoria obrigatória de staging permaneça limpa.

## Preservado

- envio continua manual e protegido por autorização em dois cliques;
- scheduler e backlog não criam pedidos Dropi;
- Vit Power e Nitrix continuam no comportamento anterior;
- preços e produto oficial Tex Ultra não mudaram;
- Z-API, WhatsApp, Meta/CAPI, painel, funil, memória, MongoDB e schema não mudaram;
- o único ajuste de dependência é o override transitivo de segurança de `qs`; Express permanece em `4.22.2`;
- nenhum país ou projeto externo foi tocado.

## Regra de liberação

Este freeze libera somente a correção do transporte manual. O pós-venda V66 permanece condicionado a uma criação real única, confirmada por ID Dropi e por consulta autoritativa posterior.

## Rollback

Reativar o release anterior pelo helper oficial V70. Não reenviar o pedido até executar a busca autoritativa, porque uma interrupção depois do despacho pode ter criado o pedido mesmo sem resposta local.

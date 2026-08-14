# Congelado - Camada Dropi Sessao Revalidada e Pedidos 2080/2082

Data: 2026-06-07

Status: aprovado/congelado apos regularizacao operacional.

## Ocorrencia

Os pedidos abaixo ficaram no painel como `confirmado`, mas o envio automatico para Dropi retornou `dropi_auth_required`:

- `EC-ADMIN-2082` - Martin Cervantes
- `EC-ADMIN-2080` - Jose Luis chiriguaya meza

O erro visto nos logs indicava que a automacao estava logada no painel Dropi, mas recebeu pagina/caminho momentaneamente invalido para o produto:

`Pagina no disponible / El producto`

## Regularizacao feita

- Sessao Dropi Ecuador revalidada com o fluxo oficial `performLogin`, usando TOTP automatico.
- Produto oficial testado e confirmado como disponivel:
  - URL: `https://app.dropi.ec/dashboard/product-details/103743/vit-powerss-1000-ml-x1-comunidad?privated=true`
  - Produto: `VIT POWERSS 1000 ML X1 / COMUNIDAD`
  - Botao `Enviar al cliente`: disponivel.
- Pedidos reprocessados sequencialmente, sem duplicar:
  - `EC-ADMIN-2082` enviado para Dropi como `5693139`.
  - `EC-ADMIN-2080` enviado para Dropi como `5693158`.
- Painel online atualizado para `pedido_enviado` em ambos.

## Estado congelado

Para ambos os pedidos:

- `Order.status`: `processing`
- `Shipment.review.reviewStatus`: `submitted`
- `Shipment.automation.browserCheckpoint`: `submitted_verified`
- transportadora: `SERVIENTREGA`
- status Dropi: `PENDIENTE`

## Regra congelada

Nao alterar sem autorizacao explicita:

- URL oficial do produto Dropi Ecuador `103743`;
- `performLogin` com TOTP automatico;
- persistencia em `.local/droppi-ec-storage.json`;
- fluxo `submitDroppiEcuadorOrder`;
- verificacao `submitted_verified` por painel/API antes de marcar como enviado;
- atualizacao do painel online para `pedido_enviado`.

Se voltar `dropi_auth_required` com pagina logada, primeiro revalidar sessao/produto e tentar reprocessar de forma sequencial. Nao classificar imediatamente como erro de destino/agencia.


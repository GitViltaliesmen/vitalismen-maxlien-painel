# Freeze V34 — origem Tex Ultra da VSL Protocolo G

## Escopo autorizado

A VSL pública `https://vilaliemen.shop/protocolo-g` promove **Tex Ultra
Ecuador**. O nome legado `vitpowers` do asset de Pixel pode permanecer porque
não representa o produto comercial da ficha.

Esta microcamada torna a origem do produto independente da flag global:

- `/protocolo-g` e seu payload WhatsApp rotulado abrem Tex Ultra Ecuador;
- `/n/` continua Tex Ultra, `/m/` continua Vit Power e entradas Nitrix
  explicitamente identificadas continuam Nitrix;
- `metadata.vslProductKey` preserva a origem da VSL;
- a seleção manual no painel grava uma trava da negociação atual por cliente e
  não altera `vslProductKey`;
- novo clique ou nova mensagem da VSL não sobrescreve uma troca manual
  divergente já gravada pelo operador.

## Preservado

- WhatsApp oficial `5515991418416` e teste controlado `5515998038637`;
- Pixel/CAPI legado, preços, checkout, Dropi, áudios e funis dos três produtos;
- seletor multiproduto do painel;
- bloco `Qualidade dos dados` V28 e todos os bloqueadores logísticos;
- mídia autenticada V30/V33 e toda a linhagem V28–V33.

## Efeitos no momento do freeze

Nenhuma mensagem WhatsApp, pedido, chamada Dropi, evento Meta, gravação no
banco oficial ou deploy foi executado para gerar este candidato.

## Validação obrigatória

```sh
npm run guard:protocolo-g-tex-ultra-v34
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
```

## Rollback

Restaurar o release V33 anterior e manter o storage compartilhado. A reversão
não deve apagar dados de cliente nem reescrever pedidos existentes.

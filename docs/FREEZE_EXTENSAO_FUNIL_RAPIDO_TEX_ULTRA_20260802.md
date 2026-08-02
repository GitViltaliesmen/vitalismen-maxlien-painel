# Freeze da extensao WhatsApp - Funil rapido Tex Ultra

Data da aprovacao operacional: 2026-08-02.

Versao congelada: `0.12.5`.

## Escopo aprovado

- O botao `Funil` preserva o funil geral.
- O botao `Preco Tex Ultra` fica permanentemente visivel em qualquer conversa.
- A barra ocupa uma unica linha de 39 px e usa rolagem horizontal quando necessario.
- O funil rapido oferece 1, 2, 3 e 6 frascos do Tex Ultra.
- Os atalhos `Nombre`, `Direccion` e `Envio agencia` apenas preenchem o compositor.
- Nenhum botao do funil rapido envia mensagem automaticamente.
- A definicao da campanha ativa fica isolada em `quick-price-active-product.js`.
- Os funis assistidos de Tex Ultra, Nitrix e Vit Power permanecem em arquivos independentes.

## Publicacao validada

- Pasta carregada pelo Chrome: `CARREGAR_ESTA_PASTA_FUNIL_FLUTUANTE_V051`.
- ID da extensao: `laeclnomjioffoliaofecojodlkiplga`.
- Release publicada na VPS: `/opt/vitalismen-automacao/releases/20260802T145419Z_permanent_quick_button`.
- Servico `vitalismen-automation`: online, sem reinicio para esta alteracao visual.
- Validacao automatizada: quatro ofertas, tres atalhos, barra em uma linha, visibilidade permanente e zero chamadas outbound.

## Checksums SHA-256

- `manifest.json`: `d9a798b67fac5581c8dee6d37855b7b773192652f535075107441a1dd6c732e7`
- `release.json`: `a30d68577dbb4b15a271553a9e3152c65014ba2677552e585a72642b43db66f5`
- `whatsapp-funnel-launcher.js`: `61afdd029c32d9e679aed36f2e28c181dacb8a91e9f923a812811655cfdc35df`
- `quick-price-active-product.js`: `e611513a3ebbc9e9cdb17485353302147b2e30dc1d1917d2d95f0c55826eac25`
- `quick-price-funnel-library.js`: `835356feb8e32fd9cc7cd9c30d0e2537dcb52f025737b68bd2ae3a2557971e70`
- `quick-price-funnels/tex-ultra-ec.js`: `cceade2bf534d9005cad0e4f5ad6f2277ffe72d493b52996096a3b451f28a7b6`

## Regra de mudanca

Qualquer alteracao posterior na altura, visibilidade, textos, precos, produto ativo ou comportamento de envio deve ser feita em nova versao e nao pode sobrescrever este freeze sem aprovacao explicita do operador.

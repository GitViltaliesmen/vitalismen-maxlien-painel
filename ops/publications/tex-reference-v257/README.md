# PLUSMEN TEX — referência da CTA V257

Autorização de 23/11/2026: acrescentar o código individual à mensagem pré-preenchida de WhatsApp da CTA Tex. Esta é uma exceção pontual ao texto limpo V245. A frase inicial, número, CTA, player, Turbo, HTML, vhost, cloaker, bot, banco, Meta e campanhas ficam preservados.

O único arquivo público candidato é `/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js`. No clique em `#preco_89`, o handler lê `TexUltraMeasurementV243.reference()` e acrescenta `\nReferencia: TX243-<64 hex>` somente quando a referência é válida. Sem referência disponível, abre o WhatsApp com a frase original. O fallback `wa.me` usa a mesma mensagem. O `InitiateCheckout` V256 permanece antes da abertura.

Preimagem V256: `c1a6e560b967601ead74ad23a9e1e017651c4b19007d37bc7722ab75063333dc`. Candidata V257: `1843b5a26b28d08535b7fec5e60d623d2f7a0642b3795d177f858664479b7ee3`. A inversão dos dois patches deve reproduzir exatamente a preimagem.

## Gates

1. `node ops/publications/tex-reference-v257/tests.mjs` — simulação sem rede e sem mensagem real.
2. `node scripts/guard-plusmen-tex-freeze.mjs` no workspace oficial V256 **antes** da troca.
3. `node scripts/guard-plusmen-tex-reference-v257.mjs --expect-before` antes da troca e `--expect-after` após a troca.
4. Validar sintaxe do asset, hash servido na URL pública, HTTP 200 móvel/desktop e hashes dos cinco arquivos preservados.
5. O primeiro inbound real com referência deve ser verificado pelo ID da mensagem, `ContactState.metadata.texMeasurementV243`, recibo `Lead` e eventual pedido novo. A abertura da mensagem preparada não prova envio pelo cliente.

O aplicador `deploy.py` aceita `audit`, `apply` e `rollback`. Ele exige manifesto íntegro, preimagem exata, backup com hash, metadados regulares e hashes dos arquivos preservados. Não reinicia serviço nem altera Nginx. Recibos `Purchase` históricos aceitos em outro dataset não são reenviados.

## Publicação e limites da verificação

Publicado em 23/11/2026 17:57:50 UTC exclusivamente no asset acima. Backup privado verificado em `/root/plusmen-tex-reference-v257-20261123/backup/whatsapp-tex-v243.js`, SHA-256 `c1a6e560b967601ead74ad23a9e1e017651c4b19007d37bc7722ab75063333dc`. O asset público respondeu HTTP 200 e SHA-256 `1843b5a26b28d08535b7fec5e60d623d2f7a0642b3795d177f858664479b7ee3` com `CF-Cache-Status: BYPASS`. O guard V257 pós-publicação passou para o arquivo novo e os cinco arquivos preservados. Mobile Tex e desktop informativo responderam HTTP 200, com os títulos e player esperados.

O parser V243 do backend oficial aceitou em teste local a mensagem com referência. O teste foi simulado, sem envio real. Na consulta imediatamente posterior, ainda não havia inbound real novo com referência; portanto, `Lead`, `Purchase` e atribuição de campanha para uma nova jornada continuam **pendentes de recibo real**. A página apenas prepara a mensagem: o cliente precisa enviá-la no WhatsApp.

Rollback exclusivo, se necessário: `python3 -I -B -S /root/plusmen-tex-reference-v257-20261123/deploy.py rollback` na origem oficial, após conferir o hash atual V257. A reversão volta somente o asset WhatsApp ao SHA-256 V256; não toca na VSL, no bot, na Meta ou em campanhas.

PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat Tex Ultra liberado junto com WhatsApp — V244 — 17/11/2026

Pedido explícito do operador: liberar o chat da VSL somente junto com o WhatsApp, para não confundir o cliente no início. Publicado em https://plusmen.shop/tex, fonte1972bd33702067cc0182339fbac2d2e6196a006c.

Somente `/var/www/plusmen-tex-vsl-v1/assets/chat-tex-ultra.js` mudou. O botão do chat nasce oculto, inclusive diante do `display:block` da folha existente. A primeira CTA nativa `preco_89` renderizada, visível e habilitada libera o launcher. O chat só abre quando o cliente clica. A observação inclui shadow DOM tardio e retomada pelo cache do navegador; a consulta DOM a cada500ms não libera por tempo decorrido. Depois da primeira liberação o atendimento permanece disponível naquela página, preservando a conversa em andamento. Uma página nova volta a aguardar sua própria CTA; se a CTA já estiver liberada numa retomada do vídeo, o chat acompanha esse estado.

Player6aafe87d665f0c5b457748ad, timeline2257s, Turbo1.2x, vídeo, CTA, telefone e mensuração permanecem iguais. HTML/CSS, Nginx, backend, funil, identidade entre canais, voz Ana Lopez e página informativa de desktop foram preservados. Não houve restart de PM2 ou Nginx. Backend permaneceu no release d27cc7c7f2a21ad74e02ca5b6332ee50b151399b, PID3896107; origem permaneceu no PID1314328. Health online e Z-API conectada.

## Validação

14 verificações em Brave headless, viewport390x844 móvel, reproduziram o launcher antecipado do baseline e validaram a correção: ocultação inicial, clique antecipado sem API, shadow root tardio, opacity, disabled, player oculto, liberação pela CTA, abertura do fluxo existente, ausência de início repetido, página nova, BFCache, CTA já liberada e rota alheia. Fixture sem serviços externos, pedido, envio WhatsApp, chamada de modelo/voz ou evento Meta. Não equivale a reprodução física integral da VSL.

O guard completo passou antes, em mount privado com o candidato e em produção após a publicação. O teste negativo rejeitou telefone alterado mesmo com novo hash declarado. O sucessor congela três patches exatos e sua inversão por bytes; manifestos V240/V242/V243 e dispositivo permanecem imutáveis. Onze arquivos protegidos mantiveram os hashes.

Oito combinações públicas de dispositivo/rota conservaram os mesmos HTMLs. A referência real injetada `/tex-assets/chat-tex-ultra.js?v=20261117-v240-r7` entrega exatamente o código testado, SHA256 `0d43e20374ea9f2332fd8065b5bc16500a7800f2961bd0744985b818e4b0dfc3`, com Cache-Control:no-store. Não foi necessário mudar a referência do HTML/Nginx. Clientes que já tinham a página aberta precisam recarregá-la para executar o arquivo novo.

## Fonte, backup e recuperação

Arquivo oficial lido antes de editar e guard anterior com PASS. Backup anterior `/root/plusmen-tex-chat-cta-v244-20261117/before-chat-tex-ultra.js`, SHA256 `e5a2c9b4816c46883acd4db5d8bb1ee0218748ed9fb0d58bafc81d5c8dfbdb0b`. Baseline, candidato, recibo e verificador em `/root/plusmen-tex-chat-cta-v244-20261117`. Fonte e fixture em `ops/publications/tex-chat-cta-v244/`. Este backup é de código público; não é backup global MongoDB.

Rollback exclusivo: depois de conferir ausência de alterações posteriores, restaurar atomicamente somente o JS anterior com dono root:root e modo0644. Restaurar também o verificador local correspondente ao baseline anterior, conservando o manifesto V244 como histórico; o guard anterior exato está no parent852ae12089d00cd9d765f1f74b532e7e9576a762 e no snapshot local `ops/candidates/tex-chat-cta-gate-v244-20261117/guard.before-v244.mjs`. Conferir o guard completo e a resposta pública. Não restaurar backend, banco, Nginx, telefone, vídeo, Meta ou dependências.

Evidência: docs/evidence/tex-ultra-chat-cta-v244-20261117.json. Nenhum efeito em anúncios, orçamento, pedidos ou envios de teste.

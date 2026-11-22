# Candidata V256 — checkout da CTA Tex

Estado em 21/11/2026: **assets V256 publicados na origem e servidos pela Cloudflare; aceitação de um novo clique pela Meta ainda pendente de evidência real**. Origem comercial: `https://plusmen.shop/tex`. Os bytes V250/V251 da origem foram obtidos e comparados com esta candidata antes da publicação.

## Publicação V256 após recuperação de acesso

- O guard `node scripts/guard-plusmen-tex-freeze.mjs` passou antes e depois. O manifesto selado está em `docs/freeze/tex-checkout-v256-20261121.json` (SHA-256 `831ff907a2e9db0fa3b72523ad5760e5df82ec1db83bb4d20506e9eaccb775b7`).
- Somente `/var/www/plusmen-tex-vsl-v1/assets/meta-tex-ultra.js` e `/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js` foram substituídos. A auditoria de preimagem confirmou os hashes anteriores. O aplicador `deploy.py` criou backup verificado em `/root/plusmen-tex-checkout-v256-20261121/backup` na origem oficial.
- A auditoria posterior confirmou os hashes publicados `6fc15b7d30971703f39ec4eb8aa0be9539caf1cc19540762f780fa8d7e62b4e3` e `c1a6e560b967601ead74ad23a9e1e017651c4b19007d37bc7722ab75063333dc`. Os dois assets públicos retornaram HTTP 200 pela Cloudflare com esses mesmos hashes e `CF-Cache-Status: BYPASS`.
- O teste isolado de CTA, pixel, deduplicação, consentimento, rota paralela e redirecionamento WhatsApp passou. `node --check` passou nos dois assets. Nenhuma mensagem WhatsApp ou conversão Meta sintética foi enviada.
- O HTML, player, script nativo `whatsapp.js`, bot e banco EC não foram alterados nesta publicação. As compras já aceitas em outros datasets permanecem intactas.
- Verificação pendente: aguardar clique comercial real novo e confirmar recibo `InitiateCheckout` aceito no pixel `1100892582698669`, seguido da leitura na conta de anúncios correta. A publicação do JavaScript não comprova, por si, a atribuição na campanha.
- A correlação `Purchase` Plusmen → inbound continua sem prova individual porque a mensagem oficial de WhatsApp não carrega o marcador V243; nenhuma compra histórica foi reenviada. Essa etapa precisa de um desenho prospectivo autorizado que preserve a mensagem aprovada.

A regra posterior no `AGENTS.md` define o clique comprovado em `#preco_89` como `InitiateCheckout` prospectivo. O candidato chama o emissor apenas nesse clique, conserva o `event_id` por sessão de aba, aceita o evento novo na fila e descarta eventos antigos da rota sem marca de clique. Preserva o destino WhatsApp, o texto, o pixel de navegador `1100892582698669`, as outras rotas e a recusa por consentimento.

Teste isolado: `node ops/publications/tex-checkout-v256-candidate/tests.mjs`. Ele intercepta Meta e WhatsApp, sem rede nem mensagens reais. Sintaxe: `node --check` nos dois arquivos JavaScript.

## Auditoria de 21/11/2026

Na produção Hostinger oficial, de 18/11/2026 00:00 UTC em diante, há 21 mensagens inbound Z-API com a frase exata da CTA, em 21 chats distintos; os 21 têm `ContactState` persistido. Desses, 17 têm vínculo V242 e nenhum tem marcador de atribuição V243. Isso comprova a persistência das mensagens observadas, não que todos os cliques na página chegaram ao WhatsApp.

No mesmo intervalo há 14 pedidos Tex confirmados; 13 têm `Purchase` com aceite V254 e um conserva recibo anterior. Todos indicam o dataset `920532663934291`, sem `measurementVersion=243` nem `attributionSource=tex_verified_first_touch_v243`. O vinculador V243 exige `Referencia: TX243-...` no inbound, enquanto a CTA oficial V245 envia somente `Hola, quiero el tratamiento Tex Ultra.`. Essa remoção foi deliberada. Os 14 pedidos não podem ser atribuídos retroativamente ao pixel `1100892582698669` sem prova individual da origem; os recibos aceitos não devem ser reenviados.

## Condições antes de publicação

1. Obter e comparar os bytes atuais dos assets da origem Plusmen com a candidata; aplicar somente o delta autorizado e passar o guard de freeze da página.
2. Confirmar na própria conta Meta `1088255310505694` o pixel `1100892582698669`, permissão do token, anúncio/conjunto, janela e evento de otimização. As tentativas atuais de Graph API retornaram 401/403. A interface do Gerenciador de Eventos mostrou o conjunto `MANUELA_SANTOS_LATAM_CO` (`1100892582698669`) associado a `plusmen.shop`, com PageView e ViewContent ativos; o último `InitiateCheckout` tinha cerca de dois dias e não havia `Purchase` na lista de eventos do período de 17 a 21/11. Essa leitura não comprova atribuição de campanha.
3. Definir uma correlação prospectiva consentida entre a visita Plusmen e o inbound sem reintroduzir automaticamente a referência visível proibida pela V245. Confirmar com o operador qualquer mudança na mensagem oficial.
4. Executar teste autenticado isolado da CTA, recibo de aceitação do evento no conjunto correto e observação de jornada real posterior. Criar backup verificável e sucessor selado antes de ativar; verificar página e Meta após a ativação.

Não houve evento Meta, mensagem WhatsApp, lead ou pedido sintético nesta auditoria. Não se alterou a produção nem a configuração da conta.

## Histórico: bloqueio de publicação observado antes da recuperação da origem

- O navegador exibiu Cloudflare HTTP 522 para `/tex` e para `/tex-assets/meta-tex-ultra.js` (Ray ID `a5dfa8a20fb424cd`, horário exibido `2026-11-21 12:22:33 UTC`). Leituras HTTP independentes dos dois caminhos expiraram após 12 segundos sem bytes. A conectividade TCP da origem registrada `169.58.51.100` falhou nas portas 22 e 443; uma tentativa de SSH de leitura via VPS Hostinger oficial também expirou durante o banner. Isso impede comparar os bytes atuais da VSL e executar teste real da CTA.
- `node scripts/guard-plusmen-tex-freeze.mjs` terminou com erro 255 de SSH e a mensagem explícita: “Freeze Plusmen Tex divergente ou origem indisponível; não publicar nem corrigir automaticamente.” A falha é de cobertura da origem, não prova divergência dos arquivos.
- `node ops/publications/tex-checkout-v256-candidate/tests.mjs` passou na simulação isolada; `node --check` passou nos dois JavaScript candidatos. Esses resultados não substituem o guard nem o teste público autenticado.
- Na Hostinger oficial, desde a ativação V254, nove pedidos EC confirmados (cinco Tex, três Nitrix e um Vit Power) têm recibos `Purchase` aceitos pela Meta, com `events_received > 0`. Oito foram ao dataset `920532663934291` e um ao `28298613626504767`; nenhum desses recibos deve ser reenviado ou atribuído retroativamente ao pixel Tex sem prova individual.

**Decisão naquela auditoria:** manter V256 como candidata enquanto a origem estava inacessível. O acesso foi recuperado e a publicação limitada dos dois assets está documentada acima. O gate de aceitação real pela Meta e atribuição publicitária continua pendente.

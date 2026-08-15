# Auditoria Meta Purchase Attribution V2 — Equador

Data da auditoria: 2026-08-15

Período operacional examinado: 2026-08-12 00:00 até 2026-08-16 00:00, horário do Equador (`America/Guayaquil`; fim exclusivo)

Dataset/Pixel: `1468946114265008`

Landing declarada: `https://vilaliemen.shop/protocolo-g`

Release de produção auditada: `b53e575b832e28a970bf9c8165e2513e933c0890`

Release ativa na VPS durante a auditoria: `/opt/vitalismen-automacao/releases/20260815T045340Z_ec_universal_metrics_b53e575`

Branch de recuperação anterior às alterações: `backup/meta-purchase-attribution-v2-prechange-20260815`

Este relatório não contém access token, telefone, nome, e-mail, IP, cookie Meta ou outro segredo em texto puro. Nenhum evento, pedido, lead, mensagem, backfill ou escrita de banco foi executado durante a coleta das evidências de produção.

## 1. Diagnóstico atual

O `Purchase` chega à Meta, mas chega sem a identidade original do clique. No recorte solicitado foram encontrados:

- 22 pedidos EC elegíveis, confirmados e com valor positivo;
- 22 registros de `Purchase` enviados;
- 22 respostas armazenadas com `events_received: 1`;
- 22 `event_id` únicos e nenhum `event_id` repetido entre os pedidos;
- 22 eventos classificados pelo código antigo como `action_source = website`;
- 22 eventos web sem `event_source_url`;
- zero pedidos com `fbc`, `fbp`, `fbclid`, UTM ou `external_id`;
- zero pedidos com e-mail ou CEP;
- 22 pedidos com telefone, nome, cidade e província;
- 22 pedidos com IP/UA legados, mas zero com IP/UA comprovadamente capturados da sessão original do cliente;
- o mesmo hash de UA legado nos 22 pedidos, compatível com o navegador do operador que confirmou as vendas;
- quatro hashes de IP legados, distribuídos em 10, 8, 2 e 2 pedidos;
- zero correlações por telefone entre esses 22 pedidos e `VslVisit`.

Configuração confirmada na VPS, sem imprimir segredo: Pixel `1468946114265008`, token configurado, modo de teste desligado e Graph API `v20.0`.

### Resposta objetiva sobre X Purchases versus Y vendas

Para o intervalo auditado, `X = 22` Purchases aceitos e armazenados e `Y = 22` vendas reais elegíveis. Portanto, o indício de mais eventos do que vendas **não foi reproduzido nesse recorte nas fontes de verdade disponíveis**.

Havia, contudo, risco real de reenvio concorrente: quatro serviços/endpoints diferentes consultavam `metaPurchaseSentAt` antes do envio e só gravavam a trava depois da resposta da Meta. Duas requisições simultâneas podiam ultrapassar a consulta antes de qualquer uma gravar o campo. O `event_id` permanecia estável (`orderId`), o que permite deduplicação lógica pela Meta, mas o sistema não persistia tentativas e não mantinha log de cada sucesso HTTP; por isso não é possível provar ou excluir tentativas HTTP históricas extras apenas pelo banco atual.

### Mapa do fluxo observado antes da correção

```text
ANÚNCIO META
  fbclid + parâmetros de URL
    ↓
VILALIEMEN /protocolo-g (variante móvel)
  cria/preserva _fbc, _fbp, ext_id e UTMs
  envia Lead Browser + CAPI para /api/public/track do próprio domínio
    ↓
REDIRECIONAMENTO WHATSAPP
  buildRedirectUrl retorna cedo ao reconhecer configuração WhatsApp
  mensagem contém somente intenção + nome + telefone
  fbclid/fbc/fbp/UTMs/ext_id NÃO seguem na mensagem nem chegam ao Vitalismen
    ↓
ENTRADA WHATSAPP / FICHA MANUAL
  pedido é criado com source=manual
  nenhum VslVisit correspondente existe na base Vitalismen
    ↓
CONFIRMAÇÃO NO PAINEL
  req.ip e user-agent do operador eram gravados no pedido
    ↓
PURCHASE CAPI
  action_source=website por fallback do source=manual
  event_source_url ausente
  fbc/fbp/fbclid/UTM/ext_id ausentes
  IP/UA pertencem ao contexto do operador
  event_time usa o instante do envio/retry
```

### Evidência da landing pública

A inspeção HTTP somente leitura mostrou duas variantes no mesmo endereço:

- móvel: HTTP 200, cabeçalho `X-Protocolo-G-Variant: vsl-mobile`, SHA-256 do HTML `c8ad257dcd91303af5447ac02df9715330dbca0295192748bf28b36f209c6b0a`;
- desktop: HTTP 200, cabeçalho `X-Protocolo-G-Variant: informativa-desktop`, SHA-256 do HTML `a9588f6cf27195fdc01ed56b248ab9b20faea93120a0748d13faf8c766fa2816`;
- JavaScript móvel `tracking-protocolo-g.js?v=20260807-protocolo-g-1786069952`: 70.508 bytes, SHA-256 `fa26e52fa8fb0f3c9f0b16792fb0b64b4d2d78c95a3c20f58c68e103b38a2c1c`.

O script móvel gera `_fbc`/`_fbp`, envia `Lead` ao backend próprio e monta a mensagem `Hola, quiero el tratamiento` com nome e telefone. Ao detectar os atributos WhatsApp, `buildRedirectUrl` retorna o destino `wa.me` antes do bloco que anexaria UTMs e sinais Facebook. Essa é a perda comprovada entre landing e pedido.

## 2. Causa raiz

Há quatro causas combinadas:

1. **Quebra de correlação entre infraestruturas.** A landing `vilaliemen.shop` captura a atribuição em cookies e em `/api/public/track`, mas o projeto Vitalismen e sua VPS não hospedam esse backend nem recebem um identificador de correlação. O WhatsApp recebe somente nome/telefone.
2. **Classificação incorreta de pedidos manuais.** O código antigo tratava todo pedido que não tivesse `source === whatsapp` como web. Assim, `source=manual` virava `website` sem URL real.
3. **Contaminação por dados do administrador.** Os endpoints de confirmação/ficha usavam `req.ip` e `user-agent` da requisição do painel para preencher o pedido, e esses valores eram enviados como se pertencessem ao cliente.
4. **Idempotência não atômica e horário não persistido.** `metaPurchaseSentAt` era consultado antes do POST e salvo depois dele, com vários chamadores independentes. `event_time` usava `Date.now()` quando o chamador não informava horário.

O Event Match Quality aproximado de 5,2/10 é coerente com o payload observado: nome, telefone, cidade, província e país existiam, mas não havia `fbc`, `fbp`, e-mail, CEP, `external_id` nem IP/UA originais. O alerta de `event_source_url` também é explicado integralmente: os 22 eventos eram marcados como `website` sem URL.

## 3. Arquivos envolvidos

### Fluxo antigo inspecionado

- `src/services/metaConversionsService.js`: construção e POST do payload CAPI;
- `src/services/metaAttributionService.js`: ponte `VslVisit → Order`;
- `src/services/metaAttributionBridgeService.js`: correlação conservadora da mensagem WhatsApp;
- `src/routes/leads.js`: entrada pública de lead/checkout;
- `src/routes/orders.js`: criação, confirmação e envio de Purchase;
- `src/routes/whatsapp.js`: `vsl-entry` e confirmação pela ficha;
- `src/services/conversationEngine.js`: confirmação pelo motor de conversa;
- `src/services/texUltraFunnelService.js`: confirmação no funil Tex Ultra;
- `scripts/send-meta-retro-purchases.mjs`: rotina retroativa;
- `src/services/adminPanelStatusService.js`: espelho SQLite posterior ao envio;
- `public/n/index.html`: VSL hospedada no projeto Vitalismen;
- landing pública externa `vilaliemen.shop/protocolo-g` e seus scripts, somente inspecionados via HTTP.

### Arquivos alterados localmente nesta auditoria

- `src/models/Order.js`;
- `src/models/VslVisit.js`;
- `src/services/metaAttributionService.js`;
- `src/services/metaConversionsService.js`;
- `src/routes/leads.js`;
- `src/routes/orders.js`;
- `src/routes/whatsapp.js`;
- `src/services/conversationEngine.js`;
- `src/services/texUltraFunnelService.js`;
- `src/index.js`;
- `scripts/send-meta-retro-purchases.mjs`;
- `scripts/audit-meta-purchase-attribution-v2.mjs` (novo);
- `scripts/guard-public-funnel.mjs`;
- `scripts/guard-tex-ultra-approved-v6.mjs` (novo);
- `tests/meta-purchase-attribution-v2.test.mjs` (novo);
- `src/services/texUltraApprovedFreezeRuntimeGuardV6.js` (novo);
- `docs/freeze/tex-ultra-meta-attribution-v6-20260815.json` (novo);
- `docs/TEX_ULTRA_META_ATTRIBUTION_FREEZE_V6_20260815.md` (novo);
- `package.json`;
- `AUDITORIA_META_PURCHASE_ATTRIBUTION_V2.md` (novo).

O arquivo preexistente não rastreado `scripts/.codex-inspect-dropi-6530124.mjs` pertence ao usuário e não foi aberto, alterado nem incluído.

## 4. Banco/tabelas envolvidos

### MongoDB

`orders`/modelo `Order` é a fonte de verdade do pedido e já armazenava `fbclid`, `fbc`, `fbp`, `ext_id`, UTMs, `sourceUrl`, IP/UA legados e o resultado de Purchase. Foram adicionados campos opcionais e compatíveis, sem apagar ou migrar registros antigos:

- cliente: `email`, `zip`;
- atribuição: `landingUrl`, `originalReferrer`, `metaCampaignId`, `metaAdsetId`, `metaAdId` e nomes opcionais;
- origem legítima: `clientIpOriginal`, `clientUserAgentOriginal`;
- auditoria/idempotência: `metaPurchaseEventTime`, `metaPurchaseAttempts`, `metaPurchaseLastAttemptAt`, `metaPurchaseInFlightAt`, `metaPurchaseLastError`.

`vslvisits`/modelo `VslVisit` já armazenava URL, referrer, UA, hash de IP, UTMs e sinais Meta. Foram adicionados campos opcionais para IP/UA originais futuros, capturados no endpoint público real. A ponte passou a completar campos ausentes sem substituir qualquer valor confiável já salvo.

### SQLite operacional

`/opt/maxlien-mvp/leads_ec.sqlite3`, tabela `purchase_capi_lock`, contém uma linha única por `lead_id`, mas é atualizada **depois** do envio. No recorte havia 22 locks, todos com `event_id` distinto e status `sent`. Ela continua útil como espelho do painel, mas não era uma trava atômica anterior ao POST e pode sobrescrever o histórico quando o mesmo lead é atualizado.

Nenhuma migration foi necessária: os schemas Mongo são aditivos e os campos antigos permanecem legíveis.

## 5. Payload antigo

Exemplo sanitizado representativo dos 22 pedidos:

```json
{
  "event_name": "Purchase",
  "event_time": "<instante-do-envio-ou-retry>",
  "event_id": "EC-<ORDER_ID>",
  "action_source": "website",
  "user_data": {
    "fn": ["<sha256>"],
    "ln": ["<sha256>"],
    "ph": ["<sha256>"],
    "ct": ["<sha256>"],
    "st": ["<sha256>"],
    "country": ["<sha256>"],
    "client_ip_address": "<IP-do-contexto-admin>",
    "client_user_agent": "<UA-do-painel>"
  },
  "custom_data": {
    "currency": "USD",
    "value": 80.99,
    "order_id": "EC-<ORDER_ID>",
    "content_ids": ["tex_ultra_ec"],
    "contents": [{ "id": "tex_ultra_ec", "quantity": 3, "item_price": 27 }],
    "content_type": "product"
  }
}
```

`event_source_url`, `fbc`, `fbp` e `external_id` não estavam serializados. O `event_id`, o valor, USD, produto e quantidade estavam corretos.

## 6. Payload corrigido

### Compra com origem web comprovada

```json
{
  "event_name": "Purchase",
  "event_time": "<confirmedAt-original-em-segundos>",
  "event_id": "EC-<ORDER_ID-estável>",
  "action_source": "website",
  "event_source_url": "https://vilaliemen.shop/protocolo-g",
  "user_data": {
    "em": ["<sha256-quando-disponível>"],
    "fn": ["<sha256>"],
    "ln": ["<sha256>"],
    "ph": ["<sha256>"],
    "ct": ["<sha256>"],
    "st": ["<sha256>"],
    "zp": ["<sha256-quando-disponível>"],
    "country": ["<sha256>"],
    "external_id": ["<sha256-do-id-original>"],
    "client_ip_address": "<IP-original-do-cliente>",
    "client_user_agent": "<UA-original-do-cliente>",
    "fbc": "<fbc-original>",
    "fbp": "<fbp-original>"
  },
  "custom_data": {
    "currency": "USD",
    "value": 80.99,
    "order_id": "EC-<ORDER_ID>",
    "content_ids": ["tex_ultra_ec"],
    "contents": [{ "id": "tex_ultra_ec", "quantity": 3, "item_price": 27 }],
    "content_type": "product"
  }
}
```

### Compra manual/WhatsApp sem prova de origem web

Não é fabricada uma URL. O payload usa `action_source = business_messaging` e `messaging_channel = whatsapp`, sem `event_source_url`, `fbc`, `fbp`, IP ou UA falsos. Se a atribuição web verdadeira chegar ao pedido antes da confirmação, o mesmo pedido passa legitimamente para o payload web acima.

Segundo o exemplo oficial do [Meta Business SDK for Node.js](https://github.com/facebook/facebook-nodejs-business-sdk/blob/main/README.md), eventos de servidor suportam `event_source_url`, `action_source`, `user_data`, `custom_data`, `event_id` e dados de contexto do cliente. A documentação web do Meta Developers respondeu HTTP 429 durante esta auditoria; por isso a referência primária acessível usada foi o SDK oficial.

## 7. Diferenças

| Área | Antes | Correção local |
| --- | --- | --- |
| URL web | `website` podia sair sem URL | `website` exige URL HTTP(S) real; painel, localhost e `/api` são recusados |
| Pedido manual | fallback para `website` | `business_messaging` quando não há prova web |
| IP/UA | podia usar requisição do painel | somente `clientIpOriginal`/`clientUserAgentOriginal`, ou legado de checkout web comprovado |
| Event time | instante do envio | `confirmedAt → entryAt → draftCreatedAt → createdAt` |
| Event ID | `orderId`, estável | preservado como `orderId`, estável |
| Idempotência | consulta e gravação não atômicas | claim Mongo atômico antes do POST, timeout e finalização condicionada ao mesmo lock |
| Aceite | qualquer HTTP 2xx marcava enviado | somente `events_received > 0` grava `metaPurchaseSentAt` |
| Retry | sem contagem e sujeito a corrida | incrementa tentativas e reutiliza o mesmo event ID |
| Atribuição parcial | um único sinal podia bloquear enriquecimento | visita completa somente campos ausentes; valores existentes nunca são sobrescritos |
| `_fbc` derivado | timestamp em segundos | timestamp em milissegundos, alinhado ao formato já produzido pela landing |
| Campaign/ad IDs | não tinham campos dedicados | campos opcionais persistentes e relatório interno |
| CORS | landing vilaliemen não permitida | origens `vilaliemen.shop` e `www.vilaliemen.shop` preparadas no backend |

## 8. Duplicidades encontradas

Não foram encontrados `orderId` nem `event_id` duplicados entre os 22 pedidos. Não existe Purchase Browser no repositório Vitalismen; o Purchase encontrado é Server/CAPI.

O risco de duplicidade estava no desenho dos chamadores:

- confirmação em `src/routes/orders.js`;
- confirmação pela ficha em `src/routes/whatsapp.js`;
- confirmação em `src/services/conversationEngine.js`;
- confirmação em `src/services/texUltraFunnelService.js`;
- rotina manual retroativa.

Todos verificavam `metaPurchaseSentAt`, mas nenhum fazia claim atômico anterior ao POST. O teste novo disparou seis chamadas concorrentes para o mesmo pedido e confirmou uma única chamada Graph simulada, uma tentativa persistida e o mesmo `event_id` em todos os retries.

## 9. Perda de fbc/fbp encontrada

A perda ocorreu antes do pedido:

1. a URL do anúncio chega à landing;
2. o script grava `trk_qs`, `_fbc`, `_fbp` e `ext_id`;
3. o Lead CAPI do domínio da landing recebe esses dados;
4. o formulário monta somente nome e telefone na mensagem WhatsApp;
5. o retorno antecipado de `buildRedirectUrl` impede anexar UTMs/identificadores ao destino;
6. o backend Vitalismen não possui a visita, o cookie ou um correlation ID;
7. a confirmação não consegue recuperar o clique.

Resultado observado: 22 de 22 pedidos sem `fbc`; 22 de 22 sem `fbp`; 22 de 22 sem `fbclid` ou UTM.

A correção neste repositório preserva esses valores quando chegarem pelos endpoints públicos e pela ponte `VslVisit`. Ela não inventa identificadores para os 22 pedidos antigos.

## 10. event_source_url

Antes, os 22 pedidos manuais eram marcados como web e nenhum tinha URL. Depois da correção local:

- origem web comprovada: `action_source=website` e URL real normalizada, sem fragmento;
- URL de painel, localhost, rede privada, `/api`, `/admin`, `/qr`, `/leads-window` e `/funnel-metrics`: rejeitada;
- clique/UTM de origem web sem URL real: envio web bloqueado com erro auditável em vez de enviar um evento inválido;
- pedido manual/WhatsApp sem prova web: `business_messaging`, sem URL fabricada.

`https://vilaliemen.shop/protocolo-g` somente será usada quando tiver sido persistida na jornada real daquele lead/pedido.

## 11. event_id/deduplicação

O identificador existente `order.orderId` foi preservado. Trocar agora para outro prefixo criaria uma segunda identidade para pedidos já conhecidos; portanto `EC-...` é o equivalente estável e determinístico aprovado pelo fluxo atual.

A nova sequência é:

1. construir e validar payload;
2. fazer `findOneAndUpdate` atômico se `metaPurchaseSentAt` estiver vazio e não houver lock ativo;
3. gravar `metaPurchaseEventId`, `metaPurchaseEventTime`, `metaPurchaseInFlightAt`, `metaPurchaseLastAttemptAt` e incrementar `metaPurchaseAttempts`;
4. somente o processo que obteve o claim faz o POST;
5. somente `events_received > 0` grava `metaPurchaseSentAt`;
6. erro ou resposta sem aceite libera o lock;
7. retry usa o mesmo `orderId`/`event_id`.

## 12. Matching

### Antes, no recorte de produção

| Sinal | Cobertura |
| --- | ---: |
| telefone hasheado | 22/22 |
| first name | 22/22 |
| last name | 21/22 (um cadastro tinha somente uma parte de nome) |
| cidade | 22/22 |
| província/estado | 22/22 |
| país | 22/22 |
| e-mail | 0/22 |
| CEP | 0/22 |
| external_id | 0/22 |
| fbc | 0/22 |
| fbp | 0/22 |
| IP/UA originais | 0/22 |
| IP/UA legados do painel | 22/22 |

### Depois, para novos pedidos corretamente integrados

- e-mail e CEP são opcionais e só entram quando legitimamente coletados;
- nome, telefone, cidade, província e país continuam normalizados e hasheados;
- `external_id`, `fbc` e `fbp` são preservados, não fabricados;
- IP/UA usam campos explícitos da sessão original;
- o painel não preenche mais esses campos a partir da requisição administrativa.

## 13. Testes realizados

Executados localmente, sem chamar a Graph API real:

- `npm run test:meta-attribution`: 6/6 testes aprovados;
- `npm run test:meta-purchase-v2`: 7/7 testes aprovados;
- `npm run guard:ec-product-micro-layer`: aprovado;
- `npm run audit:no-regression`: aprovado;
- `npm run test:ecuador-only`: 4/4 testes aprovados;
- `npm run senior:check`: aprovado com o congelamento v6, 4/4 testes EC e Senior Guard;
- `npm run guard:tex-ultra-approved`: v6 íntegro e bloqueante;
- `npm run test:customer-form`: aprovado;
- `npm run test:manual-funnel`: 4/4 testes aprovados;
- `npm run test:funnel-metrics`: 7/7 testes aprovados;
- `npm run guard:public-funnel`: aprovado em modo somente leitura depois de corrigir a validação do symlink PM2;
- `guard-status-panels-freeze.mjs`: aprovado quando executado no ambiente oficial da VPS; a execução local Windows não possui `/opt/maxlien-mvp/app.py` e, por isso, não é conclusiva;
- `npm run official:audit`: resultado geral OK com quatro avisos ambientais/operacionais (health local 401, sessão WhatsApp local inválida, ausência de formulário recente 3/6 e timeout do SSH interno do próprio auditor);
- importação ESM isolada de `metaConversionsService.js`: aprovada;
- `git diff --check`: aprovado;
- consulta sanitizada e somente leitura em Mongo/SQLite na VPS: 22 pedidos, 22 aceites, 22 event IDs únicos;
- inspeção sanitizada de logs PM2: nenhuma evidência suficiente para contar tentativas CAPI de sucesso históricas; os logs não registravam cada POST aceito;
- inspeção HTTP da landing móvel/desktop e do JavaScript: aprovada, hashes registrados na seção 1.

O teste de concorrência usa um modelo de persistência em memória e cliente HTTP simulado. Seis chamadas simultâneas resultaram em uma chamada HTTP. Outro teste confirmou que `events_received: 0` não marca envio e que o segundo attempt conserva o mesmo `event_id`.

Na primeira execução, o guard público legado criou um lead/pedido pendente de diagnóstico e o removeu em seguida. Foi comprovado depois, por consultas somente leitura, que `EC-MSTYQRP0-J5OS` não existe no Mongo, não existe no painel SQLite e não possui `purchase_capi_lock`; ele nunca foi confirmado e não gerou Purchase. O guard foi corrigido para ser somente leitura por padrão. A partir desta versão, o teste mutável só roda com `PUBLIC_FUNNEL_MUTATION_TEST=YES` explícito.

## 14. Resultado

### Resultado efetivamente alcançado localmente

- causa raiz comprovada nas duas pontas;
- payload corrigido e testado sem comunicação externa;
- contaminação por IP/UA administrativo removida dos caminhos de confirmação;
- horário original priorizado;
- trava atômica central aplicada a todos os chamadores;
- aceite condicionado a `events_received > 0`;
- campos de atribuição interna e matching adicionados de forma aditiva;
- auditor V2 reproduzível e sanitizado criado;
- backend preparado para aceitar chamadas CORS da landing.

### Ainda não realizado

- a baseline será registrada em commit local auditável ao concluir esta tarefa; o hash é informado fora deste arquivo para evitar autorreferência;
- nada foi enviado ao GitHub;
- nada foi publicado ou reiniciado na VPS;
- nenhum arquivo da landing externa foi alterado;
- nenhum evento de teste ou real foi enviado à Meta;
- nenhum pedido de teste foi confirmado e nenhum Purchase de teste foi criado; o pedido pendente transitório do guard legado foi removido e auditado sem resíduos;
- Events Manager e Ads Manager ainda não foram validados depois da correção;
- Event Match Quality não pode melhorar antes de publicação, integração da landing e tráfego real.

## 15. Riscos restantes

1. **Integração da landing ainda pendente.** O código-fonte responsável por `vilaliemen.shop` não está neste projeto nem na VPS auditada. O backend está preparado, mas a landing ainda precisa enviar a atribuição verdadeira para `POST /api/lead` ou para o contrato de `vsl-entry`, receber a URL WhatsApp do backend e preservar o correlation ID. Isso deve ocorrer na tarefa/workspace dono da landing.
2. **CORS não completa a integração sozinho.** Ele apenas permite a futura chamada do navegador de `vilaliemen.shop`; o JavaScript externo precisa ser alterado e testado no seu próprio projeto.
3. **Dados antigos não serão reparados artificialmente.** Os 22 pedidos não possuem os identificadores originais no Vitalismen. Não há backfill seguro com os dados atuais.
4. **Logs históricos incompletos.** Antes desta correção não havia contador de attempts nem log de cada aceite, portanto não há prova forense total sobre possíveis POSTs concorrentes passados.
5. **Variante desktop diferente.** O mesmo caminho entrega uma página informativa no desktop e VSL no mobile. Foi documentado, não alterado; qualquer decisão sobre essa segmentação pertence ao projeto da landing/anúncios.
6. **EMQ e Ads Manager são métricas assíncronas.** A melhora precisa ser medida progressivamente depois de tráfego real com dados originais, e não pode ser prometida por teste unitário.
7. **Teste controlado exige aprovação operacional.** É necessário `test_event_code`, inspeção sanitizada do payload e depois exatamente uma venda real aprovada, conforme as fases 13 e 14.
8. **Guard local versus ambiente Linux.** O guard de status depende do `app.py` do Painel Maxlien em `/opt`; ele passa na VPS oficial e falha por ausência desse arquivo quando executado isoladamente no Windows. Isso não deve ser mascarado como regressão de código.

Contrato mínimo recomendado para a landing, sem cookies fabricados:

```json
{
  "name": "<cliente>",
  "phone": "<cliente>",
  "country": "EC",
  "product": "tex_ultra_ec",
  "event_source_url": "https://vilaliemen.shop/protocolo-g",
  "original_referrer": "<referrer-real>",
  "fbclid": "<se-original>",
  "fbc": "<se-original>",
  "fbp": "<se-original>",
  "external_id": "<id-estável-da-sessão>",
  "utm_source": "<real>",
  "utm_medium": "<real>",
  "utm_campaign": "<real>",
  "utm_content": "<real>",
  "utm_term": "<real>",
  "meta_campaign_id": "<se-fornecido-na-URL>",
  "meta_adset_id": "<se-fornecido-na-URL>",
  "meta_ad_id": "<se-fornecido-na-URL>"
}
```

IP e UA não devem vir de valores inventados no JSON; o endpoint deve capturá-los da requisição real do navegador.

## 16. Procedimento de rollback

### Código local

O ponto anterior verificável é `b53e575b832e28a970bf9c8165e2513e933c0890`, preservado em `backup/meta-purchase-attribution-v2-prechange-20260815`. Antes de qualquer rollback, preservar alterações locais e confirmar o alvo. Não usar `git reset --hard` nem `git clean`.

### Produção, se houver publicação futura

1. guardar o caminho exato da release ativa antes do deploy;
2. publicar em uma nova pasta de release, sem sobrescrever a anterior;
3. em falha de gate/health check/teste Meta, apontar o symlink `current` de volta para `/opt/vitalismen-automacao/releases/20260815T045340Z_ec_universal_metrics_b53e575`;
4. reiniciar somente o processo PM2 Vitalismen;
5. validar `/health`, autenticação do painel, `/api/funnel-metrics` autenticada e ausência de novo Purchase indevido;
6. os campos Mongo novos são opcionais e não impedem a release anterior de ler pedidos existentes.

Nenhum rollback de banco é necessário porque não houve migration destrutiva e nenhuma escrita de produção foi feita nesta auditoria.

## Apêndice A — tabela sanitizada de 12 a 15/08/2026

Legenda: `legado` em IP/UA significa que o campo existia, mas foi capturado no contexto da requisição administrativa e não pode ser tratado como dado original do cliente. Horários abaixo estão em `America/Guayaquil`.

| order_id | data EC | cliente | valor USD | Purchase enviado/aceito | event_id | event_source_url | fbc | fbp | email | telefone | IP | UA | ad_id | campaign_id |
| --- | --- | --- | ---: | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EC-MSQ6IW29-4NS4 | 2026-08-12 09:23 | cliente-01 | 35,99 | sim/1 | EC-MSQ6IW29-4NS4 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSQ7IVIB-NWH2 | 2026-08-12 09:51 | cliente-02 | 80,99 | sim/1 | EC-MSQ7IVIB-NWH2 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSRPQRQ8-34HY | 2026-08-13 11:09 | cliente-03 | 35,99 | sim/1 | EC-MSRPQRQ8-34HY | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSRQQT8P-KJ5O | 2026-08-13 11:37 | cliente-04 | 35,99 | sim/1 | EC-MSRQQT8P-KJ5O | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSRR6ZXL-3TMI | 2026-08-13 11:49 | cliente-05 | 35,99 | sim/1 | EC-MSRR6ZXL-3TMI | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSRXKOWG-P7YA | 2026-08-13 14:48 | cliente-06 | 35,99 | sim/1 | EC-MSRXKOWG-P7YA | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSS2491Z-IT92 | 2026-08-13 16:55 | cliente-07 | 80,99 | sim/1 | EC-MSS2491Z-IT92 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSS4HO1D-K0IG | 2026-08-13 18:01 | cliente-08 | 147,99 | sim/1 | EC-MSS4HO1D-K0IG | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSS7PE0L-M191 | 2026-08-13 19:31 | cliente-09 | 80,99 | sim/1 | EC-MSS7PE0L-M191 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSSB1QR2-4ROD | 2026-08-13 21:05 | cliente-10 | 35,99 | sim/1 | EC-MSSB1QR2-4ROD | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSSBKKEH-FFW5 | 2026-08-13 21:20 | cliente-11 | 80,99 | sim/1 | EC-MSSBKKEH-FFW5 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSSH36DH-ASQ0 | 2026-08-13 23:54 | cliente-12 | 80,99 | sim/1 | EC-MSSH36DH-ASQ0 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MST52GZ2-DIP0 | 2026-08-14 11:05 | cliente-13 | 147,99 | sim/1 | EC-MST52GZ2-DIP0 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTKOLV8-IG2T | 2026-08-14 18:22 | cliente-14 | 35,99 | sim/1 | EC-MSTKOLV8-IG2T | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTKSKH5-27WI | 2026-08-14 18:25 | cliente-15 | 35,99 | sim/1 | EC-MSTKSKH5-27WI | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTOY45O-QZE3 | 2026-08-14 20:22 | cliente-16 | 80,99 | sim/1 | EC-MSTOY45O-QZE3 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTPXH6B-CNCC | 2026-08-14 20:49 | cliente-17 | 80,00 | sim/1 | EC-MSTPXH6B-CNCC | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTRIE8P-4TV8 | 2026-08-14 21:34 | cliente-18 | 147,99 | sim/1 | EC-MSTRIE8P-4TV8 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTUTOOL-AV55 | 2026-08-14 23:06 | cliente-19 | 80,99 | sim/1 | EC-MSTUTOOL-AV55 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTVRF7B-GGJ4 | 2026-08-14 23:33 | cliente-20 | 147,99 | sim/1 | EC-MSTVRF7B-GGJ4 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTXV8NG-39S4 | 2026-08-15 00:31 | cliente-21 | 80,99 | sim/1 | EC-MSTXV8NG-39S4 | ausente | não | não | não | sim | legado | legado | — | — |
| EC-MSTXYYY3-WLPL | 2026-08-15 00:34 | cliente-22 | 35,99 | sim/1 | EC-MSTXYYY3-WLPL | ausente | não | não | não | sim | legado | legado | — | — |

## Apêndice B — resumo diário

| Dia EC | Pedidos elegíveis | Purchases armazenados | `events_received` | event IDs únicos | web sem URL | com fbc | com fbp |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 2026-08-12 | 2 | 2 | 2 | 2 | 2 | 0 | 0 |
| 2026-08-13 | 10 | 10 | 10 | 10 | 10 | 0 | 0 |
| 2026-08-14 | 8 | 8 | 8 | 8 | 8 | 0 | 0 |
| 2026-08-15 | 2 | 2 | 2 | 2 | 2 | 0 | 0 |
| **Total** | **22** | **22** | **22** | **22** | **22** | **0** | **0** |

# Microcamada V61 — atribuição Meta EC do Protocolo G até o Purchase

Data: 2026-08-24.

Status: implementação local concluída; revisão e autorização de deploy pendentes.

## Último gate local Vilaliemen

- Projeto Vilaliemen lido somente em modo read-only:
  `/home/codex/workspaces/VILALIEMEN_PROTOCOLO_G_OFICIAL`.
- Commit congelado: `ad0ad71bda41e52cbfb4462527b2a38c31005718`.
- Branch congelada: `codex/meta-ec-protocolo-g-bridge`.
- Fixture oficial lido diretamente de
  `/home/codex/workspaces/VILALIEMEN_PROTOCOLO_G_OFICIAL/tests/fixtures/meta-ec-protocolo-g-maxlien-payload.json`.
- SHA-256 calculado e exigido no teste:
  `ce253997d309e5ab921f94506a119302d3bf12d5560aa1fdac8b5c9ee4b5afe8`.
- O fixture real percorreu o handler `POST /api/whatsapp/vsl-entry`, o snapshot
  `VslVisit`, a correlação, o pedido sintético, o Purchase dry-run e a seleção
  do Dataset. Mongo e transporte Meta foram substituídos por mocks; nenhum
  efeito externo ocorreu.

## Fonte oficial conferida

- Projeto local: `/home/codex/workspaces/maxlien-vitalismen`.
- Base Git local: `318bc5dce947722eb257776a233c110f52422421`.
- Release ativa lida antes da alteração:
  `/opt/vitalismen-automacao/releases/20260824T161720Z_production-20260824-bdffb62`.
- PM2 lido em modo somente leitura: `vitalismen-automation`, online, apontando
  para `/opt/vitalismen-automacao/current/src/index.js`.
- Os arquivos runtime envolvidos tinham hashes locais e remotos idênticos antes
  da edição.

## Arquitetura aprovada para revisão

```text
AttributionRecord (tracking recebido)
  → VslVisit (external_id canônico)
  → correlação exata do inbound em 120 s
  → telefone associado à visita
  → pedido EC por últimos 9 dígitos e lookback de 30 dias
  → Purchase server-side
```

`AttributionRecord` é o conjunto estruturado de tracking persistido no
`VslVisit`; não é uma duplicação do pedido nem cria pedido real.

## Contrato Vilaliemen → Maxlien

`POST /api/whatsapp/vsl-entry` reconhece a identidade exclusiva:

- `country=EC`;
- `productKey=tex_ultra_ec`;
- `product=TEX_ULTRA`;
- `funnel=PROTOCOLO_G`;
- `page=protocolo-g`;
- `path=/protocolo-g`;
- origem HTTPS `vilaliemen.shop/protocolo-g`;
- mensagem iniciada por `Hola, quiero el tratamiento Tex Ultra.`;
- `clicked=true`, `intent=whatsapp_click`, `skipMeta=true`;
- `vslVariant=protocolo_g`;
- `external_id` obrigatório e canônico; `visitorId` é alias e não pode
  divergir.

Payloads que anunciam Protocolo G mas conflitam com essa identidade retornam
HTTP não-2xx antes de qualquer persistência. Outros funis conservam o contrato
anterior.

## Schema aditivo

### VslVisit

- `externalId`;
- `funnel`;
- `campaignId`;
- `adsetId`;
- `adId`;
- `placement`;
- `attributionCapturedAt`, recebido opcionalmente como Unix epoch em
  milissegundos em `attribution_captured_at`;
- cópia estruturada no objeto `tracking` para transporte ao pedido.

### Order.tracking

- `country`, `product`, `funnel`;
- `external_id` com `ext_id` mantido como alias legado;
- `campaign_id`, `adset_id`, `ad_id`, `placement`;
- `attributionCapturedAt`, exclusivamente como campo de auditoria;
- `metaPurchaseDatasetId`, `metaPurchaseDatasetRoute`;
- `attributionCorrelationStatus`, `attributionCorrelationReason`;
- `clientContextSource` para impedir que IP ou User-Agent do painel sejam
  tratados como dados do cliente.

Os campos são opcionais. Pedidos históricos não precisam de migração destrutiva.

`attributionCapturedAt` nunca substitui `lastClickAt`, `firstSeenAt` ou o horário
server-side do inbound na correlação. Ele não é aceito como prova temporal
isolada.

### MetaAttributionCorrelation

Coleção aditiva para observabilidade com:

- `CLAIMED`, `AMBIGUOUS` ou `UNMATCHED`;
- motivo e quantidade de candidatos;
- somente hashes SHA-256 de telefone e mensagem;
- visita/visitorKey quando a correlação for legítima;
- janela e horários operacionais server-side.

Falha ao gravar essa observabilidade é fail-open e não muda a decisão da
correlação.

## Correlation key

1. País EC.
2. Mensagem normalizada exatamente igual à mensagem registrada no clique.
3. Clique dentro dos 120 segundos anteriores ao inbound, com tolerância futura
   técnica já existente de 30 segundos.
4. Atribuição Meta existente.
5. Exatamente um candidato.

Zero candidatos não associa. Dois ou mais candidatos não associam. País ou
mensagem diferente e clique fora da janela não associam.

`fbp` é somente um sinal de matching que pode acompanhar o Purchase quando foi
recebido legitimamente. Isoladamente, ele não constitui atribuição de anúncio,
não inicia correlação, não renova TTL, não fabrica `fbc` e não cria campanha,
anúncio ou `attributionCapturedAt`. Quando o Vilaliemen omite campos expirados,
o snapshot Protocolo G recebido é autoritativo e o Maxlien não conserva nem
reconstrói os valores publicitários anteriores.

Depois do CLAIMED, o pedido procura somente visita EC já correlacionada pelo
final de nove dígitos, dentro de 30 dias. Atribuição válida preexistente no
pedido nunca é sobrescrita.

## Dataset routing

Somente a combinação:

```text
EC + tex_ultra_ec/TEX_ULTRA + PROTOCOLO_G
→ 2048099902484149
```

usa a rota `ec_tex_ultra_protocolo_g`. Outro produto EC, outro funil EC e país
não suportado conservam a seleção anterior. Configuração de Dataset dedicado
divergente falha fechada em vez de cair no Dataset global.

A credencial é lida exclusivamente do ambiente server-side. A variável
dedicada, quando presente, tem prioridade; caso esteja vazia, a credencial EC
server-side já autorizada é reutilizada. Nenhum token foi lido, copiado,
registrado ou versionado.

`test_event_code` implícito é ignorado nessa rota normal do Protocolo G.

## Purchase

- server-side;
- `event_id=orderId`;
- valor real e `USD`;
- conteúdo resolvido pelo produto real do pedido;
- `fbc`, `fbp` e `external_id` somente quando existentes;
- `event_source_url=https://vilaliemen.shop/protocolo-g`, sem query string;
- User-Agent somente com proveniência da sessão transportada pelo bridge;
- IP do bridge, servidor ou operador não é enviado como IP do cliente;
- nenhum Purchase Browser foi criado.

O tracking é fail-open: falha Meta não impede a persistência comercial do
pedido e não autoriza retry distribuído ou fila nova.

## Dashboard EC

O dashboard autenticado `funnel-metrics.html`, que já consulta somente EC,
ganha uma tabela separada com pedido, país, produto, funil, IDs de campanha,
placement, UTMs, presença de sinais Meta, correlação e Dataset/Purchase. O
telefone não é retornado nessa projeção.

O mesmo painel mostra totais `CLAIMED`, `AMBIGUOUS` e `UNMATCHED`. O dashboard
colombiano não foi alterado.

## Preservado

- Colômbia;
- VTurb e projeto Vilaliemen;
- Teledone;
- Z-API e rotas de transporte;
- número e mensagens WhatsApp;
- `public/qr.html` e CTA;
- checkout, pagamentos, Dropi e webhooks;
- automações, funis comerciais e `/n/`.

## Estado operacional

- Nenhum deploy, restart PM2, alteração de `.env` de produção ou symlink.
- Nenhum Test Event ou evento Meta.
- Nenhuma mensagem WhatsApp.
- Nenhum pedido real.
- Nenhuma escrita no banco oficial.

## Rollback futuro

Antes de eventual ativação, criar release e backup transacionais. O rollback de
código retorna ao commit `318bc5dce947722eb257776a233c110f52422421` ou à
release ativa V60 acima. Campos Mongo aditivos podem permanecer sem uso; não há
migração destrutiva a desfazer.

O deploy permanece bloqueado por
`scripts/assert-meta-ec-protocolo-g-attribution-activation-approved-v61.mjs`
até autorização escrita posterior.

## Correção pré-deploy do freeze lock — 2026-08-25

O pré-deploy do commit V61 foi interrompido pelo check textual histórico
`meta_pixel_lead_ec_dataset`, que ainda exigia a expressão direta
`process.env.META_ACCESS_TOKEN_EC`. A V61 não removeu a credencial EC: o
resolvedor passou a receber `env`, cujo valor padrão continua sendo
`process.env`, para permitir prova isolada com credenciais sintéticas.

O freeze lock foi alinhado sem reintroduzir o literal antigo. O comando
`guard:freeze-lock` executa agora também
`scripts/guard-meta-capi-routing-freeze-v61.mjs`, que verifica o comportamento
real com dry-runs sem rede:

- EC padrão usa o Dataset e a credencial EC server-side anteriores;
- outro produto EC e outro funil EC continuam na rota `country_ec_default`;
- `EC + TEX_ULTRA + PROTOCOLO_G` usa exclusivamente o Dataset
  `2048099902484149`;
- a credencial dedicada tem prioridade e a credencial EC server-side já
  autorizada é o único fallback permitido quando a dedicada está vazia;
- configuração divergente do Dataset dedicado falha fechada;
- país fora de EC permanece sem roteamento neste serviço;
- resultados dos dry-runs e arquivos públicos não expõem credenciais Meta.

Esta correção altera somente locks, provas e documentação locais. Não houve
deploy, restart, evento Meta, mensagem WhatsApp, pedido real ou mudança no
projeto VILALIEMEN.

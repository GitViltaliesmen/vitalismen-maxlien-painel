# Microcamada V62 — conversão mensurável do Protocolo G

Data: 2026-08-26
País: EC
Produto: Tex Ultra Ecuador
VSL: `https://vilaliemen.shop/protocolo-g`
Estado: implementação e ativação controlada autorizadas; publicação ainda depende de guards, backup e validação.

## Decisão autorizada

Depois da análise do gargalo, o operador pediu explicitamente `siga a correção`.
Esta autorização cobre somente:

1. uma CTA secundária aos 12 minutos de reprodução medida;
2. preservação integral da CTA final entregue pelo VTurb;
3. medição aditiva das etapas `landing`, `video_started`, `watched_25`,
   `watched_50`, `early_cta_visible`, `form_opened` e `form_submitted`;
4. um endpoint público isolado que registra essas etapas sem chamar vendedor,
   painel de lead, WhatsApp ou Meta/CAPI;
5. um bloco exclusivo no painel EC para o Protocolo G, separado do agregado de
   todas as VSLs do Equador.

## Gargalo corrigido

A CTA original permanece programada pelo player somente para aproximadamente
`00:37:37` de um vídeo de aproximadamente `00:43:10`. A V62 não altera o player
nem o momento dessa CTA final. Ela acrescenta uma CTA secundária em `00:12:00`,
depois do marco de 25%, para permitir que uma pessoa já convencida avance sem
esperar quase o vídeo inteiro.

O painel anterior somava entradas e cliques de todas as origens EC. Por isso,
ele não respondia quantas pessoas da VSL Protocolo G iniciaram o vídeo,
chegaram aos marcos, abriram o formulário ou avançaram ao WhatsApp. A V62
mantém esse agregado como `EC geral` e cria uma leitura separada da VSL.

## Contrato das etapas

Cada etapa exige, em falha fechada:

- `country=EC`;
- `productKey=tex_ultra_ec`;
- `product=TEX_ULTRA`;
- `funnel=PROTOCOLO_G`;
- `page=protocolo-g`;
- `path=/protocolo-g`;
- origem HTTPS exata de `vilaliemen.shop/protocolo-g`;
- `external_id` canônico;
- `clicked=false`;
- `intent=vsl_stage`;
- `skipMeta=true`;
- etapa pertencente à lista fechada da V62.

O endpoint usa `$min` no timestamp de cada etapa. Repetições e retries não
transformam uma pessoa em múltiplas conversões. O registro não recebe telefone,
nome ou mensagem de cliente.

## Arquivos Vitalismen autorizados

- `src/services/metaProtocoloGAttributionService.js`;
- `src/models/VslVisit.js`;
- `src/routes/whatsapp.js`;
- `src/routes/funnelMetrics.js`;
- `src/services/funnelMetricsService.js`;
- `public/funnel-metrics.html`;
- testes, guards, manifesto e documentação da V62.

## Arquivos oficiais da VSL

Fonte inspecionada diretamente em `/opt/cloaker` antes de qualquer alteração:

| Arquivo | SHA-256 antes | SHA-256 candidato V62 |
|---|---|---|
| `routes/metaEcProtocoloGBridge.js` | `93aee690a85d3618dfdc6c7c632966d6a792a2c17878541a684c14a675a33a8c` | `7722081940ceb74b21939e88b54b29f9fb05da9f9e37e87258a4edbd2149f5dd` |
| `private/vsl/protocolo-g.html` | `a532355d883f3c337b95776943ec5795af3e58b5c702dbc3d2bc7ade4172da42` | `59b1d47e1c9d7613d1fc30884ce7df78080f9544c730e9435079a0aa39bdfe7b` |
| `public/assets/js/meta-ec-protocolo-g-bridge.js` | `dd21630a42a3780ad73f62be44f58653441e8e2377184902b91717309d3125d4` | `e0904cae1d97ce20b6493aad28b538650ada24c501b38e6a9e382d145e4dccd9` |

## Preservado

- player VTurb, ID do player e CTA final;
- `public/assets/js/tracking-protocolo-g-formulario-20260815.js`, SHA-256
  `da4a9415211991cf6669cea2734c1abecc3f516d00f6330c3feb9761ee7839f9`;
- `public/assets/js/pixel.js`, SHA-256
  `89449a5822f996725bb8be68058c5363bf62d17a8bb7c7c8ffe0cc306a29937a`;
- número oficial `5515991418416`;
- formulário existente e mensagem canônica de Tex Ultra;
- Dataset dedicado `2048099902484149` e contrato V61 de atribuição;
- produto, preço, checkout, pedido, Dropi, funil WhatsApp, mídia, áudio,
  scheduler e memória comercial.

## Validação obrigatória

Antes de publicar:

```sh
npm run official:path
npm run guard:protocolo-g-conversion-v62
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
```

Na VSL, executar sintaxe, testes `meta-ec-protocolo-g-*`, guard de escopo,
guard de segurança e `npm audit --omit=dev`.

Depois de publicar, validar health, processo/cwd PM2, hashes, HTML móvel,
ausência da CTA antecipada no carregamento, exibição controlada no limiar e
ausência de qualquer mensagem automática. Não será criado evento real de
Purchase, pedido real ou envio Dropi para testar esta camada.

## Rollback

Vitalismen: retornar o symlink `current` ao release anterior e confirmar
`pm_cwd` e `pm_exec_path` do processo. VSL: restaurar os três arquivos a partir
do backup root-only criado imediatamente antes da troca e recarregar somente o
processo `cloaker` se a rota de bridge tiver sido alterada.

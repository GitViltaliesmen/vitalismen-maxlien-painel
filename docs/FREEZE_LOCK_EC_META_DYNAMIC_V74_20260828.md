# FREEZE LOCK EC — DESTINO META DINÂMICO V74

Data: 2026-08-28
País e escopo: Equador (`EC`)
Estado: implementação local validada, sem autorização de publicação
Freeze pai: `meta-partner-destination-registry-v73`

## Objetivo exclusivo

A V74 alinha o gate histórico `FREEZE_LOCK_EC` à implementação de destino Meta dinâmico já aprovada e congelada pela V73. Nenhuma lógica funcional Meta, comercial, de WhatsApp, Dropi, pedido, produto, preço, checkout, scheduler ou pós-venda é alterada.

Root cause formal:

```text
LEGACY_FREEZE_CONTRACT_INCOMPATIBLE_WITH_V73_DYNAMIC_META_DESTINATION
```

## Preservação histórica

O arquivo `FREEZE_LOCK_EC.json` permanece byte-intacto, com SHA-256:

```text
38fb689fe10e9d8d2794397ace313e0a71cbcf131691e7b87ac8b3aaa2be0603
```

A V74 não remove nem desativa o gate. O contrato sucessor `FREEZE_LOCK_EC_V74.json` identifica por regra, índice, tipo, arquivo e conteúdo exatamente três expectativas legadas autorizadas para sucessão:

1. Pixel EC fixo no check `meta_pixel_lead_ec_dataset`;
2. atribuição síncrona histórica `window.__mvpMarkLeadOnce = markLeadOnce;` no mesmo check;
3. Pixel EC fixo no check `site_entry_lead_panel_path_before_vsl_ab_ec`.

Todos os outros checks do freeze legado continuam obrigatórios e são executados pelo mesmo comando `npm run guard:freeze-lock`.

## Contrato sucessor

O HTML oficial não pode inicializar um Dataset literal. Ele deve obter o descritor público redigido em `GET /api/health/meta-destination`, validar `browserServerSynchronized`, usar `destination.browserPixelId` e inicializar `fbq('init', pixelId)`.

O mesmo perfil ativo alimenta Browser e CAPI. O registry falha fechado quando `browserPixelId !== datasetId`; o binding de sessão continua assinado por HMAC, comparado em tempo constante e limitado a seis horas.

Identidades operacionais preservadas, sem autorização de troca:

```text
EC_CURRENT_DATASET=1468946114265008
LOCKED_SECONDARY_DATASET=2048099902484149
```

O segundo valor é o Dataset dedicado já congelado para a origem Protocolo G. Ele permanece server-side e não autoriza importar, misturar ou operar qualquer outro projeto.

## Lead e Purchase

A semântica real V73 substitui o helper síncrono antigo:

- chamadas de Lead anteriores à resolução entram em `pendingLeadEventIds`;
- configuração indisponível limpa a fila sem emitir evento;
- após inicialização, a fila é drenada pela implementação final;
- `sessionStorage.lead_sent` impede repetição;
- o mesmo `eventId` é usado no Browser `eventID` e no payload server-side.

O contrato também congela as contagens dos caminhos Purchase já existentes por fluxo, a única definição CAPI `event_name: 'Purchase'`, o `orderId` como identidade e a ausência de Browser Purchase na VSL. A V74 não envia eventos.

## Segurança do registry

Permanecem obrigatórios:

- registry e segredos fora do Git e fora de cada release, sob `/opt/vitalismen-automacao/shared/`;
- arquivos regulares, sem symlink, `root:root` e modo `0600` na VPS;
- tokens apenas server-side;
- endpoint público sem access token, app secret, HMAC secret, bearer token ou credentials;
- contas parceiras compartilham o Dataset existente; não criam Pixel, token ou fluxo Purchase paralelo.

## Testes negativos obrigatórios

O guard V74 falha quando uma fixture:

- reintroduz Pixel literal divergente no HTML;
- remove a trava de igualdade Browser/CAPI;
- remove o endpoint público;
- serializa token ou segredo no endpoint;
- adiciona um segundo envio Purchase ao mesmo caminho;
- remove a proteção `lead_sent`.

O teste comportamental executa o bootstrap inline da V73: duas chamadas enfileiradas com o mesmo `eventID` produzem um único Lead; configuração indisponível produz zero Lead. Todos os scripts inline da VSL também são compilados para validação sintática.

## Limites desta autorização

Não autorizados nesta missão: push, tag, SSH, instalação de helper, stage na VPS, deploy, alteração de `/current`, PM2, Nginx, inicialização/ativação de registry, troca de Dataset/token, compartilhamento em Meta Business, emissão de evento Meta ou escrita em banco de produção.

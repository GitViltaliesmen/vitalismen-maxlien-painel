# EC Sales-first Metrics Layer V175 — 2026-09-17

## Objetivo

Explicar e separar, em uma camada independente e somente leitura, as bases numéricas exibidas no painel EC sem alterar o painel congelado, a VSL, o bot, Pixel/CAPI, Dropi, Z-API, pedidos ou dados de clientes.

## Diagnóstico comprovado em produção

Leitura realizada em `2026-09-17T22:06:49.467Z` na instância oficial `72.60.137.77`, release ativa:

```text
/opt/vitalismen-automacao/releases/20260917T144257Z_production-20260917-7415ac9
```

As bases são diferentes por contrato:

- `966 clientes`: contatos comerciais EC com telefone persistidos no banco operacional;
- `215 conversas operacionais`: lote atual retornado por `GET /api/whatsapp/chats?country=EC&fast=1`;
- `12 aquecimento`: excluídas da base comercial;
- `203 conversas comerciais`: `215 - 12`;
- `8 pré-leads VSL anônimos`: cliques recentes ainda sem telefone, projetados temporariamente como `VSL · TEX ULTRA`;
- `195 conversas comerciais identificadas`: `203 - 8`;
- `72 vendas visíveis`;
- `13 desistentes visíveis`;
- `35%`: taxa exibida pelo painel congelado, calculada como `72 / 203`;
- `37%`: taxa Sales-first entre conversas identificadas, calculada como `72 / 195`.

Os oito cartões não são oito telefones duplicados nem oito pedidos. São visitas anônimas distintas da VSL aguardando a correlação com uma entrada real no WhatsApp; expiram da projeção após a janela definida no contrato V171 ou são consolidadas quando ocorre uma correlação canônica.

## Camada isolada criada

Arquivos novos, sem alteração de arquivo congelado:

```text
public/sales-first-metrics-v175.html
public/panel-intelligence/ec-sales-first-projection-v175.js
tests/ec-sales-first-projection-v175.test.mjs
tests/ec-sales-first-page-v175.browser.test.mjs
```

Após publicação explicitamente autorizada, a página será acessível em:

```text
https://ec.maxlien.shop/sales-first-metrics-v175.html
```

Contratos da página:

- somente `GET /api/whatsapp/dashboard-metrics?country=EC`;
- somente `GET /api/whatsapp/chats?country=EC&fast=1`;
- nenhuma escrita;
- nenhum nome ou telefone renderizado;
- atualização automática a cada 15 segundos;
- token reutilizado exclusivamente no mesmo navegador e mesma origem do painel;
- painel congelado permanece inalterado.

## Preservado

Não foram alterados:

- `public/qr.html`;
- `src/routes/whatsapp.js`;
- `src/services/vslPreleadPanelService.js`;
- VSL Protocolo-G;
- bot, funil, áudios ou memória;
- Pixel, CAPI ou Purchase;
- Dropi, pedidos ou pós-venda;
- Z-API ou transporte WhatsApp;
- banco, PM2, symlink `current` ou produção.

## Validação local

```text
node --test tests/ec-sales-first-projection-v175.test.mjs tests/ec-sales-first-page-v175.browser.test.mjs
PASS 4/4

node scripts/lint-js-syntax.mjs
LINT_JS_SYNTAX=OK files=995

npm run guard:freeze-lock
PASS

npm run guard:traffic-restoration-v171
PASS 8/8

git diff --check -- <arquivos V175>
PASS
```

O teste de navegador confirmou os valores `966`, `203`, `195`, `8`, `72`, `13`, `35%` e `37%`, ausência de método mutante e layout sem rolagem horizontal em desktop e mobile.

## Estado de publicação e freeze independente

Autorização recebida em 2026-09-17:

```text
AUTORIZO_PUBLICAR_V175_SALES_FIRST_METRICS=SIM
```

Esta camada só pode ser considerada publicada quando todos os itens abaixo forem verdadeiros ao mesmo tempo:

- release sucessora criada a partir de `20260917T144257Z_production-20260917-7415ac9`;
- diff funcional limitado aos três arquivos autorizados da V175;
- `FROZEN_FILES_CHANGED=0`;
- URL pública V175 com HTTP 200;
- desktop e mobile aprovados;
- network contendo somente GETs;
- valores ao vivo conferidos;
- bot, VSL, painel principal, Z-API e `TRAFFIC_READY` preservados.

Quando essas condições constarem no relatório pós-publicação, vale o contrato:

```text
SALES_FIRST_METRICS_V175_FROZEN=YES
COMMERCIAL_CHANGE_COUNT=0
```

O freeze V175 é independente e não substitui, não afrouxa e não descongela nenhuma baseline comercial anterior.

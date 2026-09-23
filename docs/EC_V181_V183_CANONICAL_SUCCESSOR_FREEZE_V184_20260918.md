# Freeze V184 — sucessor canônico V181/V183

Data: 2026-09-18
Escopo: linhagem de guards e contexto sucessor; nenhuma mudança funcional.

## Causa raiz

O staging da V183 carregava `scripts/lib/ec-runtime-successor-v97-context.mjs`, mas a autorização sucessora V181/V183 ainda não estava registrada quando o runtime guard V51 validava `scripts/test-panel-customer-selection-browser-v51.mjs`.

## Correção formal

O preload canônico V97 conserva seu primeiro import congelado. O bootstrap sucessor V144 já carregado pelo V97 passa a carregar primeiro `scripts/lib/ec-runtime-successor-v184-context.mjs`. Esse contexto valida os manifests e hashes V181/V183/V184 e registra apenas os arquivos explicitamente enumerados, antes de continuar pela cadeia sucessora existente.

Não foi criado bootstrap paralelo. Os guards V51 e V71, seus manifests e o pipeline oficial não foram alterados. Não existe wildcard, captura de erro, conversão para warning ou ignorância de exit code.

## Arquivos ancestrais legitimamente substituídos

- `public/qr.html`
- `scripts/lib/ec-runtime-successor-v170-context.mjs`
- `scripts/test-panel-customer-selection-browser-v51.mjs`
- `src/routes/shipments.js`
- `src/services/servientregaEcuadorAgencyService.js`
- `scripts/lib/ec-runtime-successor-v144-bootstrap-context.mjs` — integração mínima do contexto V184 na cadeia já carregada pelo preload canônico V97.

## Preservado

- Comportamento manual/test-only da V181.
- Regra funcional panel-only da V183.
- Bot, VSL, Protocolo-G, Pixel, CAPI, bridge, Dropi, Z-API, áudios, pós-venda e banco de dados.
- Produção V179 sem ativação e sem restart nesta missão.

Qualquer alteração posterior exige nova autorização explícita e um novo sucessor formal.

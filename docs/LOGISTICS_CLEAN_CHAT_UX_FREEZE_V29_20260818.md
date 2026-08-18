# Freeze técnico V29 — Logistics Communication + Clean Chat UX

Data: 2026-08-18 (UTC)

## Base e escopo

- Base V28 imutável: `7bd1418caf81b832f30acb7926f023df7a2e711e`.
- Branch de trabalho: `codex/logistics-clean-chat-v29-20260818`.
- Tag técnica local prevista: `freeze-v29-logistics-clean-chat-20260818`.
- O SHA exato da V29 é o commit apontado pela tag; a tag somente pode ser criada depois da regressão final.
- Rollback principal: V28 `7bd1418caf81b832f30acb7926f023df7a2e711e`.
- Rollback anterior da V28: `15b9857f7b6e33975af52a5f61f797cd7468e102`.

## Causa auditada do espelho visual

Um único envio real pela Z-API era espelhado por `recordZapiOutboundMirror()` com `_id=zapi_out_<providerMessageId>`. A rota manual `/api/whatsapp/send` criava em seguida outro registro `manual_*` com o mesmo `providerMessageId`. O painel renderizava cada `_id` como bolha e só conciliava o optimistic UI por texto/tempo. Portanto, a evidência encontrada foi duplicidade de persistência/apresentação, não dois transportes reais.

## Contrato V29

- Uma mensagem real resulta em uma bolha visual.
- Identidade: provider message ID, message ID, external ID, client-generated ID e, só sem IDs, composição segura.
- Atualizações sent/delivered/read enriquecem a mesma apresentação.
- Histórico antigo não é apagado; aliases ficam disponíveis para auditoria.
- Eventos system/técnicos ficam em `DETALHES TÉCNICOS`.
- Cliente, atendente humana, bot e system possuem papéis e avatars distintos, com fallback por iniciais.
- `SHIPPED != READY_FOR_PICKUP` e `GUIDE_NUMBER != PICKUP_AUTHORIZATION`.
- Guia numérica é permitida em SHIPPED/IN_TRANSIT; imagem/PDF/áudio e linguagem de retirada exigem READY verificado.
- READY manual exige confirmação explícita do operador; READY de rastreamento confiável registra fonte e instante.
- Estados finais bloqueiam avisos e lembretes de retirada.
- Ledger aditivo registra tentativas enviadas e bloqueadas.

## Preservado

- V28: resolução de nome, concatenação, cidade/província, referência/agência, lock humano, order gate e purchase block.
- VSL `public/n/index.html`: sem diff.
- Meta/Pixel/CAPI: sem diff e sem chamada real.
- Dropi operacional: sem diff e sem chamada real.
- Transporte WhatsApp: mesma função de envio; a V29 só adiciona o gate logístico exigido e corrige persistência/apresentação.
- Nenhum dado histórico foi apagado.

## Testes e staging

- `node scripts/guard-logistics-clean-chat-v29.mjs` e os testes V29 cobrem espelho, identity, updates, mídia, avatars, system cleanup, estados logísticos, gates, reminders, Xavier Chamba e ledger.
- `tests/shipment-pickup-notification.test.mjs` cobre a cadência de retirada já existente sob o novo gate.
- `npm run lint`, `npm test`, senior check, official path, freeze lock, guards EC/Tex Ultra, cadência, concorrência, `git diff --check` e secret scan devem estar PASS antes da tag.
- Staging visual é local/estático e sintético; não carrega API, banco, WhatsApp, Meta/CAPI, Dropi ou produção.
- Evidência visual prevista: `/home/codex/.codex/visualizations/2026/08/18/01a0148c-ae8c-7722-8a43-764f22253c8b/v29-logistics-clean-chat.png`.

Resultado de regressão antes do freeze final: `npm test` PASS com 201/201 testes; V29 específico PASS; V28 integral PASS; visual sintético PASS em 1600×960. O runtime usa o guard sucessor V29, que verifica o manifesto pai V28 e permite somente os arquivos explicitamente substituídos pela V29; os demais hashes V28 continuam obrigatórios.

## Riscos conhecidos

- Históricos antigos sem nenhum ID só podem usar a composição segura; textos iguais com IDs ou horários distintos permanecem separados.
- READY importado por fonte não confiável permanece fail-closed até verificação explícita.
- Avatar remoto pode expirar; o fallback por iniciais é imediato e não bloqueia o chat.
- Campos do schema são aditivos. Rollback de código para V28 ignora os campos novos sem exigir remoção de dados.

## Publicação

Este artefato é candidato local. Não autoriza deploy, PM2, alteração de `current`, mensagem real, pedido real, Purchase, Meta/CAPI ou Dropi. Produção exige revisão e autorização separada.

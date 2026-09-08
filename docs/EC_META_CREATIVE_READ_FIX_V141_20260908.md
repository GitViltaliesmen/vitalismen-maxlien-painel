# V141 — correção auditada da leitura de criativos Meta

Registro: 2026-09-08 UTC. Escopo autorizado: finalizar a correção pontual de
`url_tags` após auditoria e comprovação de funcionamento. A proibição de publicar,
fazer deploy ou reiniciar serviços foi preservada.

## Resultado comprovado

- Os sete gates Meta passaram: `META_TOKEN_VALID`, `META_ADS_READ`,
  `META_ACCOUNT_MATCH`, `META_INSIGHTS`, `META_CREATIVE_READ`,
  `AD_ID_TO_CREATIVE` e `META_LIVE_FETCH`.
- Token configurado e válido, com `ads_read`, acesso à conta esperada e Insights.
- 33 consultas GET responderam HTTP 200: permissões, conta, Insights de verificação,
  Insights completos e 29 consultas de criativos.
- Todos os 29 anúncios retornados foram vinculados a um criativo. Erro sanitizado: `null`.
- O código real do serviço foi executado no VPS, em um módulo isolado com
  `node:fs` substituído por cache em memória. O transporte fez requisições reais
  à Meta; nenhum cache operacional foi escrito.
- SHA-256 do serviço testado:
  `bd4d86ca346f7eb7558935cfc2b656da15b9f817d2f49b9a459a4306e12a9ffa`.

Evidência sanitizada: [meta-creative-read-v141-20260908.json](evidence/meta-creative-read-v141-20260908.json).

## Fonte, alteração e revisão

Base Git: `c1d4868f3693ab48179f1fe7df574cd7728b4b25`.
Branch da correção: `codex/v141-meta-creative-fix`.

Arquivo oficial da candidata lido antes do patch:
`/opt/vitalismen-automacao/releases/20260908T004500Z_production-20260908-c1d4868/src/services/metaAdsInsightsService.js`.

A alteração funcional contém somente duas linhas:

1. Solicitar `url_tags` dentro da expansão `creative{...}`.
2. Ler `creative.url_tags` ao preencher `creativeMapping[].urlTags`.

A consulta anterior solicitava o campo no objeto de anúncio e retornava
HTTP 400, código 100. Os testes também passaram a representar a resposta real
da API; há regressão para criativos com e sem tags e verificação de cache sem token.
O manifesto de freeze V141 recebeu somente os hashes dos arquivos corrigidos
e do novo teste. Nenhum guard foi removido ou afrouxado.

## Testes e auditoria

- Regressão: os dois casos novos falharam no código anterior e passaram após o patch.
- Suíte específica local: 18/18 testes passaram.
- Mesma suíte no VPS: 18/18 testes passaram.
- Sintaxe do serviço e guard de freeze V141: PASS.
- `node scripts/run-with-v141-context.mjs senior:check`: PASS antes e depois
  da correção no VPS.
- `cd /root/wa_wpp && npm run senior:check`: PASS.
- A chamada direta de `npm run senior:check`, sem o contexto de sucessão,
  falhou antes da alteração, tanto no checkout principal quanto na produção,
  por ancestralidade V47 de `.github/workflows/ec-panel-quality.yml`.
  A validação completa da candidata foi realizada pelo runner V141 existente,
  sem alteração de guards.
- `git diff --check`: PASS; diff funcional revisado.

## Preservação comprovada

A auditoria registrou hashes de 1.653 arquivos da candidata antes da alteração.
Somente serviço, fixture existente, manifesto de freeze e marcador de staging
mudaram; foi adicionado o teste de regressão. Os demais arquivos ficaram iguais.

O `.env` permaneceu byte a byte igual ao estado posterior à entrada correta do
token: `root:root`, modo `0600`. `META_ACCESS_TOKEN_EC`,
`META_PIXEL_ID_EC` e as demais variáveis foram preservadas. Nenhum token integra
este commit, relatório ou log de teste.

Produção preservada:
`/opt/vitalismen-automacao/releases/20260907T222623Z_production-20260907-13e752a`.
O symlink `current`, PID, CWD, caminho executável, contador de reinícios e uptime
do PM2 `vitalismen-automation` permaneceram iguais; processo online.
O cache Meta compartilhado mantinha modificação em 2026-09-05 04:45:23 UTC,
anterior à execução.

Não houve alteração funcional de VSL, bot, Z-API, CAPI, Dropi, preços,
anúncios, orçamento, Pixel/Dataset, pedidos ou clientes, nem envio de mensagens.

## Backup e reprodução

Backup privado no VPS:
`/opt/vitalismen-automacao/backups/v141-creative-before-20260908T030655877449Z`.

Contém os arquivos originais, o inventário privado de integridade, o script
GET-only e os logs dos testes. O script pode ser executado sem imprimir tokens:

```sh
node --no-warnings --experimental-vm-modules /opt/vitalismen-automacao/backups/v141-creative-before-20260908T030655877449Z/audit-meta-live-readonly-v141.mjs
```

## Estado da candidata e rollback

A V141 foi emendada somente na pasta inativa. Ela não foi publicada.
Como o pacote original corresponde ao commit base, o marcador
`.staging-complete.json` foi marcado `status=requires_restaging` e
`publicationStatus=amended_candidate_not_publishable`. O registro
`.release-source.json` original foi preservado; não foi apresentado como se
representasse um novo pacote verificado.

Uma futura publicação exige novo staging formal a partir da revisão corrigida,
preservação segura do token correto da candidata e nova autorização de ativação.
Esse staging não foi executado nesta tarefa.

Rollback do código: reverter o commit desta correção. Para restaurar a candidata
inativa, usar serviço, fixture e manifesto originais do backup e remover somente
o teste novo; restaurar o marcador de staging apenas junto com os arquivos
originais e a verificação de integridade correspondente. O token válido deve ser
preservado. Nenhum rollback da produção é necessário.

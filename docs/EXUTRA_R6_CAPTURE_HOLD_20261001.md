# VITALISMEN_EC — sucessor EXUTRA R6

Estado: candidata local; nenhuma ativação autorizada pelo simples conteúdo deste documento.
Autorização operacional: pedido específico de 01/10/2026, preservando tráfego e clientes reais.

## Escopo exato e motivo

| Componente | Arquivos | Antes | Depois | Motivo |
|---|---|---|---|---|
| FUNCTIONAL_FILE | `src/routes/zapi.js` | Captura inicial manual com marcador zapi impede promoção | Somente claim persistido EXUTRA/Tex Ultra, captura até 120s e ausência de ação humana permitem CAS manual→auto | Resolver bloqueio comprovado |
| INTEGRITY_SUCCESSOR | `scripts/lib/exutra-r6-authority.mjs`, `scripts/lib/exutra-r6-preload.mjs`, `scripts/exutra-r6-guard.mjs`, `scripts/exutra-r6-checkpoint.mjs`, manifesto R6 | R5 reconhece só sua release congelada | Checkpoint novo, distinto e root-only reconhece commit/tree/hashes exatos; R4/R5 imutáveis permanecem ancestrais | Autorizar exclusivamente candidata definida |
| STAGE_CONTROL | `ops/vitalismen-stage`, `scripts/exutra-r6-release.mjs` | Stage enumera R4/R5 | Branch R6 exata, atestação Git antes da remoção de .git, mesmos checks de source/ref/publicação | Materializar pelo pipeline oficial |
| PM2_CONTROL | `scripts/lib/pm2-target-env-restart-v78-r4.mjs` | Controller reconhece R4/R5 | Branch R6 vinculada a checkpoint e ao hash do próprio controller | Restart indispensável do mesmo processo |
| ACTIVATION_CONTRACT | `ops/ec-bot-core-v78-successor-r4`, `scripts/lib/ec-bot-core-operational-contract-v78.mjs`, `src/services/ecBotCoreOperationalV78Service.js` | Bundle/preload desconhecem R6 | Seleção R6 exata e transição do PID R5 identificado, sem modo safe intermediário | Preservar perfil operacional e minimizar interrupção |
| ROLLBACK_CONTROL | `ops/exutra-r6-rollback.mjs` | Rollback R5 retorna R4 | R6 retorna à R5 atual e restaura seu bundle intacto | Reverter somente esta candidata |

Testes: `tests/exutra-capture-hold-r6.test.mjs`, `tests/exutra-r6-contract.test.mjs`.
Manifesto: `docs/freeze/exutra-r6-capture-hold-20261001.json`.

## Segurança funcional

O marcador zapi continua sendo insuficiente por si só. São obrigatórios URL HTTPS com host exato maxlien.shop e path /exutra, produto tex_ultra_ec, claim exact_message_unique_120s,
visit ID persistido e igual, variante exutra, contato EC novo, marca temporal recente,
Captura Z-API, ausência de pausa/operador/seleção manual/outbound e CAS sobre updatedAt.
A consulta de histórico bloqueia quando encontra saída humana ou saída de origem desconhecida.
Erros e intervenção concorrente preservam manual. Nenhum histórico é reprocessado.
Nenhum código de duplicate guard, cooldown, fila, provider, Meta/CAPI, produto/preço,
pós-venda ou Dropi pode mudar.

## Publicação e rollback

Não ativar sem testes, guards, stage, dry-run e rollback PASS. A raiz oficial /current
troca por rename de symlink; o processo permanece R5 até o restart indispensável.
O rollback deve estar validado antes da troca, com bundle original arquivado sem overwrite.
R5/R4 não são editados ou recriados; autoridade ancestral verifica seus checkpoints,
manifests e hashes. Nenhum token, .env ou dado de cliente pertence ao Git.
Não provocar inbound de QA, envio WhatsApp, evento Meta ou venda. Após ativação,
somente observar entrada natural; nunca liberar manualmente contato real para forçar PASS.

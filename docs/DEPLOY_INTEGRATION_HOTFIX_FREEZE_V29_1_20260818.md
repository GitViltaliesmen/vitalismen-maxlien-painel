# Freeze técnico V29.1 — Deploy Integration Hotfix

Data: 2026-08-18 (UTC)

## Lineage imutável

- V28: `7bd1418caf81b832f30acb7926f023df7a2e711e`.
- V29 funcional: `5c9f0fd96ddc0f3bd3cc02c24014e6b885c22b77`.
- Freeze V29 preservado: `freeze-v29-logistics-clean-chat-20260818`.
- Branch sucessora: `codex/deploy-integration-v29-1-20260818`.
- Rollback operacional deve ser a release que estiver realmente ativa imediatamente antes da futura ativação.

## Correção exclusiva

Os comandos `deploy:vps` e `deploy:ec-safe` deixaram de invocar diretamente o runtime/approval V28, incompatível com o sucessor V29. Agora exigem explicitamente o guard e a autorização de preparação V29.1, preservam os testes V28/V29 e rejeitam lineage desconhecida, SHA falso e tag de produção inválida.

O runtime V29.1 verifica por hash os manifestos V28 e V29, herda todos os arquivos funcionais congelados e permite substituição somente de `package.json` e do import de guard em `src/index.js`. Bot, funil, mensagens, painel, VSL, logística, Name Resolver e regras de pedido não foram alterados.

## Ativação bloqueada

Os scripts locais de deploy são autorizados somente para preparar release sem ativação. `VITALISMEN_DEPLOY_ACTIVATE=YES` e `EC_SAFE_DEPLOY_ACTIVATE=YES` falham antes de qualquer acesso remoto. A ativação futura exige o helper root transacional, release staged, rollback confirmado e permit específico de uso único.

## Publicação e efeitos

Esta aprovação permite preparar e promover a fonte V29.1 para `production`, com tag oficial correspondente ao SHA real, mas não autoriza alterar `/current`, reiniciar PM2 ou ativar produção sem os gates remotos. Nenhuma mensagem, pedido, Purchase, Meta/CAPI ou Dropi pode ser executado nesta etapa.

## Validação obrigatória

Antes do commit/tag: lint, suíte integral, senior check, official path, freeze-lock, guards EC/Tex Ultra e V29, guard V29.1, deploy guard negativo/positivo, `git diff --check` e secret scan devem estar PASS. A VSL deve permanecer sem diff desde a V29.

Resultado final antes do commit: lint PASS; `npm test` e senior check PASS com 210/210 testes; official path PASS na raiz canônica; freeze-lock PASS; guards EC/Tex Ultra, V29 e V29.1 PASS; ativação direta recusada com código 78; `git diff --check` e secret scan PASS; VSL com diff zero.

## Estado remoto

O acesso SSH oficial não está disponível no host local no momento deste freeze. Sem `VPS ACCESS`, `ROLLBACK CONFIRMED` e `CANDIDATE RELEASE`, nenhuma ativação é permitida.

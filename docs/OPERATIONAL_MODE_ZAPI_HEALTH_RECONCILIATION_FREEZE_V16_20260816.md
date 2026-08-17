# Trava sucessora V16 — modo operacional e health Z-API

Data: 2026-08-16.

Freeze ID: `operational-mode-zapi-health-reconciliation-v16-20260816`.

Parent: `whatsapp-chats-readonly-hardening-v16-20260816`.

Status: `implementation_candidate_locked`.

Publicacao: `not_published`.

Producao inalterada durante a criacao da candidata: `true`.

## Objetivo

Esta trava sucede o hardening read-only V16 para reconciliar, sem alterar o modo operacional real, a documentacao dos dois estados aceitos pelos guards e a leitura de disponibilidade do WhatsApp oficial EC.

A camada corrige o falso negativo que classificava a operacao como degradada quando Baileys permanecia em `scanning`, embora a Z-API oficial estivesse configurada e conectada.

## Contrato dos dois modos

### Observacao / nao operacional

Quando `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true` nao esta ativo, o conjunto de flags definido pelo senior guard permanece integralmente no modo observacao. Nesse estado, `WHATSAPP_FUNNEL_ENABLED=false` e uma trava anti-legado.

### Operacional aprovado

Quando `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, todas as flags acopladas devem corresponder exatamente ao conjunto operacional do senior guard. Nesse estado completo, `WHATSAPP_FUNNEL_ENABLED=true` e valido.

E proibido alterar apenas `WHATSAPP_FUNNEL_ENABLED`, aceitar combinacao parcial ou usar essa flag para recriar qualquer servico legado removido. A troca entre modos e uma mudanca operacional coordenada.

Os contratos executaveis existentes em `scripts/senior-guard.mjs` e `scripts/official-state-audit.mjs` nao foram relaxados e ficam protegidos por hash nesta sucessao.

## Contrato de transporte e health

- Z-API permanece o transporte oficial da operacao EC;
- o health consulta `getZapiStatus()` sempre que a configuracao Z-API estiver completa;
- Z-API conectada e Baileys em `scanning` resultam em transporte operacional pronto;
- nesse caso, a falta de sessao Baileys nao adiciona `no_connected_whatsapp_session`;
- Z-API configurada e desconectada adiciona `zapi_not_connected`;
- quando Z-API nao esta configurada e Baileys e exigido, a falta de sessao Baileys continua adicionando `no_connected_whatsapp_session`;
- fila inbound excessiva e outros motivos legitimos continuam cumulativos;
- os campos existentes de health permanecem e `transports` e adicionado para expor, sem credenciais, o transporte oficial e o estado separado de Z-API/Baileys.

O health permanece somente leitura. Nao envia mensagem, nao cria/autentica sessao, nao escaneia QR, nao escreve banco, nao chama cliente e nao altera credenciais.

## Supersessoes controladas

Arquivos protegidos diretamente pelo parent e substituidos nesta camada:

- `package.json`, exclusivamente para conectar o guard/teste sucessor aos gates;
- `src/index.js`, exclusivamente para tornar o runtime guard sucessor o unico guard de topo.

Nao existe supersessao ancestral adicional. O hardening de `GET /api/whatsapp/chats`, `markRead`, o contexto V16, V15 e todos os freezes anteriores continuam validados por hash.

## Testes obrigatorios

`tests/operational-mode-zapi-health.test.mjs` protege:

- modo operacional aprovado completo;
- modo observacao completo;
- bloqueio de combinacao parcial;
- validade coordenada de `WHATSAPP_FUNNEL_ENABLED=true` no modo aprovado;
- Z-API conectada com Baileys scanning;
- Z-API desconectada;
- modo Baileys obrigatorio;
- preservacao de outros degraded reasons;
- normalizacao pura do status Z-API;
- ausencia de escrita e envio externo no health.

## Preservado

- `GET /api/whatsapp/chats` continua somente leitura;
- `markRead`, `POST /api/whatsapp/chats/read` e `metadata.panelLastReadAt` nao mudam;
- o contrato V16 de contexto atual continua `readOnly=true` e `applicationAllowed=false`;
- painel, funil comercial, pedidos, Dropi, Meta e schedulers nao mudam;
- nenhuma flag, `.env`, credencial, banco, schema, Nginx ou sessao WhatsApp e alterada;
- Baileys nao e autenticado nem se torna requisito quando a Z-API oficial esta saudavel;
- o processo Node orfao permanece fora do escopo.

## Evidencia e gates

- `node --test tests/operational-mode-zapi-health.test.mjs`;
- `node scripts/guard-operational-mode-zapi-health-v16.mjs`;
- `npm run senior:check`;
- `npm run guard:freeze-lock`;
- `npm run guard:status-panels`;
- `node scripts/audit-ec-product-micro-layer.mjs`;
- `git diff --check`.

## Rollback

Antes da publicacao, o rollback desta camada e retornar ao parent `whatsapp-chats-readonly-hardening-v16-20260816`. Depois de eventual ativacao, o rollback operacional deve usar exclusivamente o mecanismo oficial para restaurar a release anterior, sem corrigir codigo diretamente no VPS.

Este manifesto bloqueia a implementacao por hash; ele nao substitui preflight, promocao canônica, readiness ou rollback oficial.

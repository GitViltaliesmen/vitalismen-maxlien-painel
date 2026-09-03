# Microlayer V75 — isolamento local de canário

Data: 2026-08-28
Freeze ID: `canary-isolation-safety-v75`
Parent: `freeze-lock-ec-meta-dynamic-v74`
Estado: candidata exclusivamente local; não publicada, não staged e não ativada.

## Objetivo e limite autorizado

A V75 adiciona uma barreira única e fail-closed para um futuro canário do bot
Vitalismen Ecuador. A única identidade admitida durante esse canário é o
telefone QA autorizado `5515998038637`, comparado por todos os dígitos. Sufixo,
prefixo, telefone oficial, cliente EC, JID sem identidade resolvida ou segundo
item em allowlist são recusados.

Esta implementação existe somente na pasta local oficial. Ela não altera VPS,
release, `/current`, PM2, `.env`, banco, sessão Z-API/Baileys, WhatsApp, Dropi,
Meta, schedulers, mensagens ou tráfego. Também não publica branch/tag, não cria
stage e não instala o código.

## Fonte única e princípio fail-closed

O contrato central é `src/services/canaryIsolationV75Service.js`. Em ambiente
local/development, a microlayer permanece dormente até
`VITALISMEN_CANARY_V75_ENABLED=true`, para não transformar o ambiente existente.
Em `production`, uma operação marcada como piloto torna a V75 obrigatória: se a
flag explícita desaparecer ou qualquer combinação divergir, o startup bloqueia.
Nos gates de recipient/query, divergência gera bloqueio e consulta impossível
(`_id` inexistente), nunca fallback para a regra antiga por sufixo.

As cinco allowlists abaixo devem conter exatamente um item e ele deve ser o QA:

- `WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS`;
- `WHATSAPP_TEST_ALLOWED_RECIPIENTS`;
- `WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS`;
- `WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS`;
- `WHATSAPP_PRIORITY_TEST_PHONES`.

## Matriz candidata para uma autorização futura de canário

Esta matriz é um contrato versionado, não uma alteração do ambiente atual.

| Grupo | Valor obrigatório no futuro canário V75 |
| --- | --- |
| Runtime | `NODE_ENV=production`, `VITALISMEN_CANARY_V75_ENABLED=true` |
| Modo oficial | `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, `VITALISMEN_STRICT_READ_ONLY=false` |
| Funil/entrada | funil, auto reply, rota inbound, persistência inbound/ACK e locks EC em `true` |
| Schedulers aprovados | status, retirada e sweep de prova em `true`; `DISABLE_SCHEDULER=0` |
| Schedulers/produtores proibidos | carrier sweep, guia/print, bônus automático, recompra, follow-ups e filas não autorizadas em `false` |
| Dropi | sync ativo em `false`; modo fixo `REPORT_ONLY`; chamada externa bloqueada pela V75 |
| Meta | retro/test codes vazios; qualquer emissão Browser/CAPI bloqueada pela V75 |
| Pós-venda | V66/bridge prontos e autorização operacional exata; decisão ainda restrita ao QA |
| Recipient | todas as cinco allowlists iguais somente a `5515998038637` |

Mesmo quando o QA é aceito, Dropi e Meta continuam negados pelo gate de efeito
externo. Um scheduler desabilitado também conserva filtro de consulta e defesa
no loop, para que uma mudança acidental de flag não amplie o destinatário.

## Fronteiras cobertas

- inbound Z-API e Baileys antes de persistência, mídia, roteamento ou ACK;
- entrada/telemetria VSL antes de `VslVisit`, `ContactState` ou evento externo;
- outbound comum e limite final do provider Z-API para texto e mídias;
- consultas e loops de status, retirada, prova, bônus e carrier sweep;
- decisão central pós-venda antes de histórico, ledger ou lock;
- operações Dropi antes de lock, banco, navegador ou rede;
- eventos Meta antes de enriquecimento, montagem do payload ou rede.

## Correção de origem `/n/`

`/n` e seus subcaminhos pertencem exclusivamente ao Tex Ultra. A precedência é
aplicada mesmo quando um payload legado envia `productKey=nitrix_ec`. A comparação
é por segmento exato, portanto `/nitrix` não é confundido com `/n`. Um estado
legado com produto Nitrix e origem `/n/` não inicia o fast state Nitrix.

## Processo único para próxima autorização

1. Revisar diff, hashes, manifesto V75 e todos os testes localmente, mantendo o
   worktree sem stage.
2. Somente com nova autorização, fixar commit, tree, branch, tag e nome de release;
   publicação e stage continuam separados de ativação.
3. Executar stage/preflight ainda contido e validar a cadeia V75 → V74 → V73 →
   V72 → V71, compatibilidade de dados V66, overlay exato e rollback.
4. Somente com autorização específica de ativação de canário, emitir permit root
   de uso único e curta duração, ativar exclusivamente o processo oficial e
   manter tráfego público bloqueado.
5. Exercitar apenas `5515998038637`, verificando evidência de entrada, saída,
   idempotência, locks, filas e ausência de Dropi/Meta.
6. Encerrar o canário ou retornar ao baseline antes de qualquer autorização
   separada de tráfego real.

## Rollback

Antes de publicação, o rollback é apenas a reversão integral deste diff local.
Depois de eventual publicação, o rollback deve conter/parar o processo antes de
remover a flag V75, usar o baseline explicitamente atestado no permit, restaurar
symlink e overlay seguro pelo helper e então validar PM2/health. É proibido
simplesmente remover a flag enquanto as flags operacionais continuarem ligadas.
Não há rollback automático de dados; esta candidata não cria migration nem
escreve no banco.

## Evidência executável

- runtime guard: `src/services/canaryIsolationSafetyFreezeRuntimeGuardV75.js`;
- guard estático: `scripts/guard-canary-isolation-v75.mjs`;
- testes negativos: `tests/canary-isolation-v75.test.mjs`;
- manifesto: `docs/freeze/canary-isolation-safety-v75-20260828.json`.

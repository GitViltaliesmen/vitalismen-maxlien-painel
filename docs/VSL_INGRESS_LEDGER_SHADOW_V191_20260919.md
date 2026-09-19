# V191 — VSL ingress ledger read-only shadow

Data: 2026-09-19

## Resultado pretendido

A V191 acrescenta uma projeção de auditoria que reconstrói, sem alterar dados, o caminho observável entre um inbound do WhatsApp e a primeira resposta persistida do bot. Ela existe para localizar perda de cliente, falso positivo do watchdog, fila parada e atribuição tardia sem interferir na chegada do cliente, no funil comercial ou nos transportes oficiais.

Esta fase está somente criada e testada. Não foi publicada em stage ou produção e não está ativada por scheduler, rota HTTP, worker, PM2 ou import do runtime existente.

## Base e escopo congelado

- Release ativo usado como fonte: `20260919T011423Z_production-20260919-c0cca11`.
- Commit-base de governança exato: `da1868cb7fda596a9ec9342bf0031e1542113b12` (V192, sem alteração de runtime).
- Base operacional preservada pela V192: `c0cca110a87c82044db413934c7f017c23a9cfca`.
- Branch isolada: `codex/v191-vsl-ingress-ledger-shadow`.
- Arquivos funcionais preexistentes alterados: zero.
- V189 e V190 não foram incorporadas; somente a sucessão de guards V192 foi incorporada como base.
- VSL, chegada ao bot, motor comercial, painel QR, métricas, pós-venda V188, Meta/CAPI, Z-API e Dropi permanecem imutáveis.

O guard V191 exige que a diferença completa em relação ao commit-base seja composta exclusivamente pelos seis arquivos novos desta entrega. Também compara locks SHA-256 de oito superfícies congeladas. Qualquer alteração em arquivo preexistente reprova o guard antes da leitura dos locks.

## Fontes e identidade do ledger

A leitura usa somente consultas Mongoose terminadas em `lean()` nos modelos já existentes `Message`, `ContactState` e `VslVisit`. Não existe `save`, `create`, `insert`, `update`, `delete`, `bulkWrite`, envio de WhatsApp, emissão Meta/CAPI, alteração de pedido ou chamada Dropi.

A identidade canônica de um inbound confirmado é:

```text
provider:providerMessageId
```

Se `provider` ou `providerMessageId` estiver ausente, o registro é marcado `AMBIGUOUS`. A V191 não inventa uma identidade nem converte a mera existência local em aceite do provedor.

Um outbound só é reconhecido quando `Message.isFromMe === true` e ocorre depois do inbound na mesma conversa. O observador não executa roteamento; `ROUTE_OBSERVED` depende exclusivamente de `queueClaimedAt` ou `queueCompletedAt` já persistido.

## Estados observáveis

| Estado | Evidência mínima |
|---|---|
| `RECEIVED` | timestamp de recebimento existente, antes da persistência observável |
| `PERSISTED` | `Message.createdAt` do inbound |
| `ROUTE_OBSERVED` | `queueClaimedAt` ou `queueCompletedAt` já persistido |
| `FIRST_OUTBOUND` | primeira mensagem posterior da conversa com `isFromMe === true` |
| `PROVIDER_ACCEPTED` | `providerMessageId` ou estado explícito de aceite do provedor |
| `DELIVERED` | `deliveredAt`, estado entregue ou ACK 2 |
| `READ` | `readAt`, estado lido/reproduzido ou ACK 3+ |
| `NO_OUTBOUND_AFTER_SLA` | inbound persistido sem outbound após o SLA, padrão 120 s |
| `AMBIGUOUS` | falta de identidade canônica; não é contado como confirmação do provedor |

Estados terminais usam precedência monotônica: evidência posterior de menor nível não regride `READ` ou `DELIVERED`.

## Métricas e diagnósticos

O CLI aceita `--hours=N` ou `--days=N`, usa 24 horas por padrão e pode inspecionar um telefone com `--inspect-phone=...`. O telefone de inspeção é usado apenas em memória e nunca é impresso integralmente.

As métricas incluem:

- total de inbounds e conversas únicas;
- entradas explícitas Protocolo G, com exclusão do telefone brasileiro de QA por padrão;
- cobertura de primeira resposta, mínimo, mediana, P95, máximo e percentual dentro de 120 segundos;
- aceite, entrega e leitura comprovados;
- inbound órfão após o SLA;
- fila `PENDING` antiga ou `CLAIMED` com lease vencido;
- outbound Z-API falho;
- candidato de falso positivo do watchdog quando já existe outbound comprovado;
- candidato de atribuição tardia quando há uma única evidência compatível de bridge entre 30 e 180 segundos depois do inbound, sem gravar vínculo;
- clique de VSL sem inbound canônico confirmado.

`LATE_ATTRIBUTION_CANDIDATE`, `WATCHDOG_FALSE_POSITIVE_CANDIDATE` e `CLICK_WITHOUT_CONFIRMED_INBOUND` são diagnósticos conservadores. Nenhum deles corrige, reivindica, correlaciona ou persiste dados.

## Privacidade

- Telefone: somente SHA-256 e quatro últimos dígitos na projeção pública.
- Mensagem: somente tipo e SHA-256 do texto normalizado.
- Texto integral e telefone integral não aparecem na saída.
- O telefone de QA `5515998038637` é excluído por padrão e só entra com `--include-qa` explícito.
- A saída padrão do CLI contém apenas o resumo; o ledger detalhado não é impresso.

## Execução segura

Exemplos para um ambiente autorizado que já possua `MONGODB_URI`:

```sh
node scripts/audit-vsl-ingress-ledger-v191.mjs --hours=24
node scripts/audit-vsl-ingress-ledger-v191.mjs --days=7
node scripts/audit-vsl-ingress-ledger-v191.mjs --hours=24 --inspect-phone=NUMERO
```

Antes de qualquer preparação futura de shadow deploy:

```sh
node --test tests/vsl-ingress-ledger-v191.test.mjs
node scripts/guard-vsl-ingress-ledger-v191.mjs
npm run senior:check
node scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs
node scripts/guard-protocolo-g-conversion-v62.mjs
node scripts/guard-protocolo-g-ad-metrics-v63.mjs
node scripts/run-with-v192-context.mjs node scripts/audit-ec-nx-funnel-click-path-v192.mjs
```

## Não autorização e rollback

Esta entrega não autoriza deploy, stage, ativação, restart, mudança de flag, inclusão em scheduler ou import no runtime. O rollback local é remover o commit/branch V191. Como nenhum arquivo existente foi alterado e nada foi publicado, produção não exige rollback.

## Limite documental da base

O arquivo histórico `approved_freezes/diff_congelamento_total_vitalismen_20260517_021215.patch`, citado pela documentação antiga, não existe no commit-base ativo. Isso é registrado como lacuna histórica, não como alteração da V191. A proteção desta entrega é feita pelo commit-base exato, allowlist completa do diff e locks de conteúdo das superfícies congeladas.

## Auditoria read-only de produção

Execução em memória concluída em `2026-09-19T21:15:56.257Z`, cobrindo desde `2026-09-18T21:15:56.257Z`. O código foi enviado ao `node --input-type=module -` por stdin no release oficial; nenhum arquivo foi copiado para o VPS.

| Indicador | Resultado em 24 h |
|---|---:|
| Inbounds persistidos | 36 |
| Conversas únicas | 9 |
| Entradas explícitas Protocolo G, sem QA | 7 |
| Entradas explícitas com primeira resposta | 7/7 (100%) |
| Respostas em até 120 s | 7/7 (100%) |
| Primeira resposta mínima / mediana / P95 / máxima | 3.747 / 4.922 / 5.903 / 5.903 ms |
| Inbounds com outbound posterior | 36/36 |
| Outbounds aceitos / entregues / lidos | 36 / 36 / 19 |
| Inbound órfão após 120 s | 0 |
| Fila stale | 0 |
| Outbound Z-API falho | 0 |
| Inbounds sem identidade canônica do provedor | 4 |
| Conversas candidatas a falso positivo do watchdog | 4 |
| Conversas candidatas a atribuição tardia | 1 |
| Visitas com clique sem inbound canônico confirmado | 9 |

As sete entradas Protocolo G chegaram ao bot e receberam resposta entre 3,747 e 5,903 segundos. Quatro chegaram a `READ` e três a `DELIVERED`. Seis possuem vínculo VSL persistido. O único caso explícito sem vínculo é o contato terminado em `1564`: `PERSISTED` em `04:31:57.892Z`, primeira resposta em `04:32:03.203Z`, entrega em `04:32:08.419Z`, leitura em `04:35:06.631Z` e latência de 5.311 ms. Portanto, ele não foi perdido pelo bot; é candidato de atribuição tardia.

Os quatro registros `AMBIGUOUS` são follow-ups não Protocolo G, distribuídos por três conversas, sem `providerMessageId` do inbound. Todos têm outbound posterior. A ausência de identidade é uma lacuna de observabilidade, não evidência de perda.

Os quatro candidatos de watchdog são conversas únicas cujo estado persistido está `failed`, apesar de já existir outbound comprovado. Como o status é mantido por conversa, vários inbounds posteriores herdam o mesmo sinal; a V191 conta conversas únicas para não inflar o problema.

Os nove cliques sem inbound confirmado não podem ser chamados de perda do bot: o ledger não encontrou mensagem canônica recebida. Eles podem representar abandono entre CTA e WhatsApp, bloqueio externo, visita sem envio ou lacuna de bridge. A V191 mantém essa categoria separada de `NO_OUTBOUND_AFTER_SLA`.

Contadores de efeitos durante a auditoria: escrita no banco `0`, outbound WhatsApp `0`, alteração de pedido `0`, evento Meta `0` e alteração Dropi `0`.

## Gates executados

| Gate | Resultado | Diagnóstico |
|---|---|---|
| Testes V191 | PASS, 18/18 | projeção, privacidade, estados e casos adversos |
| Guard V191 | PASS | seis arquivos novos; zero arquivo funcional existente alterado; oito locks com diff zero |
| `npm run senior:check` sob contexto V192 | PASS | 43 + 482 + 22 testes; senior guard e guards finais aprovados |
| Guard V61 sob contexto V192 | PASS | sucessor V171 reconhecido pelo override finito do workflow |
| Guard V62 sob contexto V192 | PASS | sucessor V171 reconhecido pelo override finito de `src/routes/zapi.js` |
| Guard V63 sob contexto V192 | PASS | sucessor V185 reconhecido pelo override finito de `src/routes/whatsapp.js` |
| Auditor NX V192 | PASS | contrato funcional atual da CTA validado sem exigir texto visual histórico |

A V192 resolveu as cinco incompatibilidades herdadas em uma entrega separada, com três overrides exatos e sem alteração de runtime. A V191 foi reancorada sobre o commit V192 e revalidada integralmente antes do commit.

## Plano de correção sem retrocesso

1. **Governança destravada em mudança separada.** A V192 registrou os hashes atuais de `zapi.js`, `whatsapp.js` e do workflow, e passou a validar o contrato funcional atual da CTA sem mudar `public/n/index.html`. Nenhum runtime comercial entrou nessa correção.
2. **V191 revalidada sobre a V192.** Os 18 testes, guard V191, `senior:check`, V61, V62, V63 e NX foram reexecutados e passaram antes do commit.
3. **Solicitar autorização específica para shadow deploy.** A autorização atual diz `AUTORIZO_DEPLOY_V191=NAO` e `AUTORIZO_ATIVAR_V191=NAO`. Um deploy futuro deve adicionar somente os arquivos V191, sem importar o serviço no processo principal, sem scheduler e sem rota pública.
4. **Observar por 24–72 h antes de corrigir runtime.** Coletar cobertura, latência, órfãos, identidade ambígua, watchdog e atribuição tardia. Alerta de perda deve depender de inbound canônico persistido sem outbound após 120 s; clique sem inbound fica em categoria separada.
5. **Corrigir identidade ambígua como microcamada, se autorizada.** Preservar o identificador bruto do provedor ao persistir todo inbound, com teste de idempotência e sem mudar roteamento, ordem do funil, resposta ou transporte. Não retropreencher por suposição.
6. **Neutralizar falso positivo do watchdog, se autorizado.** Fazer o watchdog reconhecer outbound já persistido/aceito e encerrar o alerta sem reprocessar nem reenviar. A correção deve ter lock persistido, histórico e teste anti-spam; nunca pode enviar mensagem como efeito da reconciliação.
7. **Tratar atribuição tardia fora do bot, se autorizada.** Primeiro expor o candidato no observador. Uma futura persistência só pode ocorrer com candidato único, janela documentada e chave idempotente; não altera a mensagem recebida, o primeiro outbound ou o produto da VSL.
8. **Separar abandono de CTA de perda pós-inbound.** Investigar os nove cliques sem inbound por telemetria read-only. Não alterar CTA/VSL nesta linha de trabalho. Prioridade operacional permanece em `NO_OUTBOUND_AFTER_SLA`, que foi zero nesta janela.
9. **Canário e rollback.** Qualquer fase futura usa somente o telefone de QA autorizado, zero disparo em massa, verificação de PM2/release e rollback por remoção da microcamada. VSL, motor do bot, funil, Meta/CAPI, Dropi e V188 continuam sob hash lock.

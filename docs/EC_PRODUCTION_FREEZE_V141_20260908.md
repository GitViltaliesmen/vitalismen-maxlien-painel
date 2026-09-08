# Publicação e congelamento de produção V141 — 2026-09-08

Estado: **VITALISMEN_EC_V141_FROZEN_OPERATIONAL**. Auditoria e freeze: **PASS**.
Registro final em 2026-09-08 03:35:31 UTC, equivalente a 08/09 00:35:31 em São Paulo.

O operador autorizou expressamente: “AUTORIZO ESSA PUBLICAÇÃO E CONGELAMENTO PARA PRDUÇÃO”.
Este registro atualiza o estado operacional descrito nos documentos anteriores,
que registravam a candidata ainda não publicada.

## Identidade publicada

- VPS oficial: `root@72.60.137.77`.
- Release ativo: `/opt/vitalismen-automacao/releases/20260908T032306Z_production-20260908-60001a0`.
- Ponteiro oficial: `/opt/vitalismen-automacao/current`.
- Commit funcional: `60001a0d689c1778b10025e9e4bdd4d1adf5a6c0`.
- Tree funcional: `7a052ba928aa5101b57f1ddd87806f9440825bf1`.
- Origem: `refs/heads/codex/v141-meta-creative-fix`.
- Tag de produção: `production-20260908-60001a0`.
- Tag de freeze: `freeze-v141-meta-funnel-reconciliation-20260908`.
- Branch da documentação posterior: `codex/v141-production-freeze`.

As duas tags anotadas e a branch funcional foram verificadas no Git oficial
resolvendo para o mesmo commit. A branch remota `production` permaneceu em
`475ab887656bbb8865f3c16e42bec0d63e9421a6`, conforme o contrato de publicação V70
por tag imutável. A documentação posterior não modifica o pacote funcional congelado.

## Publicação executada

Foi criado um staging novo e íntegro a partir do commit corrigido. A candidata
antiga `20260908T004500Z_production-20260908-c1d4868`, anteriormente emendada e
marcada como exigindo novo staging, não foi ativada.

O helper oficial `/usr/local/sbin/vitalismen-stage` foi executado sem edição.
Como ele copia obrigatoriamente o ambiente do release ativo, o staging usou um
namespace de montagem privado: somente dentro desse processo a leitura do
ambiente de origem apontava para uma cópia privada com a substituição autorizada
de `META_ACCESS_TOKEN`. Todos os gates rodaram sobre o ambiente efetivamente
incorporado ao pacote novo. O arquivo ativo da V140 permaneceu byte a byte igual.
Os fingerprints e envelopes foram gerados pelo próprio helper, sem alteração
posterior para acomodar a credencial.

A publicação usou `v70-publish`; a ativação seguiu contenção V78, preflight,
autorização de uso único vinculada à V141 e à V140, validação V70 e
`v66-activate-safe`. Depois foi emitida e consumida a autorização V78 para
restaurar o perfil operacional aprovado. O estado PM2 foi salvo.

O HTML público de métricas era servido pelo Nginx a partir de
`/var/www/ec.maxlien.shop/funnel-metrics.html` e ainda correspondia à V140.
Após leitura e backup, somente esse arquivo foi substituído atomicamente pelo
`public/funnel-metrics.html` da V141. O conteúdo recebido pela URL pública
passou a corresponder exatamente ao release:

`df767566b206b12347bf5314591bc1a3b406abda18ac82a687a2a14ca1f6d69a`.

A configuração Nginx, as páginas EC verificadas e `public/qr.html` conservaram
seus hashes.

## Credencial

```text
META_ACCESS_TOKEN=<SET>
tokenConfigured=true
tokenValid=true
adsRead=true
accountRead=true
insightsRead=true
erro sanitizado=null
```

O ambiente novo foi validado como `root:root`, modo `0600`.
A comparação em bytes, neutralizando somente a linha `META_ACCESS_TOKEN`,
confirmou preservação de todas as demais variáveis, inclusive
`META_ACCESS_TOKEN_EC` e `META_PIXEL_ID_EC`.
Nenhum token integra a documentação, o Git ou as evidências sanitizadas.

## Testes e funcionamento observado

- 18 etapas e gates oficiais do staging: PASS, incluindo senior check, integridade,
  compatibilidade de dados, produto, anti-spam, contatos e regressões de pós-venda.
- Suíte específica no novo pacote: 17 testes, 17 PASS, zero falhas.
- Guard V141 e nova validação do release imutável após ativação: PASS.
- Plano de rollback V66 para a V140: PASS; rollback não executado.
- PM2 `vitalismen-automation`: online, PID `4028293`, contador de reinícios `218`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`;
  `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- O CWD real de `/proc/4028293/cwd` resolve para o novo release V141.
- Perfil `EC_BOT_CORE_OPERATIONAL`; status V78 `ACTIVE_VALID`.
- Health público: HTTP 200, online e sem razões de degradação.
- Z-API conectada e transporte oficial pronto; Mongo ping e Nginx: PASS.
- API de métricas consultada localmente: HTTP 200, versão V141,
  integridade PASS, Meta disponível, fetch OK e sem cache obsoleto.
- HTML de métricas público: HTTP 200 e hash idêntico ao release.
- API pública de métricas sem autenticação: HTTP 401, proteção preservada.

### Gates Meta após ativação

| Gate | Resultado |
| --- | --- |
| META_TOKEN_VALID | PASS |
| META_ADS_READ | PASS |
| META_ACCOUNT_MATCH | PASS |
| META_INSIGHTS | PASS |
| META_CREATIVE_READ | PASS |
| AD_ID_TO_CREATIVE | PASS |
| META_LIVE_FETCH | PASS |

O diagnóstico GET-only executou 33 consultas: permissões, conta, Insights de
verificação, uma página de Insights completos e 29 consultas de criativos.
Todas responderam HTTP 200, sem erro sanitizado. A janela auditada de sete dias,
01–07/09 no Equador, retornou 29 anúncios e 29 vínculos completos a criativos.
O diagnóstico usou o código real e cache em memória, sem gravar o cache operacional.

### Atualização independente do painel

Foram instaladas as units oficiais da V141:

- `/etc/systemd/system/vitalismen-meta-ads-insights-v141.service`;
- `/etc/systemd/system/vitalismen-meta-ads-insights-v141.timer`.

Timer habilitado e ativo, com intervalo de cinco minutos e pequena variação
prevista na unit. A execução do serviço terminou com `Result=success` e código 0.
Também foi executado o script oficial forçando uma busca ao vivo por uma variável
temporária de duração do processo: `source=live`, `fetchStatus=ok`,
`stale=false`, `lastError=null`, sete dias e 29 anúncios.

O cache é compartilhado entre o job e os filtros do painel. No momento do freeze,
a janela corrente era 07/09, um dia, com 16 anúncios e 16 criativos válidos.
Essa variação não é falha: a auditoria compara os anúncios e vínculos da mesma
janela, e conserva separadamente a prova dos 29 anúncios na janela de sete dias.
O congelamento fixa a revisão publicada; as métricas continuam sendo atualizadas.

## Preservado e limites da validação

A V141 publica a microcamada de métricas aprovada e a correção pontual da leitura
de `creative.url_tags`. Conserva o conteúdo do funil, preços, VSL, transporte
Z-API, credenciais EC e proteções existentes.

O caminho já incluído na V141 para Purchase futuro depende de sucesso Dropi
autorizado por ação humana e mantém deduplicação. Esta publicação não executou
Purchase retroativo, envio de pedido ou mensagem de teste para cliente.
O health confirmou `dropiApplyAllowed=false` e `mutatingSchedulers=0`.

A prova operacional cobre processo, health, conectividade, leitura real da Meta,
cache, API e arquivo público. Não foi simulada uma compra real nem enviado um
WhatsApp para comprovar o atendimento de ponta a ponta.

A V142 da outra tarefa não foi incorporada. Uma futura publicação deve partir
deste baseline e preservar a correção de `creative.url_tags` e a credencial
validada, passando novamente pelos gates e pela autorização correspondente.

## Backups, evidência e congelamento

Snapshot privado antes da publicação:
`/opt/vitalismen-automacao/backups/v141-prepublication-20260908T032306Z`.

Inclui ambiente anterior, código V140, estado de deployment, dump Mongo,
backup SQLite validado por `PRAGMA integrity_check`, registros de PM2 e health.
O manifesto original de checksums do snapshot foi revalidado com sucesso.
O HTML público anterior está em `funnel-metrics-before.html` nesse diretório.
Os logs de staging, ativação, testes e as evidências estão protegidos no VPS.

Recibo final:
`/opt/vitalismen-automacao/backups/v141-production-freeze-20260908T033531Z/FINAL_FREEZE_V141.json`.

SHA-256:
`ffaa243f1b4a833640fac16600facadc216db9ca8675468a4c7a9cf44c432dd0`.

Recibo e checksums: modo `0444`; diretório do freeze: modo `0555`.
Evidência sanitizada versionada:
[evidence/production-freeze-v141-20260908.json](evidence/production-freeze-v141-20260908.json).

## Retorno à V140

Release preservado:
`/opt/vitalismen-automacao/releases/20260907T222623Z_production-20260907-13e752a`.

O plano oficial `v66-rollback-plan` foi aprovado e está em
`rollback-plan.txt` no snapshot. Para executar um retorno autorizado, usar
contenção do perfil V78, interromper/desabilitar o timer específico V141,
emitir autorização de uso único para a V140 vinculada ao current V141,
executar preflight e ativação pelo helper oficial e restaurar o perfil
operacional V78 para a V140. Restaurar também o HTML público a partir do backup
por substituição atômica.

Confirmar current, CWD real, executável do PM2 e health após o retorno.
O snapshot dos bancos é uma proteção adicional; esta publicação não realizou
migração de dados que exija restaurar esses bancos.

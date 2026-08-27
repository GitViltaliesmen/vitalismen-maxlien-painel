# Freeze V70 — publicação fechada e attestation imutável

Data: 2026-08-27
Escopo: somente Vitalismen Ecuador oficial.
Ancestral imutável: V69 (`deploy-stage-source-ref-safety-v69-20260827`).
Compatibilidade de dados preservada: 66.

## Objetivo

A V70 corrige exclusivamente o contrato de publicação de uma release já criada pelo
stage de ref remota exata. O payload funcional aprovado continua identificado pelo
par `functionalCommit`/`functionalTree`; publicação não altera código, `.env`,
overlay safe, `current`, PM2, provedores, Dropi, bridge ou banco.

Esta implementação local não autoriza instalar o helper, executar stage ou
publicação real, criar/mover tag, mover `production`, ativar release ou operar a VPS.

## Causa raiz formal

A auditoria do contrato V69 confirmou seis causas concorrentes:

- A. **METADATA NOT ATTESTED — CONFIRMED:** o marker do staging não prendia o
  SHA-256 final da `.release-source.json`.
- B. **PUBLICATION STATUS FAIL-OPEN — CONFIRMED:** valores diferentes de
  `staged_candidate` podiam cair semanticamente no caminho publicado.
- C. **NO OFFICIAL PUBLISH TRANSITION — CONFIRMED:** não havia uma operação única,
  atômica/fail-closed e auditável para criar o estado publicado.
- D. **REMOTE TAG NOT VERIFIED — CONFIRMED:** a ativação podia confiar na metadata
  sem resolver novamente a tag no remoto real.
- E. **PREFLIGHT NOT BOUND TO FINAL METADATA — CONFIRMED:** o marker não continha a
  cadeia de hashes da identidade staged e da publicação.
- F. **POST-STAGE METADATA MUTATION POSSIBLE — CONFIRMED:** a source metadata podia
  receber campos depois de `.staging-complete.json` sem invalidar o contrato.
- G. **OTHER — NONE IDENTIFIED:** nenhum defeito adicional no payload funcional V69,
  compatibilidade de dados V66 ou fluxo comercial foi identificado nesta missão.

## Máquina de estados fechada

Existem somente dois estados válidos:

1. `staged_candidate`: `.release-source.json` e `.staging-complete.json` completos,
   imutáveis e sem declaração de uma publicação que ainda não ocorreu;
2. `production_published`: os documentos staged permanecem byte a byte iguais e
   passam a ser acompanhados por `.release-publication.json` e
   `.publication-complete.json` válidos.

Estado ausente, desconhecido, parcial ou contraditório falha fechado. A
`.release-source.json` nunca é reescrita para simular publicação.

## Nascimento completo no stage

O stage grava a `.release-source.json` uma única vez com:

- source ref completa e autorizada;
- commit resolvido, functional commit e functional tree;
- `guardChainVersion: 70`;
- `dataCompatibilityVersion: 66`;
- baseline somente leitura de `origin/production`;
- estado `staged_candidate`;
- contrato de compatibilidade pós-venda V66.

O SHA-256 desse arquivo é capturado imediatamente e conferido de novo após todos os
gates. O fingerprint funcional exclui somente envelopes operacionais controlados,
`.git`, `node_modules` e `.env`; qualquer alteração em arquivo funcional durante o
stage ou publish bloqueia a operação. `.env` e `node_modules` possuem fingerprints
próprios, registrados no staging e repetidos na publicação/attestation; portanto,
eles também não podem mudar entre `npm ci`, gates, publicação e preflight.

O overlay `V66_SAFE_OBSERVATION_ONLY` nasce no stage e seu SHA-256 é incorporado ao
`.staging-complete.json`. Ao final, source metadata, staging marker e overlay ficam
somente leitura. O staging marker também ata release, ref, commit, tree, fingerprint,
guard 70, dados 66, production before/after, `current` e PM2 inalterados.

## Publicação V70

Interface exata:

```sh
vitalismen-stage v70-publish RELEASE SOURCE_REF EXPECTED_COMMIT EXPECTED_TREE EXPECTED_TAG
```

O comando exige autorização externa exata para source ref e tag. Ele aceita apenas
tag `production-YYYYMMDD-abcdef0`, consulta a tag no remoto configurado por
`git ls-remote --tags` e exige que o target resolvido seja o `functionalCommit`.
A branch remota `production` deve ser idêntica ao baseline do stage antes e depois.

O publish não cria tag nem altera branch: ele somente atesta uma tag remota que já
existe e corresponde à identidade aprovada. A gravação local usa arquivos
temporários exclusivos, valida a cadeia completa e só então conclui os dois
documentos imutáveis. Falha intermediária remove o envelope parcial.

`.release-publication.json` ata:

- release, source ref, functional commit/tree/fingerprint;
- tag de publicação e commit resolvido da tag;
- hashes de release-source, staging-complete e overlay;
- guard 70, dados 66 e production inalterada.

`.publication-complete.json` ata novamente todos os campos acima e também o hash da
metadata de publicação, registrando explicitamente zero ações PM2, provider, Dropi,
bridge e mutações.

## Preflight e ativação

Um preflight feito enquanto a release ainda é staged não é aceito como autorização
de ativação. A publicação remove o marker anterior e exige novo `v66-preflight`.
O marker novo contém status publicado, tag remota validada, commit, tree,
fingerprint e os quatro hashes da cadeia de attestation, além de `.env`, overlay,
`current`, estado PM2 e perfil safe. Ele expira em 30 minutos.

Antes de qualquer switch, `v66-activate-safe` exige, nesta ordem lógica:

- release V70 integral e status `production_published`;
- tag remota ainda existente e apontando ao functional commit;
- attestation e fingerprints íntegros;
- preflight pós-publicação fresco e vinculado aos mesmos hashes;
- permit root válido, exato, temporário e single-use;
- origem saudável quando aplicável;
- compatibilidade de dados V66 `PASS_SAFE_BOOT`.

`v70-activation-validate RELEASE` executa as mesmas validações sem consumir o permit,
sem trocar `current` e sem executar PM2. Ele existe para prova sintética end-to-end.

## Preservado

- V69 e todos os seus artefatos dedicados permanecem byte a byte imutáveis.
- A cadeia canônica é V70 → V69 → V68 → V67 → V66.
- O helper conserva uma definição e 18 chamadas `run_protected`.
- O modo seguro continua `V66_SAFE_OBSERVATION_ONLY` e Dropi `REPORT_ONLY`.
- Nenhum fluxo comercial, WhatsApp, produto, preço, checkout, Meta/CAPI, mídia,
  scheduler, banco ou memória de pedido foi alterado.

## Rollback e operação

O rollback continua apenas planejável e exige autorização separada. Nenhum runtime
antigo é iniciado implicitamente. Esta camada não muda a política de containment.

Qualquer publicação real futura exige que a tag remota exata já tenha sido criada
por um ato autorizado fora deste helper, além das variáveis de autorização exata.
Esta V70 local, por si só, não concede essa autorização.

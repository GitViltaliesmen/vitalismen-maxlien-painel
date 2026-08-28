# Freeze V77 — controle e contenção temporizada do canário QA

Data: 2026-08-28
Freeze ID: `canary-controller-safety-v77`
Parent: `deploy-health-bridge-semantics-v76`
Estado: candidata exclusivamente local; sem commit, push, tag, stage, deploy ou ativação.

## Objetivo

A V77 controla a abertura temporária da microlayer V75 sem ampliar seu escopo.
O único destinatário possível continua sendo o telefone QA `5515998038637`.
O canário somente pode iniciar sobre uma release publicada, íntegra, corrente e
saudável, depois de um perfil root-only atestado e de um permit root de uso
único. O permit pode ser usado por no máximo dez minutos e a janela operacional
predefinida nunca pode ultrapassar sessenta minutos.

## Identidade e artefatos root-only

O controlador vincula simultaneamente:

- release, commit, tree e tag da candidata V77;
- baseline V76 `20260828T210000Z_production-20260828-297324a`, commit
  `297324afa20ae5d59fbcb6080eae2e62c4841c8b`, tree
  `56a2b2cdc5c3062d1b90b7906bb48c705ab7d865` e tag
  `production-20260828-297324a`;
- telefone QA integral;
- identificador do permit, início e expiração da janela;
- SHA-256 do payload canônico do perfil, overlay integral, manifesto, metadata
  de release, attestation de stage e attestation de publicação.

Artefatos futuros, criados somente por autorização operacional separada:

- overlay: `.env.v77-canary-qa`, `root:root 0400`;
- attestation: `.canary-v77-profile-attestation.json`, `root:root 0400`;
- permit: `/var/lib/vitalismen-deploy/canary-v77-permit.json`, `root:root 0600`;
- prova consumida: `canary-v77-permit.consumed.<permitId>.json`, preservada em
  `root:root 0400`.

Qualquer ausência, link simbólico, owner/mode, campo, timestamp, identidade ou
hash divergente bloqueia a ativação antes do restart.

## Matriz operacional fechada

As cinco allowlists V75 contêm exatamente `5515998038637`. A igualdade usa o
número integral; outro telefone, prefixo, sufixo, identidade vazia ou segundo
item falham fechados. Entrada Z-API/Baileys/VSL, saída, provider final,
consultas de status, retirada e prova, decisões pós-venda, ledgers e locks
reutilizam o gate central V75.

Somente os schedulers V75 de status, retirada e prova podem ser registrados,
sempre com consulta e defesa por item limitadas ao QA. Permanecem desligados:
carrier sweep, guia/print, bônus automático, recompra, follow-ups, backlog,
importações administrativas e watchdogs. Dropi permanece `REPORT_ONLY`, sem
APPLY. Dropi, Meta/CAPI e qualquer segundo destinatário são bloqueados antes do
efeito externo.

## Expiração e contenção

O relógio é consultado em cada decisão V75. Depois da expiração:

- nenhum novo destinatário é aceito;
- consultas Mongo retornam um predicado impossível;
- provider e efeitos externos continuam bloqueados;
- a configuração fica inválida e fail-closed;
- é obrigatório executar `v77-canary-contain`.

O comando explícito de contenção não altera `/current`. Ele reinicia somente
`vitalismen-automation` com o overlay seguro V76, limpa as identidades V77,
desliga V75 e todas as flags operacionais, valida PM2 e o health
`STRICT_READ_ONLY`. Se a recomposição não puder ser comprovada, o processo é
parado. A flag `VITALISMEN_CANARY_V75_ENABLED` não pode ser removida
isoladamente enquanto qualquer sentinela operacional estiver ligada.

## Comandos futuros e autorização

Os comandos abaixo são implementação local, não uma autorização para uso:

- `v77-canary-authorize RELEASE WINDOW_MINUTES`: exige root, frase exata
  `I_UNDERSTAND_V77_QA_CANARY`, health strict, rollback V76 compatível e cria o
  bundle atestado + permit;
- `v77-canary-validate RELEASE`: valida sem PM2 ou mensagens;
- `v77-canary-activate RELEASE`: consome o permit, não troca `/current`,
  reinicia somente o processo oficial e contém automaticamente qualquer falha
  de ativação;
- `v77-canary-contain`: restaura o perfil V76 `STRICT_READ_ONLY` ou para o
  processo se a validação falhar.

Nenhum comando envia mensagem, chama provider, Dropi ou Meta, altera banco ou
troca release.

## Testes e rollback local

O conjunto V77 cobre QA positivo e negativos para telefone diferente,
prefixo, sufixo, JID sem identidade, segunda allowlist, queries Mongo,
provider, Dropi, Meta, schedulers proibidos, expiração, permit reutilizado ou
vencido, janela excessiva, hash divergente, rollback incompatível e falha de
health.

Enquanto a candidata permanecer local, o rollback é descartar exclusivamente
o diff V77 e retornar ao commit V76
`297324afa20ae5d59fbcb6080eae2e62c4841c8b`. Não existe rollback de dados:
esta microlayer local não tocou MongoDB, VPS, PM2, integrações, mensagens ou
tráfego.

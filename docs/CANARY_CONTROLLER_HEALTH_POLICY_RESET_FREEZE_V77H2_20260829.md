# Freeze V77H2 — limpeza da política strict herdada no perfil QA

Data: 2026-08-29
País e sistema: Vitalismen Ecuador oficial
Base imutável: commit `23c81c762d58108307860d53770805acbd0e0ba8`, tree `2c40ec813cf70bb200f7d12d6ebc31443b664f6d`
Estado desta camada: candidata exclusivamente local; nenhuma ação de produção executada nesta fase

## Incidente delimitado

O hotfix V77H eliminou o conflito de stdin e permitiu verificar integralmente o
ambiente PM2. A tentativa QA seguinte revelou um falso negativo independente:
o overlay V77 não materializava `SAFE_OBSERVATION_POLICY`. Em
`restart --update-env`, o PM2 conservava o valor anterior
`SAFE_OBSERVATION_POLICY=STRICT_READ_ONLY`, embora as flags coordenadas do
canário estivessem corretas. O health recusou a janela e a contenção automática
restaurou o modo seguro, sem ciclo QA nem efeitos externos.

## Correção única autorizada

V77H2 acrescenta literalmente ao overlay QA:

```dotenv
SAFE_OBSERVATION_POLICY=
```

O valor vazio substitui a política herdada. O contrato V71 passa então a
resolver o modo pelo conjunto coordenado já aprovado: strict explícito falso,
aprovação operacional verdadeira, mutações V66 verdadeiras e controladores
V75/V77 ativos e temporizados. Ausência da chave ou valor
`STRICT_READ_ONLY` continua falhando fechado.

## Invariantes preservadas

- as cinco allowlists mantêm exclusivamente `5515998038637`;
- permit root-only, uso único e validade máxima de dez minutos não mudam;
- janela, attestation, identidade da release, baseline e rollback não mudam;
- Dropi permanece `REPORT_ONLY` e APPLY continua bloqueado;
- Meta/CAPI/Purchase, segundo destinatário e schedulers proibidos continuam
  bloqueados;
- queries, provider final, ledgers e locks permanecem limitados ao QA;
- fingerprint dos quatro processos PM2 externos continua obrigatório;
- o consumo integral de `pm2 jlist` sem `EPIPE` da V77H permanece intacto;
- a contenção restaura `SAFE_OBSERVATION_POLICY=STRICT_READ_ONLY`, strict
  explícito verdadeiro, mutações falsas e canário desligado;
- `ops/vitalismen-stage` não é alterado e conserva SHA-256
  `ff3d9c5ac129a98902b12ecda443cf97876b32142561ad46c70f3540c87c5853`.

## Testes de segurança

A suíte V77H2 reproduz a herança PM2, valida a sobrescrita vazia, comprova
strict desligado somente no perfil QA integral, bloqueia chave ausente ou
retida, revalida allowlists, permit vencido/reutilizado, Dropi, Meta,
destinatário extra, scheduler proibido, fingerprint externo e contenção. A
regressão com pipe real preserva leitura até EOF e zero `EPIPE`.

## Escopo negativo

Esta microlayer não altera motor do bot, funil, VSL, mensagens, áudios,
produtos, preços, checkout, banco, rotas comerciais ou integrações. Na fase
local não altera VPS, helper instalado, releases, `/current`, PM2, ambiente,
Z-API, WhatsApp, Dropi, Meta, schedulers, canário, bot ou tráfego.

## Rollback

O rollback local é retornar exclusivamente ao commit V77H
`23c81c762d58108307860d53770805acbd0e0ba8`. Em produção futura, a contenção
V77 restaura primeiro o perfil `STRICT_READ_ONLY`; o rollback de release usa a
V77H somente se a compatibilidade `PASS_SAFE_BOOT` for comprovada.

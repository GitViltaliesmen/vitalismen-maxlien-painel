# Incidente 502 e recuperação operacional V72 — 2026-08-28

## Sintoma

Cloudflare respondeu `502 Bad gateway` para `ec.maxlien.shop/qr.html`. O próprio
diagnóstico visual indicava navegador e Cloudflare funcionando, com erro no
host de origem.

## Causa comprovada

- Nginx estava ativo.
- `/n/`, servido como conteúdo público, respondia `200`.
- Nginx encaminhava `/qr.html` e `/api/` para `127.0.0.1:3001`.
- Não havia listener na porta `3001`.
- O processo PM2 `vitalismen-automation` estava parado, com PID `0`.

Portanto, o incidente não foi causado por Pixel, Cloudflare, DNS ou pelo
frontend. O backend oficial não estava em execução.

## Recuperação executada

Fonte imutável V72:

- commit `9dc57caf53350203a23227c2fc508a5486918ca2`;
- tree `da752cc6d1c9e97a5e15f44fa4ef11a272561fe4`;
- ref `refs/heads/codex/post-sale-safety-v72-20260828`;
- tag anotada `production-20260828-9dc57ca`;
- helper SHA-256
  `47acfd910326d36fcdd779edebda42fb7ecd1c8faf83cd5a9faaef1c3110f631`.

Release ativada:

```text
/opt/vitalismen-automacao/releases/20260828T032900Z_production-20260828-9dc57ca
```

O helper foi instalado atomicamente em `/usr/local/sbin/vitalismen-stage`, o
stage passou por 18 gates, a publicação foi atestada e a ativação consumiu um
permit root de uso único. A branch Git `production` permaneceu no commit
`1a3b9a517960d8f48d871d33a4a4098ee63d6fbd`.

## Estado validado após recuperação

- PM2 `vitalismen-automation`: online;
- `/proc/<pid>/cwd`: release V72 exata;
- `/qr.html`: `200`;
- `/api/health/`: `200`;
- `/n/`: `200`;
- auth, chats, messages, busca e ficha de cliente: `200`;
- POST mutante de prova: `423 STRICT_READ_ONLY_OPERATION_BLOCKED`;
- Z-API: conectada por consulta read-only;
- schedulers mutantes: zero;
- Dropi: `REPORT_ONLY`;
- bridge: desabilitado;
- `STRICT_READ_ONLY=true`.

## Prova de zero mutação

Baseline anterior:

```text
/var/lib/vitalismen-deploy/evidence/v72-20260828T032900Z-document-baseline-before.json
SHA-256 b3741acb0aa211dcf399dba9c9483f000a0dfaaf6181ac98d33cc0623d8a049e
```

Baseline depois de 15 minutos:

```text
/var/lib/vitalismen-deploy/evidence/v72-20260828T032900Z-document-baseline-after-strict-15m.json
SHA-256 7ded8147ac191fc03fdbc4c0022d6ff37b4cf6a654ac52e59fc5b29d90dfca1e
```

As oito coleções auditadas ficaram com `ADDED=0`, `REMOVED=0` e `CHANGED=0`,
com hashes agregados idênticos. O PID permaneceu estável, sem restart durante a
janela.

## Preservado

Nenhuma mensagem, mídia, pedido Dropi, Purchase Meta, bridge, scheduler ou
escrita de banco foi produzida pela recuperação. Produto, preço, funil, VSL,
checkout, números e dados existentes foram preservados.

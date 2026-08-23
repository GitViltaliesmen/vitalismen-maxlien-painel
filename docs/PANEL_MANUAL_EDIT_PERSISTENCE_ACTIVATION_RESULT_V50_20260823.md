# Resultado da ativação V50 — persistência da edição manual no painel EC

## Identificação publicada

- Pull request funcional: `#58` —
  `fix(painel): preserva edição manual da ficha`.
- Commit funcional: `3af08dcfe1979860900dc2d3f890261847fa215d`.
- Merge em `production`: `a17e51905c88c0d8bc2d605c7f3f837f2dd5b8d1`.
- Tag anotada: `production-20260823-a17e519`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260823T235000Z_production-20260823-a17e519`.
- Ativação concluída em `2026-08-23T23:50:46Z` pela rotina transacional
  oficial `/usr/local/sbin/vitalismen-stage`.

## Causa e correção

- A recarga periódica limpava a marca de correção humana durante a edição e o
  resolvedor restaurava o nome antigo protegido pelo lock anterior.
- O painel agora conserva o rascunho e `correctedByHumanFields` enquanto a
  ficha estiver em edição.
- Cada salvamento fixa contato, revisão e campos corrigidos antes do primeiro
  `await`; respostas antigas não escrevem nos inputs nem em outra conversa.
- Salvamentos concorrentes são serializados e o último valor digitado pelo
  operador permanece soberano.

## Auditoria da publicação

- GitHub Actions: Node 20, Node 22 e Cloudflare Pages aprovados.
- Regressão local: `316/316` testes oficiais aprovados.
- V49/V50: `12/12` testes aprovados localmente e na release ativa.
- Lint, senior guard, audit de produto EC, guard anti-spam de guia e guard de
  retirada: aprovados.
- Navegador Playwright com API simulada reproduziu autosave atrasado, segunda
  digitação e recarga periódica; o nome final permaneceu e o último `PATCH`
  levou `correctedByHumanFields: ["name"]`.
- Hash SHA-256 local, release e público de `public/qr.html`:
  `446776c4ec43cbbb284334348637bf9ce428bdbae6a3f41f6ac796064043fd83`.
- Hash SHA-256 local, release e público da política V50:
  `acf05791b4ac32228b5e016f7a6d06ab9b03c35b4a3b6ae664e652530ee7209e`.
- Health oficial: `online`, Z-API conectada, `ready=true`, saída desbloqueada e
  nenhuma razão de degradação.
- `/api/health`, `/qr.html`, a política V50 e `/n/`: HTTP `200`.
- `/api/zapi/status` anônimo permaneceu protegido: HTTP `401`.

## PM2, rollback e efeitos reais

- PID anterior: `2390819`.
- PID após reinício controlado: `2406151`.
- Status: `online`; `unstable_restarts=0`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- O CWD real do PID e o symlink `current` resolvem para a release V50 ativa.
- A autorização root de uso único foi consumida.
- Rollback disponível:
  `/opt/vitalismen-automacao/releases/20260823T231500Z_production-20260823-cbc845b`.
- Nenhum cliente real foi editado na validação. Nenhuma mensagem, mídia,
  pedido, Dropi ou evento Meta/CAPI foi criado como canário.

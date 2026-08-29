# V82 — Contexto sucessor no boot oficial

## Causa comprovada

O stage e a publicação V81 passaram, mas a primeira ativação segura foi contida pelo
helper oficial. O processo PM2 caiu antes de abrir o health porque a cadeia runtime
V73 avaliou `scripts/guard-meta-ec-protocolo-g-attribution-v61.mjs` sem o contexto
sucessor V78/V79. Esse contexto já era aplicado aos guards executados pelo npm, mas
não era carregado antes do primeiro guard importado por `src/index.js`.

## Correção mínima

A V82 acrescenta um único import antes da cadeia ancestral em `src/index.js`. A nova
microcamada valida os manifestos e hashes V81, limita o override sucessor ao próprio
`src/index.js` e reutiliza o contexto V78/V79 já congelado. O preload V82 estende o
preload V81 somente para que os mesmos guards oficiais aceitem esse override durante
`npm ci`, stage, publish, preflight e activation validation.

## Preservado

- V78, V79, V80 e V81 permanecem imutáveis.
- Dataset Meta EC: `1468946114265008`.
- CTA, VSL, produtos, preços, checkout e dashboard não mudaram.
- Schedulers mutantes permanecem bloqueados.
- Dropi permanece `REPORT_ONLY`; APPLY continua bloqueado.
- Meta Purchase permanece bloqueado.
- Tráfego de clientes reais continua não autorizado.
- Nenhum helper oficial foi alterado.
- Nenhuma infraestrutura operacional colombiana foi tocada.

## Validação e rollback

O teste reproduz o bloqueio V73 sem a V82 e comprova que a mesma cadeia runtime
carrega com a V82 antes de abrir o servidor. O rollback é voltar ao parent V81; como
o helper anterior já conteve a candidata e restaurou o symlink antigo sem iniciar
runtime legado, nenhuma liberação automática é produzida por este freeze.

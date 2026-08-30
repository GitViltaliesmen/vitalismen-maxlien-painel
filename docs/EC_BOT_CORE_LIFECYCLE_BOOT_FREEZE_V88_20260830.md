# V88 — Boot sucessor compatível com lifecycle de dependências

## Causa comprovada

A V87 corrigiu a ordem do primeiro import do runtime. No staging, porém, a
injeção necessária para os gates também alcançou o script `install` do Baileys.
Como esse processo roda dentro de `node_modules`, a V79 procurou manifestos
relativos no diretório da dependência e o `npm ci` falhou fechado. A release
incompleta foi removida e a V84 permaneceu ativa.

## Correção mínima

O preloader V88 distingue o `package.json` canônico do projeto dos lifecycles
de dependências. Apenas dependências são ignoradas. Runtime normal, scripts npm
do projeto e guards oficiais instalam os cinco overrides, a V79 e o guard V88.
O próprio preload é retirado de `NODE_OPTIONS` antes de processos-filhos, sem
remover `npm_config_node_options` usado por scripts npm aninhados.

## Preservado

- política, classificação, retries e travas operacionais V87/V86 preservados;
- schedulers mutantes permanecem em zero;
- Dropi permanece `REPORT_ONLY`, com APPLY bloqueado;
- Meta Purchase e tráfego de clientes reais permanecem bloqueados;
- nenhum produto, preço, CTA, áudio, mídia, funil ou regra de pedido foi alterado.

## Rollback

O rollback operacional permanece a release V84 validada em
`SAFE_OBSERVATION_ONLY/STRICT_READ_ONLY`.

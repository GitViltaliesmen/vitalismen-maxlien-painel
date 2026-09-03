# V85 — Classificação explícita do núcleo EC fora do canário V77

## Causa comprovada

O perfil V78 íntegro iniciou com o canário V75 e o controlador V77
explicitamente desligados, como exige o próprio contrato V78. O classificador
V77, porém, interpretou as flags operacionais do núcleo como um canário parcial
e interrompeu o boot com `CANARY_CONTROLLER_V77_INVALID`.

## Correção mínima

O controlador V77 deixa de exigir o bundle de canário somente quando o perfil
V78 completo passa `resolveEcBotCoreV78Configuration`. Uma flag V78 isolada,
hash divergente, scheduler liberado, Dropi APPLY ou Meta Purchase continuam
falhando fechados.

## Preservado

- a validação e a expiração do canário V77 não mudaram;
- o canário V75 continua exclusivo do telefone QA quando habilitado;
- o núcleo V78 conserva somente suas cinco classes de write autorizadas;
- schedulers mutantes permanecem em zero;
- Dropi permanece `REPORT_ONLY`, com APPLY bloqueado;
- Meta Purchase e tráfego de clientes reais permanecem bloqueados;
- a estabilização de health V84 permanece em 30 tentativas de dois segundos.

## Rollback

O rollback operacional permanece `ops/ec-bot-core-v78 contain`, seguido do
perfil V66 `SAFE_OBSERVATION_ONLY/STRICT_READ_ONLY`. Nenhum fluxo comercial,
produto, preço, CTA, áudio, mídia ou regra de pedido foi alterado.

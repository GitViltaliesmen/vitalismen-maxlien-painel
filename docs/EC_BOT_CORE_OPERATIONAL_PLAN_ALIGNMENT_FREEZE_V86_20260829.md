# V86 — Alinhamento do plano operacional ao sucessor do núcleo EC

## Causa comprovada

O perfil V85 corrigiu a classificação do núcleo V78, mas o helper operacional
`ops/ec-bot-core-v78` ainda executava diretamente o guard estrutural V78
congelado. Esse guard exige a evidência histórica anterior à prontidão V79 e,
por isso, interrompia o `plan` antes de qualquer ativação.

## Correção mínima

O `plan` chama o guard canônico V86, que valida a V85 íntegra e a cadeia
sucessora. O contrato V78 e o runtime guard V78 também exigem a V86 antes de
autorizar o bundle operacional.

## Preservado

- a classificação exata V85 não mudou;
- o retry de health permanece em 30 tentativas de dois segundos;
- o canário V77 conserva suas regras quando realmente habilitado;
- schedulers mutantes permanecem em zero;
- Dropi permanece `REPORT_ONLY`, com APPLY bloqueado;
- Meta Purchase e tráfego de clientes reais permanecem bloqueados;
- nenhum produto, preço, CTA, áudio, mídia ou regra de pedido foi alterado.

## Rollback

O rollback operacional permanece `ops/ec-bot-core-v78 contain`, seguido do
perfil V66 `SAFE_OBSERVATION_ONLY/STRICT_READ_ONLY`.

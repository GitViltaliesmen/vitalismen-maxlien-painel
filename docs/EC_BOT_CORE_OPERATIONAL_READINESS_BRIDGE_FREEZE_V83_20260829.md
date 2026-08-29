# V83 — Ponte de readiness operacional do núcleo EC

## Causa comprovada

Stage, publicação e ativação segura V82 passaram. O `plan` do helper oficial do
núcleo EC foi então bloqueado porque o contrato V78 exigia `deployment.ready=true`
no manifesto estrutural V78. Esse manifesto permanece corretamente congelado com
o blocker original, enquanto a sucessora V79 já resolveu a divergência, atestou a
origem pública oficial e declarou o perfil pronto para o próximo passo autorizado.

## Correção mínima

A V83 conserva o estado estrutural V78 e exige a cadeia V79 completa antes de o
contrato operacional aceitar a release publicada. O guard estrutural instala um
contexto sucessor limitado aos dois arquivos ancestrais indispensáveis. Nenhum
helper, overlay, perfil, regra comercial ou efeito externo foi ampliado.

## Preservado

- V78 estrutural continua congelada com o blocker histórico original.
- V79 continua sendo a única prova de readiness operacional.
- V80, V81 e V82 permanecem imutáveis.
- Dataset EC `1468946114265008` e igualdade Browser/CAPI permanecem obrigatórios.
- Schedulers mutantes permanecem bloqueados.
- Dropi permanece `REPORT_ONLY`; APPLY continua bloqueado.
- Meta Purchase permanece bloqueado.
- Tráfego de clientes reais continua não autorizado.

## Validação e rollback

Os testes comprovam que V78 isolada continua bloqueada, V79 íntegra libera apenas
o contrato operacional explicitamente autorizado e qualquer divergência em V79,
Dataset, CTA, schedulers, Dropi ou Meta falha fechada. O rollback operacional segue
o helper V66/V78 existente; nenhum novo caminho de rollback foi criado.

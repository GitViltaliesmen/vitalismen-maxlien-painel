# V87 — Contexto sucessor no primeiro import do runtime EC

## Causa comprovada

A release V86 passou pelos gates locais, staging e publicação, mas o primeiro
boot seguro do PM2 ainda carregava diretamente o guard V82 em `src/index.js`.
Assim, a alteração V85 em `canaryControllerV77Service.js` era verificada pelo
guard V77 antes de o contexto sucessor V86 existir. A ativação falhou fechada,
o symlink voltou à V84 e a produção segura foi reiniciada sem liberar tráfego.

## Correção mínima

O primeiro import de `src/index.js` agora instala o contexto V87 antes de
carregar qualquer guard ancestral. A camada declara os quatro overrides V86 e
o próprio `src/index.js`, valida a identidade V82 preservando todos os seus
arquivos exceto o entrypoint sucedido, e reconstrói o contexto ancestral pela
V79. O `plan`, o contrato e o runtime V78 passam a exigir o guard V87.

## Preservado

- a classificação, os retries e as travas operacionais V86 permanecem íntegros;
- o retry de health permanece em 30 tentativas de dois segundos;
- schedulers mutantes permanecem em zero;
- Dropi permanece `REPORT_ONLY`, com APPLY bloqueado;
- Meta Purchase e tráfego de clientes reais permanecem bloqueados;
- nenhum produto, preço, CTA, áudio, mídia, funil ou regra de pedido foi alterado.

## Rollback

O rollback operacional permanece o retorno à release V84 validada em
`SAFE_OBSERVATION_ONLY/STRICT_READ_ONLY`.

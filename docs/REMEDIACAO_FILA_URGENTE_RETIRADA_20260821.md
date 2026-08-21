# Remediação da fila urgente de retirada — 2026-08-21

## Sintoma confirmado

O espelho do Dropi classificava `Ingresando en Agencia` como
`READY_FOR_PICKUP`. A V29 bloqueava corretamente o aviso por falta de
`pickupReadyVerified`, mas o status visual voltava a parecer pronto a cada
sincronização do Dropi.

Na varredura de produção, 21 pedidos ativos estavam sem evidência de aviso:

- 17 ainda constavam em trânsito na consulta ao vivo da transportadora;
- quatro estavam em `NOVEDAD`;
- nenhum estava liberado para retirada naquele instante;
- oito permaneciam em revisão manual e não podiam entrar em envio automático.

## Microcamada aplicada

- `Ingresando en Agencia`, `Punto de retiro` e `En agencia` permanecem
  `EN_RUTA`.
- Somente `Listo para retiro`, `Para retiro en agencia`,
  `Disponible para retiro` ou `READY_FOR_PICKUP` autorizam a etapa pronta.
- Quando o sweep da transportadora confirma `READY_FOR_PICKUP`, o scheduler
  chama imediatamente o dispatcher de retirada, sem esperar o ciclo horário.
- Falha de envio não marca `readyForPickupNotifiedAt`; o pedido permanece na
  seleção persistida para nova tentativa.

## Preservado

- trava `manualOnly`;
- `pickupReadyVerified=true` obrigatório;
- lock persistido do dispatcher;
- pesquisa de histórico e campos persistidos de aviso;
- produto, preço, funil, Dropi de criação, Meta/CAPI, pixel e mídias.

## Validação obrigatória

```sh
node --test tests/dropi-automatic-submit-regression.test.mjs
npm run test:pickup-notifications
npm run guard:pickup-notifications
npm run senior:check
node scripts/audit-ec-product-micro-layer.mjs
```

Após ativação, confirmar `current`, `pm_cwd`, `pm_exec_path`, executar uma
varredura controlada da transportadora e auditar novamente a evidência de
chegada.

## Registro de produção

- PR oficial: `#10`.
- Commit/tag: `f6b74c7f584b943c5291c8d89dca2ba0f0e34353` /
  `production-20260821-f6b74c7`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260821T140217Z_production-20260821-f6b74c7`.
- Rollback imutável:
  `/opt/vitalismen-automacao/releases/20260818T221709Z_production-20260818-d6dc4a8`.
- Backup protegido de Shipments e Orders antes da reconciliação:
  `/opt/vitalismen-automacao/backups/pickup-urgent-sweep-20260821T140504Z`.
- PM2 confirmado com `pm_cwd=/opt/vitalismen-automacao/current` e
  `pm_exec_path=/opt/vitalismen-automacao/current/src/index.js`.
- Rastreamento e despacho configurados em ciclos de 20 minutos, lote 8, com
  estado salvo no PM2.
- Varredura real: 32/32 guias consultadas; 26 `EN_RUTA`, quatro `NOVEDAD`,
  duas pendentes, zero falhas e zero `READY_FOR_PICKUP` verificado.
- Dispatcher urgente executado em modo real: zero candidatos, zero envios e
  zero mensagens de retirada criadas durante a correção.
- Health local/oficial e `/n/`: OK/HTTP 200.
- `senior:check`: 213/213 testes aprovados em produção.

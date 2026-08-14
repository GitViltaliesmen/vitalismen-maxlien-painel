# Remediação dos avisos de retirada — 2026-07-30

## Sintoma em produção

O scheduler encontrava de 9 a 10 lembretes vencidos, selecionava três por ciclo
e registrava `Enviados 0/3`.

## Causa

Três shipments conservavam hashes legados de lembretes em
`automation.sentMessageHashes`, embora o campo e a evidência exata da etapa
estivessem ausentes. Esses registros eram selecionados em todos os ciclos e
impediam o restante da fila de avançar.

## Correção

Em `src/services/shipmentMessageService.js`, um hash de lembrete só bloqueia
quando o campo confirmado da mesma etapa também existe.

O histórico exato continua sendo consultado antes do envio:

- com evidência exata, a etapa é recuperada sem reenvio;
- sem evidência, o aviso vencido pode ser enviado uma única vez;
- hash e campo confirmado juntos continuam bloqueando duplicidade.

## Validação obrigatória

```sh
npm run test:pickup-notifications
npm run guard:pickup-notifications
npm run senior:check
```

Depois da ativação, confirmar no VPS:

```sh
pm2 describe vitalismen-automation
readlink -f /opt/vitalismen-automacao/current
npm run audit:pickup-evidence
```

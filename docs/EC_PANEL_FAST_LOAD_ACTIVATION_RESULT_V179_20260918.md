# V179 — resultado da ativação do carregamento rápido do painel

Data: 2026-09-18

## Identidade publicada

- autorização: `AUTORIZO_PUBLICAR_V179_PANEL_FAST_LOAD=SIM`;
- branch funcional congelado: `codex/v179-panel-fast-load`;
- commit funcional: `1c0e1457e0feedf8cd08e76a1593c9018a7ac3a1`;
- tree funcional: `f2f46aec3e0b05e6da95df57fcf3696bfff5a2a0`;
- tag de freeze: `freeze-v179-panel-fast-load-20260918`;
- tag canônica: `production-20260918-1c0e145`;
- release: `20260918T164248Z_production-20260918-1c0e145`;
- rollback preservado: `20260918T023837Z_production-20260918-6590b17`.

## Publicação controlada

O helper oficial `/usr/local/sbin/vitalismen-stage` executou staging por ref,
commit e tree exatos, publicação V70, preflight V66, autorização root de uso
único e ativação atômica. O perfil seguro foi validado antes da ativação
`EC_BOT_CORE_OPERATIONAL` pelo controlador `/usr/local/sbin/ec-bot-core-v78`.

Somente o processo PM2 `vitalismen-automation` foi reiniciado. O PM2 foi salvo
depois da validação operacional. Nenhum outro serviço foi reiniciado.

Backup anterior ao switch:

```text
/opt/vitalismen-automacao/backups/v179-preactivation-20260918T164700Z
```

## Validação pós-deploy

```text
CURRENT=/opt/vitalismen-automacao/releases/20260918T164248Z_production-20260918-1c0e145
PROFILE=EC_BOT_CORE_OPERATIONAL
EC_BOT_CORE_V78_STATUS=ACTIVE_VALID
HEALTH=ONLINE
STRICT_READ_ONLY=NO
ZAPI_CONNECTED=YES
PENDING_TASKS=0
TRAFFIC_READY=YES
PANEL_HTTP=200
V175_HTTP=200
VSL_HTTP=200
CRITICAL_ERRORS_RECENT=0
```

O PID final `1310487` possuía CWD real na release V179. O SHA-256 servido para
`public/qr.html` foi
`ccf29ca1123e2d1840d94ba30d9dc7e0e1787d8ab10a034b0bd3c9d7c70d5053`,
igual ao manifesto congelado.

## Desempenho real

Medição somente leitura do mesmo endpoint local oficial, com 219 conversas:

| Métrica | V178 antes | V179 depois | Resultado |
| --- | ---: | ---: | ---: |
| Tempo total | 13,006249 s | 1,173357 s | redução de 91,0% |
| Payload | 1.922.627 bytes | 974.515 bytes | redução de 49,3% |
| Resoluções detalhadas na lista | presentes | 0 | removidas da lista rápida |

A ficha detalhada selecionada continua calculando a resolução completa. A
redução sintética estrutural permaneceu em 81,6% no benchmark da projeção.

## Gates finais

- staging oficial: `PASS`;
- `senior:check`: `PASS`;
- predeploy sucessor V91: `PASS`;
- freeze lock: `PASS`;
- V171/TRAFFIC_READY: `9/9 PASS` e `TRAFFIC_READY=YES`;
- V178 ficha/status: `5/5 PASS` e navegador `PASS`;
- V179 desempenho: `4/4 PASS`;
- guards ignorados: `NO`;
- escrita de auditoria em clientes/pedidos: `0`;
- mensagens de teste: `0`;
- Dropi APPLY: `BLOCKED`;
- Meta Purchase: `BLOCKED`;
- schedulers mutantes: `0`.

## Preservado

VSL, V175, V176, V177, V178, os nove status, bot, funil, produtos, preços,
áudios, Dropi, Meta, Pixel, CAPI, Purchase, Z-API, MongoDB e Nginx não sofreram
mudança funcional fora da microcamada V179. As 26 visitas VSL EC das últimas 48
horas permaneceram persistidas; a visita mais recente continuava atribuída a
`tex_ultra_ec` e `PROTOCOLO_G`.

Resultado final: `V179_DEPLOYED_AND_FROZEN`.

# V164 — ativação shadow do worker Web e preparação do canário

## Escopo

A V164 sucede exatamente a V163 e autoriza somente staging de candidata e
ativação do processo `vitalismen-whatsapp-web-shadow-v164`. O symlink `current`,
o processo `vitalismen-automation` e a Z-API permanecem inalterados.

O worker reutiliza a sessão externa `V152_TEST_WEB_01`; QR, pairing code e novo
pareamento são proibidos. Seu contrato é `shadow=true`, `draining=true`,
`weight=0`, `capacity=0`, sem fila outbound, roteamento de cliente, handoff,
failover ou cutover.

## Canário posterior

Esta missão não envia mensagem. O único destinatário permitido para o próximo
canário controlado é `5515998038637`. A identidade Web `5531983002800` pode
permanecer conectada, sem autorização de tráfego geral.

## Rollback

`ops/web-shadow-v164 rollback RELEASE CONFIRM_STOP_WEB_WORKER_ONLY_V164` remove
somente o processo Web do PM2, salva a lista de processos, confirma que o bot
principal/current não mudaram e preserva integralmente a sessão externa. O
rollback não exige QR.

Antes do canário, `restart-check` reinicia somente o processo Web e exige PID
novo, contador de restart incrementado, heartbeat novo e restauração integral da
mesma sessão. O `current` e o processo principal são comparados antes e depois.

## Achado V47

O arquivo `.github/workflows/ec-panel-quality.yml` é preservado byte a byte e
declarado apenas como compatibilidade ancestral conhecida. O guard V47 e o
workflow não são modificados nesta missão.

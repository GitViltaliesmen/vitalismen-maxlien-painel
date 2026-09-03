# Freeze V112 — monitor do próximo elegível pós-venda EC

Data: 2026-09-03
Escopo: detector transacional pós-venda, somente Equador
Pai: V111 (`d8313dae376f09d72e641c271b70d181c72a9891`)

## Motivo

A varredura integral feita após os Gates 1 e 2 encontrou oito shipments
potenciais, mas nenhum `SHOULD_SEND`: quatro estavam protegidos por
`human.mode=manual`, três foram bloqueados pela cronologia e um exigia revisão
manual. O contrato operacional proíbe inventar cliente, usar backlog ou enviar
evento histórico para homologar o scheduler.

## Controle congelado

A V112 acrescenta somente um control plane externo ao processo de venda:

- o timer executa uma varredura read-only a cada cinco minutos;
- a consulta usa o perfil V105/V108/V109 em processo isolado, sem alterar o
  ambiente do PM2;
- todos os métodos mutantes do driver Mongo ficam interceptados pelo guard V71;
- qualquer tentativa HTTP durante a detecção é bloqueada antes da rede;
- o relatório não contém telefone completo nem credencial;
- o permit é root-only, vinculado a release, commit e tree exatos, tem uso único
  e expira em 30 dias;
- somente o primeiro `SHOULD_SEND` natural pode consumir o permit;
- antes da ativação são repetidos health, identidade PM2, `senior:check` e uma
  segunda varredura do mesmo candidato;
- a promoção usa exclusivamente `ops/post-sale-v105`: authorize, activate,
  batch-plan e batch-run;
- qualquer falha depois da ativação contém somente o pós-venda e restaura o
  bot de venda;
- a V112 nunca promove lote 3 ou 5. Após o primeiro 1/1, a observação de 30
  minutos e uma nova decisão operacional continuam obrigatórias.

## Limites permanentes

`BATCH_MAX=1`, `DAILY_LIMIT=1`, backlog histórico, Dropi automático, Dropi
APPLY, marketing e Meta retroativo permanecem desligados. O detector não
altera `human.mode`, shipment, ledger, pedidos ou mensagens. Ele não reenvia o
pedido 3469 e não modifica `EC-RECOMPRA-MTKEFGCW-RZA8` nem
`EC-DROPI-5756679`.

## Instalação e rollback

Os units versionados são instalados a partir da release oficial em
`/etc/systemd/system/vitalismen-postsale-next-eligible-v112.{service,timer}`.
O estado root-only fica em `/var/lib/vitalismen-deploy` e os relatórios em
`/var/log/vitalismen-deploy`.

Rollback do monitor: desabilitar apenas o timer V112 e arquivar o permit. Isso
não reinicia o PM2, não troca `current` e não altera bot, Dropi, recompra, ficha
ou banco. Se a ativação V105 já tiver ocorrido e falhar, usar a contenção V105,
que restaura somente o perfil do bot de venda.

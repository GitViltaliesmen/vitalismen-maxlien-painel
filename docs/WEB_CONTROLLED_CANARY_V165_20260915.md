# V165 — canário outbound Web controlado

## Escopo

A V165 sucede a V164 sem promover a candidata para `current`. Ela adiciona uma
microcamada one-shot que aceita somente WhatsApp Web, o telefone de QA
`5515998038637`, uma única mensagem de texto literal e uma única tentativa.

Texto imutável:

```text
Prueba técnica controlada V165 por WhatsApp Web. No requiere respuesta comercial.
```

## Transação operacional

Antes da rede, o wrapper confere a produção V162, o PID do bot principal, a
Z-API oficial, o worker V164 e a sessão externa já pareada. O ledger root-only
`/var/lib/vitalismen-whatsapp-web-canary-v165/canary.json` é consultado antes de
parar o worker e reserva `INTENDED` atomicamente. Qualquer estado existente
bloqueia socket, rede e repetição.

O wrapper para exclusivamente `vitalismen-whatsapp-web-shadow-v164`, confirma a
continuidade do bot/Z-API e abre um único socket one-shot na sessão
`V152_TEST_WEB_01`. QR, pairing code, nova sessão, destinatário dinâmico e texto
dinâmico são proibidos. Depois da única chamada, o socket fecha e o worker V164
é restaurado em `shadow=true`, `draining=true`, peso/capacidade zero.

## Ledger e falha fechada

O ledger persiste apenas hashes, nunca o ID bruto do provider. `SENT` só ocorre
após ID válido e `ACKED` somente após ACK observado. Timeout ou erro após a
reserva gera `AMBIGUOUS`; todos os estados bloqueiam retry. O ledger não pode ser
apagado para repetir o canário.

## Preservado

Z-API continua conectada e provider oficial. `current`, PM2 principal, funil,
fila, painel, scheduler, clientes, pedidos, Shipment, Dropi, Meta/CAPI, pós-venda,
Comprar depois e demais automações não participam da V165. O achado V47 continua
preexistente e fora do escopo.

# V167 — roteamento controlado de provider

## Escopo

A V167 sucede o estado operacional observado pela V166 e adiciona somente uma
microcamada não conectada ao runtime principal para tornar auditável a futura
seleção entre Z-API e WhatsApp Web. A Z-API permanece o provider oficial e todo
cliente geral continua selecionando `zapi`.

O telefone de QA `5515998038637` somente seleciona `whatsapp_web` quando a regra
V167 está explicitamente habilitada para uma ação controlada e o worker
persistentemente existente está `RESTORED/CONNECTED/PASS`, shadow, draining,
peso/capacidade zero e com exatamente um socket. Sem essas provas, a seleção
falha fechada ou retorna à regra Z-API desabilitada, sem envio.

## Exclusividade

A decisão é reservada atomicamente antes do claim. O registro persiste somente
hash do evento, hash do telefone, provider selecionado, instante da decisão e
estado do envio. `INTENDED`, `SENT`, `ACKED` e `AMBIGUOUS` impedem nova decisão,
novo claim e segundo provider para o mesmo evento.

Se Web for selecionado, somente a porta serializada do socket persistente pode
ser injetada. A microcamada não cria socket, QR, pairing ou sessão. Timeout,
erro ou resultado incerto Web termina em `AMBIGUOUS`, sem fallback Z-API.

## Estado operacional desta candidata

A implementação não é importada por `src/index.js`, `sendText()`, fila, painel,
scheduler ou worker. Nenhuma flag de produção é alterada; nenhum tráfego real é
roteado. O rollback consiste em manter `webRoutingEnabled=false`, preservando a
sessão Web e selecionando Z-API para todo tráfego novo.

`current`, PM2 principal, worker V164, ledger V165, Z-API, Comprar depois,
V114, V116, V141, aquecimento, Dropi, Meta/CAPI e pós-venda permanecem
inalterados. O achado V47 continua preexistente e fora do escopo.

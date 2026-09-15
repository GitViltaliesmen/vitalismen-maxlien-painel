# V167B — canário Web autorizado pelo caminho real

## Escopo

A V167B sucede a recuperação operacional V167A e liga, exclusivamente para o
canário técnico `V167B_AUTHORIZED_WEB_CANARY_5515998038637`, a decisão V167 à
fila persistente, ao claim direcionado, ao único socket Web já restaurado e à
persistência que o painel oficial consulta.

O único destinatário aceito é `5515998038637`, por comparação integral do
número normalizado. O texto também é fixo e não comercial. Telefone, finalidade,
hash do evento ou conteúdo divergente são rejeitados antes da chamada Baileys.

## Caminho operacional

O executor reserva primeiro o dedupe no `OutboundDedupe` e cria uma única
mensagem `PENDING` no `Message`. O coordenador V167 persiste a decisão de
provider em um ledger externo com criação exclusiva, reclama somente o ID exato
da mensagem e invoca a porta local do worker persistente.

O worker V167B substitui apenas o processo Web shadow V164, preserva a sessão
`V152_TEST_WEB_01` e mantém um único socket. Sua porta Unix fica em
`/run/vitalismen-whatsapp-web-v167b.sock`, propriedade de root e modo `0600`.
Ela não oferece envio genérico: aceita somente o contrato V167B fixo e bloqueia
segunda execução do evento no mesmo processo.

Após aceite do socket, o mesmo registro `Message` recebe o provider message ID,
o ACK observado, o estado de entrega e `queueStatus=COMPLETED`. O dedupe passa a
`sent` com `retryAllowed=false`. Timeout, erro ou resultado sem message ID fica
terminal e ambíguo, sem chamada ou fallback para Z-API.

## Preservado

- `current` e o PM2 principal não são alterados.
- Z-API continua online, conectada e provider geral.
- clientes gerais continuam inelegíveis para Web.
- nenhum segundo socket, QR ou pairing é criado.
- inbound Web permanece shadow; não há roteamento comercial.
- V165 não é reexecutada.
- Cloudflare, Dropi, Meta/CAPI, pedidos, funil, pós-venda e schedulers não são
  alterados.

## Ativação e rollback

`ops/web-canary-v167b` troca somente o worker Web depois de validar a identidade
da candidata, captura o release V164 anterior e mantém rollback específico. Em
erro de ativação, restaura automaticamente o processo Web anterior. O rollback
manual também afeta somente esse worker e preserva sessão, bot principal,
`current` e Z-API.

## Gates

O envio real exige worker `RESTORED/CONNECTED/PASS`, um socket, Z-API confirmada
online, provas negativas do router, ledger/queue/dedupe ausentes para o evento e
a confirmação literal de uma única mensagem. Não existe retry automático.

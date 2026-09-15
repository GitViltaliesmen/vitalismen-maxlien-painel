# V163 — reconciliação do multinúmero Web em shadow sobre a V162

## Objetivo

Esta camada reconcilia na árvore atual V162 o trabalho isolado V152-E-R4 do
WhatsApp Web multinúmero. Ela não ativa o worker, não publica release, não
reinicia processos e não remove nem desliga a Z-API.

## Estado comprovado antes da reconciliação

- Produção: V162 `ecf9ab51c7f65dba00f27a8b9d4d9ffb901639f3`.
- Transporte de produção: Z-API, conectado e não bloqueado.
- Worker Web R4: ausente do PM2 e parado.
- Sessão externa `V152_TEST_WEB_01`: presente, endurecida e estruturalmente
  restaurável; novo QR não é necessário.
- Último health sanitizado: sessão restaurada, encerramento explícito e nenhum
  QR residual.

## Isolamento obrigatório

O worker reconciliado continua `shadow=true`, `draining=true`, `weight=0` e
`capacity=0`. Ele não consome fila outbound, não encaminha inbound ao bot, não
faz roteamento de clientes, handoff, failover ou cutover.

A identidade já pareada `5531983002800` é preservada somente como sessão
existente. A regra atual autoriza testes controlados de entrada/saída apenas com
`5515998038637`; portanto nenhum outbound da sessão existente é autorizado por
esta reconciliação.

## Sequência restante para excluir a Z-API

1. Validar localmente a árvore V163 e os congelamentos V162/R4.
2. Publicar e iniciar o worker Web exclusivamente em shadow, mediante uma missão
   operacional separada.
3. Comprovar restauração, estabilidade e canário autorizado sem tráfego de
   clientes.
4. Autorizar separadamente roteamento gradual e rollback.
5. Somente depois de sucesso do canário, executar uma missão exclusiva de
   cutover e retirada da Z-API.

Excluir a Z-API antes dessas provas deixaria o bot sem transporte operacional.
Esta V163 prepara o caminho verificável, mas não produz esse risco.

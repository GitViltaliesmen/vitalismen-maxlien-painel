# Congelamento - Bloqueio Dropi e Vitalcom

Data: 2026-05-27

## Objetivo

Impedir que o bot envie mensagens para contatos da Dropi/Droppi ou Vitalcom, tanto Equador quanto Colombia, mesmo que esses contatos aparecam em listas de teste ou recebam webhook.

## Protecoes aplicadas

- `WHATSAPP_BLOCKED_RECIPIENTS` no VPS recebeu os numeros conhecidos:
  - `5515996218208`
  - `5515998038637`
  - `593963432938` - Vitalcom Ecuador
  - `573132296035` - Vitalcom Colombia
  - `593998654786` - suporte Dropi
- `WHATSAPP_BLOCKED_CONTACT_NAME_PATTERN=dropi|droppi|vital\s*com|vitalcom`
- A trava de `WHATSAPP_BLOCKED_RECIPIENTS` agora tem prioridade sobre listas permitidas/teste.
- O envio Z-API agora consulta nome do contato salvo (`notifyName`, `name`, `metadata.senderName`, `metadata.contactName`) e bloqueia se contiver Dropi/Droppi/Vitalcom/Vital Com.

## Backup

Backup antes/depois no VPS:

`/opt/vitalismen-automacao/backups/bloqueio-dropi-vitalcom-20260528-025533`

## Validacao

Teste interno sem disparo real confirmou bloqueio em duas camadas:

- `593963432938@zapi`: `blocked_contact_name` e `blocked_recipient`
- `573132296035@zapi`: `blocked_contact_name` e `blocked_recipient`
- `593998654786@zapi`: `blocked_contact_name` e `blocked_recipient`

## Observacao

Nao foi usado bloqueio por tags como `FEITO_DROPI` ou `dropi:pedido_ativo`, porque essas tags aparecem em clientes reais com pedido enviado e poderiam bloquear vendas ou pos-venda por engano.

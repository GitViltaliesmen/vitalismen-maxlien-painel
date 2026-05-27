# Congelamento - Camada Comprar Depois / Z-API

Data: 2026-05-27

## Estado aprovado

Camada aprovada antes de iniciar o bot de observacao.

O bot piloto do funil Vit Power EC ficou ativo com:

- Deteccao de comprar depois, sem dinheiro agora, data futura e cancelamento.
- Frase "Guarde mi numero como Ana Lopez - Vit Power" na resposta de comprar depois.
- Registro em Leads Clientes como `comprar_depois` quando o cliente adia.
- Registro como `cancelado` quando o cliente pede para nao enviar/cancelar.
- Regra de comprar depois priorizada antes da trava pos-fechamento.
- Sessao Z-API operacional autorizada para envio.

## Commits congelados

- `987b69c feat: adiciona camada comprar depois no funil`
- `1befb05 fix: prioriza comprar depois antes da trava pos-fechamento`

## Configuracao operacional congelada no VPS

- `WHATSAPP_AUTO_REPLY_ENABLED=true`
- `WHATSAPP_AUTOMATION_PILOT_ONLY=true`
- `ZAPI_ROUTE_INBOUND_TO_BOT=true`
- `ZAPI_CONNECTED_PHONE=5515998038637`
- `ZAPI_OPERATION_PHONE=5515998038637`
- `WHATSAPP_ALLOWED_OUTBOUND_SESSION_IDS=5515991418416,5515998038637`
- `WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS=5515998038637,573183002800,3183002800,553183002800`
- `ZAPI_OUTBOUND_ALLOWED_RECIPIENTS=5515998038637,573183002800,3183002800,553183002800`

## Backups relacionados

- `/opt/vitalismen-automacao/backups/camada-comprar-depois-20260527-174718`
- `/opt/vitalismen-automacao/backups/comprar-depois-antes-trava-pos-fechamento-20260527-181951`
- `/opt/vitalismen-automacao/backups/liberar-sessao-zapi-saida-20260527-182530`

## Validacoes feitas

- `npm run senior:check` passou no VPS.
- `pm2 restart vitalismen-automation --update-env` executado.
- `pm2 save` executado.
- Teste tecnico de envio Z-API retornou `ZAPI_SEND_OK`.
- GitHub atualizado na branch `codex/leads-clientes-acoes-unificadas`.

## Limite do congelamento

Nao alterar esta camada ao criar o bot de observacao. O proximo passo deve ser feito por cima, como camada separada:

- leitura/auditoria de conversas;
- relatorio de falhas do funil;
- sugestoes de copy;
- sem mudar envio Dropi;
- sem mudar status aprovado;
- sem liberar trafego fora do piloto.

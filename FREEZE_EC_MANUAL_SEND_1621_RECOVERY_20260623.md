# Freeze EC Recuperacao Mensagem Manual 1621 - 2026-06-23

## Problema

Cliente final `1621` (`593983631621`) tinha duas mensagens manuais iguais com `deliveryStatus=failed`:

- `manual_1782189364706_0594a9f0`
- `manual_1782189335949_253509ef`

Erro exibido: `WhatsApp nao confirmou o envio. Verifique a conexao do celular.`

## Causa

O envio manual do painel para cliente EC podia tentar usar sessao numerica/Baileys antes de sair pela Z-API. Para o WhatsApp publico `553183002800`, a saida correta e Z-API.

## Correcao Aplicada

- Reenvio unico para `593983631621` via Z-API:
  - mensagem: `Por favor, puedo enviar su pedido para una agencia de Servientrega?`
  - providerMessageId: `3EB04E366DF6007659B92F`
  - status final observado: `delivered`
  - registro criado: `manual_resend_1782189610296_555fb38e`
- As duas mensagens antigas foram marcadas como `recovered`, sem duplicar no painel.
- `src/routes/whatsapp.js` ajustado para forcar Z-API em envio manual do painel quando o telefone do cliente comeca com `593`.

## Varredura Geral

Janela analisada: ultimas 48 horas.

Resultado final:

- `failedCount=0`
- `stuckCount=0`

Casos antigos tratados:

- `593985761430`, `593989777184`, `593995625482`: resolvidos por atividade posterior do cliente/atendente, sem reenviar mensagem antiga.
- `593998031560`: Z-API retornou `Phone number does not exist`; marcado como `final_failed` e `metadata.invalidPhoneByZapi=true`.
- `593997295979`: audio manual antigo nao confirmado, mas arquivo fisico nao existe mais no VPS; marcado como `needs_human_review`, sem enviar arquivo errado.

## Backup VPS

- `/opt/vitalismen-automacao/current/backups/manual-send-593-zapi-20260623044119`

## Validacao

- `node --check src/routes/whatsapp.js`: OK local e VPS.
- Regra estatica no VPS: `[OK] VPS manual panel EC 593 force Z-API`.
- `pm2 restart vitalismen-automation --update-env`: OK.
- `http://127.0.0.1:3001/api/health`: `status=online`, `engine=Z-API`, `ready=true`.
- `https://ec.maxlien.shop/api/zapi/status`: conectado em `553183002800`, `Ana Lopez 2800`.

## Regra Congelada

Envio manual do painel para cliente EC `593*` deve sair pela Z-API. Mensagem manual falhada nao deve ficar indefinidamente como pendente: se foi reenviada, marcar como `recovered`; se o telefone nao existe, marcar `final_failed`; se a midia antiga nao existe, marcar `needs_human_review`.

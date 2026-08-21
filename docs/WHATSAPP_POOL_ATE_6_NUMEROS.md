# Transporte WhatsApp oficial — número único

Estado operacional atualizado e autorizado em 2026-08-21.

## Número oficial

Existe um único número oficial de recebimento e saída da operação:

```text
5515991418416
```

Formato visual: `+55 15 99141-8416`.

A Z-API é o transporte oficial enquanto o WhatsApp Web/Baileys não estiver
pareado, pronto e validado. A existência de estrutura de pool no código não
autoriza cadastrar, revezar ou publicar outro número.

Configuração esperada:

```env
WHATSAPP_DEFAULT_SESSION_ID=5515991418416
WHATSAPP_SESSION_IDS=5515991418416
WHATSAPP_DEFAULT_SESSION_ID_EC=5515991418416
WHATSAPP_SESSION_IDS_EC=5515991418416
WHATSAPP_ALLOWED_OUTBOUND_SESSION_IDS=5515991418416
WHATSAPP_SELLER_ROTATION_SEQUENCE_EC=5515991418416
WHATSAPP_SELLER_POOL_EC=5515991418416
WHATSAPP_SELLER_POOL=5515991418416
WHATSAPP_SELLER_E164=5515991418416
ZAPI_OPERATION_PHONE=5515991418416
ZAPI_CONNECTED_PHONE=5515991418416
ZAPI_OPERATIONAL_PHONE=5515991418416
WHATSAPP_ROTATION_ENABLED=false
```

## Telefone de teste autorizado

O único telefone brasileiro liberado para teste controlado é:

```text
5515998038637
```

Formato local: `15 99803-8637`.

Configuração esperada:

```env
WHATSAPP_TEST_ALLOWED_RECIPIENTS=5515998038637
WHATSAPP_AUTOMATION_ALLOWED_RECIPIENTS=5515998038637
WHATSAPP_INBOUND_TEST_ONLY_RECIPIENTS=5515998038637
WHATSAPP_PRIORITY_TEST_PHONES=5515998038637
WHATSAPP_PANEL_OPERATIONAL_NUMBERS=5515991418416
```

`WHATSAPP_AUTO_REPLY_ALLOWED_RECIPIENTS` permanece vazio no modo operacional
completo porque preenchê-lo apenas com o telefone de teste bloquearia respostas
a clientes EC reais. A exceção brasileira de entrada e saída usa as listas
específicas acima.

## Travas do teste

- nunca criar pedido, Dropi ou evento Meta/CAPI para o telefone de teste;
- nunca incluí-lo em disparo em massa;
- mídia inbound deve entrar pela Z-API e chegar a `READY` no storage compartilhado;
- saída deve ser individual e explícita;
- qualquer futura troca de número exige nova autorização, backup, canário de
  texto/áudio/imagem e validação de health.

Painel oficial: `https://ec.maxlien.shop/qr.html`.

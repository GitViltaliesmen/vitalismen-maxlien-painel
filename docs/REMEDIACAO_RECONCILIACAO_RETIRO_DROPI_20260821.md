# Remediacao da reconciliacao de retirada Dropi — 2026-08-21

## Escopo autorizado

Correcao pontual do pos-venda Ecuador para:

- colocar na fila urgente o aviso quando o status oficial do Dropi disser explicitamente `PARA RETIRO EN AGENCIA`;
- manter a sequencia persistida de lembretes de retirada;
- reconhecer a confirmacao textual do cliente de que o produto ja foi retirado;
- impedir reenvio quando um aviso equivalente ja tiver sido entregue manualmente.

Nao foram alterados produto, preco, checkout, criacao de pedido, formulario Dropi, Meta/CAPI, pixel, numero oficial, funil comercial, audios ou arquivos congelados do motor logistico V29.

## Evidencias auditadas

### Guia 189375473

- Pedido: `EC-MSUJNMXH-ISHD`.
- Dropi: `PARA RETIRO EN AGENCIA SERVIENTREGA`.
- Servientrega publica ainda retornava `Pendiente / Ingresando en Agencia PUYO_CENTRO`.
- O aviso automatico correto era bloqueado pelo historico porque a mensagem anterior de guia, que dizia para esperar antes de retirar, recebia a mesma chave anti-repeticao do aviso de retirada.
- Em 2026-08-21 ja existia uma mensagem manual entregue com a guia e o status de retirada. Essa mensagem deve ser recuperada como marco persistido; nao deve ser reenviada.

### Guia 189266685

- Pedido: `EC-MSTRIE8P-4TV8`.
- O aviso inicial e o primeiro lembrete de retirada foram enviados.
- O cliente respondeu `Ya fue retirado el producto de la Agencia Servientrega. Gracias`.
- A forma passiva `ya fue retirado` nao era reconhecida pelo detector anterior; por isso o pedido permaneceu exibido como em transito.

## Microcamada aplicada

- `src/services/postSalePickupReconciliationPolicy.js`: separa mensagens de guia/espera de avisos reais de retirada, aceita somente liberacao explicita do Dropi e amplia a confirmacao textual de retirada.
- `src/services/postSalePickupReconciliationService.js`: reconcilia o status explicito, usa lock persistido, procura historico antes de enviar, recupera aviso ja entregue e processa confirmacoes antigas que ficaram pendentes.
- `src/services/droppiEcuadorService.js`: registra a liberacao explicita do Dropi como evidencia verificada.
- `src/services/schedulerService.js`: executa a fila urgente depois da sincronizacao Dropi e reconcilia novamente depois da consulta publica da transportadora; a sequencia normal de lembretes continua no scheduler oficial.
- `src/routes/zapi.js`: processa a confirmacao de retirada na entrada oficial Z-API, antes do roteamento comercial.
- `src/whatsapp/sendText.js`: conserva a deduplicacao global, mas usa chaves distintas para `aguarde` e `ja pode retirar`.

## Garantias anti-spam

- `automation.readyForPickupNotifiedAt` continua sendo o campo persistido de ja enviado.
- `automation.dispatchLockedUntil` continua sendo o lock persistido da fila.
- O historico do telefone e da guia e consultado antes de qualquer disparo.
- Aviso manual ja entregue e registrado como evidencia, sem nova mensagem.
- Pedidos `manualOnly`, entregues, retirados, devolvidos ou pre-pagos ficam fora da fila automatica.
- O Dropi somente libera a linguagem de retirada com frase explicita; `Ingresando en Agencia` e `En agencia` continuam tratados como transito.

## Validacao e operacao

Antes da publicacao:

1. executar testes de politica, aviso, lembretes e guardas congelados;
2. revisar o diff integral;
3. criar backup dos documentos dos pedidos afetados;
4. executar a reconciliacao primeiro em `dryRun`;
5. confirmar que a guia 189375473 e recuperada do historico, com zero reenvio;
6. confirmar que a guia 189266685 e encerrada como retirada pela mensagem do cliente;
7. conferir `pm2 jlist`, `readlink -f /opt/vitalismen-automacao/current` e o health oficial.

## Rollback

Reativar a release anterior no mecanismo oficial de releases. Os marcos persistidos de aviso entregue e retirada confirmada representam fatos ja comprovados e nao devem ser apagados no rollback do codigo.

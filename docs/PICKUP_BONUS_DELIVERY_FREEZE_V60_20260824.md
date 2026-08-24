# Freeze V60 — entrega garantida do bônus após retirada

Data: 2026-08-24
País: Equador
Pai: `baileys-libsignal-security-v59-20260824`

## Incidente comprovado

O pedido foi atualizado automaticamente para `ENTREGADO`, a confirmação com
foto/texto marcou `pickedUp=true` e o áudio `OBRIGADO_PAGOU` foi entregue. O
texto com o bônus prometido não saiu porque todos os textos logísticos herdavam
a mesma chave semântica genérica `shipment_status`. Uma mensagem logística já
enviada na mesma janela de 24 horas reservava essa chave e a etapa legítima do
bônus era bloqueada como `semantic_duplicate_text`.

O Shipment permaneceu corretamente com `automation.bonusNotifiedAt=null`, de
modo que o sistema não declarou uma promessa cumprida sem comprovante.

## Microcorreção autorizada

- O texto do bônus usa a chave semântica estável
  `shipment_status:pickup_bonus:<pedido-ou-guia>`.
- A chave é exclusiva da etapa e do pedido, portanto não colide com guia,
  trânsito, retirada ou agradecimento.
- Uma nova tentativa do mesmo bônus conserva a mesma chave e o mesmo
  `dedupeValue`; texto já enviado continua bloqueado.
- O áudio `OBRIGADO_PAGOU` e o áudio de modo de uso conservam suas chaves
  existentes. Áudio já entregue não pode ser repetido.
- `bonusNotifiedAt` só é preenchido depois do texto do bônus ser aceito pelo
  transporte ou recuperado do histórico.

## Gatilhos preservados

O bônus continua sendo chamado somente pelos caminhos oficiais já existentes:

1. confirmação textual de retirada;
2. foto/comprovante elegível depois da solicitação oficial;
3. Shipment atualizado para `ENTREGADO` pelo sincronizador/dispatcher;
4. confirmação administrativa autenticada de retirada.

Selecionar visualmente `Entregue` sem evidência operacional não cria um novo
gatilho paralelo. O scheduler oficial permanece único.

## Travas

- histórico de mensagens, hash do Shipment, lock persistente e
  `OutboundDedupe` permanecem obrigatórios;
- proibido usar `bypassDedupe`, `force` ou apagar comprovantes para liberar o
  bônus;
- proibido repetir o agradecimento ou o modo de uso já entregues;
- somente o bônus pendente do incidente comprovado pode ser concluído após a
  ativação; não há replay histórico em massa;
- não há alteração de produto, preço, pedido, Dropi, Meta/CAPI, pixel, funil,
  mídia, número, transporte ou cadência logística.

## Validação e rollback

- `npm run guard:pickup-bonus-v60`
- `npm run senior:check`
- `npm test`
- `npm run guard:ec-product-micro-layer`
- `npm run guard:pickup-notifications`
- `npm run guard:guide-print-spam`
- `npm run guard:freeze-lock`

Rollback: reativar integralmente a release V59
`/opt/vitalismen-automacao/releases/20260824T131742Z_production-20260824-c7061a1`.
Os comprovantes persistidos de mensagens, pedidos, Shipments e deduplicação não
devem ser removidos.

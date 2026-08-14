# Freeze EC — evidência de aviso de retirada e bônus

Data: 2026-07-27

## Escopo autorizado

Correção pontual do pós-venda oficial no bot principal Vitalismen. Não foi
criado outro bot e o scheduler não foi movido para a extensão.

## Problema confirmado

A trava global de histórico aceitava textos genéricos contendo guia,
Servientrega, agência ou retirada como evidência de qualquer etapa. Assim, uma
mensagem de guia ou trânsito podia preencher `readyForPickupNotifiedAt` e os
campos dos dias 1–6 sem que o aviso ou o áudio correspondente tivesse sido
enviado.

## Regra congelada

Cada etapa só pode ser recuperada por evidência exata da própria etapa:

- chegada: texto oficial de chegada ou áudio `Chegou_01`;
- dia 1: texto específico do dia 1;
- dia 2: texto específico pedindo foto/confirmação;
- dia 3: áudio `Chegou_02`;
- dia 4: texto específico do dia 4;
- dia 5: áudio `Chegou_03`;
- dia 6: texto específico de último aviso.

Mensagem de guia, mensagem em trânsito ou marcação recuperada de outro
shipment não prova nenhuma dessas etapas.

## Antiduplicidade e recuperação

- A evidência recuperada de outro registro nunca pode ser propagada novamente.
- Áudio só marca a etapa depois de envio confirmado e registro em
  `automation.sentAudioLog`.
- Comprovantes de retirada usam lock persistido antes de confirmar entrega e
  liberar bônus.
- Foto, vídeo ou documento sem texto explícito só vale como comprovante quando
  foi recebido depois de `pickupProofRequestedAt`; mídia genérica nunca confirma
  retirada.
- A varredura de comprovantes roda no scheduler oficial somente com
  `PICKUP_PROOF_SWEEP_ENABLED=true`.
- Recuperação retroativa é individual, exige `--order=ORDER_ID` e funciona em
  dry-run até receber `--send`.
- Campos antigos sem evidência só podem ser limpos depois que o novo aviso de
  chegada for confirmado.

## Regra universal por produto

O pós-venda logístico é obrigatório e idêntico para todos os pedidos EC de
Nitrix Oxide, Tex Ultra e Vit Power. O produto nunca pode bloquear:

- aviso de chegada com texto, PDF e áudio `Chegou_01`;
- lembretes 1–6, incluindo `Chegou_02` no dia 3 e `Chegou_03` no dia 5;
- confirmação de retirada e entrega dos bônus.

Somente o áudio de orientação de uso é específico por produto:

- Vit Power: `COMO_SE_TOMA_VIT_POWER`;
- Nitrix Oxide: `NITRIX_USO_OXIDE_EC`;
- Tex Ultra: sem áudio de uso até existir uma mídia Tex Ultra aprovada.

A ausência de áudio de uso do Tex Ultra não pode impedir o agradecimento, o
bônus nem qualquer aviso logístico.

## Comandos obrigatórios

```sh
npm run test:pickup-notifications
npm run guard:pickup-notifications
npm run audit:pickup-evidence
npm run audit:pickup-proofs
```

Antes de recuperar um cliente:

```sh
npm run recover:pickup-arrival -- --order=ORDER_ID
```

O envio real exige o mesmo pedido explícito com `--send`. Shipment
`manualOnly` continua bloqueado até revisão individual.

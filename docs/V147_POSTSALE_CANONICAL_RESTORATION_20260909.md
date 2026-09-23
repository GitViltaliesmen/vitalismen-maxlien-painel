# V147 — restauração canônica do pós-venda EC

## Baseline e escopo

A V147 parte exclusivamente do commit `4d848d749255bfd0a7bdc47ac52390b74311966b`, árvore `ec73378896f2ceb64dfa8b2d9cb2d5dd85df7cf9`, release `20260908T234113Z_production-20260908-4d848d7`. Esta candidata não altera produção, não reinicia PM2 e não envia mensagens reais.

## Causas comprovadas

O pedido `EC-ADMIN-3484`, Dropi `6924784`, telefone `+593980548369` e guia `189629714` possuem uma identidade única entre `ContactState`, painel, `Order` e os dados live externos. Não existe `Shipment` para esse pedido. O reconciliador V140 carregava somente pedidos cujos IDs já apareciam em `Shipment`, impedindo a restauração vinculada ao pedido real.

O timer V116 falhava antes do lote com `EROFS: read-only file system, mkdir '/root/.pm2'`: o helper executava `pm2 jlist` dentro de uma unit com `ProtectHome=true`. A candidata valida o processo por `/proc`, preservando o isolamento da unit.

O limitador V116 usava apenas dia e fuso na chave persistente e os limites por sessão também eram globais. Uma mensagem aceita para um cliente bloqueava outro cliente. A chave agora contém cliente, pedido, shipment, evento e template; o lote e a cadência existentes continuam limitando a vazão.

## Estado logístico

Servientrega live é a fonte de verdade. Dropi conserva pedido, guia e metadados como evidência auxiliar. `Pendiente` com substatus `Ingresando en Agencia` corresponde a `ENTERING_AGENCY`, `CAN_PICKUP=false`. Somente o estado comprovado `READY_FOR_PICKUP`, persistido com fonte `carrier_tracking`, permite linguagem, mídia e lembretes de retirada.

O painel recebe o mesmo estado canônico e o booleano `canPickup`. A classificação não usa texto do frontend ou mensagem humana como prova logística.

## Mensagens e conteúdo

O scheduler, ledger, locks e outbox atuais foram preservados. A agenda de retirada existente passa a emitir somente A10 em 72 horas e A19 em 120 horas a partir do aceite de A07. Estados entregues, devolvidos, em devolução ou em revisão não ficam elegíveis.

Os arquivos A07, A10, A19 e os modos de uso de Tex Ultra, Vit Power e Nitrix existem e permanecem separados. Não há template neutro comprovado para P5. `OBRIGADO_PAGOU` só pode ser usado quando houver prova explícita de pagamento; entrega isolada não satisfaz essa condição. A publicação permanece bloqueada até aprovação do conteúdo neutro de P5 ou decisão operacional explícita sobre o template.

## Rollback

O rollback permanece na release `/opt/vitalismen-automacao/releases/20260908T234113Z_production-20260908-4d848d7`, commit `4d848d749255bfd0a7bdc47ac52390b74311966b`. Como a candidata não foi ativada, nenhum rollback de produção é necessário nesta etapa.

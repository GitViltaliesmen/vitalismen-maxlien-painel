# EC Panel Confirmed Persistence V158 — congelamento operacional

Data: 2026-09-14
Escopo: Equador, painel `Confirmados`, persistência Mongo/SQLite e leitura pós-gravação.

## Incidente comprovado

O aceite humano do lead EC `1329` (telefone mascarado `***0281`) foi persistido em `ContactState.metadata.customerDraft.status=confirmado`, mas não gerou um `Order` no Mongo e não promoveu a linha canônica SQLite de `finalizado` para `confirmado`. A rota `PATCH /api/whatsapp/contact-state/:phone` capturava a falha de criação do pedido, preservava a ficha e ainda respondia HTTP 200 com `success=true`. A tela então exibia sucesso mesmo sem o registro aparecer na consulta de `Confirmados`.

As tentativas subsequentes em `configure-order` falharam corretamente com HTTP 409 porque a linha SQLite continuava terminal. Portanto, o problema não era rejeição do Dropi: era sucesso HTTP falso antes da persistência canônica completa.

## Contrato V158

Uma confirmação humana só termina com sucesso quando, na mesma operação lógica:

1. existe um `Order` EC com `status=confirmed` e `confirmedAt`;
2. a linha SQLite preexistente foi localizada exatamente uma vez;
3. o status final SQLite foi relido como `confirmado`;
4. a linha é elegível para a consulta usada pela lista `Confirmados`;
5. o `ContactState` aponta para o pedido operacional confirmado;
6. uma leitura final do Mongo confirma o estado gravado.

Qualquer divergência retorna erro HTTP não-2xx com `success=false`, `persistenceVerified=false`, `readAfterWriteVerified=false` e `falseSuccessPrevented=true`. A interface não altera o estado local nem mostra sucesso sem essas provas e faz uma nova consulta antes de concluir.

## Escritores e precedência

- `Order` pós-save sincroniza o ciclo operacional para o SQLite.
- `PATCH /api/whatsapp/contact-state/:phone` persiste a ficha, cria/reutiliza o pedido e executa a confirmação verificada V158.
- `POST /api/shipments/droppi/ec/admin-leads/:leadId/stage-confirmed` executa a mesma confirmação verificada.
- a rota SQLite administrativa continua sendo a fonte da lista, mas não substitui a prova Mongo necessária ao fluxo integrado.
- transições reais de envio/entrega podem avançar `confirmado`; a V158 não rebaixa pedidos `processing`, `shipped`, `delivered`, `cancelled` ou `returned`.
- somente um aceite humano atual e explícito pode superar um status SQLite terminal herdado para criar o novo ciclo confirmado.

## Reparo controlado

`scripts/repair-ec-confirmed-order-v158.mjs` opera um único lead fornecido por ID e exige autorização textual exata, execução root e diretório de backup dentro de `/opt/vitalismen-automacao/backups/`. Antes de alterar dados, grava snapshot exclusivo com modo 0600 do lead SQLite, `ContactState` e pedidos relacionados. O script é idempotente: reutiliza o pedido canônico/confirmado existente e aborta se encontrar ciclo já avançado.

O reparo não importa nem chama transporte WhatsApp, Z-API, Dropi, Meta/CAPI ou scheduler. Contadores declarados no resultado: `whatsappCalls=0`, `dropiCalls=0`, `metaCalls=0`, `messagesSent=0`.

## Investigação do segundo caso

Na janela prioritária, somente dois aceites humanos confirmados ficaram evidenciados nos estados persistidos: lead `1329` e lead `3540`. O `3540` foi persistido corretamente, virou pedido operacional, foi enviado ao Dropi e avançou legitimamente para `pedido_enviado`; portanto, não é um pedido perdido. Não houve evidência suficiente para identificar outro pedido aprovado desaparecido, e nenhum registro foi criado por inferência.

## Preservado

- proteções V157 de pré-flight e falha fechada do Dropi;
- política de autorização humana para envio ao Dropi;
- deduplicação e ausência de retry automático após criação ambígua;
- funis, produtos, preços e catálogo de agências;
- Z-API, callback V155 e transporte WhatsApp;
- Meta/CAPI e pós-venda;
- limites anti-spam e ausência de liberação de backlog histórico.

## Rollback

Ativar novamente o release V157 imutável e, se necessário, restaurar exclusivamente os documentos/linha afetados a partir do snapshot root-only criado pelo reparo. Não apagar nem reescrever histórico de pedidos em lote.

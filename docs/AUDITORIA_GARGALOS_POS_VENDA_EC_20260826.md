# Auditoria dos gargalos de pós-venda EC — 2026-08-26

Escopo: painel WhatsApp Vitalismen, cadastro/ficha, `Order`, `Shipment`,
Dropi, rastreio Servientrega e avisos de guia/retirada/devolução. A inspeção da
VPS oficial foi somente leitura. Não houve mensagem, submissão Dropi, alteração
de banco, PM2, `.env` ou deploy.

## Diagnóstico executivo

Os relatos não vêm de uma falha única. Foram confirmados quatro gargalos
independentes:

1. A busca do painel é local e incompleta. O navegador carrega `fast=1`, que
   recebe apenas os 180 `ContactState` mais recentes, mais até 350 registros já
   classificados. A pesquisa não consulta o servidor. Contatos antigos podem
   existir no banco e só aparecer depois de `Adicionar`, que materializa a
   ficha na lista atual.
2. A ficha `metadata.customerDraft` pode permanecer como `Novo` ou guardar um
   alias antigo enquanto `Order`, `Shipment` e o SQLite administrativo já têm
   o status e o nome logístico corretos. A lista mistura esses read models e
   pode mostrar uma fotografia antiga do cliente.
3. Um erro antigo de submissão Dropi deixa o Shipment em
   `review.manualOnly=true`, `reviewReason=dropi_rejected` e
   `reviewStatus=manual_send_required`. O dispatcher de pós-venda exclui todo
   `manualOnly`. A reconciliação posterior só limpa automaticamente motivos de
   transportadora/novedad; ela não limpa o motivo antigo `dropi_rejected`,
   mesmo quando Dropi e Servientrega depois confirmam guia e retirada.
4. O sincronizador de pedidos ativos da Dropi lê as linhas visíveis do painel e
   não persiste um relatório por ciclo. No caso final `6457`, o pedido local
   continuou `PENDIENTE` sem guia desde 22/08, embora o operador já tivesse uma
   guia Servientrega em 26/08. A linha não foi reconciliada com o Shipment e o
   histórico atual não permite distinguir se ela não foi lida, não foi
   parseada ou não foi associada.

## Resultado por caso

| Final | Evidência encontrada | Conclusão |
|---|---|---|
| `4818` | Pedido Dropi `6585024`, guia `189405133`; guia e trânsito já comunicados. Às 14:52 UTC de 26/08, a fonte oficial ainda dizia `Ingresando en Agencia`, normalizado como `EN_RUTA`, sem liberação explícita para retirada. | O bot não devia afirmar retirada automaticamente. O envio manual de retirada ocorreu antes da confirmação autoritativa. Não é o mesmo gargalo de `manualOnly`. |
| `7378` | Pedido/Shipment usa `Danilo Tinoco`; guia `189381403`, depois `DEVUELTO`. Não há os avisos automáticos iniciais; houve comunicação humana e aviso de devolução. | Nome operacional está preservado, mas a ficha/conversa tem identidade divergente. O pós-venda ficou fora da automação antes da devolução. |
| `9599` | Guia `189381404`, `READY_FOR_PICKUP` verificado, porém `manualOnly=true`, motivo `dropi_rejected/manual_send_required`; `readyForPickupNotifiedAt` vazio. | Caso exato do bloqueio residual que impede o aviso automático após a logística se recuperar. |
| `8887` | O final atual corresponde a Luis Zapata; pedido já `DEVUELTO`. Não há sequência automática de guia/retirada, mas há ações humanas e aviso final de devolução. Existe ainda outro registro histórico com o mesmo final. | Final de telefone isolado é ambíguo; o registro atual perdeu a cadência automática antes da devolução. |
| `8370` | Guia `189381406`; registros persistidos de guia, retirada, trânsito, lembretes dos dias 1, 2 e 3 e devolução. As mensagens estão entregues/lidas no histórico. | O backend comunicou. O relato é explicado por visibilidade/projeção do painel, não por ausência de envio. |
| `6457` | Dropi `6652142`; localmente ainda `PENDIENTE` e sem tracking desde 22/08. Em 26/08 houve mensagem humana de retirada com guia `189411028`. | Falha de reconciliação Dropi → Shipment. Sem guia persistida, o scheduler não possuía base para acompanhar nem avisar. |
| `1956` | Há dois clientes. O atual Joel informou “ya retiré”; o bot registrou prova textual, marcou entregue/retirado e enviou bônus e áudio. O outro, José, já estava entregue. | Não há falha pendente nesses dois registros. O telefone completo é obrigatório para investigação sem ambiguidade. |
| `979820815` | Order/Shipment existem e o pedido terminou `DEVUELTO`, porém sem avisos automáticos de guia/retirada; somente devolução. O estado antigo fica fora do lote rápido do painel. | Confirma simultaneamente a busca incompleta e uma lacuna anterior de pós-venda. `Adicionar` apenas torna a ficha visível; não cria o pedido histórico. |
| `990287146` | Guia `189375575`, retirada verificada, mas `manualOnly=true` com `dropi_rejected/manual_send_required` e sem aviso automático. Houve dois textos humanos de retirada em 26/08. | Segundo caso exato do bloqueio residual; também exige cautela operacional para não repetir manualmente a mesma comunicação. |
| `984583448` | Pedido/Shipment `DEVUELTO`. Guia, retirada, PDF/print, seis lembretes e devolução estão persistidos. A ficha ainda aparece `Novo`. | O pós-venda funcionou; o defeito é a projeção desatualizada da ficha. |
| `969253940` | A ficha mostra `garciajul96` e `Novo`, mas Order, Shipment e payload final usam `JULIO GARCIA`. Guia, retirada, PDF/áudio, lembretes e devolução estão persistidos. | A Dropi histórica não recebeu o alias técnico. A ficha está obsoleta. Foi adicionada uma trava preventiva de nome completo no código local. |

## Contagem do bloqueio crítico

Na varredura EC foram encontrados exatamente dois Shipments ativos e
recuperáveis com retirada verificada, aviso ainda ausente e o motivo residual
`dropi_rejected/manual_send_required`: finais `9599` e `7146`. Outros
`manualOnly` possuem motivos protegidos e não podem ser liberados em massa.

## Correção local da fase V64

Na fase V64, a única mudança funcional aplicada foi a regra de nome completo descrita em
`docs/DROPI_CUSTOMER_FULL_NAME_FREEZE_V64_20260826.md`. Nenhum scheduler,
read model, busca, Shipment ou cliente real foi alterado.

A missão posterior autorizou expressamente a implementação local V65 descrita
abaixo, ainda sem deploy e sem mutação de cliente real.

## Microcamadas implementadas na candidata V65

1. Busca exata e limitada no servidor por telefone, nome, pedido, Dropi ID e
   guia, mesclando o contato sem usar `Adicionar`.
2. Projeção canônica da ficha por `Shipment -> Order -> customerDraft`, sem
   reescrever pedidos ou mensagens históricas.
3. Recuperação individual e atômica somente do motivo exato
   `dropi_rejected/manual_send_required`, com prova logística fechada, auditoria
   e supressão de replay.
4. Decisão anti-spam central com markers, outbound humano/automático,
   elegibilidade e lock persistente.
5. Reconciliação Dropi fail-closed, API primeiro, DOM como fallback, sem criar
   Shipment fantasma e com observabilidade persistida por ciclo.
6. Rotina histórica DRY RUN. Nenhum apply, mensagem, pedido ou deploy foi
   executado nesta missão.

O contrato técnico completo está congelado em
`docs/POST_SALE_GARGALOS_FREEZE_V65_20260826.md`. A implementação local não
autoriza deploy; a aprovação explícita continua obrigatória.

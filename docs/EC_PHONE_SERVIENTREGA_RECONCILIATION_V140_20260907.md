# V140 — reconciliação Servientrega por telefone

Baseline imutável: V139 `b0e5f51cfc71995c9c0c26c6fbbf1ac0b74c9e69`, árvore `f2afcb2daa9c3f288c2a0ab07160c3a9874b239d`.

A V140 reconcilia pedidos EC históricos que existem de forma inequívoca no Dropi e na Servientrega, mas perderam o vínculo logístico local. A camada reutiliza o importador histórico `droppiEcuadorImportService.js`; ela não cria `Order`, não chama o envio Dropi e não infere produto, quantidade, preço, endereço ou modalidade.

## Casos externos comprovados

| Lead | Telefone | Customer | Dropi | Guia Servientrega |
| --- | --- | --- | --- | --- |
| 3463 | `+593990195217` | `6a95e479a8a4fd96c269d79b` | `6886503` | `189613431` |
| 3464 | `+593983996761` | `6a95e537a8a4fd96c269d8ce` | `6886310` | `189613437` |
| 3494 | `+593994897441` | `6a9b194b7fa0b0b8ca618317` | `6886278` | `189613438` |
| 3496 | `+593992418689` | `6a9c0694f512f72e9aa802b2` | `6886247` | `189613439` |

Cada caso exige concordância exata entre telefone EC canônico, `customerId`, `leadId`, ID Dropi, guia retornada pelo Dropi e consulta direta da mesma guia na Servientrega. Dois pedidos Dropi externos para o mesmo telefone permanecem ambíguos. Conflito ou ambiguidade encerra o caso sem escrita.

## Vínculo restaurado

Quando não existe `Order` nem `Shipment`, o importador registra um espelho canônico de `Shipment` para o envio externo real. O próprio ID Dropi real é usado como `orderId` técnico do espelho. A proveniência `HISTORICAL_EXTERNAL_RECONCILIATION` grava as cinco identidades e as duas fontes externas. O `ContactState` existente recebe somente a ligação logística, e o painel usa o sincronizador canônico existente.

Os campos comerciais desconhecidos ficam vazios. A ficha preserva qualquer quantidade ou valor já registrado porque a sincronização ignora zero ou vazio. Não há autorização humana de envio forjada: `dropiSubmitAuthorizedAt` e `dropiSubmitAuthorizedBy` permanecem vazios.

## Mensagens, pós-venda e retirada

O bootstrap histórico registra zero mensagens e suprime apenas etapas anteriores ao estado já observado. Depois do vínculo, uma nova mudança real da Servientrega entra no fluxo V139 de pós-venda. A identidade histórica exata autoriza somente esse acompanhamento; ela nunca autoriza novo envio ao Dropi.

Trânsito e ingresso em agência não liberam retirada. `READY_FOR_PICKUP` continua exigindo status direto do transportador. O ledger transacional da V139 mantém cada aviso aplicável em no máximo um envio.

Cada ciclo automático começa em dry-run. As travas V138 e V139 permanecem: envio Dropi automático desligado, criação automática de pedido/envio comercial desligada e ação humana obrigatória para qualquer novo envio ao Dropi.

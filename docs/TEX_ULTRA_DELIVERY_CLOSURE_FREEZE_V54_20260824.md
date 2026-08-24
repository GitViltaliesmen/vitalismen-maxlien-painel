# Freeze V54 — fechamento logístico Tex Ultra EC

Data: 2026-08-24
País: Equador
Pai: `post-sale-health-recovery-v53-20260824`

## Incidentes confirmados

- O funil copiava a fala usada para pedir retirada em agência para
  `customer.address` e depois repetia essa fala na confirmação e no pedido.
- Mesmo com agência oficial já resolvida, o fluxo pedia ponto de referência,
  campo pertinente ao domicílio e não à retirada em Servientrega.
- Consultas genéricas empatadas, como `Plaza las Ceibas`, podiam ser aceitas
  como agência segura por causa de tokens comuns e ausência de desempate.
- A frase `La entrega a domicilio` era persistida como se fosse endereço
  operacional completo.
- Durante `awaiting_confirmation`, correções estruturadas do cliente podiam
  cair no texto genérico de quantidade.
- O teste isolado V49 validava `SI`, mas sua asserção de encadeamento ainda
  terminava na V51 e não fazia parte do `senior:check` atual.

## Correções autorizadas

- Evidência bruta do cliente permanece no campo de agência; o endereço do
  pedido passa a vir exclusivamente da agência canônica em
  `src/data/agencia_LISTA.json`.
- Retirada em agência usa nome, ID e endereço oficiais e segue diretamente
  para o resumo. Referência recebe `NOT_APPLICABLE` e não é perguntada.
- Empate de agência não gera `agencyId`; o cliente recebe até três opções e
  escolhe somente `A`, `B` ou `C`.
- Modalidade domiciliar sem endereço permanece em coleta; só texto com sinal
  operacional de endereço pode atravessar o gate.
- Correções rotuladas de nome, cidade, província, endereço, referência,
  agência ou quantidade são reaplicadas deterministicamente e o resumo é
  exibido novamente antes do `SI`.
- O teste V49 entra no `senior:check` e aceita a cadeia atual/sucessora.
- O pedido `EC-MT6MPQ4G-BAF7` pode ser reparado somente pelo script V54, com
  alvo exato, confirmação literal, backup absoluto e sincronização do painel.

## Proteções preservadas

- Preços Tex Ultra permanecem: 1 por USD 35.99, 2 por USD 70.00, 3 por
  USD 80.99 e 6 por USD 147.99.
- Nenhuma mudança em produto, VSL, checkout, Meta/CAPI, pixel, Z-API, número
  oficial, mídia, áudio, cadência, scheduler ou pós-venda.
- Dropi Tex Ultra continua bloqueado até auditoria específica.
- O reparo não envia WhatsApp, não recria pedido, não reenvia Purchase e não
  submete Dropi. Status, quantidade, total e tracking permanecem intactos.
- Nenhum cliente real é usado como canário de implantação.
- O pedido do final `3837` não é criado retroativamente.

## Validação obrigatória

- `npm run guard:tex-ultra-delivery-v54`
- `npm run guard:ec-product-micro-layer`
- `npm run senior:check`
- `npm test`
- dry-run do reparo exato no staging/produção antes de `--apply`
- após ativação: `pm2 jlist`, `readlink -f /opt/vitalismen-automacao/current`,
  health local/público, `/n/` e estado Z-API somente leitura.

O rollback reativa a release V53 e restaura o JSON de backup apenas para o
pedido/ContactState reparados, preservando bancos, mensagens e mídias.

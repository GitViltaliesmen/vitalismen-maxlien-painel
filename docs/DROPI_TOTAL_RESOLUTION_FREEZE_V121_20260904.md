# Freeze V121 — resolução operacional total do Dropi EC

Data: 2026-09-04
Escopo: camada existente de envio manual individual e sincronização logística Dropi Ecuador
Baseline pai: `production-vitalismen-ec-dropi-multiproduct-v120-20260904-r1`
Commit pai: `c7f44ed76c7d386dd9a1508c386cf8b7b2e8e404`

## Lacuna comprovada

A auditoria somente leitura encontrou estados reais do Dropi que a projeção local
não encerrava corretamente. Em especial, `CANCELADO` e `RECHAZADO` podiam manter
o pedido interno em `processing` ou `shipped`. Também faltava exibir na tela já
existente de Leads Clientes o ID Dropi, transportadora, rastreio e motivo real de
revisão que já estavam persistidos no vínculo logístico.

## Correção isolada

- normaliza os equivalentes reais observados de pendente, processamento, coleta,
  trânsito, entrega, devolução, cancelamento e rejeição;
- projeta entrega para `delivered`, devolução para `returned`, cancelamento ou
  rejeição para `cancelled`, trânsito para `shipped` e pendência para `processing`;
- preserva vínculo, histórico, timestamp, guia e transportadora no Shipment;
- hidrata e exibe esses dados na tela atual, sem criar tela ou integração nova;
- evita atualização repetida quando a grafia externa normaliza para o mesmo estado.

## Contratos preservados

- Tex Ultra: produto `110681`, depósito `1261`, origem `802`;
- Nitrix: produto `105825`, depósito `1544`, origem `802`;
- Vit Power: produto `103743`, depósito `1261`, origem `802`;
- autorização continua persistente e específica por pedido;
- consulta autoritativa e proteção de duplicidade ocorrem antes do único POST;
- timeout ou resposta ambígua não recebe retry automático;
- recompra legítima continua exigindo novo pedido e nova autorização;
- cidade, província, agência e transportadora continuam autoritativas, sem adivinhação.

## Limites operacionais

Não houve envio real nesta validação. Os pedidos Eutimio Mora e Teodulfo não foram
reenviados. Não houve backfill, disparo em massa, mutação retroativa, mensagem de
WhatsApp ou evento Meta. VSL, funil, preços, Z-API e arquitetura V114/V116 permanecem
inalterados. O primeiro teste real é exclusivamente o próximo pedido novo, legítimo
e autorizado pelo operador.

## Publicação e rollback

A publicação usa release imutável e o guard V121. O rollback imediato permanece a
release V120 `/opt/vitalismen-automacao/releases/20260904T012902Z_production-20260904-c7f44ed`.

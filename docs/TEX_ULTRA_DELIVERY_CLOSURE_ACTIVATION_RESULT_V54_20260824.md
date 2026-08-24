# Resultado da ativação V54 — fechamento Tex Ultra por agência e domicílio

Data: 2026-08-24  
País: Equador  
Status: ativa e validada em produção

## Fonte imutável

- PR funcional: `#66`.
- Commit de merge: `8801624f388f77482d48ec2c6d4ddf09158f67e2`.
- Tag anotada: `production-20260824-8801624`.
- Freeze: `tex-ultra-delivery-closure-v54-20260824`.

## Release oficial

- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T040419Z_production-20260824-8801624`.
- Release anterior preservada para rollback:
  `/opt/vitalismen-automacao/releases/20260824T025315Z_production-20260824-04b1e8e`.
- Processo reiniciado: somente `vitalismen-automation`.
- PID anterior: `2459364`.
- PID após ativação: `2484604`.
- PM2 `online`, `unstable_restarts=0`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- CWD real do processo: a release V54 acima.
- Rollback automático não foi necessário.

O primeiro empacotamento local criou uma candidata inativa sem o marcador root
oficial. A ativação foi recusada pelo helper. Depois de confirmar que ela não era
o destino de `current`, a candidata foi movida, sem exclusão, para:

`/opt/vitalismen-automacao/staging-quarantine/20260824T040419Z_production-20260824-8801624_codex-packager`

O helper root oficial refez o staging e aprovou todos os gates antes da
autorização de uso único e da ativação transacional.

## Reparo controlado do pedido auditado

- Pedido: `EC-MT6MPQ4G-BAF7`.
- Agência canônica: `Guayaquil Piazza Ceibos`.
- ID da agência: `EC-SA-A61F62FBBFE7E2B0`.
- Endereço canônico: `Av. Del Bombero S/n ( Piazza ) al Lado Del Hospital Del Iess Ceibos`.
- Referência indevida copiada da fala do cliente: removida.
- Quantidade preservada: `3` frascos.
- Total preservado: `USD 80.99`.
- Status preservado: `processing`.
- Evento Meta Purchase preservado: `2026-08-24T02:40:47.127Z`.
- Pedido Dropi já existente preservado: `6674859`.
- Backup anterior ao reparo, root `0600`:
  `/opt/vitalismen-automacao/backups/tex-ultra-delivery-v54/EC-MT6MPQ4G-BAF7-before-20260824T0408Z.json`.
- Sincronização do painel: lead `3437`, resultado `updated`, status operacional
  `pedido_enviado`.
- Mensagens de saída criadas após o reparo: `0`.

O reparo não chamou WhatsApp, Meta/CAPI nem Dropi. Não houve reenvio de mensagem,
recriação de Purchase ou nova submissão do pedido.

## Comportamento corrigido

- A fala do cliente deixa de ser usada como endereço de agência.
- Agência confirmada usa somente nome, ID e endereço do catálogo autorizado.
- Busca ambígua não escolhe agência automaticamente; apresenta opções A/B/C.
- Entrega domiciliar sem endereço real permanece em coleta de endereço.
- Agência confirmada não pede referência desnecessária.
- Correções estruturadas durante a confirmação voltam a ser validadas antes do
  fechamento.
- O painel e a memória do cliente recebem a mesma agência canônica.

## Validação pós-ativação

- Guard V54: `44/44`.
- `senior:check` em produção: `338/338`.
- Senior guard: aprovado.
- Microcamada de produto EC: aprovada.
- Catálogo Dropi: aprovado sem envio real.
- Health local: `status=online`.
- Z-API: configurada, conectada, `outboundBlocked=false` e sem erro.
- `https://ec.maxlien.shop/api/health/`: HTTP `200`.
- `https://ec.maxlien.shop/n/`: HTTP `200`.
- `https://ec.maxlien.shop/qr.html`: HTTP `200`.

Nenhum canário real foi enviado durante a implementação, publicação ou
validação.

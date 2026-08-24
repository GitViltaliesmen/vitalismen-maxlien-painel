# Resultado de ativacao V56 — reparo residual da ficha EC

Data: 2026-08-24

- Pull request: `#69`.
- Commit oficial: `e17aa9d8c3e240beac7f6ddd9b5f116f9df63d00`.
- Tag: `production-20260824-e17aa9d`.
- Release ativa apos a implantacao:
  `/opt/vitalismen-automacao/releases/20260824T045200Z_production-20260824-e17aa9d`.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T043635Z_production-20260824-0642d0d`.
- PM2: PID `2517619`, `online`, `unstable_restarts=0`, no release V56.
- CI Node 20/22 e Cloudflare: OK; guard V56 8/8; suíte completa 346/346.
- Backup:
  `/opt/vitalismen-automacao/backups/panel-customer-residual-v56/affected-records-before-20260824T045308Z.json`,
  modo `0600`.
- Os quatro pedidos de agencia ficaram com endereco canonico; status,
  quantidade, total, Dropi e Purchase Meta foram preservados.
- As fichas 5201/6060 foram separadas; `EC-MSWR401B-KNHS` permaneceu identico.
- Zero mensagens aos seis contatos depois do inicio do reparo.

A varredura normalizada posterior confirmou zero pedido de agencia verificada
com endereco vazio. Ela tambem identificou um alias local legado de 5541 ainda
com o rascunho 4364; a V57 trata somente esse ultimo documento, sem tocar pedido,
mensagem, Dropi ou Meta.

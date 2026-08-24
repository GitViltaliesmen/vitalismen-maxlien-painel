# Resultado de ativacao V55 — persistencia da ficha EC

Data: 2026-08-24

- Pull request: `#68`.
- Commit oficial: `0642d0d7c8f1a7d1a406093bfdfe02a09df4e333`.
- Tag: `production-20260824-0642d0d`.
- Release ativa apos a implantacao:
  `/opt/vitalismen-automacao/releases/20260824T043635Z_production-20260824-0642d0d`.
- Release anterior preservada para rollback:
  `/opt/vitalismen-automacao/releases/20260824T040419Z_production-20260824-8801624`.
- O PM2 foi reiniciado no release V55 e o health local, publico, `/n/` e o
  estado Z-API somente leitura foram validados.
- Guard V55: 20/20; `senior:check`: 342/342; CI Node 20/22 e Cloudflare: OK.
- Backup do reparo:
  `/opt/vitalismen-automacao/backups/panel-customer-form-v55/affected-records-before-20260824T043803Z.json`,
  modo `0600`.
- Reparados os pedidos exatos finais 4663 e 1150 e isolada a ficha 5541/4364.
- Nenhuma mensagem, Purchase Meta ou submissao Dropi foi enviada pelo reparo.

A correcao preventiva V55 permaneceu valida. Uma varredura mais ampla posterior
identificou quatro registros residuais da mesma janela anterior e duas fichas
historicas cruzadas; esses alvos foram separados da V55 e autorizados na V56
para manter o reparo auditavel e estritamente limitado.

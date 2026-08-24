# Resultado de ativacao V57 — alias local da ficha 5541

Data: 2026-08-24

## Publicacao

- Pull request funcional: `#70`.
- Commit oficial: `33e48fc82d480646993fe52abdb9a31bf071357d`.
- Tag anotada: `production-20260824-33e48fc`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T045910Z_production-20260824-33e48fc`.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T045200Z_production-20260824-e17aa9d`.
- PM2: PID `2525370`, `online`, `unstable_restarts=0`; symlink, `pm_cwd`,
  `pm_exec_path` e `/proc/<pid>/cwd` resolvem para a release V57.

## Reparo e backup

- Backup:
  `/opt/vitalismen-automacao/backups/panel-customer-alias-v57/alias-before-20260824T050025Z.json`,
  modo `0600`.
- O alias `_id` `6a7de6b3f24ae26732b45816`, `0983125541@c.us`,
  foi normalizado para `593983125541` e recebeu a ficha canonica V55 de Sergio.
- O estado canonico `_id` `6a7de6a3f24ae26732b457a8` permaneceu identico
  ao snapshot anterior.
- Lead `3296` e Dropi `6530124`, pertencentes a Sergio, foram preservados.
- Nenhum Order, Message ou Shipment foi alterado pelo script.

## Validacao final

- CI Node 20/22 e Cloudflare: OK.
- Guard V57 com regressao V56: 6/6.
- Suíte completa: 348/348.
- Lint: 438 arquivos; produto EC, anti-spam e freeze lock: OK.
- Pedidos de agencia verificada com endereco vazio: `0`.
- Divergencias reais de identidade apos normalizacao EC: `0`.
- Mensagens enviadas aos telefones envolvidos depois do inicio do reparo: `0`.
- Health publico: `online`, Z-API `connected`, `ready=true`, sem degradacao;
  `/api/health`, `/n/` e `/qr.html`: HTTP `200`.
- Rollback nao executado; autorização root de uso unico consumida.

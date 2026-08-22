# Resultado da ativação V35 — ingredientes por produto EC

## Identificação publicada

- Pull request: `#32` — `feat(funil): adiciona FAQ de ingredientes por produto`.
- Commit funcional: `d3d80a0b7553b3b43518337767901cb2373a8145`.
- Merge em `production`: `503c49d1e84fbf78061b3d2574dbf96a46352c31`.
- Tag anotada: `production-20260822-503c49d`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T033359Z_production-20260822-503c49d`.
- Ativação concluída em 2026-08-22 pela rotina transacional oficial
  `/usr/local/sbin/vitalismen-stage`.

## Backup e rollback

- Backup protegido anterior à troca:
  `/opt/vitalismen-automacao/backups/pre-ingredients-v35-20260822T033600Z/official-files-before-v35.tar.gz`.
- Permissões verificadas: diretório `root:root:700` e arquivo
  `root:root:600`.
- Rollback disponível:
  `/opt/vitalismen-automacao/releases/20260822T025119Z_production-20260822-eedf503`.
- O storage compartilhado de mídia inbound não foi removido nem substituído.

## Auditoria da publicação

- O primeiro staging recusou uma tag leve, antes de qualquer ativação; a
  release incompleta foi removida automaticamente e `current`/PM2 permaneceram
  inalterados.
- A mesma tag foi recriada no formato anotado obrigatório, continuando a
  apontar para o merge `503c49d1e84fbf78061b3d2574dbf96a46352c31`.
- Staging oficial aprovado: `npm ci`, auditoria oficial, freeze lock, senior
  check, catálogo Dropi, microcamada de produto, retirada, contatos/status,
  selos operacionais e testes de aviso de retirada.
- Suíte Linux da release: `265` testes, `265` aprovados e `0` falhas.
- Teste específico V35 executado após a ativação: `8/8` aprovado.
- Runtime guard V35 executado na release ativa: aprovado.
- Health local, health público e `/n/`: HTTP `200`.
- Z-API: configurada, conectada e pronta, com uma sessão oficial conectada.
- Flags operacionais verificadas como ativas: funil, resposta automática,
  roteamento inbound Z-API, scheduler e automações protegidas de pós-venda.

## PM2 e efeitos reais

- PID anterior: `2099109`.
- PID após reinício controlado: `2106706`.
- Status: `online`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- Nenhuma mensagem de WhatsApp, mídia, pedido, Dropi ou evento Meta/CAPI foi
  criado como canário durante staging ou validação.
- A autorização de ativação foi consumida em uso único; o helper voltou ao
  modo de staging restrito.

## Resultado funcional

A FAQ determinística em espanhol está ativa para Tex Ultra, Nitrix Oxide e
Vit Power. A resposta usa apenas o produto atual da ficha, mantém o contexto
médico fora da resposta comercial, preserva a etapa do funil e aplica lock,
cooldown, histórico e anti-spam persistidos.

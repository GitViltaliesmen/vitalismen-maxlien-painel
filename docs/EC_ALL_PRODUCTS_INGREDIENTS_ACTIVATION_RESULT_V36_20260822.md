# Resultado da ativação V36 — lista consolidada de ingredientes EC

## Identificação publicada

- Pull request: `#34` —
  `feat(funil): adiciona lista consolidada de ingredientes`.
- Commit funcional: `d9c349190605e8498e8cbb63a3ae2c9770da42fa`.
- Merge em `production`: `1dbbbe58910ed75aa86ab6327c16c1c645b1fcd4`.
- Tag anotada: `production-20260822-1dbbbe5`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260822T035923Z_production-20260822-1dbbbe5`.
- Ativação concluída em `2026-08-22T04:02:50Z` pela rotina
  transacional oficial `/usr/local/sbin/vitalismen-stage`.

## Backup e rollback

- Backup protegido anterior à troca:
  `/opt/vitalismen-automacao/backups/pre-all-products-ingredients-v36-20260822T035923Z`.
- Arquivo dos oficiais substituídos:
  `v35-overridden-files.tgz`.
- SHA-256 do arquivo:
  `00c0bd3628971d2ed22050cd8958cf543935ed4b3b79cbba7dd1267b2917bd0e`.
- Permissões verificadas: diretório `700`; arquivo e cópia de ambiente `600`.
- Rollback disponível:
  `/opt/vitalismen-automacao/releases/20260822T033359Z_production-20260822-503c49d`.
- O storage compartilhado de mídia inbound não foi removido nem substituído.

## Auditoria da publicação

- GitHub Actions aprovou Node 20, Node 22 e Cloudflare Pages.
- O staging oficial aprovou `npm ci`, auditoria oficial, freeze lock, senior
  check, microcamada de produto, catálogo Dropi, avisos de retirada, contatos,
  selos operacionais e testes de retirada.
- Suíte Linux da release: `272/272` testes aprovados.
- Testes V35 + V36 dentro da candidata: `15/15` aprovados.
- Teste específico V36 após a ativação: `7/7` aprovado.
- Runtime guard e guard estático V36 executados na VPS: aprovados.
- Health local, health público e `/n/`: HTTP `200`.
- Z-API: transporte oficial conectado e pronto, com uma sessão conectada e
  nenhuma razão de degradação.
- Flags operacionais verificadas como ativas: aprovação operacional, funil,
  resposta automática, roteamento inbound Z-API, scheduler e automações
  protegidas de pós-venda.

## PM2 e efeitos reais

- PID anterior: `2106706`.
- PID após reinício controlado: `2111415`.
- Status: `online`; `unstable_restarts=0`.
- `pm_cwd`: `/opt/vitalismen-automacao/current`.
- `pm_exec_path`: `/opt/vitalismen-automacao/current/src/index.js`.
- O CWD real do PID resolve para a release V36 ativa.
- A autorização de ativação foi consumida em uso único; o helper voltou ao
  modo de staging restrito.
- Nenhuma mensagem de WhatsApp, mídia, pedido, Dropi ou evento Meta/CAPI foi
  criado como canário durante staging ou validação.

## Resultado funcional

A opção 1 está ativa no funil oficial EC. Quando o cliente pedir todos os
ingredientes, comparar fórmulas ou citar pelo menos dois produtos, o bot envia
uma única mensagem em espanhol com seções separadas de Tex Ultra, Nitrix Oxide
e Vit Power. Perguntas de um único produto continuam na resposta individual
V35. A resposta consolidada não troca o produto atual, não altera a origem da
VSL, não reinicia o funil e usa memória, lock, cooldown e antispam próprios.

Preços, ofertas, mídia, áudio, pedidos, Dropi, Meta/CAPI, pixel, número oficial,
scheduler, avisos de retirada e demais rotinas de pós-venda permaneceram
inalterados.

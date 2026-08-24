# Resultado de ativacao V58 — frasco e continuidade do B01 Tex Ultra

Data: 2026-08-24

## Publicacao

- Pull request funcional: `#72`.
- Commit oficial: `812fb25f0e585c0906cde47f4d4b1570511c3fda`.
- Tag anotada: `production-20260824-812fb25`.
- Release ativa:
  `/opt/vitalismen-automacao/releases/20260824T123239Z_production-20260824-812fb25`.
- Ativacao transacional concluida em `2026-08-24T12:35:26Z`.
- Rollback preservado:
  `/opt/vitalismen-automacao/releases/20260824T045910Z_production-20260824-33e48fc`.
- O upload preliminar do mesmo commit, recusado antes da ativacao por nao ter os
  marcadores do helper root atual, foi preservado em
  `/opt/vitalismen-automacao/staged-upload-backups/20260824T123239Z_production-20260824-812fb25`.
- PM2: PID `2558794`, `online`, `unstable_restarts=0`; `pm_cwd` e
  `pm_exec_path` apontam para `/opt/vitalismen-automacao/current` e
  `/proc/2558794/cwd` resolve para a release V58.

## Correcao e varredura

- M01 e B01 usam o frasco oficial existente
  `/media/sales/ec/tex_ultra.png`, SHA-256
  `450122a3db3823d012770a20f25f311be66a564b8fb23d9d0d47f0207d3ce2f7`.
- O caminho inexistente `/media/sales/ec/tex_ultra_bottle.png` ficou com zero
  referencias no painel publicado.
- A sequencia B01 permanece saudacao, um audio universal, Prova 1, frasco e
  valores promocionais.
- A varredura comparou 42 referencias literais do painel/backend e 17 da
  extensao com os arquivos versionados. Nenhum outro caminho ativo ausente foi
  encontrado; os aliases legados declarados resolvem para arquivos existentes.
- Cada etapa manual agora leva `clientGeneratedId`, sessao e pais e reconcilia
  a bolha otimista com o registro persistido. Falha permanece visivel como
  `unconfirmed` e interrompe o bloco.

## Validacao final

- CI Node 20/22 e Cloudflare: OK.
- Guard V58 com regressao V52: 7/7.
- Suite completa: 352/352; lint: 442 arquivos.
- `senior:check`, produto EC, catalogo Dropi somente leitura, anti-spam de guia,
  notificacoes de retirada e freeze lock: OK na release.
- `/qr.html`, `/n/` e `/media/sales/ec/tex_ultra.png`: HTTP `200`.
- O PNG publico possui 95.744 bytes e o mesmo SHA-256 do arquivo versionado.
- Health publico: `online`; Z-API `connected`, `outboundBlocked=false`, sem
  erro. Baileys pode continuar em `scanning` conforme o contrato coexistente.
- PM2 executa o release ativo; o symlink e `/proc/<pid>/cwd` foram conferidos.

## Canario protegido

- Nenhum cliente real recebeu validacao.
- O unico telefone usado foi o QA autorizado `5515998038637`.
- Frasco oficial: registro `zapi_out_74BB10FEE7ECD9AF5CBF`, provedor Z-API,
  callback recebido e estado final `delivered`, sem erro.
- Valores oficiais USD 35.99/70.00/80.99/147.99: registro
  `zapi_out_3EB03C57B9A4676E0B936E`, provedor Z-API, callback recebido e estado
  final `delivered`, sem erro.
- Pedidos e shipments criados para o QA na janela do canario: `0` e `0`.
- Nenhum replay de Purchase, Dropi ou Meta/CAPI foi autorizado.

Rollback nao executado; autorizacao root de uso unico consumida. Bancos,
mensagens, pedidos, Shipments e midias compartilhadas permanecem preservados.

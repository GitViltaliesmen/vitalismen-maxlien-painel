# Resultado da ativação controlada de mídia V30 — 2026-08-21

Escopo: Vitalismen / Maxlien Ecuador oficial.

## Fonte publicada

- PR: `#17`, mesclado em `2026-08-21T18:06:19Z`.
- Commit de produção: `937ae43ba850aac493fc624f5b060b2ef6d8c071`.
- Commit funcional preservado no histórico: `a57d4f1daba8d412c1661f627fb32b45e61f4130`.
- Tag imutável: `production-20260821-937ae43`.
- Release ativa: `/opt/vitalismen-automacao/releases/20260821T180758Z_production-20260821-937ae43`.
- Ativação concluída em `2026-08-21T18:09:55Z` pelo helper transacional oficial.

## Backup e rollback

A release anterior permaneceu intacta e foi registrada pelo helper como rollback disponível:

`/opt/vitalismen-automacao/releases/20260821T165731Z_production-20260821-b26bacd`

O permit root foi específico, de uso único e consumido após a ativação. Nenhum rollback foi executado porque todos os gates passaram.

## Validações executadas

- CI do PR: Node.js 20 e Node.js 22 passaram nos eventos de push e pull request; Cloudflare Pages passou.
- Staging oficial: auditoria de estado, `senior:check`, produto EC, catálogo Dropi, pickup, contatos/status, rótulos operacionais e freeze-lock passaram.
- Storage compartilhado: `/opt/vitalismen-automacao/shared/media/inbound`, `root:root`, modo `0750`.
- PM2: processo `vitalismen-automation` online; `pm_cwd` e `pm_exec_path` usam `/opt/vitalismen-automacao/current`; o CWD real do PID resolveu para a release `937ae43`.
- Health local, health oficial e `/n/`: HTTP 200.
- Endpoint de mídia: HTTP 401 sem Bearer e HTTP 404 autenticado para ID inexistente, confirmando que a rota protegida foi alcançada sem expor token em URL.
- Canário controlado sem cliente: áudio OGG/Opus e imagem PNG passaram para `READY`, foram lidos do storage real com arquivos `0640` e diretórios `0750`; os dois arquivos sintéticos foram removidos depois da verificação.
- Efeitos do canário: zero mensagens WhatsApp, zero contatos/pedidos e zero escritas de cliente.

## Transporte preservado

A Z-API continuou como transporte oficial, configurada e conectada. O WhatsApp Web/Baileys permaneceu habilitado, porém em `scanning`, `ready=false` e com zero sessões conectadas. Por isso, a retirada da Z-API não fez parte desta ativação.

## Canário real do provider

Foi observada uma janela de cinco minutos após a ativação. Nenhum áudio ou imagem inbound real novo chegou nesse intervalo. O canário do pipeline e do storage passou, mas o último elo com uma mídia nova entregue pelo provider permanece pendente de chegada real controlada.

## Riscos remanescentes

- mídia histórica com URL já expirada não pode ser recuperada retroativamente;
- a captura pode aguardar o provider por até 20 segundos;
- o disco da VPS estava em 81% de uso, com aproximadamente 19 GB disponíveis, e deve ser monitorado;
- a desativação da Z-API só pode ocorrer depois que o WhatsApp Web estiver pareado, pronto e validado em entrada e saída.

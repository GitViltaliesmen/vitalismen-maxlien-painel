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

Nova leitura somente leitura em `2026-08-21T18:42:16Z` confirmou que ainda não havia mídia inbound real nova desde a ativação: zero registros `READY` e zero registros `FAILED`. A implementação e o storage estão finalizados; a comprovação do último elo continua condicionada à chegada real de um áudio ou imagem, sem usar cliente como teste e sem fabricar mensagem.

## Continuidade da Z-API

O operador reativou a assinatura da instância oficial identificada pelo sufixo `189592AB`. A API foi consultada sem alteração de estado em `2026-08-21T18:39:03Z` e confirmou:

- cobrança `PAID`;
- instância conectada;
- smartphone conectado;
- renovação indicada para `2026-08-23T20:07:06Z`;
- nenhuma troca de ID, token, webhook, número ou variável de produção.

Decisão operacional: manter a Z-API como transporte oficial durante o próximo ciclo. Não cancelar a assinatura nem gerar token isoladamente. A futura retirada continua condicionada a WhatsApp Web/Baileys pareado e validado em entrada, saída e health. Credenciais não são registradas neste documento.

## Auditoria final da fila de retirada

Em `2026-08-21T18:42:16Z`, a leitura do banco oficial encontrou 27 pedidos de agência em `READY_FOR_PICKUP`, todos com liberação explícita do Dropi e `pickupReadyVerified=true`:

- 19 já possuíam evidência persistida de aviso por mensagem, áudio, evento ou notification ledger;
- oito permaneciam sem aviso, todos com `manualOnly=true`;
- quatro dos oito estavam `EN_RUTA`, com movimento `Ingresando en Agencia` na última consulta da transportadora: guias `189375168`, `189375575`, `189381404` e `189381405`;
- quatro estavam em `NOVEDAD`: guias `189375430`, `189375463`, `189380633` e `189381403`;
- resultado operacional: zero candidatos seguros para aviso automático e zero mensagens enviadas nesta revisão.

O auditor `scripts/audit-pickup-notification-evidence.mjs` foi corrigido para considerar o notification ledger e eventos recuperados do histórico. Isso elimina a classificação incorreta de aviso recuperado como falso positivo, sem mudar scheduler, dispatcher ou regra de envio.

## Publicação final do auditor

- PR de finalização: `#19`, mesclado em `2026-08-21T18:49:06Z`.
- Commit de produção: `7cd02383911f4660a577d84e58c58d0d00396d27`.
- Tag e GitHub Release: `production-20260821-7cd0238`.
- Release ativa no VPS: `/opt/vitalismen-automacao/releases/20260821T185008Z_production-20260821-7cd0238`.
- Ativação transacional concluída em `2026-08-21T18:51:20Z`.
- Rollback preservado: `/opt/vitalismen-automacao/releases/20260821T180758Z_production-20260821-937ae43`.
- Auditor corrigido em produção: 27 ativos, zero falso positivo, oito sem aviso e todos protegidos para revisão manual.
- PM2 online, `unstable_restarts=0`; health local, health oficial e `/n/` em HTTP 200.
- Z-API após a ativação: `PAID`, instância conectada e smartphone conectado.
- Permit root consumido; nenhum rollback e nenhuma mensagem enviada.

## Riscos remanescentes

- mídia histórica com URL já expirada não pode ser recuperada retroativamente;
- a captura pode aguardar o provider por até 20 segundos;
- o disco da VPS estava em 81% de uso, com aproximadamente 19 GB disponíveis, e deve ser monitorado;
- o canário inbound real depende da chegada controlada de uma nova mídia pelo provider;
- os oito casos manuais continuam bloqueados até a transportadora deixar de indicar `EN_RUTA`/`NOVEDAD` e uma revisão posterior comprovar elegibilidade;
- a desativação da Z-API só pode ocorrer depois que o WhatsApp Web estiver pareado, pronto e validado em entrada e saída.

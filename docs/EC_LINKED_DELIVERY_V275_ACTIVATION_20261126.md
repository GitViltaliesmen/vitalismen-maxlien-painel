# Ativação V275 — recibos de mensagens no transporte vinculado

Data: 2026-11-26 (UTC). Projeto: Vitalismen EC oficial.

## Fonte e publicação

- Código publicado: commit `94b1aabccff6c523fc12e34c61cd54c6f7f4dbe5`, árvore `a70191ed3ebc1953ee2e9f5da8a69789ac79a166`, branch `codex/ec-linked-delivery-v275`.
- Release ativo: `/opt/vitalismen-automacao/releases/20261126T141000Z_production-20261126-94b1aab`.
- Release anterior V274 preservado: `/opt/vitalismen-automacao/releases/20261126T024208Z_production-20261126-4d8efd8`.
- Backup de ativação e autenticação vinculada: `/opt/vitalismen-automacao/backups/ec-linked-delivery-v275-20261126T141000Z`.
- Autoridade sucessora: `/var/lib/vitalismen-deploy/ec-linked-delivery-v275-r1/approval.json` e `activation.json`, estado `ACTIVE`.

## Gates executados

- Testes dirigidos V275: 10 aprovados.
- `npm run senior:check` no release materializado, em namespace de rede isolada e perfil fixture selado: exit 0. Lote principal: 482 aprovados, 0 falhas. Lote final V140: 22 aprovados, 0 falhas.
- Após ativação: `current` aponta ao release V275; PM2 `vitalismen-automation` online com `pm_cwd` e `pm_exec_path` em `current` e cwd real no release V275.
- Health local: `status=online`, WhatsApp `ready=true`, uma sessão conectada no transporte `whatsapp_web`.
- Painel público `https://ec.maxlien.shop/qr.html`: HTTP 200. A página servida contém as distinções de estado `aceito · aguardando entrega`, `entregue` e `lido`.
- Rota legada `/api/zapi`: HTTP 410 no modo `baileys_text`.
- Timer `vitalismen-postsale-full-v203.timer` permaneceu inativo. VSL, funis, Meta, Dropi e pedidos não foram modificados nesta publicação.

## Limite da prova

As provas acima validam a publicação e a lógica simulada de persistência de recibos. Não foi enviado novo contato de QA nem observado callback real de entrega/leitura após a ativação. O painel só deve mostrar `entregue` ou `lido` quando chegar o recibo correspondente; ID aceito pelo dispositivo é apenas `aceito · aguardando entrega`. Registros antigos sem recibo mantêm resultado incerto e não devem ser reenviados automaticamente.

O cache privado de mensagem original serve ao retry criptográfico solicitado pelo próprio WhatsApp para mensagens **novas**; não repara mensagens antigas que o aplicativo mostra como `Aguardando mensagem`. Referências históricas à Z-API ainda existem em código legado, testes e rollback selados. O caminho operacional de envio foi bloqueado e a interface ativa usa o dispositivo vinculado.

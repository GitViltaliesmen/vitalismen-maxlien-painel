PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat não modal e aviso WhatsApp — V226

Solicitação autorizada: manter o atendimento utilizável com o chat lateral aberto, permitir fechar/reabrir e abrir quando o cliente chamar. O teste do celular veio pelo WhatsApp; o monitor anterior acompanhava somente as conversas do site.

Arquivo oficial lido da VPS e alterado: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`. Baseline V225 SHA `de40ebe7d9951b34f03334f56c8975d878d1fbdf6c94f2889d8781b47c69c51e`; versão final SHA `5b33b610c62c8aa8316337d6068787093146fbb4baa33fbf11e584a6e9e1ecd4`. Somente HTML do alias foi publicado. Backend, bot, banco, Nginx, VSL, checkout, Dropi e Meta não foram alterados.

O popup do site passou a ser não modal, preserva a conversa selecionada ao reabrir e monitora novas perguntas por GET a cada 10 segundos, com sessão administrativa válida e aba visível. Histórico anterior forma o baseline. Resposta isolada da atendente não abre novo aviso. Não há remetente novo de mensagens.

O aviso WhatsApp usa a atualização existente de contatos a cada 3,5 segundos, por um evento local acrescentado após a atualização da lista. Consulta somente o GET existente de mensagens, identifica a última entrada do cliente e abre na lateral direita com nome, horário e texto ou indicação de mídia. Permite apenas EC e o QA permanente final 8637; grupos, broadcast, LID e outros brasileiros são recusados. A lista esquerda continua sem previews.

O teste real das 22:25 já aparecia lido em outra visualização. Além de não lidos recentes, o aviso reconhece entradas dos últimos 15 minutos com contador zerado. Não reabre histórico antigo como novo. Deduplicação por ID durante a sessão evita reabrir a mesma mensagem após fechar; nova mensagem do cliente volta a abrir. Resposta do bot não é nova entrada. Pode-se reabrir manualmente pelo botão WhatsApp recebido.

A abertura automática mantém foco, rascunho e cliente principal. Abrir no atendimento exige clique e chama a seleção existente; rascunho de outro atendimento impede troca acidental. O aviso não envia nem marca mensagens como lidas. Logout limpa textos e consultas. Abrir uma janela lateral recolhe a outra.

## Validação

115 verificações simuladas PASS: 52 de UI/segurança, 19 do monitor web e 44 da entrada WhatsApp, desktop e celular. Cobrem entrada recente lida em outra aba, fechar/reabrir, nova mensagem, saída do bot ignorada, falha GET/retry, XSS, foco, rascunho, cliente e filtros. Chromium com rede isolada e respostas simuladas; não são novas mensagens físicas.

Na URL oficial o aviso abriu automaticamente com a mensagem real de QA recebida em `15/11/2026, 22:25:13`. Busca e rascunho funcionaram com popup aberto; cliente central permaneceu sem seleção. Fechar foi respeitado e reabrir funcionou. Chat do site continua acessível e não modal. Evidência `whatsapp-popup-publicado.jpg`; geometria `{'height': 428.984375, 'viewportHeight': 720, 'viewportWidth': 1280, 'width': 340, 'x': 913, 'y': 12}`. Zero previews na esquerda. Rascunho da auditoria removido sem envio.

HTTP200/hash exato. PM2 PID `3581454` online preservado; cwd `/opt/vitalismen-automacao/current`, execução `/opt/vitalismen-automacao/current/src/index.js`, cwd real `/opt/vitalismen-automacao/releases/20261116T001622Z_production-20261116-5a86596`. Nenhum serviço reiniciado, WhatsApp enviado, pedido criado ou evento de compra disparado. Não reexecutada suíte integral do backend: alteração isolada no HTML, com testes focados.

Limites: depende de sessão autenticada, aba visível e API disponível; intervalo nominal não garante latência máxima. O teste real comprova recuperação da mensagem anterior; novas entradas físicas após deploy seguem observação normal, com reabertura já validada em simulação.

## Backup e rollback

R3 foi publicada e a conferência online motivou o reconhecimento de entrada já lida em R4. Registros preservados. Backup anterior a toda alteração `/opt/vitalismen-automacao/backups/dashboard-live-chat-v226-r3/20261116T013204Z/qr.before.html` (SHA `de40ebe7d9951b34f03334f56c8975d878d1fbdf6c94f2889d8781b47c69c51e`); backup intermediário `/opt/vitalismen-automacao/backups/dashboard-live-chat-v226-r4/20261116T013310Z/qr.before.html`. Cópias e manifesto em `C:\Users\Wolfe\Backups\VITALISMEN_EC\DASHBOARD_LIVE_CHAT_V226\20261116T013310Z`. Troca atômica com UID/GID/modos preservados.

Rollback documentado, não executado: conferir SHA final, recuperar HTML do backup R3 com metadados para arquivo temporário no mesmo diretório, conferir SHA original e substituir atomicamente apenas qr.html. Validar HTTP/hash/sessão. Não restaurar bancos nem reiniciar processos. Patch versionado reconstrói alteração do baseline exato. Backup global MongoDB continua FAIL, separado desta cópia do HTML.

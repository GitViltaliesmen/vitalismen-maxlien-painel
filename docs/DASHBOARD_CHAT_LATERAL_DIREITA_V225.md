PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat do dashboard alinhado à direita — V225

Solicitação explícita: o chat deve abrir na lateral direita, em vez do centro da tela. Alterado somente o CSS por meio de um bloco delimitado V225 acrescentado ao HTML oficial `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`. O dialog existente fica fixo a 12 px do topo e da borda direita, com largura máxima de 460 px e altura da tela menos as margens. Em telas até 600 px, usa margens de 8 px. A lista de conversas fica acima do histórico para permitir leitura na largura lateral.

Preservados integralmente os scripts, autenticação, botões de abertura/fechamento, modalidade do dialog, dados, backend, bot, VSL, checkout, WhatsApp, Dropi e mensuração. Nenhum serviço foi reiniciado. O registro V224 continua válido para o botão flutuante; V225 substitui somente o baseline de layout/HTML com os hashes abaixo.

SHA anterior `0438968507afce4fde13ed4b8638124aff2664e9377b814ba097d0c2a771ec4c`; publicado `de40ebe7d9951b34f03334f56c8975d878d1fbdf6c94f2889d8781b47c69c51e`. Removendo exatamente o bloco V225, todos os bytes anteriores são recuperados. Fonte lida da VPS antes do patch, publicação atômica e UID/GID/modos/atributos preservados. Backup versionado `/opt/vitalismen-automacao/backups/dashboard-right-chat-v225/20261116T011008Z/qr.before.html`; cópia local e manifesto em `C:\Users\Wolfe\Backups\VITALISMEN_EC\DASHBOARD_RIGHT_CHAT_V225\20261116T011008Z`.

Validação: 52 verificações PASS em desktop e 375 px, incluindo borda direita, topo, largura limitada, uma coluna interna, enquadramento na tela, abrir/fechar/retornar o launcher, rascunho preservado, isolamento dos históricos, conteúdo HTML inerte e ausência de requests de escrita. HTTP público 200 com hash exato. Na URL oficial, clique no botão flutuante abriu o painel à direita e exibiu a conversa técnica já salva. Geometria medida no navegador: `{'height': 696, 'left': 793, 'right': 1253, 'rightGap': 27, 'top': 12, 'width': 460}`. Captura `chat-lateral-direita-publicado.jpg`. Nenhuma mensagem foi reenviada para testar esta alteração.

Rollback documentado, não executado: conferir o SHA publicado e restaurar somente o HTML anterior com os metadados registrados, ou remover exatamente o bloco V225 e confirmar que o SHA anterior é recuperado. Validar a URL pública. Não alterar processos, rotas ou dados. O backup global MongoDB continua FAIL, independente desta cópia de segurança do HTML.

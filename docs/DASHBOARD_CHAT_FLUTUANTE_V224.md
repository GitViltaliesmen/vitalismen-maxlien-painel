PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat flutuante no dashboard — V224

Solicitação explícita: disponibilizar o popup do chat no próprio https://ec.maxlien.shop/qr.html?v=20261112-v206. Adicionado botão verde **Chat do site** no canto inferior direito. Ele aciona o mesmo popup autenticado V222 já existente, sem sair da tela. O acesso da barra superior permanece disponível. O botão flutuante fica oculto enquanto o popup está aberto e reaparece ao fechar. Fora do dashboard autenticado ele fica oculto.

O popup lista as conversas do site e exibe o histórico selecionado; continua somente consulta. Não foi acrescentado compositor nem envio de mensagens pelo operador. A alteração não modifica o popup do cliente publicado na página Vit Power.

## Fonte, integridade e publicação

Arquivo oficial lido e alterado: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`. Fonte antes `e61d4c6ce109f32a35256f16c03859051b3047cf5c7975279b0261e5048d000b`, publicada `0438968507afce4fde13ed4b8638124aff2664e9377b814ba097d0c2a771ec4c`. Removendo exatamente o bloco delimitado V224, recuperam-se todos os bytes anteriores. Nenhuma função preexistente foi substituída. O novo botão encaminha o clique ao acionador V222; os observers próprios acompanham apenas a abertura do dialog e a classe do dashboard.

Publicação atômica, com propriedade/permissões/atributos preservados. Backup versionado `/opt/vitalismen-automacao/backups/dashboard-floating-chat-v224/20261116T010446Z/qr.before.html`; cópias e manifesto local em `C:\Users\Wolfe\Backups\VITALISMEN_EC\DASHBOARD_FLOATING_CHAT_V224\20261116T010446Z`. Não houve reinício ou recarga de serviço, mudança no backend, Nginx, VSL, checkout, WhatsApp, pedido, Dropi, Pixel/CAPI, preço, cadência ou dados do cliente. Release backend preservado: `/opt/vitalismen-automacao/releases/20261116T001622Z_production-20261116-5a86596`. PM2 online e cwd real conferidos.

## Validação

44 verificações de navegador PASS em desktop e 375 px, com rede interceptada: botão visível no dashboard e dentro do viewport, abertura pelo botão flutuante, ocultação/retorno ao abrir e fechar, rascunho da ficha preservado, conteúdo HTML inerte, troca de histórico e resposta tardia, erro 403 sem logout, estado vazio, fechamento por Esc, lista WhatsApp sem preview e ausência de requests de escrita. Quatro scripts inline analisados sem erro de sintaxe; nenhum erro JavaScript na fixture.

HTTP público 200 com hash exato. Na URL oficial, o botão flutuante foi visto, acionado e exibiu as conversas reais salvas. A conversa técnica conhecida mostrou a pergunta e a resposta de preço de 3 frascos por USD 95.99. Nenhuma nova mensagem, pedido ou evento Meta foi enviado para esta conferência. Capturas locais `botao-flutuante-dashboard.jpg` e `popup-dashboard-publicado.jpg`.

Rollback: conferir que o SHA ativo ainda corresponde ao publicado e restaurar somente o HTML anterior com seus metadados por substituição atômica. Validar o SHA anterior e a URL pública; o acesso superior V222 permanece. Não restaurar banco ou alterar processos. Rollback não executado. O backup global MongoDB continua FAIL, separado desta cópia de segurança do arquivo estático.

# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

STATUS=PUBLICADO_AUDITADO

A versão V233 encontrava o contato WhatsApp, mas o clique chamava `selectChat` e recolhia o popup. A V234 carrega as mensagens no próprio popup lateral não modal, mantendo o atendimento central, a ficha e os rascunhos do operador intactos.

## Comportamento publicado

- Busca mantém as seções separadas de conversas do site e contatos WhatsApp autorizados já carregados. Nenhuma associação entre visitante anônimo e telefone é inventada.
- Clique no contato WhatsApp consulta o histórico salvo pela rota autenticada existente `GET /api/whatsapp/messages/:phone?fast=1&limit=60`, sem sincronização ativa, envio ou marcação de leitura. Apresenta as últimas 60 mensagens, textos, imagens, áudios e vídeos disponíveis no mesmo popup.
- Atualiza o histórico a cada 10 segundos enquanto aberto, visível e autenticado. Preserva a reprodução em andamento quando chegam mensagens. Áudio depende do acionamento manual; sem autoplay.
- Fechar interrompe as consultas e a reprodução; reabrir recupera o contato na mesma sessão. Logout limpa a seleção privada. Respostas antigas após troca de contato ou fechamento são descartadas.
- O popup permanece de consulta. O atendimento e envio de mensagens existentes continuam no painel principal. Os históricos do site e WhatsApp não são mesclados.

## Fonte e publicação

Alias oficial em `72.60.137.77`: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`.

Fonte: commit `2e13387b7f00ebfdc78a9053d66157cb02e2c2fb`, tag `panel-whatsapp-popup-v234-20261116`. O patch e teste estão versionados em `ops/browser/popup-whatsapp-v234.patch` e `tests/browser/popup-whatsapp-v234.mjs`.

Publicado em 2026-11-16T22:45:58Z. SHA-256 anterior `3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc`; atual `b07b2e939b6d80f2f5a6d7ccb8bfd218c6f2dec4465a9c3b9e974e7e049a1c65`.

Backup anterior: `/opt/vitalismen-automacao/backups/whatsapp-popup-view-v234-20261116/qr.html.before`, UID/GID 0/0, modo 0644. A substituição preservou os metadados necessários.

Backend permanece em `/opt/vitalismen-automacao/releases/20261116T195949Z_production-20261116-a46af49`. PM2 PID 3700171, contador de reinícios 39, cwd e exec em `/opt/vitalismen-automacao/current` e `/opt/vitalismen-automacao/current/src/index.js`. Zero novos reinícios, Z-API conectada, hash de ativação preservado. Sem alteração de bot, produto, pedido, Dropi, Meta/CAPI, voz, preços ou Nginx.

## Testes e evidência

132 verificações de navegador PASS, em desktop 1440 e mobile 375. Rede interceptada em ambiente privado. Cobrem abertura no popup, preservação da conversa/ficha/rascunhos centrais, mídias, atualização efetiva após 10 segundos, fechar/reabrir, troca de fonte, autorização negada, resposta atrasada, XSS, filtros de contatos e ausência de previews na coluna esquerda. Zero mensagens reais e zero gravações comerciais nesses testes.

42 verificações do controlador PASS. O sucessor root `operations-controller-v232-r5.py` e `BINDINGS_V5.json` reconhece somente os hashes V233/V234 aprovados e mantém as verificações anteriores. O gate real foi novamente validado após publicar o HTML V234. Drop-in novo: `/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzzzz-ec-whatsapp-popup-v234.conf`. Houve somente daemon-reload, sem reinício, mudança de flags ou execução forçada da fila.

Teste público em 2026-11-16T22:49:28Z: busca pelo final 6269; contato correto conferido; 12 mensagens, dois controles de áudio e duas imagens dentro do popup aberto; painel central continuou em “Selecione um cliente”. Fechar/reabrir recuperou o mesmo contato. Zero previews proibidos na coluna esquerda. Nenhuma mensagem enviada, pedido submetido, atendimento assumido/liberado ou status alterado durante a validação. A captura privada fica no diretório de evidências, fora do Git.

## Backup e rollback

Adendo em `C:/Users/Wolfe/Backups/VITALISMEN_EC/WHATSAPP_POPUP_V234/20261116`: dez arquivos públicos e de controle sem credenciais, com SHA-256, UID/GID/modos, leitura integral do arquivo e estabilidade na origem verificados. Não é backup global dos bancos. O bloqueio anterior de consistência MongoDB continua FAIL.

Rollback desta camada: conferir SHA-256 anterior do `qr.html.before`; restaurar atomicamente somente o alias HTML com UID/GID/modo registrados; remover somente o drop-in V234 de 23 letras z; executar daemon-reload; conferir fallback no controlador R4 V233 e hashes, PM2/cwd/health. Não restaurar dados vivos, apagar ledger ou repetir mensagens/pedidos. Não executar o rollback completo V232 para desfazer esta camada de interface.

Uso: Ctrl+F5 no painel, Chat do site, buscar final 6269 e clicar no resultado WhatsApp. A conversa fica no popup lateral; o painel principal segue disponível.

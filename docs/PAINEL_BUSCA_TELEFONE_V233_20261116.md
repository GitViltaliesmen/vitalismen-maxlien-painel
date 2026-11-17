# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

STATUS=PUBLICADO_AUDITADO

A busca do popup antes filtrava somente sessões do site por nome, cidade ou identificação. O contato final 6269 estava na lista WhatsApp e não era uma sessão identificada do chat do site.

O popup agora procura também por nome, telefone completo formatado e 3 ou mais dígitos de telefone entre os contatos WhatsApp autorizados já carregados no painel. Resultados têm seção e selo WhatsApp. O clique abre a conversa no atendimento principal e recolhe o popup. Nenhuma associação entre visitante anônimo e telefone é inventada. A busca histórica principal existente continua disponível para registros que não estão carregados.

Não há consulta de servidor nova, envio de mensagem, alteração de cliente/pedido, marcação de compra, mudança de preço, bot, voz, Meta/CAPI ou Dropi. A navegação bloqueia troca quando existe rascunho de mensagem ou ficha não salva. Grupos, broadcast, LID sem telefone resolvido, próprio número e brasileiros fora da exceção QA permanecem excluídos. A busca não exibe texto de mensagens nas listas.

## Fonte e publicação

- Alias oficial: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html` em 72.60.137.77.
- Fonte publicada: `640a3cc9b3a5306fed60c93dea9f2160705576e1`; tag `refs/tags/panel-phone-search-v233-20261116`.
- Antes: `e2fdc6e9f5014ae1758cbd97fa2fa9ffe0c0c433dd8ff23fa87ea9277eedd5e4`.
- Depois: `3782def6eb39c4fba9299557d6fd01ee62c181fad931fd8d0737c205bddbc2fc`.
- Backup anterior: `/opt/vitalismen-automacao/backups/dashboard-search-phone-v233-20261116/qr.html.before`; UID/GID/modo `0/0/0o644`.
- Backend preservado: `/opt/vitalismen-automacao/releases/20261116T195949Z_production-20261116-a46af49`, PID 3700171, `/opt/vitalismen-automacao/current`, `/opt/vitalismen-automacao/current/src/index.js`; zero reinícios, Z-API conectado. Hash do estado de ativação anterior preservado.

## Testes

108 verificações de navegador em larguras desktop 1440 e mobile 375: PASS. Cobrem busca 6269, telefone formatado, nome sem distinção de acento/caixa, deduplicação, exclusões de contato, rascunhos, separação de origem, abertura pelo selectChat real no teste isolado, histórico central, popup não modal, proteção de código privado e XSS. Toda rede do teste foi interceptada em namespace privado; zero envios reais e zero escritas de produção.

Validação pública observada: busca 6269 retornou 1 contato WhatsApp; nome correto conferido; clique abriu a conversa central e recolheu o popup; coluna esquerda com zero previews proibidos. Nenhuma mensagem ou pedido foi enviado. Capturas privadas ficam no diretório desta tarefa, não no Git.

## Compatibilidade dos controles

O gate operacional V232 guardava o hash do HTML anterior. Foi publicado um sucessor mínimo do controlador (`operations-controller-v232-r4.py`, `BINDINGS_V4.json`) reconhecendo somente o hash V233 exato, commit de fonte publicado e prova de 108 verificações. 34 testes do controlador passaram, incluindo rejeição de baseline, hash sucessor e commit não autorizados. O gate real também passou contra os arquivos publicados. Isso mantém o controle de habilitação dos convites compatível com o painel novo, sem substituir ou relaxar guards anteriores.

O drop-in novo é `/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzzz-ec-dashboard-search-v233.conf`; aponta ao controlador root R4 no backup V232. Somente daemon-reload, sem reiniciar serviços, alterar flags ou disparar a fila. Os controladores, bindings e drop-ins anteriores foram preservados. A primeira tentativa de instalar esse registro aguardou o lock do pós-venda, sem interromper o ciclo em andamento.

## Backup e rollback

Adendo de arquivos públicos e de controle sem credenciais em `C:\Users\Wolfe\Backups\VITALISMEN_EC\PANEL_SEARCH_PHONE_V233\20261116`: 10 arquivos com SHA-256, UID/GID/modos e leitura integral do tar.gz conferidos. Zero restaurações em produção. Este adendo não é backup global de bancos; o bloqueio global de consistência MongoDB anterior continua FAIL.

Rollback desta camada: conferir a hash do backup anterior; restaurar atomicamente somente o alias HTML com UID/GID/modo registrados; remover somente o drop-in V233 de 22 z; daemon-reload; conferir fallback no controlador R3 V232, PM2/cwd/health e hash HTML e2fdc6e9. Não restaurar bancos, apagar ledger, reenviar pedidos ou mensagens. O backend permanece no mesmo release. Os arquivos R4 e evidências podem permanecer arquivados sem referência de execução.

Para utilizar: recarregar o painel com Ctrl+F5, abrir Chat do site, buscar 6269 e clicar em WhatsApp · contato localizado. Se houver rascunho, concluir ou salvar antes de trocar de cliente.

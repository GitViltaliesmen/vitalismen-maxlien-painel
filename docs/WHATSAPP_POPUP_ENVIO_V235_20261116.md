# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

STATUS=PUBLICADO_AUDITADO

## Problema e comportamento

O popup V234 mostrava o histórico WhatsApp sem um campo para escrever. A V235 adiciona, abaixo das mensagens, destinatário identificado, caixa de texto e botão Enviar. Enter envia; Shift+Enter quebra a linha. O campo aparece somente para o contato WhatsApp selecionado e cujo histórico foi autorizado. O histórico anônimo do site continua separado e de consulta.

O clique manual usa a rota autenticada existente `POST /api/whatsapp/send`, com telefone exato capturado antes da requisição, `sessionId=zapi`, `country=EC`, `sendMode=manual_panel`, identificador próprio em `clientGeneratedId` e o mesmo identificador em `manualIntent.actionId`. Não há nova rota, transporte, chave ou permissão. O comportamento de intervenção humana é o mesmo do envio manual principal. A sessão e o destinatário continuam sujeitos às validações existentes do servidor.

O botão fica bloqueado durante a requisição. Nenhum envio automático, retry ou scheduler foi acrescentado. Resultado incerto mantém o texto e bloqueia nova tentativa naquele contato durante a sessão do popup, inclusive ao fechar/reabrir; exige conferência no WhatsApp. A interface só declara aceite quando a resposta confirma sucesso; não apresenta aceite como entrega física. Rascunhos são separados por telefone, em memória, e apagados no logout. A seleção central, seus rascunhos e a ficha não são utilizados ou alterados pelo compositor lateral.

Comandos operacionais permanecem no atendimento principal. Orientação de retirada também exige a validação existente no atendimento principal; o popup não usa a situação logística de outro cliente para autorizar retirada.

## Fonte oficial e publicação

- Origem: 72.60.137.77, alias `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`.
- Fonte: `2f6482b5f3afbad194ba5bd9f8c085d6ebfd124a`; tag `panel-whatsapp-compose-v235-20261116`.
- Patch `ops/browser/popup-compose-v235.patch`; teste isolado `tests/browser/popup-compose-v235.mjs`.
- Publicado em 2026-11-16T23:08:26Z; SHA-256 `e55ac22126dfb79e9bf817e209aa051ab2fb2fb02a4b730a9c680e28a6ba0b63`.
- Baseline anterior: `b07b2e939b6d80f2f5a6d7ccb8bfd218c6f2dec4465a9c3b9e974e7e049a1c65`.
- Backup anterior `/opt/vitalismen-automacao/backups/whatsapp-popup-compose-v235-20261116/qr.html.before`; UID/GID 0/0, modo 0644.

Backend inalterado no release `/opt/vitalismen-automacao/releases/20261116T195949Z_production-20261116-a46af49`. PM2 PID 3700171, contador 39, cwd `/opt/vitalismen-automacao/current`, exec `/opt/vitalismen-automacao/current/src/index.js`. Zero novos reinícios, Z-API conectada, flags de ativação preservadas. Nenhuma mudança em bot, funil, pedidos, Dropi, Meta/CAPI, preços, voz ou Nginx.

## Testes

174 verificações de navegador PASS em desktop 1440 e mobile 375. Incluem seis POSTs de mensagem totalmente simulados/interceptados, sem rede externa no namespace de teste: payload/destinatário/autorização corretos, identidade manual, bloqueio durante a requisição, evento sintético rejeitado, rascunhos, Enter/Shift+Enter, troca de contato enquanto envia, sucesso, resultado incerto sem retry e bloqueio preservado ao fechar/reabrir. Também passam as verificações herdadas de histórico, áudio/imagem, atualização, autenticação negada, XSS, layout lateral e lista sem previews.

51 verificações PASS do controlador R6, mantendo os gates anteriores e reconhecendo somente a cadeia de hashes explicitamente aprovada. Contrato novo fixa o commit, 174 testes, envio exclusivamente manual, endpoint existente e zero retries. Gate real pós-publicação PASS. Drop-in novo de 24 letras z: `/etc/systemd/system/vitalismen-postsale-full-v203.service.d/zzzzzzzzzzzzzzzzzzzzzzzz-ec-whatsapp-compose-v235.conf`. Somente daemon-reload; nenhuma execução forçada do pós-venda nem alteração de flags.

Validação pública em 2026-11-16T23:09:20Z: contato final 6269 identificado, campo visível e habilitado, botão habilitado após digitar “Hola”, novamente desabilitado ao apagar. Popup aberto, conversa principal intacta, zero previews proibidos. Zero envios reais nessa auditoria. Não se apresenta a simulação como prova de entrega física de mensagem desta nova interface. Screenshot privado fora do Git.

## Backup e rollback

Adendo de dez arquivos públicos e de controle sem segredos, em `C:/Users/Wolfe/Backups/VITALISMEN_EC/WHATSAPP_COMPOSE_V235/20261116`; hashes, leitura integral e UID/GID/modos conferidos. O backup global MongoDB continua FAIL pela limitação anterior de consistência.

Rollback pontual: verificar hash do backup anterior, restaurar atomicamente somente o alias HTML com UID/GID/modo registrados, remover somente o drop-in V235 de 24 letras z, daemon-reload e conferir o fallback R5 V234, hashes, PM2/cwd/health. Não restaurar dados vivos, apagar ledger ou repetir pedidos/mensagens. Não executar rollback completo do backend para desfazer este compositor.

Uso: Ctrl+F5, Chat do site, buscar contato, selecionar resultado WhatsApp, digitar no campo abaixo das mensagens e clicar Enviar.

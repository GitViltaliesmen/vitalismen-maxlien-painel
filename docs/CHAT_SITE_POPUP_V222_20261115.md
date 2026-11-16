PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Chat do site no dashboard — popup V222

## Onde acessar e comportamento

No painel oficial https://ec.maxlien.shop/qr.html?v=20261112-v206, o botão **Chat do site** fica na barra superior, ao lado de **Métricas**. O popup lista as conversas da página Vit Power e mostra o histórico selecionado. A atualização é manual, pelo botão Atualizar. Ele fecha por Fechar ou Esc, apagando o conteúdo privado do DOM e cancelando consultas pendentes.

Este popup é somente consulta para administrador autenticado. Não envia mensagens, cria pedidos, transfere identidade ou associa um visitante anônimo ao WhatsApp. Nome e cidade aparecem somente quando já informados voluntariamente no chat; os demais registros são identificados como visitantes. São exibidos até 40 mensagens por conversa, dentro da validade de 7 dias já existente. Os horários seguem o computador do operador. A lista principal do WhatsApp permanece separada e sem prévias de mensagens.

## Origem oficial e alteração

O HTML foi lido do alias realmente publicado: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`. SHA-256 anterior `f5102813bfbe6ec12d5fa299940d0170bf3e0d32ba73d7f602245a4adc76db75`; publicado `e61d4c6ce109f32a35256f16c03859051b3047cf5c7975279b0261e5048d000b`. Removendo apenas o botão e os blocos delimitados V222, recuperam-se integralmente os bytes anteriores. A publicação foi atômica, preservando propriedade, permissões e atributos, sem reiniciar Nginx. A configuração específica de `ec.maxlien.shop` recebeu duas rotas GET/HEAD para a consulta autenticada; `nginx -t` passou, a recarga foi graciosa e o PID do master foi preservado. Removendo exatamente essas adições, recuperam-se os bytes anteriores da configuração. Nenhum outro domínio ou rota foi alterado.

Backend pai: `025c90c7d5af299e206ee246341d2ec507d929ca`. Novo backend funcional: `5a8659683c3d0b91e006efd7241f5287bd8b39af`, release `/opt/vitalismen-automacao/releases/20261116T001622Z_production-20261116-5a86596`. A entrega completa, desde o pai original, contém somente 6 arquivos: leitor privado limitado, rota autenticada GET, duas linhas de registro no index, teste do leitor e dois adaptadores de boot apontando ao sucessor selado exato.

A rota `/api/web-chat-admin/vitpower` exige Bearer explícito, JWT válido, usuário ativo e papel admin, inclusive em loopback. Não herda o acesso sem senha. As respostas têm `private, no-store`. A lista não inclui texto das mensagens. A leitura permite somente IDs hexadecimais de 64 caracteres, até 100 arquivos regulares, 128 KiB por arquivo, rejeita symlinks, ignora registros expirados e retorna apenas campos permitidos. Não são expostos cookies, tokens de sessão, requests, digests, IP ou User-Agent. Conteúdo é renderizado com textContent.

## Preservado

Todos os demais arquivos rastreados foram comparados byte a byte com o pai. Não foram alterados VSL/CTA/Turbo, apresentação V221, agentes/prompt/memória, catálogo, B01/cadência, transporte Z-API, recompra, agendamento, Dropi, dados de clientes, Pixel/CAPI ou configuração de destinos. O leitor aponta para a subpasta `sessions` utilizada pelo gravador oficial do chat; um teste de integração grava uma sessão descartável com esse gravador e prova que o leitor recupera as duas mensagens. O perfil completo e os horários de ativação das capabilities anteriores foram herdados e conferidos. O atendimento web continua PUBLIC_SITE usando a prova QA R4 inalterada; não foi reenviado evento ou convite de WhatsApp.

## Validação executada

- ['# tests 218', '# pass 218', '# fail 0']: testes focados do leitor, chat web, fluxo livre, B01, autenticação, inbound e mensuração.
- `npm run senior:check` completo: PASS. Guard de produto e guard principal: PASS.
- Integridade negativa: adulteração do leitor/boot recusada; flags legadas proibidas recusadas; startup isolado e senior do legado somente leitura: PASS.
- HTTP da aplicação real em namespaces de rede/mount e MongoDB descartável em tmpfs: 21 verificações PASS; acesso anônimo 401, token inválido 401, operador não admin 403, admin 200, isolamento de cookies, leitura sem alteração e ausência de pedidos/mensagens/eventos.
- Navegador com HTML completo e rede interceptada: 32 verificações PASS em desktop e 375 px; abertura, troca de histórico, resposta atrasada, conteúdo HTML inerte, fechamento, erro de permissão sem logout, lista vazia e preservação da lista do WhatsApp. Sem erro JavaScript.
- Interface pública autenticada: popup aberto em navegador separado, 3 conversas listadas e a pergunta técnica com a resposta da Ana Lopez visíveis. Captura local `popup-publicado.jpg`; a aba permanece disponível como entrega.
- Produção: HTTP público 200 com hash exato, API autenticada 200, health online, Z-API conectada, PM2 cwd/exec e /proc/PID/cwd no release ativo; timer pós-venda preservado. Conversas disponíveis na leitura: 3; detalhe real conferido: True. Nenhum texto privado foi incluído neste relatório.

A primeira prova pública revelou que a consulta inicial apontava ao diretório pai, enquanto o gravador usa `sessions`. Esse caminho foi corrigido no sucessor final, com teste do gravador real, HTTP isolado e leitura da conversa técnica retida. Os resultados das tentativas anteriores foram preservados; a auditoria final se refere ao commit funcional final. A pergunta técnica de preço foi enviada uma vez, o retry com o mesmo ID foi deduplicado, e a resposta foi USD 95.99 para 3 frascos. Não foi criado pedido, contato WhatsApp ou evento Meta. O registro web de QA fica disponível para conferência por até 7 dias.

## Backup e rollback

Backup do HTML antes da publicação: `/opt/vitalismen-automacao/backups/ec-web-dashboard-v222-r2-20261115/panel-before.html`. Cópia opaca mínima de painel/boot/configuração e configuração do processo: `C:\Users\Wolfe\Backups\VITALISMEN_EC\DASHBOARD_WEB_CHAT_V222\20261115-r1`. Recuperação conferida em RAM, SHA-256 e metadados validados e adulteração rejeitada; nenhum segredo entrou no Git. O release pai permanece disponível. O manifesto e ROLLBACK.txt ficam nesse diretório de evidências.

Rollback documentado: restaurar atomicamente somente o HTML anterior e, sob locks, reverter os controladores R3 e R2 em ordem ao release/perfil R4, removendo apenas os overrides de pós-venda V222. Reverter também somente os dois blocos de rotas V222 do Nginx, verificar o SHA anterior e `nginx -t`, e recarregar graciosamente. O pacote NGINX_PRE_POPUP_V222 preserva a configuração anterior de forma opaca criptografada. Conferir hash público, PM2 real, health, Z-API e timer. Não restaurar banco sobre dados vivos nem repetir pedidos, mensagens ou eventos. Rollback não executado em produção.

O backup global MongoDB continua **FAIL**, por consistência do standalone, independente desta entrega reversível de código/configuração. Esta auditoria não declara backup global PASS, sincronização site–WhatsApp ou atendimento humano pelo popup.

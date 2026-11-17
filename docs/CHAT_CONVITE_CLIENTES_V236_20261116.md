# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

STATUS=PUBLICADO_E_AUTOMACAO_HABILITADA

## Onde o operador encontra o chat

O botão Chat do site abre o popup lateral não modal. As conversas iniciadas na página pública aparecem em Conversas do site, com nome informado ou identificação de visitante. A busca também encontra contatos WhatsApp já carregados, em seção separada. Um convite enviado não comprova que o cliente entrou na página. Nenhuma identificação de visitante anônimo é inventada e os históricos não são mesclados por semelhança de nome ou telefone.

Selecionar o cliente na lista principal mostra Convidar para o chat do site junto ao campo TELEFONE. O mesmo botão fica no compositor do popup WhatsApp. O botão consulta o registro anterior, prepara o texto personalizado para aquele telefone e abre o popup; o operador revisa e clica em Enviar. Não há envio apenas por selecionar um contato ou preparar o convite. Rascunhos e atendimento principal são preservados. Convite já registrado ou pendente bloqueia nova preparação. Falha de consulta bloqueia a ação até nova conferência.

## Convite e acesso público

Link: https://taviazen.shop/vitpower_2026g#chat

O link abre diretamente a conversa pública com Ana. O texto informa a possibilidade de esclarecer dúvidas sobre Vit Power, orienta solicitar código privado pelo WhatsApp para consultar um pedido e inclui STOP. Não há token de acesso no link. Estado de mi pedido mantém a confirmação da identidade e o código privado existente; convidar não concede acesso a dados de pedidos.

## Automação para clientes novos e antigos

A fila existente ganhou a etapa CHAT_ACCESS, única por telefone, sem exigir pedido ativo. Não foi criado outro scheduler ou transporte. O convite de consulta de pedido já existente mantém prioridade e histórico anterior de envio do link evita uma nova apresentação geral. Os convites do parceiro não tiveram texto, ordem ou intervalo de 12 horas alterados.

- Somente contatos EC válidos com entrada comprovada na sessão oficial. Contatos históricos sem essa evidência não são atribuídos automaticamente à sessão atual.
- Pelo menos dez minutos desde a última atividade de entrada ou saída para o convite geral; um convite por intervalo global mínimo de dez minutos, entre 08h e 19h no Equador.
- Avisos operacionais anteriores têm prioridade. Atendimento humano, pausa, STOP, bloqueios, QA 8637 e demais brasileiros, cancelamentos/devoluções e revisão manual continuam excluídos.
- A rotina consulta o histórico, reserva chave e lock, registra tentativa antes do transporte e usa claim único persistido. Resultado incerto não gera retry. O ledger permanece sem TTL e não é apagado por rollback.
- O botão manual usa o envio autenticado já existente; o envio automático usa a reserva e a cadência da fila existente. A seleção do destinatário é capturada antes de enviar.

## Publicação e fonte

Backend: `1583e5977ac1cdcf28503de5e4bac7e2e06f9542`, release `/opt/vitalismen-automacao/releases/20261116T234444Z_production-20261116-1583e59`. Sete caminhos alterados: dois boot refs, microcamada de convites, contexto da etapa nova, consulta administrativa somente leitura, rota administrativa e testes. Modelos de cliente/pedido/remessa, motor do bot, Z-API, Dropi, Meta/CAPI, preços e voz permanecem preservados.

Frontend: `3269066f1fe4500b058b4b2c3435d76265712d94`. Alias real `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html` em 72.60.137.77; asset `/var/www/vitalismen-vitpower-2026g/assets/chat-v220.js` em 169.58.51.100. VSL, CTA, CSS do site, mensuração e Nginx preservados.

PM2 efetivo: PID 3716680, cwd `/opt/vitalismen-automacao/current`, exec `/opt/vitalismen-automacao/current/src/index.js`. Ativação dirigida ao processo Vitalismen, com fila de entrada e respostas web ociosas. O estado aprovado e as datas herdadas foram conferidos. Timer existente aponta ao controlador V236 por drop-in próprio de 25 letras z; drop-ins e controladores anteriores foram mantidos.

## Auditoria e testes

- senior_guard: PASS; 22.8 s; 
- product_guard: PASS; 20.2 s; 
- focused_tests: PASS; 178.1 s; # tests 191, # pass 191, # fail 0
- complete_senior: PASS; 1681.8 s; # tests 43, # pass 43, # fail 0, # tests 482, # pass 482, # fail 0, # tests 22, # pass 22, # fail 0

Painel: 196 verificações PASS em desktop/mobile; página: 54 verificações PASS em três larguras. Compositor e convite simulados sem rede externa nem envios comerciais. Controlador: 32 verificações PASS, incluindo rollback bloqueado antes de restaurar a interface anterior. Comparação de 12 arquivos comerciais protegidos: mesmos bytes.

Adapter nativo: 27 verificações PASS com Mongo/Mongoose reais e Z-API contra stub privado; cinco chamadas ao provedor simulado, zero envios reais. Inclui reserva/claim/histórico da nova etapa, ausência de repetição e rota administrativa Express/JWT real: sem bearer 401, consulta autorizada 200, QA/estrangeiro 404, nenhuma chamada WhatsApp durante a consulta.

Validação pública pós-publicação: `2026-11-17T00:20:20.317Z`. As observações efetivas, sem envio a cliente de produção, estão no recibo POST_PUBLIC_BROWSER_TEST. Convites aceitos no ledger real na auditoria: 0; comprovação de um novo convite físico: PENDING — nenhuma entrega física nova é inferida da simulação. Intervalos reais: PENDING_AT_LEAST_TWO_ATTEMPTS. A fila respeita elegibilidade e horário; não foram liberados contatos humanos ou forçadas mensagens para fabricar um resultado.

A ferramenta do navegador não conseguiu concluir a abertura pública do site nesta auditoria (timeout de conexão). A página e o asset foram conferidos por HTTPS nas duas origens autorizadas: HTTP 200, hash exato do asset publicado e Cache-Control no-store. Os 54 testes isolados comprovam a lógica do link #chat. A abertura física desse link no navegador do cliente permanece uma observação pendente, não foi apresentada como PASS visual. Na preparação, os testes de interface detectaram um identificador duplicado no estilo, corrigido antes de publicar; outra falha era a tentativa do teste de clicar na ficha encoberta pelo popup, corrigida no roteiro fechando o popup antes da ação. Os resultados PASS referem-se à versão e ao roteiro finais.

O primeiro ciclo natural desta versão retornou `PASS_DEFERRED_OUTSIDE_EC_WINDOW`, com 0 saídas físicas. O coletor herdado inicialmente esperava apenas PASS_BATCH; a conferência foi ajustada para reconhecer explicitamente PASS_DEFERRED_OUTSIDE_EC_WINDOW e exigir zero saídas nesse caso, sem alterar o executor nem forçar envio.

## Recuperação, congelamento e rollback

Backups criptografados antes/depois em `C:\Users\Wolfe\Backups\VITALISMEN_EC\CHAT_ACCESS_V236\20261116`. Descriptografia em memória, hashes, UID/GID/modos e rejeição de adulteração: PASS. Ledger compartilhado de convites capturado isoladamente sob o flock do escritor existente, com BSON EJSON canônico, índices e memória antirrepetição preservados. Sem restauração em produção, migração, pausa global ou envio de chave de recuperação ao servidor.

STATUS_BACKUP_GLOBAL=FAIL — limitação de consistência do MongoDB standalone anterior permanece. O PASS de recuperação de código/configuração e da coleção restrita não representa backup completo dos bancos.

Rollback: suspender somente os convites pelo controlador V236, preservando ledger. Restaurar atomicamente os dois assets públicos anteriores com metadados e hashes dos recibos de backup; o controlador exige o hash antigo do painel antes de voltar o backend. Executar rollback de código pelo controlador V236: remove somente o próprio drop-in de 25 letras z, retorna ao release pai V232 e ao controlador anterior R6/24 letras z e confere PM2/health. Nunca restaurar memória antiga de envio sobre dados vivos, apagar ledger ou repetir pedidos, mensagens ou eventos.

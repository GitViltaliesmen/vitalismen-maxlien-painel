# EC V273 — aviso de conexão e estudo de canal estável

## Estado verificado

Após a leitura do QR V272, `/api/whatsapp/sessions` e `/api/whatsapp/status` retornaram `connected`, `isReady=true`, sem QR pendente. O PM2 `vitalismen-automation` permaneceu online no release V271 e a API de saúde respondeu HTTP 200. O ID técnico da sessão continua baseado no telefone configurado, enquanto `ownPhoneDigits` indica o telefone efetivamente vinculado. Os dois valores não são idênticos.

## Aviso V273 publicado

A página do painel agora consulta o status da sessão vinculada a cada 15 segundos quando o operador está fora da aba Conexões; nessa aba a consulta já ocorre a cada 5 segundos. Duas leituras consecutivas sem conexão mostram uma faixa vermelha clicável para abrir Conexões. Uma leitura isolada não aciona o aviso. A faixa desaparece quando a sessão volta. Falha de consulta é descrita como estado não verificável, sem afirmar que o WhatsApp caiu. Quando a mesma aba já viu a sessão conectada, a primeira queda confirmada também gera um aviso no painel e uma notificação do navegador se essa permissão já tiver sido concedida.

O aviso funciona enquanto o painel estiver aberto; não é um monitor externo nem envia mensagem quando a conexão cai.

Para cobrir o painel fechado, foi criada no Codex a automação `monitorar-conex-o-whatsapp-vitalismen-ec`, ativa a cada 15 minutos. Ela lê somente `/api/health/`, exige duas verificações consecutivas antes de avisar sobre queda ou falha de acesso e avisa também na recuperação. A URL pública respondeu HTTP 200 com `whatsapp.ready=true`, `state=connected` e uma sessão conectada na criação. Esse monitor não faz teste de entrega de mensagem.

- Página anterior: `/var/www/vitalismen-panel-qr-v272-r1/qr.html`, SHA-256 `1cd09d09a87283a161bd14deb592db1dfe542679a1c40f0a88583df72c0cc6e3`.
- Backup anterior e da configuração Nginx: `/opt/vitalismen-automacao/backups/ec-connection-warning-v273-20261126T011154Z/`.
- Página atual: `/var/www/vitalismen-panel-qr-v273-r1/qr.html`, SHA-256 `6ff275245f1f205061b61585bc7aacff846cb1294e48bd3993819fc46ac1eee9`.
- A URL pública `/qr.html?v=20261112-v206` retornou a mesma página. `nginx -t` passou. Nenhuma alteração no runtime, VSL, funis, pedidos, Meta, Dropi ou transporte.

## Por que o QR não pode ser universal

O QR de Aparelhos conectados é emitido para parear **uma conta WhatsApp específica** e expira; o sistema não pode manter um código permanente que conecte qualquer conta. A documentação oficial do WhatsApp Business descreve o pareamento por QR e a necessidade de usar o telefone principal para autorizá-lo. Se o número comercial mudar, o destino da CTA e a identidade do emissor também precisam ser conferidos. A troca de número na própria conta WhatsApp tem efeitos sobre o histórico e o backup do aplicativo; a base do painel deve manter sua própria trilha independente.

Referências: [pareamento de aparelho no WhatsApp Business](https://faq.whatsapp.com/878854700132604/) e [efeitos da troca de número](https://faq.whatsapp.com/1166321223998129).

## Arquitetura proposta para não refazer o bot a cada troca

1. Criar um `channelId` estável, por exemplo `EC_PRIMARY`, separado de `accountPhoneDigits`, `sessionId`, diretório de autenticação e número de destino da CTA. Um pareamento novo troca a conta ligada ao canal; não reescreve IDs de mensagens ou pedidos anteriores.
2. Registrar gerações imutáveis do canal: número efetivamente lido do dispositivo, início/fim, motivo da troca, estado de verificação e recibos de teste. Guardar credenciais de cada geração fora dos releases, com backup cifrado e acesso restrito. Nunca reutilizar a autenticação de uma conta em outra.
3. Substituir, por sucessor selado, a lista fixa de telefones de `src/services/ecBotCoreRuntimeIntegrationV78Service.js` por uma autorização da geração ativa. Revisar também `src/whatsapp/connection.js`, `src/services/sellerRotationService.js`, `src/routes/leads.js`, roteamento manual e guardas de número. Impedir dois emissores ativos para o mesmo canal.
4. Manter o histórico por contato e pedido no banco do painel, incluindo o `sessionId`/número emissor original (`src/models/Message.js` e `src/models/ContactState.js`). A tela pode consultar gerações antigas; respostas novas só usam a geração ativa e não são reenviadas automaticamente.
5. Para trocar de número: registrar nova conta, gerar QR novo, verificar `ownPhoneDigits`, testar inbound e uma resposta com QA, conferir persistência e ausência de duplicidade; só então alterar o destino público da CTA **em mudança separada e explicitamente autorizada**. Arquivar a geração anterior para leitura e rollback, sem disparar mensagens pendentes por ela.

Esta migração de canal ainda **não foi implementada**. Alterar agora apenas `WHATSAPP_DEFAULT_SESSION_ID` deixaria regras de autorização, vendedor e CTA fora de sincronia. O aviso V273 não altera esses vínculos.

## Testes e rollback

`tests/panel-linked-connection-warning-v273.browser.test.mjs` passou na fonte e na cópia publicada: estado conectado, uma falha isolada, duas falhas, recuperação e estado não verificável. O teste do QR V272 voltou a passar nas duas. O guard geral `senior:check` do release V271 continua falhando na herança de `.github/workflows/ec-panel-quality.yml`, sem relação com esta página estática.

Para rollback visual, restaurar o arquivo de Nginx do backup após `nginx -t` e recarregar Nginx. O runtime V271 permanece no mesmo release.

PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Entrada simplificada Vit Power V240 — 17/11/2026

## Problema e comportamento publicado

O formulário tinha título perguntando o nome, colocava o nome primeiro e exigia o telefone depois. Isso tornava o dado obrigatório pouco claro. A versão publicada começa com o WhatsApp, com foco nesse campo e explicação direta. O nome continua opcional, dentro de `Añadir mi nombre (opcional)`. Um único campo obrigatório e um único botão de continuação. Não é necessário preencher o nome para abrir o WhatsApp.

No endereço de QA `https://taviazen.shop/vitpower_2026g?vp_qa=1&v=240`, há um botão imediato `Probar atención por WhatsApp` fora do player. Esse caminho segue direto para a conversa oficial com a mensagem padrão, sem formulário ou digitação de telefone/nome. Não envia a mensagem sozinho: o usuário revisa e toca Enviar no WhatsApp. O parâmetro QA continua excluído da mensuração.

O atalho antecipado existe somente com `vp_qa=1`. A configuração do player, o momento do botão público, a abertura do chat após 50% assistido e o botão original WhatsApp não foram modificados. O formulário do botão combinado continua inline, abaixo do vídeo, e a VSL permanece na aba original.

## Atribuição e escopo

O telefone continua sendo o único dado obrigatório para clientes EC no formulário normal porque o contrato publicado usa esse número para vincular a visita ao atendimento e ao pedido. Remover esse vínculo sem substituição diminuiria a atribuição. O backend obtém o telefone real do remetente no WhatsApp; os dois dados devem corresponder. Não foi prometida identificação automática do visitante antes de ele informar esse vínculo.

Normalização de números EC, destino WhatsApp, coleta de UTMs/fbclid/fbp/fbc, IDs de evento, Pixel escolhido, consentimento, captura protegida de contato e prazos de captura permanecem com a implementação anterior. Nome opcional fica no texto que o usuário revisa; telefone não é acrescentado à mensagem nem aos parâmetros do Pixel. QA não gera tráfego Meta/CAPI nem pedido/Dropi.

Somente `assets/cta.js` e a versão do URL desse script em `index.html`/`desktop.html` foram publicados. A versão do URL evita reutilizar o script antigo no cache. Código do bot, painel, preços, bancos, Z-API, Dropi, CAPI e arquivos do chat/acesso privado permanecem nos mesmos bytes. Nenhum restart ou ajuste Nginx.

## Origem, fonte e recuperação

- Origem oficial lida e copiada antes da edição: `169.58.51.100:/var/www/vitalismen-vitpower-2026g`.
- Commit da página: `63b45f94892708f581feb7f5f20576d02b0a39e5`; tag `site-vitpower-simple-entry-v240-20261117`, branch `codex/vitpower-simple-entry-v240-20261117`.
- Backend atual preservado: `cf79efded4cc5242800946728d589a186cfa349f`, PM2 PID 3765163, diretório real do processo e caminhos PM2 conferidos.
- Backup público restaurável: `/var/backups/vitalismen-ec/site-simple-entry-v240-20261117/site-before.tar.gz`; SHA-256 `92fb915e92143f5a85543bf3cbe182ce7a19a88e52d119ca41fed2c5e6c0affb`.
- Cópia local e evidências: `C:\Users\Wolfe\Backups\VITALISMEN_EC\SITE_SIMPLE_ENTRY_V240\20261117`.

## Validações reais e simuladas

16 casos DOM com o código de produção PASS: QA direto sem formulário/Meta; ramo combinado; foco no telefone e nome opcional recolhido; três formatos EC; vazio, Brasil e números inválidos recusados no fluxo público; mensagem padrão; nome opcional; telefone fora dos parâmetros Pixel; atribuição preservada; cancelamento; consentimento recusado; escopo e blocos de mensuração preservados. Sintaxe e cópia versionada dos mesmos 16 testes: PASS. Backup lido e todos os conteúdos, UID/GID/modos conferidos: PASS.

HTTPS público: JS novo HTTP200 e SHA correto; arquivos do chat/acesso preservados por SHA; HTML desktop e mobile com script versionado; player presente na variante mobile. Painel e PID do backend inalterados, serviço online e Z-API conectada.

Navegador: atalho QA publicado visível e encaminhamento sem formulário para Ana Lopez confirmado. Formulário normal verificado visualmente em fixture local a 390×844, com consentimento de marketing desativado e somente guard de host/caminho adaptado para localhost: um campo obrigatório, nome opcional recolhido, foco no telefone, largura correta, posição abaixo do vídeo, não modal no botão combinado, Brasil recusado e continuação com número EC sem nome em nova aba WhatsApp. Isso é simulação visual de navegador, não teste físico de celular nem envio real. Nenhum envio WhatsApp foi disparado pela automação do navegador.

O teste QA anterior comprovado recebeu entrada às 13:38:26 UTC e resposta de bot entregue às 13:39:32 UTC, aproximadamente 65,7 segundos. Outra entrada ocorreu às 13:57:22 UTC fora de janela e foi preservada sem replay. A janela 2 não registrou nova entrada durante sua vigência e foi contida após expirar; não foi apresentada como prova de resposta nova. Nova interação após a V240 permanece pendente. Histórico e antirrepetição do QA são preservados; apresentações antigas não são repetidas para simular um contato novo.

## Rollback

Não executado. Conferir primeiro ausência de publicação concorrente e os hashes V240; recuperar do tar somente os três arquivos alterados com UID/GID/modos/ACLs/xattrs em caminhos temporários e substituir atomicamente. Validar HTML desktop/mobile, JS e destino oficial. Não restaurar bancos, não reiniciar o backend, não reenviar mensagens. Arquivos públicos não contêm segredos; backup da página não equivale a backup global MongoDB, que continua FAIL.

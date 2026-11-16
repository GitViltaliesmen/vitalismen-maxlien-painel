PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Popup do cliente no site — V223

O cliente acessa https://taviazen.shop/vitpower_2026g e toca em **Hablar con Ana**, no canto inferior direito. O botão fica disponível desde a entrada na página. O clique abre o popup na própria página; não exige login. A apresentação permanece **Ana Lopez — Atención Vitalismen · Ecuador**, com a informação sobre respostas com IA preservada. O popup abre por escolha do visitante e mantém a conversa ao fechar e reabrir.

O operador acompanha essas mensagens no dashboard, pelo botão **Chat do site**, ao lado de Métricas. O popup do dashboard continua somente consulta autenticada. O teste público confirmou que a nova pergunta e sua resposta estão visíveis nessa consulta.

## Alteração e preservação

Alterado somente `/var/www/vitalismen-vitpower-2026g/assets/chat-v220.js`, na origem 169.58.51.100, após leitura da fonte publicada e conferência dos cinco arquivos de baseline. O launcher antes dependia da visibilidade da CTA da oferta. Agora está disponível na entrada; o botão de continuação ao checkout/WhatsApp mantém a condição original da oferta. Enquanto a CTA está oculta, a continuação do popup fica oculta, sem href e sem o atributo reconhecido pelo formulário; uma captura específica bloqueia clique prematuro inclusive em corrida com o observer. A abertura do chat não fecha nem manipula o player.

VSL mobile e página desktop, player `69f206413ea7d424b034658c`, CTA em 2280s/Turbo 1.2, `assets/cta.js`, CSS, formulário de nome, preços, WhatsApp, atribuição e backend permanecem com os mesmos bytes/configurações. Nenhum serviço foi reiniciado ou recarregado. O backend continua `5a8659683c3d0b91e006efd7241f5287bd8b39af`, PID 3581454, online. O painel continua SHA `e61d4c6ce109f32a35256f16c03859051b3047cf5c7975279b0261e5048d000b`.

SHA-256 JS anterior `17ff7bbf4d567fd7be8634547afe646c76ceb60cd151ec00a265412dfa6dfa99`; publicado `3d9b272051df02007ac6c09d964477213d5db75a123a0c044079095a6e7a16c4`. Este hash substitui somente o baseline do asset JS do chat registrado na V221. Os registros anteriores permanecem históricos; não substitui o freeze do backend ou do dashboard V222.

## Auditoria

- `node --check`: PASS. Simulação com 71 verificações em larguras 375, 430 e 1280: PASS.
- Launcher antes da oferta, abrir/fechar/reabrir, envio único, conteúdo HTML inerte, preservação de histórico, erro sem retry automático, handoff condicionado à CTA e ausência de formulário antecipado: PASS.
- Percurso de checkout interceptado: um CtaClick e um Contact, eventIDs distintos e fbp/fbc/UTMs preservados; conteúdo do chat fora da mensuração. Nenhum envio físico ou evento real nesses testes simulados.
- HTTP público 200, hash exato e Cache-Control no-store: PASS.
- Navegador público: uma pergunta técnica enviada pelo popup e resposta `Precio: 3 frascos: USD 95.99.` recebida. Histórico anterior e abertura após fechamento preservados. A verificação usou `vp_qa=1`; nenhum evento Meta fictício, pedido ou mensagem WhatsApp foi gerado.
- Consulta autenticada do dashboard encontrou a nova pergunta e a resposta; conversa com 6 mensagens. Nenhum texto privado de cliente foi incluído na auditoria.

## Backup e rollback

Backup do arquivo com metadados: `/var/backups/vitalismen-ec/site-chat-popup-v223/20261116T005629Z/chat-v220.js`. Cópias locais do antes/depois, baselines e provas: `C:\Users\Wolfe\Backups\VITALISMEN_EC\SITE_CHAT_POPUP_V223\20261116T005629Z`. A substituição foi atômica, com UID/GID/modos preservados. Para rollback, conferir que o asset ativo possui o SHA publicado acima, restaurar somente o JS anterior com seus metadados e validar hash público e interface. Não alterar HTML, player, CTA, rotas, serviços ou dados. Rollback não executado.

Esta entrega não modifica nem resolve o backup global MongoDB, que permanece FAIL por consistência do standalone. A validação descrita aqui cobre a alteração estática e seu percurso de interface.

PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# Apresentação do chat V221 — alteração publicada

Pedido explícito do operador: remover “assistente virtual” da apresentação do chat da página Vit Power. Alteradas somente duas strings do arquivo oficial `/var/www/vitalismen-vitpower-2026g/assets/chat-v220.js`, lido diretamente da origem 169.58.51.100 antes do patch.

Cabeçalho: **Atención Vitalismen · Ecuador**. Saudação: **¡Hola! Te doy la bienvenida a Vitalismen Ecuador. Puedo ayudarte con la información oficial de Vit Power y responder tus dudas. ¿Qué deseas saber?**

A identificação Ana Lopez e a informação discreta “Respuestas con IA a partir de información oficial” permanecem. A nova saudação não afirma que o atendimento automático é uma pessoa real.

O restante dos bytes foi preservado. Não foram alterados backend/prompt da IA, VSL, timing, CTA, catálogo, cadência, memória, WhatsApp, pedidos, Dropi, Pixel/CAPI, Nginx ou HTML. Nenhum serviço foi reiniciado. O release backend continua no commit `025c90c7d5af299e206ee246341d2ec507d929ca`.

Fonte do texto publicada no Git: `2a5b5aa10304ae731fd784a65bd91978490179b6`. SHA-256 anterior `6ec67467e041311cb9acf83f3a68bb4b987c82ab4097916ca856a602591acc36`; atual `17ff7bbf4d567fd7be8634547afe646c76ceb60cd151ec00a265412dfa6dfa99`. Este hash atual substitui apenas o baseline do asset público `chat-v220.js` registrado na auditoria V220; os registros históricos são preservados.

Validação: `node --check` PASS; HTTP público 200, hash exato e Cache-Control no-store; cabeçalho e saudação conferidos no navegador. Nenhuma chamada ao modelo ou mensagem WhatsApp foi usada para testar esta alteração de texto.

Backup com metadados: `/var/backups/vitalismen-ec/chat-copy-v221/20261115T232709Z/chat-v220.js`; cópia local e evidências em `C:\Users\Wolfe\Backups\VITALISMEN_EC\CHAT_COPY_V221\20261115T232709Z`. Rollback disponível mediante conferência de hash: restaurar somente esse arquivo ao conteúdo anterior, com UID/GID/modo e timestamp registrados no manifesto. Não executado em produção.

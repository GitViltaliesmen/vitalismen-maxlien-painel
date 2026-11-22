# Candidata V258 — referência curta Tex

Escopo: `https://plusmen.shop/tex` e o vínculo prospectivo com o inbound oficial do Vitalismen EC. **Candidata local; não publicada.** A V245 retirou deliberadamente a referência longa. O operador aprovou uma referência visível curta ao fim da mensagem pré-preenchida. A frase inicial, o número de destino e o clique que gera `InitiateCheckout` V256 permanecem.

Mensagem proposta: `Hola, quiero el tratamiento Tex Ultra.` seguida de `Vi Tex Ultra en el video y deseo el tratamiento.` e `Ref: VID-XXXXXXXX`. O código de oito caracteres é aleatório por visita de aba; o servidor guarda a ligação com a referência interna V243. Se a emissão ou o consentimento falhar, a CTA abre o WhatsApp com a frase original, sem inventar vínculo.

No inbound, somente a mensagem exata e persistida pela Z-API pode ser resolvida. A resolução usa a rota privada já existente e assinatura HMAC; depois, o vínculo V243 e o Purchase obedecem às regras anteriores. Não há reenvio de compras históricas, conversão sintética, pedido novo ou alteração de preço.

## Evidência e gates

- Preimagens dos três arquivos da origem oficial conferidas por SHA-256 em 22/11/2026; valores no manifesto `docs/freeze/tex-reference-v258-candidate-20261122.json`.
- `node ops/publications/tex-reference-v258/tests.mjs`: simulação de alias, resolução assinada, navegador, mensagem e fallback WhatsApp.
- `node --test tests/tex-measurement-v243.test.mjs tests/tex-measurement-short-code-v258.test.mjs` em Linux: 11 testes passaram.
- Testes V257 de confirmação e separação por site: 3 passaram.
- `npm run senior:check` local não executa porque falta o módulo selado `/usr/local/lib/vitalismen-deploy/gira21x-sealed-successor-v1.mjs`; não equivale a aprovação do release.
- Leitura da conta Meta Tex requer `ads_read` válido. Sem isso, aceitar CAPI não prova atribuição por anúncio.

Antes de ativar: registrar sucessor selado para a origem e o bot EC, verificar o guard de freeze, executar teste autenticado da rota de resolução e do dashboard, fazer backup e validar preimagens imediatamente antes da troca. O backend Plusmen carrega o módulo no processo PM2 `cloaker`; uma alteração no arquivo sem ativação coordenada deixaria o módulo antigo em memória. A publicação deve incluir reversão atômica e verificação pública dos assets. Não ativar a referência na página antes de o bot aceitar o formato novo.

Depois de ativar: usar somente o próximo clique e inbound reais para conferir os recibos `InitiateCheckout`, `Lead` e `Purchase` individualmente. Diferenciar enviado, aceito pela Meta e atribuído na conta de anúncios. Não criar compra ou WhatsApp fictício para fechar esse gate.

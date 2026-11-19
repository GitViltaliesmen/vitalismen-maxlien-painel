PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

Correção publicada de início de checkout antecipado — V250 — 18/11/2026, 22:42 São Paulo

URL: https://plusmen.shop/tex

Estado: retirada do evento antecipado publicada; sequência do convite/chat aguardando definição do operador.

O botão da VSL abria o WhatsApp depois de chamar initiateCheckout(). Foram retiradas as chamadas dos dois handlers públicos Tex. O módulo Meta exclusivo Tex agora recusa emitir InitiateCheckout nessa origem/rota e remove da fila local os InitiateCheckout antigos dessa rota antes de qualquer reenvio. PageView, ViewContent, mensuração de Lead/Purchase verificados e eventos de outras rotas conservam o comportamento anterior. Não foi criado um novo estágio de checkout nem disparado evento substituto no clique.

Três arquivos estáticos publicados, com troca atômica por arquivo, verificação de preimage e backup integral anterior. Falha intermediária restaura os arquivos já substituídos. Backup/controlador: /root/plusmen-tex-checkout-v250-20261118. Rollback: python3 -I -B -S /root/plusmen-tex-checkout-v250-20261118/deploy.py rollback. O controlador recusa mudança concorrente/sucessor e exige os hashes fixos do manifesto. Não executar rollback sem conferir o estado posterior.

Validação: 13 testes offline passaram, incluindo clique duplo, botão desabilitado/alheio, URI do aplicativo, fallback, fila antiga Tex, preservação de checkout em outra rota e consentimento negado. Todos os patches foram invertidos para os bytes oficiais inspecionados. Sintaxe JavaScript validada. Os três assets públicos responderam 200 com os hashes publicados e Cache-Control no-store. Guard Plusmen completo passou após publicação; o sucessor tem manifesto com SHA fixo e inverte exclusivamente os três deltas antes de executar as regras anteriores. Manifestos antigos permaneceram intactos.

A comparação inicial de HTML público contra os hashes do relatório anterior falhou. A inspeção mostrou o beacon Cloudflare injetado na resposta. A validação final comparou o documento móvel com o HTML de origem protegido mais a injeção de chat configurada, removendo somente o beacon e sua quebra de linha; o desktop foi comparado ao snapshot público feito antes da alteração nesta sessão. Nenhuma regra de dispositivo, proxy ou Cloudflare foi alterada.

Origem PM2 cloaker online, PID 1314328, /opt/cloaker/server.js. Backend Vitalismen online, PID 4086140, cwd/exec via current e cwd real no release 20261118T235313Z_production-20261118-a7f2c6c. Nenhum processo foi reiniciado. A primeira consulta PM2 via SentinelX sem sudo retornou a lista vazia do usuário do agente; a conferência do processo oficial foi feita depois como root.

Limites: isto não apaga eventos já recebidos pela Meta, não altera a otimização Comprar da campanha Cartaz, não comprova atribuição anúncio→lead dos quatro contatos e não cria um evento no estágio real de pedido. Abas abertas antes da publicação ainda podem executar o código antigo até recarregar; o endpoint de servidor legado não foi alterado nesta publicação. Não houve mensagem, lead, pedido, Dropi ou evento Meta sintético enviado em produção. Testes e requisições HTTPS de leitura não equivalem a observação de compra real.

Chat pendente: o pedido permite duas sequências diferentes: formulário no site → lead salvo → convite WhatsApp; ou mensagem recebida no WhatsApp → convite/chat liberado. Foi pedida essa distinção ao operador. O chat não foi alterado enquanto esse ponto está pendente. Não usar clique, retorno à aba ou tempo decorrido como prova de mensagem enviada.

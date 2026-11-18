PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# WhatsApp Tex Ultra sem referência visível — V245 — 17/11/2026

Exceção explícita posterior ao congelamento V244: retirar a linha Referencia:TX243-... da mensagem aberta pelo botão da VSL, conforme print e pedido do operador. A imagem fornecida é evidência do texto visível, não uma instrução para mudar produto, preço ou histórico daquela conversa.

Publicado em https://plusmen.shop/tex. Mensagem preparada: `Hola, quiero el tratamiento Tex Ultra.`; mesmo destino nativo553171862958. Apenas `/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js` mudou em produção. O conteúdo agora é exatamente igual, por bytes, ao handler nativo congelado `/var/www/plusmen-tex-vsl-v1/assets/whatsapp.js`, que permanece intacto. Fonte72c6ab9c0e66e52bb79540ad2cbe7e18af8b6c96.

## Preservado

Player, vídeo, CTA/timing/Turbo, abertura do aplicativo, alternativa wa.me em1.5s, proteção de duplo clique e chamada existente de InitiateCheckout. Chat permanece oculto até a liberação da CTA WhatsApp; funil, voz, primeiro nome, vínculo confirmado do chat, telefone, memória, pedidos, transportes, backend e desktop mantêm seus arquivos/configuração. Vinte e oito arquivos protegidos conservaram os hashes. Nenhum restart, mensagem ou evento Meta de teste foi provocado.

## Consequência de mensuração informada antes da alteração

O texto TX243 transportava a referência da visita para o inbound oficial. Novas entradas diretas pelo WhatsApp deixam de carregar essa referência; essa forma de atribuição automática de Lead/Purchase à visita/anúncio fica limitada nesse caminho. Não se criou alternativa por IP, nome, horário ou clique, nem evento sem prova. Browser PageView/ViewContent/InitiateCheckout e o fluxo de chat confirmado conservam suas implementações. Referências já confirmadas, histórico e dedupe existentes ficam preservados; não há reenvio de conversões. Códigos de confirmação do vínculo do chat não fazem parte desta alteração pontual da linha Referencia do botão direto.

O ajuste não edita mensagens enviadas, nem apaga histórico. Uma VSL já aberta precisa ser recarregada para usar o arquivo novo; a referência real de script mantém o endereço `/tex-assets/whatsapp-tex-v243.js?v=20261117-v243`, servido com Cache-Control:no-store.

## Validação

14 verificações executaram o handler real em VM com navegação, temporizadores e métrica simulados: reprodução do sufixo anterior, mensagem limpa no aplicativo, mesmo telefone, ausência de leitura da referência, métrica e atributos, duplo clique, fallback temporizado, erro ao abrir app, cancelamento ao ocultar a página, CTA desabilitada, clique alheio, alvo fora de shadow DOM, host/rota diferentes, erro de métrica e equivalência completa ao handler nativo. A primeira execução falhou porque a fixture closest() devolvia um elemento sem comparar o seletor; somente o mock foi corrigido, com ocorrência preservada. Não se abriu o aplicativo real nem se enviou mensagem.

Guard completo aprovado antes, com candidato em mount privado e após publicação. O teste negativo recusou telefone adulterado mesmo com hash forjado. Novo sucessor exige patches fixos e o conteúdo nativo exato, reconstruindo os deltas V243 antes das verificações originais. Todos os manifestos anteriores permanecem imutáveis. Oito combinações públicas de dispositivo/rota mantiveram o mesmo HTML; o asset público confere com o código testado, sem Referencia/TX243 e com no-store.

## Fonte e recuperação

Manifesto `docs/freeze/plusmen-tex-whatsapp-clean-v245-20261117.json`. Fonte e testes `ops/publications/tex-whatsapp-clean-v245/`. Backup oficial anterior `/root/plusmen-tex-whatsapp-clean-v245-20261117/before.js`, SHA25686278207e6135ccf65a45f172457c88f551ce352ec44b4cd771c26ef23355fb3. Recibo, baseline e QA na mesma pasta. Novo handler SHA256de67f978c52f7676d666bb22f2175cf72baa283f13fa47f7424d3a5262c35fcd. Backup de código público, sem alegação de backup global MongoDB.

Rollback exige conferir alterações posteriores e autorização para reintroduzir a referência: restaurar atomicamente apenas o asset versionado com dono root:root/mode0644 e usar o guard correspondente ao baseline anterior, preservando o manifesto V245 como histórico. Guard anterior em parent5ff31a0adbdcb62eebaa6c365a6f178ef4702faf e no snapshot local ops/candidates/tex-whatsapp-clean-v245-20261117/guard.before-v245.mjs. Conservar VSL, chat, código nativo, backend e dados. Não reintroduzir a referência automaticamente para recuperar métricas.

Evidência: docs/evidence/tex-ultra-whatsapp-clean-v245-20261117.json. O congelamento V244 permanece vigente para todos os demais pontos, com esta exceção V245 explícita e versionada.

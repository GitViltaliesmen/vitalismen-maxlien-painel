PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

# CTA WhatsApp e estado QA no painel — V248

Pedido explícito de 18/11/2026: simplificar o botão WhatsApp da rota Plusmen /tex, corrigir a indicação antiga do telefone de teste, auditar, simular, publicar e congelar. Escopo: dois arquivos públicos, sem backend, dados, env, player/VTurb ou transporte.

## Fontes oficiais e alteração

- Origem 169.58.51.100: `/var/www/plusmen-tex-vsl-v1/assets/whatsapp-tex-v243.js`. Acrescentado `cta-label.js` depois do handler nativo, que permanece idêntico por bytes. CTA passa a exibir **PEDIR TEX ULTRA POR WHATSAPP**, verde e legível no celular. Atua no mesmo BUTTON/preco_89, inclusive em shadow root aberto; não cria segundo botão nem muda disabled/display/timing. Mantém mensagem limpa, telefone e fallback aprovados. Nenhuma promessa de resultado de saúde ou prazo foi acrescentada.
- Painel em 72.60.137.77: `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`, confirmado no Nginx. Não usar o public/qr.html do backend como fonte deste arquivo estático. Quatro substituições exatas inserem o helper QA, alteram o badge, o estado vazio e disparam leitura periódica restrita ao QA exato.
- QA 5515998038637: rodada reiniciada em 18/11 18:26 UTC; autorização armed expirou em 18:50 UTC, sem novas entradas da rodada. O registro antigo encontrado pertence a outra sessão/owner e não foi importado para a sessão oficial. Corrigida a apresentação enganosa de BOT ONLINE para teste sem janela ativa; não foi inventada conversa, restaurado histórico antigo ou rearmado permit.
- Nenhum número brasileiro novo admitido, nenhum reset/lock removido, nenhum envio real e nenhuma autorização de teste ampliada. Históricos/ledgers, sessão oficial, escolhas atuais, dados e demais produtos permanecem preservados.

`build.py` só lê preimages inspecionadas, constrói o candidato e grava manifesto com deltas exatos. Os snapshots em ops/candidates são locais e não são a fonte de produção. `deploy.py` tem caminhos e hashes fixos; valida metadata e inversão, faz backup recuperável e substituição atômica com fsync e compare-and-swap. Não aceita mudanças concorrentes nem repete automaticamente publicação incerta. `preview.mjs` é loopback, fictício, sem rede externa; não é imagem de um cliente real.

## Validação

`node --test tests/tex-cta-qa-panel-v248.test.mjs`: 24/24 PASS, zero skips. Abrange CTA real com handler nativo, aplicativo/fallback, clique repetido, saída da página, não-CTA, host/rota diferentes, hidden/disabled, shadow root, ausência de envio por observadores, estado QA ativo/expirado/inválido, indisponibilidade, identidade exata, corrida de troca de contato, TTL e preservação dos clientes normais. Compila todos os scripts inline executáveis do HTML completo e inverte o patch para o SHA oficial anterior. Testa o setAttendancePulse real do HTML e prioridade de humano/bot global desligado. Testes negativos rejeitam telefone/hash forjados, addon adulterado e patch ampliado.

Primeira execução: 20/22, dois FAILs de fixture (closest devolvia alvo alheio sem verificar seletor; contagem mínima arbitrária de scripts). Corrigidos os mocks/assertiva de contagem com comparação ao HTML original, preservando as verificações. Nenhum transporte de produção foi alterado para fazer o teste passar. A primeira tentativa de aplicar o patch do guard falhou por contexto de linha; nada foi parcialmente aplicado, e o patch exato foi reaplicado.

Guard anterior mantido; V248 acrescenta somente inversão do sufixo de SHA fixo antes da validação V245 original. Manifestos antigos, prefixo nativo, seis arquivos do baseline, player, telefone, chat/CTA e demais guardas permanecem normativos. O novo guard verifica ambos os arquivos, inversão de todo HTML, metadata de origem e herança. Nenhum hash antigo foi substituído.

Pré-publicação: guard Plusmen PASS; guard candidato PASS; controladores audit origin e audit panel confirmaram hashes atuais iguais aos preimages. Simulação de navegador: janela encerrada, ativa, cliente normal e clique sem sair do ambiente; layout de 390 px conferido, viewport restaurado, servidor local encerrado. Capturas em docs/evidence/tex-cta-qa-v248-simulacao-{desktop,mobile}-20261118.jpg. Zero mensagens, leads, anúncios, pedidos ou eventos Meta sintéticos de produção.

O senior local foi tentado na sessão e não concluiu por mongoose ausente no checkout; não há alegação de PASS da suíte backend nesta publicação estática. Não há novo pacote/dependência ou alteração de backend. A reversão exata comprova que toda lógica de painel fora dos quatro pontos é preservada. A execução física no celular e eventual aumento de conversão não são comprovados por simulação.

### Revisão final R2

A interface publicada foi aberta na sessão administrativa existente e o QA exato selecionado, sem enviar mensagens. A lista lateral tinha zero `.chat-preview .meta`; o badge e estado vazio mostraram corretamente janela encerrada. A seleção pode atualizar o marcador de leitura do QA; não se afirma que esse metadado de leitura permaneceu idêntico.

A conferência adicional da tela Controle do Bot não encontrou ação de abrir janela QA. A instrução inicial que apontava para essa tela foi removida antes do congelamento final, para não direcionar o operador a um comando inexistente. O texto final é: **A janela anterior terminou. Uma nova mensagem de teste precisa de uma janela autorizada ativa.** Os 24 testes e a prova de inversão foram repetidos para esse ajuste; a negativa agora também rejeita o texto incorreto. R1, backups e evidências anteriores permanecem disponíveis no commit 4b620170d476944da30aa523df06d07aaa82fd83 e nas pastas de publicação. `refine panel` admite exclusivamente o SHA R1 publicado e conserva preimage próprio; não reescreve o backup original. A CTA e o backend não mudam no R2.

## Publicação, guard e rollback

Artefatos/backup na origem: `/root/tex-cta-qa-panel-v248-20261118`; painel: `/opt/vitalismen-automacao/backups/tex-cta-qa-panel-v248-20261118`. Cada controlador gera comprovantes audit/apply e `before-apply.private` root0600 em pasta root0700, com comparação completa antes da troca. São backups dos dois arquivos públicos, não backup global MongoDB ou configuração inteira.

Comando limitado de publicação por host: `python3 -I -B -S <pasta>/deploy.py apply origin` ou `apply panel`. Conferir `node scripts/guard-tex-cta-qa-panel-v248.mjs --production`, URLs públicas e processo atual após publicar. Ativação real e recibo ficam em `docs/evidence/tex-cta-qa-panel-v248-publication-20261118.json` e `approved_freezes/TEX_CTA_QA_PANEL_V248_20261118.txt` somente depois da verificação.

Rollback pontual, não executar sem conferir nova instrução/estado: `python3 -I -B -S <pasta>/deploy.py rollback origin` ou `rollback panel`. Só aceita o hash V248 exato, restaura o preimage validado, conserva backup do arquivo revertido e recusa sobrescrever sucessor. Não reverte banco, conversas, mensagens ou ledgers. O manifesto V248 permanece histórico.

## Publicação final e congelamento conferidos

Publicado e congelado V248 R2 em 18/11/2026. Fonte funcional final `1dc871b5cfbfd917b4d2688abff1ba99e468a284`, sucessora do R1 `4b620170d476944da30aa523df06d07aaa82fd83`, branch `codex/tex-cta-qa-panel-v248`. Ambos preservam o parent frontend real 72c6ab9c; HEAD e índice de trabalho anteriores não foram trocados. Alterações preexistentes do AGENTS local não foram incorporadas ao commit: somente o parágrafo V248 foi aplicado ao parent no índice isolado.

Origem: oito combinações de host/dispositivo/barra final HTTP200, com HTML móvel e desktop idênticos aos anteriores. Asset WhatsApp HTTP200/no-store com SHA aprovado. Painel público HTTP200/no-store; o único delta entre HTML público e fonte é a tag de analytics Cloudflare preexistente de 367 bytes. Removida somente essa tag estritamente reconhecida na comparação em memória, o arquivo público equivale byte a byte ao fonte final. A primeira comparação bruta divergente e sua explicação ficam preservadas nos relatórios.

Guard V248 e guard Plusmen completo PASS depois de ambas as publicações. Interface real autenticada: QA exato selecionado, badge final e mensagem final conferidos; zero `.chat-preview .meta` na lista lateral. Captura final `docs/evidence/qa-panel-v248-r2-publicado-20261118.jpg`. Nenhum cliente real foi selecionado para essa prova. Processo principal PID3970878 permaneceu no mesmo release, cwd/exec/actualCwd corretos, saúde online, Z-API conectada e fila0; zero restart.

Evidência consolidada em `docs/evidence/tex-cta-qa-panel-v248-publication-20261118.json`; congelamento em `approved_freezes/TEX_CTA_QA_PANEL_V248_20261118.txt`. A congelagem protege a apresentação/código destes dois arquivos e mantém atendimento/dados operacionais existentes; não cria bloqueios ou pausa de serviços. Para rollback do painel **R2**, usar exclusivamente `/opt/vitalismen-automacao/backups/tex-cta-qa-panel-v248-20261118/refinement-r2/deploy.py rollback panel`; o controlador R1 anterior recusa o hash R2. Para CTA, permanece o controlador da pasta raiz na origem. Nenhum rollback foi executado.

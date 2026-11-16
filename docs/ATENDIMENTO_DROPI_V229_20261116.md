# PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

## Escopo autorizado

Pedido do operador de 16/11/2026: primeira saudação em 5 a 30 segundos, respeitando a fila; reunir perguntas rápidas em uma resposta após 60 segundos sem nova entrada; corrigir o envio Dropi que deixou de funcionar. Preservar os demais fluxos.

## Fonte oficial e diagnóstico

Baseline de produção: `/opt/vitalismen-automacao/releases/20261116T080433Z_production-20261116-cb77671`, commit `cb776711a0fe172c408dd642215e444580f6a40d`, VPS `72.60.137.77`. O HTML público continua servido pelo alias `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`.

Três entradas físicas do QA autorizado chegaram às 13:01/13:02 UTC e foram persistidas e autorizadas, porém não entraram na fila V228. O estado da autorização ainda era `routing` quando o burst consultava o guard; nesse estado, o guard exige o lock de processamento da mesma mensagem, que o roteador somente adquiria depois. A correção move exclusivamente a consulta/enfileiramento do QA exato para dentro desse lock. O guard, a janela finita, o histórico e a finalização permanecem obrigatórios.

A reprodução com histórico antigo também identificou a pergunta genérica `¿Me ayudan?` da CTA publicada junto das perguntas reais. O classificador agora reconhece o prefixo completo exato da CTA quando há texto adicional, preservando integralmente a entrada no histórico e no contexto do modelo. Perguntas substantivas não reconhecidas continuam fora do caminho de respostas factuais determinísticas.

No pedido `EC-MWIX6BWG-FGFW` (lead `3618`), a rejeição era local, anterior ao envio externo. Uma mensagem manual antiga sobre Nitrix antecedia a seleção autenticada de Vit Power e a confirmação do pedido. A nova exceção exige telefone EC exato, mesmo pedido no rascunho, produtos concordantes, lock ativo do operador, identificação do operador e seleção posterior ao conflito e anterior à confirmação. Preço, autorização, dados de entrega e duplicidade continuam sujeitos às validações existentes.

## Alterações pontuais

- B01: agendamento inicial entre 5.000 e 30.000 ms; pausas seguintes de mídia entre 18 e 30 segundos mantidas. A latência final depende da fila e do transporte; não representa garantia de entrega em 30 segundos sob congestionamento.
- Roteador: enfileiramento do único QA brasileiro autorizado ocorre depois da aquisição do lock existente. Nenhum outro telefone brasileiro é liberado.
- Classificador: trata o prefixo exato conhecido da CTA separadamente das perguntas adicionais.
- Dropi: reconhece seleção manual atual comprovada para o mesmo pedido, sem remover o bloqueio de divergência de produto.
- Dois arquivos de boot apontam para o sucessor exato registrado; três arquivos de testes cobrem os comportamentos.

## Candidato registrado

Commit `642ff478e73a4a760ca54c5ec87a2851284a5844`, tree `3844b4f894c02c0ce6cc6d575aa872ca75f1e888`.
Release `/opt/vitalismen-automacao/releases/20261116T135533Z_production-20261116-642ff47`.
Seal `ad681e0bdcf1ac215a0e0f63a5ab9334663108226d933e74607f871f9be9aa28`.
Dez caminhos autorizados, nenhuma migração. R1 não foi ativado: os testes de integração bloquearam sua publicação e motivaram R2. R2 também não foi ativado: a conferência com Date nativo do MongoDB revelou perda de milissegundos em Date.parse(Date). Sua suíte completa foi interrompida somente no grupo de testes isolado, sem tocar o processo de produção. R3 preserva os milissegundos e rejeita datas ausentes/inválidas; o mesmo pedido foi validado por consulta somente leitura com os tipos reais do MongoDB. Nenhum teste físico foi substituído por webhook artificial.

## Backup e rollback

Cópia opaca criptografada de 17 arquivos de código/boot e configuração privada em `C:/Users/Wolfe/Backups/VITALISMEN_EC/BOT_DROPI_V229_R3/20261116`. Descriptografia em memória, SHA-256, UID/GID/modos e rejeição de adulteração verificados. Chave de recuperação DPAPI permanece local. Não há segredo neste documento ou no Git.

Rollback exclusivamente de código/configuração: executar o comando `rollback` do controlador registrado em `/opt/vitalismen-automacao/backups/ec-bot-dropi-v229-r3-20261116/operations-controller.py`. Ele retorna o symlink ao baseline, restaura o perfil completo anterior e recria apenas o processo Vitalismen se necessário; remove somente o próprio drop-in para que o executor anterior do pós-venda reassuma. Conferir `pm2 jlist`, destino real de `current`, `/proc/<pid>/cwd`, `pm_cwd`, `pm_exec_path` e health/Z-API. Não restaurar bancos vivos, não repetir mensagens, pedidos ou eventos. Um pedido já criado no Dropi não deve ser reenviado no rollback.

O backup global MongoDB continua FAIL por consistência não comprovada no standalone; recuperação de código/configuração não altera esse resultado.

## Evidências obtidas antes da publicação

- Guard senior e guard de produto: PASS.
- Testes focados da revisão final R3: 283/283 PASS.
- Integração HTTP da aplicação real, MongoDB descartável, rede privada e provedor local: 37 verificações PASS; inclui callback genérico, histórico antigo do QA, lock antes da fila, resposta agrupada em ordem e callbacks duplicados nas duas rotas.
- Mensagens rápidas antes da saudação: 31 verificações PASS.
- Reinício com perguntas pendentes: 32 verificações PASS.
- Intervenção humana interrompe o lote antigo; liberação explícita permite novo lote: 34 verificações PASS.
- API OpenAI real: cinco conversas sintéticas PASS na R2, herdadas na R3 após conferir blobs Git idênticos do motor, classificador, catálogo e composição, com consulta às fontes oficiais existentes, memória e encaminhamento por informação indisponível. Zero pedidos e zero WhatsApp nessa prova.
- Testes negativos de integridade/flags, startup isolado e senior legado somente leitura: sete gates PASS.
- Funções de escopo: 16 verificações PASS, sem rede/banco.
- Recuperação de código/configuração criptografada: PASS, 17 arquivos e configuração privada conferidos em memória.
- Painel público HTTP200 e arquivos/Nginx preservados. As 115 verificações de navegador são herdadas explicitamente do frontend inalterado; não houve nova execução visual.
- Suíte senior completa da revisão final R3: PASS em 1.504,3 segundos; grupos TAP de 43, 482 e 22 testes, todos sem falhas (547 no total). Produção permaneceu no processo anterior durante toda a qualificação.

A primeira reprodução rejeitou corretamente um identificador de conexão incorreto no fixture. Outra reprodução bloqueou R1 ao detectar que a CTA junto das perguntas ainda não produzia a resposta factual ordenada. Essas falhas permanecem arquivadas; R1 nunca foi ativado. O teste local `npm run senior:check` não pôde executar por dependência mongoose ausente no checkout local; as verificações operacionais são executadas no candidato oficial da VPS, com isolamento de rede e sem banco de produção.

## Resultado de execução

Fonte publicada no Git oficial e ativada às 14:28:52.418 UTC de 16/11/2026. Processo anterior PID 3617629, processo atual PID 3647046, um reinício coordenado. Diretório real do processo, `pm_cwd` e `pm_exec_path` conferidos no release R3. Health online, Z-API conectada, dez arquivos com hashes conferidos, painel e Nginx preservados. A resposta agrupada iniciou em QA_ONLY, aguardando prova física antes da promoção para EC.

O dry-run do executor de pós-venda às 14:31:38.451 UTC passou com zero envios e zero saídas físicas. O timer original e sua data forward-only foram preservados.

## Prova física e liberação operacional

A sessão WhatsApp Web do próprio QA 8637 foi identificada pelo telefone exibido em seu perfil. O destinatário foi conferido nos dados do contato Ana Lopez, final 2958. Foram enviados pela interface três textos separados: a CTA completa de Vit Power, a pergunta de preço de um frasco e a pergunta de composição. Nenhum webhook artificial foi usado nesta prova.

O gateway oficial admitiu as três entradas às 14:30:42.031, 14:30:55.789 e 14:31:13.147 UTC. As três foram persistidas e processadas na janela finita. O bot enviou uma única resposta em ordem preço → composição, 64,866 segundos depois da última entrada persistida; ACK 3 (lida), ledger único, zero resposta duplicada e zero pedido do QA. O modelo executou com sucesso, e a memória e a classificação V219 ficaram vinculadas ao último ID desse lote.

Resposta recebida no WhatsApp: “Precio: 1 frasco: USD 39.99. Composición de Vit Power: borojó, chontaduro, noni, L-arginina, maca, guaraná, vitaminas.” A captura `QA_WHATSAPP_REAL.png` foi salva junto às evidências locais. O contato possui histórico antigo; por isso a trava contra repetir a apresentação foi preservada. O intervalo inicial de saudação de um contato novo foi comprovado nas simulações, sem apagar o histórico do QA para forçar outra saudação.

Às 14:32:50.890 UTC, a prova foi vinculada ao commit R3, ao PID ativo, aos hashes dos três recebimentos reais e ao ACK da resposta. O perfil foi promovido para **EC_FORWARD_ONLY**, sem outro reinício. A janela de QA foi encerrada e seu atendimento humano anterior restaurado; o contato permanente não foi excluído.

Auditoria após a promoção: PASS, PID 3647046 no release R3, Z-API conectada e saída desbloqueada, dez hashes de arquivos conferidos, flags legadas desligadas, painel/Nginx e controles anteriores preservados. O pedido Dropi 7982030 continuou `submitted`, lead `pedido_enviado`, um frasco por USD 39,99, atendimento humano preservado. Não houve novo envio do pedido.

A liberação vale para entradas elegíveis, conforme os controles existentes de produto, fila, atendimento humano e antirrepetição. O agendamento de 5–30 segundos não promete entrega física em até 30 segundos sob fila ou indisponibilidade do provedor. As provas obtidas não equivalem a garantia de 100% de todas as entregas futuras.

## Recuperação operacional do pedido real antes da publicação do código

Em 16/11/2026 às 14:07:19.929 UTC, o fluxo já publicado criou o pedido Dropi **7982030** para o pedido operacional `EC-MWIX6BWG-FGFW`, lead `3618`. Foram mantidos Vit Power, um frasco e USD 39,99. A recuperação usou as ações autenticadas existentes de configurar produto/preço no mesmo ID, recolocar na fila normal, autorizar e enviar uma única vez, com intenção persistida antes do submit.

A auditoria de 14:08:50 UTC confirmou ID 7982030 no pedido e no espelho, `raw.latestDroppiPayload.status=submitted`, lead SQLite em `pedido_enviado`, quantidade/valor preservados, atendimento humano preservado e zero pedidos do QA. A primeira tentativa da ferramenta de operação parou antes de qualquer alteração por comparar telefone com e sem sinal `+`; a normalização canônica resolveu essa checagem. Não houve retry do envio externo.

Esse resultado foi obtido pelo fluxo anterior publicado, antes da ativação R3. A revisão geral R3 foi ativada somente depois do PASS da suíte completa do candidato.

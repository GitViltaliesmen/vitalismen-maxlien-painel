# VITALISMEN OFICIAL — Regras Fixas do Projeto

PROJECT=VITALISMEN_EC

## Exceção autorizada Tex V250/V251 — 2026-11-19

- Pedido explícito: retirar o início de checkout antecipado e liberar o convite do chat somente depois de uma mensagem recebida no WhatsApp, sem novo formulário na VSL.
- Registro operacional: `docs/TEX_CHECKOUT_E_CONVITE_POS_WHATSAPP_V251_20261119.md`; recibo `docs/freeze/tex-postlead-v251-published-20261119.json`; página `docs/freeze/tex-postlead-site-v251-20261119.json`.
- Preservar a recusa de chat anônimo, o vínculo de navegador verificado pelo convite, o corte prospectivo, a reserva permanente sem reenvio e todos os bloqueios humanos/opt-out existentes. Não usar clique, retorno à aba ou tempo decorrido como prova de mensagem recebida.
- V250 retira InitiateCheckout da CTA e da fila local Tex. V251 não cria checkout ou compra por acesso ao chat e não autoriza replay ou correlação histórica de anúncios.
- Fonte/backup/rollback em `ops/publications/tex-postlead-v251/README.md`. Guard Plusmen e guard CTA/QA anteriores mantêm os baselines por inversão exata. A compatibilidade com a edição manual concorrente do painel está em `docs/freeze/panel-manual-edit-compatibility-v251-20261119.json`; esta tarefa não publica alterações no painel. As atualizações concorrentes de status e da rota de Leads estão registradas em `docs/freeze/panel-status-edit-compatibility-v251-20261119.json` e `docs/freeze/ec-leads-route-compatibility-v251-20261119.json`.
- Demais congelamentos permanecem vigentes. Este registro não pausa a operação, não reabre QA e não libera contatos antigos.

## Exceção autorizada e congelamento Tex V249 — 2026-11-18

- Pedido explícito do operador: ativar o funil Tex e adaptar a saudação para Ana Lopez/equipe da Dra. María Fernandes, primeiro nome e período do Equador.
- Baseline: `docs/freeze/tex-ultra-entry-greeting-v249-20261118.json`; auditoria `docs/TEX_ULTRA_ENTRADA_SAUDACAO_V249_20261118.md`; recibo `approved_freezes/TEX_ULTRA_ENTRADA_SAUDACAO_V249_20261118.txt`.
- Preservar a preferência da entrada publicada pelo funil Tex, a saudação solicitada e o reconhecimento estrito do callback já processado, incluindo a identificação oficial de sessão de saída. Não transformar outro ID em duplicata nem repetir etapas.
- Demais congelamentos e pausas humanas permanecem vigentes. Nenhum replay, reset, liberação de contatos ou nova janela QA decorre deste registro. Congelamento não pausa a operação.


## Exceção autorizada V248 — CTA clara e indicação QA — 2026-11-18

- Pedido explícito: simplificar a CTA WhatsApp de `https://plusmen.shop/tex`, corrigir a indicação antiga do QA 8637, simular, publicar e congelar.
- Baseline específico: `docs/freeze/tex-cta-qa-panel-v248-20261118.json`; procedimento e limites em `ops/publications/tex-cta-qa-panel-v248/README.md`; recibo pós-publicação em `approved_freezes/TEX_CTA_QA_PANEL_V248_20261118.txt`.
- CTA: `PEDIR TEX ULTRA POR WHATSAPP`; mesmo botão, handler nativo, telefone, mensagem, timing e player. Não reabrir VTurb nem alterar a página desktop por causa deste registro.
- QA: indicação visual da janela real ativa/encerrada; nenhuma reabertura automática de permit, restauração de conversa, envio, reset ou remoção de memória/ledger.
- Guard: `node scripts/guard-tex-cta-qa-panel-v248.mjs --production` e guard Plusmen anterior preservado com inversão exata do sufixo autorizado. Demais congelamentos continuam vigentes.

## Exceção autorizada V245 — mensagem WhatsApp sem referência — 2026-11-17

- Pedido explícito posterior ao congelamento: retirar a linha `Referencia: TX243-...` da mensagem aberta pelo botão da VSL `https://plusmen.shop/tex`.
- Mensagem direta: `Hola, quiero el tratamiento Tex Ultra.`; mesmo telefone e mesmo handler nativo aprovado.
- Baseline específico: `docs/freeze/plusmen-tex-whatsapp-clean-v245-20261117.json`. O restante do congelamento V244 permanece vigente.
- Novas entradas diretas deixam de levar a referência de visita usada para atribuição automática. Preservar eventos de navegador e vínculo confirmado do chat; não inventar correlação nem reintroduzir o código sem novo pedido explícito.


## Congelamento total vigente — V244 — 2026-11-17

- Ordem explícita mais recente do operador: `Congele tudo`.
- Fonte de verdade: `docs/CONGELAMENTO_TOTAL_VITALISMEN_V244_20261117.md`; manifesto `docs/freeze/vitalismen-ec-total-aprovado-v244-20261117.json`; recibo `approved_freezes/CONGELAMENTO_TOTAL_VITALISMEN_V244_20261117.txt`.
- Preservar o estado aprovado inteiro: backend d27cc7c7f2a21ad74e02ca5b6332ee50b151399b, VSL móvel/informativa desktop, player/CTA/Turbo/telefone, chat liberado somente junto à CTA WhatsApp, funil/voz, identidade entre canais, Meta, demais produtos, memória, pedidos, Dropi, Z-API, pós-venda e guardas existentes.
- O congelamento protege alterações de código/configuração/apresentação; atendimento e dados operacionais continuam no modo autorizado existente. Não pausar serviços nem criar flags, locks ou bloqueios por causa deste registro.
- Nova alteração somente por pedido explícito do operador citando o ponto a mudar. Autorizações anteriores já concluídas não reabrem o trabalho congelado.
- Guard obrigatório para esta rota: `node scripts/guard-plusmen-tex-freeze.mjs`. Manter todos os manifestos anteriores, backups, falhas e limites; nunca trocar hashes ou desligar guard/dedupe/histórico para obter PASS.
- A primeira jornada/conversão Meta real continua pendente de observação; congelamento não transforma ensaio em cliente real nem equivale a backup global MongoDB.


## Identificacao obrigatoria no topo

- Comecar as atualizacoes de andamento e a resposta final com `PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL`.
- Manter a identificacao do projeto atual visivel; este workspace pertence exclusivamente ao VITALISMEN_EC.

## Congelamento aprovado Plusmen /tex — 2026-11-17

- URL exata: `https://plusmen.shop/tex`; produto `tex_ultra_ec` / Tex Ultra Ecuador.
- Aprovacao visual explicita do operador: VSL abre no celular; computador/equivalentes abre a pagina informativa original VerdeVibe.
- Baseline: `docs/freeze/plusmen-tex-device-split-20261117.json`; recibo `approved_freezes/PLUSMEN_TEX_DEVICE_SPLIT_APPROVED_20261117.txt`.
- Preservar player `6aafe87d665f0c5b457748ad`, CTA nativa em `2257s / 37:37`, Turbo `1.2x`, destino WhatsApp `553171862958` e mensagem Tex Ultra. A aprovacao visual nao equivale a observacao integral do instante da CTA ou prova de envio real.
- Nao reeditar a separacao celular/desktop nem salvar novamente no VTurb por causa deste registro. Sem nova falha observavel, manter a apresentacao aprovada.
- Antes de nova microcamada nessa rota, rodar `node scripts/guard-plusmen-tex-freeze.mjs`, comparar com o parent real e preservar os elementos aprovados. Nunca atualizar hashes apenas para obter PASS.
- Chat Tex Ultra e atribuicao no painel sao trabalho separado ja solicitado; a autorizacao especifica permanece valida, com testes de nao regressao e sem alterar a VSL aprovada. O congelamento nao autoriza importacao de catalogo, preco, midia, funil ou historico de Vit Power.
- Correcao Meta/dependencias continua com seus gates e pendencias proprios; a aprovacao visual nao aprova anuncios, envios de teste, pedidos ou alteracoes em massa.
- Fonte, backup e rollback pontual: `docs/PLUSMEN_TEX_MOBILE_TELEFONE_20261117.md`.

## Congelamento vigente EXUTRA — 2026-10-02

- Para o fluxo explicitamente autorizado `https://maxlien.shop/exutra`, o baseline atual e `docs/freeze/exutra-cta-2137-final-20261002.json`.
- Estado aprovado: CTA unica em `2137s / 35:37`, Turbo `1.2x`, tempo continuo esperado de aproximadamente `29:41`, formulario/bridge e atendimento manual preservados.
- Preservar a configuracao validada. Nao salvar novamente no VTurb nem alterar producao, formulario, bridge, CTA ou Turbo por causa deste registro.
- Nao reabrir a investigacao sem nova falha observavel. Observar trafego real nao autoriza envios de teste, correcoes automaticas ou mudancas operacionais.
- Os registros anteriores de timing sao historicos; manter suas evidencias e usar o manifesto atual como referencia.

## Regra maxima EC Maxlien — Tex Ultra / Nitrix / Vit Power

Regra maxima e permanente: este projeto, quando tratar de `ec.maxlien.shop/n/`, e somente Equador na VPS Hostinger oficial, Git Equador e dominio publico oficial:

```sh
https://ec.maxlien.shop/n/
ssh root@72.60.137.77
/opt/vitalismen-automacao/current
```

Decisao operacional mais recente, autorizada pelo operador em 2026-07-26:

- produto oficial do trafego atual `/n/`: Tex Ultra Ecuador;
- tabela promocional Tex Ultra: 1 frasco USD 35.99, 2 frascos USD 70.00, 3 frascos USD 80.99 e 6 frascos USD 147.99;
- Nitrix Oxide Ecuador e Vit Power Ecuador continuam disponiveis para selecao/alteracao manual no painel e envio controlado ao Dropi;
- cada VSL conserva seu proprio produto de origem: `/n/` abre Tex Ultra, `/m/` abre Vit Power e uma entrada Nitrix explicitamente identificada abre Nitrix;
- o painel e multiproduto, mas a troca manual vale somente para a ficha/pedido daquele cliente e nunca altera a atribuicao das outras VSLs;
- a origem da VSL deve permanecer registrada separadamente mesmo quando o operador troca o produto do pedido a pedido do cliente;
- toda oferta deve usar `frasco`/`frascos`, nunca `mes`/`meses`;
- nenhum funil, audio, imagem ou prova de outro produto pode ser aplicado automaticamente ao Tex Ultra.

Correcao obrigatoria de nomenclatura: nao e Superfull. Superfull nao deve ser criado, roteado, citado, reaproveitado ou tratado como produto deste fluxo.

E proibido misturar, importar, copiar, comparar ou publicar qualquer coisa de Colombia, Contabo, Maxtourus, outro dominio, outro numero, outro banco, outro pixel, outro funil, outro VPS ou outro Git sem pedido explicito do operador citando exatamente essa origem.

Qualquer mudanca neste fluxo deve ser micro camada pontual. Nao esta autorizado mexer no motor principal do bot, preco, checkout, Dropi, Meta/CAPI, pixel, Z-API, numero de WhatsApp, funil comercial ou memoria de pedidos sem aprovacao explicita.

Estado congelado e trava de escopo:

```sh
FREEZE_EC_NITRIX_VIT_POWER_MICRO_LAYER_20260708.md
```

Guard obrigatorio antes de publicar alteracao de produto EC:

```sh
node scripts/audit-ec-product-micro-layer.mjs
```

## Regra maxima anti-spam WhatsApp EC

Nunca deixar scheduler reenviar automaticamente a mesma midia, guia, print, fatura, audio ou mensagem para o mesmo cliente/pedido.

Risco maximo: repeticao automatica pode banir o WhatsApp oficial `5515991418416`.

O unico telefone brasileiro autorizado para testes controlados de entrada e saida e
`5515998038637`. Ele nunca deve ser tratado como cliente real, gerar pedido, Dropi,
Meta/CAPI ou disparo em massa.

Decisao permanente do operador em 2026-11-14: preservar esse contato de QA no
painel, com prioridade e marcacao de teste; nao excluir, substituir ou ampliar a
excecao brasileira sem nova instrucao explicita. A identidade fixa nao elimina as
janelas e os limites de cada teste automatico. Registro e evidencias em
`docs/QA_8637_PERMANENTE_E_VALIDACAO_20261114.md`.

Incidente congelado:

```sh
FREEZE_EC_GUIDE_PRINT_SPAM_GUARD_20260708.md
```

Antes de finalizar qualquer deploy no VPS, conferir obrigatoriamente que o PM2 esta executando o release atual, nao apenas que o symlink `current` mudou:

```sh
pm2 jlist
readlink -f /opt/vitalismen-automacao/current
```

O processo `vitalismen-automation` precisa ter `pm_cwd` e `pm_exec_path` apontando para o release ativo. Se PM2 continuar em release antigo, recriar apenas esse processo apontando para `/opt/vitalismen-automacao/current`.

Qualquer scheduler que envia ao cliente precisa ter:

- campo persistido no schema para "ja enviado";
- lock persistido no schema;
- busca por historico antes de reenviar;
- guard automatizado cobrindo os pontos acima.

## Modos operacionais oficiais e transporte WhatsApp EC

O contrato versionado de `scripts/senior-guard.mjs` e a fonte de verdade para a combinacao de flags. Existem somente dois estados validos; combinacoes parciais sao proibidas.

No modo observacao/nao operacional, identificado pela ausencia de `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, as flags de funil, resposta automatica, roteamento inbound, scheduler e automacoes pos-venda protegidas pelo guard permanecem desligadas. Nesse modo, `WHATSAPP_FUNNEL_ENABLED=false` e uma trava anti-legado.

No modo operacional aprovado, identificado por `VIT_POWER_OPERATIONAL_AUTOMATION_APPROVED=true`, todas as flags acopladas devem ter exatamente os valores exigidos pelo senior guard. Nesse modo completo, `WHATSAPP_FUNNEL_ENABLED=true` nao e violacao e nao autoriza retorno de `src/services/funnelService.js` ou de qualquer fluxo removido.

Nunca alterar apenas `WHATSAPP_FUNNEL_ENABLED`. A troca entre modos e uma mudanca operacional coordenada, exige decisao explicita e deve manter o conjunto inteiro validado pelo senior guard.

Para a operacao EC atual, Z-API e o transporte oficial de entrada/saida publica. Baileys pode permanecer habilitado ou em `scanning` como camada coexistente, mas a falta de sessao Baileys pronta nao torna a operacao indisponivel quando a Z-API oficial estiver configurada e conectada. O health deve consultar a Z-API por mecanismo somente leitura, sem enviar mensagens, criar sessao ou modificar estado.

## Congelamento total atual

O estado aprovado em 2026-05-17 esta congelado em:

```sh
docs/CONGELAMENTO_TOTAL_VITALISMEN_2026-05-17.md
approved_freezes/CONGELADO_TOTAL_VITALISMEN_20260517_021215.txt
```

Antes de mexer em painel WhatsApp, Dropi Ecuador, funil Vit Power, midia, audio, imagem, video, foto da atendente, memoria de cliente, numeros conectados, filtro EC, pedidos confirmados ou formulario de cliente, ler esse congelamento.

Regra dura: nao alterar, remover, reordenar, simplificar ou refazer comportamento congelado sem pedido explicito do operador citando o ponto que deve mudar.

## Isolamento de outros projetos de automacao

Este projeto e somente a automacao oficial Vitalismen / Vit Power Ecuador.

Os caminhos locais oficiais e autorizados são:

```sh
/Users/greson/Documents/Vitalismen Automacao
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

O caminho oficial no VPS e:

```sh
/opt/vitalismen-automacao/current
```

Antes de trabalhar, conferir o marcador `.vitalismen-official-root` e rodar `npm run official:path` quando houver qualquer duvida de contexto.

Nao abrir, alterar, comparar, empacotar, testar, iniciar, parar, deployar ou usar como referencia qualquer outro projeto de automacao sem pedido explicito do usuario citando esse projeto.

Projetos fora de escopo incluem, mas nao se limitam a:

- `/Users/greson/Documents/New project 4/[aquecimento total maio de 2026]`
- qualquer automacao de aquecimento separada da Vitalismen;
- copias antigas, zips, pastas temporarias ou projetos paralelos.

Se a conversa disser apenas "retome", "continue", "o bot", "a automacao" ou algo semelhante, assumir sempre a pasta oficial do sistema operacional atual:

```sh
/Users/greson/Documents/Vitalismen Automacao
C:\Users\Wolfe\Documents\SITES\MAXLIENSHOP_JULHO_2026\Vitalismen Automacao
```

Antes de usar outra pasta, confirmar com o usuario. Se houver confusao de contexto, parar e reancorar em `.vitalismen-official-root`, `docs/CAMINHO_OFICIAL_UNICO.md`, `PROJETO_OFICIAL_VITALISMEN.md`, `docs/RETOMADA_2026-05-10.md` e nesta regra.

## Arquivos oficiais primeiro

Antes de alterar qualquer VSL, checkout, painel, automacao, funil, Dropi, WhatsApp ou integracao:

1. Localizar qual e o arquivo oficial em producao ou a fonte de verdade registrada.
2. Ler o arquivo oficial atual antes de editar.
3. Ler `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md` antes de mexer em funil, WhatsApp, prompt, audio ou scheduler.
4. Se o arquivo oficial estiver no VPS, baixar ou inspecionar a versao do VPS antes de aplicar patch local.
5. Fazer backup do arquivo oficial antes de substituir em producao.
6. Aplicar a menor alteracao possivel.
7. Validar na URL/servico oficial depois do deploy.
8. Registrar o caminho oficial, backup e validacao em `docs/ARQUIVOS_OFICIAIS.md` ou no documento operacional correspondente.

Nao editar com base em copia temporaria, zip, pasta antiga, `.codex-tmp`, print, memoria da conversa ou suposicao quando houver arquivo oficial acessivel.

## Ordem de prioridade

1. VPS em producao.
2. Arquivo oficial registrado em `docs/ARQUIVOS_OFICIAIS.md`.
3. Pasta local oficial: `/Users/greson/Documents/Vitalismen Automacao`.
4. Documentacao em `docs/`.
5. Copias temporarias ou antigas somente como referencia.

## Regra fixa do painel WhatsApp

No painel integrado `public/qr.html`, a coluna esquerda de conversas (`#chatList`, `.chat-item`, `renderChats`) nunca deve exibir texto de mensagens. Ela serve somente para listar contatos/conversas com avatar, nome/telefone, horario e selos operacionais como `Fechou`, `Humano` ou status de pedido.

Conteudo de mensagem (`message.body`, `chat.lastMessage.body`, transcricoes, midia ou texto completo) deve aparecer exclusivamente no painel central da conversa (`#conversation`, `renderMessages`) depois que o contato for selecionado.

E proibido recolocar `chat.lastMessage.body` ou qualquer preview textual de mensagem dentro de `.chat-item`, `.chat-preview`, `.chat-title` ou `.chat-foot`. Busca interna pode usar campos de mensagem se necessario, mas nada disso deve ser renderizado na coluna esquerda.

O painel Vitalismen nao deve misturar contatos de outros projetos, aquecimento, status do WhatsApp, grupos ou IDs tecnicos LID sem telefone real. A lista de conversas e metricas deve ser filtrada pela sessao oficial conectada da Vitalismen e mostrar apenas chats validos com telefone resolvido.

Antes de publicar qualquer mudanca no painel, validar que:

- `document.querySelectorAll('.chat-preview .meta').length === 0`;
- ao selecionar um contato, as bolhas aparecem em `#conversation`;
- a lista esquerda continua sem mensagem junto ao numero.
- `status@broadcast`, chats `@g.us` e IDs `@lid` sem telefone real nao aparecem como clientes.

## Funil Vit Power congelado

O funil inicial Vit Power do Equador esta congelado como processo oficial em `docs/FUNIL_ATENDIMENTO_FECHAMENTO.md`.

Nao refazer nem trocar a ordem aprovada sem pedido explicito. A ordem oficial e:

3. `social_01`
4. `social_02`
5. `vit_power_bottle`
6. texto de valores perguntando quantos frascos deseja

O sistema deve gravar memoria por contato para nao repetir etapas ja enviadas e deve respeitar pausas humanas configuradas por `INITIAL_FUNNEL_*`.

Formulario da VSL/CTA nunca deve ser respondido por IA livre quando trouxer dados de pedido. A regra oficial e deterministica: salvar os dados, perguntar somente campo faltante, ou enviar confirmacao final sem telefone quando estiver completo.

Regra operacional atual: o funil deve ler intencao forte antes de aplicar a etapa rigida. Quantidade clara, confirmacao, dados de pedido, entrega em agencia/domicilio e correcao de dados devem ser capturados, salvos e usados para continuar pelo proximo campo faltante. Se o cliente quebrar a ordem, nao reiniciar o funil.

Depois da apresentacao/preco, resposta de quantidade (`1`, `uno`, `1 frasco`, `3`, `tres`, `3 frascos`, `6`, `seis`, `6 frascos`) tem prioridade sobre complemento de audio. O bot deve enviar o audio especifico da quantidade, nao o audio geral `TRATAMENTO_Y_PRECIOS_PROMOCAO`.

Automacoes legadas que conflitam com o funil Vit Power foram removidas do caminho automatico:

- `src/services/funnelService.js` nao deve voltar.
- Recuperacao de rascunho nao deve voltar ao scheduler.
- Scheduler automatico de envio/retirada nao deve voltar sem decisao explicita.

Antes de testar ou mexer em automacao, rodar:

```sh
npm run senior:check
```

Quando a mudanca envolver o VPS, tambem verificar em producao:

```sh
cd /root/wa_wpp
npm run senior:check
```

O VPS `/root/wa_wpp` possui fluxos antigos bloqueados por flag. Nao religar `SERVER_FUNNEL_ENABLED` nem `AI_WORKER_ENABLED` sem pedido explicito e sem registrar a decisao em `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.

Nao religar nem recriar caminhos antigos sem atualizar `docs/ARQUITETURA_AUTOMACAO_OFICIAL.md`.

## Project identity

PROJECT_ID=VITALISMEN_EC

This workspace belongs exclusively to VITALISMEN EC.

Known foreign project:
GIRAUP21X = GiraUP / GIRAUP 21X / Evolución 21X.

Before editing files, running commands or performing external actions,
verify that the request belongs to VITALISMEN_EC.

If a request explicitly or clearly belongs to GIRAUP21X:

- STOP immediately.
- Do not edit files.
- Do not run commands.
- Do not reinterpret the request as Vitalismen work.
- Return exactly:

```text
PROJECT_MISMATCH=YES
EXPECTED_PROJECT=VITALISMEN_EC
DETECTED_PROJECT=GIRAUP21X
ACTION=STOP
```

## Context and token efficiency

- Assume full access to the VITALISMEN EC workspace, but do not read the entire workspace for every task.
- Start with the minimum context needed.
- Prefer targeted search before opening files.
- Read only files, logs, docs and state notes relevant to the current task.
- Expand investigation only when evidence requires it.
- Do not perform global audits unless explicitly requested.
- Do not repeat already-established project history.
- Prefer existing state/baseline notes over reconstructing history from many files.
- Keep logs and tool output minimal and relevant.
- Run focused tests first.
- Stop when the requested task is complete.

## Final response format

For normal tasks, begin every final response with:

PROJECT=VITALISMEN_EC — VITALISMEN OFICIAL

Then use:

STATUS=
CHANGED=
TESTED=
RESULT=
PENDING=
NEXT=

Prefer no more than 15 lines total.


## Regra permanente de nao regressao — atendimento Vit Power V219

- Evoluir somente o ponto explicitamente autorizado, sobre o baseline publicado em docs/freeze/vitalismen-ec-atendimento-baseline-v218-20261115.json.
- A lista versionada de arquivos permitidos, a comparacao com o parent real e os testes de regressao sao gates obrigatorios. Qualquer delta fora da lista ou teste obrigatorio falhando bloqueia a publicacao.
- Preservar B01 e pausas, formulario/primeiro nome, Comprar depois/ano automatico, dados existentes, pedido/confirmacao/recompra, humano/opt-out, demais produtos, pos-venda, Dropi, Z-API, Pixel/CAPI, precos e VSL. Nao resetar nem liberar contatos em lote.
- Nunca desligar guard, dedupe, lock, historico ou teste para obter PASS. Resultado incerto de envio nao autoriza retry automatico.
- Perguntas tem prioridade sobre avancar etapas: capturar dados comprovados, responder na ordem do cliente e perguntar somente o que falta. Uma pergunta nao autoriza registrar pedido.
- Antes de anexar uma pergunta de dado faltante, consultar o historico recente da mesma sessao oficial. Nao repetir uma pergunta ja enviada nem desligar a trava antirrepeticao para fazer uma resposta passar.
- Fonte comercial indisponivel exige explicacao e encaminhamento humano; nao importar promessas de KB antiga.
- Registrar fonte oficial, backup de codigo/configuracao recuperavel, resultados reais, limites e rollback exclusivo da microcamada. Codigo/configuracao nao equivale a backup global MongoDB.
- Autorizacoes ja dadas para este escopo permanecem validas; esta regra nao cria nova rodada de aprovacao. Mudanca de escopo requer instrucao explicita.
- Contrato e testes: docs/REGRA_SEM_REGRESSAO_ATENDIMENTO_V219.md e scripts/guard-freeflow-nonregression-v219.mjs.


## Congelamento publicado V252 — pedidos, Dropi, pós-venda e QA — 2026-11-19

- Pedido explícito: concluir pedidos novos em Atendendo, confirmação, recompra, Dropi, pós-venda e separar o QA antigo dos clientes reais; publicar, congelar e fazer backup.
- Runtime publicado e ativo: `959674ce88eed400012b57b28fdef4c6838869b5`; recibos e rollback em `docs/EC_PEDIDOS_DROPI_POSVENDA_V252_20261119.md`; manifesto `docs/freeze/ec-orders-dropi-postsale-v252-published-20261119.json`.
- Preservar a fila persistente de tentativa única após confirmação válida e seu corte de ativação, vínculos já comprovados, histórico, memória, humano/opt-out, dedupe, locks e os demais congelamentos. Não repetir envio incerto ou recriar venda existente. O recibo GINTRACOM mantém sua guia alfanumérica e transportadora reais; não inventar guia Servientrega nem evidência de entrega.
- QA 8637 permanece fixo na aba Testes e fora de Novas/métricas comerciais. Não resetar, apagar histórico ou reabrir janela por causa deste registro.
- Pós-venda mantém o timer existente e limite de uma saída física por ciclo. Congelamento protege código/configuração e não pausa operação.
- Backup global MongoDB continua FAIL, separado das recuperações aprovadas de código/configuração, dados dos casos e auditoria. Não converter ensaio em entrada física ou conversão Meta real.

## Exceção autorizada e congelamento V253 — ficha editável e PAQUIZHA — 2026-11-19

- Pedido explícito: aceitar alterações na ficha do cliente, conferir o catálogo anterior, incluir PAQUIZHA e a agência fornecida, salvar e congelar.
- Estado publicado: `docs/EC_FICHA_EDITAVEL_PAQUIZHA_V253_20261119.md`; manifesto `docs/freeze/ec-customer-edit-paquizha-v253-published-20261119.json`; recibo `approved_freezes/EC_FICHA_EDITAVEL_PAQUIZHA_V253_20261119.txt`.
- Preservar a edição/salvamento e a reidratação dos dados, os três patches exatos do painel e as 592 agências/220 cidades, com os 591 registros anteriores intactos. PAQUIZHA usa o formato original ZAMORA, agência PAQUIZHA_MARTHA BUCARAM, setor SUR e endereço da imagem; horários não fornecidos ficam vazios.
- Fonte real do painel em `/var/www/vitalismen-panel-phonefix-20261108-r1/qr.html`, registrada no pacote V253. Não substituí-la por snapshot antigo de release. Guard: `node scripts/guard-customer-edit-paquizha-v253.mjs --production`; o comando V248 existente também aceita a inversão exata V253, preservando os baselines anteriores.
- Manter integralmente V252, filas/cortes de envio, pós-venda, pedidos, memória, dedupe, humano/opt-out, QA e seus limites, preços, Meta, voz e VSL/CTA. Salvar ficha não cria/reenvia pedido. Sem cron novo, replay, reset ou janela QA nova. Este congelamento não pausa a operação.
